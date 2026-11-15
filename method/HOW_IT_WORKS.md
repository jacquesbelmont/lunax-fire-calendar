# How it works (plain English)

Written for: people who use the LUNAX Fire Calendar app (early-warning and emergency staff, scientists, land managers, firefighters). Source of every statement: method/METHOD.md and method/VALIDATION.md (numbers) and method/FIRMS_REFERENCE.md. This text is in the app's "How it works" section.

## What the calendar shows
The calendar shows how many fire hotspots satellites detected in the area you choose, month by month, from November 2000 to December 2025. Each cell is one month. A darker color means more hotspots. You can draw a rectangle on the map (or type its limits), choose a period, and compare one calendar month with the median of the same month in earlier years.

## What is a hotspot?
A hotspot is a satellite detection: the centre of a pixel where the sensor sees heat from one or more fires. It is not the exact place or size of a fire, and it does not measure burned area. Clouds, thick smoke and tree cover can hide fires, so a month with few hotspots does not prove there was no fire.

## Why the data needed to be harmonized
NASA's FIRMS archive has hotspots from two kinds of sensors:
- **MODIS**, with 1 km pixels, from 2000 (Terra) and 2002 (Aqua);
- **VIIRS**, with 375 m pixels, from 2012 (Suomi NPP) and 2018 (NOAA-20).

VIIRS has finer pixels, and it counts more hotspots. On the same area in 2012 to 2014, VIIRS counted about 3.8 times more than MODIS. Putting the raw numbers side by side would show a false jump in 2012. MODIS is being retired, and VIIRS continues, so we express the whole series on the VIIRS scale.

## How we did it
- **From February 2012**, the number you see is what VIIRS observed.
- **From November 2000 to January 2012**, there was no VIIRS. We take the MODIS count and multiply it by a ratio for that month of the year. The ratios come from the years 2015 to 2025, when both sensors saw the same area. These months are **estimates**, and the calendar marks them ("est.", and a dashed line).
- We only count hotspots inside the official boundary of Rondônia (IBGE) and keep the ones classified as presumed vegetation fire.

## How we checked it
We pretended not to know the VIIRS numbers of 2012 to 2014, predicted them from MODIS, and compared with the real VIIRS numbers. The predicted total was within 0.6% of the real one. The two VIIRS satellites we use, Suomi NPP and NOAA-20, agree closely (their totals differ by less than 1%).

## What the grey cells and the intervals mean
- **Grey cell:** no data for that month, because a satellite was missing at least one day. It is never shown as zero fire.
- **Interval:** for estimated months, the hover text shows a 90% interval. In our test the intervals covered about 85% of the real monthly totals, so they are a little narrower than the label says.

## Limits you should know
- The estimated months (2000 to January 2012) cannot be checked against VIIRS, because it did not exist yet. Months with Terra only (before Aqua started, and when Aqua had gaps) are less accurate.
- The years 2003 to 2007 and 2010 had more MODIS detections than any year used to fit the ratios, so their estimates go beyond what we could test.
- Small fires are under-counted in estimated months.
- The data are archived FIRMS data and end on 2025-12-31. The "latest month" is December 2025, not the current month. 2026 and NOAA-21 are not included.
- The ratios are fitted for Rondônia only.
- Do not use this tool for the preservation of life or property.

## Credits
We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance) and NASA's Earth Science Data and Information System (ESDIS). This tool is not an official NASA product.
