"""RA-11 (issue #66): Brazil "area packs" from the pilot outputs, with the DE-31 state ratios. Local only (git-ignored data).

Owner issue: RA-11. SCOPE: none in the hackathon scope; post-submission exploration (DE-31 PROPOSED).
AI-assisted code (Claude Code); logged in AI_USE.md.

Reads what pipeline/pilot_brazil.py wrote in data/pilot/brazil/ (per state: monthly_cells.csv and municipalities.csv with the
raw counts per satellite, hotspots_<year>.csv.gz; states.csv; the IBGE boundaries) and, for each state:
- runs the DE-31 test: the ratio per month of year fitted on 2015-2025 and backcast on 2012-2014 (harmonize.fit,
  validate.predict_ratio, validate.metrics, as DE-15), and the DE-16 lambda from the ratio's leave-one-year-out;
- if the state passes, converts its MODIS-only months with its own ratios (harmonize.harmonize); otherwise those months
  stay raw (viirs_eq empty, labelled not harmonized);
- writes a pack the app reads like docs/data: metadata.json, monthly_cells.csv, months.csv, area.geojson,
  municipalities.csv and .geojson, hotspots/index.json and hotspots/hotspots_<year>.csv.gz.
Also writes the national pack BR/ (the 27 states as units), places.json (states and municipalities for the search) and
method/results/state_ratios.json. DE-32: each state pack also gets recurrence.csv (the DE-26 layer) and its hindcast,
written to method/results/state_recurrence.json. DE-33: the DE-28 outlook test per state (method/outlook_hindcast.js on
its municipalities; the national pack on the 27 states) and the DE-29 test and 2027 forecast per state (--cell-outlook UF:
cell_outlook.run on an existing pack, slow, about Rondonia's 85 s per Rondonia-size area; states are independent, so they
can run in parallel processes). Results go to method/results/state_outlook.json.

Usage:
    python pipeline/pilot_packs.py --check                       (after pipeline/pilot_brazil.py)
    python pipeline/pilot_packs.py --cell-outlook PA AM          (DE-29 for these packs only: no rebuild; rerun --check after)
"""

import argparse
import copy
import gzip
import json
import resource
import subprocess
import time
from pathlib import Path

import numpy as np
import pandas as pd

import clean
import harmonize as hz
import validate as va

ROOT = Path(__file__).resolve().parent.parent
PILOT = ROOT / "data" / "pilot" / "brazil"
OUT = ROOT / "method" / "results" / "state_ratios.json"
OUTLOOK = ROOT / "method" / "results" / "state_outlook.json"  # DE-33
COLS = {"terra": "Terra", "aqua": "Aqua", "snpp": "SNPP", "noaa20": "NOAA20", "noaa21": "NOAA21"}
RULE = {"max_abs_bias": 0.10, "max_mdape": 0.25, "min_months": 12}  # DE-31, fixed before any state was fitted
GRID = 0.25


def no_nan(x):
    """JSON has no NaN: replace it with null everywhere (e.g. a correlation that cannot be computed)."""
    if isinstance(x, dict):
        return {k: no_nan(v) for k, v in x.items()}
    if isinstance(x, list):
        return [no_nan(v) for v in x]
    return None if isinstance(x, float) and x != x else x


def panel_from_series(path, id_col):
    """A pilot series file (raw counts per satellite, empty = flagged or not covered) as a harmonize panel."""
    d = pd.read_csv(path, dtype={id_col: str, "year_month": str})
    p = d.rename(columns={id_col: "cell_id", **COLS})[["cell_id", "year_month", *COLS.values()]].astype({s: float for s in COLS.values()})
    if id_col == "cell_id":
        rc = p["cell_id"].str.split("_", expand=True).astype(int)
        p["cell_lat"], p["cell_lon"] = (rc[0] + 0.5) * GRID - 90, (rc[1] + 0.5) * GRID - 180
    else:
        p["cell_lat"] = p["cell_lon"] = 0.0
    return hz.add_reference(p.assign(month=p["year_month"].str[5:7]))


def de31_test(panel):
    """DE-31: backcast as DE-15 and the DE-16 lambda. Returns (metrics, passed, lambda)."""
    bt = va._split(panel, va.BACKCAST_TEST)
    mu, var, alpha = va.predict_ratio(hz.fit(panel, va.BACKCAST_TRAIN), bt)
    months = int((bt.groupby("year_month")["ref"].sum() > 0).sum())
    m = {"months_with_detections": months}
    if months:
        m.update(va.metrics(bt, mu, var, alpha))
    passed = (months >= RULE["min_months"] and abs(m["relative_bias_total"]) <= RULE["max_abs_bias"]
              and m["mdape_monthly_area"] <= RULE["max_mdape"])
    # DE-16 lambda from the ratio part of the leave-one-year-out (validate.leave_one_year_out also fits the NB
    # comparator, which lambda does not use)
    areas = []
    for y in va.LOYO_YEARS:
        test = va._split(panel, [y])
        mu_y, var_y, _ = va.predict_ratio(hz.fit(panel, [z for z in va.LOYO_YEARS if z != y]), test)
        ok = mu_y.notna()
        areas.append(pd.DataFrame({"year_month": test.loc[ok, "year_month"], "obs": test.loc[ok, "ref"], "pred": mu_y[ok],
                                   "var": var_y[ok]}).groupby("year_month").sum().assign(year=y))
    lam = va.calibrate_variance(pd.concat(areas), bt, mu, var, alpha)["lambda"] if months else float("nan")
    return m, bool(passed), lam


def series(panel, params, passed, lam, id_col):
    """Harmonized series in the DATA_CONTRACT (a) columns; MODIS-only months stay empty when the state failed DE-31."""
    out = hz.harmonize(panel, params)
    est = out["estimated"].eq(1)
    out.loc[est, "viirs_eq_var"] = out.loc[est, "viirs_eq_var"] * lam
    if not passed:
        out.loc[est, ["viirs_eq", "viirs_eq_var"]] = np.nan
        out.loc[est, "estimated"] = 0
    out = out.rename(columns={"cell_id": id_col, **{v: k for k, v in COLS.items()}})
    for c in COLS:
        out[c] = out[c].astype("Int64")
    return out[[id_col, "year_month", "viirs_eq", "viirs_eq_var", "estimated", *COLS]]


def hotspot_index(folder):
    """Move hotspots_<year>.csv.gz into hotspots/ and write the DE-17 index (the app reads only the years it needs)."""
    hdir = folder / "hotspots"
    hdir.mkdir(exist_ok=True)
    for f in folder.glob("hotspots_*.csv.gz"):
        f.rename(hdir / f.name)
    files, columns = [], None
    for f in sorted(hdir.glob("hotspots_*.csv.gz")):
        with gzip.open(f, "rt", encoding="utf-8") as fh:
            lines = [l for l in fh if not l.startswith("#")]
        columns = columns or lines[0].strip().split(",")
        files.append({"source": "all", "year": int(f.name[9:13]), "file": f.name, "rows": len(lines) - 1, "bytes": f.stat().st_size})
    (hdir / "index.json").write_text(json.dumps({"columns": columns, "files": files}, indent=1) + "\n")


def reference_points(folder):
    """The DE-11 reference VIIRS detections of a pack (2012 on), from its hotspot files."""
    import export  # matplotlib/scipy; only needed here
    pts = pd.concat([pd.read_csv(f, comment="#", usecols=["latitude", "longitude", "acq_date", "sat"], dtype={"acq_date": str, "sat": str})
                     for f in sorted((folder / "hotspots").glob("hotspots_*.csv.gz")) if int(f.name[9:13]) >= 2012], ignore_index=True)
    return export.reference_rows(pts)


def state_recurrence(folder):
    """DE-32: the DE-26 layer (recurrence.csv in the pack) and its hindcast, from the state's reference VIIRS detections."""
    import export
    ref = reference_points(folder)
    rec = export.recurrence(ref, export.RECURRENCE_YEARS)
    assert rec["detections"].sum() == ref["acq_date"].str[:4].astype(int).isin(export.RECURRENCE_YEARS).sum(), "recurrence total"
    rec.to_csv(folder / "recurrence.csv", index=False)
    return va.recurrence_hindcast_numbers(ref)


def de28(series_csv, folder):
    """DE-33: the DE-28 test (method/outlook_hindcast.js, unchanged) on an area's units; returns metadata `outlook`."""
    out = folder / "outlook_hindcast.json"
    subprocess.run(["node", str(ROOT / "method" / "outlook_hindcast.js"), str(series_csv), str(out)], check=True)
    h = json.loads(out.read_text())
    n = int(h["areas"].split()[0])  # "<n> areas, <file> viirs_eq"
    return {"decision": "method/DECISIONS.md DE-33 (DE-28 per area, PROPOSED)", "areas": f"the {n} {'states' if folder.name == 'BR' else 'municipalities'}",
            **{k: h[k] for k in ("test_years", "fresh_year", "pre_season", "early_season")}}


def de29(folder):
    """DE-33: the DE-29 test and 2027 forecast (cell_outlook.run, unchanged) on an existing state pack. Writes
    cell_outlook_<scale>.csv and cell_outlook.json, and adds `cell_outlook` to its metadata.json (the app shows it at once)."""
    import cell_outlook as co
    import export
    t = time.perf_counter()
    path = folder / "metadata.json"
    meta = json.loads(path.read_text())
    res, forecasts = co.run(reference_points(folder), tuple(meta["area"]["bbox_west_south_east_north"]),
                            clean.load_boundary(folder / "area.geojson"), folder / "monthly_cells.csv")
    for key, fc in forecasts.items():
        export.outlook_rows(fc).to_csv(folder / f"cell_outlook_{key}.csv", index=False)
    meta["cell_outlook"] = no_nan({**export.cell_outlook_meta(res), "decision": "method/DECISIONS.md DE-33 (DE-29 per state, PROPOSED)",
                                   "seconds": round(time.perf_counter() - t, 1)})
    (folder / "cell_outlook.json").write_text(json.dumps(meta["cell_outlook"], indent=1) + "\n")
    path.write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")
    print(f"{folder.name}: DE-29 {meta['cell_outlook']['seconds']} s, peak {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024} MB, "
          f"shown {[s['shown'] for s in meta['cell_outlook']['scales'].values()]}", flush=True)


def metadata(template, name, code, bbox, test, passed, lam, params, level):
    m = copy.deepcopy(template)
    for k in ("recurrence", "cell_outlook", "files"):  # recurrence is added per state (DE-32); no cell outlook without 2026 data
        m.pop(k, None)
    m["title"] = "LUNAX Brazil pilot (local, not published) - " + name
    m["area"] = {"name": name + " (IBGE; Brazil pilot, local)", "bbox_west_south_east_north": bbox, "boundary_file": "area.geojson",
                 "boundary_source": "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&qualidade=intermediaria",
                 "rule": "detections of the FIRMS files of Brazil and Bolivia inside the IBGE polygon; outside is not zero fire",
                 "code": code, "level": level}
    m["period"] = {"first_month": "2000-11", "last_month": "2026-10"}
    m["data_cutoff_date"] = "2026-10-31"
    m["archived"] = ("Archived FIRMS data, not live: country files to 2025, then the FIRMS area API to 2026-10-31 (near real-time "
                     "rows provisional). Brazil pilot, local only.")
    m["method"]["estimated_months"] = ("2000-11 to 2012-01: viirs_eq = k(month of year) x MODIS with this state's own ratios, "
                                       "which passed the DE-31 backcast test" if passed else
                                       "2000-11 to 2012-01: not harmonized (this state's ratios failed the DE-31 test); raw MODIS only")
    m["method"]["k_by_month"] = {k: v["k_by_month"] for k, v in params.items()} if params else None
    m["method"]["alpha"] = {k: v["alpha"] for k, v in params.items()} if params else None  # DE-37: the app harmonizes a user's area
    m["method"]["uncertainty_lambda"] = None if lam != lam else lam  # JSON has no NaN (the national level has no single lambda)
    m["method"]["decisions"] = "method/DECISIONS.md DE-31 (PROPOSED)"
    m["state_test"] = {"rule": RULE, "passed": passed, **test}
    return m


def main(argv=None):
    p = argparse.ArgumentParser(description="RA-11: Brazil area packs with the DE-31 state ratios.")
    p.add_argument("--check", action="store_true")
    p.add_argument("--cell-outlook", nargs="+", metavar="UF", help="only the DE-29 test and forecast of these existing packs")
    a = p.parse_args(argv)
    if a.cell_outlook:
        for uf in a.cell_outlook:
            de29(PILOT / uf)
        return
    template = json.loads((ROOT / "docs" / "data" / "metadata.json").read_text())
    states = json.loads((PILOT / "states.geojson").read_text(encoding="utf-8"))["features"]
    flags = pd.read_csv(PILOT / "months.csv", dtype={"year_month": str})  # (a2) with provisional months (pilot_brazil.py)
    outlooks = {}
    results, national, recurrence = {}, [], {}
    for ft in states:
        code, name = ft["properties"]["code"], ft["properties"]["name"]
        folder = PILOT / name
        cells = panel_from_series(folder / "monthly_cells.csv", "cell_id")
        test, passed, lam = de31_test(cells)
        params = hz.fit(cells, range(2015, 2026))  # production fit, as harmonize.py (2015-2025)
        out = series(cells, params, passed, lam, "cell_id")
        out.to_csv(folder / "monthly_cells.csv", index=False, float_format="%.6g")
        mun = series(panel_from_series(folder / "municipalities.csv", "area_id"), params, passed, lam, "area_id")
        mun.to_csv(folder / "municipalities.csv", index=False, float_format="%.6g")
        st = series(panel_from_series(PILOT / "states.csv", "area_id").query("cell_id == @code"), params, passed, lam, "area_id")
        national.append(st)
        flags[["year_month", "sat", "missing_days", "flagged", "provisional"]].to_csv(folder / "months.csv", index=False)
        (folder / "area.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [ft]}, ensure_ascii=False), encoding="utf-8")
        xy = np.vstack([np.asarray(r)[:, :2] for poly in ([ft["geometry"]["coordinates"]] if ft["geometry"]["type"] == "Polygon"
                                                          else ft["geometry"]["coordinates"]) for r in poly])
        bbox = [float(np.floor(xy[:, 0].min() / GRID) * GRID), float(np.floor(xy[:, 1].min() / GRID) * GRID),
                float(np.ceil(xy[:, 0].max() / GRID) * GRID), float(np.ceil(xy[:, 1].max() / GRID) * GRID)]
        hotspot_index(folder)
        meta = metadata(template, name, code, bbox, test, passed, lam, params, "state")
        h = state_recurrence(folder)
        meta["recurrence"] = {**{k: template["recurrence"][k] for k in ("file", "grid_deg", "years", "detections", "excluded")},
                              "decision": "method/DECISIONS.md DE-32 (PROPOSED)",
                              "hindcast": {k: h[k] for k in ("train_years", "k", "area_share", "test_years_pooled", "pooled", "fresh_2026")}}
        recurrence[name] = {k: h[k] for k in ("k", "cells_with_any_detection_train", "area_share", "pooled", "by_test_year", "fresh_2026")}
        o = outlooks.setdefault(name, {})
        meta["outlook"] = o["outlook"] = de28(folder / "municipalities.csv", folder)
        if (folder / "cell_outlook.json").exists():  # DE-29 of this pack (--cell-outlook), kept between rebuilds
            meta["cell_outlook"] = o["cell_outlook"] = json.loads((folder / "cell_outlook.json").read_text())
        (folder / "metadata.json").write_text(json.dumps(no_nan(meta), indent=1, ensure_ascii=False) + "\n")
        results[name] = {"code": code, "passed": passed, "lambda": lam, **test,
                         "k_by_month": {k: v["k_by_month"] for k, v in params.items()}}
        if a.check:
            native = out["year_month"].ge("2012-02") & out["viirs_eq"].notna()
            ref = np.where(out["year_month"].ge("2018-04"), out["noaa20"], out["snpp"]).astype(float)
            assert np.allclose(out.loc[native, "viirs_eq"], ref[native.to_numpy()]), f"{name}: observed months != reference"
            for col in COLS:
                assert out[col].sum() == mun[col].sum(), f"{name}: cells != municipalities ({col})"
        print(f"{name}: {'passed' if passed else 'FAILED'} bias {test.get('relative_bias_total', float('nan')):+.3f} "
              f"MdAPE {test.get('mdape_monthly_area', float('nan')):.3f} months {test['months_with_detections']} lambda {lam:.2f}", flush=True)
    # National pack: the 27 states as units (each harmonized with its own ratios, so the sum is consistent)
    br = PILOT / "BR"
    br.mkdir(exist_ok=True)
    pd.concat(national).to_csv(br / "units.csv", index=False, float_format="%.6g")
    (br / "units.geojson").write_text((PILOT / "states.geojson").read_text(encoding="utf-8"), encoding="utf-8")
    (br / "area.geojson").write_text((PILOT / "states.geojson").read_text(encoding="utf-8"), encoding="utf-8")
    flags[["year_month", "sat", "missing_days", "flagged", "provisional"]].to_csv(br / "months.csv", index=False)
    nm = metadata(template, "Brazil", "BR", [-74.0, -34.0, -28.75, 5.5], {"note": "per state, see state_ratios.json"},
                  all(r["passed"] for r in results.values()), float("nan"), None, "national")
    nm["method"]["estimated_months"] = ("2000-11 to 2012-01: each state with its own DE-31 ratios where it passed the test; the "
                                        "national total of a month is empty when any state is not harmonized")
    nm["outlook"] = outlooks.setdefault("BR", {})["outlook"] = de28(br / "units.csv", br)
    (br / "metadata.json").write_text(json.dumps(no_nan(nm), indent=1, ensure_ascii=False) + "\n")
    # Places for the search: states and municipalities with their state
    munis = json.loads((PILOT / "municipalities.geojson").read_text(encoding="utf-8"))["features"]
    uf = {f["properties"]["code"]: f["properties"]["name"] for f in states}
    full = {f["properties"]["code"]: f["properties"].get("full_name") for f in states}  # IBGE name, e.g. Pará (download.py)
    places = ([{"type": "state", "code": c, "name": n, "uf": n, **({"full_name": full[c]} if full[c] else {})} for c, n in uf.items()] +
              [{"type": "municipality", "code": f["properties"]["code"], "name": f["properties"]["name"],
                "uf": uf[f["properties"]["code"][:2]]} for f in munis])
    (PILOT / "places.json").write_text(json.dumps(places, ensure_ascii=False) + "\n", encoding="utf-8")
    # Rondonia's state fit against the published ratios (sanity check, reported)
    pub = json.loads((ROOT / "method" / "results" / "harmonize_model.json").read_text())["configurations"]["TA"]["k_by_month"]
    ro = results["RO"]["k_by_month"]["TA"]
    summary = {"decision": "method/DECISIONS.md DE-31 (PROPOSED)", "rule": RULE,
               "passed": sorted(k for k, v in results.items() if v["passed"]), "failed": sorted(k for k, v in results.items() if not v["passed"]),
               "rondonia_vs_published_TA_max_relative_difference": round(max(abs(ro[m] / pub[m] - 1) for m in pub), 4),
               "states": results}
    OUT.write_text(json.dumps(no_nan(summary), indent=1) + "\n")
    (OUT.parent / "state_recurrence.json").write_text(json.dumps(no_nan(
        {"decision": "method/DECISIONS.md DE-32 (PROPOSED)", "note": "Rondonia's published layer is DE-26 (recurrence_hindcast.json); "
         "the RO row here is the pilot's own, for comparison", "states": recurrence}), indent=1) + "\n")
    OUTLOOK.write_text(json.dumps(no_nan({"decision": "method/DECISIONS.md DE-33 (PROPOSED)", "note": "Rondonia's published results are "
                                          "DE-28 and DE-29; the RO row here is the pilot's own, for comparison", "states": outlooks}), indent=1) + "\n")
    print("passed:", len(summary["passed"]), "failed:", summary["failed"], "| RO vs published k (max rel. diff):",
          summary["rondonia_vs_published_TA_max_relative_difference"])


if __name__ == "__main__":
    main()
