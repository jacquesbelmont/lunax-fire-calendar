# AGENTS.md — rules for any AI assistant working in this repo

NASA Space Apps Challenge 2026, "Harmonization of MODIS and VIIRS Hot Spots", team LUNAX.

1. Read [SCOPE.md](SCOPE.md), [DATA_CONTRACT.md](DATA_CONTRACT.md), [method/DECISIONS.md](method/DECISIONS.md) and [method/FIRMS_REFERENCE.md](method/FIRMS_REFERENCE.md) first. Only do work traceable to a SCOPE ID; otherwise stop and ask.
2. Never invent numbers, results, dataset fields, API parameters, library versions or references. Every number in the app, README, slides or submission texts comes from a pipeline output file (give its path) or an official URL. Unverified items get `TODO(verify): <what> - <where to check>`.
3. Method choices (demo area, target scale, SP vs NRT per period, cleaning rules, harmonization approach, thresholds, grid size) are made by the team and recorded in method/DECISIONS.md before code. AI may implement and test decisions, not make them.
4. No fake or sample data anywhere. Development uses small real FIRMS extracts only.
5. Calendar time step is monthly (challenge author guidance); weekly only as an optional extra.
6. Never sum raw MODIS and VIIRS counts. Never treat missing data as zero fire: months with missing satellite data are flagged in the data and marked in the calendar. A day or month without detections is not proof of zero fire.
7. docs/data/ is written only by pipeline/export.py; never edit it by hand.
8. Credit NASA FIRMS wherever its data appears; label data as archived with its cut-off date; no NASA logos.
9. Third-party libraries are vendored in docs/lib/ with version and license recorded.
10. English only. No secrets in code; never print .env. Do not change formats in DATA_CONTRACT.md without updating it and telling the other side.
11. Mark AI-assisted code with a header comment or a commit trailer, and log it in [AI_USE.md](AI_USE.md).
