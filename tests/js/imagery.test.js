// JA-11 (DE-27): which NASA GIBS image the map shows for a day, and the default day of the map month.
// Run: node --test tests/js/imagery.test.js
// AI-assisted code (Claude Code); logged in AI_USE.md.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const imagery = require("../../docs/js/imagery.js");
const calc = require("../../docs/js/calc.js");

test("satellite of the image follows the GIBS start dates and the DE-11 switch to NOAA-20", () => {
  assert.strictEqual(imagery.imagerySatellite("2005-09-15").name, "Terra MODIS");
  assert.strictEqual(imagery.imagerySatellite("2015-11-23").name, "Terra MODIS");
  assert.strictEqual(imagery.imagerySatellite("2015-11-24").name, "Suomi NPP VIIRS");
  assert.strictEqual(imagery.imagerySatellite("2018-03-31").name, "Suomi NPP VIIRS");
  assert.strictEqual(imagery.imagerySatellite("2018-04-01").name, "NOAA-20 VIIRS");
  assert.strictEqual(imagery.imagerySatellite("2026-10-31").name, "NOAA-20 VIIRS");
});

test("tile URLs use the layers checked on GIBS (true color and burn-scar false color)", () => {
  const t = imagery.imageryLayer("2005-09-15", "trueColor"), f = imagery.imageryLayer("2005-09-15", "falseColor");
  assert.strictEqual(t.url, "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2005-09-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg");
  assert.strictEqual(f.url, "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_Bands721/default/2005-09-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg");
  assert.match(imagery.imageryLayer("2016-08-20", "falseColor").url, /VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1\/default\/2016-08-20\//);
  assert.match(imagery.imageryLayer("2024-09-10", "trueColor").url, /VIIRS_NOAA20_CorrectedReflectance_TrueColor\/default\/2024-09-10\//);
  assert.throws(() => imagery.imageryLayer("2024-09-10", "other"));
  assert.throws(() => imagery.imageryLayer("2024-9-10", "trueColor"));
});

test("first and last day of a month", () => {
  assert.deepStrictEqual(imagery.monthDays("2024-02"), ["2024-02-01", "2024-02-29"]);
  assert.deepStrictEqual(imagery.monthDays("2026-10"), ["2026-10-01", "2026-10-31"]);
});

test("default day: the day of the month with the most detections (earlier day on a tie), else the 15th", () => {
  const p = (date) => ({ date: date });
  assert.strictEqual(imagery.defaultDay("2025-09", [p("2025-09-03"), p("2025-09-07"), p("2025-09-07"), p("2025-09-03")]), "2025-09-03");
  assert.strictEqual(imagery.defaultDay("2025-09", [p("2025-09-03"), p("2025-09-07"), p("2025-09-07")]), "2025-09-07");
  assert.strictEqual(imagery.defaultDay("2025-09", []), "2025-09-15");
  assert.strictEqual(imagery.defaultDay("2025-09", [p("2025-08-31")]), "2025-09-15"); // only days of the map month count
});

test("default day on real detections of September 2025 is a day of that month", () => {
  const root = path.resolve(__dirname, "../..");
  const idx = JSON.parse(fs.readFileSync(path.join(root, "docs/data/hotspots/index.json"), "utf8"));
  const f = idx.files.find((x) => x.year === 2025 && x.source !== "modis");
  assert.ok(f, "a VIIRS 2025 hotspot file is listed in index.json");
  const text = zlib.gunzipSync(fs.readFileSync(path.join(root, "docs/data/hotspots", f.file))).toString("utf8").trim().split("\n").filter((l) => !l.startsWith("#"));
  const pts = calc.hotspotPoints(text[0], text.slice(1)).filter((x) => x.date.slice(0, 7) === "2025-09");
  assert.ok(pts.length > 0);
  const day = imagery.defaultDay("2025-09", pts), n = pts.filter((x) => x.date === day).length;
  assert.match(day, /^2025-09-\d\d$/);
  assert.ok(pts.every((x) => pts.filter((y) => y.date === x.date).length <= n));
});
