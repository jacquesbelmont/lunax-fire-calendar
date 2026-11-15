/*
 * DE-27 pre-registered test of the fire-season outlook on the 52 municipalities (docs/data/municipalities.csv).
 * Uses the same functions as the app (docs/js/calc.js). Writes method/results/outlook_hindcast.json.
 * Run: node method/outlook_hindcast.js   (then python pipeline/export.py --check copies the summary into metadata.json)
 * Owner issue: RA-9 (#59). AI-assisted code (Claude Code); logged in AI_USE.md.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const calc = require("../docs/js/calc.js");

const root = path.resolve(__dirname, "..");
const data = calc.parseCellsCsv(fs.readFileSync(path.join(root, "docs/data/municipalities.csv"), "utf8"), 0.25, "area_id");
const TEST = [2013, 2025], FRESH = 2026;
const totals = data.cells.map((c, i) => calc.seasonTotals(data.months.map((ym, m) => ({ ym, value: data.columns.viirs_eq[i * data.nMonths + m] }))));
function median(v) {
  const s = v.slice().sort((a, b) => a - b), h = s.length >> 1;
  return !s.length ? NaN : s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
const r4 = (x) => Math.round(x * 1e4) / 1e4;

/** Pooled MALE per method over the municipality-years where all `methods` have a forecast, for years from..to. */
function compare(methods, from, to) {
  const abs = methods.map(() => []);
  totals.forEach((t) => calc.outlookErrors(t, methods, from, to).forEach((e) => e.errors.forEach((x, k) => abs[k].push(Math.abs(x)))));
  return { n: abs[0].length, male: Object.fromEntries(methods.map((m, k) => [m, r4(median(abs[k]))])) };
}

/** DE-27 rule: `cand` replaces C only if its test MALE is at least 10 % lower than C's and its fresh MALE is lower. */
function choose(test, fresh, cands) {
  const best = cands.slice().sort((a, b) => test.male[a] - test.male[b])[0];
  const ok = test.male[best] <= 0.9 * test.male.C && fresh.male[best] < fresh.male.C;
  return { best_candidate: best, chosen: ok ? best : "C", replaces_climatology: ok };
}

const preTest = compare(["C", "P", "P3"], ...TEST), preFresh = compare(["C", "P", "P3"], FRESH, FRESH);
const earlyTest = compare(["C", "R"], ...TEST), earlyFresh = compare(["C", "R"], FRESH, FRESH);
const out = {
  decision: "method/DECISIONS.md DE-27 (PROPOSED)", areas: "52 municipalities, docs/data/municipalities.csv viirs_eq",
  target: "August-October total", test_years: TEST, fresh_year: FRESH,
  error: "|ln((forecast + 1) / (observed + 1))|; MALE = median over municipality-years",
  pre_season: { test: preTest, fresh: preFresh, ...choose(preTest, preFresh, ["P", "P3"]) },
  early_season: { test: earlyTest, fresh: earlyFresh, ...choose(earlyTest, earlyFresh, ["R"]) },
};
fs.writeFileSync(path.join(root, "method/results/outlook_hindcast.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 1));
