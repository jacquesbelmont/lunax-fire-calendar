"""Download FIRMS data into data/raw/ (country yearly CSVs; area API for NOAA-21) and the FIRMS missing-days table.

Owner issues: JA-2 (code), JA-4 (full download); area API route for NOAA-21: RA-3. SCOPE: R2, S4.
AI-assisted code (Claude Code); logged in AI_USE.md.

Routes (DE-8), layouts read by clean.py:
- FIRMS country yearly summary files (standard processing, no MAP_KEY), method/FIRMS_REFERENCE.md section 3.1:
    data/raw/country/<source>/<year>/<source>_<year>_<Country>.csv
- FIRMS area API (MAP_KEY in .env), for NOAA-21, which has no country files (section 3.3):
    data/raw/api/viirs-jpss2/<year>/viirs-jpss2_<year>_<API source>.csv   (bbox of config/area.json)
- data/raw/missing_days.csv   (columns: sat, date, processing)  -> read by aggregate.py

Usage:
    python pipeline/download.py --countries Brazil Bolivia [--sources modis viirs-snpp viirs-jpss1] [--years 2000 2025]
    python pipeline/download.py --missing-days-only
    python pipeline/download.py --api-source VIIRS_NOAA21_SP --dates 2024-01-17 2025-12-31
Files already in the cache with the size listed in the FIRMS index are skipped.
"""
import argparse
import html
import io
import json
import re
import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"

BASE_URL = "https://firms.modaps.eosdis.nasa.gov/data/country"
INDEX_URL = f"{BASE_URL}/yearly_summary_files.txt"
MISSING_DATA_URL = "https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data"
SOURCES = ("modis", "viirs-snpp", "viirs-jpss1")
RETRIES = 4
BACKOFF_SECONDS = 2.0
PAUSE_SECONDS = 0.2  # courtesy pause between requests
TIMEOUT_SECONDS = 120
# A call with DATE returns DATE .. DATE + DAY_RANGE - 1, DAY_RANGE 1..5 (https://firms.modaps.eosdis.nasa.gov/api/area/).
AREA_API_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{bbox}/{days}/{date}"
API_MAX_DAYS = 5
# Area API source -> data/raw/api/<folder>; NOAA-21 = JPSS-2, named like the country folders (viirs-jpss1 = NOAA-20).
API_FOLDERS = {"VIIRS_NOAA21_SP": "viirs-jpss2", "VIIRS_NOAA21_NRT": "viirs-jpss2"}

# Names in the missing_data table -> normalized satellite names used by clean.py and aggregate.py.
MISSING_DATA_SATELLITES = {
    "Terra (MODIS)": "Terra",
    "Aqua (MODIS)": "Aqua",
    "Suomi NPP (VIIRS)": "SNPP",
    "NOAA-20 (VIIRS)": "NOAA20",
    "NOAA-21 (VIIRS)": "NOAA21",
}
INDEX_NAME = re.compile(r"^(modis|viirs-snpp|viirs-jpss1)_(\d{4})_(.+)\.csv$")


def fetch_with_retries(url, session=None):
    """GET with retries and exponential backoff. Returns the response; raises after the last retry."""
    session = session or requests
    last = None
    for attempt in range(RETRIES):
        try:
            resp = session.get(url, timeout=TIMEOUT_SECONDS)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            last = exc
            if attempt < RETRIES - 1:
                time.sleep(BACKOFF_SECONDS * 2 ** attempt)
    raise RuntimeError(f"download failed after {RETRIES} tries: {url}: {last}")


def parse_index(text):
    """Parse yearly_summary_files.txt into a list of dicts: source, year, country, filename, size."""
    entries = []
    for line in text.splitlines()[1:]:  # first line is the header: filename,size,updated
        parts = line.split(",")
        if len(parts) < 3:
            continue
        m = INDEX_NAME.match(parts[0])
        if m:
            entries.append({"source": m.group(1), "year": int(m.group(2)), "country": m.group(3),
                            "filename": parts[0], "size": int(parts[1])})
    return entries


def select_files(entries, countries, sources=SOURCES, years=None):
    """Pick index entries for the given countries, sources and optional (first, last) year range.

    A country with no file at all is an error (names use underscores, e.g. Cote_d_Ivoire)."""
    wanted = {c for c in countries}
    known = {e["country"] for e in entries}
    missing = wanted - known
    if missing:
        raise ValueError(f"countries not in the FIRMS index: {sorted(missing)}")
    first, last = years if years else (0, 9999)
    return [e for e in entries if e["country"] in wanted and e["source"] in sources and first <= e["year"] <= last]


def local_path(entry, raw_dir=RAW_DIR):
    return Path(raw_dir) / "country" / entry["source"] / str(entry["year"]) / entry["filename"]


def download_entry(entry, raw_dir=RAW_DIR, session=None):
    """Download one file unless the cache already holds it with the size listed in the index.
    Returns "cached" or "downloaded". Writes to a temp file first, so a failed run leaves no partial file."""
    path = local_path(entry, raw_dir)
    if path.exists() and path.stat().st_size == entry["size"]:
        return "cached"
    resp = fetch_with_retries(f"{BASE_URL}/{entry['source']}/{entry['year']}/{entry['filename']}", session)
    if len(resp.content) != entry["size"]:
        raise RuntimeError(f"{entry['filename']}: got {len(resp.content)} bytes, index says {entry['size']}")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_bytes(resp.content)
    tmp.replace(path)
    time.sleep(PAUSE_SECONDS)
    return "downloaded"


def parse_missing_days(payload):
    """Turn the FIRMS missing_data JSON into a DataFrame (sat, date, processing).

    Each table row has four cells: standard date, standard satellite, NRT date, NRT satellite.
    A row can hold a standard item, an NRT item, or both. Unknown satellite names are an error."""
    if not payload.get("success"):
        raise RuntimeError("FIRMS missing_data answered success=false")
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", payload["html"], re.S):
        cells = [html.unescape(c).strip() for c in re.findall(r"<td>(.*?)</td>", tr, re.S)]
        if len(cells) != 4:
            raise ValueError(f"unexpected missing_data row with {len(cells)} cells")
        for processing, date, name in (("SP", cells[0], cells[1]), ("NRT", cells[2], cells[3])):
            if not date and not name:
                continue
            if name not in MISSING_DATA_SATELLITES:
                raise ValueError(f"unknown satellite name in missing_data: {name!r}")
            rows.append({"sat": MISSING_DATA_SATELLITES[name], "date": date, "processing": processing})
    out = pd.DataFrame(rows, columns=["sat", "date", "processing"])
    return out.sort_values(["sat", "processing", "date"]).reset_index(drop=True)


def download_missing_days(raw_dir=RAW_DIR, session=None):
    """Fetch the FIRMS missing-days table and write data/raw/missing_days.csv. Returns the DataFrame."""
    resp = fetch_with_retries(MISSING_DATA_URL, session)
    days = parse_missing_days(json.loads(resp.text))
    path = Path(raw_dir) / "missing_days.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    days.to_csv(path, index=False)
    return days


def api_windows(start, end):
    """(first day, number of days) windows of at most API_MAX_DAYS days that cover start..end exactly once."""
    days = pd.date_range(start, end, freq="D")
    return [(d.strftime("%Y-%m-%d"), min(API_MAX_DAYS, len(days) - i))
            for i, d in enumerate(days) if i % API_MAX_DAYS == 0]


def download_area_api(source, start, end, bbox, key, raw_dir=RAW_DIR, session=None):
    """Fetch start..end from the FIRMS area API and write one CSV per year. Returns {path: rows}.

    The MAP_KEY is part of the URL, so no message raised here may contain the URL."""
    frames = []
    for first, n in api_windows(start, end):
        url = AREA_API_URL.format(key=key, source=source, bbox=",".join(f"{v:g}" for v in bbox), days=n, date=first)
        try:
            text = fetch_with_retries(url, session).text
        except RuntimeError:
            raise RuntimeError(f"FIRMS area API failed: {source} {first} (+{n} days)") from None
        if not text.startswith("latitude"):  # e.g. an "Invalid MAP_KEY" answer
            raise RuntimeError(f"FIRMS area API did not return CSV: {source} {first}")
        frames.append(pd.read_csv(io.StringIO(text), dtype=str))
        time.sleep(PAUSE_SECONDS)
    df = pd.concat(frames, ignore_index=True)
    folder = API_FOLDERS[source]
    written = {}
    for year, rows in df.groupby(df["acq_date"].str[:4]):
        path = Path(raw_dir) / "api" / folder / year / f"{folder}_{year}_{source}.csv"
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        rows.to_csv(tmp, index=False)
        tmp.replace(path)
        written[path] = len(rows)
    return written


def main(argv=None):
    p = argparse.ArgumentParser(description="Download FIRMS country yearly CSVs and the missing-days table.")
    p.add_argument("--countries", nargs="+", help="country names as in the FIRMS index, e.g. Brazil Bolivia")
    p.add_argument("--sources", nargs="+", choices=SOURCES, default=list(SOURCES))
    p.add_argument("--years", nargs=2, type=int, metavar=("FIRST", "LAST"))
    p.add_argument("--missing-days-only", action="store_true")
    p.add_argument("--api-source", choices=list(API_FOLDERS), help="FIRMS area API source (needs FIRMS_MAP_KEY)")
    p.add_argument("--dates", nargs=2, metavar=("FIRST", "LAST"), help="YYYY-MM-DD range for --api-source")
    a = p.parse_args(argv)
    if a.api_source:
        if not a.dates:
            p.error("--dates is required with --api-source")
        from config import load_area, load_map_key
        for path, n in download_area_api(a.api_source, *a.dates, load_area()["bbox"], load_map_key()).items():
            print(f"{path.relative_to(ROOT)}: {n} rows")
        return
    if not a.missing_days_only:
        if not a.countries:
            p.error("--countries is required (or use --missing-days-only)")
        entries = select_files(parse_index(fetch_with_retries(INDEX_URL).text), a.countries, a.sources,
                               tuple(a.years) if a.years else None)
        counts = {"cached": 0, "downloaded": 0}
        for e in entries:
            status = download_entry(e)
            counts[status] += 1
            print(f"{status}: {e['filename']}")
        print(f"files: {len(entries)} selected, {counts['downloaded']} downloaded, {counts['cached']} cached")
    days = download_missing_days()
    print(f"data/raw/missing_days.csv: {len(days)} satellite-days")


if __name__ == "__main__":
    main()
