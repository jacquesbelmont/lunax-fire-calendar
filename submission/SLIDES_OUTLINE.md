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

## Slide 4 — What a fire manager sees
- **Case (kept):** a rectangle near Porto Velho selects 33 grid cells. In September 2025 the app shows 309 observed hotspots against a median of 5,545 across 23 earlier Septembers: a month to check in satellite imagery and field reports.
- **Where:** a municipality as the area (IBGE boundary). Porto Velho, October 2026: 1,352 hotspots against a usual 2,076 (provisional). Image: `submission/screenshots/app_porto_velho_map_2026-10.png`.
- **When:** the calendar outlines each year's fire season (dot = peak month). In Porto Velho it typically runs from August to October, with the peak in August (median of 23 years). Image: `submission/screenshots/app_porto_velho_calendar_season.png`.
- **Where it burned before** (VIIRS, about 1 km): history, not a forecast; in the pre-registered test last year's fires were the better guide (28.0 % against 11.8 %). Image: `submission/screenshots/app_map_recurrence_2012-2025.png`.
- Numbers: FACT_CHECK.md rows 27, 33, 35 and 36. The chart `porto_velho_september_2025.png` is no longer on the slide; the case numbers stay in the text.

## Slide 5 — How we know it works
- Fit on 2015-2025 and test on 34 statewide months in 2012-2014. The Terra and Aqua conversion had 13.3% median absolute percentage error across monthly statewide totals and a +0.6% bias in the combined total. The first regression had +143% bias. NOAA-20/Suomi NPP totals had a ratio of 0.992. The nominal 90% intervals covered 85% of the monthly statewide totals.
- **Image:** method/figures/continuity.png.

## Slide 6 — How NASA data makes it possible, and the limits
- NASA FIRMS provides the detections from Brazil and Bolivia country files and the area API. IBGE supplies the Rondônia boundary and OpenStreetMap the map background. Available early months are estimates and the latest months are provisional. Grey marks missing values. Counts describe thermal detections, which can repeat for the same fire.

## Slide 7 — AI use, credits, references
- Claude and Claude Code assisted with the original code, analysis and documentation. Codex assisted with the TI-8 review and revisions. AI_USE.md records the steps and method/DECISIONS.md records the team's decisions. Include the FIRMS acknowledgment, the reference and license list and the app link.

## Before publishing the slides
- Check S2: team name, member names, challenge, an image of the project, the user experience, how NASA data makes the solution possible: slides 1, 4 and 6 (slide 4 is now "What a fire manager sees").
- Do not use NASA logos. Do not use photos of people under 18 (S7).
- Set the link to public with no login and test it in a private window (TI-8).
