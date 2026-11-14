"""Validation of the harmonized series.

Owner issue: RA-3. SCOPE: R2, R5.
Outputs go to method/results/ and method/figures/, summary in method/VALIDATION.md.
"""


def validate_on_held_out_years(series):
    """Validate on years not used for calibration."""
    # TODO(RA-3): implement
    raise NotImplementedError


def before_after_figure(baseline, harmonized):
    """Figure showing whether the series jumps when VIIRS enters."""
    # TODO(RA-3): implement
    raise NotImplementedError


def check_continuity_across_viirs_satellites(series):
    """Continuity across S-NPP, NOAA-20 and NOAA-21."""
    # TODO(RA-3): implement
    raise NotImplementedError


def estimate_uncertainty(series):
    """Uncertainty of the harmonized series."""
    # TODO(RA-3): implement
    raise NotImplementedError


def main():
    # TODO(RA-3)
    raise NotImplementedError


if __name__ == "__main__":
    main()
