/*
 * Purpose: map with the study-area boundary, rectangle drawing, the selected grid cells colored by the value of one
 *          month (same numbers and color ramp as the calendar; no data = grey, never zero), and the detections of that
 *          month as points, grouped per sensor until zoomed in (DE-21; Leaflet.markercluster, docs/lib/README.md).
 *          Hover a cell for its value; click a detection for its date, time, satellite, confidence and FRP.
 *          DE-22: cells can instead be colored by "Compared with the usual" classes (colors and texts come from main.js);
 *          fullscreen button; the mouse wheel zooms only after a click on the map.
 * SCOPE: R4, R5, O1, O2
 * Owner issue: JA-5
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const NO_DATA = "#9e9e9e";
  // Okabe-Ito colors (readable with color-vision deficiency); same values as .dot / .cluster in style.css.
  const SENSOR_COLORS = { MODIS: "#0072B2", VIIRS: "#D55E00" };

  function legendControl() {
    const ctl = L.control({ position: "bottomright" });
    ctl.onAdd = function () {
      const div = L.DomUtil.create("div", "map-legend");
      div.id = "map-legend";
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    return ctl;
  }

  function swatchRow(color, label) {
    const row = document.createElement("div"), sw = document.createElement("span");
    sw.className = "map-legend-swatch";
    sw.style.background = color;
    row.append(sw, document.createTextNode(" " + label));
    return row;
  }

  /** legend: {title, status, cap, unit}, or {title, status, classes: [[key, color, label]]} (DE-22), or null to hide. textContent only. */
  function renderLegend(div, legend) {
    div.replaceChildren();
    div.hidden = !legend;
    if (!legend) return;
    const title = document.createElement("strong");
    title.textContent = legend.title;
    const status = document.createElement("div");
    status.textContent = legend.status;
    if (legend.classes) {
      div.append(title, status, ...legend.classes.map((c) => swatchRow(c[1], c[2])));
      return;
    }
    const bar = document.createElement("div");
    bar.className = "map-legend-bar";
    bar.style.background = LunaxCalc.viridisReversedGradient();
    const scale = document.createElement("div");
    scale.className = "map-legend-scale";
    const lo = document.createElement("span"), hi = document.createElement("span");
    lo.textContent = "0"; hi.textContent = LunaxCalc.fmt(legend.cap, 0) + "+ " + legend.unit;
    scale.append(lo, hi);
    div.append(title, status, bar, scale, swatchRow(NO_DATA, "no data (not zero)"));
  }

  /** DE-22: fullscreen button (browser Fullscreen API); not added where the API is missing (e.g. iPhone Safari). */
  function fullscreenControl(map) {
    const ctl = L.control({ position: "topleft" });
    ctl.onAdd = function () {
      const b = L.DomUtil.create("button", "map-fullscreen");
      b.type = "button";
      b.textContent = "Full screen";
      L.DomEvent.disableClickPropagation(b);
      b.addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : map.getContainer().requestFullscreen()));
      document.addEventListener("fullscreenchange", function () {
        b.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
        map.invalidateSize();
      });
      return b;
    };
    return ctl;
  }

  const MUNI_STYLE = { color: "#555", weight: 0.7, opacity: 0.8, fill: false, interactive: false };

  function create(elId, boundary, muniGeo, cellSize, onRectangle) {
    // DE-22: the wheel zooms only after a click on the map, so scrolling the page does not zoom it by accident.
    const map = L.map(elId, { scrollWheelZoom: false });
    map.on("click focus", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => { if (!document.fullscreenElement) map.scrollWheelZoom.disable(); });
    if (document.fullscreenEnabled) fullscreenControl(map).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const muniLayer = L.geoJSON(muniGeo, { style: MUNI_STYLE }).addTo(map); // DE-24: municipal borders
    const boundaryLayer = L.geoJSON(boundary, { style: { color: "#c0392b", weight: 2, fill: false } }).addTo(map);
    map.fitBounds(boundaryLayer.getBounds()); // DE-22: the state, not the processing box

    const rectLayer = new L.FeatureGroup().addTo(map);
    const cellsLayer = L.layerGroup().addTo(map);
    const legend = legendControl().addTo(map);
    map.createPane("points").style.zIndex = 450; // above the cells (overlay pane, 400), below markers and popups
    const canvas = L.canvas({ padding: 0.5, pane: "points" }); // up to ~120,000 points in one month: canvas, not SVG
    // DE-21 grouping: one group per sensor, so a number is never MODIS plus VIIRS; groups split when zooming in.
    const groups = {};
    ["MODIS", "VIIRS"].forEach(function (s) {
      groups[s] = L.markerClusterGroup({ animate: false, chunkedLoading: true, showCoverageOnHover: false, spiderfyOnMaxZoom: false,
        maxClusterRadius: 40, disableClusteringAtZoom: 12, iconCreateFunction: function (c) {
          const n = c.getChildCount().toLocaleString("en-US");
          return L.divIcon({ html: n, className: "cluster " + s.toLowerCase(), iconSize: [16 + 7 * n.length, 20] });
        } });
    });
    const pointsLayer = L.layerGroup([groups.MODIS, groups.VIIRS]).addTo(map);
    L.control.layers(null, { "Cells: hotspots per cell": cellsLayer, "Points: detections": pointsLayer, "Municipal borders": muniLayer },
      { position: "topright" }).addTo(map);
    map.addControl(new L.Control.Draw({
      draw: { polyline: false, polygon: false, circle: false, marker: false, circlemarker: false, rectangle: { shapeOptions: { color: "#0b5cad" } } },
      edit: false,
    }));
    map.on(L.Draw.Event.CREATED, function (e) {
      const b = e.layer.getBounds();
      onRectangle([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    });

    // DE-21 interaction. Cells: the canvas of the points lies above them, so the cell under the mouse is found from the
    // position (cell_id formula of DATA_CONTRACT.md (a)) and its value is shown in one tooltip. Points: click for details.
    let shown = { byId: new Map(), paint: null }, drawing = false, selectedMuni = null;
    const tip = L.tooltip({ direction: "top", offset: [0, -6] });
    map.on(L.Draw.Event.DRAWSTART, () => { drawing = true; map.closeTooltip(tip); });
    map.on(L.Draw.Event.DRAWSTOP, () => { drawing = false; });
    map.on("mouseout", () => map.closeTooltip(tip));
    map.on("mousemove", function (e) {
      const id = Math.floor((e.latlng.lat + 90) / cellSize) + "_" + Math.floor((e.latlng.lng + 180) / cellSize);
      const j = shown.byId.get(id), p = shown.paint;
      if (drawing || j === undefined || !p || !map.hasLayer(cellsLayer)) { map.closeTooltip(tip); return; }
      tip.setLatLng(e.latlng).setContent(p.tips[j]);
      map.openTooltip(tip);
    });
    Object.keys(groups).forEach(function (s) {
      groups[s].on("click", function (e) {
        const box = document.createElement("div");
        box.textContent = LunaxCalc.hotspotPointText(e.layer.options.hotspot);
        L.popup().setLatLng(e.layer.getLatLng()).setContent(box).openOn(map);
      });
    });

    return {
      /**
       * box: rectangle outline or null (municipality mode); cells: cells to draw; paint: null (empty selection) or
       * {colors: [one per cell], tips: [hover text per cell], legend}.
       */
      showSelection: function (box, cells, paint) {
        shown = { byId: new Map(cells.map((c, j) => [c.id, j])), paint: paint };
        cellsLayer.clearLayers();
        const half = cellSize / 2;
        cells.forEach(function (c, j) {
          L.rectangle([[c.lat - half, c.lon - half], [c.lat + half, c.lon + half]],
            { stroke: false, fillColor: paint ? paint.colors[j] : NO_DATA, fillOpacity: 0.75, interactive: false, className: "map-cell" }).addTo(cellsLayer);
        });
        muniLayer.bringToFront();
        boundaryLayer.bringToFront(); // boundary and selection outline above the cells
        rectLayer.clearLayers();
        if (box) L.rectangle([[box[1], box[0]], [box[3], box[2]]], { color: "#0b5cad", weight: 2, fill: false }).addTo(rectLayer);
        if (selectedMuni) selectedMuni.bringToFront();
        renderLegend(legend.getContainer(), paint ? paint.legend : null);
      },
      /** DE-24: outline municipality k (index in municipalities.geojson) and zoom to it; null clears the outline. */
      highlightMunicipality: function (k) {
        muniLayer.setStyle(MUNI_STYLE);
        selectedMuni = k === null ? null : muniLayer.getLayers()[k];
        if (!selectedMuni) return;
        selectedMuni.setStyle({ color: "#0b5cad", weight: 3, opacity: 1 });
        selectedMuni.bringToFront();
        map.fitBounds(selectedMuni.getBounds());
      },
      /** DE-25: re-fit the map to its container (the printed page is narrower than the screen). */
      invalidate: function () { map.invalidateSize({ animate: false }); },
      /** points: [{lat, lon, sensor}] of the map month. */
      showPoints: function (points) {
        Object.keys(groups).forEach(function (s) {
          groups[s].clearLayers();
          // white outline: the points stay visible on any cell color
          groups[s].addLayers(points.filter((p) => p.sensor === s).map((p) => L.circleMarker([p.lat, p.lon], { renderer: canvas,
            radius: s === "MODIS" ? 3 : 2, color: "#fff", weight: 0.5, fillColor: SENSOR_COLORS[s], fillOpacity: 1,
            bubblingMouseEvents: false, hotspot: p })));
        });
      },
    };
  }
  window.LunaxMap = { create: create };
})();
