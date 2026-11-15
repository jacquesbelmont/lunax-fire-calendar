/*
 * Purpose: outlook for the next fire season of the selected area (DE-28, PROPOSED): the August-October hotspots
 *          forecast with the method chosen by the pre-registered test (metadata.json "outlook"), an empirical 80 %
 *          range from the area's own past errors, and a chart of past forecasts against what happened.
 * SCOPE: proposed O5 (experimental outlook), pending team approval
 * Owner issue: RA-9 (#59)
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const LABEL = { C: "the median of the earlier years' August-October", P: "the previous year's August-October",
    P3: "the median of the previous 3 years' August-October" };

  /** rows as in calendar.js (whole series of the selected area); outlook: metadata.json "outlook". */
  function render(el, textEl, rows, outlook) {
    const totals = LunaxCalc.seasonTotals(rows), f = LunaxCalc.fmt, m = outlook.pre_season.chosen;
    const next = Number(rows[rows.length - 1].ym.slice(0, 4)) + 1, t0 = outlook.test_years[0], t1 = outlook.test_years[1];
    const forecast = LunaxCalc.outlookForecast(totals, next, m);
    const past = LunaxCalc.outlookErrors(totals, [m], t0, t1), errs = past.map((e) => e.errors[0]);
    const range = errs.length >= 8 ? [LunaxCalc.quantile(errs, 0.1), LunaxCalc.quantile(errs, 0.9)]
      .map((q) => Math.max(0, (forecast + 1) * Math.exp(q) - 1)) : null;
    const male = outlook.pre_season.test.male, factor = (x) => "x" + Math.exp(x).toFixed(1);
    const prov = rows.some((r) => r.provisional && r.ym.startsWith(String(next - 1)));
    textEl.textContent = Number.isNaN(forecast) ? "Not enough data in this area for an outlook of " + next + "." :
      "Outlook for August-October " + next + " (experimental): about " + f(forecast, 0) + " hotspots" +
      (range ? " (80% of past seasons of this area fell between " + f(range[0], 0) + " and " + f(range[1], 0) + " for such a forecast)" : "") +
      ". Method: " + LABEL[m] + (m !== "C" && prov ? " (" + (next - 1) + " is provisional)" : "") +
      ". In a test fixed in advance on the 52 municipalities, " + t0 + "-" + t1 + ", it missed by a typical factor of " + factor(male[m]) +
      ", against " + factor(male.C) + " for the median of the earlier years. Updating it with January-July did not help enough in that test (" +
      (100 * (1 - outlook.early_season.test.male.R / outlook.early_season.test.male.C)).toFixed(1) + "% smaller error, short of the 10% required), so the outlook is not updated during the year. It says how much, not where.";
    const years = past.map((e) => e.year), obsYears = Object.keys(totals).map(Number).filter((y) => y >= t0 && !Number.isNaN(totals[y].T));
    const traces = [
      { type: "bar", name: "Observed", x: obsYears.map(String), y: obsYears.map((y) => totals[y].T), marker: { color: "#9ecae1" },
        hovertext: obsYears.map((y) => y + ": " + f(totals[y].T, 0) + " hotspots observed in Aug-Oct"), hoverinfo: "text" },
      { type: "scatter", mode: "markers", name: "Forecast", x: years.map(String).concat(Number.isNaN(forecast) ? [] : [String(next)]),
        y: past.map((e) => e.forecasts[0]).concat(Number.isNaN(forecast) ? [] : [forecast]),
        marker: { color: "#d62728", size: 9, symbol: "diamond" }, hoverinfo: "text",
        hovertext: past.map((e) => e.year + ": forecast " + f(e.forecasts[0], 0) + ", observed " + f(e.observed, 0)).concat([next + ": forecast " + f(forecast, 0)]),
        error_y: range ? { type: "data", symmetric: false, array: past.map(() => 0).concat([range[1] - forecast]),
          arrayminus: past.map(() => 0).concat([forecast - range[0]]), color: "#d62728" } : undefined },
    ];
    const layout = { margin: { l: 60, r: 10, t: 10, b: 40 }, height: 320, barmode: "overlay",
      legend: { orientation: "h", y: 1.12 }, xaxis: { type: "category", gridcolor: LunaxTheme.grid() },
      yaxis: { title: { text: "hotspots, Aug-Oct" }, gridcolor: LunaxTheme.grid() },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: LunaxTheme.text() } };
    return Plotly.react(el, traces, layout, { responsive: true, displaylogo: false, displayModeBar: false });
  }
  window.LunaxOutlook = { render: render };
})();
