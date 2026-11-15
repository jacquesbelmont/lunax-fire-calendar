# FIRMS_REFERENCE.md — verified facts for the LUNAX project

NASA Space Apps Challenge 2026 · "Harmonization of MODIS and VIIRS Hot Spots" · Team LUNAX

- Verified on 2026-11-14 by reading the sources in section 15 and by inspecting real FIRMS files (section 4).
- Compiled with AI assistance (Claude) and to be reviewed by the team. Log this in AI_USE.md.
- Rule for people and AI agents: every fact below has a source. Anything that is not here or in an
  official URL is `TODO(verify)`. Method choices are team decisions and live in `method/DECISIONS.md`.

---

## 1. What the challenge asks

Sources: challenge page (Details + Resources tabs), challenge video by the author (Marina Compagnucci,
CONAE), Space Apps Connect threads.

- **Goal:** a web application with a burning activity calendar based on active fire hotspots, built on
  MODIS and VIIRS records harmonized into one consistent time series, from the early 2000s to the
  present, for a selected area of interest. (challenge page)
- **Two parts:**
  1. Harmonize MODIS and VIIRS hotspots so that the sensor of origin no longer matters and the focus
     moves to patterns, trends and anomalies. (page, video)
  2. A web app that takes the harmonized hotspots as input. The user selects a region and a date range
     (page) or "a specific day, a particular region" (video) and sees fire activity history and
     analytics; analytics and visualizations can be downloaded. (page, video)
- **Calendar content:** number of hotspots; which months and which years have more burning activity;
  the current month compared with the historical median for the area; how a current fire compares with
  previous ones. Video example: how many hotspots a particular month has across different years.
- **Why it matters (video):** MODIS is retiring and is replaced by VIIRS; without a method to compare
  them, "almost 10 years of historical information will be lost".
  Interpretation (not stated in the video): this refers to the MODIS-only years before VIIRS
  (Nov 2000 to Jan 2012, see section 2).
- **Optional (page, "potential considerations"):** draw the area on a map or enter latitude/longitude;
  accessible color ramps; a few key indices (anomalies against multi-year averages; number of fires
  detected); a downloadable CSV of the hotspots found in a search.
- **Only resource in the Resources tab:** NASA FIRMS (https://www.earthdata.nasa.gov/data/tools/firms).
- **Challenge author answers** (https://github.com/nasa/spaceapps/discussions/1879):
  MODIS-equivalent or VIIRS-equivalent output are both fine "if properly justified"; the FIRMS archive
  is acceptable as the main source; solutions should continue with NOAA-20 and NOAA-21; a monthly time
  step "seems like a solid approach" (daily is too variable; weekly only if feasible and still easy to
  read).
- **GO Team rules:** no project work before Nov 14 09:00 local time (discussions/1981); the submission
  must say which AI tools were used and how, and judges take AI use into account (discussions/2057).
- **Navigators (advisory, not official):** a single region is acceptable (discussions/2016); document
  data source, product, time period and geographic coverage (discussions/1959); linking to the FIRMS
  live map is fine if labeled as an external NASA site, FIRMS is credited, and NASA logos are not used
  in a way that suggests endorsement (discussions/2125).

## 2. Sensors, satellites and coverage

| Sensor | Satellite | Pixel | Coverage in FIRMS | Source |
|---|---|---|---|---|
| MODIS C6.1 | Terra | 1 km | from November 2000 | active_fire page |
| MODIS C6.1 | Aqua | 1 km | from July 2002 | active_fire page |
| VIIRS 375 m | Suomi NPP | 375 m | from 2012-01-20; new data ended 2026-11-02 13:00 UTC; history stays available | download page; FIRMS blog |
| VIIRS 375 m | NOAA-20 (JPSS-1) | 375 m | from 2018-04-01 | active_fire and download pages |
| VIIRS 375 m | NOAA-21 (JPSS-2) | 375 m | from 2024-01-17 | active_fire and download pages |
| Landsat OLI | 8/9 | 30 m | from 2022-06-20; API source is US/Canada only (out of scope) | active_fire page; API page |

**Overpass times (FIRMS FAQ):** Terra crosses the equator at about 10:30 a.m./p.m. mean local time;
Aqua at about 1:30 p.m./a.m.; NOAA-20/21 pass about 50 minutes ahead of Suomi NPP; mid-latitudes get
3-4 looks a day.

**Transition (FIRMS blog, Oct 27 2026):** NOAA-20 and NOAA-21 carry the same VIIRS sensor as Suomi NPP,
fly in the same orbital plane about 50 minutes apart, and are the recommended replacements. MODIS Aqua
has an afternoon time similar to Suomi NPP, NOAA-20 and NOAA-21; MODIS Terra provides the only morning
overpass. API users should switch from VIIRS_SNPP_NRT/SP to VIIRS_NOAA20_NRT or VIIRS_NOAA21_NRT.

**MODIS end of mission (CAMS article):** NASA plans to end data collection for Terra MODIS in
January 2027 and for Aqua MODIS around September 2027.

**Sensor eras** (derived from the coverage dates above; not an official table):

| Period | Satellites with active fire data |
|---|---|
| Nov 2000 - Jun 2002 | Terra (MODIS) only |
| Jul 2002 - Jan 2012 | Terra + Aqua (MODIS) |
| Jan 2012 - Mar 2018 | + Suomi NPP (VIIRS) |
| Apr 2018 - Jan 2024 | + NOAA-20 (VIIRS) |
| Jan 2024 - Nov 2026 | + NOAA-21 (VIIRS) |
| from 2026-11-02 | Suomi NPP stops delivering new data |

## 3. Ways to get the data

### 3.1 Country Yearly Summary CSV (standard processing) — best fit for history

- Page: https://firms.modaps.eosdis.nasa.gov/country/ — "Dataset is based on Standard Processing (SP)".
- Instruments and years listed: MODIS 2000-2025, VIIRS Suomi NPP 2012-2025, VIIRS NOAA-20 2018-2025.
  NOAA-21 is not listed. 2026 is not listed.
- File index (filename, size in bytes, last update):
  https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt (10,144 entries on 2026-11-14).
- One file per country, year and instrument, downloadable directly without a MAP_KEY. URL pattern
  (verified with HTTP 200 and sizes matching the index for modis 2000 and 2024, viirs-snpp 2012 and
  viirs-jpss1 2018, all Brazil):
  `https://firms.modaps.eosdis.nasa.gov/data/country/<instrument>/<YYYY>/<instrument>_<YYYY>_<Country>.csv`
  with `<instrument>` = `modis`, `viirs-snpp` or `viirs-jpss1` (viirs-jpss1 = NOAA-20).
  Example: `https://firms.modaps.eosdis.nasa.gov/data/country/modis/2000/modis_2000_Brazil.csv`
  Country names use underscores, e.g. `Cote_d_Ivoire`.
- All-country zips also exist: `/data/country/zips/<modis|viirs-snpp|viirs-jpss1>_<YYYY>_all_countries.zip`;
  the server supports HTTP Range requests (verified: Accept-Ranges bytes, status 206).
- Attribute notes for these files: https://firms.modaps.eosdis.nasa.gov/data/country/AttributesReadme.txt
  ("Use the Collection / Version field to distinguish between NRT and standard data"; WGS84 lat/lon).

### 3.2 Archive Download

- https://firms.modaps.eosdis.nasa.gov/download/ — data older than the last 7 days; sign in with
  Earthdata Login or an email code; results arrive by email; SHP, CSV or JSON.
- NRT data are replaced with standard data "approximately a 5 month lag" (download page).
- The archive README (November 2026) says requests may return separate `fire_nrt_*` and
  `fire_archive_*` files, and that MODIS and VIIRS files are delivered separately.

### 3.3 API (needs a free MAP_KEY; https://firms.modaps.eosdis.nasa.gov/api/ , version 4.2.8)

- **area:** `/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]/[DATE]`
  - AREA_COORDINATES = `west,south,east,north` or `world`; DAY_RANGE = 1..5; DATE = YYYY-MM-DD
    (omit for the most recent data).
  - SOURCE: MODIS_NRT, MODIS_SP, VIIRS_SNPP_NRT, VIIRS_SNPP_SP, VIIRS_NOAA20_NRT, VIIRS_NOAA20_SP,
    VIIRS_NOAA21_NRT, VIIRS_NOAA21_SP, LANDSAT_NRT (US/Canada only).
  - Limit: 5000 transactions per 10-minute interval; larger requests may count as multiple
    transactions. Official notebook: the whole world for VIIRS can return 30,000-100,000+ records per day.
- **data_availability:** `/api/data_availability/csv/[MAP_KEY]/[SENSOR]` (SENSOR = `all` or a source);
  returns `data_id`, `min_date`, `max_date` per dataset (official notebook).
- **missing_data:** page `/api/missing_data/`; the page loads its table from
  `https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data` (JSON with HTML table rows;
  no MAP_KEY needed; 169 rows on 2026-11-14). See section 7.
- **MAP_KEY status:** `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=<key>` returns
  JSON including `current_transactions` (official notebook).
- **country / countries:** currently unavailable (outage notice on the API page). The notebook also
  says `country` is not recommended for large countries because queries may time out.
- **kml_fire_footprints:** out of scope.

### 3.4 Other channels (not for our history)

- **NRT daily text files, last two months:** https://nrt3.modaps.eosdis.nasa.gov/archive/FIRMS/
  (`modis-c6.1`, `noaa-20-viirs-c2`, `noaa-21-viirs-c2`, `landsat`), regional folders including
  `South_America` and `Global`; download needs an Earthdata Login token (`Authorization: Bearer`).
- **Active fire files:** SHP/KML/TXT for the last 24 h, 48 h and 7 days
  (https://firms.modaps.eosdis.nasa.gov/active_fire/).
- **WMS / WMS-T:** map images only; WMS-T allows a date range up to 31 days per request; updated every
  15 minutes (https://firms.modaps.eosdis.nasa.gov/mapserver/wms-info/).
- **WFS:** only 24 h and 7-day windows per region; updated every 15 minutes
  (https://firms.modaps.eosdis.nasa.gov/mapserver/wfs-info/).
- WMS, WFS and the API all need the MAP_KEY in the URL: never call them from the public app.

## 4. Real file columns (verified 2026-11-14 from Brazil country files)

**MODIS** (`modis_2000_Brazil.csv`):
```
latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
-7.7451,-34.9394,306.2,1.1,1.1,2000-11-01,0058,Terra,MODIS,67,6.2,293.3,7.6,N,0
```

**VIIRS Suomi NPP** (`viirs-snpp_2012_Brazil.csv`) and **NOAA-20** (`viirs-jpss1_2018_Brazil.csv`):
```
latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type
-12.06486,-38.01659,304.68,0.38,0.59,2012-01-20,0311,N,VIIRS,n,2,286.35,0.53,N,0
-11.09714,-37.53611,303.93,0.54,0.42,2018-04-01,0330,N20,VIIRS,n,2,291.78,0.74,N,0
```

Observed values: MODIS `satellite` = `Terra`; MODIS `version` = `6.2`; VIIRS `satellite` = `N`
(Suomi NPP) and `N20` (NOAA-20); VIIRS `confidence` = `n`; VIIRS `version` = `2`; `type` values 0 and 2
in both sensors; `acq_time` is HHMM in UTC with leading zeros (store it as text).

Differences between these files and the attribute documentation (write code against real files):
- Docs: MODIS satellite `A`/`T`. Country files: `Terra`/`Aqua`; NRT files: `T`/`A` (section 13, item 3).
- Docs: MODIS version strings for Collection 6.1. Country files: `6.2`, `6.03`, `61.03` (meaning: section 13, item 1).
- Docs: VIIRS version `1.0`/`1.0NRT`. Files: `2` (Collection 2).
- Docs list no standard-only VIIRS field. VIIRS standard files do contain `type`.

## 5. What the attributes mean

Sources: https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs and
the FIRMS FAQ.

- `latitude`, `longitude`: center of the fire pixel (MODIS 1 km, VIIRS 375 m nominal), not necessarily
  the exact fire location.
- `scan`, `track`: actual pixel size; pixels grow toward the edge of the scan.
- `acq_date`, `acq_time`: date and time of the overpass, in UTC.
- `confidence`: MODIS 0-100 % (mapped to low, nominal, high classes); VIIRS low, nominal, high.
  FAQ: use with caution, its meaning may vary by region; thresholds must be chosen empirically.
- `frp`: fire radiative power per pixel, in MW.
- `daynight`: D = day, N = night. FAQ: the NRT flag is based on the satellite orbit and differs from
  the standard method.
- `type` (standard data): 0 = presumed vegetation fire, 1 = active volcano, 2 = other static land
  source, 3 = offshore. VIIRS uses the same codes (section 13, item 2).
- NRT data do not attribute static sources or hotspot type (FAQ).
- A detection is the center of a pixel flagged as containing one or more fires; FIRMS cannot determine
  the exact location or size of the fire; several detections in a line generally mark a fire front (FAQ).
- Why a sensor may miss a fire: cloud cover, heavy smoke or tree canopy; small or cool fires; the 375 m
  algorithm tends to detect more fire pixels than the 750 m data set (FAQ).
- The FAQ does not recommend using active fire locations to estimate burned area.

## 6. Processing levels and latency

- URT and RT use direct broadcast (fastest); NRT is expedited processing; standard (SP/ML) uses fully
  processed satellite position data and removes data degraded by spacecraft maneuvers (FAQ).
- NRT location error is usually under 100 m but can reach several kilometers after maneuvers or severe
  space weather (FAQ).
- NRT within about 3 hours of observation; RT and URT are removed when NRT is processed or after 6 hours
  (API page).
- NRT is replaced by standard data "usually after 2-3 months, but possibly up to 5 months"; users doing
  scientific analysis are advised to download standard data (active_fire page). The download page says
  about 5 months. LANCE: if latency is not a primary concern, use standard products.
- The `version` field tells NRT from standard data (for example `6.1NRT` vs `6.1` in the docs).

## 7. Missing data

Standard data, missing days per satellite (from `/api/missing_data/?action=fetch_data`, 2026-11-14):

| Satellite | Missing days |
|---|---|
| Terra (MODIS) | 2001-06-16..2001-07-02; 2002-03-20..2002-03-27; 2002-04-15; 2003-12-17..2003-12-23; 2008-12-21..2008-12-22; 2016-02-19..2016-02-27; 2022-10-11..2022-10-22; 2026-01-12 |
| Aqua (MODIS) | 2002-07-30..2002-08-07; 2002-09-13; 2022-04-01..2022-04-16 |
| Suomi NPP (VIIRS) | 2012-03-25; 2022-07-27..2022-08-10; 2024-05-30..2024-06-03; 2024-07-10..2024-07-15; 2024-07-25..2024-07-28; 2024-09-26; 2024-11-03..2024-11-05; 2026-03-10..2026-03-12; 2026-04-28..2026-06-02; 2026-07-11..2026-07-16 |
| NOAA-20 (VIIRS) | 2023-07-19..2023-07-22; 2023-09-30; 2024-02-04 |

NRT missing days: NOAA-21 (VIIRS) 2024-02-27..2024-03-06. NRT gaps are shown only after the last
standard date of each satellite.

The archive README (November 2026) also lists MODIS gaps: end of June to beginning of July 2001; some
data throughout 2002; some data from mid-August 2007; part of 2009-04-21 and all of 2009-04-22; and
warns that some erroneous data may be present. The 2007 and 2009 gaps are not in the table; daily
counts do not show them as whole missing days (section 13, item 8).

The FAQ warns that the data carry no information on cloud cover or missing data: a day without
detections is not proof of zero fire.

FIRMS data alert history (seen 2026-11-14): NRT delays 2026-10-27 to 10-28; MODAPS maintenance
2026-06-15 to 06-16; FIRMS maintenance 2026-01-13 to 01-14; LANCE maintenance 2025-09-02 to 09-11.

## 8. Static thermal anomalies (STA)

Source: FIRMS "Update - Static Thermal Anomalies" video (linked from the FIRMS tutorials page).

- STAs are persistent or semi-persistent heat sources: power plants, steel and cement plants, gas
  flares, volcanoes. FIRMS chose to tag these detections, not remove them.
- Prototype 2023 global mask: Suomi NPP VIIRS monthly 2023 detections plus Terra and Aqua MODIS 2023
  detections with view angle under 30 degrees, counted on a fixed grid with an empirical threshold, then
  filtered with industrial and natural heat-source inventories (about 182,000 inventory features after
  filtering). Result: a little over 6,300 STA features.
- URT, RT and NRT detections are tagged on the fly; tagged detections go back to 2024-09-01; available
  in the Experimental tab of the FIRMS map; FIRMS plans to refresh the mask every year.
- For the historical record, the standard `type` field (section 5) is the official static-source flag.

## 9. Brazil country files (from yearly_summary_files.txt, 2026-11-14)

Uncompressed CSV size in MB per year:

- **MODIS**, 2000-2025, about 790 MB in total:
  2000:1 2001:12 2002:41 2003:43 2004:50 2005:50 2006:32 2007:55 2008:28 2009:20 2010:46 2011:21
  2012:32 2013:17 2014:25 2015:33 2016:26 2017:31 2018:18 2019:30 2020:32 2021:27 2022:29 2023:29
  2024:43 2025:19
- **VIIRS Suomi NPP**, 2012-2025, about 1,533 MB:
  2012:130 2013:69 2014:99 2015:137 2016:104 2017:123 2018:73 2019:116 2020:133 2021:106 2022:112
  2023:107 2024:154 2025:69
- **VIIRS NOAA-20**, 2018-2025, about 885 MB:
  2018:69 2019:117 2020:134 2021:107 2022:119 2023:107 2024:163 2025:70

Total about 3.2 GB for all of Brazil; a smaller area is filtered after download. The 2000 MODIS file
starts on 2000-11-01 (Terra) and is a partial year. The 2025 files were updated on 2026-10-10; the
MODIS, S-NPP and NOAA-20 Brazil files cover 2025-01-01 to 2025-12-31 (section 13, item 4).

## 10. Attribution and disclaimers to reuse

- **Acknowledgment** (FIRMS page, exact text):
  "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management
  System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time
  Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance) and NASA's Earth
  Science Data and Information System (ESDIS)."
- If FIRMS data are given to a third party (for example in our CSV download), follow the citation
  guidelines and replicate or link the disclaimer (archive README). LANCE disclaimer:
  https://www.earthdata.nasa.gov/data/projects/lance#ed-lance-disclaimer
- The FIRMS map warns: do not use for the preservation of life or property; detections have limited
  accuracy; they may come from fire, hot smoke, agriculture or other sources; cloud cover may hide fires;
  red squares approximate 1 km MODIS and 375 m VIIRS pixels; apply carefully at local scales.
- No NASA logos in a way that suggests endorsement (discussions/2125); no NASA branding in AI-generated
  content (Space Apps submission guide).

## 11. Official code examples (cite them if code is adapted)

FIRMS Fire Data Academy (https://firms.modaps.eosdis.nasa.gov/academy/), Python with pandas and requests,
runnable in Google Colab:

- API use: https://firms.modaps.eosdis.nasa.gov/content/notebooks/firms_api_use.ipynb
- Data ingest, date/time and time zones: https://firms.modaps.eosdis.nasa.gov/content/notebooks/firms_data_ingest.ipynb
- Subset by shapefile or WKT polygon: https://firms.modaps.eosdis.nasa.gov/content/notebooks/subSetDataFromShapeFileOrPolygon.ipynb

## 12. Earthdata Login (Archive Download and nrt3 files)

- Registration is free (https://urs.earthdata.nasa.gov/documentation/for_users).
- User tokens: at most two valid at a time; valid for 60 days; created with "Generate Token" on the
  profile page (https://urs.earthdata.nasa.gov/documentation/for_users/user_token).
- The nrt3 archive expects the header `Authorization: Bearer <token>`.

## 13. Open questions — TODO(verify)

1. Meaning of MODIS `version` = `6.2` in the country files.
2. VIIRS `type` codes: confirm they follow the MODIS definitions.
3. MODIS `satellite` value for Aqua, and the satellite format in API and NRT outputs.
4. Whether the 2025 country files cover the full year.
5. Archive README naming: NOAA-21 prefix written as `DL_FIRE_J2C-C2` and `J2V`, and the `J2V` NRT line
   says NOAA-20. Check against a real download.
6. The Suomi NPP announcement URL says "november-1" while FIRMS texts say November 2, 2026
   (blog: 13:00 UTC on November 2).
7. Date range of `VIIRS_NOAA21_SP` in the API: check with data_availability.
8. MODIS 2007 and 2009 gaps from the README that are missing from the table.

**Progress on 2026-11-14** (Rafael). Checked on real FIRMS country CSVs and on the FIRMS attribute page (https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs). Still to be confirmed by Tiara.
- **Item 1:** `version` values seen in the MODIS files are `6.2` (2013), `61.03` (2025) and also `6.03` in other years. None has the NRT suffix, so all are standard processing (the attribute page says NRT/RT/URT add a suffix). The meaning of the numbers is still open.
- **Item 2:** VIIRS files use the same `type` values as MODIS: 0, 2 and 3 in viirs-snpp_2013_Brazil.csv and viirs-jpss1_2025_Brazil.csv. The meaning for VIIRS is still to confirm in the documentation.
- **Item 3:** the country CSVs write `Terra` and `Aqua` in full (modis_2013_Brazil.csv, modis_2025_Brazil.csv); the attribute page says `T`/`A`. The API and NRT format is still open.
- **Item 4:** answered for MODIS and NOAA-20. modis_2025_Brazil.csv and viirs-jpss1_2025_Brazil.csv cover 2025-01-01 to 2025-12-31 with 365 distinct days. S-NPP 2025 was not checked this way.
- **Item 5:** the attribute page gives the satellite code `N21` for NOAA-21. The archive file naming is still open.
- **Additional fact, VIIRS confidence:** the attribute page says low-confidence night pixels occur only in the South Atlantic Magnetic Anomaly area (11°E to 110°W, 7°N to 55°S) and "have been removed from the NRT data distributed by FIRMS". The SP files viirs-snpp_2013_Brazil.csv and viirs-jpss1_2025_Brazil.csv have 0 such rows.

**Progress on 2026-11-15** (Rafael). Sources: the MODIS and VIIRS user guides linked from the FIRMS FAQ ("Where can I find the MODIS and VIIRS Active Fire User guides?", https://www.earthdata.nasa.gov/data/tools/firms/faq), the FIRMS public NRT files, and the country files in `data/raw/country/`. Items 1-5 and 8 are answered; 6 and 7 stay open (7 needs a MAP_KEY).
- **Item 1, MODIS `version`:** the Brazil and Bolivia country files carry `6.2` for 2000-2017, `6.03` for 2018-2022 and `61.03` for 2023-2025.
  - The MCD14ML files are named `MCD14ML.YYYYMM.CCC.VV`, where CCC is the collection and VV "the product version (currently "03") within a Collection" (MODIS C6/C6.1 Active Fire Product User's Guide 1.0, section 5.5.1, https://www.earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf).
  - Our reading: `6.03` = Collection 6, version 03; `61.03` = Collection 6.1, version 03; `6.2` most likely Collection 6, version 2. FIRMS does not document the field this way for the country files.
  - The guide (section 5.5.2) says version 3 "incorporates significantly improved typing of hot spots". If `6.2` is version 2, the 2000-2017 rows carry the older `type`. `type` ≠ 0 is at most 1.36 % of the MODIS detections inside the area in any year (2018; `method/results/cleaning_log.csv`).
- **Item 2, VIIRS `type`:** the VIIRS guide lists "0 = presumed vegetation fire, 1 = active volcano, 2 = other static land source, 3 = offshore detection (includes all detections over water)" (VIIRS Collection 2 375 m Active Fire User Guide 1.2, section 3.2.2, https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf). These are the MODIS codes.
- **Item 3, satellite in NRT files:** the FIRMS public NRT files for South America (last 24 h, downloaded 2026-11-15) write `T` and `A` (MODIS, version `6.1NRT`), `N20` and `N21` (VIIRS, version `2.0NRT`), with no `type` column:
  - https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_America_24h.csv
  - https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_24h.csv
  - https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_America_24h.csv
  - The API output itself was not checked (MAP_KEY).
- **Item 4:** S-NPP too: viirs-snpp_2025_Brazil.csv covers 2025-01-01 to 2025-12-31 with 365 distinct days.
- **Item 5:** `N21` confirmed in the NOAA-21 NRT file. The archive file naming is not checked (NOAA-21 is not used in v1).
- **Item 8, MODIS gaps of 2007 and 2009:** daily counts of modis_2007_Brazil.csv and modis_2009_Brazil.csv show no day with zero Terra or Aqua detections. On 2009-04-21 and 2009-04-22 they are Terra 87 and 88, Aqua 65 and 94, in the range of the days around them (Terra 10-115, Aqua 43-222 from 2009-04-14 to 2009-04-28). The gaps are not visible as whole missing days, so no month is flagged for them; gaps of part of a day cannot be seen this way.
- **MODIS confidence classes:** low 0 % ≤ C < 30 %, nominal 30 % ≤ C < 80 %, high 80 % ≤ C ≤ 100 % (MODIS guide, Table 11).

## 14. Decisions this reference does not make (record them in method/DECISIONS.md)

- Demo area.
- Target scale: MODIS-equivalent or VIIRS-equivalent, with justification.
- Which satellites to use in each era (for example Terra + Aqua or Aqua only; how to join Suomi NPP,
  NOAA-20 and NOAA-21).
- Which `type` values count as burning activity, and how to handle recent NRT data, which has no `type`.
- Confidence filters, day/night handling, grid and aggregation unit.
- Standard or NRT data for each period.

## 15. Sources read on 2026-11-14

- Challenge page (Details, Resources): https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/
- Challenge video: https://www.youtube.com/watch?v=tEPHsiZtuvk
- Project Submission Guide 2026: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Space Apps Connect: https://github.com/nasa/spaceapps/discussions/1879 , /1981 , /2057 , /2016 , /1959 , /2125
- FIRMS (Earthdata): https://www.earthdata.nasa.gov/data/tools/firms
- FIRMS FAQ: https://www.earthdata.nasa.gov/data/tools/firms/faq
- Attributes: https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs
- Transition blog: https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know
- LANCE: https://www.earthdata.nasa.gov/data/projects/lance and https://www.earthdata.nasa.gov/data/projects/lance/data-access-tools
- NASA data and information guidance: https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-information-guidance
- FIRMS map: https://firms.modaps.eosdis.nasa.gov/map/
- Active fire data: https://firms.modaps.eosdis.nasa.gov/active_fire/
- Archive download: https://firms.modaps.eosdis.nasa.gov/download/
- Country yearly summary: https://firms.modaps.eosdis.nasa.gov/country/
- API: https://firms.modaps.eosdis.nasa.gov/api/ (area, data_availability, missing_data pages)
- WMS: https://firms.modaps.eosdis.nasa.gov/mapserver/wms-info/
- WFS: https://firms.modaps.eosdis.nasa.gov/mapserver/wfs-info/
- Tutorials: https://firms.modaps.eosdis.nasa.gov/tutorials/
- Fire Data Academy: https://firms.modaps.eosdis.nasa.gov/academy/
- NRT archive: https://nrt3.modaps.eosdis.nasa.gov/archive/FIRMS/
- FIRMS archive README (November 2026, received with an archive download)
- STA video: https://www.youtube.com/watch?v=YETICnwRVP0
- Earthdata Login: https://urs.earthdata.nasa.gov/documentation/for_users and /for_users/user_token
- CAMS (MODIS end of mission): https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
