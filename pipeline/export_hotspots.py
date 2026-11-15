"""Write the per-year hotspot files for the app's CSV download (R9, DE-17) into docs/data/hotspots/.

Owner issue: JA-6 (R9). SCOPE: R9.
AI-assisted code (Claude Code); logged in AI_USE.md.

Reads data/interim/clean/<source>_<year>.csv.gz (clean.py output: SP data, type 0, inside the area boundary,
no confidence filter) and writes, for each one:
    docs/data/hotspots/<source>_<year>.csv.gz   comment header (acknowledgment, cut-off date) + one row per hotspot
    docs/data/hotspots/index.json               source, year, rows and bytes of every file (the app reads it)
`<source>` is the FIRMS instrument folder: modis, viirs-snpp, viirs-jpss1 (country files), viirs-jpss2 (NOAA-21, area API).
Rows keep the cell_id of aggregate.py, so the app selects them with the same cells as monthly_cells.csv.
Like export.py, this is code that writes into docs/data/ (AGENTS.md rule 7).

Usage:
    python pipeline/export_hotspots.py [--source modis --year 2013]
"""
import argparse
import gzip
import io
import json
import re
from pathlib import Path

import pandas as pd

from aggregate import assign_grid_cell

ROOT = Path(__file__).resolve().parent.parent
CLEAN_DIR = ROOT / "data" / "interim" / "clean"
OUT_DIR = ROOT / "docs" / "data" / "hotspots"
META_PATH = ROOT / "docs" / "data" / "metadata.json"

COLUMNS = ["cell_id", "latitude", "longitude", "acq_date", "acq_time", "sat", "sensor", "confidence",
           "daynight", "frp", "type", "version"]
CLEAN_NAME = re.compile(r"^(modis|viirs-snpp|viirs-jpss1|viirs-jpss2)_(\d{4})\.csv\.gz$")


def build_header(meta, source, year):
    """Comment lines at the top of every file: acknowledgment, disclaimer link and data cut-off date."""
    return [f"# LUNAX Fire Calendar: hotspots, {source} {year}",
            f"# {meta['attribution']}",
            f"# Disclaimer: {meta['disclaimer_url']}",
            f"# Data cut-off date: {meta['data_cutoff_date']} ({meta['archived']})",
            "# Rows: FIRMS standard-processing detections inside the study area boundary, type 0 (presumed vegetation fire), "
            "no confidence filter (method/DECISIONS.md DE-5, DE-9, DE-10). Sensors are never to be summed."]


def hotspot_rows(clean):
    """Select the exported columns from a cleaned table and add cell_id; sorted so reruns give the same bytes."""
    cells = assign_grid_cell(clean.assign(latitude=clean["latitude"].astype(float),
                                          longitude=clean["longitude"].astype(float)))
    out = clean.assign(cell_id=cells["cell_id"].values)[COLUMNS]
    return out.sort_values(["acq_date", "acq_time", "latitude", "longitude", "sat"], kind="stable").reset_index(drop=True)


def write_hotspot_file(rows, header, path):
    """Write one gzip file (fixed timestamp, so identical input gives identical bytes). Returns its size in bytes."""
    buf = io.StringIO()
    buf.write("\n".join(header) + "\n")
    rows.to_csv(buf, index=False, lineterminator="\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0, compresslevel=9) as gz:
        gz.write(buf.getvalue().encode("utf-8"))
    return path.stat().st_size


def read_clean(path):
    """Read a clean.py output with text columns kept as text (acq_time is HHMM with leading zeros)."""
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def update_index(entries, out_dir=OUT_DIR):
    """Merge entries into index.json and drop entries whose file no longer exists."""
    path = Path(out_dir) / "index.json"
    old = json.loads(path.read_text())["files"] if path.exists() else []
    merged = {(e["source"], e["year"]): e for e in old}
    merged.update({(e["source"], e["year"]): e for e in entries})
    files = [e for k, e in sorted(merged.items()) if (Path(out_dir) / e["file"]).exists()]
    path.write_text(json.dumps({"description": "Hotspot files for the CSV download (DE-17); written by "
                                "pipeline/export_hotspots.py", "columns": COLUMNS, "files": files}, indent=1) + "\n")
    return files


def export_one(source, year, meta, clean_dir=CLEAN_DIR, out_dir=OUT_DIR):
    rows = hotspot_rows(read_clean(Path(clean_dir) / f"{source}_{year}.csv.gz"))
    name = f"{source}_{year}.csv.gz"
    size = write_hotspot_file(rows, build_header(meta, source, year), Path(out_dir) / name)
    return {"source": source, "year": year, "file": name, "rows": int(len(rows)), "bytes": int(size)}


def main(argv=None):
    p = argparse.ArgumentParser(description="Write docs/data/hotspots/ from the cleaned files.")
    p.add_argument("--source", choices=["modis", "viirs-snpp", "viirs-jpss1", "viirs-jpss2"])
    p.add_argument("--year", type=int)
    a = p.parse_args(argv)
    meta = json.loads(META_PATH.read_text())
    todo = []
    for f in sorted(CLEAN_DIR.glob("*.csv.gz")):
        m = CLEAN_NAME.match(f.name)
        if m and (not a.source or m.group(1) == a.source) and (not a.year or int(m.group(2)) == a.year):
            todo.append((m.group(1), int(m.group(2))))
    if not todo:
        raise FileNotFoundError(f"no cleaned files to export in {CLEAN_DIR}: run clean.py first")
    entries = [export_one(s, y, meta) for s, y in todo]
    files = update_index(entries)
    for e in entries:
        print(f"docs/data/hotspots/{e['file']}: {e['rows']} rows, {e['bytes'] / 1e3:.0f} kB")
    print(f"index.json: {len(files)} files, {sum(e['rows'] for e in files)} rows, "
          f"{sum(e['bytes'] for e in files) / 1e6:.2f} MB in total")


if __name__ == "__main__":
    main()
