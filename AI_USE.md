# AI use log

Every use of AI in this project is logged here (Space Apps requirement S6). The submission's AI Use Statement is built from this file.
AI is not used to come up with the solution idea.

| Date | Person | Tool | Purpose | Files |
|------|--------|------|---------|-------|
| 2026-11-14 | Jacques | Claude Code | Project setup: folder structure, skeleton files, team workflow files, dev environment, GitHub labels/milestones/issues. No algorithms, data or method decisions. | All files in the "chore: project structure and team workflow" commit |
| 2026-11-14 | Jacques | Claude (chat/Claude Code) | Compiled method/FIRMS_REFERENCE.md from the official sources listed in it and from real FIRMS files; to be reviewed by the team. | method/FIRMS_REFERENCE.md |
| 2026-11-14 | Rafael | Claude Code | Implemented pipeline/clean.py from the cleaning decisions (DE-4, DE-5, DE-9, DE-10) and checked FIRMS field values on real country CSVs; to be reviewed in the RA-1 PR. | pipeline/clean.py, .gitignore, pipeline/README.md |
| 2026-11-14 | Rafael | Claude Code | Implemented pipeline/aggregate.py (grid cells, monthly counts per satellite, missing-data month flags) from DE-12 and DE-14; to be reviewed in the RA-2a PR. | pipeline/aggregate.py, pipeline/README.md |
| 2026-11-14 | Rafael | Claude Code | Implemented pipeline/harmonize.py (conversion of MODIS-only months to the VIIRS scale with a ratio per month of year, baseline, variance) from DE-2, DE-6, DE-11 and the DE-15 backcast; to be reviewed in the RA-2b PR. | pipeline/harmonize.py, pipeline/README.md, method/results/harmonize_model.json |
| 2026-11-14 | Rafael | Claude Code | Implemented pipeline/export.py and the DATA_CONTRACT.md sections it writes (a, a2, c); generated docs/data/ from the real Rondônia data; to be reviewed in the RA-2c PR. | pipeline/export.py, DATA_CONTRACT.md, docs/data/, pipeline/README.md |
| 2026-11-14 | Rafael | Claude Code | Implemented pipeline/validate.py (DE-15 backcast, leave-one-year-out, VIIRS continuity, ratio stability, uncertainty coverage, figures), ran it on the real data and drafted method/VALIDATION.md from its outputs; to be reviewed in the RA-3 PR. | pipeline/validate.py, method/VALIDATION.md, method/results/, method/figures/, pipeline/requirements*.txt |
