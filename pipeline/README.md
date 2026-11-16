# pipeline/

Python pipeline. Runs offline on our machines and writes its outputs to `docs/data/` (format: [DATA_CONTRACT.md](../DATA_CONTRACT.md)).
Method choices come from [method/DECISIONS.md](../method/DECISIONS.md); AI-assisted code is logged in [AI_USE.md](../AI_USE.md).

Setup: `python3 -m venv .venv && source .venv/bin/activate && pip install -r pipeline/requirements.txt`
The exact versions used in the setup are in `requirements.lock.txt`. Put `FIRMS_MAP_KEY` in `.env` (copy `.env.example`; never commit it).

## Run order

| # | Step | Input | Output | Owner issue |
|---|------|-------|--------|-------------|
| 1 | `config.py` (imported by the others) | `.env`, `config/area.json` | settings | JA-2 |
| 2 | `check_availability.py` | FIRMS `data_availability` | SP/NRT date ranges per sensor (record in DATA_CONTRACT.md) | JA-2 |
| 3 | `download.py` | FIRMS country yearly CSVs (no key) and the `missing_data` table; FIRMS area API with `--api-source` (MAP_KEY; NOAA-21 and 2026) | `data/raw/country/<source>/<year>/*.csv`, `data/raw/api/<source>/<year>/*.csv`, `data/raw/missing_days.csv` (git-ignored) | JA-2, JA-4; API route RA-3 |
| 4 | `clean.py` | `data/raw/<route>/<source>/<year>/*.csv` (`--route country` or `api`) | `data/interim/clean/<source>_<year>.csv.gz` (git-ignored); `method/results/cleaning_log.csv` | RA-1 |
| 5 | `aggregate.py` | `data/interim/clean/*.csv.gz`; `data/raw/missing_days.csv` (from `download.py`); `DATA_END` = last downloaded day (move it with each new download) | `data/interim/monthly_counts.csv.gz`, `data/interim/month_flags.csv` (git-ignored) | RA-2 |
| 6 | `harmonize.py` | `data/interim/monthly_counts.csv.gz`, `data/interim/month_flags.csv` | `data/interim/harmonized.csv.gz` (git-ignored); `method/results/harmonize_model.json` | RA-2, DE-2 |
| 7 | `validate.py` | `data/interim/monthly_counts.csv.gz`, `data/interim/month_flags.csv`, `data/interim/harmonized.csv.gz` | `method/results/` (validation_metrics.json, loyo.csv, continuity.csv, continuity_noaa21.csv, annual_ratio.csv), `method/figures/`; summary in `method/VALIDATION.md` | RA-3 |
| 8 | `export.py` | `data/interim/harmonized.csv.gz`, `data/interim/month_flags.csv`, `config/area.json` | `docs/data/monthly_cells.csv`, `docs/data/months.csv`, `docs/data/metadata.json` (DATA_CONTRACT.md) | RA-2 |
| 9 | `export_hotspots.py` | `data/interim/clean/*.csv.gz` | `docs/data/hotspots/<instrument>_<year>.csv.gz`, `docs/data/hotspots/index.json` (R9, DE-17) | JA-6 |
| 10 | `ml.py` (optional, RA-6) | `data/interim/monthly_counts.csv.gz`, `data/interim/month_flags.csv`, `data/interim/clean/modis_*.csv.gz` | `method/results/ml_metrics.json`, `method/results/ml_loyo.csv` (ML challenger, DE-18); with `--hybrid`: `ml_hybrid_metrics.json`, `ml_hybrid_loyo.csv` (DE-19). Does not change `docs/data/` | RA-6 |

Brazil pilot (local, SCOPE O6; data git-ignored): `pilot_brazil.py` (every state, 2000-2026) then `pilot_packs.py` (one area pack per state, DE-31 to DE-33). Commands, times and memory: [method/PILOT_BRAZIL.md](../method/PILOT_BRAZIL.md).

Tests: `.venv/bin/python -m unittest discover -s tests` and `node --test tests/js/calc.test.js tests/js/hotspots.test.js`
