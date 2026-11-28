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
  { const { TITLE_CASES } = await import("./title-cases.mjs"), kind = (k) => (k === "action" ? "a" : k === "exempt" ? "x" : "l"), miss = TITLE_CASES.filter(([l, t, e]) => kind(C.classifyTitle(t, l).kind) !== e);
    check(`titles: ${TITLE_CASES.length} realistic titles in English and Indonesian read as a reviewer would`, miss.length === 0, miss.map((m) => m[1]).join(" | ")); }
  { const TT = await import("../app/js/audit/titles.js"), r = TT.reviewTitles("1. FY25 board update\nExecutive summary\n- EBITDA margin recovered to 14% in Q3 25\nRevenue by segment\nRevenue by segment\nSegmen konsumen kini menjadi kontributor terbesar\nDividend policy\nNext steps");
    check("headline check: cover and standard pages set aside, repeats found, each line judged in its own language", r.items.map((x) => x.kind).join() === "cover,exempt,action,label,label,action,label,exempt", r.items.map((x) => x.kind).join());
    check("headline check: the share counts judged titles only, and the structure needs eight titles", r.judged === 5 && r.actions === 2 && r.share === 40 && r.items[4].repeatOf === 4 && r.summary === true && r.ask === true && TT.reviewTitles("A\nB c d").summary === null); }
  check("titles: irregular verbs make a conclusion, a list of nouns does not", C.classifyTitle("Service levels held through the peak season in all provinces", "en").kind === "action" && C.classifyTitle("Margins stood above plan in every region", "en").kind === "action" && C.classifyTitle("Sources and uses of funds by project", "en").kind !== "action");
  // a deliberately bad deck in the auditor's own model sets off the rules the sample deck does not
  const { finishDeck } = await import("../app/js/audit/pptx.js"), { messyDeck } = await import("./messy-deck.mjs"), ID = await import("../app/js/audit/id.js"), RP = await import("../app/js/audit/report.js");
  const md = messyDeck(finishDeck), mr = C.audit(md, {}), mcodes = [...new Set(mr.findings.map((x) => x.code))].sort().join();
  check("rules: structure, arithmetic and layout findings on a bad deck", mcodes === "chart-total,dense,duplicate-title,long-title,margin,no-ask,no-summary,no-title,off-slide,page-number,precision,shares,small-type,total-col", mcodes);
  const untranslated = mr.findings.filter((x) => !ID.idFinding(x).ok).map((x) => x.code);
  check("Indonesian report: every finding of the bad deck is restated", untranslated.length === 0, untranslated.join());
  check("Indonesian report: an action for every finding type, and unknown wording falls back to English", Object.keys(RP.ACTIONS).every((k) => ID.ACTIONS_ID[k]) && Object.keys(ID.ACTIONS_ID).length === Object.keys(RP.ACTIONS).length && ID.idFinding({ code: "mismatch", title: "something else", detail: "x", slides: [] }).title === "something else" && ID.idFinding({ code: "unknown", title: "t", detail: "d", slides: [] }).ok === false);
  const idr = RP.clientReportHtml(md, mr, { client: { lang: "id", client: "PT Contoh" } }), enr = RP.clientReportHtml(md, mr, { client: {} });
  check("Indonesian report: headings, actions and findings are in Indonesian, the English report is unchanged", /<html lang="id">/.test(idr) && /Pandangan kami/.test(idr) && /Tindak lanjut\./.test(idr) && /tidak berjudul/.test(idr) && /Bagaimana tinjauan ini dilakukan/.test(idr) && !/What to do\.|Our view|has no title|Whole deck/.test(idr) && /<html lang="en">/.test(enr) && /What to do\./.test(enr) && /Our view/.test(enr) && !/Tindak lanjut/.test(enr));
  const Q = await import("../app/js/audit/quarter.js"), { quarterDecks } = await import("./quarter-decks.mjs"), { q2, q3 } = quarterDecks(finishDeck);
  const q3facts = N.collectFacts(q3, "en").filter((f) => f.slide === 2 && f.where === "body").map((f) => `${f.raw}|${f.label.join(" ")}|${f.periods.join()}`);
  check("numbers: in a sentence comparing periods, each figure takes its own period and the comparative takes the metric", q3facts.includes("Rp 13.9 tn|revenue|Q2 25") && q3facts.includes("Rp 15.0 tn|revenue|Q3 25") && q3facts.includes("12.8%|ebitda margin|Q2 25"), q3facts.join(" ; "));
  const rq = Q.restatedFigures(q2, q3, "en"), rf = Q.restatedFindings(rq);
  check("last quarter: a figure for an earlier period that changed silently is found; unchanged and disclosed ones are not", rq.length === 1 && rq[0].label === "Revenue" && rq[0].periods.join() === "Q2 25" && /was Rp 14.2 tn last quarter and is Rp 13.9 tn now/.test(rf[0].title) && rf[0].slides.join() === "2" && Q.restatedFigures(q3, q3, "en").length === 0, JSON.stringify(rf.map((f) => f.title)));
  check("last quarter: the finding has an action and reads in Indonesian", Boolean(RP.ACTIONS.restated && ID.ACTIONS_ID.restated) && ID.idFinding({ ...rf[0], slides: rf[0].slides }).ok && /pada triwulan lalu/.test(ID.idFinding(rf[0]).title));
  const BM = await import("../app/js/audit/benchmark.js"), covered = new Set(BM.MEASURES.flatMap((m) => m.codes));
  const missingCodes = Object.keys(RP.ACTIONS).filter((c) => !/^source-|^restated$/.test(c) && !covered.has(c));
  const rows = [BM.deckMetrics(md, mr, "PT Rahasia Tbk - public expose.pptx"), { ...BM.deckMetrics(q3, C.audit(q3, {}), "Q3.pdf"), kind: "pdf" }, { name: "scan.pdf", error: "No text" }], agg = BM.aggregate(rows), codes = BM.assignCodes(rows, 42);
  const fontsM = agg.measures.find((m) => m.key === "fonts"), sumM = agg.measures.find((m) => m.key === "no-summary");
  check("benchmark: every kind of finding is counted, PowerPoint-only and long-deck checks against the decks they apply to", missingCodes.length === 0 && agg.n === 2 && agg.failed === 1 && fontsM.of === 1 && sumM.of === 1 && agg.buckets.reduce((x, b) => x + b.decks, 0) === 2, `${missingCodes.join()} ${JSON.stringify([fontsM.of, sumM.of])}`);
  check("benchmark: codes are a shuffle of D01…, stable for a study", [...codes].sort().join() === "D01,D02,D03" && BM.assignCodes(rows, 42).join() === codes.join());
  const bh = BM.benchmarkHtml(agg, { title: "Study", selection: "How they were chosen" }, "en"), bi = BM.benchmarkHtml(agg, { title: "Kajian", selection: "Cara memilih" }, "id"), csv = BM.metricsCsv(rows, codes);
  check("benchmark: the report and the figures name no file or company, and read in both languages", !/Rahasia|public expose|Q3\.pdf|scan\.pdf/.test(bh + bi + csv) && /How the decks were chosen/.test(bh) && /Bagaimana dek dipilih/.test(bi) && csv.split("\n").length === 3 && BM.keyCsv(rows, codes).includes("PT Rahasia Tbk"));
  const SRC = await import("../app/js/audit/sources.js");
  const cell = (o) => ({ source: "model.xlsx", where: "sheet", pct: false, unitHint: "", shown: String(o.value), sheet: "Summary", row: 1, col: 1, at: "Summary!B2", rowLabel: "", colLabel: "", ...o });
  const src = [{ name: "model.xlsx", kind: "workbook", note: "1 sheet", facts: [cell({ value: 14, pct: true, label: ["ebitda", "margin"], periods: ["Q3 25"], rowLabel: "EBITDA margin", colLabel: "Q3 25", shown: "14%" }), cell({ value: 57412000, label: ["total", "revenue"], periods: ["FY25"], rowLabel: "Total revenue", colLabel: "FY25", row: 2, col: 2 }), cell({ value: 50000000, label: ["total", "revenue"], periods: ["FY24"], rowLabel: "Total revenue", colLabel: "FY24", row: 2, col: 1 })] }];
  const st = (t) => SRC.reconcile(N.factsInText(t, "en", { slide: 1, shapeId: "a", where: "body" }), src).items.map((i) => i.status).join();
  check("source check: a figure that agrees is confirmed, across scales", st("EBITDA margin reached 14% in Q3 25") === "confirmed" && st("Total revenue of Rp 57.4 tn in FY25") === "confirmed");
  check("source check: same metric and period with another value differs", st("EBITDA margin reached 15% in Q3 25") === "differs" && SRC.sourceFindings(SRC.reconcile(N.factsInText("EBITDA margin reached 15% in Q3 25", "en", { slide: 3, shapeId: "a", where: "body" }), src))[0].code === "source-differs");
  check("source check: a growth rate is derived from the row, an unknown figure is not found", st("Revenue grew 14.8% in FY25") === "derived" && st("Headcount of 4,820 in FY25") === "missing");
} catch (e) { check("rules load in Node", false, e.message); }

console.log("\nProposal kit");
try {
  const W = await import("../app/js/proposals/words.js"), O = await import("../app/js/proposals/offers.js"), D = await import("../app/js/proposals/doc.js"), X = await import("../app/js/proposals/docx.js");
  check("amounts in words: Indonesian (terbilang) and English", W.terbilang(15000000) === "lima belas juta" && W.terbilang(1100) === "seribu seratus" && W.terbilang(11) === "sebelas" && W.terbilang(2500000000) === "dua miliar lima ratus juta" && W.terbilang(120000000) === "seratus dua puluh juta" && W.inWords(15000000) === "fifteen million" && W.inWords(1250) === "one thousand two hundred and fifty" && W.money(15000000, "IDR", "id") === "Rp 15.000.000" && W.parseAmount("Rp 15.000.000") === 15000000);
  const holes = []; const walk = (v, path) => { if (v && typeof v === "object") { if (typeof v.en === "string" && "id" in v) { if (!v.en.trim() || !String(v.id).trim()) holes.push(path); } else for (const k in v) walk(v[k], `${path}.${k}`); } };
  for (const o of O.OFFERS) walk(o, o.key);
  check("offers: every text is in English and Indonesian, every schedule adds up to 100%", holes.length === 0 && O.OFFERS.filter((o) => o.basis !== "monthly").every((o) => o.schedule.reduce((a, x) => a + x.pct, 0) === 100), holes.join());
  const set = { ...D.DEFAULT_SETTINGS, signatory: "A. Signatory", signatoryTitle: "Partner", legalName: "PT Contoh Firma" }, mk = (key, extra = {}) => { const p = D.newProposal(key, set, new Date("2026-11-24T00:00:00")); p.ref = D.makeRef(p.date, 7); p.client.company = "PT Contoh <Klien>"; p.client.signatory = "B. Client"; p.fee = 15000000; return Object.assign(p, extra); };
  const shape = (bl) => bl.map((x) => `${x.t}${x.rows ? x.rows.length : ""}${x.items ? x.items.length : ""}`).join();
  check("proposal: the English and Indonesian versions have the same shape for every offer", O.OFFERS.every((o) => shape(D.buildBlocks(mk(o.key), set, "en")) === shape(D.buildBlocks(mk(o.key), set, "id"))));
  const blank = D.newProposal("deckAudit", D.DEFAULT_SETTINGS), errs = D.problems(blank, D.DEFAULT_SETTINGS).filter((x) => x.level === "error").map((x) => x.text).join(" ");
  const bad = mk("deckProject"); bad.schedule[0].pct = 40; const en = mk("deckAudit", { mode: "en" });
  check("proposal: missing client, fee or signatory and a schedule short of 100% are errors", /company/.test(errs) && /fee/.test(errs) && /signatory/.test(errs) && D.problems(bad, set).some((x) => x.level === "error" && /90%/.test(x.text)) && !D.problems(mk("deckAudit"), set).some((x) => x.level === "error"));
  check("proposal: an English-only letter to an Indonesian party is flagged", D.problems(en, set).some((x) => /Bahasa Indonesia/.test(x.text)) && !D.problems(mk("deckAudit"), set).some((x) => /Bahasa Indonesia/.test(x.text)));
  const draft = D.proposalHtml(mk("deckAudit"), set), final = D.proposalHtml(mk("deckAudit"), { ...set, reviewed: true });
  check("proposal: marked as a draft until counsel has reviewed the terms", /belum ditinjau/.test(draft) && /not yet been reviewed/.test(draft) && /DRAF \/ DRAFT/.test(draft) && !/not yet been reviewed|DRAFT/.test(final));
  check("proposal: fee in figures and words, the legal entity in the terms, client text escaped", draft.includes("Rp 15.000.000") && draft.includes("lima belas juta rupiah") && draft.includes("fifteen million rupiah") && draft.includes("PT Contoh Firma does not practise law") && draft.includes("PT Contoh &lt;Klien&gt;") && !draft.includes("<Klien>"));
  const ret = mk("retainer", { fee: 35000000, months: 12 }), T = D.totals(ret, { ...set, vatRate: "11" }), rh = D.proposalHtml(ret, { ...set, vatRate: "11" });
  check("proposal: a retainer totals the term, with VAT when a rate is set", T.total === (35000000 + 3850000) * 12 && rh.includes("Rp 466.200.000") && rh.includes("PPN 11%") && rh.includes("monthly in advance"));
  const BR = await import("../app/js/proposals/brief.js"), code = BR.encodeBrief({ lang: "id", offer: "pitch", company: "PT Contoh <Klien>", name: "Siti", role: "CFO", email: "s@c.test", subject: "dek pitch Seri B", audience: "Investor", decision: "Berinvestasi", deadline: "2026-12-12", languages: "bi", indonesian: true, mnpi: true, notes: "Catatan “khusus” — é" });
  const back = BR.decodeBrief(`Brief code: ${code.match(/.{1,50}/g).join("\n> ")}\nlanguage: id\n`), bp = BR.proposalFromBrief(back, D.newProposal, set);
  check("brief code: survives an email's line breaks and quote marks, ends at its full stop, and refuses a cut or edited code", back.company === "PT Contoh <Klien>" && back.notes === "Catatan “khusus” — é" && back.mnpi && /\.$/.test(code) && [code.slice(0, 40), "no code", code.replace("eyJ", "e!J")].every((x) => { try { BR.decodeBrief(x); return false; } catch (e) { return true; } }));
  check("brief code: starts a proposal with the offer, client, subject, situation and a confidentiality warning", bp.offer === "deckProject" && bp.mode === "bi" && bp.client.contact === "Siti, CFO" && bp.subject.id === "dek pitch Seri B" && /Audiens: Investor/.test(bp.situation.id) && /12 Desember 2026/.test(bp.situation.id) && D.problems(bp, set).some((x) => /not yet public/.test(x.text)));
  const acc = (rv) => D.proposalHtml(mk("deckAudit"), { ...set, reviewed: rv });
  check("acceptance: the online link appears only once counsel has reviewed the terms, in each language", !/accepted online/.test(acc(false)) && acc(true).includes("https://www.metanoiaadvisors.com/en/contact/accept/?ref=MA%2FP%2F2026%2F11%2F007") && acc(true).includes("https://www.metanoiaadvisors.com/id/kontak/terima-proposal/?ref=MA%2FP%2F2026%2F11%2F007"));
  let JZ = null; try { JZ = createRequire(join(root, "package.json"))("jszip"); } catch (e) { /* optional */ }
  if (JZ) { const z = X.proposalDocx(mk("deckAudit"), set, JZ), names = Object.keys(z.files), doc = await z.file("word/document.xml").async("string"), foot = await z.file("word/footer1.xml").async("string");
    const balanced = (x) => { const st = []; for (const m of x.matchAll(/<(\/?)(w:[A-Za-z]+)[^>]*?(\/?)>/g)) { if (m[3]) continue; if (m[1]) { if (st.pop() !== m[2]) return false; } else st.push(m[2]); } return st.length === 0; };
    check("Word: the parts are there and the XML is balanced", ["[Content_Types].xml", "word/document.xml", "word/styles.xml", "word/footer1.xml", "docProps/core.xml"].every((n) => names.includes(n)) && balanced(doc) && balanced(foot));
    check("Word: bilingual text, fee in words and the draft line in the footer", doc.includes("Audit Dek untuk PT Contoh &lt;Klien&gt;") && doc.includes("lima belas juta rupiah") && doc.includes("fifteen million rupiah") && /DRAF \/ DRAFT/.test(foot) && /PAGE/.test(foot)); }
} catch (e) { check("proposal kit loads in Node", false, e.message); }

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
    const expect = { mismatch: "a figure shown with two values", growth: "a growth rate that does not follow from its figures", headline: "a headline figure missing from its chart", "total-row": "a table total that does not add up", shares: "pie shares that do not make 100%", "no-source": "a data slide without a source", "label-titles": "label titles", language: "a slide in the other language", "draft-marks": "draft markers", fonts: "a stray typeface", stretched: "a stretched picture", "low-res": "a coarse picture", "title-size": "a title in another size", "title-position": "a title out of place", "empty-placeholder": "an empty placeholder" };
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
    // the client report: the reviewer's notes and view around the findings, kept between sessions, set-aside findings left out
    const cr = await pg.evaluate(() => { const A = window.__audit, S = A.S, f = S.result.findings.find((x) => x.code === "total-row"), g = S.result.findings.find((x) => x.code === "draft-marks");
      S.notes[A.noteKey(f)] = "The rows add up to <58>, which the model also shows."; Object.assign(S.client, { client: "Test & Co", deckTitle: "Board pack", reviewer: "A reviewer", overall: "Sound argument.\nFix the figures first.", rebuild: "Slide 3", rebuildWhy: "It carries the argument." }); A.saveReview();
      const html = A.clientReport(); S.dismissed.add(g.id); const without = A.clientReport(); S.dismissed.delete(g.id); const kept = JSON.parse(localStorage.getItem("audit:" + S.deck.name));
      return { html, dropped: html.includes(g.title.replace(/&/g, "&amp;")) && !without.includes(g.title.replace(/&/g, "&amp;")), kept: !!kept && kept.client.client === "Test & Co" && Object.keys(kept.notes).length === 1 }; });
    check("client report: cover, the reviewer's view and the page to rebuild", /<h1>Board pack<\/h1>/.test(cr.html) && /Test &amp; Co/.test(cr.html) && /Sound argument\./.test(cr.html) && /The page to rebuild first/.test(cr.html) && /Fix before it goes out/.test(cr.html) && !/sample report/.test(cr.html));
    check("client report: each finding carries what to do, and the reviewer's note where one was written", (cr.html.match(/What to do\./g) || []).length >= 15 && (cr.html.match(/Our note\./g) || []).length === 1 && cr.html.includes("&lt;58&gt;") && !cr.html.includes("<58>"));
    check("client report: the source reconciliation and the limits of the review are stated", /Figures against the source/.test(cr.html) && /audit-sample-model\.xlsx/.test(cr.html) && /not an audit/.test(cr.html));
    check("client report: findings set aside are left out; notes and client details are kept for the next session", cr.dropped && cr.kept);
    const idb = await pg.evaluate(async () => { const A = window.__audit, { idFinding } = await import("/js/audit/id.js"); const miss = A.S.result.findings.filter((x) => !idFinding(x).ok).map((x) => x.code); A.S.client.lang = "id"; const html = A.clientReport(); A.S.client.lang = "en"; return { miss, html }; });
    check("Indonesian report: every finding of the sample deck is restated, with the source table", idb.miss.length === 0 && /Angka terhadap sumber/.test(idb.html) && /sumber menyebut/.test(idb.html) && /Berbeda: /.test(idb.html) && !/the source says|Figures against the source/.test(idb.html), idb.miss.join());
    await pg.click("#btn-export"); await pg.click("text=Client report…"); const [rdl] = await Promise.all([pg.waitForEvent("download", { timeout: 30000 }), pg.click("text=Save the client report")]);
    check("client report: saved from the Report menu as a file named after the deck", rdl.suggestedFilename() === "Board pack - Deck Audit.html", rdl.suggestedFilename()); await pg.keyboard.press("Escape"); await pg.mouse.click(5, 400);
    // last quarter's deck: the compare menu asks which kind of file it is; the quarterly kind adds restated figures to the findings and the report
    await pg.click("#tabs [data-view=compare]"); await pg.click("#view button:has-text('Compare with another file')"); await pg.click("#menu .menu__item:has-text(\"Last quarter's deck\")"); await pg.setInputFiles("#file-prev", join(root, "app/sample/audit-sample-previous.pptx")); await pg.waitForFunction(() => window.__audit.S.prevKind === "quarter" && window.__audit.S.cmp && !window.__audit.S.busy, null, { timeout: 60000 });
    const qq = await pg.evaluate(() => { const A = window.__audit; A.S.client.period = "Q3 2025"; const html = A.clientReport(); A.S.client.period = ""; return { restated: A.S.result.findings.filter((f) => f.code === "restated").map((f) => f.title), head: document.querySelector("#view h1").textContent, html: /Since last quarter/.test(html) && /Last quarter<\/th>/.test(html) && /Changes since last quarter/.test(html) && /Q3 2025/.test(html) }; });
    check("last quarter: restated figures join the findings, the view and the client report", qq.restated.length === 2 && qq.restated.some((t) => /\(FY25\) was 58 last quarter and is 56 now/.test(t)) && qq.restated.some((t) => /\(FY25\) was 12% last quarter and is 16% now/.test(t)) && /changed without a note/.test(qq.head) && qq.html, JSON.stringify(qq));
    await pg.evaluate(() => { const A = window.__audit; A.S.prev = null; A.S.cmp = null; A.S.prevKind = "version"; });
    await pg.evaluate(() => { window.__audit.S.sources = []; }); await pg.setInputFiles("#file-src", join(root, "test/samples/press-release.docx")); await pg.waitForFunction("window.__audit.S.recon && window.__audit.S.recon.sources[0].kind === 'document' && !window.__audit.S.busy", null, { timeout: 60000 });
    const rd = await pg.evaluate(() => window.__audit.S.recon.summary); check("source check: a Word document as the source", rd.confirmed === 7 && rd.differs === 3, JSON.stringify(rd));
    for (const v of ["slides", "storyline", "numbers", "sources", "compare", "overview"]) await pg.click(`#tabs [data-view=${v}]`);
    // one-click fixes: the mechanical findings are repaired in a corrected copy, the rest remain
    const plan = await pg.evaluate(() => window.__audit.fixPlan().map((p) => p.code).sort().join()); check("fixes: the five mechanical findings are offered", plan === "empty-placeholder,fonts,stretched,title-position,title-size", plan);
    await pg.click("#btn-fix"); const [fdl] = await Promise.all([pg.waitForEvent("download", { timeout: 60000 }), pg.click("#menu .btn--primary")]); const fpath = join(out, "fixed.pptx"); await fdl.saveAs(fpath);
    await pg.waitForFunction("window.__audit.S.fixLog && window.__audit.S.prev && !window.__audit.S.busy", null, { timeout: 60000 });
    const fx = await pg.evaluate(() => ({ name: window.__audit.S.deck.name, codes: window.__audit.S.result.findings.map((f) => f.code).filter((c) => !c.startsWith("source")).sort().join(), log: window.__audit.S.fixLog.log.length, moved: window.__audit.S.cmp.pairs.filter((p) => p.notes.length).length }));
    check("fixes: a corrected copy is saved and audited; only the judgement calls remain", fx.name === "audit-sample - fixed.pptx" && fx.log === 5 && fx.codes === "draft-marks,growth,headline,label-titles,language,low-res,mismatch,no-source,shares,total-row", JSON.stringify(fx));
    if (JSZip) { const z = await JSZip.loadAsync(readFileSync(fpath)), s5 = await z.file("ppt/slides/slide5.xml").async("string"), s6 = await z.file("ppt/slides/slide6.xml").async("string"), o6 = await (await JSZip.loadAsync(readFileSync(join(root, "app/sample/audit-sample.pptx")))).file("ppt/slides/slide6.xml").async("string");
      check("fixes: the file itself is changed as described", !/Times New Roman/.test(s5) && !/type="body"/.test(s5) && /<a:srcRect [^>]*t="\d+"/.test(s6) && /sz="4400"/.test(s6) && !/<a:srcRect/.test(o6) && /^<\?xml/.test(s6)); }
    await pg.setInputFiles("#file", join(root, "test/samples/credentials.pdf")); await pg.waitForFunction("window.__audit.S.deck && window.__audit.S.deck.kind === 'pdf' && !window.__audit.S.busy", null, { timeout: 120000 });
    check("fixes: not offered for a PDF", await pg.evaluate(() => window.__audit.fixPlan().length === 0 && document.getElementById("btn-fix").disabled));
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
    // the benchmark: several decks in, aggregate figures out, no file names in the report
    await pg.goto(`${base}/benchmark.html`); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 20000 });
    await pg.setInputFiles("#file", [join(root, "app/sample/audit-sample.pptx"), join(root, "test/samples/credentials.pdf"), join(root, "test/samples/flat-deck.pptx")]); await pg.waitForFunction(() => window.__bench.S.rows.length === 3 && !window.__bench.S.busy, null, { timeout: 120000 });
    const bz = await pg.evaluate(() => { const B = window.__bench; const before = document.getElementById("btn-report").disabled; Object.assign(B.S.meta, { title: "Test study", selection: "Sample decks" }); B.render(); const h = B.html(); return { before, rows: B.S.rows.map((r) => (r.error ? "error" : `${r.kind}:${r.slides}`)).join(), leak: /audit-sample|credentials|flat-deck/.test(h), n: /2 decks: 1 PowerPoint, 1 PDF/.test(h), after: document.getElementById("btn-report").disabled }; });
    check("benchmark: decks are read one by one, unreadable ones set aside, and the report waits for a title and a stated sample", bz.rows === "pptx:8,pdf:8,error" && bz.before && !bz.after && bz.n && !bz.leak, JSON.stringify(bz));
    // 8. the proposal kit: fill a proposal, see the checks clear, save a Word file and check every part parses
    await pg.goto(`${base}/proposals.html`); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 20000 });
    const pk0 = await pg.evaluate(() => ({ errors: window.__proposals.problems().filter((x) => x.level === "error").length, disabled: document.getElementById("btn-docx").disabled }));
    await pg.locator(".pk__form label.field", { hasText: "Company" }).locator("input").fill("PT Contoh Logistik"); await pg.locator(".pk__form label.field", { hasText: /^Fee/ }).locator("input").fill("15.000.000");
    await pg.evaluate(() => { const P = window.__proposals; Object.assign(P.S.s, { signatory: "A. Signatory", signatoryTitle: "Partner", legalName: "PT Contoh Firma" }); P.render(); }); await pg.waitForTimeout(400);
    const pk1 = await pg.evaluate(() => ({ errors: window.__proposals.problems().filter((x) => x.level === "error").map((x) => x.text), disabled: document.getElementById("btn-docx").disabled, words: document.querySelector(".pk__words").textContent, preview: document.getElementById("preview").srcdoc.includes("Audit Dek untuk PT Contoh Logistik") }));
    check("proposals: the Word and print buttons wait until the client, fee and signatory are in", pk0.errors === 3 && pk0.disabled && pk1.errors.length === 0 && !pk1.disabled && pk1.preview && /lima belas juta rupiah/.test(pk1.words), JSON.stringify(pk1));
    const [wdl] = await Promise.all([pg.waitForEvent("download", { timeout: 30000 }), pg.click("#btn-docx")]); const wpath = join(out, "proposal.docx"); await wdl.saveAs(wpath);
    const parsed = await pg.evaluate(async (b64) => { const z = await window.JSZip.loadAsync(b64, { base64: true }), bad = []; for (const n of Object.keys(z.files).filter((x) => /\.(xml|rels)$/.test(x))) { const d = new DOMParser().parseFromString(await z.file(n).async("string"), "application/xml"); if (d.getElementsByTagName("parsererror").length) bad.push(n); } return { bad, n: Object.keys(z.files).length }; }, readFileSync(wpath).toString("base64"));
    check("proposals: the Word file is named after the reference and every part parses", /^MA-P-\d{4}-\d{2}-\d{3} PT Contoh Logistik Deck Audit\.docx$/.test(wdl.suggestedFilename()) && parsed.bad.length === 0 && parsed.n >= 8, `${wdl.suggestedFilename()} ${JSON.stringify(parsed)}`);
    await pg.locator(".pk__form label.field", { hasText: "Offer" }).locator("select").selectOption("retainer"); await pg.waitForTimeout(300);
    const pk2 = await pg.evaluate(() => ({ offer: window.__proposals.S.p.offer, client: window.__proposals.S.p.client.company, fee: window.__proposals.S.p.fee, kept: Object.keys(JSON.parse(localStorage.getItem("proposals:saved"))).length }));
    check("proposals: changing the offer keeps the client, clears the fee, and the proposal is kept for later", pk2.offer === "retainer" && pk2.client === "PT Contoh Logistik" && pk2.fee === 0 && pk2.kept === 1, JSON.stringify(pk2));
    await pg.click("#btn-brief"); await pg.fill("#brief-text", "From the website:\n" + await pg.evaluate(async () => (await import("/js/proposals/brief.js")).encodeBrief({ lang: "en", offer: "deckAuditQuarterly", company: "PT Brief Test", name: "A. Reader", email: "a@b.test", subject: "the quarterly results decks", audience: "Analysts", decision: "Hold the rating", languages: "en", indonesian: false })));
    await pg.click("#brief-go"); await pg.waitForTimeout(300);
    const pk3 = await pg.evaluate(() => ({ open: document.getElementById("brief").open, offer: window.__proposals.S.p.offer, company: window.__proposals.S.p.client.company, mode: window.__proposals.S.p.mode, preview: document.getElementById("preview").srcdoc.includes("Audience: Analysts") }));
    check("proposals: Import brief starts a new proposal from a brief code", !pk3.open && pk3.offer === "deckAuditQuarterly" && pk3.company === "PT Brief Test" && pk3.mode === "en" && pk3.preview, JSON.stringify(pk3));
    check("no script errors", errors.length === 0, errors.slice(0, 2).join(" ; "));
  } catch (e) { check("browser run completed", false, e.message.split("\n")[0]); }
  await browser.close(); console.log(`  (files written to ${out}: ${readdirSync(out).length})`);
}
console.log(`\n${failed ? "FAILED" : "PASSED"}: ${passed} checks ok${failed ? `, ${failed} failed` : ""}.`);
stop(); process.exit(failed ? 1 : 0);
