# Brazil pilot, 2024 (RA-11, issue #66)

Measurement only, after the hackathon submission. It changes nothing in the published app, in `docs/data` or in the method. 2024 is observed VIIRS, so `viirs_eq` = NOAA-20 (DE-11) and no harmonization fit is needed.
- **Numbers:** `method/results/pilot_brazil_2024.json` (2026-11-15).
- **Data:** local only, in `data/pilot/brazil/` (git-ignored).

## How to evaluate it
From the repository root, on the branch `RA-11-brazil-pilot`:
```
python pipeline/download.py --ibge-brazil     # once: IBGE states and municipalities of Brazil (internet)
python pipeline/pilot_brazil.py --check       # about 1.5 min; FIRMS country files of 2024 must be in data/raw/country/
python3 -m http.server 8766                   # serve the repository root
```
Then open http://localhost:8766/method/pilot/brazil_viewer.html.
1. The map colors the 27 states by their NOAA-20 detections of August–October 2024.
2. Click a state to load its 0.25° cells and municipal borders, plus a monthly chart (NOAA-20 and Suomi NPP).
3. Choose a month, and press **Load the detections of this month** to draw that month's points of every satellite as one image.

The table "What your browser loaded" shows the size, time and JS memory of each file in *your* browser. A phone on the same network can open the same page through the computer's IP address, to judge mobile speed.

## What was run
- **Data:** FIRMS country files of **Brazil and Bolivia**, 2024 (MODIS, VIIRS Suomi NPP, VIIRS NOAA-20; NOAA-21 has no country file). One source at a time, through the unchanged DE-5 cleaning rules.
- **Area:** a detection counts for Brazil if it falls inside an IBGE state polygon. Bolivia's file is read because FIRMS's country does not follow the IBGE border (see the Rondônia check). Other neighbours were not downloaded.
- **Assignment:** each detection goes to a state (27) and a municipality (5,570): IBGE malhas API v3, intermediate quality, `pipeline/download.py --ibge-brazil`, with the DE-24 nearest-vertex rule for slivers.
- **Writing:** each source's rows are written to per-state part files on disk; each state is then aggregated on its own, in the formats of DATA_CONTRACT.md (a), (b) and (e), plus a national summary per state.
- **Checks passed** (`--check`):
  - per source, states plus points outside equal the clean rows;
  - per state, municipalities equal the state;
  - cells equal the state.

## Measured
Machine: 20 cores, 15 GB RAM.

| What | Value |
|---|---|
| Detections inside the states (from Bolivia's file) | MODIS 521,076 (232); Suomi NPP 1,914,688 (1,234); NOAA-20 1,966,533 (1,307) |
| In a state but in no municipality polygon (nearest vertex, DE-24) | 4,219 |
| Wall time | 97 s: cleaning and assignment 64 s, aggregation and writing 33 s |
| Peak memory (RSS) | **2.9 GB**. The first run held everything at once and peaked at 3.7 GB; freeing the raw copy after cleaning and aggregating state by state brought it down. What remains is reading one source-year of two countries (about 3.8 million rows with all columns). |
| Files written | 86.6 MB: hotspot lists 51.0 MB (gzip), cell series 4.6 MB, municipal series 2.3 MB, municipal boundaries about 14 MB |
| Largest state, Pará | 993,363 detections; hotspot list 11.4 MB gzip; 1,360 cells; 144 municipalities |

**Browser:** the viewer in headless Chromium on a local server (no network time), with Pará:

| Step | Time | JS memory after |
|---|---|---|
| States map (0.29 MB) and national summary (0.01 MB) | 5 ms + 3 ms | 16 MB |
| Pará cells (0.57 MB) | 16 ms | 25 MB |
| Pará municipal borders (0.81 MB) | 7 ms | 28 MB |
| Pará hotspot list of 2024 (11.4 MB gzip) | 421 ms | 163 MB |
| Drawing September 2024 (368,857 detections of 4 satellites) as one image | 641 ms | — |

**Rondônia check** (NOAA-20, 2024):
- Pilot: **87,422**. Our Rondônia pipeline: **87,445**. The difference (−23, 0.03 %) comes from the boundary detail: intermediate state polygon against the maximum-quality boundary.
- Before Bolivia's file was read, the pilot had 86,575. The pipeline's own count includes 964 detections from Bolivia's file that fall inside the IBGE boundary.

## What this means
- **The pipeline is cheap:** about 1.5 minutes and 2.9 GB for Brazil in a year with VIIRS.
  - Derived: 2000–2026 would take roughly 20–40 minutes, since the MODIS-only years are smaller.
  - Memory can go lower by reading only the needed columns, in chunks (not done).
- **Summaries, series and boundaries are small and fast in the browser:** milliseconds.
  - Derived: 26 years of Pará's cells ≈ 15 MB (0.57 MB × 26), which needs a compact format or a split by period.
- **Points are the limit.**
  - One year of a large state is 11 MB to download, which is slow on a phone over mobile data, and 163 MB of browser memory.
  - Drawn as one image they are fast (0.6 s for 369,000). The current app's grouped markers would not cope with that many.
  - A national version should split points into small tiles × months, load them only when zoomed in, and draw them as an image or tiles.
- **Hosting:** derived, all years of points ≈ 0.7–0.8 GB of gzip (51 MB × 14 VIIRS years plus the smaller MODIS-only years). That is close to the GitHub Pages site limit (to check), so it would need object storage behind a CDN (provider and limits to check).

## Decisions the team needs for a national version
1. **Harmonization ratios per biome** (IBGE biomes), each validated with the DE-15 backcast protocol before use. A new DE.
2. **Area attribution:** read the neighbouring countries' files for border states. The pilot did it for Bolivia; Paraguay, Argentina, Uruguay, Peru, Colombia, Venezuela, Guyana, Suriname and French Guiana were not downloaded.
3. **The split:**
   - states for series and municipalities;
   - small tiles × month for points;
   - and whether to publish all satellites' points or only the reference satellite's.
4. **Hosting** for about 1 GB of static files, and the update routine (download, `DATA_END`, rerun).
5. **NOAA-21** through the area API for Brazil (5,000 transactions per 10 minutes; DATA_CONTRACT.md).
