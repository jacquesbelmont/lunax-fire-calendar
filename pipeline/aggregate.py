"""Monthly aggregation of hotspot counts per grid cell, per satellite (DE-12, DE-14).

Owner issue: RA-2. SCOPE: R2, R3.
Months with missing satellite data must be flagged, never counted as zero fire.
Grid size comes from method/DECISIONS.md (DE-12).
AI-assisted code (Claude Code); logged in AI_USE.md.

Usage:
    python pipeline/aggregate.py [--check]

Reads data/interim/clean/<source>_<year>.csv.gz (clean.py) and data/raw/missing_days.csv
(download.py; columns sat,date,processing; format proposed on issue #5). Writes (git-ignored):
- data/interim/monthly_counts.csv.gz: cell_id, cell_lat, cell_lon, year_month, sat, count (only count > 0).
- data/interim/month_flags.csv: one row per satellite and month covered by the cleaned files, with
  missing_days, flagged and provisional. A (satellite, month) that is NOT in this table has no data.
  In a covered, unflagged month a cell without a count row had zero detections.
"""

import argparse
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CLEAN_DIR = ROOT / "data" / "interim" / "clean"
MISSING_DAYS = ROOT / "data" / "raw" / "missing_days.csv"
COUNTS_OUT = ROOT / "data" / "interim" / "monthly_counts.csv.gz"
FLAGS_OUT = ROOT / "data" / "interim" / "month_flags.csv"

CELL_SIZE = 0.25  # degrees (DE-12)

# Satellites in each source: country CSVs (method/FIRMS_REFERENCE.md section 3.1) and the area API (viirs-jpss2).
SOURCE_SATS = {"modis": ["Terra", "Aqua"], "viirs-snpp": ["SNPP"], "viirs-jpss1": ["NOAA20"], "viirs-jpss2": ["NOAA21"]}
# Operating window in FIRMS (method/FIRMS_REFERENCE.md section 2). Days outside it count as missing (DE-14).
# Terra and Aqua: first acq_date in the 2000 and 2002 country files (Brazil + Bolivia, checked 2026-11-15). Aqua starts
# on 2002-07-04 with 1,141 detections, while Terra has 498-580 per day on 2002-07-01..03.
SAT_START = {"Terra": "2000-11-01", "Aqua": "2002-07-04", "SNPP": "2012-01-20",
             "NOAA20": "2018-04-01", "NOAA21": "2024-01-17"}
# New S-NPP data ended 2026-11-02 13:00 UTC (FIRMS blog); that partial day counts as missing.
SAT_END = {"SNPP": "2026-11-01"}


def assign_grid_cell(hotspots, size=CELL_SIZE):
    """Add cell_id "<row>_<col>" and the cell centre: row = floor((lat+90)/size), col = floor((lon+180)/size)."""
    row = np.floor((hotspots["latitude"] + 90) / size).astype(int)
    col = np.floor((hotspots["longitude"] + 180) / size).astype(int)
    return hotspots.assign(cell_id=row.astype(str) + "_" + col.astype(str),
                           cell_lat=(row + 0.5) * size - 90,
                           cell_lon=(col + 0.5) * size - 180)


def count_monthly(hotspots):
    """Count hotspots per cell, month and satellite (sparse: only counts > 0). Satellites are never summed here."""
    return (hotspots.assign(year_month=hotspots["acq_date"].str[:7])
            .groupby(["cell_id", "cell_lat", "cell_lon", "year_month", "sat"]).size()
            .rename("count").reset_index())


def flag_missing_months(coverage, missing_days):
    """One row per (satellite, month) covered by the cleaned files (DE-14).

    coverage: iterable of (sat, year) whose files were cleaned.
    missing_days: DataFrame with columns sat, date (YYYY-MM-DD), from FIRMS missing_data.
    missing_days per month = days outside the satellite's operating window + FIRMS missing days.
    """
    listed = set(zip(missing_days["sat"], missing_days["date"]))
    rows = []
    for sat, year in sorted(set(coverage)):
        days = pd.date_range(f"{year}-01-01", f"{year}-12-31", freq="D")
        end = pd.Timestamp(SAT_END[sat]) if sat in SAT_END else days[-1]
        operating = (days >= pd.Timestamp(SAT_START[sat])) & (days <= end)
        if not operating.any():
            continue  # satellite not flying that year
        dates = days.strftime("%Y-%m-%d")
        ok = operating & ~np.array([(sat, d) in listed for d in dates])
        per_month = pd.DataFrame({"year_month": days.strftime("%Y-%m"), "ok": ok, "op": operating})
        g = per_month.groupby("year_month").agg(n=("ok", "size"), ok=("ok", "sum"), op=("op", "any"))
        for ym, r in g[g["op"]].iterrows():
            rows.append({"sat": sat, "year_month": ym, "missing_days": int(r["n"] - r["ok"])})
    flags = pd.DataFrame(rows, columns=["sat", "year_month", "missing_days"])
    flags["flagged"] = (flags["missing_days"] >= 1).astype(int)
    return flags


def check(hotspots, counts, flags):
    """Invariants on real output. Do not run Python with -O: asserts must stay on."""
    assert counts["count"].sum() == len(hotspots), "every hotspot counted exactly once"
    assert (counts["count"] > 0).all(), "sparse table must not hold zeros"
    covered = set(zip(flags["sat"], flags["year_month"]))
    assert set(zip(counts["sat"], counts["year_month"])) <= covered, "counts in a month with no coverage row"
    assert flags["missing_days"].between(0, 31).all(), "missing_days out of range"
    assert not flags.duplicated(["sat", "year_month"]).any(), "duplicate flag rows"
    print("check: OK")


def main(argv=None):
    p = argparse.ArgumentParser(description="Monthly counts per grid cell and satellite, plus month flags.")
    p.add_argument("--check", action="store_true", help="assert invariants on the output")
    a = p.parse_args(argv)
    files = sorted(CLEAN_DIR.glob("*.csv.gz"))
    if not files:
        raise FileNotFoundError(f"no cleaned files in {CLEAN_DIR}: run clean.py first")
    if not MISSING_DAYS.exists():
        raise FileNotFoundError(f"{MISSING_DAYS} is required (DE-14): never assume there are no gaps")

    coverage, frames = [], []
    for f in files:
        m = re.fullmatch(r"(.+)_(\d{4})\.csv\.gz", f.name)
        if not m or m.group(1) not in SOURCE_SATS:
            raise ValueError(f"unexpected cleaned file name {f.name}")
        coverage += [(sat, int(m.group(2))) for sat in SOURCE_SATS[m.group(1)]]
        frames.append(pd.read_csv(f, usecols=["latitude", "longitude", "acq_date", "sat", "processing"],
                                  dtype={"acq_date": str, "sat": str, "processing": str}))
    hotspots = assign_grid_cell(pd.concat(frames, ignore_index=True))
    counts = count_monthly(hotspots)
    flags = flag_missing_months(coverage, pd.read_csv(MISSING_DAYS, dtype=str))
    nrt = hotspots[hotspots["processing"].eq("NRT")]
    nrt_months = set(zip(nrt["sat"], nrt["acq_date"].str[:7]))
    flags["provisional"] = [int(k in nrt_months) for k in zip(flags["sat"], flags["year_month"])]
    if a.check:
        check(hotspots, counts, flags)

    counts.to_csv(COUNTS_OUT, index=False)
    flags.to_csv(FLAGS_OUT, index=False)
    print(f"{COUNTS_OUT.relative_to(ROOT)}: {len(counts)} rows, {counts['cell_id'].nunique()} active cells, "
          f"{counts['count'].sum()} hotspots")
    print(f"{FLAGS_OUT.relative_to(ROOT)}: {len(flags)} satellite-months, {int(flags['flagged'].sum())} flagged")


if __name__ == "__main__":
    main()
