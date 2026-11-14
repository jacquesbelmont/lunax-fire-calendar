"""Monthly aggregation of hotspot counts per grid cell, per sensor.

Owner issue: RA-2. SCOPE: R2, R3.
Months with missing satellite data must be flagged, never counted as zero fire.
Grid size comes from method/DECISIONS.md.
"""


def assign_grid_cell(hotspots):
    """Assign each hotspot to a grid cell."""
    # TODO(RA-2): implement after the grid-size decision is recorded
    raise NotImplementedError


def count_monthly(hotspots):
    """Count hotspots per month, per grid cell, per sensor."""
    # TODO(RA-2): implement
    raise NotImplementedError


def flag_missing_months(counts, missing_days):
    """Flag months with missing satellite data."""
    # TODO(RA-2): implement
    raise NotImplementedError


def main():
    # TODO(RA-2)
    raise NotImplementedError


if __name__ == "__main__":
    main()
