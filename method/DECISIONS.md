# Decision log

Method choices are made by the team and recorded here **before** code. AI may implement and test decisions, not make them.
Status values: OPEN / PROPOSED / DECIDED.
PROPOSED rows become DECIDED when the team approves them in PR review. Options, trade-offs and sources for each row are in [Decision details](#decision-details).

| ID | Date/time (UTC-4) | Decision | Options considered | Chosen by | Justification | Evidence | Status |
|----|-------------------|----------|--------------------|-----------|---------------|----------|--------|
| DE-1 | 2026-11-14 15:44 | Demo area: northern Brazil (Amazon). Recommended extent: one state, Rondônia (app data size, see details). Bbox and border handling still open | Whole North Region; one northern state (e.g. Rondônia) | Rafael, Jacques (region); extent to be confirmed by the team | A single region is acceptable (discussions/2016); the team knows the fire context of the Amazon; a smaller area keeps the app data small | [details](#de-1-demo-area) | PROPOSED |
| DE-2 | 2026-11-14 15:44 | Target scale: **VIIRS-equivalent** (monthly counts of VIIRS 375 m hotspots per grid cell). Both sensors are used: MODIS-only months are converted to the VIIRS scale with a model learned where both sensors overlap | MODIS-equivalent; VIIRS-equivalent (both acceptable if justified, per challenge author) | Rafael (agreed with Jacques) | The challenge author asks for continuity with NOAA-20 and NOAA-21 (VIIRS); MODIS is retiring; MODIS and VIIRS overlap in FIRMS since 2012-01-20 | https://github.com/nasa/spaceapps/discussions/1879 ; [details](#de-2-target-scale) | DECIDED |
| DE-3 | 2026-11-14 15:44 | Calendar time step: monthly | Monthly (recommended by the challenge author); weekly only if easy to read | Team (AGENTS.md rule 5) | Recommended by the challenge author; already a project rule | https://github.com/nasa/spaceapps/discussions/1879 | DECIDED |
| DE-4 | 2026-11-14 15:44 | SP for each satellite up to its last SP date; NRT only after that date, flagged `provisional` | SP only; NRT only; SP then NRT | Rafael (to confirm with Jacques) | FIRMS advises standard data for scientific analysis; NRT is replaced by SP after about 2-5 months | method/FIRMS_REFERENCE.md section 6 ; [details](#de-4-sp-vs-nrt) | PROPOSED |
| DE-5 | 2026-11-14 15:44 | Cleaning rules: normalize schema, clip to bbox, period, `type` (DE-9), no confidence/day-night filter (DE-10), exact duplicates, SP/NRT split (DE-4), log of removed rows | See details | Rafael | Only rules traceable to DE-4, DE-9 and DE-10; every removal is counted | [details](#de-5-cleaning-rules) | PROPOSED |
| DE-6 | 2026-11-14 15:44 | Harmonization method: negative binomial count regression with a per-cell VIIRS climatology predictor computed on training years only (main); ratio per month of year (fallback for M2); ML only as RA-6 challenger | Global ratio; ratio per month of year; quantile mapping; count regression; ML | Rafael | Predicts VIIRS-scale counts even when MODIS = 0 and gives uncertainty; the climatology puts estimates where fires occur; the simplest method that passes validation (DE-15) wins | [details](#de-6-harmonization-method) | PROPOSED |
| DE-7 | | App libraries: Leaflet 1.x (map), Leaflet.draw (rectangle selection), Plotly.js (calendar heatmap, charts, PNG download), vendored in docs/lib/ | | Jacques | | docs/lib/README.md | PROPOSED |
| DE-8 | | Data route for history: country yearly summary CSVs (SP, no MAP_KEY, 2000-2025, no NOAA-21, no 2026) vs area API (needs MAP_KEY) vs Archive Download; and for 2026 / NOAA-21 | See method/FIRMS_REFERENCE.md sections 3.1-3.3 | | | method/FIRMS_REFERENCE.md | OPEN |
| DE-9 | 2026-11-14 15:44 | `type`: keep only 0 (presumed vegetation fire) in SP data. NRT (no `type`): measure the share of `type` ≠ 0 in SP first, then flag NRT months `provisional` or mask static locations | Type 0 only; all types; type 0 plus a static-location mask for NRT | Rafael | Excludes volcanoes, static land sources and offshore detections; NRT data carry no `type` | method/FIRMS_REFERENCE.md sections 5, 8 ; [details](#de-9-type-values) | PROPOSED |
| DE-10 | 2026-11-14 15:44 | No confidence filter in v1 (keep the column; sensitivity test in RA-3). No day/night filter (keep the column) | Filter low confidence; no filter. Day only; night only; both | Rafael | MODIS (0-100) and VIIRS (l/n/h) confidence are not comparable; thresholds must be chosen empirically (FAQ); the NRT day/night flag differs from SP | method/FIRMS_REFERENCE.md section 5 ; [details](#de-10-confidence-and-daynight) | PROPOSED |
| DE-11 | 2026-11-14 15:44 | Terra-only model for 2000-11 to 2002-06; Terra + Aqua model (two separate predictors) for 2002-07 to 2012-01; native VIIRS from 2012-02: S-NPP to 2018-03, NOAA-20 from 2018-04, NOAA-21 as check and backup | Sum all satellites; Aqua only; one model per MODIS configuration; Terra only | Rafael | No artificial step when a satellite is added; no double counting; keeps the Terra-only months | method/FIRMS_REFERENCE.md section 2 ; [details](#de-11-satellites-per-era) | PROPOSED |
| DE-12 | 2026-11-14 15:44 | Grid: 0.25° cells aligned globally (candidate, to confirm with real data) | 0.1°; 0.25°; 0.5° | Rafael (to confirm with Jacques) | Cells much larger than the MODIS pixel; fewer zero cells for the model; export size; to confirm by measuring | [details](#de-12-grid) | PROPOSED |
| DE-13 | 2026-11-14 15:44 | Historical median = median of the same month in all previous years, excluding months flagged missing; anomaly = difference and ratio (ratio only if median > 0) | All previous years; all years except the current one; fixed baseline period | Rafael (to confirm with Jacques) | Literal reading of R7; same rules in Python and JS (JA-8) | [details](#de-13-historical-median-and-anomaly) | PROPOSED |
| DE-14 | 2026-11-14 15:44 | Missing-data flag: a month is flagged for a satellite if at least one day is missing; store `missing_days`; no rescaling in v1 | ≥ 1 missing day; share-of-days threshold; flag and rescale; flag and fill with converted MODIS | Rafael | Simple and follows AGENTS.md rule 6: missing data never becomes zero fire | method/FIRMS_REFERENCE.md section 7 ; [details](#de-14-missing-data-flag) | PROPOSED |
| DE-15 | 2026-11-14 15:44 | Validation protocol: backcast (train 2015-2025, test 2012-2014), leave-one-year-out, VIIRS continuity, sensitivity tests, selection rule fixed in advance | See details | Rafael | Tests the conversion in the direction it is used (backwards in time), with real VIIRS as reference | [details](#de-15-validation-protocol) | PROPOSED |

---

## Decision details

### DE-1 Demo area

- **Proposal:** northern Brazil (Amazon), as discussed by Rafael and Jacques on 2026-11-14.
- **Still open:** whole North Region, or one northern state such as Rondônia (suggested by Jacques).
  - Larger area: more cells for the user to select and more data to train the conversion (DE-6); larger export files.
  - One state: small and fast; less training data.
- **Recommendation: Rondônia.** With the cell climatology of DE-6, every active cell has a value in every MODIS-era month. The app file then has about active cells × 313 months rows (derived). The whole North Region at 0.25° has thousands of cells, which means millions of rows in the browser; one state stays far smaller. To be measured on real data before deciding (DE-12).
- **Borders:** a bbox around either option includes land outside Brazil. With the country CSV route (DE-8), using only Brazil's file would leave foreign cells empty, and they would read as zero fire (AGENTS.md rule 6). Either download the neighbouring countries' files or mask cells outside Brazil as no-data.
- **Size:** export rows ≈ cells × 313 months (Nov 2000 to Nov 2026, derived); see DE-12.
- TODO(verify): bbox from official IBGE boundaries - IBGE. Owner of #1 (Jacques) writes `config/area.json`.

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
- VIIRS 375 m detects smaller fires than MODIS 1 km (Schroeder, Oliva, Giglio, Csiszar 2014, Remote Sensing of Environment 143:85-96, doi:10.1016/j.rse.2013.12.008). TODO(verify): read the full paper before quoting details - https://directreadout.sci.gsfc.nasa.gov/publications_documents/Schroeder_et_al_2014b_RSE.pdf

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
     - TODO(verify): API and NRT values.
   - `acq_time` read as text HHMM.
   - `processing` (SP/NRT) from the `version` suffix. Standard processing carries the collection only; NRT, RT and URT add a suffix (FIRMS attribute page).
     - Observed SP values: MODIS `6.2` (2013) and `61.03` (2025); VIIRS `2`.
     - TODO(verify): meaning of `6.2` and `61.03` - FIRMS.
   - `route` (country CSV or API).
2. Clip to the demo bbox with half-open intervals (west ≤ lon < east, south ≤ lat < north), so no detection is counted twice at an edge.
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
  - Option 4 only in RA-6, adopted only if it beats 3 in the backcast by the margin fixed in DE-15.
- **Cell climatology (added 2026-11-14):**
  - The count regression predicts a value above 0 wherever MODIS counts 0. Without more information, cells that never burn would get the same small value as fire-prone cells.
  - Predictor added: log of the cell's mean monthly VIIRS count plus a small offset c, computed **only from training years**, so nothing leaks from the test years (DE-15). FIRMS data only.
  - Export consequence: rows = active cells (at least one detection by any satellite in any month) × months; other cells are 0 in every month.
- **App:** expected counts add up across cells, so the app can sum the cells of a selected area (R4). Variances are exported per cell-month and summed assuming independence. This understates uncertainty and is stated as a limitation. Format in DATA_CONTRACT.md (JA-3).

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
  
  VIIRS files use the same values as MODIS (0, 2, 3). Re-measure inside the demo area from `method/results/cleaning_log.csv` once DE-1 is fixed.
- TODO(verify): meaning of the `type` codes for VIIRS in the documentation - FIRMS_REFERENCE section 13, item 2.

### DE-10 Confidence and day/night

- **Confidence: no filter in v1.**
  - Keep the original value and a normalized class; sensitivity test with and without the low class in RA-3 (DE-15).
  - Why: MODIS (0-100) and VIIRS (l/n/h) confidence are not comparable, so any filter would differ by sensor. The FAQ says the meaning may vary by region and thresholds must be chosen empirically (FIRMS_REFERENCE section 5).
  - Cost: more false alarms are kept.
  - TODO(verify): MODIS class cut-offs - the FIRMS attribute page lists the three classes but not their limits; check the MODIS C6.1 user guide.
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
| 2000-11 to 2002-06 (20 months, derived) | Terra, converted with a Terra-only model |
| 2002-07 to 2012-01 | Terra and Aqua as two separate predictors (never summed), converted with a Terra + Aqua model |
| 2012-02 to 2018-03 | S-NPP (native VIIRS) |
| 2018-04 onwards | NOAA-20 (native VIIRS); NOAA-21 as a check and backup |

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
- TODO(verify): Aqua `satellite` value and NOAA-21 naming - FIRMS_REFERENCE section 13, items 3 and 5.

### DE-12 Grid

- **Proposal:** 0.25° cells aligned globally; row = floor((lat + 90) / 0.25), column = floor((lon + 180) / 0.25), half-open. A candidate, to be confirmed with real data together with Jacques.
- **Criteria:**
  - MODIS position uncertainty: 1 km nominal pixel, larger toward the scan edge (`scan`/`track` columns), so cells must be much larger than a pixel.
  - Smaller cells mean more zeros and a noisier conversion.
  - Export size ≈ active cells × 313 months (derived). The DE-6 cell climatology makes MODIS-era months dense for active cells, so area (DE-1) and cell size both matter.
  - Smaller cells give finer area selection (R4).
- **Check before deciding:** sparse export size, share of zero cell-months, and backcast error at 0.1°, 0.25° and 0.5° (RA-3).

### DE-13 Historical median and anomaly

With Jacques; used by JA-6 and JA-8.

- **Median for month m of year Y:** median of the harmonized counts of month m in all years before Y, excluding months flagged missing (DE-14).
  - `estimated` months are included and marked.
  - Shown only if at least N years are available (N to be fixed by the team); the number of years used is shown.
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
- **Sources of missing days:** FIRMS `missing_data` (FIRMS_REFERENCE section 7). The MODIS gaps from the archive README (2007, 2009) are TODO(verify) with daily counts - FIRMS_REFERENCE section 13, item 8.
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
- **Values still to fix (team):** training and test years if different from above, tolerance X, ML margin, minimum years N (DE-13).
