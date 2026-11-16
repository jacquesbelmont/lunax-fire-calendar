# SCOPE

Every piece of work in this repository must be traceable to one of the IDs below.
Owner of this file: Tiara (TI-2). Status values: `todo` / `in progress` / `done` / `verified`.
Evidence: link to a file, PR or screenshot. "verified" = tested on the published app (browser test or screenshots) on 2026-11-15; "done" = implemented and documented but not tested by a person or script end to end.

## Core (challenge statement)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| R1 | Web application. | verified | Published at https://jacquesbelmont.github.io/lunax-fire-calendar/ (PR #37 and later); browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed; screenshots in submission/screenshots/ (desktop light and dark, 375 px) |
| R2 | Harmonize NASA FIRMS MODIS and VIIRS active-fire hotspots into one consistent time series, from the early 2000s to the present, so that the sensor of origin no longer matters. | done | 2000-11 to 2026-10 on the VIIRS scale (PRs #28-#34, #41); backcast bias +0.6% (method/results/validation_metrics.json); NOAA-21 checked (0.956); August to October 2026 provisional (NRT). Not marked verified: the 2026 and NOAA-21 API downloads were not reproduced independently (they need a MAP_KEY) |
| R3 | Burning activity calendar of hotspot counts built on the harmonized dataset. | verified | Calendar month x year on the harmonized data (docs/js/calendar.js); drawn in the browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed; screenshots in submission/screenshots/ (desktop light and dark, 375 px) |
| R4 | User selects an area of interest. | verified | Area by rectangle or coordinates (docs/js/map.js); typing a 2x2 degree square selected 46 cells, as in method/tests/expected.json (browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed). Drawing with the mouse not tested by script; DE-24 (PR RA-7, not yet published): choose one of the 52 IBGE municipalities; its own series from the detections inside its boundary (municipal sums equal the area in every month: pipeline/export.py --check, tests/test_pipeline.py); local browser test 2026-11-15 |
| R5 | Users can examine historical fire patterns, unusual conditions and critical periods. | done | Calendar, month-vs-median chart and anomaly (PR #37); "critical periods" are read from the calendar colours; no separate alert. Map (DE-21): cells and detections of one month, a click on a calendar month shows it; DE-22 (PR RA-7): map view "Compared with the usual" (each cell against the median of the same month in its earlier years) and a municipal ranking of the map month; DE-23: fire season start, peak and end month per year (section 3; tests/js/calc.test.js); local browser test 2026-11-15; DE-26 (PR RA-8, issue #58): map view "Places that burn year after year" in 0.01° cells (VIIRS 2012-2025 without 2023); its pre-registered test showed it is history, not a forecast (11.8 % of the 2022, 2024 and 2025 detections against 28.0 % for the previous year's cells; method/results/recurrence_hindcast.json), and the app says so |

## Described in the challenge objectives/background

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| R6 | Show which months of the year and which years have more burning activity. | verified | Month x year calendar with colour ramp (screenshots in submission/screenshots/ (desktop light and dark, 375 px)) |
| R7 | Compare the current month with the historical median for the selected area; show how current activity compares with previous periods. | verified | Latest month (2026-10, provisional) vs the median of earlier years, with difference and ratio; the sentence says it is provisional (PR #44); values reproduce method/tests/expected.json (tests/js/calc.test.js); text checked in the browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed. Data end on 2026-10-31, so this is the latest month of the data, not the current calendar month |
| R8 | Select a date range and download analytics and visualizations. | verified | Period selector, monthly series CSV, values-per-cell CSV, calendar PNG and chart PNG: all exercised in the browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed |
| R9 | Download a CSV of the hotspots found in the search. | verified | Hotspot list (docs/data/hotspots/, 54 files): row count per sensor shown before the download (7,051 rows for a 2x2 degree square in 2025: detections of each sensor, not a harmonized count), CSV with FIRMS acknowledgment and cut-off date (browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed). Limit: over 1,000,000 matching rows the app asks for a smaller area or period; DE-25 (PR RA-7): the same rows also as KML, with the FIRMS acknowledgment and cut-off date (tests/js/hotspots.test.js, local browser test) |
| R10 | Color ramps showing differences in hotspot counts across months. | verified | Viridis ramp in the calendar (screenshots in submission/screenshots/ (desktop light and dark, 375 px)) |

## Optional ("potential considerations")

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| O1 | Draw the area on a map or enter latitude/longitude. | verified | Coordinates typed and applied in the browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed; rectangle drawing tool present on the map |
| O2 | Accessible color ramps. | in progress | Viridis ramp, grey for no data, visible focus and dark-mode text; no color-vision test done yet (FACT_CHECK open item 5) |
| O3 | A few key indices: anomalies against multi-year averages; number of fires detected. | verified | Anomaly (difference and ratio) vs the historical median and hotspot counts, shown in the app (browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed); DE-22: per-cell anomaly classes on the map (PR RA-7) |
| O4 | Audience: early warning and emergency responders, scientists, land managers, firefighters. | in progress | Plain-English text for the app audience in method/HOW_IT_WORKS.md; to be checked by Tiara; PR RA-7 for fire managers: fire season by year (DE-23), "Compared with the usual" map and municipal ranking (DE-22, DE-24), print a briefing, KML for Google Earth/Avenza/QGIS and a link to the FIRMS Fire Map for today's fires (DE-25) |
| O5 | Experimental outlook for the next fire season (not in the challenge text; proposed by Rafael; moved into scope by Jacques's decision when merging PR #63 on 2026-11-15). | in progress | DE-28 (PROPOSED): pre-registered rolling-origin test on 52 municipalities, 2013-2025 and fresh 2026 (method/results/outlook_hindcast.json): the previous year's August-October (MALE 0.430, 2026: 0.773) beat the median of earlier years (0.767, 2026: 2.459); the January-July update was 9.8 % better, short of the 10 % required, so it is not used. App section 4 (docs/js/outlook.js), local browser test 2026-11-15; DE-29 (PROPOSED): where to expect fire next season, per cell: at about 1 km logistic regression shown (10 % of cells held 57.1 % of the test years' detections against 52.8 % for last year's cells; 2026: 63.7 % against 45.4 %; gradient boosting not clearly better), at about 5 km last year's fire shown (models did not beat it: 51.4 % against 54.1 %); method/results/cell_outlook_hindcast.json; map views; local browser test 2026-11-15 |
| O6 | The same features for every Brazilian state (27 states, municipalities, ratios, recurrence and forecasts per state, place switcher), as a local pilot; also the new toolbar for every area (period chips, Download menu). Not in the challenge text; asked by Rafael; moved into scope by Jacques's decision when merging PR #70 on 2026-11-15. Brazil is not the whole planet, which stays out of scope. | in progress | DE-31 to DE-33 (method/DECISIONS.md), method/PILOT_BRAZIL.md, method/results/pilot_brazil.json, tests/e2e/brazil_packs.mjs (skipped without the packs). The pilot data (about 0.8 GB) are not published: the published app shows only Rondônia, with the new toolbar. Hosting all of Brazil is not decided |

## Submission (2026 Project Submission Guide)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| S1 | English on the project page and in all linked materials (a demo video may use another language only with English subtitles). | in progress | All repository text, the app and the drafts in submission/ are in English; final check by Tiara |
| S2 | Demo: max 7 slides including title/intro, or a video of 30 s or less; public link, no login. Slides include team name, member names, challenge, an image of the project, the user experience, and how NASA data makes the solution possible. | in progress | Outline in submission/SLIDES_OUTLINE.md; the deck and screenshots are still to be made |
| S3 | Final project link public, no login. | verified | https://jacquesbelmont.github.io/lunax-fire-calendar/ and the deck PDF answer without login: HTTP 200 and a fresh browser profile in the browser test tests/e2e/app_smoke.mjs on the published site, 2026-11-15: 13/13 passed. Another computer and a real phone: TI-8 |
| S4 | At least one NASA data resource from the challenge Resources tab used and listed (FIRMS). | verified | FIRMS data used by the pipeline and listed in SOURCES.md, data/PROVENANCE.md, docs/data/metadata.json and the project page; FIRMS acknowledgment checked in the downloaded CSV files by the browser test |
| S5 | All external data, code, text and images listed in References, with licenses. | in progress | SOURCES.md: FIRMS (open data policy and acknowledgment), MODIS/VIIRS user guides, CAMS, Schroeder et al. 2014, libraries with licenses (leaflet-draw text added in docs/lib/), Python package licenses; IBGE boundary: the portal terms (v1, 2024-03-11) state no data license; source recorded in the data files and credited in the app footer |
| S6 | AI ("SI") use declared: where and how; visible watermark on AI-generated images/video; AI-generated code and data acknowledged in text and metadata; no NASA logos, flags or mission identifiers in generated content; AI not used to come up with the solution idea. | in progress | AI_USE.md rows for every AI-assisted step; AI-assisted code marked in file headers; AI statement in the app footer, submission/PROJECT_PAGE.md and docs/data/metadata.json (`ai_use`, PR with export.py change). The sentence about the solution idea needs the team's confirmation (FACT_CHECK open item 4) |
| S7 | No images, video or audio of people under 18. | done | No photos, video or audio of people in the app, the screenshots or the draft deck (docs/demo/LUNAX_Fire_Calendar_slides.pdf); Tiara confirms the final deck |
| S8 | All 3 members in the same Local Event and in the Members tab; "Submit for Judging" before the deadline. | todo | Only the members can do this on the Space Apps site (issues TI-1, TI-9) |

## Out of scope (do not build)

- Forecasting or probabilistic critical windows. **Changed 2026-11-15 (DE-28, PR #63, Jacques's decision at merge):** no longer out of scope as an experimental outlook of the next season's August-October hotspots, shown only with the method that won a pre-registered test (O5 below).
- Comparisons with non-NASA fire databases.
- Rainfall data.
- HLS / Prithvi.
- Processing the whole planet.
- An in-app chatbot or LLM.
- Live FIRMS API calls from the browser (would expose the MAP_KEY).

## Clarifications

Official clarifications and advisory notes collected from Space Apps Connect and NASA pages.
All URLs are also listed in [SOURCES.md](SOURCES.md).

### Challenge author (official)
Source: https://github.com/nasa/spaceapps/discussions/1879
- MODIS-equivalent or VIIRS-equivalent output are both acceptable if properly justified.
- The FIRMS archive is acceptable as the main source.
- Continuity should extend to NOAA-20 and NOAA-21.
- Monthly is the recommended time step for the calendar (daily is too variable; weekly only if it stays easy to read).

### GO Team (official)
- https://github.com/nasa/spaceapps/discussions/1981: no project work before Nov 14 09:00 local time; before that, only choosing the challenge, research and team formation.
- https://github.com/nasa/spaceapps/discussions/2057: the submission must state which AI tools were used and how; judges take AI use into account.

### Navigators (advisory, not official)
- https://github.com/nasa/spaceapps/discussions/2016: a single region is acceptable.
- https://github.com/nasa/spaceapps/discussions/1959: document data source, product, time period and geographic coverage.
- https://github.com/nasa/spaceapps/discussions/2125: credit FIRMS and do not use NASA logos in a way that suggests endorsement.

### FIRMS
- Delivery of new Suomi NPP data ended on 2026-11-02 (historical data stays available); recent months need NOAA-20 and NOAA-21:
  https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know
