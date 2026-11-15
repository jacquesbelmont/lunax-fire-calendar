/*
 * Purpose: map with the study-area boundary, rectangle drawing, the selected grid cells colored by the value of one
 *          month (same numbers and color ramp as the calendar; no data = grey, never zero), and the detections of that
 *          month as points, grouped per sensor until zoomed in (DE-21; Leaflet.markercluster, docs/lib/README.md).
 *          Hover a cell for its value; click a detection for its date, time, satellite, confidence and FRP.
 *          DE-22: cells can instead be colored by "Compared with the usual" classes (colors and texts come from main.js);
 *          fullscreen button; the mouse wheel zooms only after a click on the map.
 *          DE-27: base layers from NASA GIBS (Blue Marble, and the true or false color image of one day, docs/js/imagery.js).
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

  /** DE-27: line naming the day and satellite of the GIBS image, with a day picker limited to the map month. textContent only. */
  function imageryControl(onDay) {
    const ctl = L.control({ position: "bottomleft" });
    ctl.onAdd = function () {
      const div = L.DomUtil.create("div", "map-legend map-imagery");
      div.id = "map-imagery";
      div.hidden = true;
      L.DomEvent.disableClickPropagation(div);
      const text = document.createElement("div"), label = document.createElement("label"), input = document.createElement("input");
      text.className = "map-imagery-text";
      input.type = "date";
      input.id = "imagery-day";
      label.append(document.createTextNode("Day of the image "), input);
      input.addEventListener("change", () => { if (input.value) onDay(input.value); });
      div.append(text, label);
      return div;
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
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    // DE-27: GIBS tiles stop at zoom 9 (Blue Marble 8); closer, Leaflet enlarges the last level.
    const gibsOpts = { maxZoom: 18, maxNativeZoom: LunaxImagery.MAX_NATIVE_ZOOM, attribution: LunaxImagery.ATTRIBUTION };
    const blueMarble = L.tileLayer(LunaxImagery.BLUE_MARBLE_URL, Object.assign({}, gibsOpts, { maxNativeZoom: LunaxImagery.BLUE_MARBLE_MAX_NATIVE_ZOOM }));
    const dayLayers = { trueColor: L.tileLayer("", gibsOpts), falseColor: L.tileLayer("", gibsOpts) }; // URL set with the day
    const muniLayer = L.geoJSON(muniGeo, { style: MUNI_STYLE }).addTo(map); // DE-24: municipal borders
    const boundaryLayer = L.geoJSON(boundary, { style: { color: "#c0392b", weight: 2, fill: false } }).addTo(map);
    map.fitBounds(boundaryLayer.getBounds()); // DE-22: the state, not the processing box

    const rectLayer = new L.FeatureGroup().addTo(map);
    const cellsLayer = L.layerGroup().addTo(map);
    const legend = legendControl().addTo(map);
    map.createPane("points").style.zIndex = 450; // above the cells (overlay pane, 400), below markers and popups
    map.createPane("recurrence").style.zIndex = 420; // DE-26 image, between the cells and the points
    let overlay = null, overlayTip = null;
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
    L.control.layers({ "Street map (OpenStreetMap)": osm, "NASA Blue Marble (no date)": blueMarble,
      "Satellite image of a day: true color": dayLayers.trueColor, "Satellite image of a day: false color (burn scars)": dayLayers.falseColor },
    { "Cells: hotspots per cell": cellsLayer, "Points: detections": pointsLayer, "Municipal borders": muniLayer },
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
      if (overlayTip) { // DE-26 view: text from the overlay's lookup
        const s = drawing ? null : overlayTip(e.latlng);
        if (s) { tip.setLatLng(e.latlng).setContent(s); map.openTooltip(tip); } else map.closeTooltip(tip);
        return;
      }
      const id = Math.floor((e.latlng.lat + 90) / cellSize) + "_" + Math.floor((e.latlng.lng + 180) / cellSize);
      const j = shown.byId.get(id), p = shown.paint;
      if (drawing || j === undefined || !p || !map.hasLayer(cellsLayer)) { map.closeTooltip(tip); return; }
      tip.setLatLng(e.latlng).setContent(p.tips[j]);
      map.openTooltip(tip);
    });
    // DE-27: day of the image. It follows the map month (busiest day) until the user picks a day or clicks a detection.
    const imagery = { ym: null, day: null, picked: false, kind: null, failed: false };
    const imageryCtl = imageryControl(function (day) { imagery.picked = true; setImageryDay(day); }).addTo(map);
    function renderImagery() {
      const div = imageryCtl.getContainer();
      div.hidden = !imagery.kind || !imagery.day;
      if (div.hidden) return;
      const info = LunaxImagery.imageryLayer(imagery.day, imagery.kind), input = div.querySelector("input");
      [input.min, input.max] = imagery.ym ? LunaxImagery.monthDays(imagery.ym) : ["", ""];
      input.value = imagery.day;
      div.querySelector(".map-imagery-text").textContent = "Satellite image of " + imagery.day + " (one day, UTC): " + info.satellite +
        ", " + info.bands + "." + (imagery.failed ? " GIBS has no image from this satellite for this day in part of the view." : "") +
        (map.getZoom() > LunaxImagery.MAX_NATIVE_ZOOM ? " Closer than zoom level 9 the image is only enlarged (about 300 m per pixel)." : "");
    }
    function setImageryDay(day) {
      Object.assign(imagery, { day: day, failed: false });
      Object.keys(dayLayers).forEach((k) => dayLayers[k].setUrl(LunaxImagery.imageryLayer(day, k).url, !map.hasLayer(dayLayers[k])));
      renderImagery();
    }
    Object.keys(dayLayers).forEach((k) => dayLayers[k].on("tileerror", function () {
      if (!imagery.failed) { imagery.failed = true; renderImagery(); }
    }));
    map.on("baselayerchange", function (e) {
      Object.assign(imagery, { kind: Object.keys(dayLayers).find((k) => dayLayers[k] === e.layer) || null, failed: false });
      renderImagery();
    });
    map.on("zoomend", renderImagery);

    Object.keys(groups).forEach(function (s) {
      groups[s].on("click", function (e) {
        imagery.picked = true;
        setImageryDay(e.layer.options.hotspot.date); // DE-27: the image of the detection's day
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
      /** DE-26: image over bounds [[south, west], [north, east]] with hover text tipFn(latlng) (null = no text). */
      showOverlay: function (url, bounds, tipFn) {
        if (overlay) overlay.remove();
        overlay = L.imageOverlay(url, bounds, { pane: "recurrence", className: "recurrence-overlay", opacity: 0.9 }).addTo(map);
        overlayTip = tipFn;
      },
      clearOverlay: function () {
        if (overlay) overlay.remove();
        overlay = null; overlayTip = null;
      },
      /** DE-25: re-fit the map to its container (the printed page is narrower than the screen). */
      invalidate: function () { map.invalidateSize({ animate: false }); },
      /** DE-27: map month ym (or null) and its points: the image day is their busiest day unless a day of ym was picked. */
      setImageryMonth: function (ym, points) {
        if (ym !== imagery.ym) imagery.picked = false;
        imagery.ym = ym;
        if (ym && !imagery.picked) setImageryDay(LunaxImagery.defaultDay(ym, points));
        else renderImagery();
      },
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
