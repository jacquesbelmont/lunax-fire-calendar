# Brazil pilot, 2000–2026 (RA-11, issue #66)

After the hackathon submission. It changes nothing in the published app or in `docs/data`; the app shows Brazil only when the local data are served next to it.
- **Numbers:** `method/results/pilot_brazil.json`, `state_ratios.json` (DE-31), `state_recurrence.json` (DE-32) and `state_outlook.json` (DE-33), all 2026-11-15.
- **Data:** local only, in `data/pilot/brazil/` (git-ignored, about 0.7 GB).

What each period contains:
- **2012-02 to 2026-10:** the value is the DE-11 reference VIIRS satellite, observed (Suomi NPP to 2018-03, NOAA-20 from 2018-04). No harmonization fit is needed.
- **2000-11 to 2012-01:** harmonized with **each state's own ratios** where they passed the DE-15 backcast test (DE-31, PROPOSED): 21 states. In the 6 that failed (AC, RR, CE, PB, PE, DF) these months stay raw MODIS, labelled not harmonized, and the national total is empty for them.
- **2026 (to 2026-10-31, Rondônia's cut-off):** from the FIRMS area API over Brazil's box (DE-33), with Rondônia's dates and SP/NRT split. 186 requests of 5 days used 1,824 transactions (limit 5,000 per 10 minutes) and 170 MB. Near real-time months are provisional (VIIRS from August, MODIS from September). NOAA-21 was not downloaded: no computation uses it.

## How to evaluate it
Serve the repository root (not `docs/`), so the app can read the local packs next to it:
```
python pipeline/download.py --ibge-brazil     # once: IBGE states and municipalities of Brazil (internet)
# once, with FIRMS_MAP_KEY in .env: 2026 over Brazil's box, into data/pilot/brazil/raw/ (Rondonia's data/raw/api is not touched)
B="--bbox -74 -34 -28.75 5.5 --raw-dir data/pilot/brazil/raw"
python pipeline/download.py --api-source MODIS_SP --dates 2026-01-01 2026-08-31 $B
python pipeline/download.py --api-source MODIS_NRT --dates 2026-09-01 2026-10-31 $B
python pipeline/download.py --api-source VIIRS_SNPP_SP --dates 2026-01-01 2026-07-31 $B
python pipeline/download.py --api-source VIIRS_SNPP_NRT --dates 2026-08-01 2026-10-31 $B
python pipeline/download.py --api-source VIIRS_NOAA20_SP --dates 2026-01-01 2026-07-31 $B
python pipeline/download.py --api-source VIIRS_NOAA20_NRT --dates 2026-08-01 2026-10-31 $B
python pipeline/pilot_brazil.py --check       # about 15 min; FIRMS country files 2000-2025 in data/raw/country/, 2026 from the API
python pipeline/pilot_packs.py --check        # DE-31 ratios, DE-32 layers, DE-28 per state (DE-33), one pack per state, national pack
# DE-29 per state (DE-33): independent packs, so several processes at once, largest first (memory is the limit)
printf "%s\n" AM PA MT MG BA MS GO MA RS TO PI SP RR PR AC CE AP PE SC PB RN ES RJ AL SE DF |
  OMP_NUM_THREADS=5 xargs -P 4 -I{} python pipeline/pilot_packs.py --cell-outlook {}
python pipeline/pilot_packs.py --check        # again, to collect the DE-29 results in method/results/state_outlook.json
# never run --check while --cell-outlook runs: both write the same metadata.json files
python3 -m http.server 8766                   # from the repository root
```
Then open http://localhost:8766/docs/. The app starts on Rondônia (the published pack) and shows what the published app does not:
- **A breadcrumb** at the top, **Brazil › State › Municipality**, each level a button.
- **A place search:** type a state or any of the 5,570 municipalities ("Altamira, PA").
- **Brazil:** the 27 states colored for the focus month, a national calendar, cards and a ranking of states. A click on a state opens it.
- **A state:** everything Rondônia has, with the state's own data: calendar, fire season, comparison, cards, the two month views, municipalities and their ranking, points, CSV, KML, print.
  - **Places that burn year after year** (DE-32), with a note that follows the state's own test.
  - **The forecasts** (DE-33): the next-season outlook card and "Where to expect fire" at about 1 km and 5 km, each with the state's own test result.
- **Change state without leaving the map:** the **Place** box at the top of the map panel (also in full screen), or a click on a neighbouring state, drawn as a dashed outline.

The toolbar (period chips, Download menu, place search) is part of the app for every area; on the published app the search and breadcrumb stay hidden (`tests/e2e/app_smoke.mjs`).
Browser test of the packs, skipped without them: `node --experimental-websocket tests/e2e/brazil_packs.mjs`.

**Standalone viewer:** `method/pilot/brazil_viewer.html` shows 2024 with a table of load times in your browser.

## State ratios (DE-31) and places that burn year after year (DE-32)
Both rules were written in `method/DECISIONS.md` before any state was computed.
- **DE-31:** 21 states pass; AC, RR, CE, PB, PE and DF fail (bias or monthly error over the limits). Rondônia's own fit reproduces the published backcast (+0.6 %, MdAPE 13.2 %; ratios within 0.8 %).
- **DE-32:** the pilot's Rondônia row reproduces DE-26 (11.8 % against 28.1 %; published 28.0 %). Elsewhere it differs: in 22 of the 27 states the cells that burned in at least 6 of 2012-2021 held more of the 2022-2025 detections than last year's top cells (for example Maranhão 19.7 % against 14.4 %, Pará 12.3 % against 17.2 %). The app's note states each area's own result.

## What was run
- **Data:** FIRMS country files of **Brazil and Bolivia**, 2000–2025: MODIS; VIIRS Suomi NPP from 2012; NOAA-20 from 2018. 2026 from the area API (above). NOAA-21 is not used.
- **One year and one source at a time,** through the unchanged DE-5 cleaning rules.
- **Area:** a detection counts for Brazil if it falls inside an IBGE state polygon. Bolivia's file is read because FIRMS's country does not follow the IBGE border. Other neighbours were not downloaded.
- **Assignment:** each detection goes to a state (27) and a municipality (5,570): IBGE malhas API v3, intermediate quality, with the DE-24 nearest-vertex rule for slivers.
- **Writing:** each source-year's rows go to per-state part files on disk. Each state-year is then aggregated on its own and written in the formats of DATA_CONTRACT.md (a), (b) and (e), plus a national summary per state.
- **Checks passed** (`--check`, 28):
  - per source and year, states plus points outside equal the clean rows;
  - per state, municipalities equal the state;
  - cells equal the state.

## Measured
Machine: 20 cores, 15 GB RAM, 24 GB free disk, unchanged after the run.

| What | Value |
|---|---|
| Wall time | **14 min 16 s** for 26 years. MODIS-only years take 0.5–15 s; VIIRS years 23–95 s (2024 is the largest). |
| Peak memory (RSS) | **3.2 GB**: one source-year of two countries, the largest being 2024 |
| Disk | **0.68 GB** in total: hotspot lists 0.48 GB (gzip, all years and satellites); cell series 117 MB; municipal series 53 MB; national summary 0.26 MB |
| In a state but in no municipality polygon (nearest vertex, DE-24) | 35,572 detections, all years |
| Largest state, Pará | 7.15 million detections (all satellites); 1,646 cells; cell series 15.6 MB; hotspot lists 86.9 MB (gzip) |

**Rondônia check:** for each of the 48 source-years, the pilot's state 11 against our Rondônia pipeline (`cleaning_log.csv`).
- The largest difference is 82 detections (0.16 %, S-NPP 2019); 2 source-years are equal.
- The differences come from the boundary detail: intermediate state polygon against the maximum-quality boundary.

**Browser:**

| Step | Time | JS memory |
|---|---|---|
| States map and national summary | milliseconds | — |
| Pará hotspot list of 2024 (11.4 MB gzip) | 421 ms | 163 MB |
| Mato Grosso hotspot list of 2019 | 198 ms | — |
| Drawing 369,000 points as one image | 0.6 s | — |
| Reading the largest cell series (Pará, 15.6 MB, 302 months) with the app's parser, in Node | 0.4 s | — |

## What this means
- **The pipeline is cheap:** 14 minutes and 3.2 GB for 26 years of Brazil, on this laptop. Memory can go lower by reading only the needed columns, in chunks (not done).
- **Series and boundaries are fine** for a state at a time. The largest state's 26-year cell series is 15.6 MB and parses in about 0.4 s; a compact format or a split by period would make it lighter on phones.
- **Points are the limit:** up to 11 MB per state-year. A national version should split them into small tiles × months and load them only when the user zooms in, drawn as an image or tiles.
- **Hosting:** 0.68 GB for all of Brazil, close to the GitHub Pages site limit (to check). Object storage behind a CDN is the safer choice (provider and limits to check).

## Decisions the team needs for a national version
1. **Review DE-31 and DE-32** (PROPOSED). For the 6 states that failed DE-31, ratios per biome (IBGE biomes) are the next option to test.
2. **Area attribution:** read the neighbouring countries' files for border states. The pilot did it for Bolivia; Paraguay, Argentina, Uruguay, Peru, Colombia, Venezuela, Guyana, Suriname and French Guiana were not downloaded.
3. **The split:**
   - states for series and municipalities;
   - small tiles × month for points;
   - and whether to publish all satellites' points or only the reference satellite's.
4. **Hosting** for about 0.7 GB of static files, and the update routine.
5. **Review DE-33** (PROPOSED), and the update routine for 2026 onward (the area API, as above). NOAA-21 for Brazil is not downloaded.
