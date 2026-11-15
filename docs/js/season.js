/*
 * Purpose: fire season of the selected area (DE-23): per year, the month in which 10 % of the year's harmonized
 *          hotspots is reached (start), the month in which 90 % is reached (end) and the month with the most hotspots
 *          (peak). DE-30: the years are drawn on the calendar (calendar.js); this file gives the summary for the card
 *          and the sentence under the calendar.
 * SCOPE: R5, R6
 * Owner issue: RA-7, RA-10
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /** rows as in calendar.js. Returns {typical (LunaxCalc.typicalSeason or null), text}. */
  function summary(rows) {
    const per = LunaxCalc.seasonByYear(rows), t = LunaxCalc.typicalSeason(per), name = (k) => NAMES[k - 1];
    let s = !t ? "No year has enough data to place the fire season." :
      "Typical fire season in this area (median of " + t.n + (t.n === 1 ? " year" : " years") + "): starts in " + name(t.start) +
      ", peaks in " + name(t.peak) + " and ends in " + name(t.end) + ". Earliest start: " + name(t.earliestStart) + " (" + t.nEarliest +
      " of " + t.n + "). Latest end: " + name(t.latestEnd) + " (" + t.nLatest + " of " + t.n + ").";
    const skipped = per.filter((k) => k.reason);
    if (skipped.length) s += " Not computed: " + skipped.map((k) => k.year + " (" + k.reason + ")").join(", ") + ".";
    return { typical: t, text: s };
  }
  window.LunaxSeason = { summary: summary };
})();
