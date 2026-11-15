# Brazil pilot, 2000–2025 (RA-11, issue #66)

Measurement only, after the hackathon submission. It changes nothing in the published app, in `docs/data` or in the method.
- **Numbers:** `method/results/pilot_brazil.json` (2026-11-15).
- **Data:** local only, in `data/pilot/brazil/` (git-ignored).

What each period contains:
- **2012-02 to 2025:** the value is the DE-11 reference VIIRS satellite, observed (Suomi NPP to 2018-03, NOAA-20 from 2018-04). No harmonization fit is needed.
- **2000-11 to 2012-01:** raw MODIS counts only, **not harmonized**. Our ratios were fitted and validated for Rondônia only; converting these years for Brazil needs ratios per biome, validated as in DE-15. That is a team decision.
- **2026:** not included. There are no FIRMS country files; it needs the area API with a MAP_KEY.

## How to evaluate it
**In the main app.** Serve the repository root (not `docs/`), so the app can read the local pilot files next to it:
```
python pipeline/download.py --ibge-brazil     # once: IBGE states and municipalities of Brazil (internet)
python pipeline/pilot_brazil.py --check       # about 15 min; FIRMS country files 2000-2025 in data/raw/country/
python3 -m http.server 8766                   # from the repository root
```
Then open http://localhost:8766/docs/. In the map panel, a group **"Brazil pilot, 2000-2025 (local only)"** appears with the view **"States and cells of Brazil"**:
- **The month:** the same map shows the 27 states for the page's focus month, and a click on a month of the calendar changes it. From 2012 the value is VIIRS; before, raw Terra MODIS, labelled "not harmonized". For a 2026 month, the view uses the same month of 2025 and says so.
- **A click on a state:** draws its 0.25° cells and municipal borders, with the map legend.
- **A button under the map:** draws that month's detections of every satellite as one image.

The published app does not have the pilot files, so this group stays hidden there (checked by `tests/e2e/app_smoke.mjs`).

**Standalone viewer:** `method/pilot/brazil_viewer.html` shows 2024 with a table of load times in your browser.

## What was run
- **Data:** FIRMS country files of **Brazil and Bolivia**, 2000–2025: MODIS; VIIRS Suomi NPP from 2012; NOAA-20 from 2018. NOAA-21 has no country file.
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
1. **Harmonization ratios per biome** (IBGE biomes) for 2000–2012, each validated with the DE-15 backcast protocol. A new DE. Until then, the pilot shows raw MODIS for those years.
2. **Area attribution:** read the neighbouring countries' files for border states. The pilot did it for Bolivia; Paraguay, Argentina, Uruguay, Peru, Colombia, Venezuela, Guyana, Suriname and French Guiana were not downloaded.
3. **The split:**
   - states for series and municipalities;
   - small tiles × month for points;
   - and whether to publish all satellites' points or only the reference satellite's.
4. **Hosting** for about 0.7 GB of static files, and the update routine.
5. **2026 and NOAA-21** through the area API for Brazil (5,000 transactions per 10 minutes; DATA_CONTRACT.md).
