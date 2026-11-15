/*
 * Purpose: one calendar month across years against its historical median (anomaly). Text and bar chart.
 * SCOPE: R5, R7, O3
 * Owner issue: JA-6
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /** rows as in calendar.js plus median, nYears, diff, ratio. monthNo: 1..12. */
  function render(el, textEl, rows, monthNo, unit) {
    const mm = String(monthNo).padStart(2, "0");
    const mine = rows.filter((r) => r.ym.slice(5, 7) === mm && r.inRange);
    const last = [...mine].reverse().find((r) => !Number.isNaN(r.value));
    const f = LunaxCalc.fmt;
    if (!last) {
      textEl.textContent = "No data for " + MONTH_NAMES[monthNo - 1] + " in this area and period.";
    } else {
      const noun = Math.round(last.value) === 1 ? unit.replace(/s$/, "") : unit;
      let s = "Latest " + MONTH_NAMES[monthNo - 1] + " in the data (" + last.ym.slice(0, 4) + "): " + f(last.value, 0) + " " + noun;
      if (Number.isNaN(last.median)) s += ". No earlier year to compare with.";
      else {
        s += ", compared with a historical median of " + f(last.median, 0) + " (" + last.nYears + " earlier years)";
        s += ": " + (last.diff >= 0 ? "+" : "") + f(last.diff, 0);
        if (!Number.isNaN(last.ratio)) s += " (" + f(last.ratio, 2) + " times the median)";
        s += ".";
      }
      textEl.textContent = s + (last.estimated ? " This month is estimated from MODIS." : "");
    }
    const withData = mine.filter((r) => !Number.isNaN(r.value));
    const traces = [{
      type: "bar", x: withData.map((r) => r.ym.slice(0, 4)), y: withData.map((r) => r.value),
      marker: { color: withData.map((r) => (r.estimated ? "#9ecae1" : "#0b5cad")) },
      error_y: { type: "data", visible: true, array: withData.map((r) => (Number.isNaN(r.hi) ? 0 : r.hi - r.value)), color: "#555" },
      hovertext: withData.map((r) => r.ym + ": " + f(r.value, 0) + " " + unit + (r.estimated ? " (estimated from MODIS)" : "")),
      hoverinfo: "text", name: "Monthly value",
    }];
    const shapes = [];
    if (last && !Number.isNaN(last.median)) {
      shapes.push({ type: "line", xref: "paper", x0: 0, x1: 1, y0: last.median, y1: last.median, line: { color: "#d62728", dash: "dash", width: 2 } });
    }
    const layout = { margin: { l: 60, r: 10, t: 10, b: 40 }, shapes: shapes, showlegend: false,
      xaxis: { type: "category", title: { text: "Year" } },
      yaxis: { title: { text: unit } }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", height: 320,
      font: { color: LunaxTheme.text() } };
    layout.xaxis.gridcolor = layout.yaxis.gridcolor = LunaxTheme.grid();
    return Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: false });
  }
  window.LunaxCompare = { render: render };
})();
