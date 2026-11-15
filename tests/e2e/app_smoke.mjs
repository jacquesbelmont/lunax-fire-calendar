// Browser smoke test of the published app (TI-8 automated part). Drives a real headless Chrome through the
// DevTools protocol: no extra packages. It checks the parts a person would click: area by coordinates, period,
// hotspot count, the CSV/PNG downloads (captured in the page, not saved), and the texts.
// Usage: node tests/e2e/app_smoke.mjs [URL]   (default: the GitHub Pages URL)
//   Node 22 or later (global WebSocket); on Node 20/21 run: node --experimental-websocket tests/e2e/app_smoke.mjs
//   Chrome: set CHROME to the binary if it is not found (Linux: google-chrome, chromium or /snap/bin/chromium).
// AI-assisted code (Claude Code and Codex); logged in AI_USE.md.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_ = process.argv[2] || "https://jacquesbelmont.github.io/lunax-fire-calendar/";
const CHROME = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"].find((p) => existsSync(p));
if (!CHROME) { console.error("Chrome not found: set CHROME to the browser binary."); process.exit(2); }
if (typeof WebSocket === "undefined") { console.error("No global WebSocket: use Node 22+, or node --experimental-websocket."); process.exit(2); }
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROFILE = mkdtempSync(join(tmpdir(), "lunax-e2e-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, "--window-size=1280,2000", "about:blank"], { stdio: "ignore" });

let ws, id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
async function evaluate(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("page error: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function waitFor(expr, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await evaluate(expr)) return; await sleep(500); }
  throw new Error("timeout waiting for: " + expr);
}

async function selectArea(west, south, east, north) {
  const coordinates = JSON.stringify({ w: west, s: south, e: east, n: north });
  await evaluate(`(() => {
    for (const [key, value] of Object.entries(${coordinates})) {
      document.getElementById('bbox-' + key).value = value;
    }
    document.querySelector('#bbox-form').dispatchEvent(new Event('submit', { cancelable: true }));
    return true;
  })()`);
}

const results = [];
function check(name, ok, detail) { results.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : "")); }

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch { await sleep(250); }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const errors = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result || {}); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL_ });
  await waitFor(`document.querySelector('#selection-info') && /grid cells selected/.test(document.querySelector('#selection-info').textContent)`);

  // Capture downloads inside the page instead of saving files.
  await evaluate(`window.__downloads = []; const _c = URL.createObjectURL; URL.createObjectURL = (b) => { window.__downloads.push(b); return _c(b); }; true`);

  const info0 = await evaluate(`document.querySelector('#selection-info').textContent`);
  check("page loads and selects the whole study area", /376 grid cells/.test(info0), info0.trim());
  check("archived-data label", /Archived data through 2026-10-31/.test(await evaluate(`document.querySelector('#archive-label').textContent`)));
  check("calendar drawn", await evaluate(`!!document.querySelector('#calendar .main-svg')`));
  check("comparison text names a provisional month", /provisional/.test(await evaluate(`document.querySelector('#compare-text').textContent`)),
    (await evaluate(`document.querySelector('#compare-text').textContent`)).slice(0, 90));

  const legend0 = await evaluate(`document.querySelector('#map-legend').textContent`);
  const cells0 = await evaluate(`document.querySelectorAll('#map path.map-cell').length`);
  check("map colors the 376 cells for the compared month (2026-10, provisional) with a legend", cells0 === 376 &&
    /Hotspots per cell, 2026-10/.test(legend0) && /Provisional/.test(legend0) && /no data/.test(legend0), cells0 + " cells; " + legend0.slice(0, 80));
  await evaluate(`(() => { const s = document.querySelector('#compare-month'); s.value = '9'; s.dispatchEvent(new Event('change')); return true; })()`);
  const legend9 = await evaluate(`document.querySelector('#map-legend').textContent`);
  check("map follows the comparison month (September)", /Hotspots per cell, 2026-09/.test(legend9), legend9.slice(0, 60));
  await evaluate(`(() => { const s = document.querySelector('#compare-month'); s.value = '10'; s.dispatchEvent(new Event('change')); return true; })()`);
  // DE-21 points: the detections of the same month, per sensor (never one total).
  await waitFor(`/Points: detections of 2026-10/.test(document.querySelector('#map-note').textContent)`);
  const note10 = await evaluate(`document.querySelector('#map-note').textContent`);
  const groups10 = await evaluate(`document.querySelectorAll('#map .cluster').length`);
  check("map points are the detections of the same month, per satellite, grouped; the note names the calendar's satellite",
    /NOAA-20 \(VIIRS\) [\d,]+/.test(note10) && /counts the NOAA-20 \(VIIRS\) detections only/.test(note10) && groups10 > 0,
    groups10 + " groups; " + note10.slice(0, 100));

  // DE-27: NASA GIBS image of one day as the base layer; the day is a day of the map month, the satellite NOAA-20 (from 2018-04).
  await evaluate(`(() => { const l = [...document.querySelectorAll('.leaflet-control-layers-base label')].find((x) => /true color/.test(x.textContent));
    l.querySelector('input').click(); return true; })()`);
  await waitFor(`[...document.querySelectorAll('#map img.leaflet-tile')].some((i) => i.src.includes('gibs.earthdata.nasa.gov') && i.complete && i.naturalWidth > 0)`, 30000);
  const imgText = await evaluate(`document.querySelector('#map-imagery').hidden ? '' : document.querySelector('#map-imagery').textContent`);
  check("satellite image of a day from NASA GIBS loads, with its day (map month) and satellite named on the map",
    /^Satellite image of 2026-10-\d\d \(one day, UTC\): NOAA-20 VIIRS, true color\./.test(imgText) &&
    await evaluate(`/^2026-10-\\d\\d$/.test(document.querySelector('#imagery-day').value) && document.querySelector('#imagery-day').min === '2026-10-01'`),
    imgText.slice(0, 90));
  await evaluate(`(() => { [...document.querySelectorAll('.leaflet-control-layers-base label')].find((x) => /OpenStreetMap/.test(x.textContent)).querySelector('input').click(); return true; })()`);

  // DE-22: "Compared with the usual" view of the same month, then back to the hotspots view.
  await evaluate(`(() => { const s = document.querySelector('#map-mode'); s.value = 'usual'; s.dispatchEvent(new Event('change')); return true; })()`);
  const legendU = await evaluate(`document.querySelector('#map-legend').textContent`);
  check("map view 'Compared with the usual' colors the same 376 cells with the DE-22 classes", /Compared with the usual, 2026-10/.test(legendU) &&
    /2 times usual or more/.test(legendU) && /Near usual/.test(legendU) && await evaluate(`document.querySelectorAll('#map path.map-cell').length`) === 376,
    legendU.slice(0, 90));
  // DE-26: places that burn year after year, a statewide image with its legend and the hindcast sentence.
  await evaluate(`(() => { const s = document.querySelector('#map-mode'); s.value = 'recurrence'; s.dispatchEvent(new Event('change')); return true; })()`);
  await waitFor(`!!document.querySelector('#map img.recurrence-overlay') && /not a forecast/.test(document.querySelector('#recurrence-note').textContent)`);
  const legendR = await evaluate(`document.querySelector('#map-legend').textContent`);
  check("map view 'Places that burn year after year' draws the 1 km layer with its legend and test result", /Places that burn year after year/.test(legendR) &&
    /10-13 years/.test(legendR) && await evaluate(`document.querySelectorAll('#map path.map-cell').length`) === 0, legendR.slice(0, 80));
  await evaluate(`(() => { const s = document.querySelector('#map-mode'); s.value = 'hotspots'; s.dispatchEvent(new Event('change')); return true; })()`);
  check("back to the hotspots view removes the 1 km layer", await evaluate(`!document.querySelector('#map img.recurrence-overlay') && document.querySelectorAll('#map path.map-cell').length === 376`));
  // DE-23 fire season of the whole area (values in tests/js/calc.test.js).
  const seasonText = await evaluate(`document.querySelector('#season-text').textContent`);
  check("fire season sentence and chart for the whole area", /median of 23 years\): starts in August, peaks in September and ends in October/.test(seasonText) &&
    await evaluate(`!!document.querySelector('#season .main-svg')`), seasonText.slice(0, 120));
  // DE-25: FIRMS link centred on the selection; print button present.
  check("FIRMS Fire Map link centred on the selected area", /^https:\/\/firms\.modaps\.eosdis\.nasa\.gov\/map\/#d:24hrs;@-63\.\d+,-10\.\d+,\d+\.0z$/.test(
    await evaluate(`document.querySelector('#firms-link').href`)), await evaluate(`document.querySelector('#firms-link').href`));

  // DE-24: municipal ranking of the map month, then Porto Velho as the area.
  check("ranking lists the 52 municipalities of the map month", await evaluate(`document.querySelectorAll('#ranking tr').length`) === 53 &&
    /Municipalities in 2026-10/.test(await evaluate(`document.querySelector('#ranking-caption').textContent`)));
  await evaluate(`(() => { const s = document.querySelector('#muni-select'); s.value = '1100205'; s.dispatchEvent(new Event('change')); return true; })()`);
  const infoM = await evaluate(`document.querySelector('#selection-info').textContent`);
  check("choosing Porto Velho uses its own series: calendar and season redrawn, per-cell CSV disabled", /^Municipality Porto Velho \(IBGE code 1100205\)/.test(infoM) &&
    await evaluate(`document.querySelector('#csv-cells').disabled && !!document.querySelector('#calendar .main-svg') && /Typical fire season/.test(document.querySelector('#season-text').textContent)`),
    infoM.slice(0, 60));
  await waitFor(`/Points: detections of 2026-10 .*in Porto Velho, per satellite/.test(document.querySelector('#map-note').textContent)`);
  check("map points are the detections inside Porto Velho", true);

  // Area by coordinates (R4, O1): a 2x2 degree square north of the area (also leaves the municipality).
  await selectArea(-65, -9.75, -63, -7.75);
  const info1 = await evaluate(`document.querySelector('#selection-info').textContent`);
  check("area typed as coordinates selects 46 cells (same as expected.json high_fire_2deg)", /^46 grid cells/.test(info1.trim()), info1.trim().slice(0, 40));

  // Period (R8): 2025-01 to 2025-12.
  await evaluate(`(() => { const sel = (id, ym) => { const s = document.querySelector(id); s.value = [...s.options].find((o) => o.textContent === ym).value; s.dispatchEvent(new Event('change')); };
    sel('#range-from', '2025-01'); sel('#range-to', '2025-12'); return true; })()`);

  // Hotspot count then download (R9).
  await evaluate(`document.querySelector('#hotspots-count').click(); true`);
  await waitFor(`/rows in the hotspot list/.test(document.querySelector('#hotspots-status').textContent)`);
  const st = await evaluate(`document.querySelector('#hotspots-status').textContent`);
  check("hotspot row count per sensor shown before the download", /^[\d,]+ rows in the hotspot list for the selected cells, 2025-01 to 2025-12: Terra/.test(st) && /not a harmonized count/.test(st), st.slice(0, 160));
  check("download buttons enabled after the count", await evaluate(`!document.querySelector('#hotspots-download').disabled && !document.querySelector('#hotspots-kml').disabled`));

  for (const [btn, name] of [["#hotspots-download", "hotspot CSV"], ["#hotspots-kml", "hotspot KML"], ["#csv-series", "monthly series CSV"], ["#csv-cells", "values per cell CSV"]]) {
    const before = await evaluate(`window.__downloads.length`);
    await evaluate(`document.querySelector('${btn}').click(); true`);
    await waitFor(`window.__downloads.length > ${before}`, 15000);
    const head = await evaluate(`window.__downloads[window.__downloads.length - 1].text().then((t) => t.slice(0, 2000))`);
    check(name + " has the FIRMS acknowledgment and the cut-off date", /We acknowledge the use of data/.test(head) && /2026-10-31/.test(head));
  }
  for (const [btn, name] of [["#png-calendar", "calendar PNG"], ["#png-compare", "chart PNG"]]) {
    const ok = await evaluate(`(async () => { const a = []; const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { a.push(this.href); };
      document.querySelector('${btn}').click(); for (let i = 0; i < 40 && !a.length; i++) await new Promise((r) => setTimeout(r, 250));
      HTMLAnchorElement.prototype.click = orig; return a.length > 0 && /^data:image\\/png|^blob:/.test(a[0]); })()`);
    check(name + " download starts", ok);
  }

  // Hold a real count result until the selection changes.
  await evaluate(`(() => {
    const load = LunaxHotspots.load;
    LunaxHotspots.load = async (...args) => {
      const result = await load(...args);
      await new Promise((resolve) => { window.__releaseCount = resolve; });
      LunaxHotspots.load = load;
      return result;
    };
    document.querySelector('#hotspots-count').click();
    return true;
  })()`);
  await waitFor(`typeof window.__releaseCount === 'function'`);
  await selectArea(-59.9, -8, -59.8, -7.9);

  const exportIds = ["png-calendar", "png-compare", "csv-series", "csv-cells", "hotspots-count"];
  const allExportsDisabled = `${JSON.stringify([...exportIds, "hotspots-download", "hotspots-kml"])}.every(id => document.getElementById(id).disabled)`;
  check("empty selection disables every export and clears the charts", await evaluate(`(
    ${allExportsDisabled} && !document.querySelector('#calendar .main-svg, #compare .main-svg, #season .main-svg') &&
    /No grid cell/.test(document.querySelector('#selection-info').textContent) &&
    document.querySelectorAll('#map path.map-cell').length === 0 && document.querySelector('#map-legend').hidden
  )`));
  await evaluate(`new Promise((resolve) => { window.__releaseCount(); setTimeout(resolve, 0); })`);
  check("a late hotspot count leaves the empty selection disabled", await evaluate(`(
    ${allExportsDisabled} && !/rows in the hotspot list/.test(document.querySelector('#hotspots-status').textContent)
  )`));

  await selectArea(-65, -9.75, -63, -7.75);
  await waitFor(`document.querySelector('#calendar .main-svg') && document.querySelector('#compare .main-svg')`);
  check("valid selection restores exports and requires a fresh hotspot count", await evaluate(`(
    ${JSON.stringify(exportIds)}.every(id => !document.getElementById(id).disabled) &&
    document.getElementById('hotspots-download').disabled && document.getElementById('hotspots-kml').disabled
  )`));
  check("no JavaScript errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} catch (e) {
  check("run", false, String(e.message || e));
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(PROFILE, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
