// Browser smoke test of the published app (TI-8 automated part). Drives a real headless Chrome through the
// DevTools protocol: no extra packages. It checks the parts a person would click: area by coordinates, period,
// hotspot count, the CSV/PNG downloads (captured in the page, not saved), and the texts.
// Usage: node tests/e2e/app_smoke.mjs [URL]   (default: the GitHub Pages URL)
// AI-assisted code (Claude Code); logged in AI_USE.md.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_ = process.argv[2] || "https://jacquesbelmont.github.io/lunax-fire-calendar/";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "lunax-e2e-"))}`, "--window-size=1280,2000", "about:blank"], { stdio: "ignore" });

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

  // Area by coordinates (R4, O1): a 2x2 degree square north of the area.
  await evaluate(`(() => { const s = (k, v) => { document.querySelector('#bbox-' + k).value = v; };
    s('w', -65); s('s', -9.75); s('e', -63); s('n', -7.75);
    document.querySelector('#bbox-form').dispatchEvent(new Event('submit', { cancelable: true })); return true; })()`);
  const info1 = await evaluate(`document.querySelector('#selection-info').textContent`);
  check("area typed as coordinates selects 46 cells (same as expected.json high_fire_2deg)", /^46 grid cells/.test(info1.trim()), info1.trim().slice(0, 40));

  // Period (R8): 2025-01 to 2025-12.
  await evaluate(`(() => { const sel = (id, ym) => { const s = document.querySelector(id); s.value = [...s.options].find((o) => o.textContent === ym).value; s.dispatchEvent(new Event('change')); };
    sel('#range-from', '2025-01'); sel('#range-to', '2025-12'); return true; })()`);

  // Hotspot count then download (R9).
  await evaluate(`document.querySelector('#hotspots-count').click(); true`);
  await waitFor(`/hotspots in the selected cells/.test(document.querySelector('#hotspots-status').textContent)`);
  const st = await evaluate(`document.querySelector('#hotspots-status').textContent`);
  check("hotspot count shown before the download", /^[\d,]+ hotspots in the selected cells, 2025-01 to 2025-12/.test(st), st.slice(0, 80));
  check("download button enabled after the count", await evaluate(`!document.querySelector('#hotspots-download').disabled`));

  for (const [btn, name] of [["#hotspots-download", "hotspot CSV"], ["#csv-series", "monthly series CSV"], ["#csv-cells", "values per cell CSV"]]) {
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
  check("no JavaScript errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} catch (e) {
  check("run", false, String(e.message || e));
} finally {
  chrome.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
