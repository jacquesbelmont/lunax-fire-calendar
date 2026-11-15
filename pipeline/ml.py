"""RA-6: machine-learning challenger of the harmonization (method/DECISIONS.md DE-18, registered before any result).

Owner issue: RA-6. SCOPE: R2.
AI-assisted code (Claude Code); logged in AI_USE.md.

Gradient boosting with Poisson loss (DE-6 option 4) predicts the reference VIIRS count of a cell-month from the
MODIS detections of that cell-month. It is evaluated with the DE-15 protocol against the production ratio method,
on the same cell-months. Challenger only: nothing here changes docs/data/.

Usage:
    python pipeline/ml.py
Reads data/interim/monthly_counts.csv.gz, data/interim/month_flags.csv and data/interim/clean/modis_*.csv.gz.
Writes method/results/ml_metrics.json and method/results/ml_loyo.csv.
"""
import json
import sys
from pathlib import Path

import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, str(Path(__file__).resolve().parent))
import aggregate  # noqa: E402
import harmonize as hz  # noqa: E402
import validate as va  # noqa: E402

# DE-18, fixed before any result: no tuning on test years.
PARAMS = dict(loss="poisson", learning_rate=0.05, max_iter=300, max_leaf_nodes=15, min_samples_leaf=50,
              l2_regularization=1.0, random_state=0, early_stopping=False)
# DE-6 option 4 features, no location. month_no is categorical (first column).
FEATURES = {"TA": ["month_no", "Terra", "Aqua", "frp_Terra", "frp_Aqua", "night_share", "low_share"],
            "T": ["month_no", "Terra", "frp_Terra", "night_share_T", "low_share_T"]}
MARGIN = {"mdape_monthly_area_max": 0.113, "abs_relative_bias_total_max": 0.02}  # DE-18, Terra + Aqua model
LOW_CONFIDENCE = 30  # MODIS C < 30 % = low class (MODIS C6/C6.1 user guide, Table 11)


def modis_features():
    """FRP sum, night and low-confidence counts of the MODIS detections per cell-month and satellite."""
    d = pd.concat([pd.read_csv(f, usecols=["latitude", "longitude", "acq_date", "sat", "frp", "daynight", "confidence"],
                               dtype={"acq_date": str, "sat": str, "daynight": str, "confidence": str})
                   for f in sorted(va.CLEAN_DIR.glob("modis_*.csv.gz"))], ignore_index=True)
    d = d[d["acq_date"].str[:7] <= va.VALIDATION_END]
    d = aggregate.assign_grid_cell(d).assign(year_month=d["acq_date"].str[:7], night=d["daynight"].eq("N"),
                                             low=pd.to_numeric(d["confidence"]) < LOW_CONFIDENCE)
    g = d.groupby(["cell_id", "year_month", "sat"]).agg(n=("frp", "size"), frp=("frp", "sum"),
                                                        night=("night", "sum"), low=("low", "sum")).unstack("sat")
    g.columns = [f"{v}_{s}" for v, s in g.columns]
    return g.reset_index()


def build_rows():
    """Panel of validation years (harmonize.py) with the reference VIIRS count and the MODIS features."""
    panel = hz.add_reference(hz.build_panel(pd.read_csv(hz.COUNTS), pd.read_csv(hz.FLAGS)))
    panel = panel[panel["year_month"] <= va.VALIDATION_END]
    p = panel.merge(modis_features(), on=["cell_id", "year_month"], how="left")
    for s in ("Terra", "Aqua"):
        for v in ("n", "frp", "night", "low"):
            p[f"{v}_{s}"] = p[f"{v}_{s}"].fillna(0)
        # The features describe the same detections as the panel counts (asserts stay on: do not run with -O).
        valid = p[s].notna()
        assert (p.loc[valid, f"n_{s}"] == p.loc[valid, s]).all(), f"{s} feature counts differ from the panel"
    n_both = p["n_Terra"] + p["n_Aqua"]
    p["night_share"] = (p["night_Terra"] + p["night_Aqua"]) / n_both  # 0/0 -> NaN: no detection that month
    p["low_share"] = (p["low_Terra"] + p["low_Aqua"]) / n_both
    p["night_share_T"] = p["night_Terra"] / p["n_Terra"]
    p["low_share_T"] = p["low_Terra"] / p["n_Terra"]
    p["month_no"] = p["month"].astype(int)
    return p.set_index(panel.index)


def fit_predict(rows, train_years, test_years, name):
    """ML and ratio predictions on the same test cell-months (configuration TA or T)."""
    train = va._split(rows, train_years).dropna(subset=hz.NEEDS[name])
    test = va._split(rows, test_years).dropna(subset=hz.NEEDS[name])
    model = HistGradientBoostingRegressor(**PARAMS, categorical_features=[0])
    model.fit(train[FEATURES[name]], train["ref"])
    ml = pd.Series(model.predict(test[FEATURES[name]]), index=test.index)
    ratio, _, _ = va.predict_ratio(hz.fit(rows, train_years), test, only="T" if name == "T" else None)
    same = ml.notna() & ratio.notna()
    return test[same], ml[same], ratio[same]


def main():
    rows = build_rows()
    backcast = {}
    for name in ("TA", "T"):
        test, ml, ratio = fit_predict(rows, va.BACKCAST_TRAIN, va.BACKCAST_TEST, name)
        backcast[name] = {"ml": va.metrics(test, ml), "ratio": va.metrics(test, ratio)}
        print(f"backcast {name}: ML {backcast[name]['ml']} | ratio {backcast[name]['ratio']}")
    loyo = []
    for y in va.LOYO_YEARS:
        test, ml, ratio = fit_predict(rows, [z for z in va.LOYO_YEARS if z != y], [y], "TA")
        m, r = va.metrics(test, ml), va.metrics(test, ratio)
        loyo.append({"year": y, "ml_relative_bias_total": m["relative_bias_total"],
                     "ml_mdape_monthly_area": m["mdape_monthly_area"],
                     "ratio_relative_bias_total": r["relative_bias_total"],
                     "ratio_mdape_monthly_area": r["mdape_monthly_area"]})
    loyo = pd.DataFrame(loyo)
    loyo.to_csv(va.RESULTS / "ml_loyo.csv", index=False)
    ta = backcast["TA"]["ml"]
    wins = (ta["mdape_monthly_area"] <= MARGIN["mdape_monthly_area_max"]
            and abs(ta["relative_bias_total"]) <= MARGIN["abs_relative_bias_total_max"])
    result = {
        "decision": "method/DECISIONS.md DE-18 (registered 2026-11-15 09:42 UTC-4, before any result)",
        "scikit_learn_version": sklearn.__version__, "params": PARAMS, "features": FEATURES,
        "backcast_train_years": [va.BACKCAST_TRAIN[0], va.BACKCAST_TRAIN[-1]],
        "backcast_test_years": [va.BACKCAST_TEST[0], va.BACKCAST_TEST[-1]],
        "backcast": backcast,
        "loyo_file": "method/results/ml_loyo.csv",
        "loyo_summary": {c: {"min": float(loyo[c].min()), "median": float(loyo[c].median()), "max": float(loyo[c].max())}
                         for c in loyo.columns if c != "year"},
        "margin": MARGIN,
        "verdict": {"ml_beats_ratio": bool(wins),
                    "rule": "Terra + Aqua backcast MdAPE <= 0.113 and |relative bias| <= 0.02 (DE-18)",
                    "use": "challenger only; production stays the ratio method (DE-6)"},
    }
    (va.RESULTS / "ml_metrics.json").write_text(json.dumps(result, indent=2) + "\n")
    print("verdict:", result["verdict"])
    print("wrote method/results/ml_metrics.json, ml_loyo.csv")


if __name__ == "__main__":
    main()
