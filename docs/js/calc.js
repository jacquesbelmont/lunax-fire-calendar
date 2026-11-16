/*
 * Purpose: pure calculations on docs/data/monthly_cells.csv (no DOM): parsing, area selection, area series,
 *          historical median and anomaly, CSV text, map layers. Runs in the browser and in Node (tests/js).
 * SCOPE: R3, R5, R6, R7, R8, R9, O3
 * Owner issue: JA-5, JA-6, JA-8
 * Rules: DE-13 (median/anomaly), DE-16 (uncertainty), DE-21 (map layers), DE-22 (usual), DE-23 (fire season),
 *        DE-24 (municipalities), DE-25 (KML), DE-26 (places that burn year after year), DE-28 (outlook), DE-29 (cell outlook),
 *        DE-30 (analysis view), DATA_CONTRACT.md (a), (e), (f). An empty value is NO DATA, never zero.
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LunaxCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SENSOR_COLUMNS = ["terra", "aqua", "snpp", "noaa20", "noaa21"];
  var Z90 = 1.645; // 90 % interval = value +/- 1.645 * sqrt(variance) (metadata.json, DE-16)

  function toNumber(s) {
    return s === "" ? NaN : Number(s);
  }

  /**
   * Parse monthly_cells.csv into typed arrays indexed [cell * nMonths + month]. Also parses municipalities.csv
   * (DE-24) with idColumn "area_id": the same columns, one "cell" per municipality, without a grid position.
   */
  function parseCellsCsv(text, cellSize, idColumn) {
    idColumn = idColumn || "cell_id";
    var lines = text.split("\n");
    var header = lines[0].replace(/\r$/, "").split(",");
    var col = {};
    header.forEach(function (h, i) { col[h] = i; });
    [idColumn, "year_month", "viirs_eq", "viirs_eq_var", "estimated"].forEach(function (c) {
      if (!(c in col)) throw new Error("data file: missing column " + c);
    });
    var cellIndex = {}, monthIndex = {}, cells = [], months = [], rows = [];
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      var f = lines[i].replace(/\r$/, "").split(",");
      var id = f[col[idColumn]], ym = f[col.year_month];
      if (!(id in cellIndex)) {
        cellIndex[id] = cells.length;
        var rc = id.split("_");
        cells.push(idColumn !== "cell_id" ? { id: id } :
          { id: id, lat: (Number(rc[0]) + 0.5) * cellSize - 90, lon: (Number(rc[1]) + 0.5) * cellSize - 180 });
      }
      if (!(ym in monthIndex)) { monthIndex[ym] = -1; months.push(ym); }
      rows.push(f);
    }
    months.sort();
    months.forEach(function (m, k) { monthIndex[m] = k; });
    var nM = months.length, n = cells.length * nM;
    var out = { cells: cells, months: months, nMonths: nM, estimated: new Uint8Array(n),
                columns: { viirs_eq: new Float64Array(n).fill(NaN), viirs_eq_var: new Float64Array(n).fill(NaN) } };
    SENSOR_COLUMNS.forEach(function (s) { if (s in col) out.columns[s] = new Float64Array(n).fill(NaN); });
    rows.forEach(function (f) {
      var k = cellIndex[f[col[idColumn]]] * nM + monthIndex[f[col.year_month]];
      out.columns.viirs_eq[k] = toNumber(f[col.viirs_eq]);
      out.columns.viirs_eq_var[k] = toNumber(f[col.viirs_eq_var]);
      out.estimated[k] = f[col.estimated] === "1" ? 1 : 0;
      SENSOR_COLUMNS.forEach(function (s) { if (s in col) out.columns[s][k] = toNumber(f[col[s]]); });
    });
    return out;
  }

  /** Indices of the cells whose centre is strictly inside the rectangle [west, south, east, north]. */
  function selectCells(data, bbox) {
    var w = bbox[0], s = bbox[1], e = bbox[2], n = bbox[3], sel = [];
    data.cells.forEach(function (c, i) {
      if (c.lon > w && c.lon < e && c.lat > s && c.lat < n) sel.push(i);
    });
    return sel;
  }

  /** Sum of a column over the selected cells per month. NaN when any selected cell has no data that month. */
  function areaSeries(data, sel, column) {
    var nM = data.nMonths, arr = data.columns[column], out = new Array(nM);
    for (var m = 0; m < nM; m++) {
      var sum = 0, ok = sel.length > 0;
      for (var j = 0; j < sel.length && ok; j++) {
        var v = arr[sel[j] * nM + m];
        if (Number.isNaN(v)) ok = false; else sum += v;
      }
      out[m] = ok ? sum : NaN;
    }
    return out;
  }

  /** Set of year_month values with provisional = 1 for any satellite in months.csv (near real-time data, DE-4). */
  function provisionalMonths(text) {
    var lines = text.trim().split("\n"), h = lines[0].split(","), iy = h.indexOf("year_month"), ip = h.indexOf("provisional");
    if (iy < 0 || ip < 0) throw new Error("months.csv: missing year_month or provisional column");
    var out = new Set();
    lines.slice(1).forEach(function (l) { var f = l.split(","); if (f[ip] === "1") out.add(f[iy]); });
    return out;
  }

  /** A month is estimated (converted from MODIS) if any selected cell is estimated. */
  function estimatedMonths(data, sel) {
    var nM = data.nMonths, out = new Array(nM).fill(false);
    for (var m = 0; m < nM; m++) {
      for (var j = 0; j < sel.length; j++) {
        if (data.estimated[sel[j] * nM + m]) { out[m] = true; break; }
      }
    }
    return out;
  }

  function median(values) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    var h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  /** DE-13: median of the same calendar month in all previous years with data; anomaly = difference and ratio. */
  function medianAnomaly(months, values) {
    return months.map(function (ym, i) {
      var year = Number(ym.slice(0, 4)), prev = [];
      months.forEach(function (other, j) {
        if (other.slice(5, 7) === ym.slice(5, 7) && Number(other.slice(0, 4)) < year && !Number.isNaN(values[j])) prev.push(values[j]);
      });
      var med = prev.length ? median(prev) : NaN;
      var diff = Number.isNaN(values[i]) || Number.isNaN(med) ? NaN : values[i] - med;
      var ratio = !Number.isNaN(med) && med > 0 && !Number.isNaN(values[i]) ? values[i] / med : NaN;
      return { median: med, nYears: prev.length, diff: diff, ratio: ratio };
    });
  }

  /**
   * First observed month: the month after the last estimated month (null when no month is estimated or the
   * estimates reach the end). Months with no data are not estimated, so "the first month that is not estimated" would
   * wrongly pick one of them (2001-06). rows: [{ym, estimated}] in order.
   */
  function firstObservedMonth(rows) {
    var last = -1;
    rows.forEach(function (r, i) { if (r.estimated) last = i; });
    return last >= 0 && last + 1 < rows.length ? rows[last + 1].ym : null;
  }

  /** SVG-like path (calendar axes: x = month 0-11, y = year row) that outlines the estimated months above/left of `ym`. */
  function estimatedBoundaryPath(years, ym) {
    var r = years.indexOf(Number(ym.slice(0, 4))), c = Number(ym.slice(5, 7)) - 1;
    if (r < 0) return null;
    return "M -0.5 " + (r + 0.5) + " L " + (c - 0.5) + " " + (r + 0.5) + " L " + (c - 0.5) + " " + (r - 0.5) + " L 11.5 " + (r - 0.5);
  }

  /**
   * Sentence for a month compared with its historical median (DE-30: "Latest" unless latest === false, i.e. the focus
   * month is not the latest month with data). row: {ym, value, median, nYears, diff, ratio, estimated, provisional}. A provisional month (FIRMS near real-time data) says so, because its value can still change.
   */
  function monthComparisonText(row, monthName, unit, latest) {
    var noun = Math.round(row.value) === 1 ? unit.replace(/s$/, "") : unit;
    var s = (latest === false ? monthName + " " + row.ym.slice(0, 4) : "Latest " + monthName + " in the data (" + row.ym.slice(0, 4) + ")") +
      ": " + fmt(row.value, 0) + " " + noun;
    if (row.provisional) s += " (provisional: near real-time data)";
    if (Number.isNaN(row.median)) s += ". No earlier year to compare with.";
    else {
      s += ", compared with a historical median of " + fmt(row.median, 0) + " (" + row.nYears + " earlier years)";
      s += ": " + (row.diff >= 0 ? "+" : "") + fmt(row.diff, 0);
      if (!Number.isNaN(row.ratio)) s += " (" + fmt(row.ratio, 2) + " times the median)";
      s += ".";
    }
    if (row.estimated) s += " This month is estimated from MODIS.";
    if (row.provisional) s += " FIRMS will replace this month with standard data, so the value can still change.";
    return s;
  }

  /**
   * Index (in rows) of the month shown by "the latest month compared with its historical median": the latest year in
   * the period with data for calendar month monthNo (1-12); if no year has data, the latest year in the period; -1 if none.
   * The map colors the cells for this same month.
   */
  function comparedMonthIndex(rows, monthNo) {
    var mm = String(monthNo).padStart(2, "0"), latest = -1;
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (!r.inRange || r.ym.slice(5, 7) !== mm) continue;
      if (latest < 0) latest = i;
      if (!Number.isNaN(r.value)) return i;
    }
    return latest;
  }

  /** Value of one column per selected cell in month index m (the per-cell terms that areaSeries sums). NaN = no data. */
  function cellMonthValues(data, sel, column, m) {
    var nM = data.nMonths, arr = data.columns[column];
    return sel.map(function (i) { return { index: i, value: arr[i * nM + m] }; });
  }

  /**
   * Top of the map color scale: 95th percentile (nearest rank) of the cell values with data, so that one very active
   * cell does not wash out the others (display choice, method/DECISIONS.md DE-21). Never below 1.
   */
  function colorCap(values) {
    var v = values.filter(function (x) { return !Number.isNaN(x); }).sort(function (a, b) { return a - b; });
    if (!v.length) return 1;
    return Math.max(1, v[Math.max(0, Math.ceil(0.95 * v.length) - 1)]);
  }

  // Plotly.js 4.3.0 "Viridis" colorscale stops (docs/lib/plotly/plotly.min.js), used reversed as in the calendar.
  var VIRIDIS = [[0, "#440154"], [0.06274509803921569, "#48186a"], [0.12549019607843137, "#472d7b"], [0.18823529411764706, "#424086"],
    [0.25098039215686274, "#3b528b"], [0.3137254901960784, "#33638d"], [0.3764705882352941, "#2c728e"], [0.4392156862745098, "#26828e"],
    [0.5019607843137255, "#21918c"], [0.5647058823529412, "#1fa088"], [0.6274509803921569, "#28ae80"], [0.6901960784313725, "#3fbc73"],
    [0.7529411764705882, "#5ec962"], [0.8156862745098039, "#84d44b"], [0.8784313725490196, "#addc30"], [0.9411764705882353, "#d8e219"],
    [1, "#fde725"]];

  /** Color for value v on a 0..cap scale, reversed Viridis (0 = light yellow, cap and above = dark purple). */
  function viridisReversed(v, cap) {
    var t = 1 - Math.min(1, Math.max(0, v / cap));
    for (var k = 1; k < VIRIDIS.length; k++) {
      if (t <= VIRIDIS[k][0]) {
        var a = VIRIDIS[k - 1], b = VIRIDIS[k], f = (t - a[0]) / (b[0] - a[0]);
        var ca = parseInt(a[1].slice(1), 16), cb = parseInt(b[1].slice(1), 16);
        var mix = [16, 8, 0].map(function (s) { return Math.round(((ca >> s) & 255) * (1 - f) + ((cb >> s) & 255) * f); });
        return "#" + mix.map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
      }
    }
    return VIRIDIS[VIRIDIS.length - 1][1];
  }

  /** CSS gradient of the reversed Viridis ramp, for the map legend. */
  function viridisReversedGradient() {
    return "linear-gradient(to right, " + VIRIDIS.map(function (s) { return s[1] + " " + ((1 - s[0]) * 100).toFixed(1) + "%"; }).reverse().join(", ") + ")";
  }

  /** DE-21: hotspot rows (filterHotspots output) as map points {lat, lon, sensor, sat, date, time, confidence, daynight, frp, version}. */
  function hotspotPoints(header, lines) {
    var h = header.split(","), col = {};
    ["latitude", "longitude", "sensor", "sat", "acq_date", "acq_time", "confidence", "daynight", "frp", "version"].forEach(function (c) {
      col[c] = h.indexOf(c);
      if (col[c] < 0) throw new Error("hotspot files: missing column " + c);
    });
    return lines.map(function (l) {
      var f = l.split(",");
      return { lat: Number(f[col.latitude]), lon: Number(f[col.longitude]), sensor: f[col.sensor], sat: f[col.sat],
               date: f[col.acq_date], time: f[col.acq_time], confidence: f[col.confidence], daynight: f[col.daynight],
               frp: f[col.frp], version: f[col.version] };
    });
  }

  /** 90 % interval half-width from a summed variance. */
  function halfWidth90(variance) {
    return Number.isNaN(variance) ? NaN : Z90 * Math.sqrt(variance);
  }

  function fmt(v, digits) {
    return v === null || v === undefined || Number.isNaN(v) ? "" : String(Number(v.toFixed(digits === undefined ? 1 : digits)));
  }

  /** CSV text of the monthly area series (R9). Comment lines (#) carry attribution and cut-off date. */
  function seriesCsv(meta, rows, label) {
    var head = ["# " + meta.title, "# Area: " + label, "# Data cut-off date: " + meta.data_cutoff_date + " (" + meta.archived + ")",
                "# " + meta.attribution, "# Disclaimer: " + meta.disclaimer_url,
                "# Empty value = no data (never zero fire). estimated=1: converted from MODIS (see method/METHOD.md)."];
    var prov = rows.filter(function (r) { return r.provisional; }).map(function (r) { return r.ym; });
    if (prov.length) head.push("# Provisional months (FIRMS near real-time data, replaced later by standard data): " + prov.join(" "));
    head.push("year_month,value,ci90_low,ci90_high,estimated,median_same_month,n_years_median,anomaly_diff,anomaly_ratio");
    var body = rows.map(function (r) {
      return [r.ym, fmt(r.value, 3), fmt(r.lo, 3), fmt(r.hi, 3), r.estimated ? 1 : 0, fmt(r.median, 3), r.nYears,
              fmt(r.diff, 3), fmt(r.ratio, 4)].join(",");
    });
    return head.concat(body).join("\n") + "\n";
  }

  /**
   * Add to `out.lines` the rows of one decompressed hotspot file whose cell is in `cellSet` and whose month is in
   * [fromYm, toYm]. Comment lines (#) are skipped; the first other line is the column header (kept in out.header).
   * Returns the number of rows added. Columns: cell_id, latitude, longitude, acq_date, ... (DE-17).
   */
  function filterHotspots(text, cellSet, fromYm, toYm, out) {
    var pos = 0, added = 0, n = text.length;
    while (pos < n) {
      var end = text.indexOf("\n", pos);
      if (end < 0) end = n;
      var line = text.slice(pos, end);
      pos = end + 1;
      if (!line || line.charAt(0) === "#") continue;
      if (!out.header) { out.header = line; continue; }
      var f = line.split(",", 4), ym = f[3].slice(0, 7);
      if (cellSet.has(f[0]) && ym >= fromYm && ym <= toYm) { out.lines.push(line); added++; }
    }
    return added;
  }

  /**
   * Rows of the hotspot list per satellite, in a fixed order, and the sentence shown before the download.
   * The list mixes MODIS and VIIRS detections; the total is a number of rows, never a harmonized count (AGENTS.md rule 6).
   */
  var SAT_LABELS = [["Terra", "Terra (MODIS)"], ["Aqua", "Aqua (MODIS)"], ["SNPP", "Suomi NPP (VIIRS)"],
                    ["NOAA20", "NOAA-20 (VIIRS)"], ["NOAA21", "NOAA-21 (VIIRS)"]];
  function countBySatellite(header, lines) {
    var i = header.split(",").indexOf("sat"), counts = {};
    if (i < 0) throw new Error("hotspot files: missing column sat");
    lines.forEach(function (l) { var s = l.split(",", i + 1)[i]; counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }
  /** "Terra (MODIS) 209, Aqua (MODIS) 315, ...": one count per satellite, never a total. */
  function satelliteCountsText(counts) {
    return SAT_LABELS.filter(function (p) { return counts[p[0]]; })
      .map(function (p) { return p[1] + " " + counts[p[0]].toLocaleString("en-US"); }).join(", ");
  }
  function hotspotCountText(counts, total, fromYm, toYm, where) {
    return total.toLocaleString("en-US") + " rows in the hotspot list for " + (where || "the selected cells") + ", " + fromYm + " to " + toYm + ": " +
      satelliteCountsText(counts) + ". These are individual detections of each sensor, not a harmonized count; MODIS and VIIRS are never added together.";
  }

  /** DE-11 (docs/data/metadata.json method.native_months and estimated_months): source of the harmonized value of month ym. */
  function harmonizedSource(ym) {
    if (ym < "2012-02") return "is estimated from MODIS (Terra and Aqua, or Terra alone)";
    return "counts the " + (ym < "2018-04" ? "Suomi NPP" : "NOAA-20") + " (VIIRS) detections only";
  }

  /** DE-21: text shown when a detection on the map is clicked (fields as in DATA_CONTRACT.md (b)). */
  function hotspotPointText(p) {
    var label = SAT_LABELS.filter(function (s) { return s[0] === p.sat; }).map(function (s) { return s[1]; })[0] || p.sat;
    var conf = p.sensor === "VIIRS" ? ({ l: "low", n: "nominal", h: "high" }[p.confidence] || p.confidence) : p.confidence + " %";
    return p.date + " " + p.time.slice(0, 2) + ":" + p.time.slice(2) + " UTC, " + label + ", confidence " + conf + ", " +
      (p.daynight === "D" ? "day" : "night") + ", FRP " + p.frp + " MW" + (/NRT$/.test(p.version) ? ", near real-time (provisional)" : "");
  }

  /** CSV text of the selected hotspots with the attribution header (R9). */
  function hotspotsCsv(meta, header, lines, label, fromYm, toYm) {
    var head = ["# " + meta.title + " - hotspots", "# Area: " + label, "# Period: " + fromYm + " to " + toYm,
                "# Data cut-off date: " + meta.data_cutoff_date + " (" + meta.archived + ")", "# " + meta.attribution,
                "# Disclaimer: " + meta.disclaimer_url,
                "# FIRMS standard-processing detections inside the study area, type 0 (presumed vegetation fire), no confidence filter. "
                + "MODIS (1 km) and VIIRS (375 m) detections are never to be added together.", header];
    return head.concat(lines).join("\n") + "\n";
  }

  function xmlText(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * DE-25: KML of the same hotspot rows as hotspotsCsv, one placemark per detection, styled by sensor (colors of
   * DE-21, KML order aabbggrr), with the FIRMS acknowledgment, cut-off date and disclaimer in the document description.
   */
  function hotspotsKml(meta, header, lines, label, fromYm, toYm) {
    var desc = [meta.title + " - hotspots", "Area: " + label, "Period: " + fromYm + " to " + toYm,
                "Data cut-off date: " + meta.data_cutoff_date + " (" + meta.archived + ")", meta.attribution,
                "Disclaimer: " + meta.disclaimer_url,
                "FIRMS standard-processing detections inside the study area, type 0 (presumed vegetation fire), no confidence filter. "
                + "MODIS (1 km) and VIIRS (375 m) detections are never to be added together."].join("\n");
    var style = function (id, color) {
      return '<Style id="' + id + '"><IconStyle><color>' + color + "</color><scale>0.6</scale><Icon><href>" +
        "https://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon></IconStyle></Style>";
    };
    var out = ['<?xml version="1.0" encoding="UTF-8"?>', '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
               "<name>" + xmlText(meta.title + " hotspots, " + fromYm + " to " + toYm) + "</name>",
               "<description>" + xmlText(desc) + "</description>", style("MODIS", "ffb27200"), style("VIIRS", "ff005ed5")];
    hotspotPoints(header, lines).forEach(function (p) {
      out.push("<Placemark><name>" + xmlText(p.sat + " " + p.date + " " + p.time.slice(0, 2) + ":" + p.time.slice(2) + " UTC") +
        "</name><styleUrl>#" + (p.sensor === "MODIS" ? "MODIS" : "VIIRS") + "</styleUrl><description>" + xmlText(hotspotPointText(p)) +
        "</description><Point><coordinates>" + p.lon + "," + p.lat + "</coordinates></Point></Placemark>");
    });
    out.push("</Document></kml>");
    return out.join("\n") + "\n";
  }

  /** DE-22: usual value of cell i in month index m: DE-13 median of the same calendar month in earlier years with data. */
  function cellUsual(data, i, column, m) {
    var nM = data.nMonths, arr = data.columns[column], mm = data.months[m].slice(5, 7), prev = [];
    for (var j = m - 1; j >= 0; j--) {
      var v = arr[i * nM + j];
      if (data.months[j].slice(5, 7) === mm && !Number.isNaN(v)) prev.push(v);
    }
    return prev.length ? median(prev) : NaN;
  }

  /** DE-22 classes of the "Compared with the usual" view, in legend order: [key, color, label]. ColorBrewer PuOr, 5 classes. */
  var USUAL_CLASSES = [["much_above", "#e66101", "2 times usual or more"], ["above", "#fdb863", "Above usual"],
    ["near", "#f7f7f7", "Near usual"], ["below", "#b2abd2", "Below usual"], ["much_below", "#5e3c99", "Half of usual or less"],
    ["first", "#d9d9d9", "No earlier year to compare"], ["none", "#9e9e9e", "No data (not zero)"]];

  /** DE-22: class key of value v against usual value m (NaN = no data). */
  function usualClass(v, m) {
    if (Number.isNaN(v)) return "none";
    if (Number.isNaN(m)) return "first";
    if (Math.abs(v - m) <= 2 * Math.sqrt(Math.max(m, 1))) return "near"; // chance variation of a count (Poisson, 2 sd)
    if (v > m) return m === 0 || v / m >= 2 ? "much_above" : "above";
    return v / m <= 0.5 ? "much_below" : "below";
  }

  /** DE-23: {start, peak, end} months (1-12) of 12 monthly values without gaps; null when the year has no hotspots. */
  function seasonOf(v) {
    var total = v.reduce(function (a, b) { return a + b; }, 0), c = 0, start = 0, end = 0, peak = 0;
    if (!(total > 0)) return null;
    for (var k = 0; k < 12; k++) {
      c += v[k];
      if (!start && c >= 0.1 * total) start = k + 1;
      if (!end && c >= 0.9 * total) end = k + 1;
      if (v[k] > v[peak]) peak = k; // the earlier month on a tie
    }
    return { start: start, peak: peak + 1, end: end };
  }

  /**
   * DE-23: fire season of each year with a month in the period. rows: [{ym, value, inRange}]. A missing month (no data,
   * outside the period or not yet in the data) is tried as 0 and as the largest value of that calendar month in the
   * other years; the year is shown only if both give the same season (missing data is never zero fire).
   * Returns [{year, start, peak, end}] or [{year, reason: "missing data" | "no hotspots"}].
   */
  function seasonByYear(rows) {
    var byYear = {}, maxByMonth = new Array(12).fill(0);
    rows.forEach(function (r) {
      var y = r.ym.slice(0, 4), k = Number(r.ym.slice(5, 7)) - 1;
      if (!Number.isNaN(r.value)) maxByMonth[k] = Math.max(maxByMonth[k], r.value);
      if (!r.inRange) return;
      byYear[y] = byYear[y] || new Array(12).fill(NaN);
      byYear[y][k] = r.value;
    });
    return Object.keys(byYear).sort().map(function (y) {
      var v = byYear[y];
      var lo = seasonOf(v.map(function (x) { return Number.isNaN(x) ? 0 : x; }));
      var hi = seasonOf(v.map(function (x, k) { return Number.isNaN(x) ? maxByMonth[k] : x; }));
      if (!lo && !hi) return { year: Number(y), reason: "no hotspots" };
      if (lo && hi && lo.start === hi.start && lo.peak === hi.peak && lo.end === hi.end) {
        return { year: Number(y), start: lo.start, peak: lo.peak, end: lo.end };
      }
      return { year: Number(y), reason: "missing data" };
    });
  }

  /** DE-23: typical season of the computed years: nearest-rank median start, peak and end (always a month), earliest start, latest end. */
  function typicalSeason(perYear) {
    var ok = perYear.filter(function (s) { return s.start; });
    if (!ok.length) return null;
    var mid = function (key) {
      var s = ok.map(function (o) { return o[key]; }).sort(function (a, b) { return a - b; });
      return s[Math.ceil(s.length / 2) - 1];
    };
    var starts = ok.map(function (o) { return o.start; }), ends = ok.map(function (o) { return o.end; });
    var first = Math.min.apply(null, starts), last = Math.max.apply(null, ends);
    return { n: ok.length, start: mid("start"), peak: mid("peak"), end: mid("end"),
             earliestStart: first, nEarliest: starts.filter(function (x) { return x === first; }).length,
             latestEnd: last, nLatest: ends.filter(function (x) { return x === last; }).length };
  }

  /**
   * DE-24: municipalities.geojson as [{code, name, parts: [rings], bbox}]: each part is a Polygon's rings (outer ring
   * first, then holes). RA-11: Brazil has MultiPolygons and holes; Rondonia's are single Polygons without holes.
   */
  function parseMunicipalities(geojson) {
    return geojson.features.map(function (f) {
      var g = f.geometry, parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      var xs = [], ys = [];
      parts.forEach(function (p) { p[0].forEach(function (v) { xs.push(v[0]); ys.push(v[1]); }); });
      return { code: f.properties.code, name: f.properties.name, parts: parts,
               bbox: [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)] };
    });
  }

  function insideRing(x, y, ring) { // ray casting
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /**
   * DE-24: index of the municipality of a detection: the first polygon that contains it, else the municipality of the
   * nearest boundary vertex (same rule as municipality_of in pipeline/export.py, so the app keeps the same detections).
   */
  function municipalityIndex(lon, lat, munis) {
    var inPart = function (p) { return insideRing(lon, lat, p[0]) && !p.slice(1).some(function (h) { return insideRing(lon, lat, h); }); };
    for (var k = 0; k < munis.length; k++) {
      var b = munis[k].bbox;
      if (lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3] && munis[k].parts.some(inPart)) return k;
    }
    var best = -1, bestD = Infinity;
    munis.forEach(function (m, k) {
      m.parts.forEach(function (p) {
        p.forEach(function (ring) {
          ring.forEach(function (v) {
            var d = (v[0] - lon) * (v[0] - lon) + (v[1] - lat) * (v[1] - lat);
            if (d < bestD) { bestD = d; best = k; }
          });
        });
      });
    });
    return best;
  }

  /** DE-26 classes of "Places that burn year after year": [min years, color, label], ColorBrewer YlOrRd 5. */
  var RECURRENCE_CLASSES = [[10, "#bd0026", "10-13 years (almost every year)"], [7, "#f03b20", "7-9 years (more than half)"],
    [5, "#fd8d3c", "5-6 years"], [3, "#fecc5c", "3-4 years"], [1, "#ffffb2", "1-2 years"]];

  /** DE-26: class of a cell with detections in `years` years, or null (no detection: not drawn, not proof of no fire). */
  function recurrenceClass(years) {
    for (var k = 0; k < RECURRENCE_CLASSES.length; k++) if (years >= RECURRENCE_CLASSES[k][0]) return RECURRENCE_CLASSES[k];
    return null;
  }

  function mercatorY(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }

  /**
   * DE-26, DE-29: [x, y, w, h] of grid cell "row_col" of `size` degrees on a canvas of W x H pixels covering bbox [west, south, east, north],
   * with rows in Web Mercator (the map's projection), so each cell lands where it belongs on the map.
   */
  function gridCellRect(id, size, bbox, W, H) {
    var rc = id.split("_"), lat0 = Number(rc[0]) * size - 90, lon0 = Number(rc[1]) * size - 180;
    var top = mercatorY(bbox[3]), span = top - mercatorY(bbox[1]), dx = W / (bbox[2] - bbox[0]);
    var y0 = (top - mercatorY(lat0 + size)) / span * H, y1 = (top - mercatorY(lat0)) / span * H;
    return [(lon0 - bbox[0]) * dx, y0, size * dx, y1 - y0];
  }

  /** DE-29 classes of the chance of fire next season: [min chance, color, label], ColorBrewer PuRd; under 10 % not drawn
   * (it covered most of the state and hid the places that matter; the hover text still gives the chance). */
  var OUTLOOK_CLASSES = [[0.75, "#980043", "75% or more"], [0.5, "#dd1c77", "50-75%"], [0.25, "#df65b0", "25-50%"],
    [0.1, "#d7b5d8", "10-25%"]];
  function outlookClass(p) {
    for (var k = 0; k < OUTLOOK_CLASSES.length; k++) if (p >= OUTLOOK_CLASSES[k][0]) return OUTLOOK_CLASSES[k];
    return null;
  }

  /** Canvas height for width W so that the canvas has the map's (Web Mercator) aspect over bbox. */
  function mercatorHeight(bbox, W) {
    return Math.round(W * (mercatorY(bbox[3]) - mercatorY(bbox[1])) / ((bbox[2] - bbox[0]) * Math.PI / 180));
  }

  /**
   * DE-28: per year of rows [{ym, value}], T = August-October total and J = January-July total; NaN when a month has
   * no data or is not in the data (missing data is never zero fire). Keys are years (numbers as object keys).
   */
  function seasonTotals(rows) {
    var byYear = {}, out = {};
    rows.forEach(function (r) {
      var y = Number(r.ym.slice(0, 4));
      (byYear[y] = byYear[y] || new Array(13).fill(NaN))[Number(r.ym.slice(5, 7))] = r.value;
    });
    Object.keys(byYear).forEach(function (y) {
      var v = byYear[y], sum = function (a, b) { var s = 0; for (var k = a; k <= b; k++) s += v[k]; return s; }; // NaN propagates
      out[y] = { T: sum(8, 10), J: sum(1, 7) };
    });
    return out;
  }

  /** DE-28: forecast of T(Y) by candidate "C", "P", "P3" or "R", from earlier years only (and J(Y) for R); NaN if undefined. */
  function outlookForecast(totals, Y, method) {
    var earlier = Object.keys(totals).map(Number).filter(function (y) { return y < Y; });
    var withT = earlier.filter(function (y) { return !Number.isNaN(totals[y].T); }).map(function (y) { return totals[y].T; });
    var C = withT.length >= 5 ? median(withT) : NaN;
    if (method === "C") return C;
    if (method === "P") return totals[Y - 1] ? totals[Y - 1].T : NaN;
    if (method === "P3") {
      var last = [Y - 1, Y - 2, Y - 3].filter(function (y) { return totals[y] && !Number.isNaN(totals[y].T); }).map(function (y) { return totals[y].T; });
      return last.length >= 2 ? median(last) : NaN;
    }
    if (method === "R") {
      var withJ = earlier.filter(function (y) { return !Number.isNaN(totals[y].J); }).map(function (y) { return totals[y].J; });
      var j = totals[Y] ? totals[Y].J : NaN;
      if (Number.isNaN(C) || Number.isNaN(j) || !withJ.length) return NaN;
      return C * Math.min(4, Math.max(0.25, (j + 1) / (median(withJ) + 1)));
    }
    throw new Error("unknown outlook method " + method);
  }

  /**
   * DE-28: for target years from..to with an observed T and a forecast by every method: signed errors
   * ln((observed + 1) / (forecast + 1)). Returns [{year, observed, forecasts, errors}].
   */
  function outlookErrors(totals, methods, from, to) {
    var out = [];
    for (var Y = from; Y <= to; Y++) {
      var t = totals[Y];
      if (!t || Number.isNaN(t.T)) continue;
      var f = methods.map(function (m) { return outlookForecast(totals, Y, m); });
      if (f.some(Number.isNaN)) continue;
      out.push({ year: Y, observed: t.T, forecasts: f, errors: f.map(function (x) { return Math.log((t.T + 1) / (x + 1)); }) });
    }
    return out;
  }

  /** Nearest-rank quantile q (0-1) of numbers. */
  function quantile(values, q) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    return s[Math.max(0, Math.ceil(q * s.length) - 1)];
  }

  /** DE-30: January-December total per year of rows [{ym, value, inRange}]; NaN unless all 12 months are in the period and have data. */
  function yearTotals(rows) {
    var acc = {}, out = {};
    rows.forEach(function (r) {
      var a = acc[r.ym.slice(0, 4)] = acc[r.ym.slice(0, 4)] || { n: 0, s: 0 };
      if (r.inRange && !Number.isNaN(r.value)) { a.n++; a.s += r.value; }
    });
    Object.keys(acc).forEach(function (y) { out[y] = acc[y].n === 12 ? acc[y].s : NaN; });
    return out;
  }

  /** DE-30: median of each calendar month (index 0-11) over the rows in the period with data; NaN when none. */
  function monthMedians(rows) {
    var by = [[], [], [], [], [], [], [], [], [], [], [], []];
    rows.forEach(function (r) { if (r.inRange && !Number.isNaN(r.value)) by[Number(r.ym.slice(5, 7)) - 1].push(r.value); });
    return by.map(function (v) { return v.length ? median(v) : NaN; });
  }

  return { parseCellsCsv: parseCellsCsv, hotspotsKml: hotspotsKml, RECURRENCE_CLASSES: RECURRENCE_CLASSES, yearTotals: yearTotals, monthMedians: monthMedians,
           seasonTotals: seasonTotals, outlookForecast: outlookForecast, outlookErrors: outlookErrors, quantile: quantile, recurrenceClass: recurrenceClass,
           gridCellRect: gridCellRect, mercatorHeight: mercatorHeight, OUTLOOK_CLASSES: OUTLOOK_CLASSES, outlookClass: outlookClass, parseMunicipalities: parseMunicipalities, municipalityIndex: municipalityIndex, cellUsual: cellUsual, USUAL_CLASSES: USUAL_CLASSES, usualClass: usualClass,
           seasonByYear: seasonByYear, typicalSeason: typicalSeason, filterHotspots: filterHotspots, countBySatellite: countBySatellite, hotspotCountText: hotspotCountText, hotspotsCsv: hotspotsCsv, selectCells: selectCells, areaSeries: areaSeries,
           estimatedMonths: estimatedMonths, provisionalMonths: provisionalMonths, firstObservedMonth: firstObservedMonth, monthComparisonText: monthComparisonText,
           estimatedBoundaryPath: estimatedBoundaryPath, medianAnomaly: medianAnomaly, halfWidth90: halfWidth90,
           seriesCsv: seriesCsv, fmt: fmt, SENSOR_COLUMNS: SENSOR_COLUMNS,
           comparedMonthIndex: comparedMonthIndex, cellMonthValues: cellMonthValues, colorCap: colorCap,
           viridisReversed: viridisReversed, viridisReversedGradient: viridisReversedGradient, hotspotPoints: hotspotPoints,
           satelliteCountsText: satelliteCountsText, harmonizedSource: harmonizedSource, hotspotPointText: hotspotPointText };
});
