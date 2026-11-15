# Data provenance

Owner issue: JA-4. Fill from the real downloads; nothing here is filled from memory.

| Source (FIRMS) | Product | Version | Period | Coverage (bbox) | Download date |
|----------------|---------|---------|--------|-----------------|---------------|
| Country yearly summary CSVs, Brazil + Bolivia (https://firms.modaps.eosdis.nasa.gov/data/country/) | MODIS 1 km (Terra, Aqua), standard processing | `6.03`, `6.2`, `61.03` (seen in the files) | 2000-11-01 to 2025-12-31 | Processing box W -67, S -13.75, E -59.75, N -7.75, then the IBGE boundary of Rondônia | 2026-11-14 |
| same | VIIRS 375 m S-NPP, standard processing | `2` | 2012-01-20 to 2025-12-31 | same | 2026-11-14 |
| same | VIIRS 375 m NOAA-20, standard processing | `2` | 2018-04-01 to 2025-12-31 | same | 2026-11-14 |
| FIRMS area API, source `VIIRS_NOAA21_SP` (https://firms.modaps.eosdis.nasa.gov/api/area/), no country files exist for NOAA-21 | VIIRS 375 m NOAA-21, standard processing | `2` | 2024-01-17 to 2025-12-31 | Processing box (API query), then the IBGE boundary | 2026-11-15 |

- **Download used for the pipeline run in PRs #28-#34** (Rafael):
  - 96 files (48 instrument-years × 2 countries), each with its size checked against https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt;
  - 91 of them are listed in `data/raw/download_manifest.csv` (local, git-ignored); the first 5 were downloaded earlier with the same check.
  - JA-4 confirms or replaces this with `download.py`.
- **Missing-data days per satellite:** from https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data, retrieved 2026-11-14, 178 satellite-days (SP: Terra 57, Aqua 26, S-NPP 80, NOAA-20 6; NRT: NOAA-21 9). Stored as `data/raw/missing_days.csv` with columns `sat,date,processing`; JA-4 writes it with `download.py`.
- **NOAA-21:** `python pipeline/download.py --api-source VIIRS_NOAA21_SP --dates 2024-01-17 2025-12-31` (Rafael, 2026-11-15), 5-day windows; 250,342 rows for 2024 and 48,470 for 2025 in `data/raw/api/viirs-jpss2/` (local, git-ignored). The MAP_KEY is in `.env` and is never written to the files or logs.
- **Not included yet:** 2026 (FIRMS area API, DE-8).
