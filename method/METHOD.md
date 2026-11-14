# Method and limitations

Owner issue: RA-5 (Rafael). Input for Tiara (TI-5, TI-6).
Only decided method steps (see DECISIONS.md) go here; every number has a source file path.
Status: DE-1, DE-2 and DE-3 are DECIDED. The other decisions cited here are PROPOSED in PR #27 and become DECIDED when the team approves it.

## Method

### 1. Data

- **Source:** NASA FIRMS (https://www.earthdata.nasa.gov/data/tools/firms), the only data resource of the challenge.
- **Product:** FIRMS country yearly summary CSVs, standard processing (https://firms.modaps.eosdis.nasa.gov/data/country/), for **Brazil and Bolivia**.
- **Satellites:**
  - MODIS 1 km on Terra (from 2000-11) and Aqua (from 2002-07);
  - VIIRS 375 m on S-NPP (from 2012-01-20) and NOAA-20 (from 2018-04-01).
  - Source: method/FIRMS_REFERENCE.md section 2.
- **Versions seen** in the files (`docs/data/metadata.json`): MODIS `6.03`, `6.2` and `61.03`; VIIRS `2`. The meaning of the MODIS version strings is TODO(verify) - FIRMS.
- **Period:** 2000-11 to 2025-12. Data cut-off 2025-12-31; archived data, not live (`docs/data/metadata.json`).
- **Area (DE-1):** Rondônia, Brazil. The IBGE state boundary was aligned outwards to 0.25° cells: west -67, south -13.75, east -59.75, north -7.75 (`config/area.json`). The box also covers land in Bolivia, hence Bolivia's files (DE-1b). TODO(verify): that no third country's land is inside the box - official boundaries.
- **Download:** 96 files (48 instrument-years × 2 countries), each with its size checked against the FIRMS index (https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt). 91 are listed in `data/raw/download_manifest.csv` (local); the first 5 were downloaded earlier with the same check. 2026 and NOAA-21 are not in these files; they need the FIRMS API (DE-8).

### 2. Cleaning (`pipeline/clean.py`; DE-4, DE-5, DE-9, DE-10)

**Rules, in order:**
1. Normalize the schema.
2. Keep detections inside the box (half-open intervals).
3. Keep dates from 2000-11-01.
4. Keep only `type` 0 (presumed vegetation fire).
5. No confidence or day/night filter.
6. Drop exact duplicates.
7. Use standard data before NRT data.

**Result** (`method/results/cleaning_log.csv`): 48,648,899 rows read from the two countries' files; 44,276,831 fell outside the box, 15,390 had `type` ≠ 0, and 0 were duplicates. **4,356,678 detections were kept.**

### 3. Aggregation (`pipeline/aggregate.py`; DE-12, DE-14)

- **Grid:** detections are counted per 0.25° cell, month and satellite. Satellites are never summed at this step.
- **Missing data:** a satellite-month is flagged when at least one day is missing. Missing days are the FIRMS `missing_data` list plus the days outside the satellite's operating window. 24 of 845 satellite-months are flagged (`docs/data/months.csv`).
- **Flagged months have no value, never zero** (AGENTS.md rule 6).

### 4. Harmonization (`pipeline/harmonize.py`; DE-2, DE-6, DE-11)

- **Target scale:** monthly count of VIIRS 375 m hotspots per cell.
- **Native months (2012-02 onwards):** the value is the observed count of one reference VIIRS satellite: S-NPP until 2018-03, NOAA-20 from 2018-04. One satellite per month avoids double counting.
- **MODIS-only months** (2000-11 to 2012-01; January 2012 because S-NPP starts on 2012-01-20) are converted with a **ratio per month of year**: `VIIRS_eq = k(month) × MODIS`.
  - k = sum(reference VIIRS) / sum(MODIS) over 2015-2025, the years where both sensors observe.
  - MODIS is Terra + Aqua when both are valid. It is Terra alone before Aqua (2000-11 to 2002-06) and in months with Aqua flagged.
  - Fitted k (`method/results/harmonize_model.json`): Terra + Aqua from 2.64 (March) to 3.93 (November); Terra alone from 8.41 (April) to 12.60 (June).
- **Both sensors are used:** MODIS gives the 2000-2012 series and half of the calibration data. VIIRS gives the scale, the series from 2012 and the other half.
- **Result:** 695 active cells × 302 months. 129 months are converted from MODIS and 10 months have no data (`docs/data/monthly_cells.csv`).

### 5. Uncertainty (DE-16)

- **Variance** per converted cell-month: (mu + alpha·mu²) × lambda.
  - alpha by the method of moments: 0.045 for Terra + Aqua and 0.091 for Terra alone (`method/results/harmonize_model.json`).
  - lambda = 12.3, calibrated on held-out years (`method/results/uncertainty_calibration.json`).
- **For an area:** 90 % interval = sum ± 1.645·sqrt(summed variance).

### 6. Validation (`pipeline/validate.py`; DE-15)

Summary of `method/VALIDATION.md`; all numbers from `method/results/validation_metrics.json`:

- **Backcast** (fit on 2015-2025, predict 2012-2014 from MODIS, compare with real VIIRS): bias of the total +2.0 %; median absolute error of monthly totals 9.2 %; r = 0.9985.
- **Leave-one-year-out 2012-2025:** yearly bias from -9.4 % to +7.2 % (`method/results/loyo.csv`).
- **Without harmonization** the series would jump by a factor of 3.63 when VIIRS enters (2012-2014 raw VIIRS/MODIS).
- **VIIRS continuity:** NOAA-20/S-NPP = 0.991 over 83 months.
- **Method choice:** the negative binomial regression first proposed in DE-6 failed this pre-registered test (bias +133 %), so the ratio method was selected by the DE-15 rule.

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
2. **Extrapolation in fire activity.** 2004-2007 and 2010 had more MODIS detections than any overlap year: up to 108,555 a year, against at most 65,045 (`method/results/validation_metrics.json` → `ratio_stability`). The ratio is stable across the overlap years (3.47 to 4.03, not related to fire activity), but these years are outside that range.
3. **Possible MODIS orbital drift.** The leave-one-year-out bias tends to fall with the year (Spearman -0.46, p = 0.10). Training on 2020-2025 alone gives +4.9 % in the backcast, against -1.5 % with 2015-2019 (`validation_metrics.json` → `sensitivity`).
4. **Small fires in converted months.** MODIS misses small fires, and a cell where MODIS counts 0 gets 0. Area totals are unbiased in the backcast (+2.0 %), but cells with only small fires are under-estimated in converted months.
5. **Uncertainty is approximate.** After calibration, the 90 % intervals cover 85 % of monthly area totals and 86 % of cell-months in the backcast, still a little below 90 %.
6. **Months without data.** 10 months have no value because a needed satellite is flagged. In 2003-12 and 2008-12 Terra is flagged but Aqua is valid; an Aqua-only conversion is not implemented.
7. **Data end on 2025-12-31.** 2026 and NOAA-21 need the FIRMS API (DE-8).
8. **Hotspots are not fires.** A detection is the centre of a pixel with one or more fires; it is not a fire's position, size or burned area. Clouds, smoke and canopy can hide fires, and a month without detections is not proof of no fire (FIRMS FAQ; FIRMS_REFERENCE sections 5 and 7). FIRMS data must not be used for the preservation of life or property (FIRMS_REFERENCE section 10).
9. **No confidence filter.** Low-confidence detections are 6.3 % (S-NPP) and 6.7 % (NOAA-20) of the VIIRS detections. Removing them changes the backcast bias from +2.0 % to +2.5 % (`validation_metrics.json` → `sensitivity`).
10. **The ratios are specific to this area.** They are fitted on Rondônia and must be refitted for any other area.
