// RA-11 Brazil pilot (local only): drives the main app over the Brazil area packs, level by level, like a person would.
// The packs are git-ignored (pipeline/pilot_brazil.py, then pipeline/pilot_packs.py); without them the test is skipped.
// Usage: serve the repository root (python3 -m http.server 8766), then
//   node --experimental-websocket tests/e2e/brazil_packs.mjs [URL]   (default http://localhost:8766/docs/; Node 22+ needs no flag)
//   CHROME=<binary> if Chrome is not found; SHOTS=<folder> to save screenshots of each level.
// AI-assisted code (Claude Code); logged in AI_USE.md.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_ = process.argv[2] || "http://localhost:8766/docs/";
const CHROME = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"].find((p) => existsSync(p));
if (!CHROME) { console.error("Chrome not found: set CHROME to the browser binary."); process.exit(2); }
if (typeof WebSocket === "undefined") { console.error("No global WebSocket: use Node 22+, or node --experimental-websocket."); process.exit(2); }
try {
  if (!(await fetch(new URL("../data/pilot/brazil/places.json", URL_), { method: "HEAD" })).ok) throw new Error();
} catch { console.log("SKIP: no Brazil packs next to " + URL_ + " (serve the repository root after pipeline/pilot_packs.py)"); process.exit(0); }

const PORT = 9338, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), "lunax-packs-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore" });
let ws, id = 0;
const pending = new Map(), errors = [], results = [];
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(e) {
  const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("page error: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function waitFor(e, ms = 60000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(e)) return; await sleep(400); } throw new Error("timeout waiting for: " + e); }
const q = (s) => `document.querySelector(${JSON.stringify(s)})`;
const text = (s) => ev(`${q(s)}.textContent`);
function check(name, ok, detail) { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + String(detail).slice(0, 160) : "")); }
async function shot(name, h = 1500, w = 1280) {
  if (!process.env.SHOTS) return;
  const y = await ev(`${q("#controls")}.getBoundingClientRect().top + scrollY`);
  const png = (await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: w, height: h, scale: 1 } })).data;
  writeFileSync(join(process.env.SHOTS, name), Buffer.from(png, "base64"));
}
async function search(value) {
  await ev(`(() => { const s = ${q("#place-search")}; s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event("change")); return true; })()`);
}
async function view(mode) { await ev(`${q(`input[name="map-mode"][value="${mode}"]`)}.click(), true`); }
/** A real mouse click on a visible point of the first element matching sel (so a layer above it would take the click). */
async function realClick(sel) {
  await ev(`${q("#map")}.scrollIntoView(), true`); await sleep(500);
  const pt = await ev(`(() => { const b = ${q(sel)}.getBoundingClientRect();
    for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++) { const x = b.left + b.width * i / 20, y = b.top + b.height * j / 20;
      const e = document.elementFromPoint(x, y); if (e && e.closest(${JSON.stringify(sel)})) return [x, y]; } return null; })()`);
  if (!pt) throw new Error("no visible point of " + sel);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: pt[0], y: pt[1], button: "left", clickCount: 1 });
}

try {
  let t;
  for (let i = 0; i < 40 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === "page"); } catch { await sleep(250); } }
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL_ });
  await waitFor(`/grid cells selected/.test(${q("#selection-info")}.textContent) && !${q("#crumbs")}.hidden`);
  check("start: Rondonia (published pack) with the breadcrumb Brazil › RO", /Brazil › RO/.test(await text("#crumbs")), await text("#crumbs"));

  await ev(`${q("#crumbs button")}.click(), true`);
  await waitFor(`/the 27 states/.test(${q("#selection-info")}.textContent) && !!${q("#calendar .main-svg")}`);
  await sleep(1500);
  check("national level: legend per state, ranking of 27 states, calendar", /per state/.test(await text("#map-legend")) &&
    /States in the map month/.test(await text("#ranking-title")) && await ev(`document.querySelectorAll('#ranking tr').length`) === 28,
    (await text("#card-month-big")) + " | " + (await text("#card-season-big")));
  check("national level: only the two month views in the map panel", await ev(`[...document.querySelectorAll('input[name="map-mode"]')]
    .filter((r) => !r.closest("label").hidden).map((r) => r.value).join() === "hotspots,usual" && ${q("#group-history")}.hidden`));
  await shot("pk_national.png");

  check("national level: no neighbour outlines", await ev(`document.querySelectorAll(".br-neighbor").length === 0`));
  await realClick(".br-15");
  await waitFor(`/grid cells selected/.test(${q("#selection-info")}.textContent) && /PA/.test(${q("#crumbs")}.textContent)`);
  await waitFor(`/Points: detections of/.test(${q("#map-note")}.textContent)`, 90000);
  check("a click on Pará opens its pack: cells, calendar, cards, points", /Brazil › PA/.test(await text("#crumbs")) &&
    await ev(`document.querySelectorAll('#map path.map-cell').length`) > 1000, (await text("#map-note")).slice(0, 120));
  check("Pará: season card, 2000-2011 harmonized with its own ratios (passed DE-31)", /→/.test(await text("#card-season-big")) &&
    /own ratios/.test(await text("#how-text")), await text("#card-season-big"));
  await view("recurrence");
  await waitFor(`!!${q("#map img.recurrence-overlay")} && /not a forecast/.test(${q("#recurrence-note")}.textContent)`);
  const noteP = await text("#recurrence-note");
  check("Pará: places that burn year after year, with its own hindcast (DE-32)",
    /Places that burn year after year/.test(await text("#map-legend")) && /previous year's fires were the better guide/.test(noteP), noteP.slice(-150));
  await shot("pk_pa_recurrence.png");
  // DE-33: Pará's own forecasts (2026 from the area API): the outlook card and both "Where to expect fire" views
  check("Pará: next-season outlook for 2027 from data to 2026-10", /Aug-Oct 2027/.test(await text("#card-outlook-sub")), await text("#card-outlook-sub"));
  for (const mode of ["outlook001", "outlook005"]) {
    await view(mode);
    await waitFor(`!!${q("#map img.recurrence-overlay")} && /test fixed in advance/.test(${q("#recurrence-note")}.textContent)`, 90000);
    check("Pará: " + mode + " draws with its legend and its own test result", /Where to expect fire in 2027/.test(await text("#map-legend")),
      (await text("#recurrence-note")).slice(0, 160));
    if (mode === "outlook001") { // RA-12, DE-35
      await waitFor(`/Where to act first/.test(${q("#ranking-title")}.textContent) && document.querySelectorAll('#ranking tr').length === 145`, 90000);
      check("Pará: 'Where to act first' ranks its 144 municipalities", true, await ev(`document.querySelector('#ranking tr:nth-child(2)').textContent`));
    }
    await shot("pk_pa_" + mode + ".png");
  }
  await view("hotspots");
  await shot("pk_pa.png");
  await waitFor(`document.querySelectorAll(".br-neighbor").length === 26`);
  check("Pará: the other 26 states are outlined on the map, and the place selector in the map panel shows PA",
    await ev(`!${q(".br-n-15")} && ${q("#place-select")}.value === "15" && !${q("#place-pick")}.hidden`));

  await realClick(".br-n-21"); // Maranhão, from inside the map
  await waitFor(`/Brazil › MA/.test(${q("#crumbs")}.textContent) && /grid cells selected/.test(${q("#selection-info")}.textContent)`);
  check("a click on a neighbour state (Maranhão) opens it without leaving the map", await ev(`${q("#place-select")}.value === "21" &&
    document.querySelectorAll(".br-neighbor").length === 26 && !${q(".br-n-21")}`), await text("#crumbs"));
  await view("recurrence");
  await waitFor(`!!${q("#map img.recurrence-overlay")} && /not a forecast/.test(${q("#recurrence-note")}.textContent)`);
  check("Maranhão: the note follows its own numbers (recurrence did better there)", /places that burn year after year were the better guide/.test(await text("#recurrence-note")),
    (await text("#recurrence-note")).slice(-150));
  await view("hotspots");
  await ev(`(() => { const s = ${q("#place-select")}; s.value = "15"; s.dispatchEvent(new Event("change")); return true; })()`);
  await waitFor(`/Brazil › PA/.test(${q("#crumbs")}.textContent) && /grid cells selected/.test(${q("#selection-info")}.textContent)`);
  check("the place selector in the map panel goes back to Pará", true);

  await search("Altamira, PA");
  await waitFor(`/Municipality Altamira/.test(${q("#selection-info")}.textContent)`);
  await waitFor(`/Points: detections of .* in Altamira/.test(${q("#map-note")}.textContent)`, 90000);
  check("search 'Altamira, PA': municipality selected, breadcrumb, points inside it", /Brazil › PA › Altamira/.test(await text("#crumbs")), (await text("#map-note")).slice(0, 160));
  await ev(`${q('#period-chips [data-period="viirs"]')}.click(), true`); await sleep(2500);
  check("period chip '2012 on' sets From and is marked", (await ev(`${q("#range-from")}.selectedOptions[0].textContent`)) === "2012-02" &&
    await ev(`${q('#period-chips [data-period="viirs"]')}.classList.contains('on')`));
  await shot("pk_altamira.png");
  // RA-12, DE-37: Altamira's IBGE polygon uploaded as "your area" gives Altamira's own harmonized series
  const pa = JSON.parse(readFileSync(new URL("../../data/pilot/brazil/PA/municipalities.geojson", import.meta.url), "utf8"));
  const areaFile = new URL("area_altamira.geojson", import.meta.url).pathname; // not /tmp: a snap Chrome has its own /tmp
  writeFileSync(areaFile, JSON.stringify({ type: "FeatureCollection", features: pa.features.filter((f) => f.properties.code === "1500602") }));
  await ev(`window.__downloads = []; const _c = URL.createObjectURL; URL.createObjectURL = (b) => { window.__downloads.push(b); return _c(b); }; true`);
  const seriesCsv = async () => { const n = await ev(`window.__downloads.length`); await ev(`${q("#csv-series")}.click(), true`);
    await waitFor(`window.__downloads.length > ${n}`, 15000); return ev(`window.__downloads[window.__downloads.length - 1].text()`); };
  const values = (t) => new Map(t.split("\n").filter((l) => /^\d{4}-\d\d,/.test(l)).map((l) => [l.split(",")[0], l.split(",")[1]]));
  const theirs = values(await seriesCsv());
  const input = await send("Runtime.evaluate", { expression: "document.querySelector('#area-file')" });
  await send("DOM.setFileInputFiles", { files: [areaFile], objectId: input.result.objectId });
  try { await waitFor(`/Your area area_altamira/.test(${q("#selection-info")}.textContent)`, 180000); } finally { rmSync(areaFile, { force: true }); }
  // a detection right on the border can be classified differently by the pilot's polygon test (matplotlib) and the
  // browser's ray test (DE-37 check result): at most 1 detection in at most 1% of the months
  const mine = values(await seriesCsv()), differ = [...theirs.keys()].filter((ym) => mine.get(ym) !== theirs.get(ym));
  check("Altamira uploaded as your area gives Altamira's harmonized series (border detections aside)", theirs.size > 100 && mine.size === theirs.size &&
    differ.length <= Math.ceil(0.01 * theirs.size) && differ.every((ym) => Math.abs(Number(mine.get(ym)) - Number(theirs.get(ym))) <= 1),
    theirs.size + " months; differ: " + differ.map((ym) => ym + " " + mine.get(ym) + " vs " + theirs.get(ym)).join(", "));
  await waitFor(`/fire events in your area/.test(${q("#events-caption")}.textContent) && !!${q("#progress .main-svg")}`, 90000);
  check("your area: fire events and season so far", true, (await text("#events-caption")).slice(0, 80));
  await shot("pk_your_area.png");

  await search("Acre (AC)");
  await waitFor(`/Brazil › AC/.test(${q("#crumbs")}.textContent) && /grid cells selected/.test(${q("#selection-info")}.textContent)`);
  await sleep(1500);
  check("Acre (failed DE-31): its MODIS-only months are labelled not harmonized", /not harmonized/.test(await text("#how-text")),
    (await text("#how-text")).match(/Estimated months:[^.]*\./)?.[0]);
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 800, deviceScaleFactor: 1, mobile: true });
  await sleep(1500);
  await shot("pk_phone.png", 800, 375);
  check("no JavaScript errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("run", false, String(e.message || e));
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(PROFILE, { recursive: true, force: true });
}
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
