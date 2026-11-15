/*
 * Purpose: monthly calendar (year x month heatmap). No-data months are grey, never zero. Estimated months are
 *          separated by a dashed line. Accessible, perceptually uniform color ramp (Viridis). A click on a month makes
 *          it the focus month of the page (DE-21, DE-30).
 *          DE-30: margins (median of each month on top; totals of complete years on the right), the DE-23 fire season
 *          drawn on the rows (outline from start to end, dot on the peak), an outline on the focus month, and a color
 *          mode "Compared with the usual" (DE-22 classes against the DE-13 median of each month).
 * SCOPE: R3, R5, R6, R10, O2, O3
 * Owner issue: JA-5, JA-7, RA-10
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SEASON = "#d62728";

  /**
   * rows: [{ym, value, lo, hi, estimated, provisional, inRange, median, ratio}].
   * opts: {unit, mode: "hotspots" | "usual", showSeason, focusIndex (row index or -1), onMonthClick(ym)}.
   */
  function render(el, rows, opts) {
    const f = LunaxCalc.fmt, usual = opts.mode === "usual", classes = LunaxCalc.USUAL_CLASSES;
    const classIndex = new Map(classes.map((c, i) => [c[0], i]));
    const years = [...new Set(rows.map((r) => Number(r.ym.slice(0, 4))))].sort((a, b) => a - b);
    const yIdx = new Map(years.map((y, i) => [y, i]));
    const grid = () => years.map(() => new Array(12).fill(null));
    const z = grid(), mask = grid(), text = grid();
    rows.forEach(function (r) {
      const y = yIdx.get(Number(r.ym.slice(0, 4))), m = Number(r.ym.slice(5, 7)) - 1;
      if (!r.inRange) return;
      if (Number.isNaN(r.value)) {
        mask[y][m] = 1;
        text[y][m] = r.ym + ": no data (never shown as zero)";
        return;
      }
      const key = LunaxCalc.usualClass(r.value, r.median);
      z[y][m] = usual ? classIndex.get(key) : r.value;
      const ci = Number.isNaN(r.lo) ? "" : " (90% interval " + f(r.lo, 0) + " to " + f(r.hi, 0) + ")";
      text[y][m] = r.ym + ": " + f(r.value, 0) + " " + opts.unit + ci + (r.estimated ? ", estimated from MODIS" : "") +
        (r.provisional ? ", provisional (near real-time data)" : "") +
        (Number.isNaN(r.median) ? "" : "<br>usual (median of earlier years): " + f(r.median, 0) + " - " + classes[classIndex.get(key)][2].toLowerCase());
    });
    const ticks = years.map(function (y) {
      const est = rows.some((r) => r.estimated && Number(r.ym.slice(0, 4)) === y);
      const prov = rows.some((r) => r.provisional && Number(r.ym.slice(0, 4)) === y);
      return String(y) + (est ? " est." : "") + (prov ? " prov." : "");
    });
    const shapes = [], firstObserved = LunaxCalc.firstObservedMonth(rows);
    if (firstObserved) {
      shapes.push({ type: "path", line: { color: "#d62728", width: 2, dash: "dash" }, path: LunaxCalc.estimatedBoundaryPath(years, firstObserved) });
    }
    // DE-30: the DE-23 season of each computed year, outlined on its row, with a dot on the peak month.
    const season = opts.showSeason ? LunaxCalc.seasonByYear(rows).filter((s) => s.start) : [];
    season.forEach(function (s) {
      const r = yIdx.get(s.year);
      // red on Viridis; in the usual mode red would vanish on the orange classes, so the page text color is used
      shapes.push({ type: "rect", x0: s.start - 1.5, x1: s.end - 0.5, y0: r - 0.42, y1: r + 0.42, line: { color: usual ? LunaxTheme.text() : SEASON, width: 1.5 }, layer: "above" });
    });
    // DE-30: the focus month.
    const focus = opts.focusIndex >= 0 ? rows[opts.focusIndex] : null;
    if (focus) {
      const r = yIdx.get(Number(focus.ym.slice(0, 4))), m = Number(focus.ym.slice(5, 7)) - 1;
      shapes.push({ type: "rect", x0: m - 0.5, x1: m + 0.5, y0: r - 0.5, y1: r + 0.5, line: { color: LunaxTheme.text(), width: 3 }, layer: "above" });
    }
    const heat = usual ?
      { colorscale: classes.flatMap((c, i) => [[i / classes.length, c[1]], [(i + 1) / classes.length, c[1]]]), zmin: -0.5, zmax: classes.length - 0.5,
        colorbar: { tickvals: classes.map((c, i) => i), ticktext: classes.map((c) => c[2]), len: 0.8, y: 0, yanchor: "bottom", x: 1.02 } } :
      { colorscale: "Viridis", reversescale: true, colorbar: { title: { text: opts.unit }, len: 0.8, y: 0, yanchor: "bottom", x: 1.02 } };
    const medians = LunaxCalc.monthMedians(rows), totals = LunaxCalc.yearTotals(rows);
    const traces = [
      { type: "heatmap", z: mask, x: MONTHS, y: years.map(String), text: text, hoverinfo: "text", showscale: false,
        colorscale: [[0, "#9e9e9e"], [1, "#9e9e9e"]], zmin: 0, zmax: 1, xgap: 1, ygap: 1 },
      Object.assign({ type: "heatmap", z: z, x: MONTHS, y: years.map(String), text: text, hoverinfo: "text", xgap: 1, ygap: 1 }, heat),
      { type: "scatter", mode: "markers", x: season.map((s) => MONTHS[s.peak - 1]), y: season.map((s) => String(s.year)), hoverinfo: "text",
        text: season.map((s) => s.year + ": fire season " + MONTHS[s.start - 1] + " to " + MONTHS[s.end - 1] + ", peak " + MONTHS[s.peak - 1]),
        marker: { color: SEASON, size: 7, line: { color: "#fff", width: 1 } }, showlegend: false },
      { type: "bar", x: MONTHS, y: medians, xaxis: "x", yaxis: "y2", marker: { color: "#6b8fb8" }, hoverinfo: "text", showlegend: false,
        text: medians.map((v, i) => MONTHS[i] + ": median " + f(v, 0) + " " + opts.unit), textposition: "none" },
      { type: "bar", orientation: "h", y: years.map(String), x: years.map((y) => totals[y]), xaxis: "x2", yaxis: "y", showlegend: false,
        marker: { color: years.map((y) => (rows.some((r) => r.estimated && Number(r.ym.slice(0, 4)) === y) ? "#9ecae1" : "#0b5cad")) },
        hoverinfo: "text", textposition: "none",
        text: years.map((y) => (Number.isNaN(totals[y]) ? y + ": no total (a month is missing or outside the period)" : y + ": " + f(totals[y], 0) + " " + opts.unit + " in the year")) },
    ];
    const font = { color: LunaxTheme.text() };
    const layout = {
      margin: { l: 80, r: usual ? 170 : 80, t: 10, b: 10 }, shapes: shapes, showlegend: false, bargap: 0.15,
      xaxis: { domain: [0, 0.82], anchor: "y", side: "top", fixedrange: true, tickangle: 0 },
      yaxis: { domain: [0, 0.84], type: "category", autorange: "reversed", tickvals: years.map(String), ticktext: ticks, fixedrange: true },
      yaxis2: { domain: [0.87, 1], anchor: "x", fixedrange: true, showgrid: false, zeroline: false, tickfont: { size: 9 }, nticks: 3 },
      xaxis2: { domain: [0.85, 1], anchor: "y", side: "top", fixedrange: true, showgrid: false, zeroline: false, tickfont: { size: 9 }, nticks: 3 },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: font,
      height: Math.round((Math.max(14, years.length) * 22 + 40) / 0.84),
    };
    return Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: false }).then(function () {
      el.removeAllListeners("plotly_click"); // react keeps old listeners: one handler only
      el.on("plotly_click", function (ev) {
        const p = ev.points[0];
        if (p.data.type !== "heatmap" && p.data.mode !== "markers") return; // the margin bars are not months
        opts.onMonthClick(p.y + "-" + String(MONTHS.indexOf(p.x) + 1).padStart(2, "0"));
      });
    });
  }
  window.LunaxTheme = {
    text: function () { return getComputedStyle(document.body).color; },
    grid: function () { return "rgba(128,128,128,0.35)"; },
  };
  window.LunaxCalendar = { render: render };
})();
