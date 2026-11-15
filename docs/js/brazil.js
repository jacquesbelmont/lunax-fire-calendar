/*
 * Purpose: RA-11 Brazil pilot (issue #66) as a view of the main map: the 27 states colored by the detections of the
 *          focus month (2000-11 to 2025-12; for a month after the pilot, the same month of 2025), a click on a state draws
 *          its 0.25° cells and municipal borders, and a button draws that month's detections as one image.
 *          From 2012-02 the value is the DE-11 reference VIIRS satellite (observed); before, raw Terra MODIS counts,
 *          labelled not harmonized (converting them for Brazil needs biome ratios, a team decision).
 *          The pilot files are local (data/pilot/brazil/, written by pipeline/pilot_brazil.py, git-ignored): the view
 *          appears only when they can be loaded, so the published app is unchanged.
 * SCOPE: none in the hackathon scope (post-submission exploration, RA-11)
 * Owner issue: RA-11
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const BASE = "../data/pilot/brazil/", FIRST = "2000-11", LAST = "2025-12";
  const f = LunaxCalc.fmt, big = (x) => Math.round(x).toLocaleString("en-US");
  const cache = {}, sel = { code: null, name: null, cells: null, munis: null, pts: null };
  let layer = null, statesLayer = null, nat = null;

  async function get(file, parse, gz) {
    if (cache[file]) return cache[file];
    const resp = await fetch(BASE + file);
    if (!resp.ok) throw new Error("Brazil pilot: could not load " + file + " (" + resp.status + ").");
    const text = gz ? await new Response(resp.body.pipeThrough(new DecompressionStream("gzip"))).text() : await resp.text();
    return (cache[file] = parse(text));
  }

  /** True when the pilot files are served next to the app (local evaluation only). */
  async function available() {
    try { return (await fetch(BASE + "states.csv", { method: "HEAD" })).ok; } catch (e) { return false; }
  }

  const value = (data, i, ym, col) => data.columns[col][i * data.nMonths + data.months.indexOf(ym)];
  /** Column and wording of month ym: the DE-11 reference VIIRS from 2012-02, raw Terra MODIS before (not harmonized). */
  const measure = (ym) => (ym >= "2012-02" ? { col: "viirs_eq", what: "VIIRS detections (reference satellite)" } :
    { col: "terra", what: "raw Terra MODIS detections (not harmonized)" });

  /**
   * Show the view for month ym (any month; after the pilot's last month the same month of 2025 is used).
   * noteEl: paragraph under the map; onLegend(legend): sets the map legend.
   */
  async function show(map, ym, noteEl, onLegend) {
    const month = !ym ? "2025-09" : ym > LAST ? "2025" + ym.slice(4) : ym < FIRST ? FIRST : ym, m = measure(month);
    if (!map.getPane("brazil")) map.createPane("brazil").style.zIndex = 460; // above the points canvas (450), which would take the clicks
    if (!layer) layer = L.layerGroup();
    if (!map.hasLayer(layer)) layer.addTo(map);
    const geo = await get("states.geojson", JSON.parse);
    nat = await get("states.csv", (t) => LunaxCalc.parseCellsCsv(t, 0.25, "area_id"));
    const v = new Map(nat.cells.map((c, i) => [c.id, value(nat, i, month, m.col)]));
    const cap = LunaxCalc.colorCap([...v.values()]);
    if (statesLayer) layer.removeLayer(statesLayer);
    statesLayer = L.geoJSON(geo, {
      pane: "brazil",
      style: (ft) => ({ color: "#333", weight: 1, fillOpacity: sel.code ? 0.12 : 0.7, className: "br-state br-" + ft.properties.code,
        fillColor: Number.isNaN(v.get(ft.properties.code)) ? "#9e9e9e" : LunaxCalc.viridisReversed(v.get(ft.properties.code) || 0, cap) }),
      onEachFeature: (ft, lyr) => {
        const x = v.get(ft.properties.code);
        lyr.bindTooltip(ft.properties.name + ", " + month + ": " + (Number.isNaN(x) ? "no data (not zero)" : big(x) + " " + m.what));
        lyr.on("click", () => pick(map, ft.properties.code, ft.properties.name, lyr.getBounds(), month, noteEl, onLegend));
      },
    }).addTo(layer);
    if (!sel.code) {
      map.fitBounds(statesLayer.getBounds());
      onLegend({ title: "Brazil pilot: " + m.what + " per state, " + month, status: "Local pilot, " + FIRST + " to " + LAST +
        " (FIRMS country files of Brazil and Bolivia inside the IBGE states). Click a state.", cap: cap, unit: "detections" });
      noteEl.textContent = "Brazil pilot (RA-11, local), " + FIRST + " to " + LAST + ": VIIRS from 2012-02, raw MODIS before (not harmonized " +
        "for Brazil yet). " + (ym && ym !== month ? "Shown for " + month + ", the closest month the pilot has. " : "") +
        "Click a month in the calendar to change it; click a state to see its 0.25° cells and municipalities.";
    } else {
      await drawState(map, month, noteEl, onLegend);
    }
  }

  async function pick(map, code, name, bounds, month, noteEl, onLegend) {
    Object.assign(sel, { code: code, name: name, pts: null });
    statesLayer.setStyle({ fillOpacity: 0.12 });
    map.fitBounds(bounds);
    await drawState(map, month, noteEl, onLegend);
  }

  /** The selected state's cells of `month`, its municipal borders, the sentence and the points button. */
  async function drawState(map, month, noteEl, onLegend) {
    sel.cells = await get(sel.name + "/monthly_cells.csv", (t) => LunaxCalc.parseCellsCsv(t, 0.25));
    sel.munis = await get(sel.name + "/municipalities.geojson", JSON.parse);
    if (sel.group) layer.removeLayer(sel.group);
    sel.group = L.layerGroup().addTo(layer);
    const m = measure(month), d = sel.cells, half = 0.125, vals = d.cells.map((c, i) => value(d, i, month, m.col)), cap = LunaxCalc.colorCap(vals);
    d.cells.forEach((c, i) => L.rectangle([[c.lat - half, c.lon - half], [c.lat + half, c.lon + half]], { pane: "brazil", stroke: false, fillOpacity: 0.75,
      fillColor: Number.isNaN(vals[i]) ? "#9e9e9e" : LunaxCalc.viridisReversed(vals[i], cap) })
      .bindTooltip(month + ": " + (Number.isNaN(vals[i]) ? "no data (not zero)" : f(vals[i], 0) + " " + m.what + " in this cell")).addTo(sel.group));
    L.geoJSON(sel.munis, { pane: "brazil", style: { color: "#555", weight: 0.5, fill: false }, interactive: false }).addTo(sel.group);
    onLegend({ title: "Brazil pilot: " + sel.name + ", " + m.what + " per cell, " + month, status: "Local pilot; 0.25° cells, " +
      d.cells.length + " cells. Click another state to switch.", cap: cap, unit: "detections" });
    const total = vals.filter((x) => !Number.isNaN(x)).reduce((a, b) => a + b, 0);
    const btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "Load the detections of " + sel.name + " in " + month;
    btn.addEventListener("click", () => points(map, month, noteEl, btn));
    noteEl.replaceChildren(document.createTextNode("Brazil pilot (RA-11, local), " + sel.name + ", " + month + ": " +
      (vals.every(Number.isNaN) ? "no data (missing days, never zero)" : big(total) + " " + m.what) + ". "), btn);
    if (sel.pts && sel.ptsYear === month.slice(0, 4)) drawPoints(month, noteEl); // points already loaded for this year
  }

  async function points(map, month, noteEl, btn) {
    btn.disabled = true; btn.textContent = "Loading...";
    const t0 = performance.now();
    sel.pts = await get(sel.name + "/hotspots_" + month.slice(0, 4) + ".csv.gz", function (t) {
      const o = { header: null, lines: [] };
      LunaxCalc.filterHotspots(t, { has: () => true }, "0000-00", "9999-99", o);
      return o;
    }, true);
    sel.ptsYear = month.slice(0, 4);
    btn.remove();
    drawPoints(month, noteEl, Math.round(performance.now() - t0));
  }

  /** The month's detections of every satellite as one image in Web Mercator rows (fast with hundreds of thousands). */
  function drawPoints(month, noteEl, loadMs) {
    const h = sel.pts.header.split(","), ia = h.indexOf("latitude"), io = h.indexOf("longitude"), is = h.indexOf("sensor");
    const lines = sel.pts.lines.filter((l) => l.split(",", 4)[3].slice(0, 7) === month);
    if (!lines.length) return;
    let w = 180, s = 90, e = -180, n = -90;
    const pts = lines.map((l) => { const x = l.split(","), lo = +x[io], la = +x[ia];
      w = Math.min(w, lo); e = Math.max(e, lo); s = Math.min(s, la); n = Math.max(n, la); return [lo, la, x[is]]; });
    const my = (la) => Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360));
    const W = 1600, H = Math.max(1, Math.round(W * (my(n) - my(s)) / ((e - w) * Math.PI / 180)));
    const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    cv.width = W; cv.height = H;
    pts.forEach((p) => { ctx.fillStyle = p[2] === "MODIS" ? "#0072B2" : "#D55E00";
      ctx.fillRect((p[0] - w) / (e - w) * (W - 2), (my(n) - my(p[1])) / (my(n) - my(s)) * (H - 2), 2, 2); });
    L.imageOverlay(cv.toDataURL(), [[s, w], [n, e]], { pane: "brazil" }).addTo(sel.group);
    noteEl.append(document.createTextNode(" Points of " + month + ": " + LunaxCalc.satelliteCountsText(LunaxCalc.countBySatellite(sel.pts.header, lines)) +
      " (MODIS blue, VIIRS orange; each sensor's own detections, never added together)" + (loadMs ? "; loaded and read in " + loadMs + " ms" : "") + "."));
  }

  function hide(map) {
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
  }

  window.LunaxBrazil = { available: available, show: show, hide: hide };
})();
