# How it works (plain English)

Written for: people who use the LUNAX Fire Calendar app (early-warning and emergency staff, scientists, land managers, firefighters). Source of every statement: method/METHOD.md and method/VALIDATION.md (numbers) and method/FIRMS_REFERENCE.md. The app's "How it works and limitations" section shows a short version (from docs/data/metadata.json) and links to method/METHOD.md and method/VALIDATION.md.

## What the calendar shows
The calendar shows how many fire hotspots satellites detected in the area you choose, month by month, from November 2000 to October 2026. Each cell is one month. A darker color means more hotspots. The bars on top give the median of each month (the shape of the season); the bars on the right give the total of each year that has all 12 months of data. The red outlines mark each year's fire season (start to end, with a dot on the peak). The switch "Compared with the usual" colors each month against the median of the same month in earlier years. Click a month to make it the focus of the whole page: the map, the comparison, the outlook and the summary cards at the top follow it. You can draw a rectangle on the map (or type its limits), choose a period, and compare one calendar month with the median of the same month in earlier years.

## Fire season, "usual" and municipalities
- **Fire season (section 3):** for each year, the start is the month in which 10% of that year's hotspots had been detected, the end is the month in which 90% had been, and the peak is the month with the most hotspots. A year with missing months is shown only if the missing months cannot change the answer. For the whole state, the typical season runs from August to October with the peak in September; it started in July in 4 of 23 years and ended in November in 1 (2022). This is our convention, chosen with the data: January to April hold almost no hotspots, and the central 80% ignores a few scattered detections.
- **Compared with the usual (map view):** each grid cell is compared with its usual value, the median of the same month in its earlier years. "Near usual" means the difference is small enough to be chance (about two standard deviations of a random count). Otherwise the cell is above or below usual, "2 times usual or more", or "half of usual or less".
- **Municipalities:** you can choose one of the 52 municipalities of Rondônia (IBGE boundaries). Its numbers come from the detections inside its boundary, with the same conversion as the rest of the app, so the 52 municipalities add up to the state total. A table ranks the municipalities for the month shown on the map.
- **Places that burn year after year (map view):** cells of about 1 km colored by the number of years, of 13 (2012 to 2025 without 2023, when the satellite missed days in the season), in which VIIRS detected fire there. This is history, not a forecast: we tested it before looking, and the places that burned in most years of 2012-2021 held only 11.8% of the 2022, 2024 and 2025 detections, little more than any cells of the same number (10%). The places that burned most in the previous year held 28.0%, so last year's fires were a better guide for the next season.
- **Outlook for the next fire season (experimental, section 4):** how many hotspots to expect in August-October next year. We tested three ways on 13 past seasons of the 52 municipalities, each year forecast only from earlier years, with the rules written down before looking. The previous year's August-October won: a typical miss by a factor of 1.5, against 2.2 for the median of earlier years. Using January-July of the same year improved it by only 9.8%, less than the 10% we required, so the outlook is not updated during the year. The range shown is where 80% of the area's past seasons fell for such a forecast. It says how much fire to expect, not where, and it can miss badly in an unusual year: it expected far more than happened in 2025.
- **Where to expect fire next season (experimental, map views):** the chance that each cell has at least one satellite detection between January and October of next year. It is computed from the cell's own past (last year, recent years), its neighbours (fire fronts move) and the long harmonized record of its area. We tested a statistical model (logistic regression) and a machine-learning model (gradient boosting) on eight past seasons, each forecast only from earlier years, with the rules fixed before looking. At about 1 km the statistical model won: the 10% of cells with the highest chance held 57.1% of the next year's detections, against 52.8% for last year's busiest cells (63.7% against 45.4% in 2026); machine learning was not clearly better. At about 5 km neither model beat last year's fire, so that map shows last year's fire. The chances run a little high (cells given about 45% burned in about 40% of cases). A point cannot be forecast: most fires are lit by people on a day no record can know.
- **Field use:** the hotspot list can be downloaded as KML for Google Earth, Avenza Maps or QGIS, the "Print a briefing" button prints the page without the controls, and a link opens the NASA FIRMS Fire Map on your area for today's fires (this app shows history, not live data).

## What is a hotspot?
A hotspot is a satellite detection: the centre of a pixel where the sensor sees heat from one or more fires. It is not the exact place or size of a fire, and it does not measure burned area. Clouds, thick smoke and tree cover can hide fires, so a month with few hotspots does not prove there was no fire.

## Why the data needed to be harmonized
NASA's FIRMS archive has hotspots from two kinds of sensors:
- **MODIS**, with 1 km pixels, from 2000 (Terra) and 2002 (Aqua);
- **VIIRS**, with 375 m pixels, from 2012 (Suomi NPP), 2018 (NOAA-20) and 2024 (NOAA-21).

VIIRS has finer pixels, and it counts more hotspots. On the same area in 2012 to 2014, VIIRS counted about 3.8 times more than MODIS. Putting the raw numbers side by side would show a false jump in 2012. MODIS is being retired, and VIIRS continues, so we express the whole series on the VIIRS scale.

## How we did it
- **From February 2012**, the number you see is what VIIRS observed.
- **From November 2000 to January 2012**, there was no VIIRS. We take the MODIS count and multiply it by a ratio for that month of the year. The ratios come from the years 2015 to 2025, when both sensors saw the same area. These months are **estimates**, and the calendar marks them ("est.", and a dashed line).
- We only count hotspots inside the official boundary of Rondônia (IBGE) and keep the ones classified as presumed vegetation fire.

## How we checked it
We pretended not to know the VIIRS numbers of 2012 to 2014, predicted them from MODIS, and compared with the real VIIRS numbers. The predicted total was within 0.6% of the real one. The two VIIRS satellites we use, Suomi NPP and NOAA-20, agree closely (their totals differ by less than 1%). NOAA-21 counts about 4% fewer hotspots than NOAA-20 (21 months compared), so the app shows it on its own as a check, and it is not used in the series.

## What the grey cells and the intervals mean
- **Grey cell:** no data for that month, because a satellite was missing at least one day. It is never shown as zero fire.
- **Interval:** for estimated months, the hover text shows a 90% interval. In our test the intervals covered about 85% of the real monthly totals, so they are a little narrower than the label says.

## Limits you should know
- The estimated months (2000 to January 2012) cannot be checked against VIIRS, because it did not exist yet. Months with Terra only (before Aqua started, and when Aqua had gaps) are less accurate.
- The years 2003 to 2007 and 2010 had more MODIS detections than any year used to fit the ratios, so their estimates go beyond what we could test.
- Small fires are under-counted in estimated months.
- The data are archived FIRMS data and end on 2026-10-31, the last complete month when we downloaded them. The "latest month" is October 2026, not the current month.
- The most recent months (August to October 2026 for VIIRS, September and October 2026 for MODIS) are near real-time data, marked "prov." in the calendar. FIRMS replaces them later with final data, so their values can still change.
- The ratios are fitted for Rondônia only.
- The grid cells are about 27 x 27 km (0.25°). The map points show each detection at its own pixel (375 m for VIIRS, 1 km for MODIS), but the harmonized counts are not a 375 m map: "VIIRS scale" means as many hotspots as VIIRS would detect.
- Fire season months are whole months, because the data are monthly.
- Do not use this tool for the preservation of life or property.

## Credits
We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance) and NASA's Earth Science Data and Information System (ESDIS). This tool is not an official NASA product.
