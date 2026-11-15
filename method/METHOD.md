# Method and limitations

Owner issue: RA-5 (Rafael). Input for Tiara (TI-5, TI-6).
Only decided method steps (see DECISIONS.md) go here; every number has a source file path.
Status: every decision cited here is DECIDED in method/DECISIONS.md.

## Method

### 1. Data

- **Source:** NASA FIRMS (https://www.earthdata.nasa.gov/data/tools/firms), the only data resource of the challenge.
- **Product:** FIRMS country yearly summary CSVs, standard processing (https://firms.modaps.eosdis.nasa.gov/data/country/), for Brazil and Bolivia (DE-8).
  - Bolivia's files are read because FIRMS assigns some detections near the border to Bolivia while they lie inside the IBGE boundary of Rondônia.
- **Satellites:**
  - MODIS 1 km on Terra (from 2000-11-01) and Aqua (from 2002-07-04, the first Aqua day in the files);
  - VIIRS 375 m on S-NPP (from 2012-01-20) and NOAA-20 (from 2018-04-01);
  - VIIRS 375 m on NOAA-21 (from 2024-01-17), as a check of NOAA-20 only (DE-11).
  - Source: method/FIRMS_REFERENCE.md section 2.
- **Versions seen** in the files (`docs/data/metadata.json`): MODIS `6.2` (2000-2017), `6.03` (2018-2022) and `61.03` (2023-2025); VIIRS `2` (Collection 2). By the MCD14ML naming (collection, then product version; MODIS user guide section 5.5.1), they read as Collection 6 version 2 (most likely), Collection 6 version 03 and Collection 6.1 version 03. All are standard processing, except the 2026 NRT rows (`6.1NRT`, `2.0NRT`). Details: method/FIRMS_REFERENCE.md section 13, item 1.
- **Period:** 2000-11 to 2026-10. Data cut-off 2026-10-31, the last complete month when the data were downloaded; archived data, not live (`docs/data/metadata.json`).
- **Area (DE-1):** Rondônia, Brazil, as given by the IBGE state boundary (`config/area_boundary.geojson`; source URL in its properties).
  - The processing box (`config/area.json`) is the boundary's bbox aligned outwards to 0.25° cells: west -67, south -13.75, east -59.75, north -7.75.
- **Download:** 96 files (48 instrument-years × 2 countries), each with its size checked against the FIRMS index (https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt). 91 are listed in `data/raw/download_manifest.csv` (local); the first 5 were downloaded earlier with the same check.
- **NOAA-21** has no FIRMS country files. It was downloaded from the FIRMS area API (`VIIRS_NOAA21_SP`, standard processing, bbox of `config/area.json`, 2024-01-17 to 2025-12-31; `pipeline/download.py --api-source`, 2026-11-15): 298,812 rows (`method/results/cleaning_log.csv`). The API listed `VIIRS_NOAA21_SP` from 2023-03-01 to 2026-07-31 (`pipeline/check_availability.py`, 2026-11-15); the period follows DE-15.
- **2026** is not in the country files. It was downloaded from the FIRMS area API on 2026-11-15 for all four satellites, 2026-01-01 to 2026-10-31 (DE-8): standard processing up to the last standard date listed by `data_availability` (VIIRS 2026-07-31, MODIS 2026-08-31), then near real-time (NRT). NRT months are flagged `provisional` (DE-4): August to October 2026 for VIIRS, September and October for MODIS (`docs/data/months.csv`). `DATA_END` in `pipeline/aggregate.py` stops the coverage on 2026-10-31, so later months have no data instead of zero.

### 2. Cleaning (`pipeline/clean.py`; DE-1, DE-4, DE-5, DE-9, DE-10)

**Rules, in order:**
1. Normalize the schema.
2. Keep detections inside the processing box (half-open intervals).
3. Keep only detections inside the IBGE boundary (point in polygon).
4. Keep dates from 2000-11-01.
5. Keep only `type` 0 (presumed vegetation fire).
6. No confidence or day/night filter.
7. Drop exact duplicates.
8. Use standard data before NRT data.

**Result** (`method/results/cleaning_log.csv`): 48,648,899 rows read from the two countries' files. Removed: 44,276,831 outside the box, 2,318,649 outside the boundary, 9,794 with `type` ≠ 0 and 0 duplicates. **2,043,625 detections were kept.** NOAA-21 (area API): 298,812 rows read; removed 1 outside the box, 202,493 outside the boundary and 191 with `type` ≠ 0; **96,127 kept**. 2026 (area API, four satellites): 133,639 rows read; removed 104,520 outside the boundary and 16 with `type` ≠ 0; **29,103 kept**. The API writes `acq_time` without leading zeros; `clean.py` pads it to HHMM. NRT rows have no `type`, so `type` ≠ 0 cannot be removed from them (DE-9).

### 3. Aggregation (`pipeline/aggregate.py`; DE-12, DE-14)

- **Grid:** detections are counted per 0.25° cell, month and satellite. Satellites are never summed at this step. A cell that crosses the boundary counts only its detections inside Rondônia.
- **Missing data:** a satellite-month is flagged when at least one day is missing. Missing days are the FIRMS `missing_data` list plus the days outside the satellite's operating window. 33 of 919 satellite-months are flagged (`docs/data/months.csv`).
- **Flagged months have no value, never zero** (AGENTS.md rule 6).

### 4. Harmonization (`pipeline/harmonize.py`; DE-2, DE-6, DE-11)

- **Target scale:** monthly count of VIIRS 375 m hotspots per cell.
- **Native months (2012-02 onwards):** the value is the observed count of one reference VIIRS satellite: S-NPP until 2018-03, NOAA-20 from 2018-04. One satellite per month avoids double counting. NOAA-21 is exported as raw counts (per-sensor view) and is not used for the harmonized value.
- **MODIS-only months** (2000-11 to 2012-01; January 2012 because S-NPP starts on 2012-01-20) are converted with a **ratio per month of year**: `VIIRS_eq = k(month) × MODIS`.
  - k = sum(reference VIIRS) / sum(MODIS) over 2015-2025, the years where both sensors observe.
  - MODIS is Terra + Aqua when both are valid. It is Terra alone before Aqua (2000-11 to 2002-06) and in months with Aqua flagged.
  - Fitted k (`method/results/harmonize_model.json`): Terra + Aqua from 1.45 (March) to 4.63 (January); Terra alone from 5.06 (March) to 18.13 (January).
- **Both sensors are used:** MODIS gives the 2000-2012 series and half of the calibration data. VIIRS gives the scale, the series from 2012 and the other half.
- **Result:** 376 active cells × 312 months (2000-11 to 2026-10). 129 months are converted from MODIS and 10 months have no data (`docs/data/monthly_cells.csv`).

### 5. Uncertainty (DE-16)

- **Variance** per converted cell-month: (mu + alpha·mu²) × lambda.
  - alpha by the method of moments: 0.036 for Terra + Aqua and 0.089 for Terra alone (`method/results/harmonize_model.json`).
  - lambda = 11.5, calibrated on held-out years (`method/results/uncertainty_calibration.json`).
- **For an area:** 90 % interval = sum ± 1.645·sqrt(summed variance).

### 6. Validation (`pipeline/validate.py`; DE-15)

Summary of `method/VALIDATION.md`; all numbers from `method/results/validation_metrics.json`. The validation covers 2000-11 to 2025-12, the period fixed in DE-15; the 2026 months (partly provisional) are not part of it:

- **Backcast** (fit on 2015-2025, predict 2012-2014 from MODIS, compare with real VIIRS): bias of the total +0.6 %; median absolute error of monthly totals 13.3 %; r = 0.998.
- **Leave-one-year-out 2012-2025:** yearly bias from -9.7 % to +7.9 % (`method/results/loyo.csv`).
- **Without harmonization** the series would jump by a factor of 3.81 when VIIRS enters (2012-2014 raw VIIRS/MODIS).
- **VIIRS continuity:** NOAA-20/S-NPP = 0.992 over 83 months; NOAA-21/NOAA-20 = 0.956 over 21 months (2024-04 to 2025-12).
- **Method choice:** the negative binomial regression first proposed in DE-6 failed this pre-registered test (bias +143 %), so the ratio method was selected by the DE-15 rule.
- **ML challenger (RA-6, DE-18):** gradient boosting did not beat the ratio method in the backcast (bias +3.3 %, MdAPE 17.5 %, against +0.6 % and 13.3 %; `method/results/ml_metrics.json`), so production is unchanged. An exploratory hybrid (ratio x ML correction, DE-19) was not promising either (`method/results/ml_hybrid_metrics.json`).

## Target scale and justification

**VIIRS-equivalent (DE-2, DECIDED).** The arguments, in order of source:
1. **The challenge author accepts either scale.** "Either alternative is fine if properly justified." (https://github.com/nasa/spaceapps/discussions/1879)
2. **The challenge asks for continuity with VIIRS.** "it makes sense to look for solutions that extend into the future—therefore, NOAA-20 and NOAA-21 satellites that are still active." (same discussion). NOAA-20 and NOAA-21 carry VIIRS 375 m, so on the VIIRS scale future months need no conversion.
3. **MODIS is retiring and being replaced by VIIRS** (challenge video; method/FIRMS_REFERENCE.md section 1). NASA plans to end Terra MODIS data collection in January 2027 and Aqua MODIS around September 2027 (CAMS, 2026-02-25: https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system).
4. **MODIS and VIIRS overlap in FIRMS from 2012-01-20 onwards**, so the conversion can be learned and tested on real data (section 6).
5. **Finer pixels:** 375 m vs 1 km (FIRMS_REFERENCE section 2).

**Cost accepted:** the MODIS-only years are estimates on the VIIRS scale, not observations. See the limitations below.

## Limitations

1. **2000-11 to 2012-01 are estimates.** They cannot be checked against VIIRS, which did not exist then. The backcast only tests the conversion on 2012-2014.
2. **Extrapolation in fire activity.** 2003-2007 and 2010 had more MODIS detections than any overlap year: up to 71,460 a year, against at most 22,872 (`method/results/validation_metrics.json` → `ratio_stability`). The ratio is stable across the overlap years (3.66 to 4.28, not related to fire activity), but these years are outside that range.
3. **Terra-only months are less accurate.** In the backcast the Terra-only ratio has -8.5 % bias and 27.3 % MdAPE, against +0.6 % and 13.3 % with Terra + Aqua. It is used for 2000-11 to 2002-06 and for months with Aqua flagged.
4. **Possible MODIS orbital drift.** The leave-one-year-out bias tends to fall with the year, but not significantly (Spearman -0.35, p = 0.22). Training on 2020-2025 alone gives +2.5 % in the backcast, against -1.0 % with 2015-2019 (`validation_metrics.json` → `sensitivity`).
5. **Small fires in converted months.** MODIS misses small fires, and a cell where MODIS counts 0 gets 0. Area totals are unbiased in the backcast (+0.6 %), but cells with only small fires are under-estimated in converted months.
6. **Uncertainty is approximate.** After calibration, the 90 % intervals cover 85 % of monthly area totals and 85 % of cell-months in the backcast, still a little below 90 %.
7. **Months without data.** 10 months have no value because a needed satellite is flagged. In 2003-12 and 2008-12 Terra is flagged but Aqua is valid; an Aqua-only conversion is not implemented.
8. **Recent months are provisional, and the data stop on 2026-10-31.** August to October 2026 (VIIRS) and September to October 2026 (MODIS) are FIRMS near real-time data: FIRMS replaces them later with standard data, so their values can change, and static sources (`type` ≠ 0, 0.48 % of standard detections) cannot be removed from them (DE-4, DE-9). Later months need a new download (`pipeline/download.py --api-source`) and a new `DATA_END`.
9. **Hotspots are not fires.** A detection is the centre of a pixel with one or more fires; it is not a fire's position, size or burned area. Clouds, smoke and canopy can hide fires, and a month without detections is not proof of no fire (FIRMS FAQ; FIRMS_REFERENCE sections 5 and 7). FIRMS data must not be used for the preservation of life or property (FIRMS_REFERENCE section 10).
10. **Static sources are dropped.** `type` ≠ 0 detections are removed: 0.48 % of the detections inside the boundary, from 0.28 % (MODIS) to 0.64 % (S-NPP) (`method/results/cleaning_log.csv`).
11. **No confidence filter.** Low-confidence detections are 6.2 % (S-NPP) and 6.6 % (NOAA-20) of the VIIRS detections, and 6.6 % (Terra) and 4.3 % (Aqua) of the MODIS detections (C < 30 %). Removing them changes the backcast bias from +0.6 % to +1.2 % (VIIRS), +1.1 % (MODIS) or +1.7 % (both) (`validation_metrics.json` → `sensitivity.low_confidence`).
12. **Border detections.** 6,216 of the kept detections (0.30 %) come from FIRMS's Bolivia file but lie inside the IBGE boundary. FIRMS's country assignment and the IBGE boundary differ slightly at the border. They count as Rondônia (DE-1).
13. **The ratios are specific to this area.** They are fitted on Rondônia and must be refitted for any other area.
14. **NOAA-21 counts fewer hotspots than NOAA-20.** Over 21 months the total ratio NOAA-21/NOAA-20 is 0.956 (monthly median 0.958, interquartile range 0.82-1.02; `validation_metrics.json` → `continuity.noaa21`). NOAA-21 is only a check, so the series does not change. A correction factor must be decided before NOAA-21 replaces NOAA-20 as the reference.
