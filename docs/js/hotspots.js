/*
 * Purpose: load only the hotspot files of the chosen period (docs/data/hotspots/), keep the rows of the selected cells,
 *          and report the number of rows before the user downloads them (R9, DE-17).
 * SCOPE: R9
 * Owner issue: JA-6
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  const MAX_ROWS = 1000000; // above this the browser may run out of memory: ask for a smaller area or period

  async function loadIndex(base) {
    const resp = await fetch((base || "data/") + "hotspots/index.json");
    if (!resp.ok) throw new Error("The hotspot files are not available in this version.");
    return resp.json();
  }

  async function gunzipText(url) {
    let resp = null;
    for (let attempt = 0; attempt < 3; attempt++) { // a static host can answer 503 for a moment: try twice more before failing
      if (attempt) await new Promise((r) => setTimeout(r, 1000 * attempt));
      try { resp = await fetch(url); } catch (e) { resp = null; } // network error
      if (resp && resp.status < 500) break;
    }
    if (!resp) throw new Error("Could not load " + url + " (network error).");
    if (!resp.ok) throw new Error("Could not load " + url + " (" + resp.status + ").");
    const stream = resp.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }

  /** Files whose year overlaps [fromYm, toYm]. */
  function filesFor(index, fromYm, toYm) {
    const y0 = Number(fromYm.slice(0, 4)), y1 = Number(toYm.slice(0, 4));
    return index.files.filter((f) => f.year >= y0 && f.year <= y1);
  }

  /** Returns {header, lines, files, bytes}; throws if more than MAX_ROWS rows match. onProgress(done, total). */
  async function load(index, cellIds, fromYm, toYm, onProgress, base) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack the hotspot files. Use a recent browser.");
    const files = filesFor(index, fromYm, toYm), cellSet = new Set(cellIds), out = { header: null, lines: [] };
    let done = 0;
    for (const f of files) {
      onProgress(done, files.length);
      LunaxCalc.filterHotspots(await gunzipText((base || "data/") + "hotspots/" + f.file), cellSet, fromYm, toYm, out);
      if (out.lines.length > MAX_ROWS) throw new Error("More than " + MAX_ROWS.toLocaleString("en-US") + " hotspots match. Choose a smaller area or period.");
      done++;
    }
    onProgress(done, files.length);
    return { header: out.header, lines: out.lines, files: files.length, bytes: files.reduce((s, f) => s + f.bytes, 0) };
  }

  /** DE-37: the rows of the selected cells, one yearly file at a time (nothing kept, so no row limit): fn(header, lines). */
  async function eachFile(index, cellIds, onProgress, base, fn) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack the hotspot files. Use a recent browser.");
    const cellSet = new Set(cellIds);
    for (let k = 0; k < index.files.length; k++) {
      onProgress(k, index.files.length);
      const out = { header: null, lines: [] };
      LunaxCalc.filterHotspots(await gunzipText((base || "data/") + "hotspots/" + index.files[k].file), cellSet, "0000-00", "9999-99", out);
      fn(out.header, out.lines);
    }
    onProgress(index.files.length, index.files.length);
  }

  window.LunaxHotspots = { loadIndex: loadIndex, load: load, filesFor: filesFor, eachFile: eachFile };
})();
