# WORKFLOW

Deadline: Sunday 2026-11-15 23:59, America/Porto_Velho (UTC-4). Team target: submit by 22:00.

## Roles
- **Jacques** (@jacquesbelmont): data engineering + web app.
- **Rafael** (@RafaelSdeS): harmonization + validation.
- **Tiara** (@TODO(verify): GitHub handle): scope, quality, docs, submission.

Research split: Jacques covers FIRMS data specs; Rafael covers method and validation; Tiara verifies the source of every claim in public texts.

## Milestones (America/Porto_Velho, UTC-4)
| ID | When | Goal |
|----|------|------|
| M1 | Sat 14:00 | Setup, data access, decisions, data contract |
| M2 | Sat 18:00 | Harmonized v1 + monthly calendar with real data |
| M3 | Sat 22:00 | Core app features + first submission |
| M4 | Sun 13:00 | Validation, limitations, transparency |
| M5 | Sun 16:00 | Feature freeze |
| M6 | Sun 20:00 | Slides, texts, references, tests |
| M7 | Sun 22:00 | Final submission (hard deadline 23:59) |

## Issues
DE-1, DE-2, JA-1..JA-9, RA-1..RA-6, TI-1..TI-9 — see the GitHub issue tracker; each issue lists SCOPE IDs, owner, inputs, outputs and definition of done.

## Rules
1. One branch per issue (`<issue-id>-short-name`).
2. Small PRs.
3. Every PR is reviewed by someone other than the author.
4. Tiara does the scope and fact check on every PR (TI-2).
5. Decisions go to [method/DECISIONS.md](method/DECISIONS.md) before code.
6. AI use is logged in [AI_USE.md](AI_USE.md); see [AGENTS.md](AGENTS.md).
7. No fake data, no invented numbers; unverified items are `TODO(verify)`.
