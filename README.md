# LUNAX Fire Calendar

NASA Space Apps Challenge 2026 — "Harmonization of MODIS and VIIRS Hot Spots" — team LUNAX.
A web app showing a monthly burning-activity calendar built on a harmonized NASA FIRMS MODIS + VIIRS hotspot series.

Status: project skeleton. Method, area and numbers are not decided yet; see [method/DECISIONS.md](method/DECISIONS.md).
Data: NASA FIRMS (https://www.earthdata.nasa.gov/data/tools/firms). No NASA logos are used; no endorsement implied.

## Structure
- `pipeline/` — Python pipeline (runs offline, writes to `docs/data/`). See [pipeline/README.md](pipeline/README.md).
- `docs/` — static web app published by GitHub Pages (branch `main`, folder `/docs`), no build step. Libraries in `docs/lib/`.
- `data/` — raw data (`data/raw/`, git-ignored) and [data/PROVENANCE.md](data/PROVENANCE.md).
- `method/` — decisions, method, validation, plain-English text, reference tests.
- `submission/` — Space Apps project page drafts, slides outline, fact check, checklist.
- `config/area.json` — demo area (decided in DE-1).

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
3. Pipeline order: `check_availability.py` → `download.py` → `clean.py` → `aggregate.py` → `harmonize.py` → `validate.py` → `export.py` (details in [pipeline/README.md](pipeline/README.md)). Steps are stubs for now.
4. Local preview of the app:
   ```
   python3 -m http.server 8000 --directory docs
   ```
   then open http://localhost:8000 (opening `index.html` via `file://` will not load data).

## AI use
AI assistance is logged in [AI_USE.md](AI_USE.md). AI is not used to come up with the solution idea.

## License
Apache-2.0 (see [LICENSE](LICENSE)). Vendored libraries keep their own licenses ([docs/lib/README.md](docs/lib/README.md)).
