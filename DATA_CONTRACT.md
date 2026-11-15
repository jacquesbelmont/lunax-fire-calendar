# DATA CONTRACT

Files exchanged between the Python pipeline (`pipeline/`, owner: Rafael for outputs, Jacques for inputs) and the web app (`docs/`, owner: Jacques).
Written only by `pipeline/export.py` (and `pipeline/export_hotspots.py` for (b)) into `docs/data/`. Status: **DRAFT** — v1 to be filled from real FIRMS headers and approved by Jacques and Rafael (JA-3).

Rules: never sum raw MODIS and VIIRS counts; never treat missing data as zero fire (see `missing_data` flag).
Changing any format here requires updating this file and telling the other side.

## Output files

### (a) Monthly counts per grid cell
Path: `docs/data/monthly_cells.csv`. Proposed by Rafael on issue #5 and implemented in `pipeline/export.py`; to be approved by Jacques (JA-3).
Content: one row per **active cell** (at least one detection by any satellite in any month) and month. Only detections inside the area boundary (`docs/data/area.geojson`, DE-1) are counted.
- Cells inside the boundary without a row had no detection in any month.
- Everything outside the boundary is **outside the area**, never zero fire.
- A cell that crosses the boundary counts only its detections inside it.

Grid: DE-12 (0.25° cells; see `metadata.json` → `grid`).
**An empty value means no data and is never zero fire** (AGENTS.md rule 6).

| Column | Type | Unit | Description |
|--------|------|------|-------------|
| `cell_id` | text | - | `<row>_<col>` with row = floor((lat+90)/0.25), col = floor((lon+180)/0.25). Cell centre: lat = (row+0.5)·0.25−90, lon = (col+0.5)·0.25−180 |
| `year_month` | text | YYYY-MM | Month (UTC acquisition dates) |
| `viirs_eq` | float | hotspots | Harmonized count on the VIIRS 375 m scale (DE-2). Empty = no data |
| `viirs_eq_var` | float | hotspots² | Calibrated variance of `viirs_eq` (DE-16); 0 for observed (native VIIRS) months. For an area: 90 % interval = sum(`viirs_eq`) ± 1.645·sqrt(sum(`viirs_eq_var`)) |
| `estimated` | 0/1 | - | 1 = converted from MODIS (2000-11 to 2012-01, DE-6/DE-11) |
| `terra`, `aqua`, `snpp`, `noaa20`, `noaa21` | int | hotspots | Raw count per satellite, for the per-sensor view (JA-7). Empty = satellite not covered or month flagged. Never sum MODIS and VIIRS columns |

### (a2) Coverage and flags per satellite and month
Path: `docs/data/months.csv`.

| Column | Type | Unit | Description |
|--------|------|------|-------------|
| `year_month` | text | YYYY-MM | Month |
| `sat` | text | - | Terra, Aqua, SNPP, NOAA20 or NOAA21 |
| `missing_days` | int | days | FIRMS missing days + days outside the satellite's operating window (DE-14) |
| `flagged` | 0/1 | - | 1 = at least one missing day; the calendar marks the month, never as zero |
| `provisional` | 0/1 | - | 1 = month contains NRT data (DE-4). The app reads this file and marks a month provisional when any satellite has 1 (calendar hover, "prov." year label, comment line in the CSV downloads) |

A satellite-month absent from this file has no data. The data end on the last day downloaded (`DATA_END` in `pipeline/aggregate.py`, a month end); later months have no row.

### (d) Area boundary
Path: `docs/data/area.geojson`. This is the IBGE boundary of Rondônia (DE-1), a GeoJSON FeatureCollection with one Polygon. The source URL and retrieval date are in the feature `properties`. The app draws it and marks everything outside it as "outside the area".

### (e) Monthly series per municipality
Path: `docs/data/municipalities.csv`. Written by `pipeline/export.py` (DE-24).
Same columns, units and rules as (a), with `area_id` (IBGE municipality code, 7 digits) instead of `cell_id`: one row per municipality (all 52 of Rondônia) and month.
Each detection kept by `clean.py` belongs to the municipal polygon of (f) that contains it, else to the municipality of the nearest boundary vertex (1 of 2,168,855 detections on 2026-11-15). The harmonization is the production one (same ratios, DE-16 factor on the variance), applied with the municipality as the unit, so the 52 values add up to the whole-area value in every month (`export.py --check`).
The app uses the same polygons and rule (`municipalityIndex` in docs/js/calc.js) to keep the hotspot rows of a municipality (tests/js/hotspots.test.js).

### (f) Municipal boundaries
Path: `docs/data/municipalities.geojson`, a copy of `config/municipalities.geojson` written by `pipeline/download.py --ibge-municipalities` from the IBGE malhas API v3 (`intrarregiao=municipio`, `qualidade=intermediaria`) and the IBGE localidades API v1 (names). FeatureCollection of 52 Polygons without holes; properties `code`, `name`, `source`, `url`, `names_url`, `retrieved`.

### (g) Places that burn year after year
Path: `docs/data/recurrence.csv`. Written by `pipeline/export.py` (DE-26), after `pipeline/validate.py --recurrence` (method/results/recurrence_hindcast.json).

| Column | Type | Unit | Description |
|--------|------|------|-------------|
| `cell_id` | text | - | `<row>_<col>` of a 0.01° cell: row = floor((lat+90)/0.01), col = floor((lon+180)/0.01) |
| `years` | int | years | Number of the years in `metadata.json` `recurrence.years` (2012-2025 without 2023) with at least one detection of the DE-11 reference VIIRS satellite |
| `detections` | int | hotspots | Reference VIIRS detections in the cell in those years |

`metadata.json` key `outlook` (DE-27, PROPOSED): the pre-registered test result copied by `export.py` from method/results/outlook_hindcast.json (`node method/outlook_hindcast.js`): test and fresh years, MALE per candidate, the chosen pre-season and early-season methods. The app computes the outlook of the selected area from its harmonized series with docs/js/calc.js.

### (h) Where to expect fire next season (DE-28, PROPOSED)
Paths: `docs/data/cell_outlook_001.csv` (0.01°) and `docs/data/cell_outlook_005.csv` (0.05°), written by `pipeline/export.py` from `pipeline/cell_outlook.py` (data/interim/cell_outlook_2027_<scale>.csv; test in method/results/cell_outlook_hindcast.json).
- When a model passed the test (`metadata.json` `cell_outlook.scales.<scale>.shown` = `L` or `G`): `cell_id,p` = chance (0-1, 3 decimals) of at least one reference VIIRS detection in January-October of next year; cells with p < 0.01 are not listed.
- When persistence is shown (`shown` = `P`): `cell_id,last,top` = reference detections in January-October of the last year, and `top` = 1 for the 10 % of the scale's cells ranked first as in the test (last, then neighbours, then cell id); cells with no detection and not in the top are not listed.
`cell_id` uses the global grid of the scale: row = floor((lat+90)/size), col = floor((lon+180)/size).

Only cells with at least one detection are listed; a cell that is not listed had no detection, which is not proof of no fire. The sum of `detections` equals the reference detections of those years (`export.py`). `metadata.json` key `recurrence`: file, grid, years, excluded years, the satellite rule and the hindcast summary of DE-26.

### (b) Hotspot list per year (CSV export)
Paths: `docs/data/hotspots/<instrument>_<year>.csv.gz` and `docs/data/hotspots/index.json`. Written by `pipeline/export_hotspots.py` (DE-17, R9). `<instrument>` is the FIRMS country-file instrument: `modis`, `viirs-snpp`, `viirs-jpss1` (NOAA-20), plus `viirs-jpss2` (NOAA-21); the NOAA-21 files and all 2026 files come from the area API. 54 files, 2,168,855 rows (`index.json`).
Content: the detections kept by `clean.py` (standard data, `type` 0, inside the area boundary, no confidence filter). Each file is gzip text. It starts with `#` comment lines (FIRMS acknowledgment, disclaimer link, data cut-off date), then the column header, then one row per hotspot, sorted by date and time.
`index.json`: `columns` and `files` (`source`, `year`, `file`, `rows`, `bytes`); the app reads it to choose the files of a period and to show the size.

| Column | Type | Unit | Description |
|--------|------|------|-------------|
| `cell_id` | text | - | Same grid cell as in (a), so a selection of cells picks the same rows |
| `latitude`, `longitude` | float | degrees | Pixel centre (WGS84), as in the FIRMS file |
| `acq_date` | text | YYYY-MM-DD | UTC acquisition date |
| `acq_time` | text | HHMM | UTC acquisition time, leading zeros kept |
| `sat` | text | - | `Terra`, `Aqua`, `SNPP`, `NOAA20` or `NOAA21` |
| `sensor` | text | - | `MODIS` or `VIIRS` |
| `confidence` | text | - | MODIS 0-100; VIIRS `l`, `n` or `h` (both seen in the real files). Not filtered |
| `daynight` | text | - | `D` or `N` |
| `frp` | float | MW | Fire radiative power (FIRMS attribute page) |
| `type` | int | - | 0 = presumed vegetation fire (only value kept); empty in NRT rows, which carry no type (DE-9) |
| `version` | text | - | FIRMS product version as in the file; a version ending in `NRT` marks a near real-time (provisional) row, and the file header then says so |

The numbers of rows per instrument and year equal `rows_kept` of `method/results/cleaning_log.csv`, and the counts per cell, month and satellite equal the raw columns of (a) (`tests/js/hotspots.test.js`).

### (c) metadata.json
Path: `docs/data/metadata.json`
Fields (attribution = exact FIRMS acknowledgment text): area; source; product; version; time period; geographic coverage; method; data cut-off date; FIRMS attribution.
Implemented in `pipeline/export.py` with keys: `title`, `area` (`name`, `bbox_west_south_east_north`, `source_countries`), `source` (`name`, `url`, `product`, `files`, `satellites`, `versions_by_satellite`), `period` (`first_month`, `last_month`), `data_cutoff_date`, `archived`, `grid`, `method`, `files`, `attribution` (exact FIRMS acknowledgment), `disclaimer_url`, `ai_use` (statement of AI use, S6).

## FIRMS API facts

Source: https://firms.modaps.eosdis.nasa.gov/api/ (API version 4.2.8). Official code examples: https://firms.modaps.eosdis.nasa.gov/academy/

### area
`/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]/[DATE]`
- AREA_COORDINATES = `west,south,east,north`
- DAY_RANGE = 1..5
- DATE = `YYYY-MM-DD`
- SOURCE: `MODIS_NRT`, `MODIS_SP`, `VIIRS_SNPP_NRT`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA20_SP`, `VIIRS_NOAA21_NRT`, `VIIRS_NOAA21_SP`
- `LANDSAT_NRT` is US/Canada only: out of scope.
- Limit: 5000 transactions per 10-minute interval; larger requests may count as multiple transactions.

### data_availability
`/api/data_availability/csv/[MAP_KEY]/[SENSOR]` (SENSOR = `ALL` or a source above, as listed on https://firms.modaps.eosdis.nasa.gov/api/data_availability/; the official notebook uses lowercase `all`): date ranges of SP and NRT data per sensor.

### missing_data
Days with missing data per satellite and data type (NRT shown only after the last SP date). The page loads its table from `https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data` (JSON with HTML table rows, no MAP_KEY; see method/FIRMS_REFERENCE.md section 7).

### Not usable
- `country` / `countries`: currently unavailable (outage notice); use a bounding box.
- `kml_fire_footprints`: out of scope.

### Context
Delivery of new Suomi NPP data ended on 2026-11-02 (historical data stays available); recent months need NOAA-20 and NOAA-21:
https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know

## SP / NRT date ranges per sensor
Output of `pipeline/check_availability.py` (FIRMS `data_availability`, `ALL`), 2026-11-15:

| data_id | min_date | max_date |
|---------|----------|----------|
| MODIS_NRT | 2026-09-01 | 2026-11-15 |
| MODIS_SP | 2000-11-01 | 2026-08-31 |
| VIIRS_NOAA20_NRT | 2026-08-01 | 2026-11-15 |
| VIIRS_NOAA20_SP | 2018-04-01 | 2026-07-31 |
| VIIRS_NOAA21_NRT | 2024-01-17 | 2026-11-15 |
| VIIRS_NOAA21_SP | 2023-03-01 | 2026-07-31 |
| VIIRS_SNPP_NRT | 2026-08-01 | 2026-11-02 |
| VIIRS_SNPP_SP | 2012-01-20 | 2026-07-31 |

The answer also lists LANDSAT_NRT, GOES_NRT, BA_MODIS and BA_VIIRS (out of scope). Area API answers have the country-file columns (below), but `acq_time` comes without leading zeros (e.g. `541`); `clean.py` pads it to HHMM. NRT answers have no `type` column; they do have `instrument`. MODIS `satellite` is `Terra`/`Aqua` in both SP and NRT API answers (seen 2026-11-15; only the public 24 h NRT files write `T`/`A`).

## Real column headers per source
DRAFT from real Brazil country files (method/FIRMS_REFERENCE.md section 4); to be reviewed by Jacques and Rafael (JA-3).
- MODIS: `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`
- VIIRS (S-NPP, NOAA-20; NOAA-21 from the area API `VIIRS_NOAA21_SP`, same columns, `satellite` = `N21`, `version` = `2`): `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type`
- `acq_time` is HHMM in UTC with leading zeros: read as text. `confidence`: MODIS 0-100, VIIRS `l`/`n`/`h` (values seen in the real files, 2026-11-15).
- VIIRS units: brightness temperatures in Kelvin, `frp` in MW (FIRMS attribute page). VIIRS `type` codes are the MODIS ones: 0 presumed vegetation fire, 1 active volcano, 2 other static land source, 3 offshore (VIIRS C2 375 m User Guide 1.2, section 3.2.2; FIRMS_REFERENCE.md section 13).

## Country yearly summary files (no MAP_KEY)
`https://firms.modaps.eosdis.nasa.gov/data/country/<instrument>/<YYYY>/<instrument>_<YYYY>_<Country>.csv`, `<instrument>` = `modis`, `viirs-snpp`, `viirs-jpss1` (NOAA-20). Standard processing, 2000-2025; no NOAA-21, no 2026. Index: https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt

## Attribution (must appear in metadata.json, the CSV export and the app footer)
Acknowledgment text (exact) and disclaimer link: see method/FIRMS_REFERENCE.md section 10.
