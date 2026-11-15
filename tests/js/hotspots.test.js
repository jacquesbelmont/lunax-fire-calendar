// R9 / DE-17: the hotspot files must agree with monthly_cells.csv and with cleaning_log.csv.
// Skipped while docs/data/hotspots/ has not been generated. If it exists but is incomplete, the completeness test fails.
// Run: node --test tests/js/hotspots.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const calc = require("../../docs/js/calc.js");

const root = path.resolve(__dirname, "../..");
const dir = path.join(root, "docs/data/hotspots");
const indexPath = path.join(dir, "index.json");
const skip = fs.existsSync(indexPath) ? false : "docs/data/hotspots/ not generated yet (run pipeline/export_hotspots.py)";

const meta = JSON.parse(fs.readFileSync(path.join(root, "docs/data/metadata.json"), "utf8"));
const data = calc.parseCellsCsv(fs.readFileSync(path.join(root, "docs/data/monthly_cells.csv"), "utf8"), meta.grid.cell_size_deg);
const SAT_COLUMN = { Terra: "terra", Aqua: "aqua", SNPP: "snpp", NOAA20: "noaa20", NOAA21: "noaa21" };

function readText(entry) {
  return zlib.gunzipSync(fs.readFileSync(path.join(dir, entry.file))).toString("utf8");
}
function allCells() { return new Set(data.cells.map((c) => c.id)); }
function parseAll(entry) {
  const out = { header: null, lines: [] };
  calc.filterHotspots(readText(entry), allCells(), "0000-00", "9999-99", out);
  return out;
}
function logRows() {
  const [head, ...rows] = fs.readFileSync(path.join(root, "method/results/cleaning_log.csv"), "utf8").trim().split("\n");
  const cols = head.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], v])));
}

test("every file has the attribution header and as many rows as index.json says", { skip }, () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  for (const e of index.files) {
    const text = readText(e);
    assert.ok(text.includes(meta.attribution), e.file + ": attribution");
    assert.ok(text.includes(meta.data_cutoff_date), e.file + ": cut-off date");
    const out = parseAll(e);
    assert.strictEqual(out.header, index.columns.join(","), e.file + ": header");
    assert.strictEqual(out.lines.length, e.rows, e.file + ": rows");
  }
});

test("rows per source and year equal rows_kept of cleaning_log.csv", { skip }, () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")), log = logRows();
  for (const e of index.files) {
    const row = log.find((r) => r.source === e.source && Number(r.year) === e.year);
    assert.ok(row, e.file + ": no row in cleaning_log.csv");
    assert.strictEqual(e.rows, Number(row.rows_kept), e.file);
  }
});

test("all source-years of cleaning_log.csv have a hotspot file (complete set)", { skip }, () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")), have = new Set(index.files.map((e) => e.source + "_" + e.year));
  const missing = logRows().map((r) => r.source + "_" + r.year).filter((k) => !have.has(k));
  assert.deepStrictEqual(missing, [], "missing hotspot files");
});

test("counts per cell, month and satellite equal monthly_cells.csv (where it has data)", { skip }, () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const cellIdx = new Map(data.cells.map((c, i) => [c.id, i])), monthIdx = new Map(data.months.map((m, i) => [m, i]));
  const nM = data.nMonths;
  for (const e of index.files) {
    const counts = new Map(); // "cell|month|sat" -> n
    const sats = new Set();
    parseAll(e).lines.forEach((line) => {
      const f = line.split(",");
      assert.ok(cellIdx.has(f[0]), e.file + ": hotspot in a cell missing from monthly_cells.csv: " + f[0]);
      const key = f[0] + "|" + f[3].slice(0, 7) + "|" + f[5];
      counts.set(key, (counts.get(key) || 0) + 1);
      sats.add(f[5]);
    });
    // satellites of this source (a file with no row for a satellite still has to match its zero counts)
    const satsOfSource = { modis: ["Terra", "Aqua"], "viirs-snpp": ["SNPP"], "viirs-jpss1": ["NOAA20"],
      "viirs-jpss2": ["NOAA21"] }[e.source];  // same as SOURCE_SATS in pipeline/aggregate.py
    let checked = 0;
    for (const sat of satsOfSource) {
      const column = data.columns[SAT_COLUMN[sat]];
      for (const [month, m] of monthIdx) {
        if (Number(month.slice(0, 4)) !== e.year) continue;
        for (const [id, i] of cellIdx) {
          const expected = column[i * nM + m];
          if (Number.isNaN(expected)) continue; // no data / flagged month: monthly_cells.csv leaves it empty
          assert.strictEqual(counts.get(id + "|" + month + "|" + sat) || 0, expected, e.file + " " + id + " " + month + " " + sat);
          checked++;
        }
      }
    }
    assert.ok(checked > 0, e.file + ": nothing compared");
    for (const s of sats) assert.ok(satsOfSource.includes(s), e.file + ": unexpected satellite " + s);
  }
});

test("filtering by selected cells and period keeps exactly those rows", { skip }, () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")), e = index.files[0];
  const sel = calc.selectCells(data, [-65, -9.75, -63, -7.75]).map((i) => data.cells[i].id);
  const text = readText(e), month = data.months.find((m) => Number(m.slice(0, 4)) === e.year);
  const out = { header: null, lines: [] };
  const n = calc.filterHotspots(text, new Set(sel), month, month, out);
  assert.strictEqual(n, out.lines.length);
  assert.ok(out.lines.every((l) => sel.includes(l.split(",")[0]) && l.split(",")[3].slice(0, 7) === month));
  const all = { header: null, lines: [] };
  calc.filterHotspots(text, new Set(sel), "0000-00", "9999-99", all);
  assert.ok(all.lines.length >= n);
});

test("the CSV for download carries attribution, period and the column header", () => {
  const csv = calc.hotspotsCsv(meta, "a,b", ["1,2"], "area", "2020-01", "2020-12");
  assert.ok(csv.includes(meta.attribution) && csv.includes("2020-01 to 2020-12") && csv.includes(meta.data_cutoff_date));
  assert.ok(csv.trim().endsWith("a,b\n1,2"));
});
