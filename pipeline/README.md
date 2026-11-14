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
| 3 | `download.py` | route decided in DE-8: country yearly CSVs and/or FIRMS `area` API | `data/raw/` (cached, git-ignored) | JA-2, JA-4 |
| 4 | `clean.py` | `data/raw/country/<source>/<year>/*.csv` | `data/interim/clean/<source>_<year>.csv.gz` (git-ignored); `method/results/cleaning_log.csv` | RA-1 |
| 5 | `aggregate.py` | `data/interim/clean/*.csv.gz`; `data/raw/missing_days.csv` (from `download.py`) | `data/interim/monthly_counts.csv.gz`, `data/interim/month_flags.csv` (git-ignored) | RA-2 |
| 6 | `harmonize.py` | `data/interim/monthly_counts.csv.gz`, `data/interim/month_flags.csv` | `data/interim/harmonized.csv.gz` (git-ignored); `method/results/harmonize_model.json` | RA-2, DE-2 |
| 7 | `validate.py` | harmonized series | `method/results/`, `method/figures/` | RA-3 |
| 8 | `export.py` | harmonized series | `docs/data/` | RA-2 |
