# Data provenance

Owner issue: JA-4. Fill from the real downloads; nothing here is filled from memory.

| Source (FIRMS) | Product | Version | Period | Coverage (bbox) | Download date |
|----------------|---------|---------|--------|-----------------|---------------|
| Country yearly summary CSVs, Brazil + Bolivia (https://firms.modaps.eosdis.nasa.gov/data/country/) | MODIS 1 km (Terra, Aqua), standard processing | `6.03`, `6.2`, `61.03` (seen in the files) | 2000-11-01 to 2025-12-31 | Processing box W -67, S -13.75, E -59.75, N -7.75, then the IBGE boundary of Rondônia | 2026-11-14 |
| same | VIIRS 375 m S-NPP, standard processing | `2` | 2012-01-20 to 2025-12-31 | same | 2026-11-14 |
| same | VIIRS 375 m NOAA-20, standard processing | `2` | 2018-04-01 to 2025-12-31 | same | 2026-11-14 |

- **Download used for the pipeline run in PRs #28-#34** (Rafael):
  - 96 files (48 instrument-years × 2 countries), each with its size checked against https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt;
  - 91 of them are listed in `data/raw/download_manifest.csv` (local, git-ignored); the first 5 were downloaded earlier with the same check.
  - JA-4 confirms or replaces this with `download.py`.
- **Missing-data days per satellite:** from https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data, retrieved 2026-11-14, 178 satellite-days (SP: Terra 57, Aqua 26, S-NPP 80, NOAA-20 6; NRT: NOAA-21 9). Stored as `data/raw/missing_days.csv` with columns `sat,date,processing`; JA-4 writes it with `download.py`.
- **Not included yet:** 2026 and NOAA-21 (FIRMS area API, DE-8).
