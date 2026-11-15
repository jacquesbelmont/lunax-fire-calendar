"""Validation of the harmonized series (protocol DE-15, fixed before results were seen).

Owner issue: RA-3. SCOPE: R2, R5.
Outputs go to method/results/ and method/figures/, summary in method/VALIDATION.md.
AI-assisted code (Claude Code); logged in AI_USE.md.

- Backcast (mimics real use, predicting backwards in time): fit on 2015-2025, predict 2012-02..2014-12
  from MODIS, compare with the observed reference VIIRS. Pre-registered candidates (DE-6):
    option 2, ratio per month of year (pipeline/harmonize.py, now the production method), and
    option 3, negative binomial count regression with a cell climatology (implemented here for comparison).
  Terra-only variants are tested too, because Terra alone is used for 2000-11..2002-06.
  A Poisson version of option 3 is reported as a POST-HOC diagnostic only (not used for selection).
- Leave-one-year-out over 2012-2025: one fit per held-out year (stability, year trend of the error).
- Metrics: relative bias of the total; median absolute percentage error (MdAPE) and Pearson r of the
  monthly area totals; coverage of the 90 % prediction interval (cell level: NB2 quantiles; area level:
  normal approximation with summed variances, which assumes independent cells).
- Jump check: raw VIIRS/MODIS ratio in the overlap, and a before/after figure.
- VIIRS continuity: monthly area totals of NOAA-20 vs S-NPP where both are valid.

Usage:
    python pipeline/validate.py
Reads data/interim/monthly_counts.csv.gz, data/interim/month_flags.csv and data/interim/harmonized.csv.gz.
Writes method/results/validation_metrics.json, loyo.csv, continuity.csv and
method/figures/before_after.png, backcast.png, continuity.png.
"""

import json
import sys
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harmonize as hz  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "method" / "results"
FIGURES = ROOT / "method" / "figures"
BACKCAST_TRAIN = range(2015, 2026)  # DE-15
BACKCAST_TEST = range(2012, 2015)  # DE-15
LOYO_YEARS = range(2012, 2026)  # DE-15
CALIB_YEARS = range(2015, 2026)  # DE-16: lambda fitted on these LOYO years, tested on the backcast years
CLEAN_DIR = ROOT / "data" / "interim" / "clean"
Z90 = stats.norm.ppf(0.95)
SOURCE_NOTE = "Data: NASA FIRMS country CSVs (standard processing), Brazil + Bolivia. Area: Rondônia bbox (DE-1)."
FORMULAS = {  # DE-6 option 3, as registered
    "TA": "ref ~ np.log1p(Terra) + np.log1p(Aqua) + C(month) + np.log1p(clim)",
    "T": "ref ~ np.log1p(Terra) + C(month) + np.log1p(clim)",
}


def _split(panel, years):
    year = panel["year_month"].str[:4].astype(int)
    return panel[year.isin(list(years)) & panel["ref"].notna()]


def _moment_alpha(y, mu):
    pos = mu > 0
    return max(1e-9, float((((y - mu) ** 2 - mu)[pos]).sum() / (mu[pos] ** 2).sum()))


def metrics(rows, pred, var=None, alpha=None):
    """Error metrics of predicted vs observed reference counts on the same rows."""
    ok = pred.notna() & rows["ref"].notna()
    obs, p = rows.loc[ok, "ref"], pred[ok]
    area = pd.DataFrame({"obs": obs, "pred": p, "ym": rows.loc[ok, "year_month"]}).groupby("ym").sum()
    pos = area["obs"] > 0
    out = {
        "n_cell_months": int(ok.sum()),
        "n_months": int(len(area)),
        "relative_bias_total": float(p.sum() / obs.sum() - 1),
        "mdape_monthly_area": float(np.median((area["pred"][pos] - area["obs"][pos]).abs() / area["obs"][pos])),
        "pearson_r_monthly_area": float(area["obs"].corr(area["pred"])),
    }
    if var is not None:
        n = 1 / alpha[ok].clip(lower=1e-9)
        lo, hi = stats.nbinom.ppf(0.05, n, n / (n + p)), stats.nbinom.ppf(0.95, n, n / (n + p))
        out["pi90_coverage_cell"] = float(((obs >= lo) & (obs <= hi)).mean())
        sd = np.sqrt(var[ok].groupby(rows.loc[ok, "year_month"]).sum())
        out["pi90_coverage_area"] = float(((area["obs"] - area["pred"]).abs() <= Z90 * sd).mean())
    return out


def predict_ratio(params, rows, only=None):
    """Production method (harmonize.py). Returns (mu, var, alpha per row)."""
    pr = hz.predict_from_modis(rows, params, only=only)
    alpha = pr["model"].map({k: v["alpha"] for k, v in params.items()})
    return pr["mu"], pr["var"], alpha


def fit_regression(panel, years, family):
    """DE-6 option 3 for comparison. family "nb" = negative binomial (as registered);
    "poisson" = post-hoc diagnostic (dispersion by moments). Cell climatology from training years only."""
    t = _split(panel, years)
    clim = t.groupby("cell_id")["ref"].mean()
    t = t.assign(clim=t["cell_id"].map(clim))
    models = {}
    for name, formula in FORMULAS.items():
        d = t.dropna(subset=hz.NEEDS[name])
        if family == "nb":
            r = smf.negativebinomial(formula, data=d).fit(disp=0, maxiter=500)
            alpha = float(r.params["alpha"])
        else:
            r = smf.glm(formula, data=d, family=sm.families.Poisson()).fit()
            alpha = _moment_alpha(d["ref"], r.predict(d))
        models[name] = (r, alpha)
    return models, clim


def predict_regression(models, clim, rows, only=None):
    rows = rows.assign(clim=rows["cell_id"].map(clim))
    mu, var, alpha = (pd.Series(np.nan, index=rows.index) for _ in range(3))
    base = rows["Terra"].notna() & rows["clim"].notna()
    use_ta = base & rows["Aqua"].notna() & (only != "T")
    for name, mask in (("TA", use_ta), ("T", base & ~use_ta)):
        if mask.any():
            r, a = models[name]
            m = np.asarray(r.predict(rows[mask]))
            mu[mask], var[mask], alpha[mask] = m, m + a * m ** 2, a
    return mu, var, alpha


def validate_on_held_out_years(panel):
    """Backcast (DE-15). Returns (metrics per method, test rows with predictions for the figure)."""
    train, test = _split(panel, BACKCAST_TRAIN), _split(panel, BACKCAST_TEST)
    params = hz.fit(panel, BACKCAST_TRAIN)
    nb, nb_clim = fit_regression(panel, BACKCAST_TRAIN, "nb")
    pois, pois_clim = fit_regression(panel, BACKCAST_TRAIN, "poisson")
    out = {}
    for label, only in (("ratio_per_month", None), ("ratio_per_month_terra_only", "T")):
        mu, var, alpha = predict_ratio(params, test, only)
        out[label] = metrics(test, mu, var, alpha)
        if only is None:
            test = test.assign(pred_ratio=mu)
    for label, only in (("count_regression_nb", None), ("count_regression_nb_terra_only", "T")):
        mu, var, alpha = predict_regression(nb, nb_clim, test, only)
        out[label] = metrics(test, mu, var, alpha)
        if only is None:
            test = test.assign(pred_nb=mu)
    mu, var, alpha = predict_regression(pois, pois_clim, test)
    out["POSTHOC_count_regression_poisson"] = metrics(test, mu, var, alpha)
    mu_tr, _, _ = predict_regression(nb, nb_clim, train)
    out["count_regression_nb_in_sample_total_ratio"] = float(mu_tr.sum() / train.loc[mu_tr.notna(), "ref"].sum())
    return out, test


def leave_one_year_out(panel):
    """One fit per held-out year of the overlap (DE-15): production ratio and the NB comparator.
    Returns (metrics per year, monthly area totals of the ratio method: obs, pred, summed variance)."""
    rows, areas = [], []
    for y in LOYO_YEARS:
        others = [z for z in LOYO_YEARS if z != y]
        test = _split(panel, [y])
        mu, var, alpha = predict_ratio(hz.fit(panel, others), test)
        m = metrics(test, mu, var, alpha)
        ok = mu.notna()
        areas.append(pd.DataFrame({"year_month": test.loc[ok, "year_month"], "obs": test.loc[ok, "ref"],
                                   "pred": mu[ok], "var": var[ok]}).groupby("year_month").sum().assign(year=y))
        nb, clim = fit_regression(panel, others, "nb")
        n = metrics(test, *predict_regression(nb, clim, test))
        rows.append({"year": y, **{f"ratio_{k}": v for k, v in m.items()},
                     **{f"nb_{k}": v for k, v in n.items() if k not in ("n_cell_months", "n_months")}})
        print(f"  LOYO {y}: ratio bias {m['relative_bias_total']:+.3f} MdAPE {m['mdape_monthly_area']:.3f} | "
              f"NB bias {n['relative_bias_total']:+.3f}")
    return pd.DataFrame(rows), pd.concat(areas)


def calibrate_variance(loyo_area, test, mu, var, alpha):
    """DE-16: one variance inflation factor lambda, so that 90 % of the monthly area totals of the
    leave-one-year-out years 2015-2025 fall inside +/- 1.645*sqrt(lambda * summed variance).
    Tested on the backcast years 2012-2014, which are not used to fit lambda."""
    fit_part = loyo_area[loyo_area["year"].isin(list(CALIB_YEARS)) & (loyo_area["var"] > 0)]
    z = (fit_part["obs"] - fit_part["pred"]).abs() / np.sqrt(fit_part["var"])
    lam = max(1.0, float((np.quantile(z, 0.90) / Z90) ** 2))
    var_c = var * lam
    alpha_c = ((var_c - mu) / mu ** 2).where(mu > 0, alpha)  # NB2 alpha giving the inflated variance
    before, after = metrics(test, mu, var, alpha), metrics(test, mu, var_c, alpha_c)
    return {"lambda": lam, "fitted_on_loyo_years": [CALIB_YEARS[0], CALIB_YEARS[-1]],
            "n_months_fitted": int(len(fit_part)),
            "backcast_pi90_coverage_area": {"before": before["pi90_coverage_area"],
                                            "after": after["pi90_coverage_area"]},
            "backcast_pi90_coverage_cell": {"before": before["pi90_coverage_cell"],
                                            "after": after["pi90_coverage_cell"]}}


def sensitivity_training_window(panel, loyo):
    """DE-15 sensitivity to the training window (orbital drift): backcast with early vs late training years,
    and the trend of the leave-one-year-out bias with the year."""
    test = _split(panel, BACKCAST_TEST)
    out = {}
    for label, years in (("train_2015_2019", range(2015, 2020)), ("train_2020_2025", range(2020, 2026))):
        mu, _, _ = predict_ratio(hz.fit(panel, years), test)
        m = metrics(test, mu)
        out[label] = {"relative_bias_total": m["relative_bias_total"], "mdape_monthly_area": m["mdape_monthly_area"]}
    rho = stats.spearmanr(loyo["year"], loyo["ratio_relative_bias_total"])
    out["loyo_bias_vs_year_spearman"] = float(rho.statistic)
    out["loyo_bias_vs_year_p"] = float(rho.pvalue)
    return out


def sensitivity_viirs_low_confidence(panel):
    """DE-10 sensitivity at area level: share of low-confidence VIIRS detections, and the backcast of the ratio
    method with them removed from the reference. MODIS is not filtered: its class cut-offs are not verified."""
    files = sorted(CLEAN_DIR.glob("viirs-*.csv.gz"))
    v = pd.concat([pd.read_csv(f, usecols=["acq_date", "sat", "confidence"], dtype=str) for f in files],
                  ignore_index=True)
    v["year_month"] = v["acq_date"].str[:7]
    share = v.groupby("sat")["confidence"].apply(lambda s: float((s == "l").mean())).to_dict()
    low = v[v["confidence"].eq("l")].groupby(["year_month", "sat"]).size()
    p = panel[panel["ref"].notna()]
    area = p.groupby("year_month").agg(ref=("ref", "sum"), ref_sat=("ref_sat", "first"), month=("month", "first"),
                                       Terra=("Terra", lambda s: s.sum(min_count=1)),
                                       Aqua=("Aqua", lambda s: s.sum(min_count=1)))
    area["ref_no_low"] = area["ref"] - [low.get((ym, s), 0) for ym, s in zip(area.index, area["ref_sat"])]
    area["modis"] = area["Terra"] + area["Aqua"]
    area["year"] = area.index.str[:4].astype(int)
    out = {"low_confidence_share_by_satellite": share}
    for col in ("ref", "ref_no_low"):
        tr = area[area["year"].isin(list(BACKCAST_TRAIN)) & area["modis"].notna()]
        te = area[area["year"].isin(list(BACKCAST_TEST)) & area["modis"].notna()]
        g = tr.groupby("month")[[col, "modis"]].sum()
        pred = te["month"].map(g[col] / g["modis"]) * te["modis"]
        pos = te[col] > 0
        out[f"backcast_area_{col}"] = {
            "relative_bias_total": float(pred.sum() / te[col].sum() - 1),
            "mdape_monthly_area": float(np.median((pred[pos] - te.loc[pos, col]).abs() / te.loc[pos, col]))}
    return out


def check_continuity_across_viirs_satellites(panel):
    """Monthly area totals of NOAA-20 vs S-NPP where both are valid. NOAA-21 needs API data (DE-8)."""
    both = panel[panel["SNPP"].notna() & panel["NOAA20"].notna()]
    area = both.groupby("year_month")[["SNPP", "NOAA20"]].sum()
    pos = area[area["SNPP"] > 0]
    ratio = pos["NOAA20"] / pos["SNPP"]
    summary = {
        "months_both_valid": int(len(area)),
        "total_ratio_noaa20_to_snpp": float(area["NOAA20"].sum() / area["SNPP"].sum()),
        "monthly_ratio_median": float(ratio.median()),
        "monthly_ratio_q25": float(ratio.quantile(0.25)),
        "monthly_ratio_q75": float(ratio.quantile(0.75)),
        "noaa21": "not in the FIRMS country CSVs; needs API data from 2024-01 (DE-8)",
    }
    return summary, area


def ratio_stability(panel):
    """Annual VIIRS/MODIS (Terra + Aqua) ratio in the overlap, and whether it changes with fire activity:
    the ratio method assumes it does not, also in the high-fire MODIS-only years."""
    p = panel[panel["ref"].notna() & panel["Terra"].notna() & panel["Aqua"].notna()]
    y = p.assign(year=p["year_month"].str[:4], modis=p["Terra"] + p["Aqua"]).groupby("year")[["ref", "modis"]].sum()
    y["ratio"] = y["ref"] / y["modis"]
    rho = stats.spearmanr(y["modis"], y["ratio"])
    return {"annual_ratio_min": float(y["ratio"].min()), "annual_ratio_max": float(y["ratio"].max()),
            "spearman_modis_total_vs_ratio": float(rho.statistic), "spearman_p": float(rho.pvalue),
            "n_years": int(len(y)), "max_annual_modis_in_overlap": float(y["modis"].max())}, y


def estimate_uncertainty(harmonized):
    """Relative standard error of the area total in estimated months (summed variances, independent cells)."""
    est = harmonized[harmonized["estimated"].eq(1)].groupby("year_month")[["viirs_eq", "viirs_eq_var"]].sum()
    rse = np.sqrt(est["viirs_eq_var"]) / est["viirs_eq"]
    return {"estimated_months": int(len(est)), "area_rse_median": float(rse.median()),
            "area_rse_q90": float(rse.quantile(0.9))}


def _save(fig, name):
    fig.text(0.01, 0.01, SOURCE_NOTE, fontsize=7)
    path = FIGURES / name
    fig.savefig(path, dpi=130, bbox_inches="tight")
    plt.close(fig)
    return path


def before_after_figure(harmonized, lam):
    """Area totals per month: uncorrected baseline vs harmonized VIIRS-scale series (does the series jump in 2012?).
    The band uses the calibrated variance (model variance x lambda, DE-16)."""
    a = harmonized.groupby("year_month").agg(baseline=("baseline", lambda s: s.sum(min_count=1)),
                                             harmonized=("viirs_eq", lambda s: s.sum(min_count=1)),
                                             var=("viirs_eq_var", "sum"))
    a["var"] *= lam
    x = pd.to_datetime(a.index)
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(x, a["baseline"], color="0.6", lw=1, label="Baseline, no correction (raw MODIS, then raw VIIRS)")
    ax.plot(x, a["harmonized"], color="C3", lw=1.2, label="Harmonized, VIIRS 375 m scale")
    band = a["var"] > 0
    ax.fill_between(x[band], (a["harmonized"] - Z90 * np.sqrt(a["var"]))[band].clip(lower=0),
                    (a["harmonized"] + Z90 * np.sqrt(a["var"]))[band], color="C3", alpha=0.2,
                    label="90 % interval (estimated months, calibrated, DE-16)")
    ax.axvline(pd.Timestamp(hz.FIRST_NATIVE + "-01"), color="k", ls="--", lw=0.8)
    ax.set_ylabel("Hotspots per month (area total)")
    ax.set_title("Before/after harmonization: converted from MODIS until 2012-01, native VIIRS after")
    ax.legend(loc="upper left", fontsize=8)
    return _save(fig, "before_after.png")


def backcast_figure(test):
    a = test.groupby("year_month")[["ref", "pred_ratio", "pred_nb"]].sum()
    x = pd.to_datetime(a.index)
    fig, ax = plt.subplots(figsize=(9, 3.5))
    ax.plot(x, a["ref"], "k", lw=1.5, label="Observed VIIRS (S-NPP)")
    ax.plot(x, a["pred_ratio"], "C3", lw=1.2, label="From MODIS: ratio per month (production)")
    ax.plot(x, a["pred_nb"], "C0", lw=1, ls="--", label="From MODIS: negative binomial regression")
    ax.set_ylabel("Hotspots per month (area total)")
    ax.set_title("Backcast: fitted on 2015-2025, tested on 2012-2014")
    ax.legend(fontsize=8)
    return _save(fig, "backcast.png")


def continuity_figure(area):
    x = pd.to_datetime(area.index)
    fig, ax = plt.subplots(figsize=(9, 3.5))
    ax.plot(x, area["SNPP"], "C0", lw=1.2, label="S-NPP")
    ax.plot(x, area["NOAA20"], "C1", lw=1.2, label="NOAA-20")
    ax.set_ylabel("Hotspots per month (area total)")
    ax.set_title("VIIRS continuity: S-NPP vs NOAA-20 (months where both are valid)")
    ax.legend(fontsize=8)
    return _save(fig, "continuity.png")


def main():
    RESULTS.mkdir(parents=True, exist_ok=True)
    FIGURES.mkdir(parents=True, exist_ok=True)
    panel = hz.add_reference(hz.build_panel(pd.read_csv(hz.COUNTS), pd.read_csv(hz.FLAGS)))
    harmonized = pd.read_csv(hz.OUT, dtype={"year_month": str})

    backcast, test = validate_on_held_out_years(panel)
    print("backcast:", json.dumps(backcast, indent=1))
    loyo, loyo_area = leave_one_year_out(panel)
    loyo.to_csv(RESULTS / "loyo.csv", index=False)
    bt = _split(panel, BACKCAST_TEST)
    calibration = calibrate_variance(loyo_area, bt, *predict_ratio(hz.fit(panel, BACKCAST_TRAIN), bt))
    (RESULTS / "uncertainty_calibration.json").write_text(json.dumps(
        {"lambda": calibration["lambda"], "decision": "method/DECISIONS.md DE-16",
         "details": "method/results/validation_metrics.json -> uncertainty_calibration"}, indent=2) + "\n")
    sensitivity = {
        "training_window": sensitivity_training_window(panel, loyo),
        "viirs_low_confidence": sensitivity_viirs_low_confidence(panel),
        "grid_size": "not run: the ratio per month of year is fitted on area sums, so k and every area total are "
                     "the same for any cell size; only the split between cells changes",
    }
    continuity, area = check_continuity_across_viirs_satellites(panel)
    area.to_csv(RESULTS / "continuity.csv")
    stability, annual = ratio_stability(panel)
    annual.to_csv(RESULTS / "annual_ratio.csv")
    est = harmonized[harmonized["estimated"].eq(1)]
    annual_modis_est = (est.assign(year=est["year_month"].str[:4]).groupby("year")[["Terra", "Aqua"]]
                        .sum(min_count=1).sum(axis=1))
    stability["max_annual_modis_in_estimated_years"] = float(annual_modis_est.max())
    stability["estimated_years_above_overlap_max"] = sorted(
        annual_modis_est[annual_modis_est > stability["max_annual_modis_in_overlap"]].index.tolist())
    overlap = _split(panel, BACKCAST_TEST)
    jump = float(overlap["ref"].sum() / overlap[["Terra", "Aqua"]].sum(axis=1, min_count=1).sum())
    registered = {k: backcast[k]["mdape_monthly_area"] for k in ("ratio_per_month", "count_regression_nb")}
    result = {
        "protocol": "method/DECISIONS.md DE-15",
        "backcast_train_years": [BACKCAST_TRAIN[0], BACKCAST_TRAIN[-1]],
        "backcast_test_years": [BACKCAST_TEST[0], BACKCAST_TEST[-1]],
        "backcast": backcast,
        "selection": {"pre_registered_mdape": registered, "best": min(registered, key=registered.get),
                      "simplest": "ratio_per_month",
                      "rule": "simplest method within a margin of the best backcast score (DE-15)"},
        "loyo_file": "method/results/loyo.csv",
        "raw_ratio_viirs_to_modis_2012_2014": jump,
        "ratio_stability": stability,
        "annual_ratio_file": "method/results/annual_ratio.csv",
        "continuity": continuity,
        "uncertainty": estimate_uncertainty(harmonized),
        "uncertainty_calibration": calibration,
        "sensitivity": sensitivity,
    }
    (RESULTS / "validation_metrics.json").write_text(json.dumps(result, indent=2) + "\n")
    for p in (before_after_figure(harmonized, calibration["lambda"]), backcast_figure(test), continuity_figure(area)):
        print("wrote", p.relative_to(ROOT))
    print("wrote method/results/validation_metrics.json, loyo.csv, continuity.csv")


if __name__ == "__main__":
    main()
