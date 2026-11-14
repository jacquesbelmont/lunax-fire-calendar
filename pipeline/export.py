"""Write the app data files into docs/data/ per DATA_CONTRACT.md (format proposed on issue #5).

Owner issue: RA-2. SCOPE: R2, R3, R9.
This is the ONLY code that writes docs/data/.
AI-assisted code (Claude Code); logged in AI_USE.md.

Usage:
    python pipeline/export.py [--check]

Reads data/interim/harmonized.csv.gz and data/interim/month_flags.csv (harmonize.py, aggregate.py),
data/interim/clean/*.csv.gz (clean.py), config/area.json and method/results/harmonize_model.json. Writes:
- docs/data/monthly_cells.csv: one row per active cell and month. An empty value means no data (never zero fire).
- docs/data/months.csv: coverage and flags per satellite and month (DE-14).
- docs/data/metadata.json: area, source, versions, period, coverage, method, data cut-off date, grid, attribution.
"""

import argparse
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
HARMONIZED = ROOT / "data" / "interim" / "harmonized.csv.gz"
FLAGS = ROOT / "data" / "interim" / "month_flags.csv"
CLEAN_DIR = ROOT / "data" / "interim" / "clean"
RAW_COUNTRY = ROOT / "data" / "raw" / "country"
AREA = ROOT / "config" / "area.json"
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
SAT_COLUMNS = {"Terra": "terra", "Aqua": "aqua", "SNPP": "snpp", "NOAA20": "noaa20", "NOAA21": "noaa21"}


def calibration_lambda():
    """Variance inflation factor from validate.py (DE-16). Run validate.py before export.py."""
    if not CALIBRATION.exists():
        raise FileNotFoundError(f"{CALIBRATION.relative_to(ROOT)} missing: run pipeline/validate.py first (DE-16)")
    return float(json.loads(CALIBRATION.read_text())["lambda"])


def export_monthly_counts(harmonized, lam):
    """(a) monthly_cells.csv: harmonized VIIRS-scale value, its calibrated variance (model variance x lambda,
    DE-16), estimated flag and raw counts per satellite."""
    out = harmonized[["cell_id", "year_month", "viirs_eq", "viirs_eq_var", "estimated", *SAT_COLUMNS]]
    out = out.rename(columns=SAT_COLUMNS).assign(viirs_eq_var=harmonized["viirs_eq_var"] * lam)
    for c in SAT_COLUMNS.values():
        out[c] = out[c].astype("Int64")  # empty = satellite-month not covered or flagged
    path = DOCS_DATA / "monthly_cells.csv"
    # ponytail: 6 significant digits; RA-4 expected values are computed from this file, so Python and JS agree.
    out.to_csv(path, index=False, float_format="%.6g")
    return path


def export_months(flags):
    """(a2) months.csv: one row per satellite and covered month."""
    path = DOCS_DATA / "months.csv"
    flags[["year_month", "sat", "missing_days", "flagged", "provisional"]].to_csv(path, index=False)
    return path


def export_hotspots_per_year(hotspots):
    """(b) hotspot list per year, for the CSV download (R9)."""
    # TODO(JA-3): format and size to agree with Jacques on issue #5 before exporting (hundreds of MB raw).
    raise NotImplementedError


def export_metadata(harmonized):
    """(c) metadata.json."""
    area = json.loads(AREA.read_text())
    if not area.get("name") or not area.get("bbox_west_south_east_north"):
        raise ValueError(f"{AREA.relative_to(ROOT)} is not filled (DE-1)")
    model = json.loads(MODEL.read_text())
    clean = pd.concat([pd.read_csv(f, usecols=["acq_date", "sat", "version"], dtype=str)
                       for f in sorted(CLEAN_DIR.glob("*.csv.gz"))])
    countries = sorted({p.name.split("_", 2)[2].removesuffix(".csv.gz").removesuffix(".csv")
                        for p in RAW_COUNTRY.glob("*/*/*.csv*")})
    meta = {
        "title": "LUNAX Fire Calendar - harmonized monthly hotspot counts",
        "area": {"name": area["name"], "bbox_west_south_east_north": area["bbox_west_south_east_north"],
                 "source_countries": countries},
        "source": {
            "name": "NASA FIRMS (Fire Information for Resource Management System)",
            "url": "https://www.earthdata.nasa.gov/data/tools/firms",
            "product": "FIRMS country yearly summary CSVs, standard processing (SP)",
            "files": "https://firms.modaps.eosdis.nasa.gov/data/country/",
            "satellites": {"MODIS 1 km": ["Terra", "Aqua"], "VIIRS 375 m": ["S-NPP", "NOAA-20"]},
            "versions_by_satellite": {s: sorted(g.unique()) for s, g in clean.groupby("sat")["version"]},
        },
        "period": {"first_month": harmonized["year_month"].min(), "last_month": harmonized["year_month"].max()},
        "data_cutoff_date": clean["acq_date"].max(),
        "archived": "Archived FIRMS data, not live; see data_cutoff_date.",
        "grid": {"cell_size_deg": 0.25, "origin_lon_lat": [-180, -90],
                 "cell_id": "<row>_<col>, row = floor((lat+90)/0.25), col = floor((lon+180)/0.25)",
                 "area_rule": "a cell belongs to a selected area if its centre is inside the rectangle"},
        "method": {
            "target_scale": "VIIRS-equivalent: monthly count of VIIRS 375 m hotspots per cell (DE-2)",
            "native_months": "from 2012-02: S-NPP to 2018-03, NOAA-20 from 2018-04 (DE-11)",
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
                                 "Empty value = no data, never zero fire. Active cells only; other cells had no detection.",
            "months.csv": "year_month, sat, missing_days, flagged (1 = missing data), provisional (1 = NRT)",
        },
        "attribution": ATTRIBUTION,
        "disclaimer_url": DISCLAIMER_URL,
    }
    path = DOCS_DATA / "metadata.json"
    path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    return path


def check(harmonized, paths):
    """Invariants on the written files. Do not run Python with -O: asserts must stay on."""
    cells = pd.read_csv(paths[0], dtype={"year_month": str})
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
    paths = [export_monthly_counts(harmonized, calibration_lambda()), export_months(flags), export_metadata(harmonized)]
    if a.check:
        check(harmonized, paths)
    for path in paths:
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
