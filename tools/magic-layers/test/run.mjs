// Magic Layers self-test.  node test/run.mjs
// Part 1 needs only Node: the server starts, serves the app and refuses requests from other sites.
// Part 2 runs when Playwright is available (npm i -D playwright, or run from a project that has it): it drives the
// real app in a browser, separates the sample files into layers and checks the exported PowerPoint.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4600 + Math.floor(Math.random() * 300), base = `http://127.0.0.1:${PORT}`;
let failed = 0, passed = 0;
const check = (name, ok, detail = "") => { if (ok) { passed++; console.log(`  ok    ${name}`); } else { failed++; console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ""}`); } };

const server = spawn(process.execPath, ["server.mjs"], { cwd: root, env: { ...process.env, PORT: String(PORT), NO_OPEN: "1" }, stdio: "ignore" });
const stop = () => { try { server.kill(); } catch (e) { /* already stopped */ } };
process.on("exit", stop);
for (let i = 0; i < 50; i++) { try { await fetch(`${base}/api/status`); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }

console.log("Server");
try {
  const st = await (await fetch(`${base}/api/status`)).json(); check("status endpoint answers", st.ok === true);
  const html = await (await fetch(base)).text(); check("app page is served", html.includes("Magic Layers"));
  for (const f of ["/js/app.js", "/js/analyze-worker.js", "/vendor/tesseract/tesseract.min.js", "/vendor/tessdata/eng.traineddata.gz", "/vendor/tessdata/ind.traineddata.gz", "/vendor/pdfjs/pdf.min.mjs", "/vendor/pptxgen/pptxgen.bundle.js", "/vendor/ag-psd/bundle.js", "/fonts/inter-normal-latin.woff2", "/sample/sample-slide.png", "/brand.json"]) { const r = await fetch(base + f, { method: "HEAD" }); check(`serves ${f}`, r.ok, String(r.status)); }
  check("refuses a path outside the app", (await fetch(`${base}/..%2fpackage.json`)).status === 403);
  check("refuses another site's origin", (await fetch(`${base}/api/status`, { headers: { origin: "https://example.com" } })).status === 403);
  const ai = await fetch(`${base}/api/ai-assist`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("AI assist is off without a key (or answers when configured)", st.ai ? ai.status !== 404 : ai.status === 503);
} catch (e) { check("server reachable", false, e.message); }

let chromium = null;
for (const from of [join(root, "package.json"), join(root, "..", "..", "package.json"), join(process.cwd(), "package.json")]) { try { chromium = createRequire(from)("playwright").chromium; break; } catch (e) { /* try next */ } }
if (!chromium) { console.log("\nBrowser tests skipped: Playwright is not installed (optional)."); }
else {
  console.log("\nApp in a browser");
  let JSZip = null; try { JSZip = createRequire(join(root, "package.json"))("jszip"); } catch (e) { console.log("  (jszip not installed: PowerPoint contents are not inspected; run npm install for the full check)"); }
  const browser = await chromium.launch({ args: ["--proxy-bypass-list=<-loopback>"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), pg = await ctx.newPage();
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message)); pg.on("dialog", (d) => d.accept());
  const idle = () => pg.waitForFunction("window.__ml && window.__ml.page() && window.__ml.page().layers && !window.__ml.state.busy", null, { timeout: 240000 });
  const stats = () => pg.evaluate(() => { const p = window.__ml.page(), by = (t) => p.layers.filter((l) => l.type === t); return { pages: window.__ml.state.project.pages.length, text: by("text").length, shapes: by("shape").length, pictures: by("image").length, words: by("text").map((l) => l.text).join(" | "), fonts: [...new Set(by("text").map((l) => l.fontFamily))] }; });
  const out = mkdtempSync(join(tmpdir(), "magic-layers-test-"));
  const save = async (kind, opts = {}) => { const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 240000 }), pg.evaluate(([k, o]) => { window.__ml.doExport(k, o); }, [kind, opts])]); const p = join(out, dl.suggestedFilename()); await dl.saveAs(p); await pg.waitForFunction("!window.__ml.state.busy"); return p; };
  try {
    await pg.goto(base); await pg.waitForFunction("document.documentElement.dataset.ready === '1'", null, { timeout: 20000 });
    // 1. a flat slide image
    await pg.click("#btn-sample"); await idle(); let s = await stats();
    check("sample slide: text boxes found", s.text >= 12, `${s.text}`); check("sample slide: chart bars and lines are shapes", s.shapes >= 8, `${s.shapes}`); check("sample slide: photo is a picture", s.pictures >= 1, `${s.pictures}`);
    check("sample slide: title read correctly", /EBITDA margin recovered/.test(s.words)); check("sample slide: label spaces kept (Q2 24)", /Q2 24/.test(s.words)); check("sample slide: brand typefaces matched", s.fonts.includes("Fraunces") && s.fonts.includes("Inter"), s.fonts.join(","));
    // 2. editing with undo
    const id = await pg.evaluate(() => window.__ml.page().layers.find((l) => l.type === "shape").id);
    const moved = await pg.evaluate((id) => { const m = window.__ml; const l = m.page().layers.find((x) => x.id === id), x0 = l.x; m.state.selection.clear(); m.state.selection.add(id); return x0; }, id);
    await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("Shift+ArrowRight");
    const x1 = await pg.evaluate((id) => window.__ml.page().layers.find((x) => x.id === id).x, id); check("nudging a selected shape moves it", x1 === moved + 11, `${moved} -> ${x1}`);
    await pg.keyboard.press("Control+z"); const x2 = await pg.evaluate((id) => window.__ml.page().layers.find((x) => x.id === id).x, id); check("undo restores it", x2 === moved, `${x2}`);
    // 3. exports
    const pptx = await save("pptx"); check("PowerPoint file written", readFileSync(pptx).subarray(0, 2).toString() === "PK");
    if (JSZip) { const zip = await JSZip.loadAsync(readFileSync(pptx)); const xml = await zip.file("ppt/slides/slide1.xml").async("string");
      check("PowerPoint: live text", /<a:t>[^<]*EBITDA/.test(xml)); check("PowerPoint: native shapes", (xml.match(/<p:sp>/g) || []).length >= 20, `${(xml.match(/<p:sp>/g) || []).length}`); check("PowerPoint: pictures embedded", Object.keys(zip.files).some((f) => /^ppt\/media\//.test(f))); }
    check("Photoshop file written", readFileSync(await save("psd")).subarray(0, 4).toString() === "8BPS"); check("SVG written with text", /<text/.test(readFileSync(await save("svg"), "utf8"))); check("PNG written", readFileSync(await save("png")).subarray(1, 4).toString() === "PNG");
    const proj = await save("project"); await pg.setInputFiles("#file", proj); await idle(); const s2 = await stats(); check("project file reopens with its layers", s2.text === s.text && s2.shapes === s.shapes && s2.pictures === s.pictures);
    // 4. a PowerPoint made of picture slides
    await pg.setInputFiles("#file", join(root, "test/samples/flat-deck.pptx")); await idle(); s = await stats(); check("picture deck: both slides imported", s.pages === 2, `${s.pages}`); check("picture deck: first slide separated", s.text >= 12);
    const deck = await save("pptx", { all: true }); if (JSZip) { const z2 = await JSZip.loadAsync(readFileSync(deck)); check("picture deck: every slide exported as editable", Boolean(z2.file("ppt/slides/slide2.xml")) && /<a:t>/.test(await z2.file("ppt/slides/slide2.xml").async("string"))); }
    // 5. a PDF
    await pg.setInputFiles("#file", join(root, "test/samples/credentials.pdf")); await idle(); s = await stats(); check("PDF: all pages imported", s.pages === 8, `${s.pages}`); check("PDF: text taken exactly from the file", /Firm credentials/.test(s.words) && /NOVEMBER 2026 · INDONESIAN AND ENGLISH/.test(s.words), s.words.slice(0, 160));
    check("no script errors", errors.length === 0, errors.slice(0, 2).join(" ; "));
  } catch (e) { check("browser run completed", false, e.message.split("\n")[0]); }
  await browser.close(); console.log(`  (files written to ${out}: ${readdirSync(out).length})`);
}
console.log(`\n${failed ? "FAILED" : "PASSED"}: ${passed} checks ok${failed ? `, ${failed} failed` : ""}.`);
stop(); process.exit(failed ? 1 : 0);
