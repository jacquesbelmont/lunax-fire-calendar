# Decision log

Method choices are made by the team and recorded here **before** code. AI may implement and test decisions, not make them.
Status values: OPEN / PROPOSED / DECIDED.
PROPOSED rows become DECIDED when the team approves them in PR review. Options, trade-offs and sources for each row are in [Decision details](#decision-details).

| ID | Date/time (UTC-4) | Decision | Options considered | Chosen by | Justification | Evidence | Status |
|----|-------------------|----------|--------------------|-----------|---------------|----------|--------|
| DE-1 | 2026-11-14 17:10 | Demo area: **Rondônia, Brazil**, as given by the IBGE state boundary. Only detections inside the boundary are kept. Outside it is "outside the area", never zero fire. Processing box (`config/area.json`): the boundary's bbox aligned to 0.25° cells, W -67, S -13.75, E -59.75, N -7.75 | Whole North Region; one northern state (Rondônia) | Jacques (suggested), Rafael (agreed) | Rondônia is in the Amazon, has a lot of burning and is our region: 13,176 to 90,362 VIIRS hotspots a year inside the boundary in 2012-2025. A single region is acceptable (discussions/2016) | IBGE: https://servicodados.ibge.gov.br/api/v3/malhas/estados/11?formato=application/vnd.geo+json ; [details](#de-1-demo-area) | DECIDED |
| DE-1b | 2026-11-14 17:10 | Bolivia: **not added** (option A, Rondônia only). Detections of Bolivia's FIRMS country file count only where they fall inside the Rondônia boundary | A: Rondônia only; B: Rondônia + the Bolivian part of the box | Rafael, Jacques | A follows DE-1 literally and keeps the scope; it is the current implementation | [details](#de-1-demo-area) | DECIDED |
| DE-2 | 2026-11-14 15:44 | Target scale: **VIIRS-equivalent** (monthly counts of VIIRS 375 m hotspots per grid cell). Both sensors are used: MODIS-only months are converted to the VIIRS scale with a model learned where both sensors overlap | MODIS-equivalent; VIIRS-equivalent (both acceptable if justified, per challenge author) | Rafael (agreed with Jacques) | The challenge author asks for continuity with NOAA-20 and NOAA-21 (VIIRS); MODIS is retiring; MODIS and VIIRS overlap in FIRMS since 2012-01-20 | https://github.com/nasa/spaceapps/discussions/1879 ; [details](#de-2-target-scale) | DECIDED |
| DE-3 | 2026-11-14 15:44 | Calendar time step: monthly | Monthly (recommended by the challenge author); weekly only if easy to read | Team (AGENTS.md rule 5) | Recommended by the challenge author; already a project rule | https://github.com/nasa/spaceapps/discussions/1879 | DECIDED |
| DE-4 | 2026-11-14 15:44 | SP for each satellite up to its last SP date; NRT only after that date, flagged `provisional` | SP only; NRT only; SP then NRT | Rafael, Jacques | FIRMS advises standard data for scientific analysis; NRT is replaced by SP after about 2-5 months | method/FIRMS_REFERENCE.md section 6 ; [details](#de-4-sp-vs-nrt) | DECIDED |
| DE-5 | 2026-11-14 17:10 | Cleaning rules: normalize schema, clip to the processing box and then to the IBGE boundary of Rondônia (DE-1), period, `type` (DE-9), no confidence/day-night filter (DE-10), exact duplicates, SP/NRT split (DE-4), log of removed rows | See details | Rafael | Only rules traceable to DE-4, DE-9 and DE-10; every removal is counted | [details](#de-5-cleaning-rules) | DECIDED |
| DE-6 | 2026-11-14 16:37 | Harmonization method: **ratio per month of year** (option 2), selected by the DE-15 backcast. The negative binomial count regression (option 3, registered as main) failed validation. ML only as RA-6 challenger | Global ratio; ratio per month of year; quantile mapping; count regression; ML | Rafael (by the pre-registered DE-15 rule) | Backcast 2012-2014: bias of the total +0.6 % (ratio) vs +143 % (NB regression); the ratio is also the simplest | method/results/validation_metrics.json (PR #32) ; [details](#de-6-harmonization-method) | DECIDED |
| DE-7 | | App libraries: Leaflet 1.x (map), Leaflet.draw (rectangle selection), Plotly.js (calendar heatmap, charts, PNG download), vendored in docs/lib/ | | Jacques | | docs/lib/README.md ; implemented in PR #37 | DECIDED |
| DE-8 | 2026-11-14 17:10 | Data route: FIRMS **country yearly summary CSVs** (standard processing, no MAP_KEY) for the history 2000-2025; FIRMS **area API** (MAP_KEY) only for 2026 and NOAA-21 | Country yearly CSVs; area API; Archive Download (see method/FIRMS_REFERENCE.md sections 3.1-3.3) | Jacques, Rafael | The CSVs need no key and are complete standard years (2025 files: 365 days for MODIS and NOAA-20, checked 2026-11-14). 2026 and NOAA-21 are not in them, so only those use the API. Implemented in `pipeline/download.py` (JA-2); the area API route (`--api-source`) was added in RA-3 on 2026-11-15 and used for NOAA-21 (2024-01-17 to 2025-12-31) and for 2026 (all satellites, to 2026-10-31; standard processing, then NRT flagged provisional, DE-4) | method/FIRMS_REFERENCE.md ; https://firms.modaps.eosdis.nasa.gov/data/country/ | DECIDED |
| DE-9 | 2026-11-14 17:10 | `type`: keep only 0 (presumed vegetation fire) in SP data. NRT months (no `type`) are flagged `provisional`, with no mask | Type 0 only; all types; all types in the data with type 0 as the default app view (suggested by Jacques); type 0 plus a static-location mask for NRT | Rafael | **Impact under 0.5 % overall:** `type` ≠ 0 is 0.48 % of the detections inside the boundary, from 0.28 % (MODIS) to 0.64 % (S-NPP). Keeping all types would need a second harmonized series per type for this difference | method/results/cleaning_log.csv ; method/FIRMS_REFERENCE.md sections 5, 8 ; [details](#de-9-type-values) | DECIDED |
| DE-10 | 2026-11-14 15:44 | No confidence filter in v1 (keep the column; sensitivity test in RA-3). No day/night filter (keep the column) | Filter low confidence; no filter. Day only; night only; both | Rafael | MODIS (0-100) and VIIRS (l/n/h) confidence are not comparable; thresholds must be chosen empirically (FAQ); the NRT day/night flag differs from SP | method/FIRMS_REFERENCE.md section 5 ; [details](#de-10-confidence-and-daynight) | DECIDED |
| DE-11 | 2026-11-14 16:37 | Terra-only conversion for 2000-11 to 2002-06 (and months with Aqua flagged); Terra + Aqua conversion for 2002-07 to 2012-01; native VIIRS from 2012-02: S-NPP to 2018-03, NOAA-20 from 2018-04, NOAA-21 as check and backup | Sum all satellites; Aqua only; one model per MODIS configuration; Terra only | Rafael | No artificial step when a satellite is added; no double counting; keeps the Terra-only months | method/FIRMS_REFERENCE.md section 2 ; [details](#de-11-satellites-per-era) | DECIDED |
| DE-12 | 2026-11-14 15:44 | Grid: 0.25° cells aligned globally | 0.1°; 0.25°; 0.5° | Rafael, Jacques | Cells much larger than the MODIS pixel; fewer zero cells for the model; export size; with the ratio method area totals do not depend on the cell size (method/VALIDATION.md) | [details](#de-12-grid) | DECIDED |
| DE-13 | 2026-11-14 15:44 | Historical median = median of the same month in all previous years, excluding months flagged missing; anomaly = difference and ratio (ratio only if median > 0) | All previous years; all years except the current one; fixed baseline period | Rafael, Jacques | Literal reading of R7; same rules in Python and JS (JA-8) | [details](#de-13-historical-median-and-anomaly) | DECIDED |
| DE-14 | 2026-11-14 15:44 | Missing-data flag: a month is flagged for a satellite if at least one day is missing; store `missing_days`; no rescaling in v1 | ≥ 1 missing day; share-of-days threshold; flag and rescale; flag and fill with converted MODIS | Rafael | Simple and follows AGENTS.md rule 6: missing data never becomes zero fire | method/FIRMS_REFERENCE.md section 7 ; [details](#de-14-missing-data-flag) | DECIDED |
| DE-15 | 2026-11-14 15:44 | Validation protocol: backcast (train 2015-2025, test 2012-2014), leave-one-year-out, VIIRS continuity, sensitivity tests, selection rule fixed in advance | See details | Rafael | Tests the conversion in the direction it is used (backwards in time), with real VIIRS as reference | [details](#de-15-validation-protocol) | DECIDED |
| DE-16 | 2026-11-14 16:54 | Uncertainty calibration: one variance inflation factor lambda (= 11.5), fitted on leave-one-year-out area totals 2015-2025, tested on 2012-2014 | Model variance only; one factor lambda; correlated error term; no intervals | Rafael | Model variance covered only 41 % of area totals; with lambda, 85 % (area) and 85 % (cell) in the backcast; the app keeps summing variances | method/results/uncertainty_calibration.json (PR #32) ; [details](#de-16-uncertainty-calibration) | DECIDED |

---
| DE-17 | 2026-11-15 00:59 | Hotspot list for the CSV download (R9): one gzip file per FIRMS instrument and year in `docs/data/hotspots/<instrument>_<year>.csv.gz` (+ `index.json`), only the rows kept by the cleaning rules (SP, `type` 0, inside the Rondônia boundary), no confidence filter, with an attribution and cut-off header; the app reads only the years of the chosen period, keeps the selected cells, and shows the row count before the download | Monthly counts only (declare the limitation); per-year gzip files filtered in the browser; server-side filtering (not possible on GitHub Pages) | Jacques (proposed); approved by Rafael | R9 asks for a CSV of the hotspots found in the search; the files reuse the rows and `cell_id` of the pipeline, so they agree with `monthly_cells.csv` by construction and by test | 54 files (with NOAA-21 and 2026), 2,168,855 rows, 25,300,584 bytes (`docs/data/hotspots/index.json`); [details](#de-17-hotspot-list-for-the-csv-download) | DECIDED |
| DE-18 | 2026-11-15 09:42 | ML challenger (RA-6): gradient boosting with Poisson loss (DE-6 option 4), fixed hyperparameters, evaluated with the DE-15 protocol against the **production ratio method** on the same rows. It "beats" the ratio only if the Terra + Aqua model has backcast MdAPE of monthly area totals <= 11.3 % (2 percentage points below 13.3 %) **and** |relative bias of the total| <= 2 %. Challenger only: production is unchanged whatever the result; adoption would be a separate team decision | Challenger only; adopt if it wins. Margins: MdAPE -2 pp with |bias| <= 2 %; any MdAPE gain with |bias| <= 2 %; 10 % relative MdAPE gain | Rafael | Fixed before any ML result, as DE-15 requires. The comparator is the ratio method because the count regression (option 3) failed the backcast; this amends DE-6 ('beats 3') | [details](#de-18-ml-challenger) ; result: method/results/ml_metrics.json (the ML model does not beat the ratio) | DECIDED |

## Decision details

### DE-1 Demo area

- **Decision (DECIDED):** the area of interest is **Rondônia, Brazil**, as given by the IBGE state boundary: state code 11, https://servicodados.ibge.gov.br/api/v3/malhas/estados/11?formato=application/vnd.geo+json. Suggested by Jacques and agreed by Rafael on 2026-11-14.
- **Why Rondônia:** it is in the Amazon, it has a lot of burning, and it is our region, so the team knows its fire context. A single region is acceptable (discussions/2016).
- **Measured activity inside the boundary** (cleaned FIRMS country files, point in polygon, 2026-11-14), reference VIIRS hotspots per year:

  | Year | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Hotspots | 57,125 | 27,233 | 45,475 | 90,362 | 79,589 | 68,193 | 61,395 | 79,455 | 76,927 | 74,737 | 85,450 | 52,874 | 87,445 | 13,176 |

  S-NPP until 2017, NOAA-20 from 2018. MODIS (Terra + Aqua) reaches 71,460 in 2005. Source: `method/results/cleaning_log.csv` (`rows_kept` of viirs-snpp 2012-2017 and viirs-jpss1 2018-2025; PR #30).
- **Border detections:** 6,216 of the 2,043,625 kept detections (0.30 %) come from FIRMS's Bolivia file but lie inside the IBGE boundary. FIRMS's country assignment and the IBGE boundary differ slightly at the border. They are inside the boundary, so they count.
- **Options considered:**
  - Whole North Region: more cells to select and more data to train the conversion (DE-6), but much larger app files. Whole Brazil at 0.25° had 10,126 active cells in only three years of data (RA-2a test run, PR #29), about 3 million rows at 313 months (derived).
  - One state: small and fast. Chosen.
- **Processing box:**
  - `config/area.json` holds the boundary's bbox (W -66.8103, S -13.6937, E -59.7744, N -7.9759), aligned outwards to whole 0.25° cells (DE-12): **W -67, S -13.75, E -59.75, N -7.75**, i.e. 696 cells (derived). The box is only used to read and grid the data.
  - It also covers parts of neighbouring Brazilian states and of Bolivia. Only 42 % to 56 % of the detections in the box, depending on the satellite, fall inside Rondônia (same measurement).
- **Outside Rondônia is never zero fire:**
  - `clean.py` keeps only the detections inside the IBGE boundary (point in polygon). A cell that crosses the boundary counts only its detections inside Rondônia.
  - `export.py` writes the boundary to `docs/data/area.geojson`. The app draws it and marks everything outside as "outside the area".

**DE-1b, Bolivia (DECIDED 2026-11-15: option A):**
- **Option A, Rondônia only:** as above. This is Jacques's preference and the current implementation. Chosen.
- **Option B, Rondônia + the Bolivian part of the box:** Rafael's earlier wish for an international demo.
  - Also keep the detections of Bolivia's FIRMS country file that fall inside the box. The country comes from the file, so no other boundary data is needed. Other Brazilian states stay out.
  - Bolivia's raw files are about 0.7 GB for 2000-2025 (MODIS 147 MB, S-NPP 309 MB, NOAA-20 241 MB; FIRMS index, 2026-11-14).
- **Both options use the same method.** B is a configuration switch plus a rerun of the pipeline.

### DE-2 Target scale

**Decision:** VIIRS-equivalent. The harmonized series is expressed as monthly counts of VIIRS 375 m hotspots per grid cell. This is a count scale, not a 375 m map: a MODIS 1 km detection only gives the pixel centre (FIRMS FAQ), so its position cannot be refined to 375 m.

**Both sensors are used (the challenge asks to harmonize both, R2):**
- MODIS: source of the series from 2000-11 to 2012-01, converted to the VIIRS scale; half of the training and validation data in the overlap; per-sensor view in the app and hotspot CSV.
- VIIRS: defines the scale; source of the series from 2012-02 onwards (DE-11); the other half of the training and validation data; per-sensor view.
- Raw MODIS and VIIRS counts are never summed (AGENTS.md rule 6).

**Why — from the challenge:**
- "Either alternative is fine if properly justified." (challenge author, https://github.com/nasa/spaceapps/discussions/1879)
- "it makes sense to look for solutions that extend into the future—therefore, NOAA-20 and NOAA-21 satellites that are still active." (challenge author, same discussion). NOAA-20 and NOAA-21 carry VIIRS 375 m (FIRMS_REFERENCE section 2). On the VIIRS scale, future months need no conversion. On a MODIS scale every future month would have to be converted, with no MODIS left to check the conversion.
- The challenge video says MODIS is retiring and is being replaced by VIIRS, and that without a method to compare them "almost 10 years of historical information will be lost" (FIRMS_REFERENCE section 1). Converting the MODIS-only years to the VIIRS scale is our answer to this. That the quote refers to the MODIS-only years is our interpretation.

**Why — from FIRMS data (the challenge's only resource):**
- Overlap to learn the conversion: S-NPP from 2012-01-20 to 2026-11-02, NOAA-20 from 2018-04-01, NOAA-21 from 2024-01-17, with Terra and Aqua MODIS active throughout (FIRMS_REFERENCE section 2): almost 15 years (derived).
- Finer pixels: VIIRS 375 m vs MODIS 1 km (FIRMS_REFERENCE section 2).
- The current month, which the calendar compares with the historical median (R7), is an observation, not a model output.

**Supporting external sources:**
- NASA plans to end Terra MODIS data collection in January 2027 and Aqua MODIS around September 2027; both are "running low on fuel and experiencing orbital drift" (CAMS, 2026-02-25, https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system).
- VIIRS 375 m detects smaller fires than MODIS 1 km. Schroeder, Oliva, Giglio, Csiszar 2014, Remote Sensing of Environment 143:85-96, doi:10.1016/j.rse.2013.12.008 (full paper read 2026-11-15, https://directreadout.sci.gsfc.nasa.gov/publications_documents/Schroeder_et_al_2014b_RSE.pdf):
  - introduction: "Improved spatial resolution enables detection of smaller fires of the same temperature, as well as refined mapping of larger fires";
  - abstract: "VIIRS 375 m fire data showed significantly superior mapping capabilities compared to current MODIS fire detection data".

**Costs we accept, and mitigations:**
- 2000-11 to 2012-01 are estimates extrapolated backwards in time and cannot be checked against VIIRS directly. Mitigation: backcast test inside the overlap (DE-15); these months are flagged `estimated` and shown with uncertainty.
- MODIS misses small fires, so estimates are expected counts, not detections. Mitigation: a method that predicts VIIRS counts > 0 when MODIS = 0 (DE-6); stated in METHOD.md.
- The MODIS-VIIRS relation learned after 2012 may not hold before 2012 (changes in fire regime, orbital drift). Mitigation: choice of training window and a year-trend check (DE-15); stated as a limitation.
- The hotspot CSV (R9) lists the real MODIS detections for 2000-2011, labelled as MODIS. Only aggregated counts are harmonized.

### DE-4 SP vs NRT

- **Proposal:** SP for every satellite up to its last SP date (from `data_availability`, JA-2); NRT only after that date; NRT months flagged `provisional`.
- **Why:** FIRMS advises standard data for scientific analysis; NRT is replaced by SP "usually after 2-3 months, but possibly up to 5 months" (active_fire page; FIRMS_REFERENCE section 6).
- **Options:**
  - SP only: the series would stop months before the present, which conflicts with "to the present" (R2).
  - NRT only: positions are less accurate and there is no `type`.
  - SP then NRT: chosen.
- **Cost:** the most recent months are provisional and have no `type` (DE-9).

### DE-5 Cleaning rules

Order in `pipeline/clean.py`. Nothing else is filtered.

1. Normalize both routes (country CSV, API) to one schema:
   - `satellite` → Terra, Aqua, SNPP, NOAA20, NOAA21.
     - Observed in the country CSVs downloaded 2026-11-14: `Terra` and `Aqua` (modis_2013_Brazil.csv, modis_2025_Brazil.csv), `N` (viirs-snpp_2013_Brazil.csv), `N20` (viirs-jpss1_2025_Brazil.csv).
     - The FIRMS attribute page uses `T`/`A` for MODIS and `N`/`N20`/`N21` for VIIRS (https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs). Both forms are accepted.
     - FIRMS public NRT files (2026-11-15): `T`/`A` for MODIS, `N20`/`N21` for VIIRS (FIRMS_REFERENCE section 13, item 3). The area API (checked 2026-11-15) writes `Terra`/`Aqua` for MODIS in SP and NRT, and `N`/`N20`/`N21` for VIIRS.
   - `acq_time` read as text HHMM.
   - `processing` (SP/NRT) from the `version` suffix. Standard processing carries the collection only; NRT, RT and URT add a suffix (FIRMS attribute page).
     - Observed SP values: MODIS `6.2` (2000-2017), `6.03` (2018-2022) and `61.03` (2023-2025) in the Brazil and Bolivia files; VIIRS `2`.
     - Meaning, by the MCD14ML naming (collection, then product version, MODIS user guide section 5.5.1): `6.03` = Collection 6 version 03, `61.03` = Collection 6.1 version 03, `6.2` most likely Collection 6 version 2. This is our reading; FIRMS does not document the field this way (FIRMS_REFERENCE section 13, item 1).
   - `route` (country CSV or API).
2. Clip to the processing box with half-open intervals (west ≤ lon < east, south ≤ lat < north), so no detection is counted twice at an edge. Then keep only detections inside the IBGE boundary of Rondônia (point in polygon, DE-1).
3. Keep dates from 2000-11-01 to the data cut-off date.
4. `type` filter (DE-9).
5. No confidence or day/night filter (DE-10).
6. Drop exact duplicates (same satellite, latitude, longitude, date, time). A cheap guard for a bbox that spans several country files and for the join of 2025 CSV and 2026 API data.
7. Split SP and NRT by date (DE-4).
8. Write how many rows each rule removed to `method/results/` (numbers for METHOD.md).

### DE-6 Harmonization method

- **Unit:** grid cell × month.
- **Target:** count of the reference VIIRS satellite (DE-11).
- **Predictors:** Terra count, Aqua count (separately), month of year.
- **Data:** FIRMS only.

| Option | Pros | Cons |
|---|---|---|
| 0. Baseline without correction (raw MODIS to 2012-01, raw VIIRS after) | Shows the jump when VIIRS enters; required by RA-2 | Not harmonized; used for comparison only |
| 1. Global ratio | Trivial and transparent | Ignores season and place; predicts 0 when MODIS = 0 |
| 2. Ratio per month of year | Simple; captures seasonality | Same zero problem; unstable where a month has few data |
| 2b. Quantile mapping | Corrects the whole distribution, not only the mean | Ignores location; extrapolates poorly beyond the observed range |
| 3. Negative binomial count regression, log link: log E[VIIRS] = b0 + b1·log(Terra+1) + b2·log(Aqua+1) + month effect + b3·log(cell VIIRS climatology + c) | Predicts VIIRS > 0 when MODIS = 0; handles overdispersion; gives prediction intervals; interpretable coefficients | New dependency (statsmodels); model assumptions |
| 4. ML, e.g. gradient boosting with Poisson loss, with extra FIRMS features (FRP, night share, confidence mix) | Flexible, non-linear | Little training data per cell; may not generalize backwards in time; uncertainty harder; must be declared (S6) |

- **Proposal:**
  - Option 3, with the cell climatology predictor, is the main method.
  - Option 2 is the fallback if 3 is not ready for M2 (both recorded here).
  - Option 2b is used only as a comparison if 3 fails validation.
  - Option 4 only in RA-6, as a challenger of the production ratio method, with the margin fixed in DE-18 before any result.
- **Cell climatology (added 2026-11-14):**
  - The count regression predicts a value above 0 wherever MODIS counts 0. Without more information, cells that never burn would get the same small value as fire-prone cells.
  - Predictor added: log of the cell's mean monthly VIIRS count plus a small offset c, computed **only from training years**, so nothing leaks from the test years (DE-15). FIRMS data only.
  - Export consequence: rows = active cells (at least one detection by any satellite in any month) × months; other cells are 0 in every month.
- **App:** expected counts add up across cells, so the app can sum the cells of a selected area (R4). Variances are exported per cell-month and summed assuming independence. This understates uncertainty and is stated as a limitation. Format in DATA_CONTRACT.md (JA-3).
- **Outcome of the DE-15 backcast (2026-11-14, real Rondônia data; method/results/validation_metrics.json, PR #32):**

  | Method | Bias of the total | MdAPE monthly |
  |---|---|---|
  | Option 2, ratio per month of year | +0.6 % | 13.3 % |
  | Option 3, negative binomial regression | +143 % | 42.8 % |

  - Option 3 is biased even on its own training years (predicted/observed total 2.87). The NB2 likelihood gives little weight to large counts, and most fire is in large counts.
  - By the DE-15 rule, **option 2 is the production method** (`pipeline/harmonize.py`): it is both the best and the simplest.
  - The cell climatology is therefore not used, and the export still lists active cells only.
  - A Poisson version of option 3 was tried only after seeing the results, as a diagnostic: bias +4.7 %, MdAPE 32.6 %. It is not used for selection.
  - **Uncertainty for option 2:** variance mu + alpha·mu², with alpha by the method of moments. It under-covers in validation (method/VALIDATION.md); it is calibrated with one factor lambda (DE-16).

### DE-9 `type` values

- **Proposal:**
  - SP: keep only `type` 0 (presumed vegetation fire); drop 1 (active volcano), 2 (other static land source) and 3 (offshore).
  - NRT (no `type`): first measure the share of `type` ≠ 0 per satellite and year in the demo area (SP). If it is small, flag NRT months `provisional` without a mask. If not, mask locations flagged as static in SP (threshold to be decided then).
- **Options:**
  - Type 0 only: measures burning, not industry; creates a step at the SP-to-NRT boundary.
  - All types: uniform; static sources inflate counts and each sensor sees them differently.
  - Type 0 plus a mask for NRT: consistent over time; more method.
- **Sources:** FIRMS attributes page and FAQ (FIRMS_REFERENCE sections 5, 8).
- **Measured** on whole-Brazil country CSVs downloaded 2026-11-14. Share of rows with `type` ≠ 0:
  - MODIS 2013: 0.61%
  - VIIRS S-NPP 2013: 1.72%
  - MODIS 2025: 2.01%
  - VIIRS NOAA-20 2025: 1.88%
  
  VIIRS files use the same values as MODIS (0, 2, 3).
- **Measured inside the area** (IBGE boundary of Rondônia, 2000-2025; method/results/cleaning_log.csv, PR #30). Share of rows with `type` ≠ 0:
  - MODIS: 0.28 %
  - VIIRS NOAA-20: 0.44 %
  - VIIRS S-NPP: 0.64 %
  - all: 0.48 % (9,794 rows)
  
  The share is small, so NRT months are only flagged `provisional`, with no static-location mask.
- **Considered on review** (Jacques): keep all types in the data and make type 0 the default app view, since "burning activity" is not limited to vegetation fire.
  - Not chosen: every number would then need a second harmonized series (one k per type), and a second set of export columns, for a difference under 0.5 %.
  - The impact of dropping `type` ≠ 0 is stated here and in method/METHOD.md.
- VIIRS uses the MODIS `type` codes: "0 = presumed vegetation fire, 1 = active volcano, 2 = other static land source, 3 = offshore detection (includes all detections over water)" (VIIRS C2 375 m User Guide 1.2, section 3.2.2; FIRMS_REFERENCE section 13, item 2).
- MODIS `type` before 2018 may come from an older product version with less refined typing (FIRMS_REFERENCE section 13, item 1). `type` ≠ 0 is at most 1.36 % of the MODIS detections inside the area in any year (`method/results/cleaning_log.csv`).

### DE-10 Confidence and day/night

- **Confidence: no filter in v1.**
  - Keep the original value and a normalized class; sensitivity test with and without the low class in RA-3 (DE-15).
  - Why: MODIS (0-100) and VIIRS (l/n/h) confidence are not comparable, so any filter would differ by sensor. The FAQ says the meaning may vary by region and thresholds must be chosen empirically (FIRMS_REFERENCE section 5).
  - Cost: more false alarms are kept.
  - MODIS class cut-offs: low 0 % ≤ C < 30 %, nominal 30 % ≤ C < 80 %, high 80 % ≤ C ≤ 100 % (MODIS C6/C6.1 Active Fire Product User's Guide 1.0, Table 11). Not used in v1 (no filter).
  - **Low-confidence night pixels (VIIRS):** the FIRMS attribute page says they "occur only over the geographic area extending from 11deg E to 110 deg W and 7 deg N to 55 deg S" (South Atlantic Magnetic Anomaly), may be false alarms, and "have been removed from the NRT data distributed by FIRMS". Brazil is inside that area.
    - Measured: 0 such rows in the SP files viirs-snpp_2013_Brazil.csv and viirs-jpss1_2025_Brazil.csv.
    - So SP and NRT are consistent and no extra rule is needed.
- **Day/night: no filter.**
  - Keep `daynight` as an attribute (a possible ML feature).
  - Why: the NRT day/night flag is based on the orbit and differs from the SP method (FAQ; FIRMS_REFERENCE section 5).
  - Cost: no separate day/night analysis.

### DE-11 Satellites per era

| Period | Source of the harmonized series |
|---|---|
| 2000-11 to 2002-06 (20 months, derived) | Terra, converted with a Terra-only ratio |
| 2002-07 to 2012-01 | Terra + Aqua (both MODIS), converted with a Terra + Aqua ratio. If Aqua is flagged in a month, the Terra-only ratio is used |
| 2012-02 to 2018-03 | S-NPP (native VIIRS) |
| 2018-04 onwards | NOAA-20 (native VIIRS); NOAA-21 as a check (raw counts in the app; the backup is not implemented: the only NOAA-20 flagged month since 2024, 2024-02, is flagged for NOAA-21 too) |

- **How:**
  - Both models are trained in the overlap, where Terra and Aqua still operate. Each model is used only for the satellite configuration it was trained on.
  - January 2012 is treated as a MODIS month because S-NPP starts on 2012-01-20.
- **One VIIRS satellite per month** avoids double counting: NOAA-20 and NOAA-21 fly about 50 minutes apart in the same orbital plane as S-NPP (FIRMS blog; FIRMS_REFERENCE section 2). Whether S-NPP, NOAA-20 and NOAA-21 share one scale is tested in RA-3 (DE-15); if not, a correction factor is added.
- **Options:**
  - Sum all satellites: artificial steps at 2002-07, 2012-01, 2018-04 and 2024-01; double counting.
  - Aqua only: same afternoon time as VIIRS, but loses the 20 Terra-only months.
  - One model per configuration: chosen. Uses all MODIS data and creates no step at 2002-07, at the cost of two models.
  - Terra only: constant, but its morning overpass differs from VIIRS and it ends in January 2027.
- A Space Apps navigator (not official) wrote in discussions/1879: "Different platforms have different overpass times, and ignoring that could create artificial trends."
- `satellite` values: `Terra`/`Aqua` in the country files, `T`/`A` in the NRT files; NOAA-21 is `N21` (FIRMS_REFERENCE section 13, items 3 and 5).

### DE-12 Grid

- **Proposal:** 0.25° cells aligned globally; row = floor((lat + 90) / 0.25), column = floor((lon + 180) / 0.25), half-open. Used by the pipeline and the app.
- **Criteria:**
  - MODIS position uncertainty: 1 km nominal pixel, larger toward the scan edge (`scan`/`track` columns), so cells must be much larger than a pixel.
  - Smaller cells mean more zeros and a noisier conversion.
  - Export size ≈ active cells × 313 months (derived). The DE-6 cell climatology makes MODIS-era months dense for active cells, so area (DE-1) and cell size both matter.
  - Smaller cells give finer area selection (R4).
- **Check before deciding:** sparse export size, share of zero cell-months, and backcast error at 0.1°, 0.25° and 0.5° (RA-3).
  - **Result:** not needed with the ratio method (DE-6): it is fitted on area sums, so every area total is the same for any cell size (method/VALIDATION.md).

### DE-13 Historical median and anomaly

With Jacques; used by JA-6 and JA-8.

- **Median for month m of year Y:** median of the harmonized counts of month m in all years before Y, excluding months flagged missing (DE-14).
  - `estimated` months are included and marked.
  - Shown when at least one previous year is available (N = 1, as implemented in `docs/js/calc.js`); the number of years used is shown next to it.
- **Options:**
  - All previous years: the literal "historical" of R7, with few values in the early years. Chosen.
  - All years except Y: uses the future.
  - Fixed baseline period: stable, but a less literal reading of R7.
- **Anomaly:** difference (count − median) and ratio (count / median), the ratio only when the median > 0. The median is used rather than the mean because it is less sensitive to extreme fire years. O3 mentions averages, so this choice is stated.
- **Rules shared by Python and JS:**
  - with an even number of years, the median is the mean of the two middle values (pandas default);
  - no rounding in the data, only on display;
  - a cell belongs to a selected area if its centre is inside the rectangle.

### DE-14 Missing-data flag

- **Proposal:**
  - A month is flagged for a satellite if at least one day of that satellite is missing (partial days count as missing); store `missing_days`. No rescaling in v1.
  - Flags are per satellite and month for the whole area, because FIRMS lists gaps per satellite.
  - Relevant satellites: in native VIIRS months, the reference VIIRS satellite; in converted months, Terra and Aqua.
  - Flagged months are never shown as zero and are excluded from the median (DE-13). A missing cell row in an unflagged month means zero detections.
- **Sources of missing days:** FIRMS `missing_data` (FIRMS_REFERENCE section 7). The MODIS gaps from the archive README (2007, 2009) do not show as whole missing days in the daily counts of the Brazil files, so no month is flagged for them (FIRMS_REFERENCE section 13, item 8).
- **Options:**
  - ≥ 1 missing day: simple and follows AGENTS.md rule 6, but a 1-day gap flags a whole month. Chosen.
  - Threshold on the share of missing days: fewer flags, one more parameter.
  - Flag and rescale: this is imputation.
  - Flag and fill with converted MODIS: uses both sensors after 2012, but mixes observed and estimated values. After v1.

### DE-15 Validation protocol

Fixed before any test result is seen.

- **Backcast (mimics real use):** train on 2015-2025 (SP), test on 2012-2014.
- **Leave-one-year-out over 2012-2025:** checks stability and chooses between methods 2 and 3 (DE-6).
- **Metrics,** at demo-area, test-area and cell level:
  - relative bias of totals;
  - median absolute percentage error of monthly counts;
  - correlation of the monthly series;
  - coverage of the 90 % prediction interval.
- **Jump check:** before/after figure at 2012 (baseline vs harmonized); in the overlap years, ratio of converted MODIS to observed VIIRS.
- **VIIRS continuity:** monthly S-NPP/NOAA-20 ratio from 2018-04 to 2025; NOAA-20/NOAA-21 from 2024-01. Tolerance ±X % (X to be fixed by the team); outside it, a correction factor is added.
- **Sensitivity:** confidence filter (DE-10), grid size (DE-12), training window (orbital drift).
- **Selection:** the simplest method within a margin of the best backcast score wins. ML must beat the count regression by a margin fixed in advance (to be fixed by the team).
- **Values fixed (2026-11-15):** training 2015-2025 and test 2012-2014 as above; tolerance X not needed while NOAA-21 is only a check (NOAA-20/S-NPP is within 1 %, and NOAA-21 is not used for `viirs_eq`; results below); ML margin fixed in DE-18 (RA-6, registered before any ML result); minimum years N = 1 (DE-13).
- **Results (2026-11-14):** see method/VALIDATION.md and method/results/ (PR #32).
  - **Backcast:** the ratio per month of year was selected (DE-6).
  - **Leave-one-year-out (ratio):** yearly bias -9.7 % to +7.9 %.
  - **VIIRS continuity:** NOAA-20/S-NPP over 83 months: total ratio 0.992, monthly median 1.001 (interquartile range 0.95-1.05). The total and the median are within 1 % of 1, so no correction factor is needed for any tolerance X ≥ 1 %.
  - **Sensitivity** (PR #32):
    - **Training window:** trained on 2015-2019 the backcast bias is -1.0 %; on 2020-2025 it is +2.5 %. The leave-one-year-out bias tends to fall with the year, but not significantly (Spearman -0.35, p = 0.22); a possible sign of MODIS orbital drift.
    - **Decided (2026-11-15):** keep 2015-2025, the window fixed before the results. Moving it now would be a choice made after seeing the test results.
    - **Low-confidence detections:** no material effect. Backcast bias +0.6 % → +1.2 % without VIIRS low, +1.1 % without MODIS low (C < 30 %), +1.7 % without both (`validation_metrics.json` → `sensitivity.low_confidence`).
    - **Grid size:** area totals do not depend on it.
  - **NOAA-21 continuity (2026-11-15, FIRMS area API, standard processing):** NOAA-21/NOAA-20 over the 21 months where both are valid (2024-04 to 2025-12): total ratio 0.956, monthly median 0.958 (interquartile range 0.82-1.02) (`validation_metrics.json` → `continuity.noaa21`, `method/results/continuity_noaa21.csv`). NOAA-21 counts about 4.4 % fewer hotspots than NOAA-20 here. It is not used for `viirs_eq` (DE-11), so nothing changes in the series. If NOAA-21 ever replaces NOAA-20 as the reference, a correction factor (or the tolerance X) has to be decided first.

### DE-16 Uncertainty calibration

- **Problem:** the model variance mu + alpha·mu² was too narrow. In the backcast its 90 % intervals covered 41 % of monthly area totals and 76 % of cell-months, because fire is spatially clustered and the ratio varies from year to year.
- **Proposal:** one variance inflation factor lambda, applied to every converted cell-month.
  - lambda is chosen so that 90 % of the monthly area totals of the leave-one-year-out years 2015-2025 fall inside ±1.645·sqrt(lambda × summed variance).
  - It is tested on the backcast years 2012-2014, which are not used to fit it.
- **Result** (`method/results/uncertainty_calibration.json`, `method/results/validation_metrics.json`, PR #32): lambda = 11.5. Backcast coverage rises to 85 % for area totals and 85 % for cell-months, close to but still below 90 %.
- **Options considered:**
  - Keep the model variance: too narrow.
  - One factor lambda: simple, and the app keeps summing variances. Chosen.
  - A separate correlated error term per month: closer to how errors behave, but the app would need a different formula (DATA_CONTRACT change).
  - Do not show intervals at all.
- **Implementation:** `pipeline/export.py` writes `viirs_eq_var` = model variance × lambda. For an area, the app uses sum ± 1.645·sqrt(summed variance) (DATA_CONTRACT.md).

### DE-17 Hotspot list for the CSV download
- **Problem:** the challenge asks for a downloadable CSV of the hotspots detected in a search (R9). The app has only monthly counts per cell.
- **Proposal:**
  - `pipeline/export_hotspots.py` writes `docs/data/hotspots/<instrument>_<year>.csv.gz` from `data/interim/clean/`, plus `index.json` (source, year, rows, bytes). Instruments are the FIRMS country-file names: `modis`, `viirs-snpp`, `viirs-jpss1`, plus `viirs-jpss2` for NOAA-21 (area API, 2024-2025).
  - Rows: `cell_id, latitude, longitude, acq_date, acq_time, sat, sensor, confidence, daynight, frp, type, version`. They are the rows kept by `clean.py` (DE-4, DE-5, DE-9, DE-10): standard data, `type` 0, inside the boundary, no confidence filter. The `cell_id` is the one of `aggregate.py`.
  - Each file starts with comment lines: FIRMS acknowledgment, disclaimer link and data cut-off date.
  - In the app, a button counts the rows of the selected cells and period (it reads only the yearly files of the period), shows the number, and then enables the download. The downloaded CSV carries the same header plus the area and period. Above 1,000,000 matching rows the app asks for a smaller area or period, to protect browser memory.
- **Options considered:**
  - Monthly counts only, and say so in the app and the slides: no extra files, but R9 stays unmet.
  - Per-year gzip files filtered in the browser (proposed): works on GitHub Pages without a server; size is the cost.
  - Filter on a server: not available with GitHub Pages and a server would need maintenance.
- **Size:** measured on real files: 11.8 bytes per row (NOAA-20 2025, 13,176 rows) and 13.4 bytes per row (MODIS 2013, 7,015 rows). With the `rows_kept` of `cleaning_log.csv` (MODIS 616,190; S-NPP 895,976; NOAA-20 531,459; total 2,043,625) the estimate was about 25 MB for the 48 files. Real total after the full run: 48 files, 2,043,625 rows, 23,890,631 bytes; with NOAA-21 and 2026 (2026-11-15): 54 files, 2,168,855 rows, 25,300,584 bytes (`docs/data/hotspots/index.json`). GitHub limits: a published Pages site "may be no larger than 1 GB", source repositories have "a recommended limit of 1 GB" (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), and files larger than 100 MiB are blocked (https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github). The largest hotspot file is about 1 MB.
- **Checks (tests):** `tests/test_export_hotspots.py` and `tests/js/hotspots.test.js` verify that
  - the count per cell, month and satellite equals the raw columns of `monthly_cells.csv` wherever that file has data;
  - the rows per instrument and year equal `rows_kept` of `cleaning_log.csv`;
  - every instrument-year of the log has a file (this test fails until the full set is generated);
  - every file has the attribution header.
  Months flagged as missing have hotspot rows but an empty raw column in `monthly_cells.csv`; they are not compared.
- **Limits:** only the cleaned rows are exported, so the file is not the full FIRMS list (no `type` other than 0 in standard rows, nothing outside the boundary). The list is the same archived data as the rest of the app (cut-off 2026-10-31); NRT rows (version ending in NRT, August to October 2026) are provisional and have no `type`.

### DE-18 ML challenger

Registered on 2026-11-15 at 09:42 (UTC-4), before `pipeline/ml.py` existed or ran.
- **Model:** `sklearn.ensemble.HistGradientBoostingRegressor(loss="poisson", learning_rate=0.05, max_iter=300, max_leaf_nodes=15, min_samples_leaf=50, l2_regularization=1.0, random_state=0, early_stopping=False)`, scikit-learn 1.9.1. Month of year is a categorical feature. The hyperparameters are fixed here and are not tuned on any test year.
- **Unit and target:** cell × month; the count of the reference VIIRS satellite (`ref`, DE-11), as for the ratio method.
- **Features** (DE-6 option 4, no location):
  - **Terra + Aqua model:** month, Terra count, Aqua count, Terra FRP sum, Aqua FRP sum, night share and low-confidence share (C < 30 %, MODIS user guide Table 11) of the MODIS detections of the cell-month.
  - **Terra-only model:** month and the Terra features. It is the model that would be used for 2000-11 to 2002-06 and for months with Aqua flagged (DE-11).
  - Shares are empty when the cell-month has no MODIS detection.
- **Protocol (DE-15):**
  - backcast: fit on 2015-2025, test on 2012-2014, on the same cell-months as the ratio method;
  - leave-one-year-out over 2012-2025, reported only.
- **Rule:** the ML model beats the ratio method only if the Terra + Aqua model has a backcast MdAPE of monthly area totals ≤ 11.3 % and |relative bias of the total| ≤ 2 %. `pipeline/ml.py` computes the verdict and writes it to `method/results/ml_metrics.json`.
- **Use:** challenger only. Production stays the ratio per month of year (DE-6). If the ML model wins, adopting it needs a separate team decision and an uncertainty method (as DE-16 did for the ratio).
- **Options considered:**
  - Adoption: challenger only (chosen) or adopt if it wins.
  - Margin: MdAPE 2 pp lower with |bias| ≤ 2 % (chosen), any MdAPE gain with |bias| ≤ 2 %, or a 10 % relative MdAPE gain.
- **Result (2026-11-15, `method/results/ml_metrics.json`, `ml_loyo.csv`):** the ML model **does not beat** the ratio method, so production is unchanged.
  - Backcast, Terra + Aqua, same 12,784 cell-months: ML bias of the total +3.3 %, MdAPE 17.5 %; ratio +0.6 %, 13.3 %. Both margin conditions fail.
  - Terra only: ML +2.0 %, MdAPE 33.5 %; ratio -8.5 %, 27.3 %. ML has the smaller bias but the larger monthly error.
  - Leave-one-year-out 2012-2025 (Terra + Aqua): median MdAPE 13.5 % (ML) vs 11.7 % (ratio); ML yearly bias from -9.7 % to +15.2 %.
  - The result is reproducible (`random_state=0`; two runs gave identical files).
