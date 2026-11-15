/*
 * Purpose: map with the study-area boundary, rectangle drawing, and the selected grid cells colored by the value of
 *          the month shown in the comparison (same numbers and color ramp as the calendar). No data = grey, never zero.
 * SCOPE: R4, O1, O2
 * Owner issue: JA-5
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const NO_DATA = "#9e9e9e";

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
    L.geoJSON(boundary, { style: { color: "#c0392b", weight: 2, fill: false } }).addTo(map);
    map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);

    const rectLayer = new L.FeatureGroup().addTo(map);
    const cellsLayer = L.layerGroup().addTo(map);
    const legend = legendControl().addTo(map);
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
        rectLayer.clearLayers();
        L.rectangle([[box[1], box[0]], [box[3], box[2]]], { color: "#0b5cad", weight: 2, fill: false }).addTo(rectLayer);
        cellsLayer.clearLayers();
        const half = cellSize / 2;
        cells.forEach(function (c, j) {
          const v = paint ? paint.values[j] : NaN;
          const color = Number.isNaN(v) ? NO_DATA : LunaxCalc.viridisReversed(v, paint.cap);
          L.rectangle([[c.lat - half, c.lon - half], [c.lat + half, c.lon + half]],
            { stroke: false, fillColor: color, fillOpacity: 0.75, interactive: false, className: "map-cell" }).addTo(cellsLayer);
        });
        renderLegend(legend.getContainer(), paint ? paint.legend : null);
      },
    };
  }
  window.LunaxMap = { create: create };
})();
