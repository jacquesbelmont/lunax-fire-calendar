/*
 * Purpose: NASA GIBS satellite imagery for the map (DE-27): which daily image (satellite, true or false color) is shown
 *          for a day, its tile URL, and the default day of the map month. Pure functions, tested in Node.
 * SCOPE: R5, O4
 * Owner issue: JA-11 (#57)
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LunaxImagery = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/";
  // Start dates from the GIBS WMTS capabilities (https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml,
  // checked 2026-11-15): Suomi NPP corrected reflectance from 2015-11-24; NOAA-20 from 2018-01-05, used from 2018-04-01 as in DE-11.
  var SNPP_FROM = "2015-11-24", NOAA20_FROM = "2018-04-01";
  var SATELLITES = {
    terra: { name: "Terra MODIS", trueColor: "MODIS_Terra_CorrectedReflectance_TrueColor",
             falseColor: "MODIS_Terra_CorrectedReflectance_Bands721", falseBands: "bands 7-2-1" },
    snpp: { name: "Suomi NPP VIIRS", trueColor: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
            falseColor: "VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1", falseBands: "bands M11-I2-I1" },
    noaa20: { name: "NOAA-20 VIIRS", trueColor: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
              falseColor: "VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1", falseBands: "bands M11-I2-I1" },
  };
  var MAX_NATIVE_ZOOM = 9; // GoogleMapsCompatible_Level9: GIBS answers HTTP 400 above zoom 9 (checked 2026-11-15)
  var BLUE_MARBLE_URL = BASE + "BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
  var BLUE_MARBLE_MAX_NATIVE_ZOOM = 8;
  var DEFAULT_DAY_OF_MONTH = "15"; // used when the map month has no detection in the selection
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  /** Satellite whose daily image is shown for day "YYYY-MM-DD" (ISO dates compare as strings). */
  function imagerySatellite(day) {
    if (day >= NOAA20_FROM) return SATELLITES.noaa20;
    if (day >= SNPP_FROM) return SATELLITES.snpp;
    return SATELLITES.terra;
  }

  /** kind: "trueColor" or "falseColor" (burn scars). Returns {layer, satellite, bands, url} for Leaflet's tileLayer. */
  function imageryLayer(day, kind) {
    if (!DAY_RE.test(day)) throw new Error("imagery: day must be YYYY-MM-DD, got " + day);
    if (kind !== "trueColor" && kind !== "falseColor") throw new Error("imagery: unknown kind " + kind);
    var sat = imagerySatellite(day), layer = sat[kind];
    return { layer: layer, satellite: sat.name, bands: kind === "trueColor" ? "true color" : "false color, " + sat.falseBands,
             url: BASE + layer + "/default/" + day + "/GoogleMapsCompatible_Level" + MAX_NATIVE_ZOOM + "/{z}/{y}/{x}.jpg" };
  }

  /** [first day, last day] of month "YYYY-MM". */
  function monthDays(ym) {
    var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
    var last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [ym + "-01", ym + "-" + String(last).padStart(2, "0")];
  }

  /** Default day of map month ym: the day with the most detections among points [{date}] (earlier day on a tie), else the 15th. */
  function defaultDay(ym, points) {
    var counts = new Map();
    points.forEach(function (p) {
      if (p.date.slice(0, 7) === ym) counts.set(p.date, (counts.get(p.date) || 0) + 1);
    });
    var best = null;
    Array.from(counts.keys()).sort().forEach(function (d) {
      if (best === null || counts.get(d) > counts.get(best)) best = d;
    });
    return best || ym + "-" + DEFAULT_DAY_OF_MONTH;
  }

  return {
    imagerySatellite: imagerySatellite, imageryLayer: imageryLayer, monthDays: monthDays, defaultDay: defaultDay,
    MAX_NATIVE_ZOOM: MAX_NATIVE_ZOOM, BLUE_MARBLE_URL: BLUE_MARBLE_URL, BLUE_MARBLE_MAX_NATIVE_ZOOM: BLUE_MARBLE_MAX_NATIVE_ZOOM,
    ATTRIBUTION: 'Imagery: <a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api">NASA EOSDIS GIBS</a>',
  };
});
