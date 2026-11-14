"""Harmonize MODIS and VIIRS monthly series on the target scale chosen by the team.

Owner issues: RA-2, DE-2. SCOPE: R2.
Provides a baseline without correction plus the team-chosen statistical method.
Never sum raw MODIS and VIIRS counts.
"""


def baseline_without_correction(monthly_counts):
    """Baseline series with no harmonization correction (for comparison)."""
    # TODO(RA-2): implement
    raise NotImplementedError


def harmonize(monthly_counts):
    """Apply the team-chosen harmonization method (DECISIONS.md)."""
    # TODO(RA-2): implement after the method decision is recorded
    raise NotImplementedError


def main():
    # TODO(RA-2)
    raise NotImplementedError


if __name__ == "__main__":
    main()
