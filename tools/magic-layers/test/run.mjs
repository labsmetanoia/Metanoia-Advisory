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
  check("serves the Chart Builder", (await (await fetch(`${base}/charts.html`)).text()).includes("Chart Builder"));
  check("serves the Deck Auditor", (await (await fetch(`${base}/auditor.html`)).text()).includes("Deck Auditor"));
  for (const f of ["/js/audit/ui.js", "/sample/audit-sample.pptx", "/sample/audit-sample-previous.pptx"]) { const r = await fetch(base + f, { method: "HEAD" }); check(`serves ${f}`, r.ok, String(r.status)); }
} catch (e) { check("server reachable", false, e.message); }

console.log("\nDeck Auditor rules");
try {
  const N = await import("../app/js/audit/numbers.js"), C = await import("../app/js/audit/checks.js");
  const pn = (r, l) => N.parseNumber(r, l).value;
  check("numbers: English and Indonesian separators", pn("1,250.5", "en") === 1250.5 && pn("1.250,5", "id") === 1250.5 && pn("12,6", "id") === 12.6 && pn("1.250", "id") === 1250 && pn("1,250", "en") === 1250);
  const f = N.factsInText("EBITDA margin recovered to 14% in Q3 2025 as logistics costs normalised", "en", {})[0];
  check("numbers: a figure keeps its metric, unit and period", f.value === 14 && f.unit === "%" && f.label.join(" ") === "ebitda margin" && f.periods[0] === "Q3 25", JSON.stringify([f.label, f.periods]));
  const g = N.metricGroups([...N.factsInText("EBITDA margin reached 14% in Q3 25", "en", { slide: 2, shapeId: "a" }), ...N.factsInText("Q3'25 EBITDA margin of 15%", "en", { slide: 5, shapeId: "b" })]);
  check("numbers: the same metric with two values is a mismatch", g.length === 1 && g[0].status === "mismatch");
  const g2 = N.metricGroups([...N.factsInText("EBITDA margin reached 14% in Q3 25", "en", { slide: 2, shapeId: "a" }), ...N.factsInText("EBITDA margin of 14.2% in Q3 25", "en", { slide: 5, shapeId: "b" }), ...N.factsInText("EBITDA margin of 11% in Q3 24", "en", { slide: 6, shapeId: "c" })]);
  check("numbers: rounding is not a mismatch, another period is another metric", g2.length === 1 && g2[0].status === "precision" && g2[0].facts.length === 2);
  check("titles: a conclusion is an action title", C.classifyTitle("EBITDA margin recovered to 14% as logistics costs normalised", "en").kind === "action" && C.classifyTitle("Pendapatan naik karena volume logistik yang lebih tinggi", "id").kind === "action");
  check("titles: a topic is a label", C.classifyTitle("Market overview", "en").kind === "label" && C.classifyTitle("Strategic Storytelling & Corporate Communications", "en").kind !== "action" && C.classifyTitle("Executive summary", "en").kind === "exempt");
  const SRC = await import("../app/js/audit/sources.js");
  const cell = (o) => ({ source: "model.xlsx", where: "sheet", pct: false, unitHint: "", shown: String(o.value), sheet: "Summary", row: 1, col: 1, at: "Summary!B2", rowLabel: "", colLabel: "", ...o });
  const src = [{ name: "model.xlsx", kind: "workbook", note: "1 sheet", facts: [cell({ value: 14, pct: true, label: ["ebitda", "margin"], periods: ["Q3 25"], rowLabel: "EBITDA margin", colLabel: "Q3 25", shown: "14%" }), cell({ value: 57412000, label: ["total", "revenue"], periods: ["FY25"], rowLabel: "Total revenue", colLabel: "FY25", row: 2, col: 2 }), cell({ value: 50000000, label: ["total", "revenue"], periods: ["FY24"], rowLabel: "Total revenue", colLabel: "FY24", row: 2, col: 1 })] }];
  const st = (t) => SRC.reconcile(N.factsInText(t, "en", { slide: 1, shapeId: "a", where: "body" }), src).items.map((i) => i.status).join();
  check("source check: a figure that agrees is confirmed, across scales", st("EBITDA margin reached 14% in Q3 25") === "confirmed" && st("Total revenue of Rp 57.4 tn in FY25") === "confirmed");
  check("source check: same metric and period with another value differs", st("EBITDA margin reached 15% in Q3 25") === "differs" && SRC.sourceFindings(SRC.reconcile(N.factsInText("EBITDA margin reached 15% in Q3 25", "en", { slide: 3, shapeId: "a", where: "body" }), src))[0].code === "source-differs");
  check("source check: a growth rate is derived from the row, an unknown figure is not found", st("Revenue grew 14.8% in FY25") === "derived" && st("Headcount of 4,820 in FY25") === "missing");
} catch (e) { check("rules load in Node", false, e.message); }

console.log("\nChart Builder rules");
try {
  const D = await import("../app/js/charts/data.js"), R = await import("../app/js/charts/render.js");
  const en = D.gridToData(D.parseDelimited("Quarter\tEBITDA margin\nQ2 24\t11%\nQ3 25\t14%")), id = D.gridToData(D.parseDelimited("Segmen;FY24;FY25\nKonsumen;1.250,5;1.410,0\nIndustri;980,2;(1.020,4)"));
  check("data: a pasted Excel range becomes categories and series", en.categories.join() === "Q2 24,Q3 25" && en.series[0].values.join() === "11,14" && en.unit === "%");
  check("data: Indonesian separators and bracketed negatives", id.lang === "id" && id.series[0].values[0] === 1250.5 && id.series[1].values[1] === -1020.4);
  const b = R.bridge({ data: { categories: ["FY24", "Volume", "Price", "Cost", "FY25"], series: [{ values: [50, 6, 3, -2, 58] }] }, lastIsTotal: true });
  check("bridge: steps are summed and compared with the stated total", b.end === 57 && b.stated === 58 && b.steps.length === 5);
  check("growth note: change in points for percentages, CAGR for amounts", R.growthNote({ type: "column", growth: "change", format: { suffix: "%" }, data: en }) === "+3.0 pp vs Q2 24" && /^CAGR \+10% \(FY23–FY25\)$/.test(R.growthNote({ type: "column", growth: "cagr", format: {}, data: { categories: ["FY23", "FY24", "FY25"], series: [{ name: "x", values: [100, 110, 121] }] } })));
  const two = { categories: ["A", "B", "C"], series: [{ name: "X", values: [3, 5, 2] }, { name: "Y", values: [1, 2, 4] }] };
  check("preview: every chart type draws", ["column", "bar", "stacked", "stacked100", "line", "pie", "waterfall"].every((t) => /<svg[\s\S]*(rect|path|polyline)/.test(R.renderChart({ type: t, data: two, highlight: { kind: "none" } }))));
} catch (e) { check("chart rules load in Node", false, e.message); }

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
    // 6. the Deck Auditor on a deck with known flaws, then against its previous version
    await pg.goto(`${base}/auditor.html`); await pg.waitForFunction("document.documentElement.dataset.ready === '1'", null, { timeout: 20000 });
    await pg.click("#btn-sample"); await pg.waitForFunction("window.__audit.S.result && !window.__audit.S.busy", null, { timeout: 60000 });
    const codes = await pg.evaluate(() => window.__audit.S.result.findings.map((f) => f.code));
    const expect = { mismatch: "a figure shown with two values", growth: "a growth rate that does not follow from its figures", headline: "a headline figure missing from its chart", "total-row": "a table total that does not add up", shares: "pie shares that do not make 100%", "no-source": "a data slide without a source", "label-titles": "label titles", language: "a slide in the other language", "draft-marks": "draft markers", fonts: "a stray typeface", stretched: "a stretched picture", "low-res": "a coarse picture", "title-size": "a title in another size" };
    for (const [code, what] of Object.entries(expect)) check(`auditor finds ${what}`, codes.includes(code));
    check("auditor: no finding beyond the planted flaws", codes.length === Object.keys(expect).length, codes.join(","));
    await pg.setInputFiles("#file-prev", join(root, "app/sample/audit-sample-previous.pptx")); await pg.waitForFunction("window.__audit.S.cmp && !window.__audit.S.busy", null, { timeout: 60000 });
    const cmp = await pg.evaluate(() => window.__audit.S.cmp.summary); check("compare: slides paired, changes counted", cmp.changed === 5 && cmp.added === 1 && cmp.removed === 1 && cmp.same === 2 && cmp.figures === 4, JSON.stringify(cmp));
    const rep = await pg.evaluate(() => [window.__audit.report(), window.__audit.csv(), window.__audit.changeLog()]); check("report, spreadsheet and change log are produced", /Numbers that match/.test(rep[0]) && /Changes since the previous version/.test(rep[0]) && rep[1].split("\n").length === codes.length + 1 && /12% → 16%/.test(rep[2]));
    // Source Check: the deck against its Excel model, then against a Word document
    await pg.click("#tabs [data-view=sources]"); await pg.setInputFiles("#file-src", join(root, "app/sample/audit-sample-model.xlsx")); await pg.waitForFunction("window.__audit.S.recon && !window.__audit.S.busy", null, { timeout: 60000 });
    const rc = await pg.evaluate(() => { const S = window.__audit.S, by = (raw, slide) => (S.recon.items.find((i) => i.fact.raw === raw && i.fact.slide === slide) || {}).status; return { s: S.recon.summary, a: by("14%", 2), b: by("15%", 3), c: by("2.1x", 2), d: by("16%", 2), e: by("41", 5), f: by("24", 4), codes: S.result.findings.filter((x) => x.code.startsWith("source")).map((x) => x.code), at: S.recon.items.find((i) => i.fact.raw === "15%").source.at }; });
    check("source check: every figure of the deck is looked up in the workbook", rc.s.total === 24 && rc.s.confirmed === 16 && rc.s.differs === 2 && rc.s.derived === 2 && rc.s.missing === 4, JSON.stringify(rc.s));
    check("source check: agreement, difference, scale and derivation are told apart", rc.a === "confirmed" && rc.b === "differs" && rc.c === "differs" && rc.d === "derived" && rc.e === "derived" && rc.f === "confirmed" && rc.at === "Margins!G2", JSON.stringify(rc));
    check("source check: differences become findings and enter the report", rc.codes.filter((x) => x === "source-differs").length === 2 && rc.codes.includes("source-missing") && /Checked against the source/.test(await pg.evaluate(() => window.__audit.report())));
    await pg.evaluate(() => { window.__audit.S.sources = []; }); await pg.setInputFiles("#file-src", join(root, "test/samples/press-release.docx")); await pg.waitForFunction("window.__audit.S.recon && window.__audit.S.recon.sources[0].kind === 'document' && !window.__audit.S.busy", null, { timeout: 60000 });
    const rd = await pg.evaluate(() => window.__audit.S.recon.summary); check("source check: a Word document as the source", rd.confirmed === 7 && rd.differs === 3, JSON.stringify(rd));
    for (const v of ["slides", "storyline", "numbers", "sources", "compare", "overview"]) await pg.click(`#tabs [data-view=${v}]`);
    await pg.setInputFiles("#file", join(root, "test/samples/credentials.pdf")); await pg.waitForFunction("window.__audit.S.deck && window.__audit.S.deck.kind === 'pdf' && !window.__audit.S.busy", null, { timeout: 120000 });
    const pdf = await pg.evaluate(() => ({ n: window.__audit.S.deck.slides.length, t: window.__audit.S.deck.slides[0].title && window.__audit.S.deck.slides[0].title.text, doc: window.__audit.S.result.document })); check("auditor reads a PDF", pdf.n === 8 && pdf.t === "Firm credentials" && pdf.doc === true, JSON.stringify(pdf));
    // 7. the Chart Builder: data in, every chart type out as a native chart, and the result passes the Deck Auditor
    await pg.goto(`${base}/charts.html`); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction("document.documentElement.dataset.ready === '1'", null, { timeout: 20000 });
    check("chart builder opens with a sample chart", await pg.evaluate(() => window.__charts.S.charts.length === 1 && document.querySelector("#chart svg rect") !== null));
    await pg.setInputFiles("#file", join(root, "test/samples/chart-data.xlsx")); await pg.waitForFunction("window.__charts.S.sheets", null, { timeout: 20000 });
    const xl = await pg.evaluate(() => { const c = window.__charts; return { grid: c.S.charts[0].grid, sheets: c.S.sheets.length, f: c.specOf(c.S.charts[0]).format }; }); check("an Excel workbook is read with its percentages", xl.sheets === 2 && xl.grid[1].join() === "Q2 24,11%,5%" && xl.f.suffix === "%", JSON.stringify(xl.grid[1]));
    await pg.evaluate(() => { const c = window.__charts, mk = (o) => ({ ...c.blank(), source: "Source: illustrative figures.", ...o });
      c.S.charts = [mk({ type: "column", title: "EBITDA margin recovered to 14% in Q3 25 as logistics costs normalised", grid: [["", "EBITDA margin"], ["Q2 25", "13%"], ["Q3 25", "14%"]], highlight: { kind: "last" } }),
        mk({ type: "stacked", title: "Revenue reached Rp 58 tn as Consumer overtook Industrial", grid: [["", "Consumer", "Industrial", "Other"], ["FY24", "21", "19", "10"], ["FY25", "24", "22", "12"]] }),
        mk({ type: "line", title: "Margin has widened in both segments", grid: [["", "Consumer", "Industrial"], ["FY24", "12.1%", "11.9%"], ["FY25", "14.0%", "12.6%"]] }),
        mk({ type: "pie", title: "Consumer is the largest segment at 41% of revenue", grid: [["", "Share"], ["Consumer", "41%"], ["Industrial", "38%"], ["Other", "21%"]] }),
        mk({ type: "waterfall", title: "Volume and price lifted EBITDA from Rp 50 bn to Rp 57 bn", grid: [["", "EBITDA"], ["FY24", "50"], ["Volume", "6"], ["Price", "3"], ["Cost", "-2"], ["FY25", "57"]], lastIsTotal: true })]; c.S.cur = 0; c.renderAll(); });
    check("a correct chart raises no warning", await pg.evaluate(() => window.__charts.S.charts.every((c) => window.__charts.warningsOf(c).length === 0)));
    const warn = await pg.evaluate(() => { const c = window.__charts, bad = { ...c.S.charts[0], title: "EBITDA margin recovered to 15% in Q3 25" }, br = { ...c.S.charts[4], grid: [["", "EBITDA"], ["FY24", "50"], ["Volume", "6"], ["FY25", "58"]] }, pie = { ...c.S.charts[3], grid: [["", "Share"], ["A", "41%"], ["B", "36%"], ["C", "20%"]], title: "A leads" }; return [c.warningsOf(bad), c.warningsOf(br), c.warningsOf(pie)].map((w) => w.map((x) => x.code).join()); });
    check("warnings: a title figure not in the data, a bridge that does not add up, shares short of 100%", warn[0] === "title-figure" && warn[1].includes("bridge-total") && warn[2].includes("shares"), warn.join(" | "));
    await pg.click("#btn-export"); const [cdl] = await Promise.all([pg.waitForEvent("download", { timeout: 60000 }), pg.click("#menu .menu__item")]); const cpath = join(out, "Charts.pptx"); await cdl.saveAs(cpath);
    if (JSZip) { const z = await JSZip.loadAsync(readFileSync(cpath)), names = Object.keys(z.files), charts = names.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)), all = (await Promise.all(charts.map((n) => z.file(n).async("string")))).join("\n");
      check("PowerPoint: five native charts with their workbooks", charts.length === 5 && names.filter((n) => /embeddings\/.*\.xlsx$/.test(n)).length === 5, `${charts.length}`);
      check("PowerPoint: bar, line and doughnut-or-pie chart parts", /<c:barChart>/.test(all) && /<c:lineChart>/.test(all) && /<c:(pie|doughnut)Chart>/.test(all));
      check("PowerPoint: bridge base is invisible, stack totals sit above the stack", /<c:v>\(base\)<\/c:v>[\s\S]*?<a:noFill\/>/.test(all) && /inBase/.test(all) && /<c:legendEntry>/.test(all)); }
    await pg.goto(`${base}/auditor.html`); await pg.waitForFunction("document.documentElement.dataset.ready === '1'"); await pg.setInputFiles("#file", cpath); await pg.waitForFunction("window.__audit.S.result && !window.__audit.S.busy", null, { timeout: 60000 });
    const au = await pg.evaluate(() => ({ n: window.__audit.S.deck.slides.length, f: window.__audit.S.result.findings.map((x) => x.code), figs: window.__audit.S.result.stats.figures })); check("the exported charts pass the Deck Auditor with their data read", au.n === 5 && au.f.length === 0 && au.figs >= 20, JSON.stringify(au));
    check("no script errors", errors.length === 0, errors.slice(0, 2).join(" ; "));
  } catch (e) { check("browser run completed", false, e.message.split("\n")[0]); }
  await browser.close(); console.log(`  (files written to ${out}: ${readdirSync(out).length})`);
}
console.log(`\n${failed ? "FAILED" : "PASSED"}: ${passed} checks ok${failed ? `, ${failed} failed` : ""}.`);
stop(); process.exit(failed ? 1 : 0);
