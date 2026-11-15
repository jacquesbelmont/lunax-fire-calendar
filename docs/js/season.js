/*
 * Purpose: fire season of the selected area (DE-23): per year, the month in which 10 % of the year's harmonized
 *          hotspots is reached (start), the month in which 90 % is reached (end) and the month with the most hotspots
 *          (peak); a sentence with the typical season. Years whose result depends on missing months are not drawn.
 * SCOPE: R5, R6
 * Owner issue: RA-7
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /** rows as in calendar.js. */
  function render(el, textEl, rows) {
    const per = LunaxCalc.seasonByYear(rows), t = LunaxCalc.typicalSeason(per), name = (k) => NAMES[k - 1];
    let s = !t ? "No year has enough data to place the fire season." :
      "Typical fire season in this area (median of " + t.n + (t.n === 1 ? " year" : " years") + "): starts in " + name(t.start) +
      ", peaks in " + name(t.peak) + " and ends in " + name(t.end) + ". Earliest start: " + name(t.earliestStart) + " (" + t.nEarliest +
      " of " + t.n + "). Latest end: " + name(t.latestEnd) + " (" + t.nLatest + " of " + t.n + ").";
    const skipped = per.filter((k) => k.reason);
    if (skipped.length) s += " Not computed: " + skipped.map((k) => k.year + " (" + k.reason + ")").join(", ") + ".";
    textEl.textContent = s;

    const ok = per.filter((k) => k.start), x = [], y = [];
    ok.forEach(function (k) { x.push(k.start - 0.4, k.end + 0.4, null); y.push(String(k.year), String(k.year), null); });
    const traces = [
      { type: "scatter", mode: "lines", x: x, y: y, line: { color: "#0b5cad", width: 8 }, hoverinfo: "skip" },
      { type: "scatter", mode: "markers", x: ok.map((k) => k.peak), y: ok.map((k) => String(k.year)),
        marker: { color: "#d62728", size: 10, symbol: "diamond", line: { color: "#fff", width: 1 } }, hoverinfo: "text",
        text: ok.map((k) => k.year + ": starts " + MONTHS[k.start - 1] + ", peak " + MONTHS[k.peak - 1] + ", ends " + MONTHS[k.end - 1]) },
    ];
    const years = per.map((k) => String(k.year));
    const layout = {
      margin: { l: 60, r: 10, t: 40, b: 20 }, showlegend: false,
      xaxis: { range: [0.5, 12.5], tickvals: MONTHS.map((m, i) => i + 1), ticktext: MONTHS, side: "top", fixedrange: true, gridcolor: LunaxTheme.grid() },
      yaxis: { type: "category", categoryorder: "array", categoryarray: years, autorange: "reversed", fixedrange: true, gridcolor: LunaxTheme.grid() },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: LunaxTheme.text() },
      height: Math.max(300, years.length * 22 + 80),
    };
    return Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: false });
  }
  window.LunaxSeason = { render: render };
})();
