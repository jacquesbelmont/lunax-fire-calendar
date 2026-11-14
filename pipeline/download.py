"""Download hotspots from the FIRMS area API into data/raw/.

Owner issues: JA-2 (small samples), JA-4 (full download). SCOPE: R2, S4.
Two possible routes (the choice is DE-8, a team decision): country yearly summary CSVs (no MAP_KEY, standard data to 2025) and the area API (MAP_KEY; for 2026 and NOAA-21).
Requirements: throttling below the transaction limit, retries on errors, raw-file cache.
Reference: official FIRMS academy examples (see SOURCES.md).
"""


def build_area_url(source, bbox, day_range, date):
    """Build the area API URL (format in DATA_CONTRACT.md) without exposing the key in logs."""
    # TODO(JA-2): implement
    raise NotImplementedError


def fetch_with_retries(url):
    """GET with retries on errors."""
    # TODO(JA-2): implement
    raise NotImplementedError


def throttle():
    """Stay below the FIRMS transaction limit."""
    # TODO(JA-2): implement
    raise NotImplementedError


def download_source(source, start_date, end_date):
    """Download one source over a period, skipping files already cached in data/raw/."""
    # TODO(JA-4): implement
    raise NotImplementedError


def download_missing_data_days():
    """Record missing-data days per sensor (missing_data endpoint)."""
    # TODO(JA-4): implement; TODO(verify): request format - see DATA_CONTRACT.md
    raise NotImplementedError


def main():
    # TODO(JA-2, JA-4)
    raise NotImplementedError


if __name__ == "__main__":
    main()
