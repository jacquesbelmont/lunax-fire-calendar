"""Harmonize MODIS and VIIRS monthly series on the VIIRS 375 m scale (DE-2, DE-6, DE-11).

Owner issues: RA-2, DE-2. SCOPE: R2.
Provides a baseline without correction plus the team-chosen statistical method.
Never sum raw MODIS and VIIRS counts.
AI-assisted code (Claude Code); logged in AI_USE.md.

Method (method/DECISIONS.md):
- Target scale (DE-2): monthly count of the reference VIIRS satellite per cell (DE-11):
  S-NPP from 2012-02 to 2018-03, NOAA-20 from 2018-04. These months are native: no conversion.
- MODIS-only months (2000-11 to 2012-01; January 2012 because S-NPP starts on 2012-01-20) are converted
  with a ratio per month of year (DE-6 option 2), selected by the DE-15 backcast (see pipeline/validate.py):
      VIIRS_eq = k(month of year) x MODIS,   k = sum(reference VIIRS) / sum(MODIS) over the training months
  configuration "TA": MODIS = Terra + Aqua (both MODIS; MODIS and VIIRS are never summed) when both are valid;
  configuration "T": MODIS = Terra only otherwise (2000-11 to 2002-06, and months with Aqua flagged).
- Uncertainty: variance mu + alpha*mu^2, alpha by the method of moments on the training rows.
- A month without valid data for the satellite(s) it needs (not covered or flagged, DE-14) gets no value
  (NaN, model "missing"), never zero.

Usage:
    python pipeline/harmonize.py [--train 2015 2025] [--check]
Reads data/interim/monthly_counts.csv.gz and data/interim/month_flags.csv (aggregate.py). Writes
data/interim/harmonized.csv.gz (one row per active cell and month; git-ignored) and
method/results/harmonize_model.json (ratios and dispersion per configuration).
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
COUNTS = ROOT / "data" / "interim" / "monthly_counts.csv.gz"
FLAGS = ROOT / "data" / "interim" / "month_flags.csv"
OUT = ROOT / "data" / "interim" / "harmonized.csv.gz"
MODEL_OUT = ROOT / "method" / "results" / "harmonize_model.json"

SATS = ["Terra", "Aqua", "SNPP", "NOAA20", "NOAA21"]
FIRST_NATIVE = "2012-02"  # DE-11
NOAA20_FROM = "2018-04"  # DE-11
TRAIN_DEFAULT = (2015, 2025)  # DE-15
NEEDS = {"TA": ["Terra", "Aqua"], "T": ["Terra"]}


def build_panel(counts, flags):
    """Dense table of active cells × covered months, one column per satellite.

    A satellite value is its count (0 when the cell has no row) if that satellite-month is covered and not
    flagged; NaN otherwise (no data, never zero fire).
    """
    cells = counts[["cell_id", "cell_lat", "cell_lon"]].drop_duplicates()
    months = pd.DataFrame({"year_month": sorted(flags["year_month"].unique())})
    panel = cells.merge(months, how="cross")
    wide = counts.pivot_table(index=["cell_id", "year_month"], columns="sat", values="count", aggfunc="sum")
    panel = panel.join(wide, on=["cell_id", "year_month"])
    valid = flags[flags["flagged"].eq(0)]
    for sat in SATS:
        ok = panel["year_month"].isin(set(valid.loc[valid["sat"].eq(sat), "year_month"]))
        col = panel[sat] if sat in panel else pd.Series(np.nan, index=panel.index)
        panel[sat] = col.fillna(0).where(ok)
    panel["month"] = panel["year_month"].str[5:7]
    return panel


def add_reference(panel):
    """Reference VIIRS satellite and count per DE-11 (empty before FIRST_NATIVE)."""
    ym = panel["year_month"]
    ref_sat = np.where(ym >= NOAA20_FROM, "NOAA20", np.where(ym >= FIRST_NATIVE, "SNPP", ""))
    ref = np.where(ref_sat == "NOAA20", panel["NOAA20"], np.where(ref_sat == "SNPP", panel["SNPP"], np.nan))
    return panel.assign(ref_sat=ref_sat, ref=ref)


def baseline_without_correction(panel):
    """Uncorrected comparison series (RA-3 jump figure only, never exported as harmonized):
    raw MODIS (Terra + Aqua, the same sensor) until 2012-01, raw reference VIIRS after."""
    modis = panel[["Terra", "Aqua"]].sum(axis=1, min_count=1)
    return pd.Series(np.where(panel["year_month"] < FIRST_NATIVE, modis, panel["ref"]), index=panel.index)


def fit(panel, years):
    """Ratio per month of year and dispersion for each MODIS configuration, on valid months of the training years."""
    year = panel["year_month"].str[:4].astype(int)
    t = panel[year.isin(list(years)) & panel["ref"].notna()]
    params = {}
    for name, cols in NEEDS.items():
        d = t.dropna(subset=cols)
        modis = d[cols].sum(axis=1)
        g = d.assign(modis=modis).groupby("month")[["ref", "modis"]].sum()
        k = (g["ref"] / g["modis"]).replace([np.inf, -np.inf], np.nan)
        mu = d["month"].map(k) * modis
        pos = mu > 0
        alpha = max(0.0, float((((d["ref"] - mu) ** 2 - mu)[pos]).sum() / (mu[pos] ** 2).sum()))
        params[name] = {"modis": " + ".join(cols), "k_by_month": {m: float(v) for m, v in k.items()},
                        "alpha": alpha, "n_obs": int(len(d))}
    return params


def predict_from_modis(rows, params, only=None):
    """VIIRS-scale prediction from MODIS for the given rows. Returns DataFrame (mu, var, model).

    Configuration TA when Terra and Aqua are both valid, T when only Terra is; only="T" forces Terra only.
    Rows without valid MODIS get NaN and model "missing".
    """
    res = pd.DataFrame({"mu": np.nan, "var": np.nan, "model": "missing"}, index=rows.index)
    use_ta = rows["Terra"].notna() & rows["Aqua"].notna() & (only != "T")
    use_t = rows["Terra"].notna() & ~use_ta
    for name, mask in (("TA", use_ta), ("T", use_t)):
        if mask.any():
            p = params[name]
            mu = rows.loc[mask, "month"].map(p["k_by_month"]) * rows.loc[mask, NEEDS[name]].sum(axis=1)
            ok = mu.index[mu.notna()]
            res.loc[ok, "mu"] = mu[ok]
            res.loc[ok, "var"] = mu[ok] + p["alpha"] * mu[ok] ** 2
            res.loc[ok, "model"] = name
    return res


def harmonize(panel, params):
    """Harmonized VIIRS-scale value per cell-month: native reference VIIRS from 2012-02, converted MODIS before."""
    out = panel.copy()
    native = out["year_month"] >= FIRST_NATIVE
    out["viirs_eq"] = out["ref"].where(native)
    out["viirs_eq_var"] = np.where(native & out["ref"].notna(), 0.0, np.nan)
    out["estimated"] = 0
    out["model"] = np.where(native & out["ref"].notna(), "native", "missing")
    pred = predict_from_modis(out[~native], params)
    ok = pred.index[pred["model"].ne("missing")]
    out.loc[ok, "viirs_eq"] = pred.loc[ok, "mu"]
    out.loc[ok, "viirs_eq_var"] = pred.loc[ok, "var"]
    out.loc[ok, "estimated"] = 1
    out.loc[ok, "model"] = pred.loc[ok, "model"]
    out["baseline"] = baseline_without_correction(out)
    cols = ["cell_id", "cell_lat", "cell_lon", "year_month", "viirs_eq", "viirs_eq_var", "estimated", "model",
            "ref_sat", "baseline"] + SATS
    return out[cols]


def check(out):
    """Invariants on real output. Do not run Python with -O: asserts must stay on."""
    assert not out.duplicated(["cell_id", "year_month"]).any(), "duplicate cell-month"
    assert (out["viirs_eq"].dropna() >= 0).all(), "negative value"
    assert (out["viirs_eq_var"].dropna() >= 0).all(), "negative variance"
    assert out.loc[out["estimated"].eq(1), "year_month"].lt(FIRST_NATIVE).all(), "estimate in a native month"
    nat = out["model"].eq("native")
    ref = np.where(out.loc[nat, "ref_sat"].eq("NOAA20"), out.loc[nat, "NOAA20"], out.loc[nat, "SNPP"])
    assert np.array_equal(out.loc[nat, "viirs_eq"].to_numpy(), ref), "native value differs from reference count"
    assert out.loc[out["model"].eq("missing"), "viirs_eq"].isna().all(), "value in a missing month"
    print("check: OK")


def main(argv=None):
    p = argparse.ArgumentParser(description="Harmonize MODIS and VIIRS monthly counts on the VIIRS scale.")
    p.add_argument("--train", nargs=2, type=int, default=list(TRAIN_DEFAULT), metavar=("FIRST_YEAR", "LAST_YEAR"))
    p.add_argument("--check", action="store_true", help="assert invariants on the output")
    a = p.parse_args(argv)
    panel = add_reference(build_panel(pd.read_csv(COUNTS), pd.read_csv(FLAGS)))
    params = fit(panel, range(a.train[0], a.train[1] + 1))
    out = harmonize(panel, params)
    if a.check:
        check(out)
    out.to_csv(OUT, index=False)
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    summary = {"method": "ratio per month of year (DE-6 option 2), selected by the DE-15 backcast",
               "train_years": a.train,
               "reference": {"SNPP": f"{FIRST_NATIVE} to 2018-03", "NOAA20": f"from {NOAA20_FROM}"},
               "configurations": params}
    MODEL_OUT.write_text(json.dumps(summary, indent=2) + "\n")
    print(f"{OUT.relative_to(ROOT)}: {len(out)} rows ({out['cell_id'].nunique()} cells); "
          f"by model {out['model'].value_counts().to_dict()}")
    for name, prm in params.items():
        ks = prm["k_by_month"].values()
        print(f"{name}: n={prm['n_obs']} alpha={prm['alpha']:.3f} k range {min(ks):.2f}-{max(ks):.2f}")


if __name__ == "__main__":
    main()
