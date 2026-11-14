# Validation summary

Owner issue: RA-3 (Rafael). Figures in method/figures/, results in method/results/.
Protocol: method/DECISIONS.md DE-15, fixed before the results were seen. Code: `pipeline/validate.py`.
Data: FIRMS country CSVs (standard processing) for Brazil and Bolivia, clipped to the Rondônia bbox (DE-1), 2000-11 to 2025-12.
Every number below comes from `method/results/validation_metrics.json` unless another file is named.

## Held-out years

**Backcast** (the conversion is used backwards in time, so it is tested backwards): fitted on 2015-2025, tested on 2012-02 to 2014-12, i.e. 34 valid months and 23,630 cell-months. Prediction from MODIS is compared with the observed reference VIIRS (S-NPP).

| Method | Relative bias of the total | MdAPE of monthly area totals | Pearson r (monthly) |
|---|---|---|---|
| Ratio per month of year, Terra + Aqua (**production**) | +2.0 % | 9.2 % | 0.9985 |
| Ratio per month of year, Terra only | -4.4 % | 13.9 % | 0.981 |
| Negative binomial regression (pre-registered main option) | +133 % | 37.2 % | 0.986 |
| Negative binomial regression, Terra only | +94 % | 50.5 % | 0.970 |
| Poisson regression (POST-HOC diagnostic, not used for selection) | +3.9 % | 22.0 % | 0.998 |

**Selection** (DE-15 rule: the simplest method within a margin of the best backcast score): the ratio per month of year was both the best and the simplest pre-registered option, so it is the production method (`pipeline/harmonize.py`).

**Why the negative binomial regression failed:** its predicted total is 2.85 times the observed total already on its own training years. The NB2 likelihood gives little weight to large counts, and most of the fire is in large counts. The same formula fitted by Poisson matches the training total, which points to the weighting, not to the predictors. The cell-months with MODIS = 0, which motivated a regression, hold only a small share of the VIIRS total.

**Leave-one-year-out** over 2012-2025 (`method/results/loyo.csv`), production ratio method:
- relative bias of the yearly total between -9.4 % (2024) and +7.2 % (2017);
- MdAPE between 4.1 % (2019) and 16.5 % (2017).

The negative binomial regression is biased by +84 % to +238 % in every year.

Figure: `method/figures/backcast.png`.

## Before/after harmonization (jump when VIIRS enters)

- **Without correction**, the series would jump when VIIRS enters. In 2012-2014 the raw reference VIIRS total is 3.63 times the raw MODIS (Terra + Aqua) total.
- **After harmonization** the jump is gone. In the backcast years the converted MODIS total is within +2.0 % of the observed VIIRS total.
- Figure: `method/figures/before_after.png` (area totals per month, baseline vs harmonized). Months with missing data are gaps, not zeros.

**Stability of the ratio** (`method/results/annual_ratio.csv`):
- In the overlap, the annual VIIRS/MODIS ratio stays between 3.47 and 4.03.
- It is not related to the annual amount of fire: Spearman rho = 0.17, p = 0.55, n = 14 years.
- **Extrapolation:** five estimated years (2004, 2005, 2006, 2007, 2010) had more MODIS detections than any overlap year. Their MODIS total reached 108,555, against 65,045 at most in the overlap, so their values are extrapolated in fire activity.

## Continuity across S-NPP, NOAA-20, NOAA-21

- **S-NPP vs NOAA-20:** monthly area totals over the 83 months where both are valid (`method/results/continuity.csv`).
  - Ratio NOAA-20/S-NPP of the totals: 0.991. Monthly median 0.991, interquartile range 0.960 to 1.057.
  - The two satellites are on the same scale, so no correction factor is applied (DE-11). Figure: `method/figures/continuity.png`.
- **NOAA-21:** not in the FIRMS country CSVs; needs API data from 2024-01 (DE-8). TODO(RA-3): add when the API route exists.

## Uncertainty

**Model variance** per estimated cell-month: mu + alpha·mu², with alpha by the method of moments on the training rows (`method/results/harmonize_model.json`). It is **too narrow**:
- In the backcast, the nominal 90 % intervals cover only 76 % of cell-months and 38 % of monthly area totals.
- Summing cell variances assumes independent cells, but fire is spatially clustered and the ratio varies from year to year.

**Calibration (DE-16):**
- One variance inflation factor, lambda = 12.3, fitted on the monthly area totals of the leave-one-year-out years 2015-2025 (127 months), so that 90 % of them fall inside ±1.645·sqrt(lambda × summed variance). The value is also in `method/results/uncertainty_calibration.json`.
- Tested on the backcast years 2012-2014, which were not used to fit lambda: coverage rises to **85 %** of monthly area totals (from 38 %) and **86 %** of cell-months (from 76 %). The calibrated intervals are close to, but still a little below, the nominal 90 %.
- `docs/data/monthly_cells.csv` exports the calibrated variance (model variance × lambda). For an area, the app sums `viirs_eq` and `viirs_eq_var` over the cells.

## Sensitivity (DE-15)

**Training window** (possible MODIS orbital drift):
- Backcast trained on 2015-2019: bias -1.5 %, MdAPE 5.7 %.
- Backcast trained on 2020-2025: bias +4.9 %, MdAPE 11.3 %.
- The leave-one-year-out bias tends to fall with the year (Spearman rho = -0.46, p = 0.10, 14 years). This is consistent with a VIIRS/MODIS ratio that grows in recent years, but it is not conclusive.
- The production fit (2015-2025) is between the two. Changing the window now would mean choosing after seeing the test, so it is reported here, not changed. Decision for the team.

**Low-confidence VIIRS detections** (DE-10):
- They are 6.3 % (S-NPP) and 6.7 % (NOAA-20) of the VIIRS detections in the area.
- Removing them from the reference changes the backcast bias from +2.0 % to +2.5 % and the MdAPE from 9.2 % to 8.1 % (area level). The no-filter choice does not change the conversion materially.
- MODIS is not filtered, because its class cut-offs are not verified.

**Grid size** (DE-12): not run. The ratio per month of year is fitted on area sums, so k and every area total are the same for any cell size; only the split of a total between cells changes.

## Not done yet

- **NOAA-21 continuity:** needs API data (DE-8).
- **Calibrated intervals:** still slightly below 90 % in the backcast (see Uncertainty).
