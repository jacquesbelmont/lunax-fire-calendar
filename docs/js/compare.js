/*
 * Purpose: one calendar month across years against its historical median (anomaly). Text and bar chart.
 *          DE-30: describes the focus month of the page (highlighted bar); a click on a bar makes that year's month
 *          the focus.
 * SCOPE: R5, R7, O3
 * Owner issue: JA-6, RA-10
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /** rows as in calendar.js plus median, nYears, diff, ratio; focus: row index; onYearClick(ym). */
  function render(el, textEl, rows, focus, unit, onYearClick) {
    const row = rows[focus], monthNo = Number(row.ym.slice(5, 7)), mm = row.ym.slice(5, 7), f = LunaxCalc.fmt;
    const mine = rows.filter((r) => r.ym.slice(5, 7) === mm && r.inRange);
    const latest = LunaxCalc.comparedMonthIndex(rows, monthNo) === focus;
    textEl.textContent = Number.isNaN(row.value) ? MONTH_NAMES[monthNo - 1] + " " + row.ym.slice(0, 4) + ": no data (not zero fire)." :
      LunaxCalc.monthComparisonText(row, MONTH_NAMES[monthNo - 1], unit, latest);
    const withData = mine.filter((r) => !Number.isNaN(r.value));
    const isFocus = withData.map((r) => r.ym === row.ym);
    const traces = [{
      type: "bar", x: withData.map((r) => r.ym.slice(0, 4) + (r.provisional ? " prov." : "")), y: withData.map((r) => r.value),
      marker: { color: withData.map((r) => (r.estimated ? "#9ecae1" : "#0b5cad")), // DE-30: the focus month is outlined, as in the calendar
        line: { color: LunaxTheme.text(), width: isFocus.map((x) => (x ? 3 : 0)) } },
      error_y: { type: "data", visible: true, array: withData.map((r) => (Number.isNaN(r.hi) ? 0 : r.hi - r.value)), color: "#555" },
      hovertext: withData.map((r) => r.ym + ": " + f(r.value, 0) + " " + unit + (r.estimated ? " (estimated from MODIS)" : "") +
        (r.provisional ? " (provisional)" : "") + " - click to focus this month"),
      hoverinfo: "text", name: "Monthly value",
    }];
    const shapes = [];
    if (!Number.isNaN(row.median)) {
      shapes.push({ type: "line", xref: "paper", x0: 0, x1: 1, y0: row.median, y1: row.median, line: { color: "#d62728", dash: "dash", width: 2 } });
    }
    const layout = { margin: { l: 60, r: 10, t: 10, b: 40 }, shapes: shapes, showlegend: false,
      xaxis: { type: "category", automargin: true, title: { text: MONTH_NAMES[monthNo - 1] + ", by year", standoff: 12 } },
      yaxis: { title: { text: unit } }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", height: 320,
      font: { color: LunaxTheme.text() } };
    layout.xaxis.gridcolor = layout.yaxis.gridcolor = LunaxTheme.grid();
    return Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: false }).then(function () {
      el.removeAllListeners("plotly_click");
      el.on("plotly_click", (ev) => onYearClick(ev.points[0].x.slice(0, 4) + "-" + mm));
    });
  }
  window.LunaxCompare = { render: render };
})();
