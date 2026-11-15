# Validation summary

Owner issue: RA-3 (Rafael). Figures in method/figures/, results in method/results/.
Protocol: method/DECISIONS.md DE-15, fixed before the results were seen. Code: `pipeline/validate.py`.
Data: FIRMS country CSVs (standard processing), only detections inside the IBGE boundary of Rondônia (DE-1), 2000-11 to 2025-12; NOAA-21 from the FIRMS area API (standard processing), 2024-01-17 to 2025-12-31. This is the DE-15 period: the 2026 months in the app (partly provisional near real-time data) are left out of the validation (`VALIDATION_END` in `pipeline/validate.py`).
Every number below comes from `method/results/validation_metrics.json` unless another file is named.

## Held-out years

**Backcast** (the conversion is used backwards in time, so it is tested backwards): fitted on 2015-2025, tested on 2012-02 to 2014-12, i.e. 34 valid months and 12,784 cell-months. Prediction from MODIS is compared with the observed reference VIIRS (S-NPP).

| Method | Relative bias of the total | MdAPE of monthly area totals | Pearson r (monthly) |
|---|---|---|---|
| Ratio per month of year, Terra + Aqua (**production**) | +0.6 % | 13.3 % | 0.998 |
| Ratio per month of year, Terra only | -8.5 % | 27.3 % | 0.965 |
| Negative binomial regression (pre-registered main option) | +143 % | 42.8 % | 0.976 |
| Negative binomial regression, Terra only | +89 % | 51.6 % | 0.937 |
| Poisson regression (POST-HOC diagnostic, not used for selection) | +4.7 % | 32.6 % | 0.997 |

**Selection** (DE-15 rule: the simplest method within a margin of the best backcast score): the ratio per month of year was both the best and the simplest pre-registered option, so it is the production method (`pipeline/harmonize.py`).

**Why the negative binomial regression failed:** its predicted total is 2.87 times the observed total already on its own training years. The NB2 likelihood gives little weight to large counts, and most of the fire is in large counts. The same formula fitted by Poisson matches the training total, which points to the weighting, not to the predictors.

**Terra only:** the Terra-only ratio, used for 2000-11 to 2002-06 and for months with Aqua flagged, is clearly less accurate than Terra + Aqua (-8.5 % bias, 27.3 % MdAPE). Those months carry more uncertainty.

**Leave-one-year-out** over 2012-2025 (`method/results/loyo.csv`), production ratio method:
- relative bias of the yearly total between -9.7 % (2025) and +7.9 % (2023);
- MdAPE between 5.7 % (2017) and 20.3 % (2023).

The negative binomial regression is biased by +95 % to +247 % in every year.

Figure: `method/figures/backcast.png`.

## Before/after harmonization (jump when VIIRS enters)

- **Without correction**, the series would jump when VIIRS enters. In 2012-2014 the raw reference VIIRS total is 3.81 times the raw MODIS (Terra + Aqua) total.
- **After harmonization** the jump is gone. In the backcast years the converted MODIS total is within +0.6 % of the observed VIIRS total.
- Figure: `method/figures/before_after.png` (area totals per month, baseline vs harmonized). Months with missing data are gaps, not zeros.

**Stability of the ratio** (`method/results/annual_ratio.csv`):
- In the overlap, the annual VIIRS/MODIS ratio stays between 3.66 and 4.28.
- It is not related to the annual amount of fire: Spearman rho = 0.00, p = 0.99, n = 14 years.
- **Extrapolation:** six estimated years (2003-2007, 2010) had more MODIS detections than any overlap year. Their MODIS total reached 71,460, against 22,872 at most in the overlap, so their values are extrapolated in fire activity.

## Continuity across S-NPP, NOAA-20, NOAA-21

- **S-NPP vs NOAA-20:** monthly area totals over the 83 months where both are valid (`method/results/continuity.csv`).
  - Ratio NOAA-20/S-NPP of the totals: 0.992. Monthly median 1.001, interquartile range 0.95 to 1.05.
  - The two satellites are on the same scale, so no correction factor is applied (DE-11). Figure: `method/figures/continuity.png`.
- **NOAA-20 vs NOAA-21:** monthly area totals over the 21 months where both are valid, 2024-04 to 2025-12 (`method/results/continuity_noaa21.csv`). NOAA-21 is flagged in 2024-01 to 2024-03 (start on 2024-01-17 and FIRMS missing days), and NOAA-20 in 2024-02.
  - Ratio NOAA-21/NOAA-20 of the totals: 0.956. Monthly median 0.958, interquartile range 0.82 to 1.02.
  - NOAA-21 counts about 4.4 % fewer hotspots than NOAA-20 in this area. NOAA-21 is only a check (DE-11), so no correction is applied and the series does not change. A factor is needed before NOAA-21 replaces NOAA-20 as the reference. Figure: `method/figures/continuity.png` (lower panel).

## Uncertainty

**Model variance** per estimated cell-month: mu + alpha·mu², with alpha by the method of moments on the training rows (`method/results/harmonize_model.json`). It is **too narrow**:
- In the backcast, the nominal 90 % intervals cover only 76 % of cell-months and 41 % of monthly area totals.
- Summing cell variances assumes independent cells, but fire is spatially clustered and the ratio varies from year to year.

**Calibration (DE-16):**
- One variance inflation factor, lambda = 11.5, fitted on the monthly area totals of the leave-one-year-out years 2015-2025 (127 months), so that 90 % of them fall inside ±1.645·sqrt(lambda × summed variance). The value is also in `method/results/uncertainty_calibration.json`.
- Tested on the backcast years 2012-2014, which were not used to fit lambda: coverage rises to **85 %** of monthly area totals (from 41 %) and **85 %** of cell-months (from 76 %). The calibrated intervals are close to, but still a little below, the nominal 90 %.
- `docs/data/monthly_cells.csv` exports the calibrated variance (model variance × lambda). For an area, the app sums `viirs_eq` and `viirs_eq_var` over the cells.

## Sensitivity (DE-15)

**Training window** (possible MODIS orbital drift):
- Backcast trained on 2015-2019: bias -1.0 %, MdAPE 9.8 %.
- Backcast trained on 2020-2025: bias +2.5 %, MdAPE 17.5 %.
- The leave-one-year-out bias tends to fall with the year, but not significantly (Spearman rho = -0.35, p = 0.22, 14 years).
- The production fit (2015-2025) is between the two. Changing the window now would mean choosing after seeing the test, so the team kept 2015-2025 (DE-15).

**Low-confidence detections** (DE-10; `sensitivity.low_confidence`), backcast at area level:
- VIIRS low (class `l`) are 6.2 % (S-NPP) and 6.6 % (NOAA-20) of the VIIRS detections in the area. MODIS low (confidence C < 30 %, MODIS C6/C6.1 user guide Table 11) are 6.6 % (Terra) and 4.3 % (Aqua) of the MODIS detections.

| Low-confidence detections removed | Relative bias of the total | MdAPE of monthly area totals |
|---|---|---|
| None (production) | +0.6 % | 13.3 % |
| VIIRS low, from the reference | +1.2 % | 12.9 % |
| MODIS low, from the predictor | +1.1 % | 11.6 % |
| Both | +1.7 % | 11.0 % |

- The no-filter choice does not change the conversion materially for either sensor.

**Grid size** (DE-12): not run. The ratio per month of year is fitted on area sums, so k and every area total are the same for any cell size; only the split of a total between cells changes.

## ML challenger (RA-6, DE-18)

Gradient boosting with Poisson loss (`pipeline/ml.py`, scikit-learn 1.9.1) on MODIS counts, FRP, night share, low-confidence share and month, with hyperparameters and the margin fixed in DE-18 before any result. Results: `method/results/ml_metrics.json`, `method/results/ml_loyo.csv`.

| Backcast 2012-2014 (same 12,784 cell-months) | Relative bias of the total | MdAPE of monthly area totals | Pearson r |
|---|---|---|---|
| Ratio, Terra + Aqua (**production**) | +0.6 % | 13.3 % | 0.998 |
| ML, Terra + Aqua | +3.3 % | 17.5 % | 0.997 |
| Ratio, Terra only | -8.5 % | 27.3 % | 0.965 |
| ML, Terra only | +2.0 % | 33.5 % | 0.973 |

- **Verdict (DE-18 rule: Terra + Aqua MdAPE ≤ 11.3 % and |bias| ≤ 2 %):** the ML model does not beat the ratio method. Production is unchanged.
- **Leave-one-year-out 2012-2025** (Terra + Aqua): median MdAPE 13.5 % (ML) vs 11.7 % (ratio); ML yearly bias from -9.7 % to +15.2 %, ratio from -9.7 % to +7.9 %.
- With far more parameters, the ML model gains nothing on monthly area totals. The simplest method stays the best, as the DE-15 selection rule prefers.

**Exploratory hybrid (DE-19, registered after the DE-18 result).** The ratio method stays the base and gradient boosting learns only a multiplicative correction (Poisson model with the ratio as offset; `python pipeline/ml.py --hybrid`). Results: `method/results/ml_hybrid_metrics.json`, `method/results/ml_hybrid_loyo.csv`.

| Test | Hybrid: bias / MdAPE | Ratio: bias / MdAPE |
|---|---|---|
| Leave-one-year-out 2015-2025, used to choose the candidate (median MdAPE, pooled bias) | -3.1 % / 24.8 % | 0.0 % / 11.8 % |
| Backcast 2012-2014 (POST-HOC: these years were seen in DE-18) | -2.9 % / 12.8 % | +0.6 % / 13.3 % |
| Fresh test 2026-02 to 2026-10, 9 months (never used by any method; 2026-01 has Terra flagged) | -5.3 % / 38.0 % | -8.4 % / 20.1 % |
| 2026-02 to 2026-07 (low fire, 806 reference NOAA-20 hotspots) | -23.4 % / 64.6 % | -15.9 % / 38.2 % |
| 2026-08 to 2026-10 (fire season, 8,254 reference NOAA-20 hotspots, NRT) | -3.6 % / 6.5 % | -7.7 % / 7.6 % |

- **Verdict (DE-19 rule):** not promising. Production is unchanged.
- **Seen only after the results:** the hybrid does better in the high-fire months and worse in the low-fire months, which weigh as much in the MdAPE. This is not tested and is not a basis for any choice.
- **Ratio method forward in time:** fitted on 2015-2025, the ratio under-predicts the NOAA-20 total of 2026-02 to 2026-10 by 8.4 %. It is applied only backwards (2000-2012), so this does not change the product, but it is consistent with the possible MODIS drift noted under Sensitivity.

## Not done yet

- **Calibrated intervals:** still slightly below 90 % in the backcast (see Uncertainty).
