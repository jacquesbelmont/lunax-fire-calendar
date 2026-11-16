/*
 * Purpose: RA-11 Brazil pilot (issue #66), local only: where the area packs are, the place list for the search, the
 *          national level's map layer (the 27 states colored like cells; a click opens a state) and, at the state level,
 *          the neighbouring states as clickable outlines. The packs are written
 *          by pipeline/pilot_packs.py into data/pilot/brazil/ (git-ignored); without them nothing of this appears, so the
 *          published app is unchanged.
 * SCOPE: none in the hackathon scope (post-submission exploration, RA-11; DE-31 PROPOSED)
 * Owner issue: RA-11
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const PILOT = "../data/pilot/brazil/";
  let layer = null, neighbors = null, statesGeo = null, seq = 0;

  /** Pane above the points canvas (450), which would otherwise take the clicks. */
  function pane(map) {
    if (!map.getPane("brazil")) map.createPane("brazil").style.zIndex = 460;
    return "brazil";
  }

  /** True when the pilot packs are served next to the app (serve the repository root, open /docs/). */
  async function available() {
    try { return (await fetch(PILOT + "places.json", { method: "HEAD" })).ok; } catch (e) { return false; }
  }

  async function places() {
    return (await fetch(PILOT + "places.json")).json();
  }

  /** Pack of a state (two-letter code): Rondonia keeps the published, validated pack. */
  const stateBase = (uf) => (uf === "RO" ? "data/" : PILOT + uf + "/");

  /** National level: the states colored by byCode (code -> {color, tip}); click(code) opens a state. */
  function showUnits(map, geo, byCode, click) {
    hide(map);
    layer = L.geoJSON(geo, {
      pane: pane(map),
      style: (ft) => ({ color: "#333", weight: 1, fillOpacity: 0.75, className: "br-state br-" + ft.properties.code,
        fillColor: (byCode.get(ft.properties.code) || {}).color || "#9e9e9e" }),
      onEachFeature: (ft, lyr) => {
        lyr.bindTooltip(((byCode.get(ft.properties.code) || {}).tip || ft.properties.name) + " - click to open");
        lyr.on("click", () => click(ft.properties.code));
      },
    }).addTo(map);
  }

  function hide(map) {
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    layer = null;
  }

  /** State level: the other states as a faint outline; a click opens one (change state without leaving the map). */
  async function showNeighbors(map, code, click) {
    const t = ++seq;
    removeNeighbors(map);
    statesGeo = statesGeo || await (await fetch(PILOT + "BR/units.geojson")).json();
    if (t !== seq) return; // another state was opened meanwhile
    neighbors = L.geoJSON(statesGeo, {
      pane: pane(map),
      filter: (ft) => ft.properties.code !== code,
      style: (ft) => ({ color: "#555", weight: 1, dashArray: "4 3", fillColor: "#555", fillOpacity: 0.04, className: "br-neighbor br-n-" + ft.properties.code }),
      onEachFeature: (ft, lyr) => {
        lyr.bindTooltip((ft.properties.full_name ? ft.properties.full_name + " (" + ft.properties.name + ")" : ft.properties.name) + " - click to open");
        lyr.on("click", () => click(ft.properties.code));
      },
    }).addTo(map);
  }

  function removeNeighbors(map) {
    if (neighbors && map.hasLayer(neighbors)) map.removeLayer(neighbors);
    neighbors = null;
  }

  function hideNeighbors(map) {
    seq++; // a showNeighbors still loading must not add them afterwards
    removeNeighbors(map);
  }

  /** DE-37: code of the state that holds (lon, lat), or null outside Brazil. */
  async function stateAt(lon, lat) {
    statesGeo = statesGeo || await (await fetch(PILOT + "BR/units.geojson")).json();
    const st = LunaxCalc.parseMunicipalities(statesGeo).find((s) => LunaxCalc.insideParts(lon, lat, s.parts));
    return st ? st.code : null;
  }

  window.LunaxBrazil = { available: available, places: places, stateBase: stateBase, NATIONAL: PILOT + "BR/", showUnits: showUnits, hide: hide,
    showNeighbors: showNeighbors, hideNeighbors: hideNeighbors, stateAt: stateAt };
})();
