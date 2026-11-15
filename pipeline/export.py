"""Write the app data files into docs/data/ per DATA_CONTRACT.md (format proposed on issue #5).

Owner issue: RA-2. SCOPE: R2, R3, R9.
This is the ONLY code that writes docs/data/.
AI-assisted code (Claude Code); logged in AI_USE.md.

Usage:
    python pipeline/export.py [--check]

Reads data/interim/harmonized.csv.gz and data/interim/month_flags.csv (harmonize.py, aggregate.py),
data/interim/clean/*.csv.gz (clean.py), config/area.json, config/municipalities.geojson (download.py, DE-24) and
method/results/harmonize_model.json. Writes:
- docs/data/monthly_cells.csv: one row per active cell and month. An empty value means no data (never zero fire).
- docs/data/months.csv: coverage and flags per satellite and month (DE-14).
- docs/data/metadata.json: area, source, versions, period, coverage, method, data cut-off date, grid, attribution.
- docs/data/municipalities.csv and municipalities.geojson: the same series per IBGE municipality (DE-24).
- docs/data/cell_outlook_001.csv and cell_outlook_005.csv: where to expect fire next season (DE-28); needs
  `python pipeline/cell_outlook.py` (method/results/cell_outlook_hindcast.json and data/interim/cell_outlook_2027_*.csv).
- docs/data/recurrence.csv: 0.01° cells with the number of years with a reference VIIRS detection (DE-26); needs
  method/results/recurrence_hindcast.json from `python pipeline/validate.py --recurrence`.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from matplotlib.path import Path as PolygonPath
from scipy.spatial import cKDTree

from aggregate import count_monthly
from harmonize import add_reference, build_panel, harmonize

ROOT = Path(__file__).resolve().parent.parent
HARMONIZED = ROOT / "data" / "interim" / "harmonized.csv.gz"
FLAGS = ROOT / "data" / "interim" / "month_flags.csv"
CLEAN_DIR = ROOT / "data" / "interim" / "clean"
AREA = ROOT / "config" / "area.json"
BOUNDARY = ROOT / "config" / "area_boundary.geojson"  # IBGE boundary of Rondonia (DE-1)
MUNICIPALITIES = ROOT / "config" / "municipalities.geojson"  # IBGE municipal boundaries (DE-24)
HINDCAST = ROOT / "method" / "results" / "recurrence_hindcast.json"  # DE-26, written by validate.py --recurrence
OUTLOOK = ROOT / "method" / "results" / "outlook_hindcast.json"  # DE-27, written by node method/outlook_hindcast.js
CELL_OUTLOOK = ROOT / "method" / "results" / "cell_outlook_hindcast.json"  # DE-28, written by pipeline/cell_outlook.py
INTERIM = ROOT / "data" / "interim"
RECURRENCE_GRID = 0.01  # DE-26: larger than every VIIRS pixel (max 0.80 km)
RECURRENCE_YEARS = [y for y in range(2012, 2026) if y != 2023]  # DE-26: 2023 misses reference days in July and September
MODEL = ROOT / "method" / "results" / "harmonize_model.json"
CALIBRATION = ROOT / "method" / "results" / "uncertainty_calibration.json"
DOCS_DATA = ROOT / "docs" / "data"
MAX_FILE_MB = 90  # GitHub rejects files over 100 MB

# Exact FIRMS acknowledgment text (method/FIRMS_REFERENCE.md section 10).
ATTRIBUTION = ("We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management "
               "System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time "
               "Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance) and NASA's Earth "
               "Science Data and Information System (ESDIS).")
DISCLAIMER_URL = "https://www.earthdata.nasa.gov/data/projects/lance#ed-lance-disclaimer"
AI_USE = ("AI tools used: Claude and Claude Code (Anthropic), for code, comparison of options for the method decisions, "
          "analyses and documentation. Every step is logged in AI_USE.md "
          "(https://github.com/jacquesbelmont/lunax-fire-calendar/blob/main/AI_USE.md). "
          "No AI-generated images, video or audio. Decisions were made by team members and are recorded in "
          "method/DECISIONS.md.")
SAT_COLUMNS = {"Terra": "terra", "Aqua": "aqua", "SNPP": "snpp", "NOAA20": "noaa20", "NOAA21": "noaa21"}


def hindcast_summary():
    """DE-26 hindcast numbers for the app (validate.py --recurrence writes them)."""
    if not HINDCAST.exists():
        raise FileNotFoundError(f"{HINDCAST.relative_to(ROOT)} missing: run pipeline/validate.py --recurrence first (DE-26)")
    h = json.loads(HINDCAST.read_text())
    return {k: h[k] for k in ("train_years", "k", "area_share", "test_years_pooled", "pooled", "fresh_2026")}


def outlook_summary():
    """DE-27 test result for the app: chosen method per moment and the pooled errors (node method/outlook_hindcast.js)."""
    if not OUTLOOK.exists():
        raise FileNotFoundError(f"{OUTLOOK.relative_to(ROOT)} missing: run node method/outlook_hindcast.js first (DE-27)")
    h = json.loads(OUTLOOK.read_text())
    return {k: h[k] for k in ("decision", "test_years", "fresh_year", "pre_season", "early_season")}


def calibration_lambda():
    """Variance inflation factor from validate.py (DE-16). Run validate.py before export.py."""
    if not CALIBRATION.exists():
        raise FileNotFoundError(f"{CALIBRATION.relative_to(ROOT)} missing: run pipeline/validate.py first (DE-16)")
    return float(json.loads(CALIBRATION.read_text())["lambda"])


def export_monthly_counts(harmonized, lam, name="monthly_cells.csv", id_column="cell_id"):
    """(a) monthly_cells.csv (or (e) municipalities.csv with id_column "area_id"): harmonized VIIRS-scale value, its
    calibrated variance (model variance x lambda, DE-16), estimated flag and raw counts per satellite."""
    out = harmonized[["cell_id", "year_month", "viirs_eq", "viirs_eq_var", "estimated", *SAT_COLUMNS]]
    out = out.rename(columns={**SAT_COLUMNS, "cell_id": id_column}).assign(viirs_eq_var=harmonized["viirs_eq_var"] * lam)
    for c in SAT_COLUMNS.values():
        out[c] = out[c].astype("Int64")  # empty = satellite-month not covered or flagged
    path = DOCS_DATA / name
    # ponytail: 6 significant digits; RA-4 expected values are computed from this file, so Python and JS agree.
    out.to_csv(path, index=False, float_format="%.6g")
    return path


def export_area_boundary():
    """(d) area.geojson: the area boundary (DE-1). The app draws it; outside it is "outside the area", not zero."""
    path = DOCS_DATA / "area.geojson"
    path.write_text(BOUNDARY.read_text())
    return path


def municipality_of(lon, lat, features):
    """DE-24: index of the municipal polygon that contains each point (first match). A point in no polygon (a sliver
    between the generalized borders and the state boundary) gets the municipality of the nearest boundary vertex.
    Returns (index array, number of points placed by the nearest vertex). Same rule as municipalityIndex in docs/js/calc.js."""
    rings = []
    for f in features:
        g = f["geometry"]
        if g["type"] != "Polygon" or len(g["coordinates"]) != 1:
            raise ValueError(f"municipality {f['properties']['code']}: expected one Polygon without holes (DE-24)")
        rings.append(np.asarray(g["coordinates"][0], dtype=float)[:, :2])
    xy = np.column_stack([lon, lat])
    out = np.full(len(xy), -1)
    for k, ring in enumerate(rings):
        todo = np.flatnonzero(out < 0)
        out[todo[PolygonPath(ring).contains_points(xy[todo])]] = k
    rest = np.flatnonzero(out < 0)
    if len(rest):
        owner = np.concatenate([np.full(len(r), k) for k, r in enumerate(rings)])
        out[rest] = owner[cKDTree(np.vstack(rings)).query(xy[rest])[1]]
    return out, len(rest)


def export_municipalities(flags, lam):
    """(e)/(f) DE-24: monthly series per IBGE municipality with the production harmonization unchanged (saved ratios,
    no new fit; the ratio method is linear, so the municipalities add up to the whole area), and their boundaries."""
    features = json.loads(MUNICIPALITIES.read_text(encoding="utf-8"))["features"]
    pts = pd.concat([pd.read_csv(f, usecols=["latitude", "longitude", "acq_date", "sat"], dtype={"acq_date": str, "sat": str})
                     for f in sorted(CLEAN_DIR.glob("*.csv.gz"))], ignore_index=True)
    idx, n_nearest = municipality_of(pts["longitude"].to_numpy(), pts["latitude"].to_numpy(), features)
    codes = np.array([f["properties"]["code"] for f in features])
    # The unit is the municipality: count_monthly/build_panel group by cell_id; lat/lon are not used (0 keeps groupby rows).
    counts = count_monthly(pts.assign(cell_id=codes[idx], cell_lat=0.0, cell_lon=0.0))
    params = json.loads(MODEL.read_text())["configurations"]
    series = harmonize(add_reference(build_panel(counts, flags)), params)
    csv_path = export_monthly_counts(series, lam, "municipalities.csv", "area_id")
    geo_path = DOCS_DATA / "municipalities.geojson"
    geo_path.write_text(MUNICIPALITIES.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"municipalities: {len(pts)} detections, {n_nearest} placed by the nearest boundary vertex (DE-24)")
    return csv_path, geo_path


def reference_viirs():
    """DE-26: cleaned detections of the DE-11 reference VIIRS satellite (S-NPP 2012-02 to 2018-03, NOAA-20 from 2018-04)."""
    files = sorted(CLEAN_DIR.glob("viirs-snpp_*.csv.gz")) + sorted(CLEAN_DIR.glob("viirs-jpss1_*.csv.gz"))
    pts = pd.concat([pd.read_csv(f, usecols=["latitude", "longitude", "acq_date", "sat"], dtype={"acq_date": str, "sat": str})
                     for f in files], ignore_index=True)
    snpp = pts["sat"].eq("SNPP") & pts["acq_date"].ge("2012-02-01") & pts["acq_date"].lt("2018-04-01")
    return pts[snpp | (pts["sat"].eq("NOAA20") & pts["acq_date"].ge("2018-04-01"))].reset_index(drop=True)


def recurrence(points, years):
    """DE-26: per 0.01° cell, the number of the given years with at least one detection, and the number of detections."""
    p = points[points["acq_date"].str[:4].astype(int).isin(years)]
    cell = (np.floor((p["latitude"] + 90) / RECURRENCE_GRID).astype(int).astype(str) + "_"
            + np.floor((p["longitude"] + 180) / RECURRENCE_GRID).astype(int).astype(str))
    g = p.assign(cell_id=cell, year=p["acq_date"].str[:4]).groupby("cell_id")
    return pd.DataFrame({"years": g["year"].nunique(), "detections": g.size()}).reset_index()


def export_recurrence():
    """(g) DE-26: recurrence.csv (cell_id at 0.01°, years of RECURRENCE_YEARS with a detection, detections)."""
    ref = reference_viirs()
    out = recurrence(ref, RECURRENCE_YEARS)
    assert out["detections"].sum() == ref["acq_date"].str[:4].astype(int).isin(RECURRENCE_YEARS).sum(), "recurrence total"
    path = DOCS_DATA / "recurrence.csv"
    out.to_csv(path, index=False)
    return path


def export_cell_outlook():
    """(h) DE-28: cell_outlook_<scale>.csv from pipeline/cell_outlook.py: `cell_id,p` (chance, 3 decimals, p >= 0.01) when
    a model passed the test, or `cell_id,last,top` (detections in the last year; top = 1 for the 10 % of cells ranked first as in the test) when
    persistence is shown."""
    paths = []
    for key in ("001", "005"):
        d = pd.read_csv(INTERIM / f"cell_outlook_2027_{key}.csv", dtype={"cell_id": str})
        d = d[d["p"] >= 0.01].assign(p=d["p"].round(3)) if "p" in d else d[d["last"].gt(0) | d["top"].eq(1)]
        path = DOCS_DATA / f"cell_outlook_{key}.csv"
        d.to_csv(path, index=False)
        paths.append(path)
    return paths


def cell_outlook_summary():
    """DE-28 test result for the app: per scale, what is shown and the test numbers."""
    if not CELL_OUTLOOK.exists():
        raise FileNotFoundError(f"{CELL_OUTLOOK.relative_to(ROOT)} missing: run python pipeline/cell_outlook.py first (DE-28)")
    h = json.loads(CELL_OUTLOOK.read_text())
    return {"decision": h["decision"], "window": h["window"], "next_year": 2027, "feature_year": 2026,
            "scales": {k: {x: s[x] for x in ("grid_deg", "cells", "test_years", "fresh_year", "pooled", "fresh", "best_model", "shown")}
                       | {"calibration": s["calibration"].get(s["shown"])} for k, s in h["scales"].items()}}


def export_months(flags):
    """(a2) months.csv: one row per satellite and covered month."""
    path = DOCS_DATA / "months.csv"
    flags[["year_month", "sat", "missing_days", "flagged", "provisional"]].to_csv(path, index=False)
    return path


def export_metadata(harmonized):
    """(c) metadata.json."""
    area = json.loads(AREA.read_text())
    if not area.get("name") or not area.get("bbox_west_south_east_north"):
        raise ValueError(f"{AREA.relative_to(ROOT)} is not filled (DE-1)")
    model = json.loads(MODEL.read_text())
    clean = pd.concat([pd.read_csv(f, usecols=["acq_date", "sat", "version", "country", "route"], dtype=str)
                       for f in sorted(CLEAN_DIR.glob("*.csv.gz"))])
    api = clean["route"].eq("api")
    boundary_props = json.loads(BOUNDARY.read_text())["features"][0]["properties"]
    meta = {
        "title": "LUNAX Fire Calendar - harmonized monthly hotspot counts",
        "area": {"name": area["name"], "bbox_west_south_east_north": area["bbox_west_south_east_north"],
                 "boundary_file": "area.geojson", "boundary_source": boundary_props.get("url"),
                 "rule": "only detections inside the boundary are counted; outside the boundary is outside the "
                         "area, not zero fire (DE-1)",
                 "countries_in_data": sorted(clean.loc[~api, "country"].unique())},
        "source": {
            "name": "NASA FIRMS (Fire Information for Resource Management System)",
            "url": "https://www.earthdata.nasa.gov/data/tools/firms",
            "product": "FIRMS country yearly summary CSVs, standard processing (SP)"
                       + ("; FIRMS area API for NOAA-21 (no NOAA-21 country files) and for 2026: standard processing "
                          "where available, then near real-time (NRT), whose months are flagged provisional in "
                          "months.csv (DE-4)" if api.any() else ""),
            "files": "https://firms.modaps.eosdis.nasa.gov/data/country/"
                     + (" ; https://firms.modaps.eosdis.nasa.gov/api/area/" if api.any() else ""),
            "satellites": {"MODIS 1 km": ["Terra", "Aqua"],
                           "VIIRS 375 m": ["S-NPP", "NOAA-20"] + (["NOAA-21"] if clean["sat"].eq("NOAA21").any() else [])},
            "versions_by_satellite": {s: sorted(g.unique()) for s, g in clean.groupby("sat")["version"]},
        },
        "period": {"first_month": harmonized["year_month"].min(), "last_month": harmonized["year_month"].max()},
        "data_cutoff_date": clean["acq_date"].max(),
        "archived": "Archived FIRMS data, not live.",
        "grid": {"cell_size_deg": 0.25, "origin_lon_lat": [-180, -90],
                 "cell_id": "<row>_<col>, row = floor((lat+90)/0.25), col = floor((lon+180)/0.25)",
                 "area_rule": "a cell belongs to a selected area if its centre is inside the rectangle"},
        "method": {
            "target_scale": "VIIRS-equivalent: monthly count of VIIRS 375 m hotspots per cell (DE-2)",
            "native_months": "from 2012-02: S-NPP to 2018-03, NOAA-20 from 2018-04 (DE-11); NOAA-21 is a check "
                             "(raw counts only, not used for viirs_eq)",
            "estimated_months": "2000-11 to 2012-01: viirs_eq = k(month of year) x MODIS count, with MODIS = "
                                "Terra + Aqua when both are valid, else Terra (DE-6 option 2, selected by the "
                                "DE-15 backcast; method/results/validation_metrics.json)",
            "train_years": model["train_years"],
            "k_by_month": {k: v["k_by_month"] for k, v in model["configurations"].items()},
            "uncertainty": "viirs_eq_var = model variance x lambda (DE-16). For an area, sum viirs_eq and "
                           "viirs_eq_var over its cells; the 90 % interval is sum +/- 1.645 x sqrt(summed variance). "
                           "lambda was calibrated on the monthly totals of the whole demo area; see method/VALIDATION.md",
            "uncertainty_lambda": calibration_lambda(),
            "decisions": "method/DECISIONS.md",
        },
        "files": {
            "monthly_cells.csv": "cell_id, year_month, viirs_eq (harmonized), viirs_eq_var (variance, 0 when observed), "
                                 "estimated (1 = converted from MODIS), terra, aqua, snpp, noaa20, noaa21 (raw counts). "
                                 "Empty value = no data, never zero fire. Active cells only: other cells inside the "
                                 "boundary had no detection; cells outside the boundary are outside the area. A cell "
                                 "that crosses the boundary counts only its detections inside it.",
            "months.csv": "year_month, sat, missing_days, flagged (1 = missing data), provisional (1 = NRT)",
            "area.geojson": "IBGE boundary of the area (DE-1); draw it and mark everything outside as outside the area",
            "municipalities.csv": "same columns as monthly_cells.csv with area_id (IBGE municipality code) instead of "
                                  "cell_id: the series of each municipality from the detections inside its boundary, "
                                  "with the same harmonization (DE-24)",
            "recurrence.csv": "cell_id (0.01°: row = floor((lat+90)/0.01), col = floor((lon+180)/0.01)), years (number "
                              "of the years in recurrence.years with at least one reference VIIRS detection), detections; "
                              "cells without detections are not listed, which is not proof of no fire (DE-26)",
            "municipalities.geojson": "IBGE municipal boundaries (malhas API v3, intermediate quality) with code and name; "
                                      "source URL and retrieval date in each feature (DE-24)",
        },
        "recurrence": {  # DE-26
            "file": "recurrence.csv", "grid_deg": RECURRENCE_GRID, "years": RECURRENCE_YEARS,
            "excluded": {"2023": "the reference satellite misses 4 days in July and 1 in September (months.csv)",
                         "2026": "incomplete year, provisional"},
            "detections": "reference VIIRS satellite of DE-11: S-NPP 2012-02 to 2018-03, NOAA-20 from 2018-04",
            "hindcast": hindcast_summary(),
        },
        "outlook": outlook_summary(),  # DE-27 (PROPOSED)
        "cell_outlook": cell_outlook_summary(),  # DE-28 (PROPOSED)
        "attribution": ATTRIBUTION,
        "disclaimer_url": DISCLAIMER_URL,
        "ai_use": AI_USE,
    }
    path = DOCS_DATA / "metadata.json"
    path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    return path


def check(harmonized, paths):
    """Invariants on the written files. Do not run Python with -O: asserts must stay on."""
    cells = pd.read_csv(paths[0], dtype={"year_month": str})
    munis = pd.read_csv(DOCS_DATA / "municipalities.csv", dtype={"year_month": str, "area_id": str})
    assert munis["area_id"].nunique() == 52, "every municipality of Rondonia has a series (DE-24)"
    for col in ["viirs_eq", "terra", "aqua", "snpp", "noaa20", "noaa21"]:  # DE-24: municipalities add up to the area
        a = cells.groupby("year_month")[col].sum(min_count=1)
        m = munis.groupby("year_month")[col].sum(min_count=1).reindex(a.index)
        same = ((a - m).abs() <= 1e-3 * a.abs().clip(lower=1)) | (a.isna() & m.isna())  # 6 significant digits per row
        assert same.all(), f"municipal sum of {col}: {list(a.index[~same])[:5]}"
    assert len(cells) == len(harmonized), "row count"
    missing = harmonized["model"].eq("missing").to_numpy()
    assert cells.loc[missing, "viirs_eq"].isna().all(), "a missing month has a value"
    assert cells.loc[~missing, "viirs_eq"].notna().all(), "a valid month lost its value"
    for p in paths:
        assert p.stat().st_size < MAX_FILE_MB * 1e6, f"{p.name} is larger than {MAX_FILE_MB} MB"
    print("check: OK")


def main(argv=None):
    p = argparse.ArgumentParser(description="Write the app data files into docs/data/.")
    p.add_argument("--check", action="store_true", help="assert invariants on the written files")
    a = p.parse_args(argv)
    harmonized = pd.read_csv(HARMONIZED, dtype={"year_month": str})
    flags = pd.read_csv(FLAGS, dtype={"year_month": str})
    DOCS_DATA.mkdir(parents=True, exist_ok=True)
    paths = [export_monthly_counts(harmonized, calibration_lambda()), export_months(flags), export_metadata(harmonized),
             export_area_boundary(), *export_municipalities(flags, calibration_lambda()), export_recurrence(),
             *export_cell_outlook()]
    if a.check:
        check(harmonized, paths)
    for path in paths:
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
