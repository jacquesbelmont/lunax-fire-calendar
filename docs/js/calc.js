/*
 * Purpose: pure calculations on docs/data/monthly_cells.csv (no DOM): parsing, area selection, area series,
 *          historical median and anomaly, CSV text. Runs in the browser and in Node (tests/js).
 * SCOPE: R3, R5, R6, R7, R8, R9, O3
 * Owner issue: JA-5, JA-6, JA-8
 * Rules: DE-13 (median/anomaly), DE-16 (uncertainty), DATA_CONTRACT.md (a). An empty value is NO DATA, never zero.
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

  /** Parse monthly_cells.csv into typed arrays indexed [cell * nMonths + month]. */
  function parseCellsCsv(text, cellSize) {
    var lines = text.split("\n");
    var header = lines[0].replace(/\r$/, "").split(",");
    var col = {};
    header.forEach(function (h, i) { col[h] = i; });
    ["cell_id", "year_month", "viirs_eq", "viirs_eq_var", "estimated"].forEach(function (c) {
      if (!(c in col)) throw new Error("monthly_cells.csv: missing column " + c);
    });
    var cellIndex = {}, monthIndex = {}, cells = [], months = [], rows = [];
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      var f = lines[i].replace(/\r$/, "").split(",");
      var id = f[col.cell_id], ym = f[col.year_month];
      if (!(id in cellIndex)) {
        cellIndex[id] = cells.length;
        var rc = id.split("_");
        cells.push({ id: id, lat: (Number(rc[0]) + 0.5) * cellSize - 90, lon: (Number(rc[1]) + 0.5) * cellSize - 180 });
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
      var k = cellIndex[f[col.cell_id]] * nM + monthIndex[f[col.year_month]];
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
   * Sentence for "the latest month compared with its historical median". row: {ym, value, median, nYears, diff, ratio,
   * estimated, provisional}. A provisional month (FIRMS near real-time data) says so, because its value can still change.
   */
  function monthComparisonText(row, monthName, unit) {
    var noun = Math.round(row.value) === 1 ? unit.replace(/s$/, "") : unit;
    var s = "Latest " + monthName + " in the data (" + row.ym.slice(0, 4) + "): " + fmt(row.value, 0) + " " + noun;
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
  function hotspotCountText(counts, total, fromYm, toYm) {
    var n = function (v) { return v.toLocaleString("en-US"); };
    var parts = SAT_LABELS.filter(function (p) { return counts[p[0]]; }).map(function (p) { return p[1] + " " + n(counts[p[0]]); });
    return n(total) + " rows in the hotspot list for the selected cells, " + fromYm + " to " + toYm + ": " + parts.join(", ") +
      ". These are individual detections of each sensor, not a harmonized count; MODIS and VIIRS are never added together.";
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

  return { parseCellsCsv: parseCellsCsv, filterHotspots: filterHotspots, countBySatellite: countBySatellite, hotspotCountText: hotspotCountText, hotspotsCsv: hotspotsCsv, selectCells: selectCells, areaSeries: areaSeries,
           estimatedMonths: estimatedMonths, provisionalMonths: provisionalMonths, firstObservedMonth: firstObservedMonth, monthComparisonText: monthComparisonText,
           estimatedBoundaryPath: estimatedBoundaryPath, medianAnomaly: medianAnomaly, halfWidth90: halfWidth90,
           seriesCsv: seriesCsv, fmt: fmt, SENSOR_COLUMNS: SENSOR_COLUMNS };
});
