/*
 * DE-36 sensitivity (reported, not used to change the rule): number of fire events at 0.5, 1 and 2 km (1 day) for one
 * month of Rondonia, with the app's own function (docs/js/calc.js fireEvents). Writes method/results/fire_events_sensitivity.json.
 * Run: node method/fire_events_sensitivity.js [YYYY-MM]   (default 2024-09)
 * Owner issue: RA-12. AI-assisted code (Claude Code); logged in AI_USE.md.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const calc = require("../docs/js/calc.js");

const root = path.resolve(__dirname, ".."), ym = process.argv[2] || "2024-09", year = ym.slice(0, 4);
const index = JSON.parse(fs.readFileSync(path.join(root, "docs/data/hotspots/index.json"), "utf8"));
const lines = [];
let header = null;
for (const f of index.files.filter((x) => String(x.year) === year && x.source.startsWith("viirs"))) {
  zlib.gunzipSync(fs.readFileSync(path.join(root, "docs/data/hotspots", f.file))).toString("utf8").split("\n").forEach((l) => {
    if (!l || l.startsWith("#")) return;
    if (l.startsWith("cell_id")) { header = header || l; return; }
    if (l.split(",")[3].startsWith(ym)) lines.push(l);
  });
}
const pts = calc.hotspotPoints(header, lines);
const out = { decision: "method/DECISIONS.md DE-36 (PROPOSED)", area: "Rondonia (docs/data/hotspots)", month: ym, days: 1,
  viirs_detections: pts.length, by_distance_km: {} };
for (const km of [0.5, 1, 2]) {
  const ev = calc.fireEvents(pts, km, 1);
  out.by_distance_km[km] = { events: ev.length, single_detection_events: ev.filter((e) => e.n === 1).length, largest_event_detections: ev.length ? ev[0].n : 0 };
}
fs.writeFileSync(path.join(root, "method/results/fire_events_sensitivity.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out));
