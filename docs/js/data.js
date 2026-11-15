/*
 * Purpose: load and parse the files of docs/data/ (DATA_CONTRACT.md); nothing else feeds the app.
 * SCOPE: R1, R2
 * Owner issue: JA-5
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  async function fetchOk(url, kind) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Could not load " + url + " (" + resp.status + "). Serve docs/ over http, not file://.");
    return kind === "json" ? resp.json() : resp.text();
  }

  async function loadAll() {
    const meta = await fetchOk("data/metadata.json", "json");
    const [boundary, csv, monthsCsv] = await Promise.all([
      fetchOk("data/" + (meta.area.boundary_file || "area.geojson"), "json"),
      fetchOk("data/monthly_cells.csv", "text"),
      fetchOk("data/months.csv", "text"),
    ]);
    const data = LunaxCalc.parseCellsCsv(csv, meta.grid.cell_size_deg);
    data.provisional = LunaxCalc.provisionalMonths(monthsCsv);
    return { meta: meta, boundary: boundary, data: data };
  }
  window.LunaxData = { loadAll: loadAll };
})();
