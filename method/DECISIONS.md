# Decision log

Method choices are made by the team and recorded here **before** code. AI may implement and test decisions, not make them.
Status values: OPEN / PROPOSED / DECIDED.

| ID | Date/time (UTC-4) | Decision | Options considered | Chosen by | Justification | Evidence | Status |
|----|-------------------|----------|--------------------|-----------|---------------|----------|--------|
| DE-1 | | Demo area | | | | | OPEN |
| DE-2 | | Target scale: MODIS-equivalent or VIIRS-equivalent | MODIS-equivalent; VIIRS-equivalent (both acceptable if justified, per challenge author) | | | https://github.com/nasa/spaceapps/discussions/1879 | OPEN |
| DE-3 | | Calendar time step | Monthly (recommended by the challenge author); weekly only if easy to read | | | https://github.com/nasa/spaceapps/discussions/1879 | OPEN |
| DE-4 | | SP vs NRT per period | | | | | OPEN |
| DE-5 | | Cleaning rules | | | | | OPEN |
| DE-6 | | Harmonization method | | | | | OPEN |
| DE-7 | | App libraries: Leaflet 1.x (map), Leaflet.draw (rectangle selection), Plotly.js (calendar heatmap, charts, PNG download), vendored in docs/lib/ | | Jacques | | docs/lib/README.md | PROPOSED |
| DE-8 | | Data route for history: country yearly summary CSVs (SP, no MAP_KEY, 2000-2025, no NOAA-21, no 2026) vs area API (needs MAP_KEY) vs Archive Download; and for 2026 / NOAA-21 | See method/FIRMS_REFERENCE.md sections 3.1-3.3 | | | method/FIRMS_REFERENCE.md | OPEN |
| DE-9 | | Which `type` values count as burning activity, and how to treat NRT data (no `type`) | | | | method/FIRMS_REFERENCE.md section 5 | OPEN |
| DE-10 | | Confidence filter and day/night handling | | | | method/FIRMS_REFERENCE.md section 5 | OPEN |
| DE-11 | | Which satellites per era (Terra only; Terra+Aqua; + S-NPP; + NOAA-20; + NOAA-21) | | | | method/FIRMS_REFERENCE.md section 2 | OPEN |
| DE-12 | | Grid / aggregation unit | | | | | OPEN |
