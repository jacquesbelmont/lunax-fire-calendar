// JA-8: the app's calculations must reproduce method/tests/expected.json (relative tolerance 1e-9).
// Run: node --test tests/js/calc.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const calc = require("../../docs/js/calc.js");

const root = path.resolve(__dirname, "../..");
const meta = JSON.parse(fs.readFileSync(path.join(root, "docs/data/metadata.json"), "utf8"));
const expected = JSON.parse(fs.readFileSync(path.join(root, "method/tests/expected.json"), "utf8"));
const data = calc.parseCellsCsv(fs.readFileSync(path.join(root, "docs/data/monthly_cells.csv"), "utf8"), meta.grid.cell_size_deg);

function same(actual, exp, label) {
  if (exp === null) return assert.ok(Number.isNaN(actual), label + ": expected no data, got " + actual);
  assert.ok(!Number.isNaN(actual), label + ": expected " + exp + ", got no data");
  assert.ok(Math.abs(actual - exp) <= 1e-9 * Math.max(1, Math.abs(exp)), label + ": " + actual + " vs " + exp);
}

for (const area of expected.areas) {
  test("reproduces expected.json: " + area.name, () => {
    const sel = calc.selectCells(data, area.bbox_west_south_east_north);
    assert.strictEqual(sel.length, area.n_cells);
    assert.strictEqual(data.months.length, area.n_months);
    const value = calc.areaSeries(data, sel, "viirs_eq");
    const variance = calc.areaSeries(data, sel, "viirs_eq_var");
    const stats = calc.medianAnomaly(data.months, value);
    area.months.forEach((m, i) => {
      assert.strictEqual(data.months[i], m.year_month);
      const l = area.name + " " + m.year_month;
      same(value[i], m.value, l + " value");
      same(variance[i], m.var, l + " var");
      same(stats[i].median, m.median, l + " median");
      same(stats[i].diff, m.anomaly_diff, l + " diff");
      same(stats[i].ratio, m.anomaly_ratio, l + " ratio");
      assert.strictEqual(stats[i].nYears, m.n_years, l + " n_years");
    });
    assert.strictEqual(value.filter(Number.isNaN).length, area.n_months_without_data);
  });
}

test("a month with no data is never zero", () => {
  const sel = calc.selectCells(data, expected.areas[0].bbox_west_south_east_north);
  const value = calc.areaSeries(data, sel, "viirs_eq");
  assert.ok(Number.isNaN(value[data.months.indexOf("2001-06")]));
});

test("empty selection gives no data, not zero", () => {
  const value = calc.areaSeries(data, [], "viirs_eq");
  assert.ok(value.every(Number.isNaN));
});

test("median uses the mean of the two middle values when the count is even", () => {
  const months = ["2001-01", "2002-01", "2003-01", "2004-01", "2005-01"];
  const out = calc.medianAnomaly(months, [1, 3, 5, 7, 100]);
  assert.strictEqual(out[4].median, 4);
  assert.strictEqual(out[4].nYears, 4);
  assert.strictEqual(out[4].diff, 96);
  assert.strictEqual(out[4].ratio, 25);
  assert.ok(Number.isNaN(out[0].median));
});

test("ratio is empty when the median is zero", () => {
  const out = calc.medianAnomaly(["2001-01", "2002-01"], [0, 5]);
  assert.strictEqual(out[1].median, 0);
  assert.ok(Number.isNaN(out[1].ratio));
});

test("CSV export carries attribution, cut-off date and empty cells for no data", () => {
  const csv = calc.seriesCsv(meta, [{ ym: "2001-06", value: NaN, lo: NaN, hi: NaN, estimated: true, median: NaN, nYears: 0, diff: NaN, ratio: NaN }], "test");
  assert.ok(csv.includes(meta.attribution));
  assert.ok(csv.includes(meta.data_cutoff_date));
  assert.ok(csv.trim().endsWith("2001-06,,,,1,,0,,"));
});

test("provisional months are the months.csv rows with provisional = 1 (DE-4)", () => {
  const text = fs.readFileSync(path.join(root, "docs/data/months.csv"), "utf8");
  const want = new Set(text.trim().split("\n").slice(1).map((l) => l.split(",")).filter((f) => f[4] === "1").map((f) => f[0]));
  assert.strictEqual(text.split("\n")[0], "year_month,sat,missing_days,flagged,provisional");
  assert.deepStrictEqual([...calc.provisionalMonths(text)].sort(), [...want].sort());
});

test("dashed boundary of the estimated months is at the first VIIRS-observed month (2012-02), not at a no-data month", () => {
  const all = data.cells.map((c, i) => i);
  const est = calc.estimatedMonths(data, all);
  const rows = data.months.map((ym, i) => ({ ym: ym, estimated: est[i] }));
  assert.strictEqual(rows.find((r) => !r.estimated).ym, "2001-06"); // the trap: a month with no data is not estimated
  assert.strictEqual(calc.firstObservedMonth(rows), "2012-02");
  const years = [...new Set(data.months.map((m) => Number(m.slice(0, 4))))];
  assert.strictEqual(years[12], 2012);
  assert.strictEqual(calc.estimatedBoundaryPath(years, "2012-02"), "M -0.5 12.5 L 0.5 12.5 L 0.5 11.5 L 11.5 11.5");
});

test("no boundary when no month is estimated", () => {
  assert.strictEqual(calc.firstObservedMonth([{ ym: "2020-01", estimated: false }, { ym: "2020-02", estimated: false }]), null);
});

test("the comparison sentence says when the latest month is provisional", () => {
  // Real values: October 2026 vs the 25 earlier Octobers, whole area, summed from docs/data/monthly_cells.csv (viirs_eq).
  const base = { ym: "2026-10", value: 2734, median: 12804.865639999995, nYears: 25, diff: -10070.865639999995, ratio: 0.21351258786031285, estimated: false };
  const prov = calc.monthComparisonText(Object.assign({}, base, { provisional: true }), "October", "hotspots");
  assert.ok(prov.includes("median of 12805 (25 earlier years): -10071 (0.21 times the median)"));
  assert.ok(prov.includes("(provisional: near real-time data)"));
  assert.ok(prov.includes("can still change"));
  const fin = calc.monthComparisonText(Object.assign({}, base, { provisional: false }), "October", "hotspots");
  assert.ok(!fin.includes("provisional"));
  assert.ok(calc.monthComparisonText({ ym: "2025-12", value: 1, median: NaN, nYears: 0, diff: NaN, ratio: NaN }, "December", "hotspots").includes("1 hotspot."));
});

// O2 map colors: the map shows, per cell, the same numbers as the calendar for the month of the comparison.
test("map cell values equal the calendar values for the compared month", () => {
  const sel = calc.selectCells(data, expected.areas[0].bbox_west_south_east_north);
  for (const column of ["viirs_eq", "noaa20", "terra"]) {
    const area = calc.areaSeries(data, sel, column);
    const rows = data.months.map((ym, i) => ({ ym, value: area[i], inRange: true }));
    for (const monthNo of [1, 9, 10]) {
      const m = calc.comparedMonthIndex(rows, monthNo);
      assert.ok(m >= 0);
      assert.strictEqual(Number(rows[m].ym.slice(5, 7)), monthNo);
      const later = rows.slice(m + 1).filter((r) => Number(r.ym.slice(5, 7)) === monthNo && !Number.isNaN(r.value));
      assert.strictEqual(later.length, 0, "no later year with data");
      const cells = calc.cellMonthValues(data, sel, column, m);
      cells.forEach((c) => {
        const single = calc.areaSeries(data, [c.index], column)[m];
        assert.ok(Object.is(c.value, single) || (Number.isNaN(c.value) && Number.isNaN(single)), column + " " + rows[m].ym + " cell " + c.index);
      });
      const sum = cells.reduce((s, c) => s + c.value, 0);
      if (!Number.isNaN(area[m])) assert.ok(Math.abs(sum - area[m]) <= 1e-9 * Math.max(1, area[m]), column + " sum " + rows[m].ym);
    }
  }
});

test("comparedMonthIndex respects the period and falls back to a month without data", () => {
  const rows = [
    { ym: "2024-09", value: 5, inRange: true }, { ym: "2025-09", value: NaN, inRange: true }, { ym: "2026-09", value: 7, inRange: false },
  ];
  assert.strictEqual(calc.comparedMonthIndex(rows, 9), 0);
  assert.strictEqual(calc.comparedMonthIndex([rows[1]], 9), 0);
  assert.strictEqual(calc.comparedMonthIndex(rows, 10), -1);
});

test("map color scale: 95th percentile cap, no data ignored, reversed Viridis ends", () => {
  const values = Array.from({ length: 20 }, (_, i) => i + 1).concat([NaN]);
  assert.strictEqual(calc.colorCap(values), 19);
  assert.strictEqual(calc.colorCap([NaN, 0]), 1);
  assert.strictEqual(calc.viridisReversed(0, 10), "#fde725");
  assert.strictEqual(calc.viridisReversed(10, 10), "#440154");
  assert.strictEqual(calc.viridisReversed(50, 10), "#440154");
});

test("DE-21 map note: the harmonized value counts NOAA-20 from 2018-04, Suomi NPP before, and is estimated before 2012-02 (checked on the data)", () => {
  const all = data.cells.map((_, i) => i), at = (ym) => data.months.indexOf(ym);
  const eq = calc.areaSeries(data, all, "viirs_eq"), n20 = calc.areaSeries(data, all, "noaa20"), snpp = calc.areaSeries(data, all, "snpp");
  assert.match(calc.harmonizedSource("2026-10"), /NOAA-20/);
  assert.strictEqual(eq[at("2026-10")], n20[at("2026-10")]);
  assert.match(calc.harmonizedSource("2015-08"), /Suomi NPP/);
  assert.strictEqual(eq[at("2015-08")], snpp[at("2015-08")]);
  assert.match(calc.harmonizedSource("2005-09"), /estimated from MODIS/);
  assert.ok(calc.estimatedMonths(data, all)[at("2005-09")]);
});

// DE-22: the usual value of one cell is the DE-13 median of a one-cell area, so the map and section 4 agree.
test("DE-22 cellUsual equals the DE-13 median of a one-cell selection", () => {
  for (const ym of ["2005-09", "2015-08", "2026-10"]) {
    const m = data.months.indexOf(ym);
    data.cells.forEach((c, i) => {
      const stats = calc.medianAnomaly(data.months, calc.areaSeries(data, [i], "viirs_eq"));
      same(calc.cellUsual(data, i, "viirs_eq", m), Number.isNaN(stats[m].median) ? null : stats[m].median, c.id + " " + ym);
    });
  }
});

test("DE-22 class edges: band 2*sqrt(max(median, 1)), ratios 2 and 0.5, no data never zero", () => {
  const cases = [[NaN, 5, "none"], [5, NaN, "first"], [120, 100, "near"], [121, 100, "above"], [200, 100, "much_above"],
    [80, 100, "near"], [79, 100, "below"], [50, 100, "much_below"], [2, 0, "near"], [3, 0, "much_above"], [0, 0, "near"]];
  for (const [v, m, key] of cases) assert.strictEqual(calc.usualClass(v, m), key, v + " vs " + m);
  assert.deepStrictEqual(calc.USUAL_CLASSES.map((c) => c[0]), ["much_above", "above", "near", "below", "much_below", "first", "none"]);
});

// DE-23: whole area, start/peak/end month per year. Expected values computed independently in Python from
// docs/data/monthly_cells.csv on 2026-11-15 (same rule: missing months tried as 0 and as the largest value of that month).
test("DE-23 fire season of the whole area per year and the typical season", () => {
  const all = calc.selectCells(data, meta.area.bbox_west_south_east_north);
  const v = calc.areaSeries(data, all, "viirs_eq");
  const per = calc.seasonByYear(data.months.map((ym, i) => ({ ym: ym, value: v[i], inRange: true })));
  const got = per.map((s) => s.year + ":" + (s.reason || [s.start, s.peak, s.end].join("/"))).join(" ");
  assert.strictEqual(got, "2000:missing data 2001:missing data 2002:8/9/10 2003:8/9/10 2004:8/9/10 2005:8/9/10 2006:8/9/9 " +
    "2007:8/9/10 2008:8/9/10 2009:8/9/10 2010:8/9/10 2011:8/9/10 2012:8/9/10 2013:8/9/10 2014:8/8/10 2015:8/9/10 2016:7/9/10 " +
    "2017:7/9/10 2018:8/9/10 2019:8/8/9 2020:8/9/10 2021:8/8/10 2022:8/9/11 2023:missing data 2024:7/8/10 2025:7/8/10 2026:missing data");
  assert.deepStrictEqual(calc.typicalSeason(per), { n: 23, start: 8, peak: 9, end: 10, earliestStart: 7, nEarliest: 4, latestEnd: 11, nLatest: 1 });
  // months outside the chosen period are missing, never zero: a period inside one year gives that year only
  const only2025 = calc.seasonByYear(data.months.map((ym, i) => ({ ym: ym, value: v[i], inRange: ym.startsWith("2025") })));
  assert.deepStrictEqual(only2025, [{ year: 2025, start: 7, peak: 8, end: 10 }]);
});

// DE-26: classes of years with detections, and the canvas rows in the map's projection.
test("DE-26 recurrence classes and Web Mercator cell placement", () => {
  const cls = (y) => (calc.recurrenceClass(y) || [null])[0];
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 13].map(cls), [null, 1, 1, 3, 3, 5, 5, 7, 7, 10, 10]);
  const box = meta.area.bbox_west_south_east_north, W = 1450, H = calc.mercatorHeight(box, W);
  const lines = fs.readFileSync(path.join(root, "docs/data/recurrence.csv"), "utf8").trim().split("\n").slice(1);
  let prevTop = -Infinity;
  for (const id of lines.map((l) => l.split(",")[0]).sort((a, b) => Number(b.split("_")[0]) - Number(a.split("_")[0]))) {
    const [x, y, w, h] = calc.recurrenceCellRect(id, box, W, H);
    assert.ok(x >= -1e-6 && x + w <= W + 1e-6 && y >= -1e-6 && y + h <= H + 1e-6 && h > 0, id + " inside the canvas");
    assert.ok(y >= prevTop - 1e-9, id + " rows go down as latitude goes down"); prevTop = y;
  }
  // a cell's top edge on the canvas equals the Web Mercator position of its north edge
  const [, y] = calc.recurrenceCellRect("7900_11700", box, W, H), m = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  assert.ok(Math.abs(y - (m(box[3]) - m(-10.99)) / (m(box[3]) - m(box[1])) * H) < 1e-6);
});
