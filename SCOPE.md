# SCOPE

Every piece of work in this repository must be traceable to one of the IDs below.
Owner of this file: Tiara (TI-2). Status values: `todo` / `in progress` / `done` / `verified`.
Evidence: link to a file, PR or screenshot.

## Core (challenge statement)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| R1 | Web application. | done | Static app in docs/ (PR #37), published: https://jacquesbelmont.github.io/lunax-fire-calendar/ (URL answers HTTP 200; visual and device tests pending, TI-8) |
| R2 | Harmonize NASA FIRMS MODIS and VIIRS active-fire hotspots into one consistent time series, from the early 2000s to the present, so that the sensor of origin no longer matters. | in progress | Pipeline and validation merged (PRs #28-#34; method/METHOD.md, method/VALIDATION.md); 2000-11 to 2026-10, with NOAA-21 continuity checked and 2026 added via the FIRMS area API (PR #41); August to October 2026 provisional (NRT) |
| R3 | Burning activity calendar of hotspot counts built on the harmonized dataset. | done | Calendar (month x year) in the app (PR #37) on docs/data/monthly_cells.csv (PR #31) |
| R4 | User selects an area of interest. | done | Map with rectangle drawing and lat/lon inputs inside the Rondônia study area (docs/js/map.js, PR #37) |
| R5 | Users can examine historical fire patterns, unusual conditions and critical periods. | done | Calendar, month-vs-median chart and anomaly in the app (PR #37); rules DE-13. "Critical periods" are read from the calendar colors; no separate alert |

## Described in the challenge objectives/background

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| R6 | Show which months of the year and which years have more burning activity. | done | The calendar shows month x year with a color ramp (PR #37) |
| R7 | Compare the current month with the historical median for the selected area; show how current activity compares with previous periods. | done | The app compares the latest month of the data (2026-10, provisional near real-time data) with the median of earlier years (DE-13); tests reproduce method/tests/expected.json (tests/js/calc.test.js). Data end on 2026-10-31, the last complete month at download (PR #41) |
| R8 | Select a date range and download analytics and visualizations. | done | Period selector, CSV downloads and PNG of the charts (docs/js/export.js, PR #37) |
| R9 | Download a CSV of the hotspots found in the search. | done | DE-17; hotspot files docs/data/hotspots/ (54 files, `index.json`; PR #38) and the count-then-download button (PR #37); tests in tests/js/hotspots.test.js. Limit: over 1,000,000 matching rows the app asks for a smaller area or period |
| R10 | Color ramps showing differences in hotspot counts across months. | done | Viridis ramp in the calendar (docs/js/calendar.js) |

## Optional ("potential considerations")

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| O1 | Draw the area on a map or enter latitude/longitude. | done | docs/js/map.js, form in docs/index.html |
| O2 | Accessible color ramps. | in progress | Viridis ramp, grey for no data, visible focus and dark-mode text; no color-vision test done yet (FACT_CHECK open item 5) |
| O3 | A few key indices: anomalies against multi-year averages; number of fires detected. | done | Anomaly (difference and ratio) vs the historical median, and the hotspot counts, in the app (PR #37) |
| O4 | Audience: early warning and emergency responders, scientists, land managers, firefighters. | in progress | Plain-English text for the app audience in method/HOW_IT_WORKS.md; to be checked by Tiara |

## Submission (2026 Project Submission Guide)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| S1 | English on the project page and in all linked materials (a demo video may use another language only with English subtitles). | in progress | All repository text, the app and the drafts in submission/ are in English; final check by Tiara |
| S2 | Demo: max 7 slides including title/intro, or a video of 30 s or less; public link, no login. Slides include team name, member names, challenge, an image of the project, the user experience, and how NASA data makes the solution possible. | in progress | Outline in submission/SLIDES_OUTLINE.md; the deck and screenshots are still to be made |
| S3 | Final project link public, no login. | in progress | https://jacquesbelmont.github.io/lunax-fire-calendar/ answers HTTP 200 without login; private-window test pending (TI-8) |
| S4 | At least one NASA data resource from the challenge Resources tab used and listed (FIRMS). | done | FIRMS country CSVs used by the pipeline (PRs #28-#31); listed in SOURCES.md, data/PROVENANCE.md and docs/data/metadata.json with the exact FIRMS acknowledgment |
| S5 | All external data, code, text and images listed in References, with licenses. | in progress | SOURCES.md: FIRMS (open data policy and acknowledgment), MODIS/VIIRS user guides, CAMS, Schroeder et al. 2014, libraries with licenses (leaflet-draw text added in docs/lib/), Python package licenses; IBGE boundary: the portal terms (v1, 2024-03-11) state no data license; source recorded in the data files and credited in the app footer |
| S6 | AI ("SI") use declared: where and how; visible watermark on AI-generated images/video; AI-generated code and data acknowledged in text and metadata; no NASA logos, flags or mission identifiers in generated content; AI not used to come up with the solution idea. | in progress | AI_USE.md rows for every AI-assisted step; AI-assisted code marked in file headers; AI statement in the app footer, submission/PROJECT_PAGE.md and docs/data/metadata.json (`ai_use`, PR with export.py change). The sentence about the solution idea needs the team's confirmation (FACT_CHECK open item 4) |
| S7 | No images, video or audio of people under 18. | in progress | The app and the slide outline contain no photos of people; check the final deck |
| S8 | All 3 members in the same Local Event and in the Members tab; "Submit for Judging" before the deadline. | todo | Only the members can do this on the Space Apps site (issues TI-1, TI-9) |

## Out of scope (do not build)

- Forecasting or probabilistic critical windows.
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
