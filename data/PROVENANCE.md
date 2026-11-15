# Data provenance

Owner issue: JA-4. Fill from the real downloads; nothing here is filled from memory.

| Source (FIRMS) | Product | Version | Period | Coverage (bbox) | Download date |
|----------------|---------|---------|--------|-----------------|---------------|
| Country yearly summary CSVs, Brazil + Bolivia (https://firms.modaps.eosdis.nasa.gov/data/country/) | MODIS 1 km (Terra, Aqua), standard processing | `6.03`, `6.2`, `61.03` (seen in the files) | 2000-11-01 to 2025-12-31 | Processing box W -67, S -13.75, E -59.75, N -7.75, then the IBGE boundary of Rondônia | 2026-11-14 |
| same | VIIRS 375 m S-NPP, standard processing | `2` | 2012-01-20 to 2025-12-31 | same | 2026-11-14 |
| same | VIIRS 375 m NOAA-20, standard processing | `2` | 2018-04-01 to 2025-12-31 | same | 2026-11-14 |
| FIRMS area API, all four satellites, standard processing then NRT (provisional) | MODIS (Terra, Aqua), VIIRS S-NPP, NOAA-20, NOAA-21 | SP as in the files; NRT `6.1NRT`, `2.0NRT` | 2026-01-01 to 2026-10-31 | Processing box (API query), then the IBGE boundary | 2026-11-15 |
| FIRMS area API, source `VIIRS_NOAA21_SP` (https://firms.modaps.eosdis.nasa.gov/api/area/), no country files exist for NOAA-21 | VIIRS 375 m NOAA-21, standard processing | `2` | 2024-01-17 to 2025-12-31 | Processing box (API query), then the IBGE boundary | 2026-11-15 |

- **Download used for the pipeline run in PRs #28-#34** (Rafael):
  - 96 files (48 instrument-years × 2 countries), each with its size checked against https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt;
  - 91 of them are listed in `data/raw/download_manifest.csv` (local, git-ignored); the first 5 were downloaded earlier with the same check.
  - JA-4 confirms or replaces this with `download.py`.
- **Missing-data days per satellite:** from https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data, retrieved 2026-11-14, 178 satellite-days (SP: Terra 57, Aqua 26, S-NPP 80, NOAA-20 6; NRT: NOAA-21 9). Stored as `data/raw/missing_days.csv` with columns `sat,date,processing`; JA-4 writes it with `download.py`.
- **NOAA-21:** `python pipeline/download.py --api-source VIIRS_NOAA21_SP --dates 2024-01-17 2025-12-31` (Rafael, 2026-11-15), 5-day windows; 250,342 rows for 2024 and 48,470 for 2025 in `data/raw/api/viirs-jpss2/` (local, git-ignored). The MAP_KEY is in `.env` and is never written to the files or logs.
- **2026:** `python pipeline/download.py --api-source <SOURCE> --dates ...` (Rafael, 2026-11-15) for MODIS_SP 2026-01-01..08-31 and MODIS_NRT 09-01..10-31; VIIRS_SNPP, VIIRS_NOAA20 and VIIRS_NOAA21 _SP 2026-01-01..07-31 and _NRT 08-01..10-31 (date ranges from `data_availability`, DATA_CONTRACT.md). Rows: MODIS 4,819 SP + 5,426 NRT; S-NPP 7,090 + 34,634; NOAA-20 7,451 + 34,934; NOAA-21 7,104 + 32,181 (`data/raw/api/<source>/2026/`, local, git-ignored). Each download process peaked at about 106 MB of memory.
- **Not included yet:** after 2026-10-31.
