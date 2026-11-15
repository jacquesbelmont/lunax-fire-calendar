/*
 * Purpose: downloads: CSV of the selected area/period (FIRMS attribution and data cut-off date inside the file) and chart PNG.
 * SCOPE: R8, R9
 * Owner issue: JA-6
 * AI-assisted code (Claude Code); logged in AI_USE.md.
 */
(function () {
  "use strict";
  function saveText(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function seriesFile(meta, rows, label) {
    saveText("lunax_area_series.csv", LunaxCalc.seriesCsv(meta, rows.filter((r) => r.inRange), label));
  }

  /** One row per selected cell and month inside the period (empty = no data). */
  function cellsFile(meta, data, sel, fromIdx, toIdx, label) {
    const c = data.columns, nM = data.nMonths, f = LunaxCalc.fmt;
    const lines = ["# " + meta.title, "# Area: " + label, "# Data cut-off date: " + meta.data_cutoff_date + " (" + meta.archived + ")",
      "# " + meta.attribution, "# Disclaimer: " + meta.disclaimer_url,
      "# Empty value = no data (never zero fire). estimated=1: converted from MODIS. Raw sensor columns are never to be summed across MODIS and VIIRS.",
      "cell_id,cell_lat,cell_lon,year_month,viirs_eq,viirs_eq_var,estimated,terra,aqua,snpp,noaa20"];
    sel.forEach(function (i) {
      for (let m = fromIdx; m <= toIdx; m++) {
        const k = i * nM + m, cell = data.cells[i];
        lines.push([cell.id, cell.lat, cell.lon, data.months[m], f(c.viirs_eq[k], 3), f(c.viirs_eq_var[k], 3), data.estimated[k],
          f(c.terra[k], 0), f(c.aqua[k], 0), f(c.snpp[k], 0), f(c.noaa20[k], 0)].join(","));
      }
    });
    saveText("lunax_cells_monthly.csv", lines.join("\n") + "\n");
  }

  function hotspotsFile(meta, header, lines, label, fromYm, toYm) {
    saveText("lunax_hotspots.csv", LunaxCalc.hotspotsCsv(meta, header, lines, label, fromYm, toYm));
  }

  function png(el, name) {
    return Plotly.downloadImage(el, { format: "png", filename: name, width: 1200, height: 800 });
  }
  window.LunaxExport = { seriesFile: seriesFile, cellsFile: cellsFile, hotspotsFile: hotspotsFile, png: png };
})();
