# Fact check

Owner issue: TI-6 (Tiara). Every number or claim in the project page, the app text, the slides and the README maps to a pipeline file path or an official URL.
"Checked by": a first check was done on 2026-11-15 by Claude Code, reading the file or recomputing the number from the data (command in the last column when it is not a plain file read). Tiara re-checks each row before the submission.

| # | Claim | Where used | Source (file or URL) | First check | Status |
|---|-------|-----------|----------------------|-------------|--------|
| 1 | MODIS has 1 km pixels, since Nov 2000 (Terra) and Jul 2002 (Aqua) | page, slides 2-3, HOW_IT_WORKS | method/FIRMS_REFERENCE.md section 2 (FIRMS active-fire page) | file read | OK |
| 2 | VIIRS has 375 m pixels, since 2012-01-20 (Suomi NPP) and 2018-04-01 (NOAA-20) | page, slides 2-3, HOW_IT_WORKS | method/FIRMS_REFERENCE.md section 2 (FIRMS download page) | file read; first Suomi NPP detection in the files 2012-01-20 | OK |
| 3 | MODIS is being retired and replaced by VIIRS | page, slide 2 | challenge video (FIRMS_REFERENCE.md section 1); CAMS article (Terra Jan 2027, Aqua about Sep 2027) | file read | OK |
| 4 | VIIRS counted about 3.8 times more than MODIS in 2012-2014 | page, slide 2, HOW_IT_WORKS | method/results/validation_metrics.json `raw_ratio_viirs_to_modis_2012_2014` = 3.8148 | recomputed from the JSON | OK, but method/VALIDATION.md and METHOD.md write 3.82; the JSON rounds to 3.81. Rafael to align the texts |
| 5 | 376 active grid cells of 0.25 degrees, 302 months, 2000-11 to 2025-12 | page, slide 3 | docs/data/monthly_cells.csv, docs/data/metadata.json | recounted from the CSV | OK |
| 6 | 129 months converted from MODIS (with data); 10 months with no data | page | docs/data/monthly_cells.csv | recounted from the CSV | OK |
| 7 | 24 of 845 satellite-months flagged for missing days | page | docs/data/months.csv | recounted from the CSV | OK |
| 8 | 2,043,625 detections kept; 48 hotspot files; 23.9 MB | page (not quoted), README | method/results/cleaning_log.csv; docs/data/hotspots/index.json | recounted | OK |
| 9 | Ratios from 1.45 to 4.63 for Terra + Aqua; learned on 2015-2025 | page | method/results/harmonize_model.json; docs/data/metadata.json | file read | OK |
| 10 | Test on 2012-2014: total within 0.6%; median error of monthly totals 13.3%; correlation 0.998 | page, slide 5, HOW_IT_WORKS | method/results/validation_metrics.json (0.0062, 0.1325, 0.9977) | recomputed from the JSON | OK |
| 11 | The model first proposed (negative binomial regression) failed with a bias of +143% | page, slide 5 | validation_metrics.json (1.4315) | recomputed from the JSON | OK |
| 12 | Suomi NPP and NOAA-20 agree: ratio of totals 0.992 over 83 months | page, slide 5, HOW_IT_WORKS | validation_metrics.json (0.99175); method/results/continuity.csv; method/VALIDATION.md | JSON read; 83 months from VALIDATION.md (not recounted) | OK |
| 13 | Calibrated 90% intervals cover 85% of monthly area totals in the test | page, slide 5, HOW_IT_WORKS | validation_metrics.json `uncertainty_calibration` (0.853, 0.848) | recomputed from the JSON | OK |
| 14 | Terra-only months are less accurate (bias -8.5%, median error 27.3%) | page, HOW_IT_WORKS | validation_metrics.json (-0.0848, 0.2726) | recomputed from the JSON | OK |
| 15 | 2003-2007 and 2010 had more MODIS detections than any year of the overlap | HOW_IT_WORKS | method/VALIDATION.md "Stability of the ratio"; validation_metrics.json `ratio_stability` | file read | OK |
| 16 | Only detections inside the IBGE boundary of Rondônia are counted; `type` 0 only | page, slide 6 | method/METHOD.md section 2; method/results/cleaning_log.csv; config/area_boundary.geojson | file read; clean.py re-run on all 48 instrument-years gave the same `rows_kept` | OK |
| 17 | Data are FIRMS standard processing, 2000-11-01 to 2025-12-31, Brazil and Bolivia files, downloaded 2026-11-14 | page, slide 6 | data/PROVENANCE.md; docs/data/metadata.json | file read; re-download 2026-11-15, same cleaned rows | OK |
| 18 | FIRMS acknowledgment text | footer, page, slide 7, HOW_IT_WORKS | docs/data/metadata.json `attribution`; FIRMS page | file read | OK |
| 19 | 2026 and NOAA-21 are only available through the FIRMS API | page, slide 6 | method/FIRMS_REFERENCE.md section 3; method/METHOD.md limitation 8 | file read | OK |
| 20 | The app compares the latest month in the data (December 2025), not the current month | page, HOW_IT_WORKS | docs/data/metadata.json `data_cutoff_date` | file read | OK |
| 21 | AI tools: Claude and Claude Code; every step logged in AI_USE.md | page, slide 7, README | AI_USE.md | file read | OK for the log; see open item 4 for the sentence on the idea |
| 22 | The tool is not an official NASA product; do not use for the preservation of life or property | page, footer, HOW_IT_WORKS | method/FIRMS_REFERENCE.md section 10 (FIRMS map warning) | file read | OK |
| 23 | Library versions and licenses | page, slide 7 | SOURCES.md (read from each package's metadata, 2026-11-15) | recomputed from package metadata | OK |
| 24 | The deadline and rules of the submission | CHECKLIST | SCOPE.md S1-S8; https://www.spaceappschallenge.org/resources/project-submission-guide/ | SCOPE.md read; the guide was not re-read | Tiara to re-read the guide |

## Open items (none may reach the submission as a TODO)
1. **Tiara's full name** for the title slide and the team line (S2: member names). Also confirm the spelling of the two other names.
2. **IBGE data license** (SOURCES.md): TODO(verify) - https://www.ibge.gov.br. The boundary is used and shown; state its license or terms of use in the references.
3. **Row 4:** align 3.81 / 3.82 in method/VALIDATION.md, method/METHOD.md and method/DECISIONS.md (Rafael).
4. **AI statement:** the team (Jacques and Rafael) confirms that the solution idea was theirs and that the decisions were theirs. The AI log (AI_USE.md) shows that an AI assistant drafted options and recommendations for the method decisions (DE-1 to DE-16); the statement says so. Confirm before submitting.
5. **Accessibility of the color ramp:** the pages do not claim it. If the team wants to claim it, check it with a color-vision simulator and write down the result (TI-8).
6. **Visual and device tests** (private window, another computer, phone): see CHECKLIST.md. The published site was checked by URL (HTTP 200), not looked at by Claude Code.
7. **Space Apps account steps** that only the members can do: Members tab, same Local Event, saving progress, Submit for Judging (S8).
8. **MODIS version strings** (`6.03`, `6.2`, `61.03`): the meaning is TODO(verify) in method/METHOD.md; the public texts do not mention it.
