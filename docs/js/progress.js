/*
 * Purpose: DE-34 "Season so far": the running total of the focus year against the earlier years at the same month.
 * SCOPE: R5, R7, O3, O4. Owner issue: RA-12.
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ORD = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

  /** s: LunaxCalc.seasonSoFar result; unit: "hotspots". */
  function render(el, textEl, s, unit) {
    const f = (x) => Math.round(x).toLocaleString("en-US"), x = s.months.map((ym) => SHORT[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4));
    const label = s.start === 1 ? s.trackingYear : s.trackingYear + "-" + String(s.trackingYear + 1).slice(2);
    if (s.last < 0) {
      textEl.textContent = "Season so far: no data in " + s.months[0] + " (not zero fire).";
    } else {
      const v = s.current[s.last], m = s.median[s.last], cls = LunaxCalc.USUAL_CLASSES.find((c) => c[0] === LunaxCalc.usualClass(v, m));
      textEl.textContent = "Season so far (the tracking year starts in " + SHORT[s.start - 1] + ", after the quietest month): by the end of " +
        x[s.last] + ", " + f(v) + " " + unit + ". " + (s.nPast ? cls[2] + " (median of " + s.nPast + " earlier years " + f(m) +
        (Number.isNaN(s.lo[s.last]) ? "" : "; the middle 80% of them between " + f(s.lo[s.last]) + " and " + f(s.hi[s.last])) +
        "); " + ORD(s.rank) + " highest of " + (s.nPast + 1) + " years by this month." : "No earlier complete year to compare.");
    }
    const traces = [];
    if (s.nPast >= 5) {
      traces.push({ x: x, y: s.lo, mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
        { x: x, y: s.hi, mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(127,127,127,0.25)", name: "Middle 80% of earlier years",
          hovertemplate: "%{x}: 90th percentile %{y:,.0f}<extra></extra>" });
    }
    if (s.nPast) traces.push({ x: x, y: s.median, mode: "lines", line: { color: "#d62728", dash: "dash", width: 2 }, name: "Median of earlier years",
      hovertemplate: "%{x}: median %{y:,.0f}<extra></extra>" });
    traces.push({ x: x.slice(0, s.current.length), y: s.current, mode: "lines+markers", line: { color: "#0b5cad", width: 3 }, name: String(label),
      hovertemplate: "%{x}: %{y:,.0f} " + unit + " so far<extra></extra>" });
    const layout = { margin: { l: 60, r: 30, t: 10, b: 40 }, height: 300, // r: room for the last slanted month label paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: { type: "category" }, yaxis: { title: { text: unit + " so far" }, rangemode: "tozero" },
      legend: { orientation: "h", y: -0.2 }, font: { color: LunaxTheme.text() } };
    layout.xaxis.gridcolor = layout.yaxis.gridcolor = LunaxTheme.grid();
    return Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: false });
  }
  window.LunaxProgress = { render: render };
})();
