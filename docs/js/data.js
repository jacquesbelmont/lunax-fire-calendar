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

  /**
   * Load one area pack (RA-11): "data/" is the published Rondonia pack; a Brazil pilot pack (local) has the same files.
   * A national pack (metadata area.level "national") has units.csv and units.geojson (the states) instead of cells.
   */
  async function loadAll(base) {
    base = base || "data/";
    const meta = await fetchOk(base + "metadata.json", "json");
    const national = meta.area.level === "national";
    const [boundary, csv, monthsCsv, muniCsv, muniGeo] = await Promise.all([
      fetchOk(base + (meta.area.boundary_file || "area.geojson"), "json"),
      fetchOk(base + (national ? "units.csv" : "monthly_cells.csv"), "text"),
      fetchOk(base + "months.csv", "text"),
      national ? null : fetchOk(base + "municipalities.csv", "text"), // DE-24
      fetchOk(base + (national ? "units.geojson" : "municipalities.geojson"), "json"),
    ]);
    const data = LunaxCalc.parseCellsCsv(csv, meta.grid.cell_size_deg, national ? "area_id" : "cell_id");
    data.provisional = LunaxCalc.provisionalMonths(monthsCsv);
    const muniData = national ? data : LunaxCalc.parseCellsCsv(muniCsv, meta.grid.cell_size_deg, "area_id");
    if (muniData.months.join() !== data.months.join()) throw new Error("municipalities.csv and monthly_cells.csv have different months");
    muniData.provisional = data.provisional;
    return { meta: meta, boundary: boundary, data: data, muniData: muniData, muniGeo: muniGeo, munis: LunaxCalc.parseMunicipalities(muniGeo),
             base: base, national: national };
  }
  window.LunaxData = { loadAll: loadAll };
})();
