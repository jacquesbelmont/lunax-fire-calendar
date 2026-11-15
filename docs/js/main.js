/*
 * Purpose: entry point; wires controls, map, calendar, comparison and downloads together.
 * SCOPE: R1, R3, R4, R5, R6, R7, R8, R9, R10, O1, O2, O3
 * Owner issue: JA-5, JA-6, JA-7
 * AI-assisted code (Claude Code and Codex); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SERIES = [
    ["viirs_eq", "Harmonized (VIIRS-equivalent), all years"],
    ["terra", "Terra only (MODIS, raw counts)"], ["aqua", "Aqua only (MODIS, raw counts)"],
    ["snpp", "Suomi NPP only (VIIRS, raw counts)"], ["noaa20", "NOAA-20 only (VIIRS, raw counts)"],
    ["noaa21", "NOAA-21 only (VIIRS, raw counts)"],
  ];
  const state = {};
  const SELECTION_BUTTONS = ["png-calendar", "png-compare", "csv-series", "csv-cells", "hotspots-count"];

  function addOptions(select, items) {
    items.forEach(function (it) {
      const o = document.createElement("option");
      o.value = it[0]; o.textContent = it[1];
      select.appendChild(o);
    });
  }

  function buildRows() {
    const { data } = state, column = $("series-select").value;
    const sel = state.sel, harmonized = column === "viirs_eq";
    const value = LunaxCalc.areaSeries(data, sel, column);
    const variance = harmonized ? LunaxCalc.areaSeries(data, sel, "viirs_eq_var") : null;
    const est = harmonized ? LunaxCalc.estimatedMonths(data, sel) : null;
    const stats = LunaxCalc.medianAnomaly(data.months, value);
    const from = Number($("range-from").value), to = Number($("range-to").value);
    return data.months.map(function (ym, i) {
      const hw = variance ? LunaxCalc.halfWidth90(variance[i]) : NaN;
      return { ym: ym, value: value[i], lo: value[i] - hw, hi: value[i] + hw, estimated: est ? est[i] : false,
        provisional: data.provisional.has(ym),
        inRange: i >= from && i <= to, median: stats[i].median, nYears: stats[i].nYears, diff: stats[i].diff, ratio: stats[i].ratio };
    });
  }

  /** DE-21: month index of the map: the month clicked in the calendar, else the month shown in the comparison; -1 if none. */
  function mapMonthIndex() {
    if (!state.rows) return -1;
    return state.mapMonth !== null ? state.mapMonth : LunaxCalc.comparedMonthIndex(state.rows, Number($("compare-month").value));
  }

  /** Map colors: per-cell values of month index m (same column and per-cell numbers as the calendar). */
  function mapPaint(m) {
    if (m < 0) return null;
    const column = $("series-select").value, row = state.rows[m];
    const values = LunaxCalc.cellMonthValues(state.data, state.sel, column, m).map((c) => c.value);
    const cap = LunaxCalc.colorCap(values);
    const status = row.estimated ? "Estimated from MODIS" : row.provisional ? "Provisional (near real-time data)" :
      column === "viirs_eq" ? "Observed (VIIRS)" : "Raw counts of one sensor";
    return { values: values, cap: cap, ym: row.ym, legend: { title: "Hotspots per cell, " + row.ym, status: status, cap: cap, unit: "hotspots" } };
  }

  /** DE-21: both map layers for the same month. */
  function refreshMap() {
    const m = mapMonthIndex();
    state.map.showSelection(state.bbox, state.sel.map((i) => state.data.cells[i]), mapPaint(m));
    showMonthPoints(m >= 0 ? state.data.months[m] : null);
  }

  /** DE-21: detections of month ym in the selected cells, as points grouped per sensor; never added into one count. */
  async function showMonthPoints(ym) {
    const req = ++state.pointsReq, note = $("map-note");
    state.map.showPoints([]);
    if (!ym || !state.sel.length) { note.textContent = ""; return; }
    note.textContent = "Loading the detections of " + ym + "...";
    try {
      state.hotspotIndex = state.hotspotIndex || await LunaxHotspots.loadIndex();
      const res = await LunaxHotspots.load(state.hotspotIndex, state.sel.map((i) => state.data.cells[i].id), ym, ym, () => {});
      if (req !== state.pointsReq) return; // a newer selection or month replaced this request
      const pts = res.lines.length ? LunaxCalc.hotspotPoints(res.header, res.lines) : [];
      state.map.showPoints(pts);
      const source = $("series-select").value === "viirs_eq" ? "The harmonized calendar value of this month " + LunaxCalc.harmonizedSource(ym) +
        " (DE-11)." : "The calendar shows the raw counts of the series chosen above.";
      note.textContent = "Points: detections of " + ym + (state.data.provisional.has(ym) ? " (provisional: near real-time data)" : "") +
        " in the selected cells, per satellite: " + (pts.length ? LunaxCalc.satelliteCountsText(LunaxCalc.countBySatellite(res.header, res.lines)) : "none") +
        ". " + source + " One fire can be detected by several satellites, so the points are not a count of fires. " +
        "Hover a cell for its value, click a point for its details, or click a month in the calendar to show it on the map.";
    } catch (err) {
      if (req === state.pointsReq) note.textContent = String(err.message || err);
    }
  }

  function areaLabel() {
    const b = state.bbox.map((v) => LunaxCalc.fmt(v, 4));
    return state.meta.area.name + "; rectangle west " + b[0] + ", south " + b[1] + ", east " + b[2] + ", north " + b[3];
  }

  function resetHotspots() {
    state.hotspots = null;
    $("hotspots-download").disabled = true;
    $("hotspots-status").textContent = "The hotspot list holds the individual FIRMS detections in the selected cells and period. Count them first to see how many rows the file will have.";
  }

  async function countHotspots() {
    const rows = state.rows;
    if (!rows) return;
    const isCurrent = () => state.rows === rows;
    const cellIds = state.sel.map((i) => state.data.cells[i].id);
    const status = $("hotspots-status"), btn = $("hotspots-count");
    const from = state.data.months[Number($("range-from").value)], to = state.data.months[Number($("range-to").value)];
    btn.disabled = true; $("hotspots-download").disabled = true;
    try {
      state.hotspotIndex = state.hotspotIndex || await LunaxHotspots.loadIndex();
      if (!isCurrent()) return;
      const res = await LunaxHotspots.load(state.hotspotIndex, cellIds, from, to, (d, t) => {
        if (isCurrent()) status.textContent = "Reading files " + d + " of " + t + "...";
      });
      if (!isCurrent()) return;
      state.hotspots = { res: res, from: from, to: to };
      status.textContent = (res.lines.length ? LunaxCalc.hotspotCountText(LunaxCalc.countBySatellite(res.header, res.lines), res.lines.length, from, to)
        : "No hotspot rows in the selected cells, " + from + " to " + to + ".") +
        " (" + res.files + " yearly files, " + (res.bytes / 1e6).toFixed(1) + " MB read)." + (res.lines.length ? " Press Download to save them." : "");
      $("hotspots-download").disabled = res.lines.length === 0;
    } catch (err) {
      if (isCurrent()) status.textContent = String(err.message || err);
    } finally {
      if (isCurrent()) btn.disabled = false;
    }
  }

  function update() {
    resetHotspots();
    state.sel = LunaxCalc.selectCells(state.data, state.bbox);
    const cells = state.sel.map((i) => state.data.cells[i]);
    const hasCells = cells.length > 0;
    state.rows = hasCells ? buildRows() : null;
    SELECTION_BUTTONS.forEach((id) => { $(id).disabled = !hasCells; });
    refreshMap();
    const info = $("selection-info");
    if (!hasCells) {
      info.textContent = "No grid cell centres inside this rectangle. Adjust the rectangle to select cells.";
      Plotly.purge($("calendar")); Plotly.purge($("compare")); $("compare-text").textContent = "";
      return;
    }
    info.textContent = cells.length + (cells.length === 1 ? " grid cell" : " grid cells") +
      " selected. The rectangle selects whole " + state.meta.grid.cell_size_deg + "° cells by their centres.";
    const unit = "hotspots";
    LunaxCalendar.render($("calendar"), state.rows, unit, function (ym) {
      const m = state.data.months.indexOf(ym);
      if (m >= 0 && state.rows[m].inRange) { state.mapMonth = m; refreshMap(); } // months outside the period are ignored
    });
    LunaxCompare.render($("compare"), $("compare-text"), state.rows, Number($("compare-month").value), unit);
  }

  function setBbox(box) {
    if (!(box[0] < box[2] && box[1] < box[3])) { $("selection-info").textContent = "West must be less than east and south less than north."; return; }
    state.bbox = box;
    ["w", "s", "e", "n"].forEach((k, i) => { $("bbox-" + k).value = LunaxCalc.fmt(box[i], 4); });
    update();
  }

  function renderStatic(meta) {
    $("subtitle").textContent = "Monthly NASA FIRMS hotspot detections from harmonized MODIS and VIIRS records for " + meta.area.name.split(" (")[0] + ".";
    const archived = "Archived data through " + meta.data_cutoff_date + ". " + meta.archived;
    $("archive-label").textContent = archived;
    $("archive-footer").textContent = archived;
    $("attribution").textContent = meta.attribution;
    $("disclaimer-link").href = meta.disclaimer_url;
    const how = $("how-text");
    [["Target scale", meta.method.target_scale], ["Observed months", meta.method.native_months],
     ["Estimated months", meta.method.estimated_months], ["Uncertainty", meta.method.uncertainty],
     ["Missing data", "An empty value means no data. It is never zero fire and is drawn in grey."],
     ["Provisional months", "Months with FIRMS near real-time (NRT) data, after the last standard-processing date. FIRMS replaces them later with standard data, so their values can still change (DE-4)."]].forEach(function (p) {
      const para = document.createElement("p");
      const b = document.createElement("strong");
      b.textContent = p[0] + ": ";
      para.append(b, document.createTextNode(p[1]));
      how.appendChild(para);
    });
  }

  async function init() {
    try {
      const { meta, boundary, data } = await LunaxData.loadAll();
      Object.assign(state, { meta: meta, data: data });
      renderStatic(meta);
      addOptions($("series-select"), SERIES);
      const monthOpts = data.months.map((m, i) => [String(i), m]);
      addOptions($("range-from"), monthOpts); addOptions($("range-to"), monthOpts);
      $("range-from").value = "0"; $("range-to").value = String(data.months.length - 1);
      addOptions($("compare-month"), ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((n, i) => [String(i + 1), n]));
      $("compare-month").value = String(Number(data.months[data.months.length - 1].slice(5, 7)));
      state.map = LunaxMap.create("map", boundary, meta.area.bbox_west_south_east_north, meta.grid.cell_size_deg, setBbox);
      state.mapMonth = null; // DE-21: null = the map follows the comparison month; a calendar click sets a month index
      state.pointsReq = 0;
      $("bbox-form").addEventListener("submit", function (e) {
        e.preventDefault();
        setBbox(["w", "s", "e", "n"].map((k) => Number($("bbox-" + k).value)));
      });
      $("bbox-reset").addEventListener("click", () => setBbox(meta.area.bbox_west_south_east_north.slice()));
      ["range-from", "range-to", "series-select", "compare-month"].forEach((id) => $(id).addEventListener("change", function () {
        if (Number($("range-from").value) > Number($("range-to").value)) { $("selection-info").textContent = "The start of the period must not be after its end."; return; }
        state.mapMonth = null; // a control change returns the map to the comparison month
        $("series-note").textContent = $("series-select").value === "viirs_eq" ? "" :
          "Raw counts of one sensor, as detected. MODIS (1 km) and VIIRS (375 m) counts are not comparable and are never added together.";
        update();
      }));
      $("png-calendar").addEventListener("click", () => LunaxExport.png($("calendar"), "lunax_calendar"));
      $("png-compare").addEventListener("click", () => LunaxExport.png($("compare"), "lunax_month_vs_median"));
      $("hotspots-count").addEventListener("click", countHotspots);
      $("hotspots-download").addEventListener("click", function () {
        const h = state.hotspots;
        if (h) LunaxExport.hotspotsFile(meta, h.res.header, h.res.lines, areaLabel(), h.from, h.to);
      });
      $("csv-series").addEventListener("click", () => state.rows && LunaxExport.seriesFile(meta, state.rows, areaLabel()));
      $("csv-cells").addEventListener("click", () => state.rows && LunaxExport.cellsFile(meta, data, state.sel,
        Number($("range-from").value), Number($("range-to").value), areaLabel()));
      setBbox(meta.area.bbox_west_south_east_north.slice());
    } catch (err) {
      $("subtitle").textContent = "The data could not be loaded.";
      $("archive-label").textContent = String(err.message || err);
    }
  }
  init();
})();
