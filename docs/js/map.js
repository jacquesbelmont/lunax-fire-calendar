/*
 * Purpose: map with the study-area boundary, rectangle drawing, the selected grid cells colored by the value of one
 *          month (same numbers and color ramp as the calendar; no data = grey, never zero), and the detections of that
 *          month as points, grouped per sensor until zoomed in (DE-21; Leaflet.markercluster, docs/lib/README.md).
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

  /** legend: {title, status, cap, unit} or null to hide. Built with textContent only. */
  function renderLegend(div, legend) {
    div.replaceChildren();
    div.hidden = !legend;
    if (!legend) return;
    const title = document.createElement("strong");
    title.textContent = legend.title;
    const status = document.createElement("div");
    status.textContent = legend.status;
    const bar = document.createElement("div");
    bar.className = "map-legend-bar";
    bar.style.background = LunaxCalc.viridisReversedGradient();
    const scale = document.createElement("div");
    scale.className = "map-legend-scale";
    const lo = document.createElement("span"), hi = document.createElement("span");
    lo.textContent = "0"; hi.textContent = LunaxCalc.fmt(legend.cap, 0) + "+ " + legend.unit;
    scale.append(lo, hi);
    const grey = document.createElement("div");
    const sw = document.createElement("span");
    sw.className = "map-legend-swatch";
    sw.style.background = NO_DATA;
    grey.append(sw, document.createTextNode(" no data (not zero)"));
    div.append(title, status, bar, scale, grey);
  }

  function create(elId, boundary, bbox, cellSize, onRectangle) {
    const map = L.map(elId);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const boundaryLayer = L.geoJSON(boundary, { style: { color: "#c0392b", weight: 2, fill: false } }).addTo(map);
    map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);

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
    L.control.layers(null, { "Cells: hotspots per cell": cellsLayer, "Points: detections": pointsLayer }, { position: "topright" }).addTo(map);
    map.addControl(new L.Control.Draw({
      draw: { polyline: false, polygon: false, circle: false, marker: false, circlemarker: false, rectangle: { shapeOptions: { color: "#0b5cad" } } },
      edit: false,
    }));
    map.on(L.Draw.Event.CREATED, function (e) {
      const b = e.layer.getBounds();
      onRectangle([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    });

    return {
      /**
       * cells: selected cells; paint: null (empty selection) or {values: [number per cell, NaN = no data], cap, legend}.
       */
      showSelection: function (box, cells, paint) {
        cellsLayer.clearLayers();
        const half = cellSize / 2;
        cells.forEach(function (c, j) {
          const v = paint ? paint.values[j] : NaN;
          const color = Number.isNaN(v) ? NO_DATA : LunaxCalc.viridisReversed(v, paint.cap);
          L.rectangle([[c.lat - half, c.lon - half], [c.lat + half, c.lon + half]],
            { stroke: false, fillColor: color, fillOpacity: 0.75, interactive: false, className: "map-cell" }).addTo(cellsLayer);
        });
        boundaryLayer.bringToFront(); // boundary and selection outline above the cells
        rectLayer.clearLayers();
        L.rectangle([[box[1], box[0]], [box[3], box[2]]], { color: "#0b5cad", weight: 2, fill: false }).addTo(rectLayer);
        renderLegend(legend.getContainer(), paint ? paint.legend : null);
      },
      /** points: [{lat, lon, sensor}] of the map month. */
      showPoints: function (points) {
        Object.keys(groups).forEach(function (s) {
          groups[s].clearLayers();
          // white outline: the points stay visible on any cell color
          groups[s].addLayers(points.filter((p) => p.sensor === s).map((p) => L.circleMarker([p.lat, p.lon], { renderer: canvas,
            radius: s === "MODIS" ? 3 : 2, color: "#fff", weight: 0.5, fillColor: SENSOR_COLORS[s], fillOpacity: 1, interactive: false })));
        });
      },
    };
  }
  window.LunaxMap = { create: create };
})();
