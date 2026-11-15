"""RA-11 pilot (issue #66): Brazil, 2000-11 to 2026-10: the FIRMS country files on disk (2000-2025) and, for 2026, the FIRMS
area API over Brazil's box (DE-33; download.py --api-source ... --raw-dir data/pilot/brazil/raw). It does not change the
method, the published app or docs/data.
- 2012-02 to 2026-10: the DE-11 reference VIIRS satellite (Suomi NPP to 2018-03, NOAA-20 from 2018-04), observed; months
  with near real-time rows are provisional (months.csv), as in aggregate.py.
- 2000-11 to 2012-01: raw MODIS counts here; pipeline/pilot_packs.py converts them with each state's DE-31 ratios.

Owner issue: RA-11. SCOPE: none in the hackathon scope (DE-1: Rondonia); post-submission exploration.
AI-assisted code (Claude Code); logged in AI_USE.md.

Reads the FIRMS country files of Brazil and Bolivia year by year and source by source (data/raw/country/<source>/<year>/,
download.py), applies the DE-5 cleaning rules (clean.apply_cleaning_rules), keeps the detections inside the IBGE state
polygons (FIRMS's country does not follow the IBGE border), assigns each detection to an IBGE state and municipality
(data/pilot/brazil/*.geojson, download.py --ibge-brazil), writes each source-year's rows to per-state part files, and then
aggregates each state on its own: the formats of DATA_CONTRACT.md (a), (b) and (e) in data/pilot/brazil/<UF>/
(git-ignored), plus a national summary per state. Time, peak memory, file sizes and a per-year check against the Rondonia
pipeline go to method/results/pilot_brazil.json.

Usage:
    python pipeline/pilot_brazil.py --check
"""

import argparse
import gzip
import json
import resource
import time
from pathlib import Path

import numpy as np
import pandas as pd
from matplotlib.path import Path as PolygonPath
from scipy.spatial import cKDTree

import aggregate
import clean
from export import ATTRIBUTION, DISCLAIMER_URL

ROOT = Path(__file__).resolve().parent.parent
PILOT = ROOT / "data" / "pilot" / "brazil"
OUT = ROOT / "method" / "results" / "pilot_brazil.json"
YEARS = range(2000, 2027)  # country files to 2025; 2026 from the area API (DE-33)
API_RAW = ROOT / "data" / "pilot" / "brazil" / "raw"  # download.py --raw-dir: Rondonia's data/raw/api stays untouched
SOURCES = ["modis", "viirs-snpp", "viirs-jpss1"]  # NOAA-21 has no country files (area API only): not in the pilot
COUNTRIES = ("Brazil", "Bolivia")  # country files on disk; other neighbours were not downloaded (report)
SATS = {"Terra": "terra", "Aqua": "aqua", "SNPP": "snpp", "NOAA20": "noaa20", "NOAA21": "noaa21"}
MONTHS = [f"{y}-{m:02d}" for y in YEARS for m in range(1, 13) if "2000-11" <= f"{y}-{m:02d}" <= aggregate.DATA_END[:7]]
POINT_COLUMNS = ["cell_id", "latitude", "longitude", "acq_date", "acq_time", "sat", "sensor", "confidence", "daynight", "frp",
                 "type", "version"]


def load_areas(path):
    """Features as [{code, name, bbox, parts: [(outer Path, [hole Paths])], vertices}] (Polygon or MultiPolygon)."""
    areas = []
    for f in json.loads(path.read_text(encoding="utf-8"))["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        rings = [[np.asarray(r, dtype=float)[:, :2] for r in p] for p in polys]
        allv = np.vstack([r for p in rings for r in p])
        areas.append({"code": f["properties"]["code"], "name": f["properties"]["name"],
                      "bbox": (*allv.min(axis=0), *allv.max(axis=0)), "vertices": allv,
                      "parts": [(PolygonPath(p[0]), [PolygonPath(h) for h in p[1:]]) for p in rings]})
    return areas


def assign(lon, lat, areas):
    """Index (in areas) of the first area containing each point (outer ring minus holes); -1 when none."""
    out = np.full(len(lon), -1)
    for k, a in enumerate(areas):
        w, s, e, n = a["bbox"]
        cand = np.flatnonzero((out < 0) & (lon >= w) & (lon <= e) & (lat >= s) & (lat <= n))
        if not len(cand):
            continue
        xy = np.column_stack([lon[cand], lat[cand]])
        inside = np.zeros(len(cand), dtype=bool)
        for outer, holes in a["parts"]:
            ins = outer.contains_points(xy)
            for h in holes:
                ins &= ~h.contains_points(xy)
            inside |= ins
        out[cand[inside]] = k
    return out


def nearest(lon, lat, areas):
    """DE-24 fallback: index of the area with the nearest boundary vertex."""
    owner = np.concatenate([np.full(len(a["vertices"]), k) for k, a in enumerate(areas)])
    return owner[cKDTree(np.vstack([a["vertices"] for a in areas])).query(np.column_stack([lon, lat]))[1]]


def dense(counts, unit, flags):
    """Counts per (unit, month, sat) -> DATA_CONTRACT (a) columns, one row per unit and month of MONTHS; a satellite-month
    flagged or not covered is empty (never zero, AGENTS.md rule 6). viirs_eq = the DE-11 reference VIIRS satellite from
    2012-02 (observed); empty before (raw MODIS only: not harmonized for Brazil)."""
    wide = counts.pivot_table(index=[unit, "year_month"], columns="sat", values="count", aggfunc="sum").reindex(
        pd.MultiIndex.from_product([sorted(counts[unit].unique()), MONTHS], names=[unit, "year_month"])).fillna(0)
    ok = flags[flags["flagged"].eq(0)]
    out = pd.DataFrame(index=wide.index)
    ym = wide.index.get_level_values("year_month")
    for sat, col in SATS.items():
        v = wide[sat] if sat in wide else pd.Series(0.0, index=wide.index)
        out[col] = v.where(ym.isin(set(ok.loc[ok["sat"].eq(sat), "year_month"]))).astype("Int64")
    out = out.reset_index()
    ref = np.where(out["year_month"] >= "2018-04", out["noaa20"].astype("Float64"),
                   np.where(out["year_month"] >= "2012-02", out["snpp"].astype("Float64"), pd.NA))
    out.insert(2, "viirs_eq", pd.array(ref, dtype="Float64"))
    out.insert(3, "viirs_eq_var", out["viirs_eq"] * 0)
    out.insert(4, "estimated", 0)
    return out


def size(path):
    return path.stat().st_size


def main(argv=None):
    p = argparse.ArgumentParser(description="RA-11 pilot: Brazil, all years on disk, per state (measurement only).")
    p.add_argument("--check", action="store_true", help="assert the sums across states, municipalities and cells")
    a = p.parse_args(argv)
    t0 = time.perf_counter()
    timing, rows, nearest_n = {}, {}, 0
    states, munis = load_areas(PILOT / "states.geojson"), load_areas(PILOT / "municipalities.geojson")
    s_code = np.array([s["code"] for s in states])
    names = {s["code"]: s["name"] for s in states}
    bbox = (min(s["bbox"][0] for s in states), min(s["bbox"][1] for s in states),
            max(s["bbox"][2] for s in states) + 1e-9, max(s["bbox"][3] for s in states) + 1e-9)
    by_state = {s["code"]: [m for m in munis if m["code"][:2] == s["code"]] for s in states}  # IBGE: municipality code starts with its state's
    for s in states:
        (PILOT / s["name"]).mkdir(parents=True, exist_ok=True)
        for pattern in ("hotspots_*.csv.gz", "cell_outlook*"):  # DE-29 results of older data must not survive a rebuild
            for old in (PILOT / s["name"]).glob(pattern):
                old.unlink()
    head = ["# LUNAX RA-11 pilot (not the published app): Brazil {}, state {}, {}, DE-5 cleaning",
            "# " + ATTRIBUTION, "# Disclaimer: " + DISCLAIMER_URL]
    state_counts, cell_counts, muni_counts, coverage, nrt_months = [], {c: [] for c in s_code}, {c: [] for c in s_code}, [], set()
    for year in YEARS:
        t = time.perf_counter()
        raw_dir, route = (API_RAW, "api") if year >= 2026 else (clean.RAW_DIR, "country")
        for src in [s for s in SOURCES if (raw_dir / route / s / str(year)).exists()]:  # one source-year at a time
            coverage += [(sat, year) for sat in aggregate.SOURCE_SATS[src]]
            raw = clean.load_raw(src, year, raw_dir=raw_dir, route=route)
            # Brazil's file plus its neighbour's on disk (Bolivia): FIRMS's country does not follow the IBGE border, so the
            # state polygons decide (Rondonia's pipeline keeps 964 Bolivia-file detections of 2024 inside its boundary).
            # The area API has no country (its "country" is the file's source name): the box, then the state polygons.
            countries = tuple(raw["country"].unique()) if route == "api" else COUNTRIES
            raw = raw[raw["country"].isin(countries)].reset_index(drop=True)
            df, removed = clean.apply_cleaning_rules(raw, bbox, [], countries)
            n_raw = len(raw)
            del raw  # the raw copy is not needed after cleaning (it was the memory peak)
            lon, lat = df["longitude"].to_numpy(), df["latitude"].to_numpy()
            st = assign(lon, lat, states)
            mu = np.full(len(df), "", dtype=object)
            for k, s in enumerate(states):
                sel = np.flatnonzero(st == k)
                if not len(sel):
                    continue
                ms = by_state[s["code"]]
                idx = assign(lon[sel], lat[sel], ms)
                miss = idx < 0
                if miss.any():
                    idx[miss] = nearest(lon[sel][miss], lat[sel][miss], ms)
                mu[sel] = np.array([m["code"] for m in ms])[idx]
                nearest_n += int(miss.sum())
            inside = st >= 0
            rows[f"{src} {year}"] = {"raw": int(n_raw), "clean": int(len(df)), "outside_states": int((~inside).sum()),
                                     "inside_from_bolivia_file": int((inside & df["country"].eq("Bolivia").to_numpy()).sum())}
            df = aggregate.assign_grid_cell(df[inside].assign(state=s_code[st[inside]], muni=mu[inside]))
            nrt = df[df["processing"].eq("NRT")]
            nrt_months |= set(zip(nrt["sat"], nrt["acq_date"].str[:7]))  # provisional months, as aggregate.py
            state_counts.append(df.assign(year_month=df["acq_date"].str[:7]).groupby(["state", "year_month", "sat"]).size().rename("count"))
            for code, g in df.groupby("state"):
                g[POINT_COLUMNS + ["cell_lat", "cell_lon", "muni"]].to_csv(PILOT / names[code] / f"part_{year}_{src}.csv.gz", index=False)
            del df
        for s in states:  # this year, one state at a time, from its part files
            out = PILOT / s["name"]
            parts = sorted(out.glob(f"part_{year}_*.csv.gz"))
            if not parts:
                continue
            d = pd.concat([pd.read_csv(f, dtype={"acq_time": str, "muni": str, "version": str, "confidence": str}) for f in parts],
                          ignore_index=True)
            for f in parts:
                f.unlink()
            cell_counts[s["code"]].append(aggregate.count_monthly(d))
            muni_counts[s["code"]].append(d.assign(year_month=d["acq_date"].str[:7]).groupby(["muni", "year_month", "sat"]).size()
                                          .rename("count").reset_index())
            with gzip.open(out / f"hotspots_{year}.csv.gz", "wt", encoding="utf-8") as fh:
                fh.write("\n".join([head[0].format(year, s["name"], "FIRMS area API, near real-time rows provisional" if year >= 2026
                                                    else "FIRMS country files")] + head[1:]) + "\n")
                d.sort_values(["acq_date", "acq_time"])[POINT_COLUMNS].to_csv(fh, index=False)
        timing[str(year)] = round(time.perf_counter() - t, 1)
        print(year, timing[str(year)], "s", flush=True)
    t = time.perf_counter()
    per_state = pd.concat(state_counts).groupby(level=[0, 1, 2]).sum().reset_index()
    flags = aggregate.flag_missing_months(coverage, pd.read_csv(aggregate.MISSING_DAYS, dtype=str))
    flags["provisional"] = [int(k in nrt_months) for k in zip(flags["sat"], flags["year_month"])]
    flags = flags[flags["year_month"].ge("2000-11")]
    flags[["year_month", "sat", "missing_days", "flagged", "provisional"]].to_csv(PILOT / "months.csv", index=False)  # (a2), for the packs
    files = {}
    path = PILOT / "states.csv"
    dense(per_state.rename(columns={"state": "area_id"}), "area_id", flags).to_csv(path, index=False)
    files["states.csv"] = size(path)
    checks = []
    muni_features = json.loads((PILOT / "municipalities.geojson").read_text(encoding="utf-8"))["features"]
    for s in states:
        out, code = PILOT / s["name"], s["code"]
        cells = pd.concat(cell_counts[code], ignore_index=True)
        mc = pd.concat(muni_counts[code], ignore_index=True)
        dense(cells, "cell_id", flags).to_csv(out / "monthly_cells.csv", index=False)
        dense(mc.rename(columns={"muni": "area_id"}), "area_id", flags).to_csv(out / "municipalities.csv", index=False)
        feats = [f for f in muni_features if f["properties"]["code"][:2] == code]
        (out / "municipalities.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False),
                                                    encoding="utf-8")
        files[s["name"]] = {"detections": int(cells["count"].sum()), "cells": int(cells["cell_id"].nunique()),
                            "hotspots_bytes": sum(size(f) for f in out.glob("hotspots_*.csv.gz")),
                            **{f.name: size(f) for f in sorted(out.iterdir()) if not f.name.startswith("hotspots_")}}
        if a.check:
            sc = per_state[per_state["state"].eq(code)].groupby("sat")["count"].sum()
            assert mc.groupby("sat")["count"].sum().equals(sc), f"{s['name']}: municipalities != state"
            assert cells.groupby("sat")["count"].sum().equals(sc), f"{s['name']}: cells != state"
            checks.append(s["name"])
    timing["aggregate_write_s"] = round(time.perf_counter() - t, 1)
    if a.check:
        ys = per_state.assign(year=per_state["year_month"].str[:4].astype(int))
        for key, r in rows.items():
            src, year = key.split()
            n = ys[ys["sat"].isin(aggregate.SOURCE_SATS[src]) & ys["year"].eq(int(year))]["count"].sum()
            assert n + r["outside_states"] == r["clean"], key
        checks.append("states + outside = clean rows, per source and year")
    # Rondonia: the pilot's state 11 against our Rondonia pipeline (method/results/cleaning_log.csv), per source and year
    log = pd.read_csv(ROOT / "method" / "results" / "cleaning_log.csv")
    ro = per_state[per_state["state"].eq("11")].assign(year=lambda d: d["year_month"].str[:4].astype(int))
    rondonia = []
    for _, r in log[log["source"].isin(SOURCES) & log["year"].isin(list(YEARS))].iterrows():
        n = int(ro[ro["sat"].isin(aggregate.SOURCE_SATS[r["source"]]) & ro["year"].eq(r["year"])]["count"].sum())
        rondonia.append({"source": r["source"], "year": int(r["year"]), "pilot": n, "pipeline": int(r["rows_kept"]),
                         "difference": n - int(r["rows_kept"])})
    total_hot = sum(v["hotspots_bytes"] for v in files.values() if isinstance(v, dict))
    result = {
        "issue": "RA-11 (#66)", "years": [YEARS[0], YEARS[-1]], "sources": SOURCES, "countries_read": list(COUNTRIES),
        "note": "viirs_eq = DE-11 reference VIIRS from 2012-02 (observed), empty before (raw MODIS here; pilot_packs.py applies "
                "the DE-31 state ratios); 2026 from the FIRMS area API over Brazil's box, to 2026-10-31 (DE-33)",
        "rows": rows, "nearest_vertex": nearest_n, "timing_s": {**timing, "total": round(time.perf_counter() - t0, 1)},
        "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
        "files_bytes": files, "hotspots_bytes_total": total_hot,
        "pilot_dir_bytes": sum(f.stat().st_size for f in PILOT.rglob("*") if f.is_file() and f.relative_to(PILOT).parts[0] != "raw"),
        "rondonia_vs_pipeline": rondonia, "checks": checks,
    }
    OUT.write_text(json.dumps(result, indent=1) + "\n")
    print(json.dumps({k: result[k] for k in ("timing_s", "peak_rss_mb", "hotspots_bytes_total", "pilot_dir_bytes")}, indent=1))


if __name__ == "__main__":
    main()
