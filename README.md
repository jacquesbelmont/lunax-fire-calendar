# LUNAX Fire Calendar

NASA Space Apps Challenge 2026 — "Harmonization of MODIS and VIIRS Hot Spots" — team LUNAX.
A web app showing a monthly burning-activity calendar built on a harmonized NASA FIRMS MODIS + VIIRS hotspot series.

Data: NASA FIRMS (https://www.earthdata.nasa.gov/data/tools/firms). No NASA logos are used; no endorsement implied.

## Status (2026-11-15)
- **App online:** https://jacquesbelmont.github.io/lunax-fire-calendar/
- **Decisions:** [method/DECISIONS.md](method/DECISIONS.md); all DECIDED.
  - Demo area: **Rondônia, Brazil** (IBGE boundary).
  - Target scale: **VIIRS 375 m equivalent**, built from both sensors.
  - Monthly calendar.
  - Data from the FIRMS country CSVs (2000-2025); NOAA-21 (2024-2025) from the FIRMS area API, as a check of NOAA-20.
- **Pipeline:** implemented and run on real FIRMS data, 2000-11 to 2025-12 (PRs #28-#34, merged).
  - MODIS-only months (2000-11 to 2012-01) are converted to the VIIRS scale with a ratio per month of year, learned where both sensors overlap. It was selected by a pre-registered backcast: bias of the total +0.6 % on 2012-2014; see [method/VALIDATION.md](method/VALIDATION.md).
  - VIIRS continuity: NOAA-20/S-NPP 0.992 (83 months), NOAA-21/NOAA-20 0.956 (21 months).
  - Method and limitations: [method/METHOD.md](method/METHOD.md).
- **App data:** `docs/data/` (format in [DATA_CONTRACT.md](DATA_CONTRACT.md)), written by `pipeline/export.py` and `pipeline/export_hotspots.py` (hotspot CSV download, R9, DE-17).
- **App:** map with area selection, monthly calendar, comparison with the historical median, per-sensor view and downloads (JA-5 to JA-8, PR #37).
- **Not included yet:** 2026 (FIRMS area API; the download route exists, the run is planned). See [method/METHOD.md](method/METHOD.md).

## Structure
- `pipeline/` — Python pipeline (runs offline, writes to `docs/data/`). See [pipeline/README.md](pipeline/README.md).
- `docs/` — static web app published by GitHub Pages (branch `main`, folder `/docs`), no build step. Libraries in `docs/lib/`.
- `data/` — raw data (`data/raw/`, git-ignored) and [data/PROVENANCE.md](data/PROVENANCE.md).
- `method/` — decisions, method, validation, plain-English text, reference tests.
- `submission/` — Space Apps project page drafts, slides outline, fact check, checklist.
- `config/area.json` — processing box of the demo area; `config/area_boundary.geojson` — IBGE boundary of Rondônia (DE-1).

## Documents
[SCOPE.md](SCOPE.md) · [WORKFLOW.md](WORKFLOW.md) · [DATA_CONTRACT.md](DATA_CONTRACT.md) · [SOURCES.md](SOURCES.md) · [AI_USE.md](AI_USE.md) · [AGENTS.md](AGENTS.md) · [method/DECISIONS.md](method/DECISIONS.md)

## How to run
1. Python environment:
   ```
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r pipeline/requirements.txt
   ```
   Exact versions used at setup: `pipeline/requirements.lock.txt`.
2. Create `.env` yourself (see `.env.example`): `FIRMS_MAP_KEY=<your key>`. Never commit it.
3. Pipeline order: `check_availability.py` → `download.py` → `clean.py` → `aggregate.py` → `harmonize.py` → `validate.py` → `export.py` (details in [pipeline/README.md](pipeline/README.md)).
   - `check_availability.py` and `download.py` are JA-2/JA-4. `download.py` writes `data/raw/country/<instrument>/<year>/*.csv` and `data/raw/missing_days.csv`.
   - The rest, after the download:
   ```
   # one instrument-year at a time (MODIS 2000-2025, VIIRS S-NPP 2012-2025, NOAA-20 2018-2025)
   python pipeline/clean.py --source modis --year 2005 --bbox -67 -13.75 -59.75 -7.75 --check
   python pipeline/aggregate.py --check
   python pipeline/harmonize.py --check
   python pipeline/validate.py           # writes method/results/ and method/figures/ (about 1.5 min)
   python pipeline/export.py --check     # writes docs/data/ (needs validate.py's calibration)
   python method/tests/make_expected.py  # writes method/tests/expected.json for the app tests (JA-8)
   ```
   - Disk: the raw FIRMS files of Brazil and Bolivia for 2000-2025 are about 3.9 GB (`clean.py` also reads them gzip-compressed, about 0.8 GB); the cleaned files are about 40 MB.
4. Local preview of the app:
   ```
   python3 -m http.server 8000 --directory docs
   ```
   then open http://localhost:8000 (opening `index.html` via `file://` will not load data).

## AI use
AI assistance is logged in [AI_USE.md](AI_USE.md). AI is not used to come up with the solution idea.

## License
Apache-2.0 (see [LICENSE](LICENSE)). Vendored libraries keep their own licenses ([docs/lib/README.md](docs/lib/README.md)).
