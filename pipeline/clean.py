"""Apply the cleaning rules decided by the team in method/DECISIONS.md (DE-1, DE-4, DE-5, DE-9, DE-10).

Owner issue: RA-1. SCOPE: R2.
Do not add rules here that are not recorded in DECISIONS.md.
AI-assisted code (Claude Code); logged in AI_USE.md.

Usage (one instrument-year at a time; reads every CSV or CSV.GZ under data/raw/country/<source>/<year>/):
    python pipeline/clean.py --source modis --year 2013 --bbox WEST SOUTH EAST NORTH
    python pipeline/clean.py --source modis --year 2013 --bbox WEST SOUTH EAST NORTH --check
Options: --boundary GEOJSON (default config/area_boundary.geojson, the IBGE boundary of Rondonia, DE-1);
--extra-countries Bolivia keeps that country file's detections inside the bbox too (DE-1b option B; off by default).

Writes data/interim/clean/<source>_<year>.csv.gz (git-ignored) and one row per run in
method/results/cleaning_log.csv (rows read, rows removed per rule, rows kept).
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
CLEAN_DIR = ROOT / "data" / "interim" / "clean"
LOG_PATH = ROOT / "method" / "results" / "cleaning_log.csv"
# IBGE boundary of Rondonia (DE-1); source URL and retrieval date are in the file's properties.
BOUNDARY = ROOT / "config" / "area_boundary.geojson"

# First month of Terra MODIS in FIRMS (method/FIRMS_REFERENCE.md section 2).
START_DATE = "2000-11-01"

# `satellite` codes -> (normalized satellite, sensor).
# Country CSVs use "Terra"/"Aqua" (seen in modis_2013_Brazil.csv and modis_2025_Brazil.csv, 2026-11-14);
# the FIRMS attribute page uses "T"/"A" for MODIS and "N"/"N20"/"N21" for VIIRS:
# https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs
SATELLITES = {
    "Terra": ("Terra", "MODIS"),
    "T": ("Terra", "MODIS"),
    "Aqua": ("Aqua", "MODIS"),
    "A": ("Aqua", "MODIS"),
    "N": ("SNPP", "VIIRS"),
    "N20": ("NOAA20", "VIIRS"),
    "N21": ("NOAA21", "VIIRS"),
}

# Sensor-specific brightness columns get one name each (kept for the CSV export, R9).
RENAME = {"brightness": "bright_mir", "bright_ti4": "bright_mir", "bright_t31": "bright_tir", "bright_ti5": "bright_tir"}
READ_DTYPES = {"acq_time": str, "acq_date": str, "version": str, "confidence": str,
               "satellite": str, "instrument": str, "daynight": str}
OUT_COLUMNS = ["latitude", "longitude", "acq_date", "acq_time", "sat", "sensor", "processing", "confidence",
               "daynight", "frp", "scan", "track", "type", "version", "bright_mir", "bright_tir", "route", "country"]
# Exact-duplicate key (DE-5 rule 6).
KEY = ["sat", "latitude", "longitude", "acq_date", "acq_time"]
RULES = ["outside_bbox", "outside_boundary", "before_start_date", "sp_type_not_0", "exact_duplicate",
         "nrt_covered_by_sp"]


def load_raw(source, year, raw_dir=RAW_DIR):
    """Read the cached country CSVs of one instrument-year from data/raw/ and normalize them (DE-5 rule 1).

    source: instrument folder of the FIRMS country files (modis, viirs-snpp, viirs-jpss1).
    """
    # ponytail: only the country-CSV route; the API layout comes with download.py (JA-2/JA-4).
    # ponytail: one year in memory (Brazil VIIRS 2013 = 866,922 rows); read in chunks if a multi-country year gets too big.
    folder = Path(raw_dir) / "country" / source / str(year)
    plain = sorted(folder.glob("*.csv"))
    # A compressed copy is read only when the plain CSV is absent, so no file is read twice.
    gz = [f for f in sorted(folder.glob("*.csv.gz")) if f.with_suffix("") not in plain]
    files = plain + gz
    if not files:
        raise FileNotFoundError(f"no CSV under {folder}")
    # Country from the FIRMS file name <instrument>_<year>_<Country>.csv (used by DE-1b option B).
    df = pd.concat([pd.read_csv(f, dtype=READ_DTYPES).assign(
        country=f.name.split("_", 2)[2].removesuffix(".gz").removesuffix(".csv")) for f in files], ignore_index=True)
    return normalize(df, route="country_csv")


def load_boundary(path=BOUNDARY):
    """All rings (outer and holes) of a GeoJSON Polygon/MultiPolygon, as (n, 2) lon/lat arrays."""
    rings = []
    for feature in json.loads(Path(path).read_text())["features"]:
        geom = feature["geometry"]
        polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings += [np.asarray(ring, dtype=float)[:, :2] for poly in polygons for ring in poly]
    return rings


def inside_boundary(lon, lat, rings):
    """Even-odd ray casting over all rings (holes handled by the parity). Vectorized over points.

    ponytail: one numpy pass per polygon edge (~2,000 edges here); fast enough because only points
    already inside the bbox reach this test. Use a spatial library if the boundary gets much finer.
    """
    x, y = np.asarray(lon, dtype=float), np.asarray(lat, dtype=float)
    inside = np.zeros(x.shape, dtype=bool)
    with np.errstate(divide="ignore", invalid="ignore"):
        for ring in rings:
            x1, y1 = ring[:, 0], ring[:, 1]
            x0, y0 = np.roll(x1, 1), np.roll(y1, 1)
            for xa, ya, xb, yb in zip(x0, y0, x1, y1):
                crosses = (ya > y) != (yb > y)
                inside ^= crosses & (x < (xb - xa) * (y - ya) / (yb - ya) + xa)
    return inside


def normalize(df, route):
    """Map raw FIRMS columns to the normalized schema (OUT_COLUMNS)."""
    unknown = set(df["satellite"].unique()) - SATELLITES.keys()
    if unknown:
        raise ValueError(f"unknown satellite codes {sorted(unknown)}: add them to SATELLITES with a source")
    df = df.rename(columns=RENAME)
    df["sat"] = df["satellite"].map({k: v[0] for k, v in SATELLITES.items()})
    df["sensor"] = df["satellite"].map({k: v[1] for k, v in SATELLITES.items()})
    if "instrument" in df and not (df["instrument"] == df["sensor"]).all():
        raise ValueError("`instrument` does not match the sensor implied by `satellite`")
    # Standard processing = collection only ("6.1"); NRT/RT/URT = collection + suffix ("6.1NRT"),
    # per the FIRMS attribute page. RT and URT are grouped with NRT (all non-standard).
    df["processing"] = df["version"].str.contains(r"(?:NRT|RT|URT)$").map({True: "NRT", False: "SP"})
    if "type" not in df:  # NRT data carry no `type` (FIRMS FAQ)
        df["type"] = pd.NA
    df["type"] = df["type"].astype("Int64")
    df["route"] = route
    return df[OUT_COLUMNS]


def apply_cleaning_rules(hotspots, bbox, rings, extra_countries=()):
    """Apply DE-5 rules 2-7 in order. Returns (clean hotspots, {rule: rows removed})."""
    west, south, east, north = bbox
    removed = {}

    def keep(df, mask, rule):
        removed[rule] = int((~mask).sum())
        return df[mask]

    df = hotspots
    # Rule 2: half-open bbox, so a detection on a shared edge is counted once.
    df = keep(df, df["longitude"].ge(west) & df["longitude"].lt(east)
              & df["latitude"].ge(south) & df["latitude"].lt(north), "outside_bbox")
    # Rule 2b (DE-1): only detections inside the area boundary; outside is "outside the area", never zero.
    # DE-1b option B adds whole countries' files inside the bbox (extra_countries); empty by default.
    in_area = inside_boundary(df["longitude"], df["latitude"], rings) | df["country"].isin(list(extra_countries))
    df = keep(df, in_area, "outside_boundary")
    # Rule 3: period starts with Terra MODIS (ISO dates compare correctly as text).
    df = keep(df, df["acq_date"].ge(START_DATE), "before_start_date")
    # Rule 4 (DE-9): SP rows keep only type 0; NRT rows have no type and are flagged provisional later (aggregate).
    df = keep(df, df["processing"].eq("NRT") | df["type"].eq(0).fillna(False), "sp_type_not_0")
    # Rule 5 (DE-10): no confidence or day/night filter.
    # Rule 6: exact duplicates.
    df = keep(df, ~df.duplicated(KEY), "exact_duplicate")
    # Rule 7 (DE-4): NRT only after the last SP date of each satellite (taken from the SP rows themselves).
    last_sp = df["sat"].map(df[df["processing"].eq("SP")].groupby("sat")["acq_date"].max())
    covered = df["processing"].eq("NRT") & last_sp.notna() & df["acq_date"].le(last_sp.fillna(""))
    df = keep(df, ~covered, "nrt_covered_by_sp")
    return df.reset_index(drop=True), removed


def check(raw, clean, removed, bbox, rings, extra_countries=()):
    """Invariants on real output (no fake data). Do not run Python with -O: asserts must stay on."""
    west, south, east, north = bbox
    assert len(raw) - sum(removed.values()) == len(clean), "row accounting"
    in_area = inside_boundary(clean["longitude"], clean["latitude"], rings) | clean["country"].isin(list(extra_countries))
    assert in_area.all(), "detection outside the area boundary"
    assert clean["longitude"].between(west, east, inclusive="left").all(), "longitude outside bbox"
    assert clean["latitude"].between(south, north, inclusive="left").all(), "latitude outside bbox"
    assert clean["acq_date"].str.fullmatch(r"\d{4}-\d{2}-\d{2}").all(), "acq_date format"
    assert clean["acq_date"].ge(START_DATE).all(), "date before start"
    assert clean["acq_time"].str.fullmatch(r"\d{4}").all(), "acq_time not HHMM"
    assert clean["sat"].isin({v[0] for v in SATELLITES.values()}).all(), "unknown sat"
    assert clean.loc[clean["processing"].eq("SP"), "type"].eq(0).fillna(False).all(), "SP row with type != 0"
    assert not clean.duplicated(KEY).any(), "duplicates left"
    print("check: OK")


def write_log(source, year, bbox, rows_read, removed, rows_kept, extra_countries=()):
    """One row per source-year in method/results/cleaning_log.csv (a rerun replaces its row)."""
    row = pd.DataFrame([{"source": source, "year": year, "bbox_west_south_east_north": " ".join(map(str, bbox)),
                         "extra_countries": " ".join(extra_countries),
                         "rows_read": rows_read, **removed, "rows_kept": rows_kept}])
    if LOG_PATH.exists():
        log = pd.read_csv(LOG_PATH)
        row = pd.concat([log[~((log["source"] == source) & (log["year"] == year))], row], ignore_index=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    row.sort_values(["source", "year"]).to_csv(LOG_PATH, index=False)


def main(argv=None):
    p = argparse.ArgumentParser(description="Clean one instrument-year of FIRMS country CSVs.")
    p.add_argument("--source", required=True, help="country CSV instrument folder: modis, viirs-snpp, viirs-jpss1")
    p.add_argument("--year", required=True, type=int)
    # TODO(JA-2): default to config.load_area() once config.py is merged.
    p.add_argument("--bbox", required=True, nargs=4, type=float, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    p.add_argument("--boundary", type=Path, default=BOUNDARY, help="GeoJSON of the area (DE-1)")
    p.add_argument("--extra-countries", nargs="*", default=[], help="DE-1b option B, e.g. Bolivia (off by default)")
    p.add_argument("--check", action="store_true", help="assert invariants on the cleaned output")
    a = p.parse_args(argv)
    west, south, east, north = a.bbox
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        p.error("bbox must be WEST SOUTH EAST NORTH with west < east and south < north")

    rings = load_boundary(a.boundary)
    raw = load_raw(a.source, a.year)
    clean, removed = apply_cleaning_rules(raw, a.bbox, rings, a.extra_countries)
    if a.check:
        check(raw, clean, removed, a.bbox, rings, a.extra_countries)
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    out = CLEAN_DIR / f"{a.source}_{a.year}.csv.gz"
    clean.to_csv(out, index=False)
    write_log(a.source, a.year, a.bbox, len(raw), removed, len(clean), a.extra_countries)
    print(f"{out.relative_to(ROOT)}: {len(raw)} rows read, {len(clean)} kept; removed {removed}")


if __name__ == "__main__":
    main()
