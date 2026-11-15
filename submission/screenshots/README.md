# App screenshots

Real screenshots of the app (published version plus the fixes of PR "JA-6 provisional label"), taken on 2026-11-15 with headless Chrome:
`app_desktop_light_full.png`, `app_desktop_dark_full.png` (1280 px), `app_mobile_375.png` (375 px, inside a 375 px frame), and crops used in the slides (`app_map_controls.png`, `app_calendar.png`, `app_compare.png`, `app_footer.png`).
They can be uploaded to the Space Apps project page (JPG, PNG or GIF up to 10 MB).

The slide 4 chart, `porto_velho_september_2025.png`, was captured from the published app with the harmonized series selected. The rectangle uses west -64.50, south -9.75, east -63.00 and north -8.25. Set the end date to 2025-09 and the comparison month to September. The app selects 33 cells and compares 309 hotspots with a median of 5,545 across 23 earlier Septembers.

`app_map_2026-10.png` (1280 px, light) shows the map of the published app after PR #52 (main at e399d26). It was taken with headless Chrome on 2026-11-15 and shows the whole study area (376 cells) and the comparison month 2026-10, which is provisional. The cells are colored by that month. The points are that month's detections, grouped per sensor. The note under the map gives the counts per satellite: Terra 209, Aqua 315, Suomi NPP 2,589, NOAA-20 2,734 and NOAA-21 2,348. The calendar value counts NOAA-20 only. The older crop `app_map_controls.png` (map before PR #51) stays because the deck PDF uses it.

PR RA-7 (DE-22 to DE-25), local build of the branch `RA-7-field-use`, headless Chrome, 2026-11-15, 1280 px, light:
`app_map_usual_2026-10.png` (map view "Compared with the usual" for the whole area, 2026-10, provisional, with its legend), `app_fire_season.png` (section 3 for the whole area: 23 years computed, typical season August to October with the peak in September) and `app_municipality_porto_velho.png` (Porto Velho, IBGE code 1100205, selected as the area: outline, cells around it for context, its detections of 2026-10).

Deck slide 4 "What a fire manager sees" (PR JA-12), published app at main 8492f81 (after PRs #55 and #61), headless Chrome, 2026-11-15, light, map or section only:
`app_porto_velho_map_2026-10.png` (1068 x 720; Porto Velho, IBGE code 1100205, selected as the area; map month 2026-10, provisional; cells and points), `app_porto_velho_fire_season.png` (fire season section for Porto Velho; removed after PR #65 moved the season into the calendar) and `app_map_recurrence_2012-2025.png` (whole area, map view "Places that burn year after year", points layer hidden, with the "not a forecast" note and the test result). The older `app_municipality_porto_velho.png` and `app_fire_season.png` were taken from a local build of PR #55.

PR JA-11 (DE-27), local build of the branch `JA-11-gibs-imagery`, headless Chrome, 2026-11-15, 1068 x 720 px (the map only), light:
`app_map_gibs_false_color_2026-10-04.png` (whole area, map month 2026-10, provisional; base layer "Satellite image of a day: false color" with the cells layer hidden; NASA GIBS NOAA-20 VIIRS bands M11-I2-I1 of 2026-10-04, the day of October 2026 with the most detections in the selection; points of that month on top).

PR RA-10 (DE-30), local build of the branch `RA-10-analysis-view`, headless Chrome, 2026-11-15, 1280 px, light, whole study area:
`app_summary_cards.png` (focus month October 2026, fire season, next season outlook) and `app_calendar_season_margins.png` (calendar with the month medians on top, the totals of complete years on the right, the fire season of each year outlined and the focus month 2026-10 outlined).

After PRs #62, #63 and #65 (published app at main cfe9db4, headless Chrome, 2026-11-15, light): `app_porto_velho_map_2026-10.png` retaken (map view panel closed) and `app_porto_velho_calendar_season.png` (calendar of Porto Velho with the fire season of each year outlined, dot = peak month, monthly medians on top, yearly totals on the right; season text: typical August to October, peak in August, median of 23 years). Both used on deck slide 4.
