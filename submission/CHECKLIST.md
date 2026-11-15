# Submission checklist

Owner: Tiara (TI-8, TI-9). Status on 2026-11-15, checked by Claude Code unless another name is written.

## S1-S8 (see SCOPE.md)
- [ ] S1 English everywhere (repository, app and drafts are in English; Tiara's final read pending)
- [ ] S2 Demo: max 7 slides or a video of 30 s or less, public, no login (outline ready in SLIDES_OUTLINE.md; deck pending)
- [ ] S3 Final project link public, no login: https://jacquesbelmont.github.io/lunax-fire-calendar/ (HTTP 200 without login, checked from a script; private-window test pending)
- [x] S4 NASA data resource (FIRMS) used and listed (SOURCES.md, data/PROVENANCE.md, docs/data/metadata.json)
- [ ] S5 All external data, code, text, images in References with licenses (SOURCES.md; IBGE resolved: no license stated, portal terms recorded, FACT_CHECK open item 2; check the references of the final deck)
- [ ] S6 AI use declared (README, PROJECT_PAGE.md, app footer, docs/data/metadata.json `ai_use`); no AI images or NASA logos; open: team confirms the sentence about the solution idea (FACT_CHECK open item 4)
- [ ] S7 No images, video or audio of people under 18 (the app has none; check the final deck)
- [ ] S8 All 3 members in the same Local Event and in the Members tab; Submit for Judging before the deadline (target 22:00, hard 23:59 America/Porto_Velho)

## Automated link check (2026-11-15, script with curl, no login)
34 links from PROJECT_PAGE.md, SLIDES_OUTLINE.md, README.md, SOURCES.md and HOW_IT_WORKS.md: 32 answered 200. Two did not:
- https://firms.modaps.eosdis.nasa.gov/data/country/ answers 404 (a folder without a listing; the files inside it work). The project page uses https://firms.modaps.eosdis.nasa.gov/country/ instead.
- https://www.ibge.gov.br answers 403 to a script (it may still open in a browser): it was only used in the IBGE license item, now resolved (FACT_CHECK open item 2).
`http://localhost:8000` in README.md is a local address on purpose.

## Data files published with the app (checked by URL, 2026-11-15)
The page, scripts, docs/data/metadata.json, monthly_cells.csv, hotspots/index.json, a hotspot file and the libraries answer 200.

## Test checklist (TI-8): a person must do these
- [ ] Private/incognito window: the app link and every link on the project page open without login
- [ ] Another computer
- [ ] A phone (the layout is built for narrow screens; not tested by Claude Code)
- [ ] In each: draw a rectangle, check the calendar, the month-vs-median chart, "Count the hotspots", and the downloads (two CSV, hotspot CSV, two PNG)
- [ ] Check the dark mode and the light mode (chart text readable)
