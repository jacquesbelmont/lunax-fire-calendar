/*
 * Purpose: map with the study-area boundary, rectangle drawing, and the selected grid cells.
 * SCOPE: R4, O1
 * Owner issue: JA-5
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  function create(elId, boundary, bbox, cellSize, onRectangle) {
    const map = L.map(elId);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    L.geoJSON(boundary, { style: { color: "#c0392b", weight: 2, fill: false } }).addTo(map);
    map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);

    const rectLayer = new L.FeatureGroup().addTo(map);
    const cellsLayer = L.layerGroup().addTo(map);
    map.addControl(new L.Control.Draw({
      draw: { polyline: false, polygon: false, circle: false, marker: false, circlemarker: false, rectangle: { shapeOptions: { color: "#0b5cad" } } },
      edit: false,
    }));
    map.on(L.Draw.Event.CREATED, function (e) {
      const b = e.layer.getBounds();
      onRectangle([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    });

    return {
      showSelection: function (box, cells) {
        rectLayer.clearLayers();
        L.rectangle([[box[1], box[0]], [box[3], box[2]]], { color: "#0b5cad", weight: 2, fill: false }).addTo(rectLayer);
        cellsLayer.clearLayers();
        const half = cellSize / 2;
        cells.forEach(function (c) {
          L.rectangle([[c.lat - half, c.lon - half], [c.lat + half, c.lon + half]],
            { stroke: false, fillColor: "#0b5cad", fillOpacity: 0.25, interactive: false }).addTo(cellsLayer);
        });
      },
    };
  }
  window.LunaxMap = { create: create };
})();
