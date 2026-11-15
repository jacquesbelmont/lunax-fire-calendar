# SCOPE

Every piece of work in this repository must be traceable to one of the IDs below.
Owner of this file: Tiara (TI-2). Status values: `todo` / `in progress` / `done` / `verified`.
Evidence: link to a file, PR or screenshot.

## Core (challenge statement)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| R1 | Web application. | todo | |
| R2 | Harmonize NASA FIRMS MODIS and VIIRS active-fire hotspots into one consistent time series, from the early 2000s to the present, so that the sensor of origin no longer matters. | in progress | Pipeline and validation merged (PRs #28-#34; method/METHOD.md, method/VALIDATION.md); 2000-11 to 2025-12, with NOAA-21 continuity checked via the FIRMS area API (PR #41); 2026 still to run through the API (DE-8) |
| R3 | Burning activity calendar of hotspot counts built on the harmonized dataset. | in progress | Monthly data per cell in docs/data/monthly_cells.csv (PR #31); calendar view pending (JA-5) |
| R4 | User selects an area of interest. | todo | |
| R5 | Users can examine historical fire patterns, unusual conditions and critical periods. | in progress | Data and median/anomaly rules ready (DE-13, PR #33); app views pending (JA-5, JA-6) |

## Described in the challenge objectives/background

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| R6 | Show which months of the year and which years have more burning activity. | todo | |
| R7 | Compare the current month with the historical median for the selected area; show how current activity compares with previous periods. | in progress | Rules in DE-13; reference values in method/tests/expected.json (PR #33); app pending (JA-6, JA-8) |
| R8 | Select a date range and download analytics and visualizations. | todo | |
| R9 | Download a CSV of the hotspots found in the search. | done | DE-17; `docs/data/hotspots/` (50 files, `index.json`) and the "Download hotspots (CSV)" button (PR #38); tests in tests/js/hotspots.test.js |
| R10 | Color ramps showing differences in hotspot counts across months. | todo | |

## Optional ("potential considerations")

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| O1 | Draw the area on a map or enter latitude/longitude. | todo | |
| O2 | Accessible color ramps. | todo | |
| O3 | A few key indices: anomalies against multi-year averages; number of fires detected. | in progress | Anomaly vs historical median (DE-13; median, not mean, see the DE-13 justification); values in method/tests/expected.json (PR #33) |
| O4 | Audience: early warning and emergency responders, scientists, land managers, firefighters. | todo | |

## Submission (2026 Project Submission Guide)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| S1 | English on the project page and in all linked materials (a demo video may use another language only with English subtitles). | todo | |
| S2 | Demo: max 7 slides including title/intro, or a video of 30 s or less; public link, no login. Slides include team name, member names, challenge, an image of the project, the user experience, and how NASA data makes the solution possible. | todo | |
| S3 | Final project link public, no login. | todo | |
| S4 | At least one NASA data resource from the challenge Resources tab used and listed (FIRMS). | in progress | FIRMS country CSVs used by the pipeline (PRs #28-#31); listed in SOURCES.md and docs/data/metadata.json with the exact FIRMS acknowledgment |
| S5 | All external data, code, text and images listed in References, with licenses. | in progress | SOURCES.md: FIRMS (open data policy and acknowledgment), MODIS/VIIRS user guides, CAMS, Schroeder et al. 2014, libraries with licenses (leaflet-draw text added in docs/lib/), Python package licenses; IBGE terms of use TODO(verify) (site refuses automated access) |
| S6 | AI ("SI") use declared: where and how; visible watermark on AI-generated images/video; AI-generated code and data acknowledged in text and metadata; no NASA logos, flags or mission identifiers in generated content; AI not used to come up with the solution idea. | in progress | AI_USE.md rows for every AI-assisted step; AI-assisted code marked in file headers |
| S7 | No images, video or audio of people under 18. | todo | |
| S8 | All 3 members in the same Local Event and in the Members tab; "Submit for Judging" before the deadline. | todo | |

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
