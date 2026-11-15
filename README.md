# LUNAX Fire Calendar

NASA Space Apps Challenge 2026 — "Harmonization of MODIS and VIIRS Hot Spots" — team LUNAX.
A web app showing a monthly burning-activity calendar built on a harmonized NASA FIRMS MODIS + VIIRS hotspot series.

Data: NASA FIRMS (https://www.earthdata.nasa.gov/data/tools/firms). No NASA logos are used; no endorsement implied.

## Status (2026-11-15)
- **Published:** https://jacquesbelmont.github.io/lunax-fire-calendar/ (GitHub Pages from `main`, folder `/docs`).
- **What the app does:** map with the study-area boundary and area selection (rectangle or latitude/longitude); monthly calendar (month x year) of harmonized hotspot counts; the latest month compared with the historical median; period selection; per-sensor view (Terra, Aqua, S-NPP, NOAA-20, NOAA-21); downloads (monthly series, values per grid cell, hotspot list, chart PNG) with the FIRMS acknowledgment and the data cut-off date.
- **Data:** NASA FIRMS data for Rondônia, Brazil, 2000-11 to 2026-10 (archived data, cut-off 2026-10-31): country CSVs (standard processing) for 2000-2025 and the FIRMS area API for NOAA-21 (from 2024) and for 2026. August to October 2026 are near real-time data, marked provisional in the app.
- **Method:** MODIS-only months (2000-11 to 2012-01) are converted to the VIIRS 375 m scale with a ratio per month of year, learned where both sensors overlap (2015-2025). Selected by a pre-registered backcast: bias of the total +0.6% on 2012-2014. VIIRS continuity: NOAA-20/S-NPP 0.992 (83 months), NOAA-21/NOAA-20 0.956 (21 months). See [method/METHOD.md](method/METHOD.md), [method/VALIDATION.md](method/VALIDATION.md) and [method/DECISIONS.md](method/DECISIONS.md) (all decisions DECIDED).
- **Plain-English explanation:** [method/HOW_IT_WORKS.md](method/HOW_IT_WORKS.md).
- **Submission drafts:** [submission/](submission/) (project page, slides outline, fact check, checklist).
- **Updating:** a new month needs `pipeline/download.py --api-source` for the new dates, a new `DATA_END` in `pipeline/aggregate.py` and a pipeline rerun (see [pipeline/README.md](pipeline/README.md)).

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
Tools: Claude and Claude Code (Anthropic), used for code, comparison of options for the method decisions, analyses and documentation. Every AI-assisted step is logged in [AI_USE.md](AI_USE.md), and AI-assisted code carries a header comment. No AI-generated images, video or audio, and no NASA logos. The decisions on the area, the target scale and the method were made by team members and are recorded with who chose in [method/DECISIONS.md](method/DECISIONS.md); the AI drafted options and ran analyses. The Space Apps rule is that AI is not used to come up with the solution idea: the team confirms this in [submission/FACT_CHECK.md](submission/FACT_CHECK.md) (open item 4).

## License
Apache-2.0 (see [LICENSE](LICENSE)). Vendored libraries keep their own licenses ([docs/lib/README.md](docs/lib/README.md)).
