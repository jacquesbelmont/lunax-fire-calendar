# Space Apps project page — drafts

Written for: the Space Apps judges and reviewers (S1: English). Every number or claim is listed in FACT_CHECK.md with its source. Nothing with TODO may be copied to the submission form: the open items are at the end of FACT_CHECK.md.

## Project name
LUNAX Fire Calendar

## Team
Team LUNAX: Jacques Belmont, Rafael Silva de Souza, Tiara (full name: to be written by Tiara; see FACT_CHECK.md, open items).

## Summary (50-200 words)
LUNAX Fire Calendar is a web app that shows how much burning happened in Rondônia, Brazil, month by month since November 2000. NASA's FIRMS archive holds fire hotspot detections from two kinds of sensors: MODIS (1 km pixels, since 2000) and VIIRS (375 m pixels, since 2012). MODIS is being retired and the two sensors count differently, so their raw numbers cannot be joined. We harmonized them: from 2012 the series uses observed VIIRS counts, and for 2000 to 2012 we convert MODIS counts to the VIIRS scale with a ratio learned where both sensors overlap. In a backward test on 2012 to 2014, the converted total was within 0.6% of what VIIRS actually observed. Users draw an area on the map, read a year-by-month calendar, compare a month with its historical median, and download monthly series and hotspot lists. Months with missing satellite data are grey, never zero, and estimated months are marked. The data are archived FIRMS data that end on 2025-12-31.

## Demo link
Slides (public, no login): to be added by Tiara when the slides are published (see SLIDES_OUTLINE.md).

## Final project link
https://jacquesbelmont.github.io/lunax-fire-calendar/ (public, no login). Source code: https://github.com/jacquesbelmont/lunax-fire-calendar

## Detailed description

**The problem.** Emergency managers, scientists and land managers need to know which months and which years have more burning, and how the present compares with the past. NASA FIRMS has two long records of active-fire hotspots, but they come from different sensors. MODIS on Terra (since November 2000) and Aqua (since July 2002) has 1 km pixels. VIIRS on Suomi NPP (since January 2012) and NOAA-20 (since April 2018) has 375 m pixels. On the same area, 2012 to 2014, VIIRS counted about 3.8 times more hotspots than MODIS. A calendar built from the raw numbers would show a false jump in 2012. MODIS is being replaced by VIIRS, so the long history would be lost without a method to compare the two.

**What we built.**
- **A harmonized monthly series on the VIIRS scale** for Rondônia, from 2000-11 to 2025-12: 376 active grid cells of 0.25 degrees and 302 months. Only detections inside the official state boundary (IBGE) are counted.
- **Both sensors are used.** From February 2012 the value is an observed VIIRS count (Suomi NPP, then NOAA-20 from April 2018). For the MODIS-only months (129 months with data) the value is the MODIS count (Terra + Aqua, or Terra alone) times a ratio for that month of the year. The ratios were learned on 2015-2025, where both sensors observe. They range from 1.45 to 4.63 for Terra + Aqua.
- **A web app** (no server, static pages): a map with the study-area boundary where the user draws a rectangle or types coordinates; a calendar with one cell per month and a color ramp (Viridis); a chart that compares one calendar month with the median of the same month in earlier years, with the difference and ratio; a period selector; a harmonized view and a view of each sensor on its own; downloads of the monthly series (CSV), the values per grid cell (CSV), the hotspot list of the selection (CSV) and the charts (PNG). Every file carries the FIRMS acknowledgment and the data cut-off date.

**How we checked the harmonization.** The method was chosen by a test fixed before the results were seen. We fitted the ratios on 2015-2025 and predicted 2012-2014 from MODIS alone, then compared with the VIIRS counts actually observed. The total was within 0.6% (median error of the monthly totals 13.3%, correlation 0.998). A more complex model that we had proposed first failed this test (bias of +143%), so the simpler ratio was selected. Suomi NPP and NOAA-20 agree with each other (ratio of totals 0.992 over 83 months). Uncertainty is shown as a 90% interval; in the test the calibrated intervals covered 85% of monthly area totals.

**What the app does not hide.** Months with missing satellite data (a satellite-month is flagged when at least one day is missing: 24 of 845) are grey and never shown as zero fire. The months from 2000-11 to 2012-01 are estimates, not observations, and are marked as such. Terra-only months are less accurate than months with Terra and Aqua. Hotspots are not fires: a detection is the centre of a pixel with at least one fire, and a month without detections does not prove there was no fire.

**Limits.** The data are archived FIRMS standard data that end on 2025-12-31, so the "latest month" in the app is December 2025, not the current month. 2026 and NOAA-21 are not included: they are only available through the FIRMS API. The ratios are specific to Rondônia and must be refitted for any other area. The tool is not an official NASA product and must not be used for the preservation of life or property.

## AI use
**Tools:** Claude and Claude Code (Anthropic).
**Where and how:**
- writing and reviewing code (data pipeline, web app, tests);
- researching and comparing options for the method decisions, and running the analyses;
- drafting the documentation and the texts of this page.

Every AI-assisted step is logged with date, person, tool and files in AI_USE.md (https://github.com/jacquesbelmont/lunax-fire-calendar/blob/main/AI_USE.md). AI-assisted code carries a header comment, and the data files record it in `docs/data/metadata.json` (`ai_use`).
**What AI did not do:** no images, video or audio were generated with AI, and no NASA logos, flags or mission identifiers are used. The decisions on the area, the target scale and the harmonization method were made by team members and are recorded with who chose in method/DECISIONS.md; the AI drafted options and ran analyses. The team confirms that the solution idea was theirs (see FACT_CHECK.md, open items: this sentence needs the team's confirmation).

## NASA data
NASA FIRMS (Fire Information for Resource Management System), the data resource of the challenge: https://www.earthdata.nasa.gov/data/tools/firms
- Product: FIRMS country yearly summary CSVs, standard processing (https://firms.modaps.eosdis.nasa.gov/country/), for Brazil and Bolivia.
- Sensors: MODIS 1 km (Terra, Aqua) and VIIRS 375 m (Suomi NPP, NOAA-20).
- Period: 2000-11-01 to 2025-12-31. Download date: 2026-11-14 (re-run on 2026-11-15).
- Also used: the FIRMS list of days with missing data (https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data).
- Geographic coverage: Rondônia, Brazil.
- Details: data/PROVENANCE.md.

## References
Full list with licenses: SOURCES.md.
- NASA FIRMS data and acknowledgment (https://www.earthdata.nasa.gov/data/tools/firms). LANCE disclaimer: https://www.earthdata.nasa.gov/data/projects/lance#ed-lance-disclaimer
- IBGE, state boundary of Rondônia (malhas API v3): https://servicodados.ibge.gov.br/api/v3/malhas/estados/11?formato=application/vnd.geo+json&qualidade=maxima
- CAMS, "Drifting away from MODIS in the CAMS Global Fire Assimilation System" (MODIS end of mission): https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
- Schroeder, Oliva, Giglio, Csiszar (2014), The New VIIRS 375 m active fire detection data product, Remote Sensing of Environment 143:85-96, doi:10.1016/j.rse.2013.12.008
- Software: Leaflet 1.9.4 (BSD-2-Clause), Leaflet.draw 1.0.4 (MIT), Plotly.js 4.3.0 (MIT), OpenStreetMap map tiles (ODbL), Python with pandas, numpy, scipy, statsmodels, matplotlib, requests, python-dotenv.
- Code license: Apache-2.0 (LICENSE).
