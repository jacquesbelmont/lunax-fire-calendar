/*
 * Purpose: entry point; wires controls, map, calendar, comparison and downloads together.
 * SCOPE: R1, R3, R4, R5, R6, R7, R8, R9, R10, O1, O2, O3, O4
 * Owner issue: JA-5, JA-6, JA-7, RA-7 (DE-22 map view, DE-23 fire season, DE-25 print, KML and FIRMS link), RA-8 (DE-26), RA-9 (DE-27 outlook)
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
    // DE-24: a municipality uses its own series (detections inside its boundary); a rectangle sums its cells.
    const data = state.muni ? state.muniData : state.data, column = $("series-select").value;
    const sel = state.muni ? [state.muni.i] : state.sel, harmonized = column === "viirs_eq";
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

  /**
   * Map colors and hover texts per selected cell for month index m (same column and per-cell numbers as the calendar):
   * DE-21 hotspots view, or DE-22 "Compared with the usual" classes.
   */
  function mapPaint(m) {
    if (m < 0) return null;
    const column = $("series-select").value, row = state.rows[m], f = LunaxCalc.fmt;
    const values = LunaxCalc.cellMonthValues(state.data, state.sel, column, m).map((c) => c.value);
    const status = row.estimated ? "Estimated from MODIS" : row.provisional ? "Provisional (near real-time data)" :
      column === "viirs_eq" ? "Observed (VIIRS)" : "Raw counts of one sensor";
    const noData = row.ym + ": no data (not zero)";
    if ($("map-mode").value === "usual") {
      const classes = new Map(LunaxCalc.USUAL_CLASSES.map((c) => [c[0], c]));
      const usual = state.sel.map((i) => LunaxCalc.cellUsual(state.data, i, column, m));
      const keys = values.map((v, j) => LunaxCalc.usualClass(v, usual[j]));
      return { colors: keys.map((k) => classes.get(k)[1]),
        tips: values.map((v, j) => Number.isNaN(v) ? noData : row.ym + ": " + f(v, 0) + " hotspots; usual " +
          (Number.isNaN(usual[j]) ? "unknown (no earlier year)" : f(usual[j], 0) + " (median of the same month in earlier years)") +
          ": " + classes.get(keys[j])[2].toLowerCase()),
        legend: { title: "Compared with the usual, " + row.ym, status: status, classes: LunaxCalc.USUAL_CLASSES } };
    }
    const cap = LunaxCalc.colorCap(values);
    return { colors: values.map((v) => (Number.isNaN(v) ? "#9e9e9e" : LunaxCalc.viridisReversed(v, cap))),
      tips: values.map((v) => (Number.isNaN(v) ? noData : row.ym + ": " + f(v, 0) + " hotspots in this cell (" + status + ")")),
      legend: { title: "Hotspots per cell, " + row.ym, status: status, cap: cap, unit: "hotspots" } };
  }

  // DE-26 and DE-28: statewide cell layers drawn as one image; the other views color the selected cells.
  const LAYER_VIEWS = ["recurrence", "outlook001", "outlook005"];

  function paintCells() {
    const mode = $("map-mode").value, layer = LAYER_VIEWS.includes(mode);
    state.map.showSelection(state.muni ? null : state.bbox, layer ? [] : state.sel.map((i) => state.data.cells[i]),
      layer ? { colors: [], tips: [], legend: layerSpec(mode).legend } : mapPaint(mapMonthIndex()));
    $("recurrence-note").textContent = "";
    if (layer) showCellLayer(mode); else state.map.clearOverlay();
  }

  /** What each statewide layer reads and how it is drawn, hovered, explained (texts from metadata.json). */
  function layerSpec(mode) {
    const pct = (x) => (100 * x).toFixed(1) + "%";
    if (mode === "recurrence") {
      const r = state.meta.recurrence, n = r.years.length, h = r.hindcast;
      return { file: r.file, grid: r.grid_deg,
        color: (f) => (LunaxCalc.recurrenceClass(Number(f[1])) || [])[1],
        tip: (f) => "Detections in " + f[1] + " of " + n + " years (" + Number(f[2]).toLocaleString("en-US") + " VIIRS detections)",
        legend: { title: "Places that burn year after year", classes: LunaxCalc.RECURRENCE_CLASSES,
          status: "Years with a VIIRS detection, of " + n + " (" + r.years[0] + "-" + r.years[n - 1] +
            ", without 2023); 0.01° cells (about 1.1 km). Not drawn: no detection, which is not proof of no fire." },
        note: "This map describes the past; it is not a forecast. Test (method/DECISIONS.md DE-26): the cells that burned in at least 6 of the years " +
          h.train_years[0] + "-" + h.train_years[h.train_years.length - 1] + " (" + pct(h.area_share) + " of the cells with any detection) held " +
          pct(h.pooled.recurrence) + " of the detections of " + h.test_years_pooled.join(", ") + ", little more than any cells of the same number would. " +
          "The same number of cells that burned most in " + h.train_years[h.train_years.length - 1] + " held " + pct(h.pooled.persistence) +
          ": for the next season, the previous year's fires were the better guide (see the views \"Where to expect fire\")." };
    }
    const co = state.meta.cell_outlook, key = mode.slice(-3), s = co.scales[key], km = key === "001" ? "about 1 km" : "about 5 km";
    const test = "In a test fixed in advance (method/DECISIONS.md DE-28; each of " + s.test_years.join(", ") + " forecast from earlier years only), ";
    if (s.shown === "P") {
      return { file: "cell_outlook_" + key + ".csv", grid: s.grid_deg,
        color: (f) => (f[2] === "1" ? "#980043" : "#d7b5d8"),
        tip: (f) => f[1] + " VIIRS detections in January-October " + co.feature_year + (f[2] === "1" ? " (top 10% of cells)" : ""),
        legend: { title: "Where to expect fire in " + co.next_year + " (" + km + ")", classes: [["top", "#980043", "Top 10% of cells by " + co.feature_year + " detections"],
          ["other", "#d7b5d8", "Other cells with a detection in " + co.feature_year]],
          status: "Last year's fire, the best guide at this scale in the test. " + co.feature_year + " is provisional (near real-time data from August)." },
        note: test + "at " + km + " the statistical and machine-learning models did not beat last year's fire (" + pct(s.pooled.capture[s.best_model]) +
          " against " + pct(s.pooled.capture.P) + " of the detections in the top 10% of cells), so this map shows last year's fire: the top 10% of cells by " +
          "detections held " + pct(s.pooled.capture.P) + " of the next year's detections in the test years and " + pct(s.fresh.capture.P) + " in " + s.fresh_year + "." };
    }
    const cal = (s.calibration || []).find((b) => b.p_from === 0.4 && b.cells > 0);
    return { file: "cell_outlook_" + key + ".csv", grid: s.grid_deg,
      color: (f) => (LunaxCalc.outlookClass(Number(f[1])) || [])[1],
      tip: (f) => "Chance of at least one VIIRS detection in January-October " + co.next_year + ": " + Math.round(100 * Number(f[1])) + "%",
      legend: { title: "Where to expect fire in " + co.next_year + " (experimental, " + km + ")", classes: LunaxCalc.OUTLOOK_CLASSES,
        status: "Chance of at least one VIIRS detection in January-October. From " + co.feature_year + " and earlier years (" +
          co.feature_year + " is provisional). Not drawn: under 10% (hover a cell for its chance)." },
      note: "This is a forecast, not a certainty. " + test + "the 10% of cells with the highest chance held " + pct(s.pooled.capture[s.shown]) +
        " of the detections, against " + pct(s.pooled.capture.P) + " for the cells that burned most the year before; in " + s.fresh_year + ", " +
        pct(s.fresh.capture[s.shown]) + " against " + pct(s.fresh.capture.P) + ". Model: " + (s.shown === "L" ? "logistic regression (statistics); " +
        "gradient boosting (machine learning) was not clearly better" : "gradient boosting (machine learning)") + "." +
        (cal ? " The chances run a little high: cells given about " + Math.round(100 * cal.mean_p) + "% burned in " + Math.round(100 * cal.observed) + "% of cases." : "") };
  }

  /** Load a statewide layer once, draw it on a canvas in the map's projection, show it with hover texts and its note. */
  async function showCellLayer(mode) {
    const spec = layerSpec(mode), box = state.meta.area.bbox_west_south_east_north;
    try {
      state.layers = state.layers || {};
      if (!state.layers[mode]) {
        const resp = await fetch("data/" + spec.file);
        if (!resp.ok) throw new Error("Could not load data/" + spec.file + " (" + resp.status + ").");
        const rows = (await resp.text()).trim().split("\n").slice(1).map((l) => l.split(","));
        const W = 1450, H = LunaxCalc.mercatorHeight(box, W); // 2 px per 0.01° cell, 10 px per 0.05° cell
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        canvas.width = W; canvas.height = H;
        rows.forEach(function (f) {
          const color = spec.color(f);
          if (!color) return;
          ctx.fillStyle = color;
          ctx.fillRect.apply(ctx, LunaxCalc.gridCellRect(f[0], spec.grid, box, W, H));
        });
        state.layers[mode] = { url: canvas.toDataURL(), byId: new Map(rows.map((f) => [f[0], f])) };
      }
      if ($("map-mode").value !== mode) return; // the view changed while loading
      const L_ = state.layers[mode], g = spec.grid;
      state.map.showOverlay(L_.url, [[box[1], box[0]], [box[3], box[2]]], function (ll) {
        const f = L_.byId.get(Math.floor((ll.lat + 90) / g) + "_" + Math.floor((ll.lng + 180) / g));
        return f ? spec.tip(f) : null;
      });
      $("recurrence-note").textContent = spec.note;
    } catch (err) {
      $("recurrence-note").textContent = String(err.message || err);
    }
  }

  /** DE-21: both map layers for the same month (and the municipal ranking of that month, DE-24). */
  function refreshMap() {
    const m = mapMonthIndex();
    paintCells();
    renderRanking(m);
    showMonthPoints(m >= 0 ? state.data.months[m] : null);
  }

  /** DE-24: municipalities of month index m, most hotspots first, with their usual value and DE-22 class. */
  function renderRanking(m) {
    const table = $("ranking"), d = state.muniData, column = $("series-select").value, f = LunaxCalc.fmt;
    table.replaceChildren();
    if (m < 0) { $("ranking-caption").textContent = ""; return; }
    const classes = new Map(LunaxCalc.USUAL_CLASSES.map((c) => [c[0], c]));
    const rows = d.cells.map(function (c, i) {
      const v = d.columns[column][i * d.nMonths + m], u = LunaxCalc.cellUsual(d, i, column, m);
      return { code: c.id, name: state.munis.find((x) => x.code === c.id).name, v: v, u: u, cls: classes.get(LunaxCalc.usualClass(v, u)) };
    }).sort((a, b) => (Number.isNaN(b.v) ? -1 : b.v) - (Number.isNaN(a.v) ? -1 : a.v));
    $("ranking-caption").textContent = "Municipalities in " + d.months[m] + " (" + $("series-select").selectedOptions[0].textContent +
      "), most hotspots first. Usual = median of the same month in earlier years. Click a name to select the municipality.";
    const head = document.createElement("tr");
    ["Municipality", "Hotspots", "Usual", "Compared with the usual"].forEach(function (h) {
      const th = document.createElement("th"); th.textContent = h; head.appendChild(th);
    });
    table.appendChild(head);
    rows.forEach(function (r) {
      const tr = document.createElement("tr"), name = document.createElement("td"), b = document.createElement("button");
      b.type = "button"; b.className = "linkish"; b.textContent = r.name;
      b.addEventListener("click", () => selectMunicipality(r.code));
      name.appendChild(b);
      const cls = document.createElement("td"), sw = document.createElement("span");
      sw.className = "map-legend-swatch"; sw.style.background = r.cls[1];
      cls.append(sw, document.createTextNode(" " + r.cls[2]));
      const num = (x, none) => { const td = document.createElement("td"); td.className = "num"; td.textContent = Number.isNaN(x) ? none : f(x, 0); return td; };
      tr.append(name, num(r.v, "no data"), num(r.u, "none earlier"), cls);
      if (state.muni && state.muni.code === r.code) tr.className = "selected";
      table.appendChild(tr);
    });
  }

  /** DE-24: hotspot rows inside the selected municipality (same rule as the pipeline); all rows in rectangle mode. */
  function keepSelected(res) {
    if (!state.muni || !res.header) return res;
    const h = res.header.split(","), ilat = h.indexOf("latitude"), ilon = h.indexOf("longitude"), n = Math.max(ilat, ilon) + 1;
    res.lines = res.lines.filter(function (l) {
      const x = l.split(",", n);
      return LunaxCalc.municipalityIndex(Number(x[ilon]), Number(x[ilat]), state.munis) === state.muni.k;
    });
    return res;
  }

  /** DE-24: select municipality `code` (IBGE), or go back to the rectangle with "". */
  function selectMunicipality(code) {
    if (!code) { setBbox(state.meta.area.bbox_west_south_east_north.slice()); return; }
    const k = state.munis.findIndex((x) => x.code === code), b = state.munis[k].bbox, h = state.meta.grid.cell_size_deg / 2;
    state.muni = { k: k, i: state.muniData.cells.findIndex((c) => c.id === code), code: code, name: state.munis[k].name };
    $("muni-select").value = code;
    state.bbox = [b[0] - h, b[1] - h, b[2] + h, b[3] + h]; // the cells around the municipality, for the map context
    state.mapMonth = null;
    state.map.highlightMunicipality(k);
    update();
  }

  /** DE-25: link to the NASA FIRMS Fire Map (near real-time) centred on the selection; a link only, no API call. */
  function firmsLink(box) {
    const span = Math.max(box[2] - box[0], box[3] - box[1], 0.01);
    const zoom = Math.min(12, Math.max(4, Math.round(Math.log2(360 / span))));
    return "https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@" + ((box[0] + box[2]) / 2).toFixed(3) + "," +
      ((box[1] + box[3]) / 2).toFixed(3) + "," + zoom + ".0z";
  }

  /** DE-21: detections of month ym in the selected cells, as points grouped per sensor; never added into one count. */
  async function showMonthPoints(ym) {
    const req = ++state.pointsReq, note = $("map-note");
    state.map.showPoints([]);
    if (!ym || !state.sel.length) { note.textContent = ""; return; }
    note.textContent = "Loading the detections of " + ym + "...";
    try {
      state.hotspotIndex = state.hotspotIndex || await LunaxHotspots.loadIndex();
      const res = keepSelected(await LunaxHotspots.load(state.hotspotIndex, state.sel.map((i) => state.data.cells[i].id), ym, ym, () => {}));
      if (req !== state.pointsReq) return; // a newer selection or month replaced this request
      const pts = res.lines.length ? LunaxCalc.hotspotPoints(res.header, res.lines) : [];
      state.map.showPoints(pts);
      const source = $("series-select").value === "viirs_eq" ? "The harmonized calendar value of this month " + LunaxCalc.harmonizedSource(ym) +
        " (DE-11)." : "The calendar shows the raw counts of the series chosen above.";
      note.textContent = "Points: detections of " + ym + (state.data.provisional.has(ym) ? " (provisional: near real-time data)" : "") +
        (state.muni ? " in " + state.muni.name : " in the selected cells") + ", per satellite: " + (pts.length ? LunaxCalc.satelliteCountsText(LunaxCalc.countBySatellite(res.header, res.lines)) : "none") +
        ". " + source + " One fire can be detected by several satellites, so the points are not a count of fires. " +
        "Hover a cell for its value, click a point for its details, or click a month in the calendar to show it on the map.";
    } catch (err) {
      if (req === state.pointsReq) note.textContent = String(err.message || err);
    }
  }

  function areaLabel() {
    if (state.muni) return "Municipality " + state.muni.name + " (IBGE code " + state.muni.code + "), inside its IBGE boundary; " + state.meta.area.name;
    const b = state.bbox.map((v) => LunaxCalc.fmt(v, 4));
    return state.meta.area.name + "; rectangle west " + b[0] + ", south " + b[1] + ", east " + b[2] + ", north " + b[3];
  }

  function resetHotspots() {
    state.hotspots = null;
    $("hotspots-download").disabled = true;
    $("hotspots-kml").disabled = true;
    $("hotspots-status").textContent = "The hotspot list holds the individual FIRMS detections in the selected cells and period. Count them first to see how many rows the file will have.";
  }

  async function countHotspots() {
    const rows = state.rows;
    if (!rows) return;
    const isCurrent = () => state.rows === rows;
    const cellIds = state.sel.map((i) => state.data.cells[i].id);
    const status = $("hotspots-status"), btn = $("hotspots-count");
    const from = state.data.months[Number($("range-from").value)], to = state.data.months[Number($("range-to").value)];
    btn.disabled = true; $("hotspots-download").disabled = true; $("hotspots-kml").disabled = true;
    try {
      state.hotspotIndex = state.hotspotIndex || await LunaxHotspots.loadIndex();
      if (!isCurrent()) return;
      const res = keepSelected(await LunaxHotspots.load(state.hotspotIndex, cellIds, from, to, (d, t) => {
        if (isCurrent()) status.textContent = "Reading files " + d + " of " + t + "...";
      }));
      if (!isCurrent()) return;
      state.hotspots = { res: res, from: from, to: to };
      const where = state.muni ? state.muni.name : "the selected cells";
      status.textContent = (res.lines.length ? LunaxCalc.hotspotCountText(LunaxCalc.countBySatellite(res.header, res.lines), res.lines.length, from, to, where)
        : "No hotspot rows in " + where + ", " + from + " to " + to + ".") +
        " (" + res.files + " yearly files, " + (res.bytes / 1e6).toFixed(1) + " MB read)." + (res.lines.length ? " Press Download to save them." : "");
      $("hotspots-download").disabled = $("hotspots-kml").disabled = res.lines.length === 0;
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
    $("csv-cells").disabled = !hasCells || !!state.muni; // DE-24: 0.25° cells do not follow municipal borders
    refreshMap();
    $("firms-link").href = firmsLink(state.bbox);
    const info = $("selection-info");
    if (!hasCells) {
      info.textContent = "No grid cell centres inside this rectangle. Adjust the rectangle to select cells.";
      Plotly.purge($("calendar")); Plotly.purge($("compare")); Plotly.purge($("season")); Plotly.purge($("outlook"));
      $("compare-text").textContent = ""; $("season-text").textContent = ""; $("outlook-text").textContent = "";
      return;
    }
    $("print-header").textContent = "Fire briefing. Area: " + areaLabel() + ". Period: " + state.data.months[Number($("range-from").value)] +
      " to " + state.data.months[Number($("range-to").value)] + ". Archived NASA FIRMS data through " + state.meta.data_cutoff_date + ", not live.";
    info.textContent = state.muni ? "Municipality " + state.muni.name + " (IBGE code " + state.muni.code + "): the calendar, fire " +
      "season, comparison, map points and hotspot downloads use the detections inside its IBGE boundary. The map cells around it " +
      "are 0.25° grid cells, shown for context." : cells.length + (cells.length === 1 ? " grid cell" : " grid cells") +
      " selected. The rectangle selects whole " + state.meta.grid.cell_size_deg + "° cells by their centres.";
    const unit = "hotspots";
    LunaxCalendar.render($("calendar"), state.rows, unit, function (ym) {
      const m = state.data.months.indexOf(ym);
      if (m >= 0 && state.rows[m].inRange) { state.mapMonth = m; refreshMap(); } // months outside the period are ignored
    });
    LunaxSeason.render($("season"), $("season-text"), state.rows);
    // DE-27: the outlook uses the harmonized series of the area whatever series is displayed
    if ($("series-select").value === "viirs_eq") LunaxOutlook.render($("outlook"), $("outlook-text"), state.rows, state.meta.outlook);
    else { Plotly.purge($("outlook")); $("outlook-text").textContent = "The outlook uses the harmonized series: choose it in section 1."; }
    LunaxCompare.render($("compare"), $("compare-text"), state.rows, Number($("compare-month").value), unit);
  }

  function setBbox(box) {
    if (!(box[0] < box[2] && box[1] < box[3])) { $("selection-info").textContent = "West must be less than east and south less than north."; return; }
    if (state.muni) { state.muni = null; $("muni-select").value = ""; state.map.highlightMunicipality(null); } // back to the rectangle
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
      const { meta, boundary, data, muniData, muniGeo, munis } = await LunaxData.loadAll();
      Object.assign(state, { meta: meta, data: data, muniData: muniData, munis: munis, muni: null });
      addOptions($("muni-select"), munis.map((x) => [x.code, x.name]).sort((a, b) => a[1].localeCompare(b[1], "pt")));
      $("muni-select").addEventListener("change", (e) => selectMunicipality(e.target.value));
      renderStatic(meta);
      addOptions($("series-select"), SERIES);
      const monthOpts = data.months.map((m, i) => [String(i), m]);
      addOptions($("range-from"), monthOpts); addOptions($("range-to"), monthOpts);
      $("range-from").value = "0"; $("range-to").value = String(data.months.length - 1);
      addOptions($("compare-month"), ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((n, i) => [String(i + 1), n]));
      $("compare-month").value = String(Number(data.months[data.months.length - 1].slice(5, 7)));
      state.map = LunaxMap.create("map", boundary, muniGeo, meta.grid.cell_size_deg, setBbox);
      $("map-mode").addEventListener("change", () => state.rows && paintCells()); // DE-22: same month, other colors
      // DE-25: the map is resized to the page width first, so its tiles and cells are drawn before the browser prints.
      $("print-briefing").addEventListener("click", function () {
        document.body.classList.add("printing");
        state.map.invalidate();
        setTimeout(() => window.print(), 2000); // ponytail: fixed wait for the tiles; use the tile layer's "load" event if 2 s is too short
      });
      window.addEventListener("afterprint", function () { document.body.classList.remove("printing"); state.map.invalidate(); });
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
      $("hotspots-kml").addEventListener("click", function () {
        const h = state.hotspots;
        if (h) LunaxExport.hotspotsKmlFile(meta, h.res.header, h.res.lines, areaLabel(), h.from, h.to);
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
