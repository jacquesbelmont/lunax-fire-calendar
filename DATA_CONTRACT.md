# DATA CONTRACT

Files exchanged between the Python pipeline (`pipeline/`, owner: Rafael for outputs, Jacques for inputs) and the web app (`docs/`, owner: Jacques).
Written only by `pipeline/export.py` into `docs/data/`. Status: **DRAFT** — v1 to be filled from real FIRMS headers and approved by Jacques and Rafael (JA-3).

Rules: never sum raw MODIS and VIIRS counts; never treat missing data as zero fire (see `missing_data` flag).
Changing any format here requires updating this file and telling the other side.

## Output files

### (a) Monthly counts per grid cell
Path: `docs/data/monthly_cells.csv`. Proposed by Rafael on issue #5 and implemented in `pipeline/export.py`; to be approved by Jacques (JA-3).
Content: one row per **active cell** (at least one detection by any satellite in any month) and month. Cells without a row had no detection in any month. Grid: DE-12 (0.25° cells; see `metadata.json` → `grid`).
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
| `provisional` | 0/1 | - | 1 = month contains NRT data (DE-4) |

A satellite-month absent from this file has no data.

### (b) Hotspot list per year (CSV export)
Path: TODO(verify): file naming - decide in JA-3
Content: hotspots per year, used for the CSV download (R9).

| Column | Type | Unit | Description |
|--------|------|------|-------------|
| TODO(verify) | | | Fill from real FIRMS headers (JA-2) |

### (c) metadata.json
Path: `docs/data/metadata.json`
Fields (names TODO(verify) in JA-3; attribution = exact FIRMS acknowledgment text): area; source; product; version; time period; geographic coverage; method; data cut-off date; FIRMS attribution.
Implemented in `pipeline/export.py` with keys: `title`, `area` (`name`, `bbox_west_south_east_north`, `source_countries`), `source` (`name`, `url`, `product`, `files`, `satellites`, `versions_by_satellite`), `period` (`first_month`, `last_month`), `data_cutoff_date`, `archived`, `grid`, `method`, `files`, `attribution` (exact FIRMS acknowledgment), `disclaimer_url`.

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
`/api/data_availability/csv/[MAP_KEY]/[SENSOR]` (SENSOR = `ALL` or a source above; the official notebook uses lowercase `all`: TODO(verify): case - FIRMS academy notebook): date ranges of SP and NRT data per sensor.

### missing_data
Days with missing data per satellite and data type (NRT shown only after the last SP date). The page loads its table from `https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data` (JSON with HTML table rows, no MAP_KEY; see method/FIRMS_REFERENCE.md section 7).

### Not usable
- `country` / `countries`: currently unavailable (outage notice); use a bounding box.
- `kml_fire_footprints`: out of scope.

### Context
Delivery of new Suomi NPP data ended on 2026-11-02 (historical data stays available); recent months need NOAA-20 and NOAA-21:
https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know

## SP / NRT date ranges per sensor
TODO(verify): fill from `data_availability` output in JA-2.

## Real column headers per source
DRAFT from real Brazil country files (method/FIRMS_REFERENCE.md section 4); to be reviewed by Jacques and Rafael (JA-3).
- MODIS: `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`
- VIIRS (S-NPP, NOAA-20): `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type`
- `acq_time` is HHMM in UTC with leading zeros: read as text. `confidence`: MODIS 0-100, VIIRS `l`/`n`/`h`: TODO(verify).
- Units and `type` codes for VIIRS: TODO(verify) (FIRMS_REFERENCE.md section 13).

## Country yearly summary files (no MAP_KEY)
`https://firms.modaps.eosdis.nasa.gov/data/country/<instrument>/<YYYY>/<instrument>_<YYYY>_<Country>.csv`, `<instrument>` = `modis`, `viirs-snpp`, `viirs-jpss1` (NOAA-20). Standard processing, 2000-2025; no NOAA-21, no 2026. Index: https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt

## Attribution (must appear in metadata.json, the CSV export and the app footer)
Acknowledgment text (exact) and disclaimer link: see method/FIRMS_REFERENCE.md section 10.
