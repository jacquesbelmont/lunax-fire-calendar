"""DE-29 (PROPOSED): where to expect fire next season, as a probability per cell, at 0.01° and 0.05°.

Owner issue: RA-9 (#59). SCOPE: proposed O5 (pending team approval).
AI-assisted code (Claude Code); logged in AI_USE.md.

Builds, for each valid pair of years (F, Y = F + 1), six features of every cell inside the IBGE boundary from year F and
earlier, and the target "at least one reference VIIRS detection in January-October of Y". Runs the pre-registered
rolling-origin test (logistic regression L, gradient boosting G, persistence P, constant rate B0; method/DECISIONS.md
DE-29), writes method/results/cell_outlook_hindcast.json, then refits the model chosen by the rule on every pair up to
2026 and writes the probabilities for 2027 to data/interim/cell_outlook_2027_<scale>.csv (export.py copies them).

Usage:
    python pipeline/cell_outlook.py      (after export.py: it reads docs/data/monthly_cells.csv; then rerun export.py)
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import ndimage
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import clean
import export

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "method" / "results" / "cell_outlook_hindcast.json"
INTERIM = ROOT / "data" / "interim"
W, S, E, N = json.loads((ROOT / "config" / "area.json").read_text())["bbox_west_south_east_north"]
VALID = [y for y in range(2012, 2027) if y != 2023]  # DE-29: as DE-26, 2023 misses reference days in July and September
TESTS, FRESH, NEXT = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2025], 2026, 2027
SCALES = {"001": 0.01, "005": 0.05}
FEATURES = ["last", "nb", "dist", "rec", "since", "parent"]
MODELS = {
    "L": lambda: make_pipeline(StandardScaler(), LogisticRegression(C=1.0, solver="lbfgs", max_iter=1000)),
    "G": lambda: HistGradientBoostingClassifier(learning_rate=0.05, max_iter=300, max_leaf_nodes=31, min_samples_leaf=200,
                                                l2_regularization=1.0, early_stopping=False, random_state=0),
}


def grid(g):
    """Cell layout of scale g over the processing box (aligned with the global grid: the box edges are multiples of g)."""
    nr, nc = round((N - S) / g), round((E - W) / g)
    r0, c0 = round((S + 90) / g), round((W + 180) / g)
    lat = S + (np.arange(nr) + 0.5) * g
    lon = W + (np.arange(nc) + 0.5) * g
    lat2, lon2 = np.meshgrid(lat, lon, indexing="ij")
    inside = clean.inside_boundary(lon2.ravel(), lat2.ravel(), clean.load_boundary()).reshape(nr, nc)
    ids = np.char.add(np.char.add((r0 + np.arange(nr))[:, None].astype(str), "_"), (c0 + np.arange(nc))[None, :].astype(str))
    return {"g": g, "nr": nr, "nc": nc, "r0": r0, "c0": c0, "lat": lat2, "lon": lon2, "inside": inside, "ids": ids}


def yearly_counts(pts, G):
    """Reference detections per cell in January-October of each valid year: {year: (nr, nc) array}."""
    p = pts[pts["acq_date"].str[5:7].astype(int).le(10)]
    years = p["acq_date"].str[:4].astype(int)
    r = np.floor((p["latitude"].to_numpy() + 90) / G["g"]).astype(int) - G["r0"]
    c = np.floor((p["longitude"].to_numpy() + 180) / G["g"]).astype(int) - G["c0"]
    out = {}
    for y in VALID:
        m = (years == y).to_numpy() & (r >= 0) & (r < G["nr"]) & (c >= 0) & (c < G["nc"])
        a = np.zeros((G["nr"], G["nc"]))
        np.add.at(a, (r[m], c[m]), 1)
        out[y] = a
    return out


def parent_means(G):
    """{F: (nr, nc) array}: log1p of the mean January-October harmonized hotspots of the 0.25° parent cell over the
    years 2001..F with complete windows (docs/data/monthly_cells.csv; inactive cells had no detection: 0)."""
    mc = pd.read_csv(ROOT / "docs" / "data" / "monthly_cells.csv", usecols=["cell_id", "year_month", "viirs_eq"], dtype={"year_month": str})
    mc = mc[mc["year_month"].str[5:7].astype(int).le(10)].assign(year=lambda d: d["year_month"].str[:4].astype(int))
    tot = mc.groupby(["cell_id", "year"])["viirs_eq"].agg(lambda v: v.sum() if len(v) == 10 and v.notna().all() else np.nan).unstack()
    pid = np.char.add(np.char.add(np.floor((G["lat"] + 90) / 0.25).astype(int).astype(str), "_"),
                      np.floor((G["lon"] + 180) / 0.25).astype(int).astype(str))
    out = {}
    for f in VALID:
        mean = tot[[y for y in tot.columns if 2001 <= y <= f]].mean(axis=1, skipna=True)
        out[f] = np.log1p(pd.Series(pid.ravel()).map(mean).fillna(0.0).to_numpy().reshape(pid.shape))
    return out


def features(counts, parent, f, G):
    """DE-29 features of every inside cell from year f and earlier (DataFrame in the order of the inside cells)."""
    a = counts[f]
    km_y, km_x = G["g"] * 111.32, G["g"] * 111.32 * np.cos(np.radians((S + N) / 2))
    nb = ndimage.convolve(a, np.array([[1, 1, 1], [1, 0, 1], [1, 1, 1]]), mode="constant")
    dist = np.minimum(ndimage.distance_transform_edt(a == 0, sampling=(km_y, km_x)), 50.0)
    window = [y for y in VALID if f - 4 <= y <= f]
    rec = sum((counts[y] > 0).astype(float) for y in window) / len(window)
    since = np.full(a.shape, 10.0)
    for y in sorted(y for y in VALID if y <= f):  # later years overwrite: years since the last valid year with fire
        since[counts[y] > 0] = min(10, f - y)
    m = G["inside"]
    return pd.DataFrame({"last": np.log1p(a[m]), "nb": np.log1p(nb[m]), "dist": dist[m], "rec": rec[m], "since": since[m],
                         "parent": parent[f][m]})


def capture(score, det, tiebreak, share=0.10):
    """Share of the detections in the top `share` of cells by score (ties by cell id order)."""
    k = int(np.ceil(share * len(score)))
    top = np.lexsort((tiebreak, -score))[:k]
    return float(det[top].sum() / det.sum())


def run_scale(G, counts, parent):
    m = G["inside"]
    order = np.argsort(np.argsort(G["ids"][m]))  # cell id order, for ties
    pairs = {y: (features(counts, parent, y - 1, G), counts[y][m]) for y in VALID if y - 1 in VALID}
    res = {"cells": int(m.sum()), "years": {}}
    for y in TESTS + [FRESH]:
        train = [t for t in pairs if t < y]
        X = pd.concat([pairs[t][0] for t in train]); yb = np.concatenate([pairs[t][1] > 0 for t in train])
        Xt, det = pairs[y]
        r = {"detections": int(det.sum()), "burned_share": round(float((det > 0).mean()), 4)}
        pers = Xt["last"].to_numpy() * 1e3 + Xt["nb"].to_numpy()  # last, then nb (nb < 1e3 after log1p)
        r["capture"] = {"P": capture(pers, det, order)}
        r["log_loss"] = {"B0": log_loss(det > 0, np.full(len(det), yb.mean()), labels=[False, True])}
        r["p"] = {}
        for name, make in MODELS.items():
            p = make().fit(X[FEATURES], yb).predict_proba(Xt[FEATURES])[:, 1]
            r["capture"][name] = capture(p, det, order)
            r["log_loss"][name] = log_loss(det > 0, p, labels=[False, True])
            r["p"][name] = p
        res["years"][y] = r
        print(G["g"], y, {k: round(v, 4) for k, v in r["capture"].items()}, {k: round(v, 4) for k, v in r["log_loss"].items()})
    return res, pairs


def summarize(res):
    """Pooled test numbers, 2026, calibration and the DE-29 rule."""
    t = [res["years"][y] for y in TESTS]
    pooled = {"capture": {k: round(sum(r["capture"][k] * r["detections"] for r in t) / sum(r["detections"] for r in t), 6)
                          for k in ("P", "L", "G")},
              "log_loss": {k: round(float(np.mean([r["log_loss"][k] for r in t])), 5) for k in ("B0", "L", "G")}}
    f = res["years"][FRESH]
    fresh = {"capture": {k: round(f["capture"][k], 6) for k in ("P", "L", "G")},
             "log_loss": {k: round(f["log_loss"][k], 5) for k in ("B0", "L", "G")}}
    best = "G" if pooled["log_loss"]["G"] <= 0.98 * pooled["log_loss"]["L"] else "L"
    shown = best if all(d["capture"][best] > d["capture"]["P"] and d["log_loss"][best] < d["log_loss"]["B0"]
                        for d in (pooled, fresh)) else "P"
    return {"cells": res["cells"], "test_years": TESTS, "fresh_year": FRESH, "pooled": pooled, "fresh": fresh,
            "by_year": {str(y): {"detections": r["detections"], "burned_share": r["burned_share"],
                                 "capture": {k: round(v, 4) for k, v in r["capture"].items()},
                                 "log_loss": {k: round(v, 5) for k, v in r["log_loss"].items()}} for y, r in res["years"].items()},
            "best_model": best, "shown": shown}


def calibration(res, pairs, name, m_inside):
    """Observed share of burned cells per tenth of predicted probability, pooled over the test years."""
    p = np.concatenate([res["years"][y]["p"][name] for y in TESTS])
    y = np.concatenate([pairs[t][1] > 0 for t in TESTS])
    b = np.minimum((p * 10).astype(int), 9)
    return [{"p_from": k / 10, "p_to": (k + 1) / 10, "cells": int((b == k).sum()),
             "mean_p": round(float(p[b == k].mean()), 4) if (b == k).any() else None,
             "observed": round(float(y[b == k].mean()), 4) if (b == k).any() else None} for k in range(10)]


def main():
    pts = export.reference_viirs()
    out = {"decision": "method/DECISIONS.md DE-29 (PROPOSED)", "window": "January-October", "valid_years": VALID,
           "target": "at least one reference VIIRS detection in the window", "features": FEATURES, "scales": {}}
    for key, g in SCALES.items():
        G = grid(g)
        counts, parent = yearly_counts(pts, G), parent_means(G)
        res, pairs = run_scale(G, counts, parent)
        s = summarize(res)
        s["calibration"] = {k: calibration(res, pairs, k, G["inside"]) for k in ("L", "G")}
        out["scales"][key] = {"grid_deg": g, **s}
        # Forecast for NEXT with the shown method, refitted on every pair up to FRESH
        X = pd.concat([pairs[t][0] for t in pairs]); yb = np.concatenate([pairs[t][1] > 0 for t in pairs])
        Xn = features(counts, parent, FRESH, G)
        ids = G["ids"][G["inside"]]
        if s["shown"] == "P":  # the cells ranked as in the test (last, then nb, then cell id); `top` = the 10 % measured
            pers = Xn["last"].to_numpy() * 1e3 + Xn["nb"].to_numpy()
            top = np.zeros(len(pers), dtype=int)
            top[np.lexsort((np.argsort(np.argsort(ids)), -pers))[:int(np.ceil(0.10 * len(pers)))]] = 1
            fc = pd.DataFrame({"cell_id": ids, "last": np.expm1(Xn["last"]).round().astype(int), "top": top})
        else:
            fc = pd.DataFrame({"cell_id": ids, "p": MODELS[s["shown"]]().fit(X[FEATURES], yb).predict_proba(Xn[FEATURES])[:, 1]})
        fc.to_csv(INTERIM / f"cell_outlook_{NEXT}_{key}.csv", index=False)
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps({k: {x: v[x] for x in ("pooled", "fresh", "best_model", "shown")} for k, v in out["scales"].items()}, indent=1))


if __name__ == "__main__":
    main()
