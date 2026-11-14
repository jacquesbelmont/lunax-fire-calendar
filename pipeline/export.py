"""Write the app data files into docs/data/ per DATA_CONTRACT.md.

Owner issue: RA-2. SCOPE: R2, R3, R9.
This is the ONLY code that writes docs/data/.
"""


def export_monthly_counts(harmonized):
    """(a) monthly counts per grid cell, harmonized and per sensor, with missing-data flag."""
    # TODO(RA-2): implement per DATA_CONTRACT.md
    raise NotImplementedError


def export_hotspots_per_year(hotspots):
    """(b) hotspot list per year, for the CSV download."""
    # TODO(RA-2): implement per DATA_CONTRACT.md
    raise NotImplementedError


def export_metadata():
    """(c) metadata.json: area, source, product, version, period, coverage, method, cut-off date, FIRMS attribution."""
    # TODO(RA-2): implement per DATA_CONTRACT.md
    raise NotImplementedError


def main():
    # TODO(RA-2)
    raise NotImplementedError


if __name__ == "__main__":
    main()
