# LUNAX Fire Calendar

NASA Space Apps Challenge 2026 — "Harmonization of MODIS and VIIRS Hot Spots" — team LUNAX.
A web app showing a monthly burning-activity calendar built on a harmonized NASA FIRMS MODIS + VIIRS hotspot series.

Data: NASA FIRMS (https://www.earthdata.nasa.gov/data/tools/firms). No NASA logos are used; no endorsement implied.

## Status (2026-11-15)
- **Published:** https://jacquesbelmont.github.io/lunax-fire-calendar/ (GitHub Pages from `main`, folder `/docs`).
- **What the app does.** Draw a rectangle or enter coordinates to select whole 0.25-degree cells by their centres. Counts use detections inside the IBGE boundary of Rondônia. Explore a monthly calendar of harmonized hotspot counts, compare a month with its historical median or inspect one satellite at a time. The map shows one month (the month of the comparison, or a month clicked in the calendar): the selected cells are colored by that month (same values and colors as the calendar; grey = no data) and the detections of that month are points by sensor, grouped until zoomed in. Download the charts as PNGs. The monthly series, per-cell values and hotspot list are CSVs with the FIRMS acknowledgment and data cut-off date.
- **Connected analysis view (DE-30).** Three summary cards (focus month, fire season, next season outlook) sit above the map. The calendar has margins (median of each month, total of each complete year), shows each year's fire season and can be colored "Compared with the usual". One focus month links the page: a click on the calendar or on a comparison bar moves the map, the comparison, the outlook highlight and the cards.
- **For fire managers (DE-22 to DE-25).** Choose one of the 52 municipalities of Rondônia (IBGE) instead of a rectangle: its own series comes from the detections inside its boundary. The fire season section gives, for each year, the months in which 10% and 90% of the year's hotspots were reached and the peak month; for the whole state the typical season is August to October with the peak in September. The map can show each cell "Compared with the usual" (the median of the same month in its earlier years), and a table ranks the municipalities for the map month. The hotspot list also downloads as KML (Google Earth, Avenza, QGIS), a button prints a briefing, and a link opens the NASA FIRMS Fire Map on the selected area for today's fires.
- **Outlook for the next fire season (DE-28, experimental; SCOPE O5).** Section 4 forecasts the August-October hotspots of the selected area for next year with the method that won a pre-registered test on the 52 municipalities (2013-2025, fresh 2026): the previous year's August-October (typical miss x1.5 against x2.2 for the median of earlier years). Run `node method/outlook_hindcast.js` before `export.py`.
- **Where to expect fire next season (DE-29, experimental; SCOPE O5).** Map views with the chance of fire per cell in 2027: at about 1 km a logistic regression that beat last year's fire in a pre-registered test (57.1% against 52.8% of the next year's detections in the top 10% of cells), at about 5 km last year's fire (no model beat it). Run `python pipeline/cell_outlook.py` after `export.py`, then `export.py` again.
- **Field tools (DE-34 to DE-37; SCOPE O7).**
  - "Copy link": the address keeps the place, area, period, month and map view.
  - "Season so far": this year's running total against the earlier years.
  - "Where to act first": municipalities ranked by expected fire next season, from the forecast per cell.
  - "Fire events": VIIRS detections at most 1 km and 1 day apart, grouped as likely the same fire.
  - "Your area": upload a GeoJSON or KML polygon (it stays in the browser) and get its own harmonized series.
- **Places that burn year after year (DE-26).** A map view of 0.01° cells (about 1.1 km) with the number of years, of 13, with a VIIRS detection. Its pre-registered test showed that it describes the past and does not predict the next years better than the previous year's fires (11.8% against 28.0% of the 2022, 2024 and 2025 detections), and the app says so.
- **Data.** The archived NASA FIRMS record for Rondônia runs from 2000-11 to 2026-10, with a cut-off of 2026-10-31. It uses standard country CSVs for 2000-2025 and the FIRMS area API for NOAA-21 from 2024 and for 2026. Near real-time data are marked provisional: August to October 2026 for VIIRS and September to October for MODIS.
- **Method.** Available MODIS-only counts (2000-11 to 2012-01) are converted to the VIIRS 375 m scale with ratios fitted on the 2015-2025 overlap. The 2012-2014 backcast gave a median absolute percentage error of 13.3% for monthly statewide totals and a +0.6% bias in the combined statewide total. VIIRS continuity ratios are 0.992 for NOAA-20/S-NPP (83 months) and 0.956 for NOAA-21/NOAA-20 (21 months). See [method/METHOD.md](method/METHOD.md), [method/VALIDATION.md](method/VALIDATION.md) and [method/DECISIONS.md](method/DECISIONS.md).
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
   # one instrument-year at a time (MODIS 2000-2025, VIIRS S-NPP 2012-2025, NOAA-20 2018-2025);
   # Area API data with --route api: viirs-jpss2 (NOAA-21) in 2024-2025, and all four source families in 2026.
   # Those families cover MODIS on Terra and Aqua, and VIIRS on S-NPP, NOAA-20 and NOAA-21.
   python pipeline/clean.py --source modis --year 2005 --bbox -67 -13.75 -59.75 -7.75 --check
   python pipeline/aggregate.py --check
   python pipeline/harmonize.py --check
   python pipeline/validate.py           # writes method/results/ and method/figures/ (about 1.5 min)
   python pipeline/download.py --ibge-municipalities   # once: IBGE municipal boundaries into config/ (DE-24)
   python pipeline/validate.py --recurrence   # DE-26 hindcast (method/results/recurrence_hindcast.json), before export.py
   node method/outlook_hindcast.js            # DE-28 test (method/results/outlook_hindcast.json), reads docs/data/municipalities.csv
   python pipeline/cell_outlook.py            # DE-29 test and 2027 chances per cell (about 1.5 min), reads docs/data/monthly_cells.csv
   python pipeline/export.py --check          # again, to copy the DE-28 and DE-29 results into docs/data
   python pipeline/export.py --check     # writes docs/data/ (needs validate.py's calibration)
   python method/tests/make_expected.py  # writes method/tests/expected.json for the app tests (JA-8)
   ```
   - Disk: the raw FIRMS files of Brazil and Bolivia for 2000-2025 are about 3.9 GB (`clean.py` also reads them gzip-compressed, about 0.8 GB); the cleaned files are about 40 MB.
4. Local preview of the app:
   ```
   python3 -m http.server 8000 --directory docs
   ```
   then open http://localhost:8000 (opening `index.html` via `file://` will not load data).
5. Brazil pilot (local only, after the submission; SCOPE O6): every state with Rondônia's features and its own forecasts, a place search, a breadcrumb and a place switcher in the map. See [method/PILOT_BRAZIL.md](method/PILOT_BRAZIL.md).

## AI use
Claude and Claude Code (Anthropic) assisted with code, comparisons of method options, analysis and documentation. Codex (OpenAI) reviewed the app and helped revise the app, tests and submission materials. [AI_USE.md](AI_USE.md) records the work. The `ai_use` field in `docs/data/metadata.json` describes the assistance used when producing the data. The deck uses real app screenshots and pipeline figures.
The team chose the challenge and the goal; the target scale (VIIRS-equivalent) was proposed by Rafael and agreed by the team; the demo area (Rondônia) was chosen by the team. For the method decisions an AI assistant drafted options with pros and cons, the team chose among them, and the harmonization method was selected by a validation test fixed before the results were seen. Who chose each decision: [method/DECISIONS.md](method/DECISIONS.md).

## License
Apache-2.0 (see [LICENSE](LICENSE)). Vendored libraries keep their own licenses ([docs/lib/README.md](docs/lib/README.md)).
