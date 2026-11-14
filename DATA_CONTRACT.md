# DATA CONTRACT

Files exchanged between the Python pipeline (`pipeline/`, owner: Rafael for outputs, Jacques for inputs) and the web app (`docs/`, owner: Jacques).
Written only by `pipeline/export.py` into `docs/data/`. Status: **DRAFT** — v1 to be filled from real FIRMS headers and approved by Jacques and Rafael (JA-3).

Rules: never sum raw MODIS and VIIRS counts; never treat missing data as zero fire (see `missing_data` flag).
Changing any format here requires updating this file and telling the other side.

## Output files

### (a) Monthly counts per grid cell
Path: TODO(verify): file name - decide in JA-3
Content: monthly hotspot counts per grid cell, harmonized and per sensor, plus a flag for months with missing satellite data.

| Column | Type | Unit | Description |
|--------|------|------|-------------|
| TODO(verify) | | | Fill from real FIRMS headers (JA-2) and the grid decision in method/DECISIONS.md |

### (b) Hotspot list per year (CSV export)
Path: TODO(verify): file naming - decide in JA-3
Content: hotspots per year, used for the CSV download (R9).

| Column | Type | Unit | Description |
|--------|------|------|-------------|
| TODO(verify) | | | Fill from real FIRMS headers (JA-2) |

### (c) metadata.json
Path: `docs/data/metadata.json`
Fields (names TODO(verify) in JA-3; attribution = exact FIRMS acknowledgment text): area; source; product; version; time period; geographic coverage; method; data cut-off date; FIRMS attribution.

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
