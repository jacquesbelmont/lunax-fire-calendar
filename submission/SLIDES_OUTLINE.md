# Slides outline (S2: max 7 slides including the title)

Draft deck built from this outline: `submission/slides/slides.html`, published as https://jacquesbelmont.github.io/lunax-fire-calendar/demo/LUNAX_Fire_Calendar_slides.pdf (7 pages). Tiara reviews and owns it.

Written for: Tiara, who builds the deck, and for the judges who watch it. Rules: real app screenshots and real pipeline figures only (no generated images; if one is ever added: visible watermark, no NASA logos); no people under 18; English only; public link, no login. Every number is in FACT_CHECK.md.
Screenshots must be taken by a person from the published app (https://jacquesbelmont.github.io/lunax-fire-calendar/) with the **harmonized** series selected (the default). Pipeline figures are the files in method/figures/.

## Slide 1 — Title
- **Text:** LUNAX Fire Calendar. A harmonized burning-activity calendar from NASA FIRMS MODIS and VIIRS hotspots. Challenge: Harmonization of MODIS and VIIRS Hot Spots (NASA Space Apps Challenge 2026). Team LUNAX: Jacques Belmont, Rafael Silva de Souza, Tiara (full name to be written by Tiara).
- **Image:** screenshot of the whole app page (map + calendar), harmonized series.

## Slide 2 — The problem
- **Text:** Two sensors, two scales. MODIS (1 km, since 2000) is being retired; VIIRS (375 m, since 2012) continues. On the same area in 2012-2014, VIIRS counted about 3.8 times more hotspots than MODIS: a calendar built from raw numbers would show a false jump.
- **Image:** method/figures/before_after.png (series without correction vs harmonized).

## Slide 3 — Our solution
- **Text:** One consistent monthly series on the VIIRS scale, 2000-11 to 2026-10, for Rondônia, Brazil. From 2012: observed VIIRS (Suomi NPP, then NOAA-20; NOAA-21 as a check). Before 2012: MODIS counts times a ratio per month of the year, learned where both sensors overlap (2015-2025). Both sensors are needed.
- **Image:** method/figures/backcast.png (converted MODIS vs observed VIIRS in the test years).

## Slide 4 — The user experience
- **Text:** Draw an area or type coordinates. Read the year-by-month calendar. Compare a month with the historical median. Grey = no data (never zero). Dashed line and "est." = estimated months. Download the monthly series, values per cell, hotspot list and charts.
- **Images (3 screenshots):** (1) map with a drawn rectangle and the selected cells; (2) calendar with grey cells and the dashed line; (3) the month-vs-median chart with its text.

## Slide 5 — How we know it works
- **Text:** Test fixed before seeing the results: fit on 2015-2025, predict 2012-2014 from MODIS, compare with observed VIIRS. Total within 0.6%; median error of monthly totals 13.3%; correlation 0.998. A more complex model failed the same test (bias +143%) and was not used. Suomi NPP and NOAA-20 agree (ratio of totals 0.992). Intervals: 90% interval covers 85% of monthly totals in the test.
- **Image:** method/figures/continuity.png.

## Slide 6 — How NASA data makes it possible, and the limits
- **Text:** NASA FIRMS is the only data used: MODIS (Terra, Aqua) and VIIRS (Suomi NPP, NOAA-20, NOAA-21) active-fire detections: Brazil and Bolivia country files (standard processing, 2000-11-01 to 2025-12-31) and the FIRMS area API for NOAA-21 and 2026 (to 2026-10-31), clipped to the IBGE boundary of Rondônia. Limits: 2000-11 to 2012-01 are estimates; Terra-only months are less accurate; data end on 2026-10-31 and the last months (near real-time) are provisional; hotspots are not fires.
- **Image:** screenshot of the footer with the FIRMS acknowledgment and the "Archived data through 2026-10-31" label.

## Slide 7 — AI use, credits, references
- **Text:** AI use (from AI_USE.md): Claude and Claude Code for code, option analysis and documentation, logged step by step; decisions made by the team and recorded in method/DECISIONS.md; no AI-generated images, video or audio. Credits: FIRMS acknowledgment text (exact, from docs/data/metadata.json); IBGE; CAMS; Schroeder et al. 2014; Leaflet, Leaflet.draw, Plotly.js, OpenStreetMap, Python libraries (licenses in SOURCES.md). Links: app, repository.
- **Image:** QR code or link of the app (any QR image must be generated from the real link, not an AI image).

## Before publishing the slides
- Check S2: team name, member names, challenge, an image of the project, the user experience, how NASA data makes the solution possible: slides 1, 4 and 6.
- Do not use NASA logos. Do not use photos of people under 18 (S7).
- Set the link to public with no login and test it in a private window (TI-8).
