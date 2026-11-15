"""RA-11 pilot (issue #66): Brazil, 2024, to measure what a national version would cost. Measurement only: it does not
change the method (2024 is observed VIIRS, so viirs_eq = NOAA-20 as in DE-11), the published app or docs/data.

Owner issue: RA-11. SCOPE: none in the hackathon scope (DE-1: Rondonia); post-submission exploration.
AI-assisted code (Claude Code); logged in AI_USE.md.

Reads the FIRMS country files of Brazil and Bolivia for 2024 (data/raw/country/<source>/2024/, download.py) one source at
a time, applies the DE-5 cleaning rules (clean.apply_cleaning_rules), keeps the detections inside the IBGE state
polygons (FIRMS's country does not follow the IBGE border), assigns each
detection to an IBGE state and municipality (data/pilot/brazil/*.geojson, download.py --ibge-brazil), and writes, per
state, the formats of DATA_CONTRACT.md (a), (b) and (e) to data/pilot/brazil/<UF>/ (git-ignored), plus a national
summary per state. Time, peak memory and file sizes go to method/results/pilot_brazil_2024.json.

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
OUT = ROOT / "method" / "results" / "pilot_brazil_2024.json"
YEAR = 2024
SOURCES = ["modis", "viirs-snpp", "viirs-jpss1"]  # NOAA-21 has no country files (area API only): not in the pilot
COUNTRIES = ("Brazil", "Bolivia")  # country files on disk; other neighbours were not downloaded (report)
SATS = {"Terra": "terra", "Aqua": "aqua", "SNPP": "snpp", "NOAA20": "noaa20", "NOAA21": "noaa21"}
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
    """Counts per (unit, month, sat) -> DATA_CONTRACT (a) columns, one row per unit and month of YEAR; a satellite-month
    flagged or not covered is empty (never zero, AGENTS.md rule 6); viirs_eq = NOAA-20 (DE-11, observed)."""
    months = [f"{YEAR}-{m:02d}" for m in range(1, 13)]
    wide = counts.pivot_table(index=[unit, "year_month"], columns="sat", values="count", aggfunc="sum").reindex(
        pd.MultiIndex.from_product([sorted(counts[unit].unique()), months], names=[unit, "year_month"])).fillna(0)
    ok = flags[flags["flagged"].eq(0)]
    out = pd.DataFrame(index=wide.index)
    for sat, col in SATS.items():
        valid = set(ok.loc[ok["sat"].eq(sat), "year_month"])
        v = wide[sat] if sat in wide else pd.Series(0.0, index=wide.index)
        out[col] = v.where(wide.index.get_level_values("year_month").isin(valid)).astype("Int64")
    out = out.reset_index()
    out.insert(2, "viirs_eq", out["noaa20"].astype("Float64"))
    out.insert(3, "viirs_eq_var", out["viirs_eq"] * 0)
    out.insert(4, "estimated", 0)
    return out


def size(path):
    return path.stat().st_size


def main(argv=None):
    p = argparse.ArgumentParser(description="RA-11 pilot: Brazil 2024, per state (measurement only).")
    p.add_argument("--check", action="store_true", help="assert the sums across states, municipalities and cells")
    a = p.parse_args(argv)
    t0 = time.perf_counter()
    timing, rows = {}, {}
    states, munis = load_areas(PILOT / "states.geojson"), load_areas(PILOT / "municipalities.geojson")
    s_code = np.array([s["code"] for s in states])
    names = {s["code"]: s["name"] for s in states}
    bbox = (min(s["bbox"][0] for s in states), min(s["bbox"][1] for s in states),
            max(s["bbox"][2] for s in states) + 1e-9, max(s["bbox"][3] for s in states) + 1e-9)
    by_state = {s["code"]: [m for m in munis if m["code"][:2] == s["code"]] for s in states}  # IBGE: municipality code starts with its state's
    timing["load_boundaries_s"] = round(time.perf_counter() - t0, 2)
    for s in states:
        (PILOT / s["name"]).mkdir(parents=True, exist_ok=True)
    counts = []
    for src in SOURCES:  # one source at a time; each source's rows go to per-state part files on disk
        t = time.perf_counter()
        raw = clean.load_raw(src, YEAR)
        # Brazil's file plus its neighbour's on disk (Bolivia): FIRMS's country does not follow the IBGE border, so the
        # state polygons decide (Rondonia's pipeline keeps 964 Bolivia-file detections of 2024 inside its boundary)
        raw = raw[raw["country"].isin(COUNTRIES)].reset_index(drop=True)
        df, removed = clean.apply_cleaning_rules(raw, bbox, [], COUNTRIES)
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
            rows.setdefault("nearest_vertex", 0)
            rows["nearest_vertex"] += int(miss.sum())
        inside = st >= 0
        rows[src] = {"raw": int(n_raw), "clean": int(len(df)), "outside_states": int((~inside).sum()),
                     "inside_from_bolivia_file": int((inside & df["country"].eq("Bolivia").to_numpy()).sum()),
                     "removed_by_rules": removed}
        df = aggregate.assign_grid_cell(df[inside].assign(state=s_code[st[inside]], muni=mu[inside]))
        counts.append(df.assign(year_month=df["acq_date"].str[:7]).groupby(["state", "year_month", "sat"]).size().rename("count"))
        for code, g in df.groupby("state"):
            g[POINT_COLUMNS + ["cell_lat", "cell_lon", "muni"]].to_csv(PILOT / names[code] / f"part_{src}.csv.gz", index=False)
        timing[f"{src}_clean_assign_s"] = round(time.perf_counter() - t, 2)
        del df
    t = time.perf_counter()
    per_state = pd.concat(counts).groupby(level=[0, 1, 2]).sum().reset_index()
    coverage = [(sat, YEAR) for src in SOURCES for sat in aggregate.SOURCE_SATS[src]]
    flags = aggregate.flag_missing_months(coverage, pd.read_csv(aggregate.MISSING_DAYS, dtype=str))
    flags = flags[flags["year_month"].str.startswith(str(YEAR))]
    files = {}
    path = PILOT / "states.csv"
    dense(per_state.rename(columns={"state": "area_id"}), "area_id", flags).to_csv(path, index=False)
    files["states.csv"] = size(path)
    head = [f"# LUNAX RA-11 pilot (not the published app): Brazil {YEAR}, state {{}}, FIRMS country files, DE-5 cleaning",
            "# " + ATTRIBUTION, "# Disclaimer: " + DISCLAIMER_URL]
    checks = []
    muni_features = json.loads((PILOT / "municipalities.geojson").read_text(encoding="utf-8"))["features"]
    for s in states:  # one state at a time, from its part files
        out = PILOT / s["name"]
        parts = sorted(out.glob("part_*.csv.gz"))
        d = pd.concat([pd.read_csv(f, dtype={"acq_time": str, "muni": str, "version": str, "confidence": str}) for f in parts],
                      ignore_index=True)
        for f in parts:
            f.unlink()
        cells = aggregate.count_monthly(d)
        dense(cells, "cell_id", flags).to_csv(out / "monthly_cells.csv", index=False)
        mc = d.assign(year_month=d["acq_date"].str[:7]).groupby(["muni", "year_month", "sat"]).size().rename("count").reset_index()
        dense(mc.rename(columns={"muni": "area_id"}), "area_id", flags).to_csv(out / "municipalities.csv", index=False)
        feats = [f for f in muni_features if f["properties"]["code"][:2] == s["code"]]
        (out / "municipalities.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False),
                                                    encoding="utf-8")
        with gzip.open(out / f"hotspots_{YEAR}.csv.gz", "wt", encoding="utf-8") as fh:
            fh.write("\n".join([head[0].format(s["name"])] + head[1:]) + "\n")
            d.sort_values(["acq_date", "acq_time"])[POINT_COLUMNS].to_csv(fh, index=False)
        files[s["name"]] = {"detections": int(len(d)), "cells": int(cells["cell_id"].nunique()),
                            **{f.name: size(f) for f in sorted(out.iterdir())}}
        if a.check:
            sc = per_state[per_state["state"].eq(s["code"])].groupby("sat")["count"].sum()
            assert mc.groupby("sat")["count"].sum().equals(sc), f"{s['name']}: municipalities != state"
            assert cells.groupby("sat")["count"].sum().equals(sc), f"{s['name']}: cells != state"
            checks.append(s["name"])
    timing["aggregate_write_s"] = round(time.perf_counter() - t, 2)
    if a.check:
        for src in SOURCES:
            sats = aggregate.SOURCE_SATS[src]
            assert per_state[per_state["sat"].isin(sats)]["count"].sum() + rows[src]["outside_states"] == rows[src]["clean"], src
        checks.append("states + outside = clean rows, per source")
    ro = per_state[per_state["state"].eq("11") & per_state["sat"].eq("NOAA20")]["count"].sum()
    log = pd.read_csv(ROOT / "method" / "results" / "cleaning_log.csv")
    ro_pipeline = int(log.loc[log["source"].eq("viirs-jpss1") & log["year"].eq(YEAR), "rows_kept"].iloc[0])
    result = {
        "issue": "RA-11 (#66)", "year": YEAR, "sources": SOURCES, "note": "measurement only; viirs_eq = NOAA-20 (DE-11, observed)",
        "rows": rows, "timing": {**timing, "total_s": round(time.perf_counter() - t0, 2)},
        "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
        "files_bytes": files, "pilot_dir_bytes": sum(f.stat().st_size for f in PILOT.rglob("*") if f.is_file()),
        "rondonia_noaa20_2024": {"pilot_state_RO": int(ro), "lunax_pipeline_boundary": ro_pipeline},
        "countries_read": list(COUNTRIES),
        "checks": checks,
    }
    OUT.write_text(json.dumps(result, indent=1) + "\n")
    print(json.dumps({k: result[k] for k in ("rows", "timing", "peak_rss_mb", "pilot_dir_bytes", "rondonia_noaa20_2024")}, indent=1))


if __name__ == "__main__":
    main()
