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

test("the count before the download is given per sensor and never as a harmonized total", () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const sel = new Set(calc.selectCells(data, [-65, -9.75, -63, -7.75]).map((i) => data.cells[i].id));
  const out = { header: null, lines: [] };
  index.files.filter((e) => e.year === 2025).forEach((e) => calc.filterHotspots(readText(e), sel, "2025-01", "2025-12", out));
  const counts = calc.countBySatellite(out.header, out.lines);
  assert.strictEqual(Object.values(counts).reduce((a, b) => a + b, 0), out.lines.length);
  const text = calc.hotspotCountText(counts, out.lines.length, "2025-01", "2025-12");
  assert.ok(text.startsWith(out.lines.length.toLocaleString("en-US") + " rows in the hotspot list"));
  assert.ok(text.includes("Terra (MODIS) " + counts.Terra.toLocaleString("en-US")));
  assert.ok(text.includes("not a harmonized count"));
});

test("DE-21 map points: one point per row of the month, inside the study area, sensor MODIS or VIIRS", { skip }, () => {
  const ym = data.months[data.nMonths - 1], index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const out = { header: null, lines: [] };
  index.files.filter((e) => e.year === Number(ym.slice(0, 4))).forEach((e) => calc.filterHotspots(readText(e), allCells(), ym, ym, out));
  const pts = calc.hotspotPoints(out.header, out.lines), [w, s, e, n] = meta.area.bbox_west_south_east_north;
  assert.ok(pts.length > 0);
  assert.strictEqual(pts.length, out.lines.length);
  assert.deepStrictEqual([...new Set(pts.map((p) => p.sensor))].sort(), ["MODIS", "VIIRS"]);
  assert.ok(pts.every((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n));
});

test("DE-21 map point details use the hotspot file fields (first rows of real 2025 files)", { skip }, () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  for (const source of ["modis", "viirs-jpss1"]) {
    const out = parseAll(index.files.find((e) => e.source === source && e.year === 2025));
    const p = calc.hotspotPoints(out.header, out.lines.slice(0, 1))[0], text = calc.hotspotPointText(p);
    assert.ok(text.startsWith(p.date + " " + p.time.slice(0, 2) + ":" + p.time.slice(2) + " UTC, "), text);
    assert.ok(text.includes("FRP " + p.frp + " MW"), text);
    assert.match(text, source === "modis" ? /\((MODIS)\), confidence \d+ %/ : /\(VIIRS\), confidence (low|nominal|high)/);
  }
});

// DE-25: the KML holds the same rows as the CSV, one placemark each, with the FIRMS acknowledgment and cut-off date.
test("KML of a real hotspot file: one placemark per row, attribution, sensor styles, valid coordinates", { skip }, () => {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const e = index.files.find((f) => f.file === "viirs-jpss1_2025.csv.gz");
  const rows = parseAll(e);
  const kml = calc.hotspotsKml(meta, rows.header, rows.lines, "test area", "2025-01", "2025-12");
  assert.strictEqual((kml.match(/<Placemark>/g) || []).length, rows.lines.length);
  assert.ok(kml.includes(meta.attribution) && kml.includes(meta.data_cutoff_date));
  assert.strictEqual((kml.match(/<styleUrl>#VIIRS<\/styleUrl>/g) || []).length, rows.lines.length);
  const first = rows.lines[0].split(","), h = rows.header.split(",");
  assert.ok(kml.includes("<coordinates>" + Number(first[h.indexOf("longitude")]) + "," + Number(first[h.indexOf("latitude")]) + "</coordinates>"));
  assert.ok(!/[<>]/.test(kml.match(/<description>([\s\S]*?)<\/description>/)[1]), "description is escaped");
});

// DE-24: the app keeps the same detections per municipality as the pipeline (municipalities.csv raw columns).
test("municipalityIndex agrees with municipalities.csv: 2025 counts per municipality, month and satellite", { skip }, () => {
  const munis = calc.parseMunicipalities(JSON.parse(fs.readFileSync(path.join(root, "docs/data/municipalities.geojson"), "utf8")));
  const md = calc.parseCellsCsv(fs.readFileSync(path.join(root, "docs/data/municipalities.csv"), "utf8"), 0.25, "area_id");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const counts = new Map();
  for (const e of index.files.filter((f) => f.year === 2025)) {
    const rows = parseAll(e), h = rows.header.split(",");
    const [ilat, ilon, idate, isat] = ["latitude", "longitude", "acq_date", "sat"].map((c) => h.indexOf(c));
    for (const l of rows.lines) {
      const f = l.split(","), k = munis[calc.municipalityIndex(Number(f[ilon]), Number(f[ilat]), munis)].code + " " + f[idate].slice(0, 7) + " " + f[isat];
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  let compared = 0;
  md.cells.forEach((c, i) => md.months.forEach((ym, m) => {
    if (!ym.startsWith("2025")) return;
    for (const [sat, colName] of Object.entries(SAT_COLUMN)) {
      const v = md.columns[colName][i * md.nMonths + m];
      if (Number.isNaN(v)) continue; // satellite-month not covered or flagged
      assert.strictEqual(counts.get(c.id + " " + ym + " " + sat) || 0, v, c.id + " " + ym + " " + sat);
      compared++;
    }
  }));
  assert.ok(compared > 52 * 12 * 3, "compared " + compared);
});

// RA-11 (local Brazil pilot): municipalityIndex with multipolygons and holes agrees with the pipeline's assignment.
// Sergipe has both (one municipality in two parts, one with a hole). Skipped without the git-ignored pilot packs.
const sePack = path.join(root, "data/pilot/brazil/SE");
test("municipalityIndex (parts and holes) agrees with a Brazil pack: Sergipe 2024 per municipality, month and satellite",
  { skip: fs.existsSync(path.join(sePack, "hotspots/index.json")) ? false : "no Brazil pilot packs (pipeline/pilot_packs.py)" }, () => {
  const geo = JSON.parse(fs.readFileSync(path.join(sePack, "municipalities.geojson"), "utf8"));
  const munis = calc.parseMunicipalities(geo);
  assert.ok(munis.some((m) => m.parts.length > 1) && munis.some((m) => m.parts.some((p) => p.length > 1)), "Sergipe has parts and holes");
  const md = calc.parseCellsCsv(fs.readFileSync(path.join(sePack, "municipalities.csv"), "utf8"), 0.25, "area_id");
  const [head, ...lines] = zlib.gunzipSync(fs.readFileSync(path.join(sePack, "hotspots/hotspots_2024.csv.gz"))).toString("utf8")
    .trim().split("\n").filter((l) => !l.startsWith("#"));
  const h = head.split(","), [ilat, ilon, idate, isat] = ["latitude", "longitude", "acq_date", "sat"].map((c) => h.indexOf(c));
  const counts = new Map();
  for (const l of lines) {
    const f = l.split(","), k = munis[calc.municipalityIndex(Number(f[ilon]), Number(f[ilat]), munis)].code + " " + f[idate].slice(0, 7) + " " + f[isat];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let compared = 0;
  md.cells.forEach((c, i) => md.months.forEach((ym, m) => {
    if (!ym.startsWith("2024")) return;
    for (const [sat, colName] of Object.entries(SAT_COLUMN)) {
      const v = md.columns[colName][i * md.nMonths + m];
      if (Number.isNaN(v)) continue;
      assert.strictEqual(counts.get(c.id + " " + ym + " " + sat) || 0, v, c.id + " " + ym + " " + sat);
      compared++;
    }
  }));
  assert.ok(compared > 75 * 12 * 3, "compared " + compared);
});
