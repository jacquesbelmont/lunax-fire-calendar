/*
 * Purpose: monthly calendar (year x month heatmap). No-data months are grey, never zero. Estimated months are
 *          separated by a dashed line. Accessible, perceptually uniform color ramp (Viridis).
 * SCOPE: R3, R5, R6, R10, O2
 * Owner issue: JA-5, JA-7
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /** rows: [{ym, value, lo, hi, estimated, inRange}] ; unit: text for the hover. */
  function render(el, rows, unit) {
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
      } else {
        z[y][m] = r.value;
        const ci = Number.isNaN(r.lo) ? "" : " (90% interval " + LunaxCalc.fmt(r.lo, 0) + " to " + LunaxCalc.fmt(r.hi, 0) + ")";
        text[y][m] = r.ym + ": " + LunaxCalc.fmt(r.value, 0) + " " + unit + ci + (r.estimated ? ", estimated from MODIS" : "") +
          (r.provisional ? ", provisional (near real-time data)" : "");
      }
    });
    const ticks = years.map(function (y) {
      const est = rows.some((r) => r.estimated && Number(r.ym.slice(0, 4)) === y);
      const prov = rows.some((r) => r.provisional && Number(r.ym.slice(0, 4)) === y);
      return String(y) + (est ? " est." : "") + (prov ? " prov." : "");
    });
    const firstNative = rows.find((r) => !r.estimated);
    const shapes = [];
    if (firstNative && rows.some((r) => r.estimated)) {
      const r = yIdx.get(Number(firstNative.ym.slice(0, 4))), c = Number(firstNative.ym.slice(5, 7)) - 1;
      shapes.push({ type: "path", line: { color: "#d62728", width: 2, dash: "dash" },
        path: "M -0.5 " + (r + 0.5) + " L " + (c - 0.5) + " " + (r + 0.5) + " L " + (c - 0.5) + " " + (r - 0.5) + " L 11.5 " + (r - 0.5) });
    }
    const traces = [
      { type: "heatmap", z: mask, x: MONTHS, y: years.map(String), text: text, hoverinfo: "text", showscale: false,
        colorscale: [[0, "#9e9e9e"], [1, "#9e9e9e"]], zmin: 0, zmax: 1, xgap: 1, ygap: 1 },
      { type: "heatmap", z: z, x: MONTHS, y: years.map(String), text: text, hoverinfo: "text", colorscale: "Viridis",
        reversescale: true, xgap: 1, ygap: 1, colorbar: { title: { text: unit } } },
    ];
    const layout = {
      margin: { l: 80, r: 10, t: 10, b: 40 }, shapes: shapes,
      xaxis: { side: "top", fixedrange: true },
      yaxis: { type: "category", autorange: "reversed", tickvals: years.map(String), ticktext: ticks, fixedrange: true },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: LunaxTheme.text() },
      height: Math.max(360, years.length * 22 + 80),
    };
    return Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: false });
  }
  window.LunaxTheme = {
    text: function () { return getComputedStyle(document.body).color; },
    grid: function () { return "rgba(128,128,128,0.35)"; },
  };
  window.LunaxCalendar = { render: render };
})();
