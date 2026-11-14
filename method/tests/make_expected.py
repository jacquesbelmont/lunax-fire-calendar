"""Write method/tests/expected.json: reference values the app must reproduce (RA-4; checked by JA-8).

Computed only from docs/data/monthly_cells.csv and docs/data/metadata.json (the files the app reads), with
the rules of method/DECISIONS.md DE-13. AI-assisted code (Claude Code); logged in AI_USE.md.

Usage (after pipeline/export.py):
    python method/tests/make_expected.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CELLS = ROOT / "docs" / "data" / "monthly_cells.csv"
META = ROOT / "docs" / "data" / "metadata.json"
OUT = ROOT / "method" / "tests" / "expected.json"
TILE = 2.0  # degrees, size of the two test squares

RULES = {
    "area_value": "sum of viirs_eq over the cells whose centre is inside the rectangle (DE-13); "
                  "null if the month has no data (empty viirs_eq), never 0",
    "area_variance": "sum of viirs_eq_var over the same cells; 90 % interval = value +/- 1.645*sqrt(var) (DE-16)",
    "median": "median of the area values of the same calendar month in all previous years with data (DE-13); "
              "even count -> mean of the two middle values; null if no previous year has data",
    "n_years": "number of previous years used for the median (the app may hide medians below a minimum N)",
    "anomaly_diff": "value - median",
    "anomaly_ratio": "value / median, only when median > 0, else null",
    "cell_centre": "row, col = cell_id.split('_'); lat = (row + 0.5) * size - 90; lon = (col + 0.5) * size - 180",
    "tolerance": "values are sums of the same file's numbers; compare with a relative tolerance of 1e-9",
}


def cell_centres(cell_id, size):
    rc = cell_id.str.split("_", expand=True).astype(int)
    return (rc[0] + 0.5) * size - 90, (rc[1] + 0.5) * size - 180


def area_series(cells, lat, lon, bbox):
    """Monthly value and variance of the cells whose centre is inside bbox (null when the month has no data)."""
    w, s, e, n = bbox
    sel = cells[(lon > w) & (lon < e) & (lat > s) & (lat < n)]
    g = sel.groupby("year_month").agg(
        value=("viirs_eq", lambda x: x.sum() if x.notna().all() else np.nan),
        var=("viirs_eq_var", lambda x: x.sum() if x.notna().all() else np.nan))
    return g, int(sel["cell_id"].nunique())


def add_median_anomaly(g):
    year, month = g.index.str[:4].astype(int), g.index.str[5:7]
    med, n = [], []
    for ym in g.index:
        prev = g.loc[(month == ym[5:7]) & (year < int(ym[:4])), "value"].dropna()
        med.append(prev.median() if len(prev) else np.nan)
        n.append(int(len(prev)))
    g = g.assign(median=med, n_years=n)
    g["anomaly_diff"] = g["value"] - g["median"]
    g["anomaly_ratio"] = (g["value"] / g["median"]).where(g["median"] > 0)
    return g


def tiles(bbox):
    """TILE x TILE squares fully inside bbox, starting at its south-west corner."""
    w, s, e, n = bbox
    xs = np.arange(w, e - TILE + 1e-9, TILE)
    ys = np.arange(s, n - TILE + 1e-9, TILE)
    return [[float(x), float(y), float(x + TILE), float(y + TILE)] for x in xs for y in ys]


def _num(v):
    return None if pd.isna(v) else float(v)


def main():
    meta = json.loads(META.read_text())
    size = meta["grid"]["cell_size_deg"]
    bbox = meta["area"]["bbox_west_south_east_north"]
    cells = pd.read_csv(CELLS, dtype={"year_month": str, "cell_id": str})
    lat, lon = cell_centres(cells["cell_id"], size)

    # Test squares: highest and lowest non-zero total of observed (native, estimated = 0) months.
    native = cells["estimated"].eq(0)
    totals = {}
    for t in tiles(bbox):
        g, _ = area_series(cells[native], lat[native], lon[native], t)
        totals[tuple(t)] = float(g["value"].sum())
    nonzero = {k: v for k, v in totals.items() if v > 0}
    high, low = max(nonzero, key=nonzero.get), min(nonzero, key=nonzero.get)
    areas = [("demo_area", bbox, "the whole demo area (metadata.json)"),
             ("high_fire_2deg", list(high), "2x2 degree square with the highest total of observed months"),
             ("low_fire_2deg", list(low), "2x2 degree square with the lowest non-zero total of observed months")]

    out = {"description": "Expected values for the app (JA-8). Generated from docs/data by method/tests/make_expected.py.",
           "source_files": ["docs/data/monthly_cells.csv", "docs/data/metadata.json"],
           "data_cutoff_date": meta["data_cutoff_date"], "rules": RULES, "areas": []}
    for name, box, how in areas:
        g, n_cells = area_series(cells, lat, lon, box)
        g = add_median_anomaly(g)
        months = [{"year_month": ym, **{c: _num(r[c]) for c in
                   ("value", "var", "median", "anomaly_diff", "anomaly_ratio")}, "n_years": int(r["n_years"])}
                  for ym, r in g.iterrows()]
        out["areas"].append({"name": name, "bbox_west_south_east_north": box, "selection": how,
                             "n_cells": n_cells, "n_months": len(months),
                             "n_months_without_data": sum(m["value"] is None for m in months), "months": months})
        print(f"{name}: bbox {box}, {n_cells} cells, {len(months)} months")
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
