# Submission checklist

Owner: Tiara (TI-8, TI-9). Status on 2026-11-15, checked by Claude Code unless another name is written.

## S1-S8 (see SCOPE.md)
- [ ] S1 English everywhere (repository, app and drafts are in English; Tiara's final read pending)
- [ ] S2 Demo: max 7 slides or a video of 30 s or less, public, no login (outline ready in SLIDES_OUTLINE.md; deck pending)
- [x] S3 Final project link public, no login: https://jacquesbelmont.github.io/lunax-fire-calendar/ (HTTP 200 and a fresh browser profile, 2026-11-15; another computer and a real phone below)
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

## Visual check with headless Chrome (2026-11-15, Claude Code)
Screenshots in submission/screenshots/: desktop light, desktop dark, 375 px. Found and fixed: month names missing above the calendar, "Year" overlapping the year labels at 375 px, the comparison sentence not saying that the latest month is provisional. No horizontal overflow at 375 px; dark-mode chart text readable. Drawing a rectangle and the downloads were not exercised (no clicks in headless mode).

## Automated checks (2026-11-15, Claude Code, main at 95be928)
- [x] Unit tests: `node --test tests/js/calc.test.js tests/js/hotspots.test.js` 18 passed; `.venv/bin/python -m unittest discover -s tests` 33 passed.
- [x] Browser test on the published site: `node tests/e2e/app_smoke.mjs` (Node 22+, or `node --experimental-websocket` on Node 20; set `CHROME` on Linux) 13 passed, 0 failed (page loads, archived-data label, calendar drawn, provisional sentence, area typed as coordinates gives 46 cells, period 2025, hotspot row count per sensor shown before the download, hotspot / series / per-cell CSV with the FIRMS acknowledgment and the cut-off date, both PNG downloads start, no JavaScript errors).
- [x] Links: 42 public links in the project page, slides, README, SOURCES, HOW_IT_WORKS and the app answer 200 without login, except https://www.ibge.gov.br (403 to a script; it is only a credit link).
- [x] Deck PDF public: https://jacquesbelmont.github.io/lunax-fire-calendar/demo/LUNAX_Fire_Calendar_slides.pdf (200, application/pdf, 7 pages).

## Test checklist (TI-8): a person must do these
- [ ] Private/incognito window: the app link and every link on the project page open without login
- [ ] Another computer
- [ ] A phone (the layout is built for narrow screens; not tested by Claude Code)
- [ ] In each: draw a rectangle, check the calendar, the month-vs-median chart, "Count the hotspots", and the downloads (two CSV, hotspot CSV, two PNG)

**Step by step (10 minutes per device):**
1. Open https://jacquesbelmont.github.io/lunax-fire-calendar/ in a private window. Wait for "376 grid cells selected".
2. On the map, click the square tool (left), draw a small rectangle near Porto Velho. The cell count changes and the calendar redraws.
3. Set From = 2025-01, To = 2025-12. Click "Count the hotspots of this selection"; a number appears; click "Download hotspots (CSV)". Open the file: the first lines start with `#` and contain "We acknowledge" and "2026-10-31".
4. Click both CSV buttons and both PNG buttons; open each file.
5. On the phone: repeat steps 1-3; check that nothing is cut at the right edge.
6. Switch the phone or computer to dark mode and reload: the chart text must be readable.
7. Take one screenshot per device and attach it to issue #25.
- [ ] Check the dark mode and the light mode (chart text readable)
