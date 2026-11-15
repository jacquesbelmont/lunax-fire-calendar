/*
 * Purpose: entry point; wires controls, map, calendar, comparison and downloads together.
 * SCOPE: R1, R3, R4, R6, R7, R8, R9, R10, O1, O2, O3
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
    state.map.showSelection(state.bbox, cells);
    const info = $("selection-info");
    if (!hasCells) {
      info.textContent = "No grid cell centres inside this rectangle. Adjust the rectangle to select cells.";
      Plotly.purge($("calendar")); Plotly.purge($("compare")); $("compare-text").textContent = "";
      return;
    }
    info.textContent = cells.length + (cells.length === 1 ? " grid cell" : " grid cells") +
      " selected. The rectangle selects whole " + state.meta.grid.cell_size_deg + "° cells by their centres.";
    const unit = "hotspots";
    LunaxCalendar.render($("calendar"), state.rows, unit);
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
      $("bbox-form").addEventListener("submit", function (e) {
        e.preventDefault();
        setBbox(["w", "s", "e", "n"].map((k) => Number($("bbox-" + k).value)));
      });
      $("bbox-reset").addEventListener("click", () => setBbox(meta.area.bbox_west_south_east_north.slice()));
      ["range-from", "range-to", "series-select", "compare-month"].forEach((id) => $(id).addEventListener("change", function () {
        if (Number($("range-from").value) > Number($("range-to").value)) { $("selection-info").textContent = "The start of the period must not be after its end."; return; }
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
