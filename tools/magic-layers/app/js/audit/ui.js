// Deck Auditor — interface: open a deck, run the audit, browse findings by pillar and by slide, read the storyline
// and the figures ledger, compare with a previous version, export the report.
import { readPptx } from "./pptx.js";
import { readPdf } from "./pdfdeck.js";
import { audit } from "./checks.js";
import { compareDecks } from "./compare.js";
import { reportHtml, clientReportHtml, findingsCsv, labels } from "./report.js";
import { readSource, reconcile, sourceFindings, sourceLocation } from "./sources.js";
import { fixPlan, applyFixes } from "./fix.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const { PILLAR, SEV, KIND } = labels;
const S = { notes: {}, client: {}, sources: [], recon: null, srcFilter: "all", deck: null, result: null, view: "overview", slide: 1, focus: null, filter: { pillar: "all", sev: "all", slideOnly: false }, dismissed: new Set(), open: new Set(), prev: null, cmp: null, ai: { available: false }, aiReview: null, brand: null, useBrand: false, busy: false, query: "" };

/* ---------- feedback ---------- */
function toast(msg, kind = "") { const t = el("div", `toast${kind ? ` toast--${kind}` : ""}`, msg); $("toasts").appendChild(t); setTimeout(() => t.remove(), kind === "error" ? 7000 : 3600); }
function progress(title, step = "", frac = null) { $("progress").hidden = false; $("progress-title").textContent = title; $("progress-step").textContent = step; if (frac != null) $("progress-bar").style.width = `${Math.round(frac * 100)}%`; }
async function busy(title, fn) { if (S.busy) return null; S.busy = true; progress(title, "", 0.05); try { return await fn(); } catch (e) { console.error(e); toast(e.message || "Something went wrong.", "error"); return null; } finally { S.busy = false; $("progress").hidden = true; $("progress-bar").style.width = "0"; } }
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

/* ---------- opening ---------- */
async function read(file, title) { if (/\.pptx$/i.test(file.name)) return readPptx(file, (s, f) => progress(title, s, f * 0.9)); if (/\.pdf$/i.test(file.name)) return readPdf(file, (s, f) => progress(title, s, f * 0.9)); if (/\.ppt$/i.test(file.name)) throw new Error("Old .ppt files cannot be read. Save the deck as .pptx in PowerPoint and open that."); throw new Error("Open a PowerPoint (.pptx) or PDF file."); }
async function open(file) {
  if (!file) return;
  const deck = await busy("Reading the deck", async () => { const d = await read(file, "Reading the deck"); if (!d.slides.length) throw new Error("This file has no slides."); progress("Auditing", "Comparing figures, titles and design", 0.95); await new Promise((r) => setTimeout(r, 30)); return d; });
  if (!deck) return;
  if (!S.keepFix) S.fixLog = null; S.file = file;
  Object.assign(S, { sources: [], recon: null, deck, slide: 1, focus: null, dismissed: new Set(), open: new Set(), prev: null, cmp: null, aiReview: null, view: "overview", filter: { pillar: "all", sev: "all", slideOnly: false }, query: "" });
  loadReview(); run(); const r = S.result, hi = r.findings.filter((f) => f.severity === "high").length;
  toast(`${deck.slides.length} slides audited: ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}${hi ? `, ${hi} to fix` : ""}.`);
}
function run() {
  S.result = audit(S.deck, { brand: S.useBrand ? S.brand : null }); if (S.prev) S.cmp = compareDecks(S.prev, S.deck, S.result.lang);
  S.recon = S.sources.length ? reconcile(S.result.facts, S.sources) : null;
  if (S.recon) { const order = { high: 0, medium: 1, low: 2 }; sourceFindings(S.recon).forEach((f, i) => S.result.findings.push({ id: `src${i + 1}`, pillar: "numbers", slides: f.slide ? [f.slide] : [], refs: f.slide && f.shapeId ? [{ slide: f.slide, shapeId: f.shapeId }] : [], ...f })); S.result.findings.sort((a, b) => order[a.severity] - order[b.severity] || (a.slides[0] || 0) - (b.slides[0] || 0)); }
  render();
}
// One-click fixes: choose what to repair, save a corrected copy, then show the audit of that copy against the original.
function fixMenu(anchor) {
  const plan = fixPlan(S.deck, S.result, S.dismissed), m = $("menu"); m.textContent = ""; const f = el("div", "menu__form"); f.style.minWidth = "420px";
  f.appendChild(el("b", "", "Save a corrected copy"));
  if (!plan.length) f.appendChild(el("p", "doc__meta", S.deck.kind !== "pptx" ? "Fixes are written into PowerPoint files. Open the .pptx to use them." : "None of the open findings has a mechanical fix. The rest need a decision: wording, figures, sources."));
  const boxes = plan.map((p) => { const l = el("label"), c = el("input"); c.type = "checkbox"; c.checked = true; c.value = p.code; l.style.cssText = "display:flex;gap:8px;align-items:flex-start;white-space:normal;line-height:1.35"; l.appendChild(c); l.appendChild(document.createTextNode(p.label)); f.appendChild(l); return c; });
  if (plan.length) { const go = el("button", "btn btn--primary btn--block", "Save the corrected copy"); go.addEventListener("click", () => { m.hidden = true; fix(boxes.filter((c) => c.checked).map((c) => c.value)); }); f.appendChild(go); const note = el("p", "doc__meta", "The original file is not changed. Findings about wording, figures and sources are left for you."); note.style.whiteSpace = "normal"; f.appendChild(note); }
  m.appendChild(f); m.hidden = false; const r = anchor.getBoundingClientRect(); m.style.top = `${r.bottom + 6}px`; m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
}
async function fix(codes) {
  if (!codes.length) return; const before = S.deck, n0 = S.result.findings.filter((x) => !S.dismissed.has(x.id)).length, sources = S.sources;
  const out = await busy("Fixing", async () => { progress("Fixing", "Writing the corrected copy", 0.5); return applyFixes(S.file, S.deck, S.result, codes); }); if (!out) return;
  if (!out.log.length) return toast("Nothing needed changing.", "error");
  const name = S.deck.name.replace(/( - fixed)?\.pptx$/i, " - fixed.pptx"), fixed = new File([out.blob], name); download(out.blob, name);
  S.keepFix = true; S.fixLog = { log: out.log, from: before.name, before: n0 }; try { await open(fixed); } finally { S.keepFix = false; }
  if (S.deck && S.deck.name === name) { S.prev = before; S.sources = sources; run(); toast(`${name} saved. ${out.log.length} kind${out.log.length > 1 ? "s" : ""} of fix applied; ${S.result.findings.length} finding${S.result.findings.length === 1 ? "" : "s"} remain.`); }
}
async function openSources(files) {
  if (!files.length || !S.deck) return; const got = await busy("Reading the source", async () => { const out = []; for (const f of files) { progress("Reading the source", f.name, 0.4); out.push(await readSource(f, (st, fr) => progress("Reading the source", `${f.name}: ${st}`, fr * 0.9))); } return out; }); if (!got) return;
  const empty = got.filter((g) => !g.facts.length); if (empty.length) toast(`No figures could be read from ${empty.map((g) => g.name).join(", ")}.`, "error");
  S.sources = S.sources.filter((x) => !got.some((g) => g.name === x.name)).concat(got.filter((g) => g.facts.length)); if (!S.sources.length) return; S.view = "sources"; S.srcFilter = "all"; run();
  const c = S.recon.summary; toast(`${c.total} figures checked: ${c.confirmed + c.derived} traced, ${c.differs} differ, ${c.missing} not found.`);
}
const STATUS = { differs: "Differs", missing: "Not found", found: "Value found", derived: "Derived", confirmed: "Confirmed" };
function viewSources(v) {
  if (!S.recon) { v.appendChild(el("h1", "", "Check the deck against its source")); v.appendChild(el("p", "lede", "Open the Excel model the figures came from, or a second document that must say the same thing: the annual report, a press release, another deck. Every figure in the deck is looked up in it. Amounts are matched across scales (a model in Rp million against a deck in Rp trillion) and rounded to the precision the deck shows."));
    const tb = el("div", "toolbar2"), b = el("button", "btn btn--primary btn--lg", "Open a source"); b.addEventListener("click", () => $("file-src").click()); tb.appendChild(b);
    if (/^audit-sample\.pptx$/i.test(S.deck.name)) { const sm = el("button", "btn btn--lg", "Use the sample model"); sm.addEventListener("click", async () => openSources([new File([await (await fetch("/sample/audit-sample-model.xlsx")).blob()], "audit-sample-model.xlsx")])); tb.appendChild(sm); }
    v.appendChild(tb); v.appendChild(el("p", "previewnote", "Excel (.xlsx), CSV, PDF, Word (.docx) or PowerPoint (.pptx). Several sources can be open at once.")).style.textAlign = "left"; return; }
  const c = S.recon.summary, traced = c.confirmed + c.derived;
  v.appendChild(el("h1", "", c.differs ? `${c.differs} figure${c.differs > 1 ? "s" : ""} in the deck differ${c.differs > 1 ? "" : "s"} from the source` : `${traced} of ${c.total} figures are traced to the source`));
  v.appendChild(el("p", "lede", `Checked against ${S.recon.sources.map((x) => `${x.name} (${x.figures.toLocaleString("en")} figures, ${x.note})`).join(" and ")}. ${c.confirmed} confirmed, ${c.derived} derived from it, ${c.found} found by value only, ${c.missing} not found. A figure is confirmed when the source holds the same value under labels that agree; "value only" means the number is there but its labels could not be matched, so look before relying on it.`));
  const tb = el("div", "toolbar2"); for (const k of ["all", "differs", "missing", "found", "derived", "confirmed"]) { const n = k === "all" ? c.total : c[k], b = el("button", `btn${S.srcFilter === k ? " btn--primary" : ""}`, `${k === "all" ? "All" : STATUS[k]} ${n}`); b.addEventListener("click", () => { S.srcFilter = k; render(); }); tb.appendChild(b); }
  const add = el("button", "link", "Add a source"), clr = el("button", "link", "Remove the sources"); add.addEventListener("click", () => $("file-src").click()); clr.addEventListener("click", () => { S.sources = []; run(); }); tb.appendChild(add); tb.appendChild(clr); v.appendChild(tb);
  const t = el("table", "tbl"); t.innerHTML = "<thead><tr><th>Slide</th><th>Figure</th><th>Described as</th><th>Status</th><th>In the source</th></tr></thead>"; const body = el("tbody"), order = { differs: 0, missing: 1, found: 2, derived: 3, confirmed: 4 }, cls = { differs: "mismatch", missing: "label", found: "precision", derived: "precision", confirmed: "action" };
  const items = S.recon.items.filter((i) => S.srcFilter === "all" || i.status === S.srcFilter).sort((a, b) => order[a.status] - order[b.status] || a.fact.slide - b.fact.slide);
  if (!items.length) { const tr = el("tr"), td = el("td", "none", "Nothing under this filter."); td.colSpan = 5; tr.appendChild(td); body.appendChild(tr); }
  for (const i of items.slice(0, 600)) { const tr = el("tr"); tr.style.cursor = "default"; const a = el("td", "n"); a.appendChild(slideChip(i.fact.slide)); tr.appendChild(a); const fg = el("td", "", i.fact.raw); fg.style.fontWeight = "600"; fg.style.whiteSpace = "nowrap"; tr.appendChild(fg);
    const d = el("td", "", i.fact.context.length > 84 ? `${i.fact.context.slice(0, 82)}…` : i.fact.context); d.title = i.fact.context; tr.appendChild(d);
    const st = el("td"); st.appendChild(el("span", `chipk chipk--${cls[i.status]}`, STATUS[i.status])); tr.appendChild(st);
    const so = el("td"); if (i.source) { so.appendChild(document.createTextNode(i.status === "differs" ? `${i.sourceValue} — ${i.note}` : i.note)); const sm = el("div", "doc__meta", sourceLocation(i.source)); sm.style.whiteSpace = "normal"; so.appendChild(sm); } else so.appendChild(el("span", "doc__meta", "—")); tr.appendChild(so); body.appendChild(tr); }
  t.appendChild(body); v.appendChild(t);
}
async function openPrevious(file) {
  if (!file || !S.deck) return; const prev = await busy("Reading the previous version", () => read(file, "Reading the previous version")); if (!prev) return;
  S.prev = prev; S.cmp = compareDecks(prev, S.deck, S.result.lang); S.view = "compare"; render(); const c = S.cmp.summary; toast(`Compared with ${prev.name}: ${c.changed} changed, ${c.added} added, ${c.removed} removed.`);
}
async function sample() { const get = async (n) => new File([await (await fetch(`/sample/${n}`)).blob()], n); await open(await get("audit-sample.pptx")); }

/* ---------- slide preview ---------- */
function chartSvg(ch) { const ser = ch.series[0]; if (!ser || !ser.values.length) return ""; const v = ser.values.map((x) => (Number.isFinite(x) ? x : 0)), max = Math.max(...v.map(Math.abs), 1e-9), n = v.length, w = 100 / n; return `<svg viewBox="0 0 100 40" preserveAspectRatio="none">${v.map((x, i) => `<rect x="${i * w + w * 0.18}" y="${40 - (Math.abs(x) / max) * 36}" width="${w * 0.64}" height="${(Math.abs(x) / max) * 36}" fill="${i === n - 1 ? "#C09200" : "#CFC9BC"}"/>`).join("")}</svg>`; }
function drawSlide(host, deck, s, marks = []) {
  const avail = Math.max(320, host.clientWidth), k = Math.min(avail / deck.width, (window.innerHeight - 250) / deck.height), wrap = el("div", "slidewrap"); const W = (s.pageW || deck.width), H = (s.pageH || deck.height);
  wrap.style.width = `${W * k}px`; wrap.style.height = `${H * k}px`; wrap.style.background = s.background || "#fff";
  if (s.canvas) { const c = document.createElement("canvas"); c.width = s.canvas.width; c.height = s.canvas.height; c.getContext("2d").drawImage(s.canvas, 0, 0); wrap.appendChild(c); }
  else for (const sh of s.shapes) {
    if (!sh.hasBox) continue; const d = el("div", `sh sh--${sh.kind}`); Object.assign(d.style, { left: `${sh.x * k}px`, top: `${sh.y * k}px`, width: `${sh.w * k}px`, height: `${sh.h * k}px` });
    if (sh.kind === "picture" && sh.image) { const im = new Image(); im.src = sh.image.url; im.alt = ""; d.appendChild(im); }
    else if (sh.kind === "table" && sh.rows) { const t = el("table"); t.style.fontSize = `${Math.max(5, ((sh.size || 12)) * k)}px`; for (const r of sh.rows) { const tr = el("tr"); for (const c of r) tr.appendChild(el("td", "", c)); t.appendChild(tr); } d.appendChild(t); }
    else if (sh.kind === "chart") { d.innerHTML = `<small>${sh.chart ? `${sh.chart.type} chart${sh.chart.title ? ` · ${sh.chart.title.replace(/[<&]/g, "")}` : ""}` : "chart"}</small>${sh.chart ? chartSvg(sh.chart) : ""}`; }
    else { if (sh.fill) { d.style.background = sh.fill; if (sh.geom === "ellipse") d.style.borderRadius = "50%"; else if (sh.geom === "roundRect") d.style.borderRadius = `${Math.min(sh.w, sh.h) * k * 0.12}px`; }
      const def = sh.role === "title" ? 28 : 18; if (sh.anchor === "b" || sh.anchor === "ctr") { d.style.display = "flex"; d.style.flexDirection = "column"; d.style.justifyContent = sh.anchor === "b" ? "flex-end" : "center"; }
      for (const p of sh.paras) { const pe = el("p"); pe.style.paddingLeft = `${(p.level || 0) * 1.1 + (p.bullet ? 1 : 0)}em`; if (p.align === "ctr") pe.style.textAlign = "center"; else if (p.align === "r") pe.style.textAlign = "right"; if (p.bullet && p.text.trim()) { pe.style.textIndent = "-1em"; pe.appendChild(document.createTextNode("• ")); }
        for (const r of p.runs) { const sp = el("span", "", r.text); sp.style.fontSize = `${Math.max(4, (r.size || def) * k)}px`; if (r.font) sp.style.fontFamily = `"${r.font}", var(--font)`; if (r.bold || sh.role === "title") sp.style.fontWeight = 600; if (r.italic) sp.style.fontStyle = "italic"; if (r.color) sp.style.color = r.color; pe.appendChild(sp); }
        if (!p.runs.length) pe.innerHTML = "&nbsp;"; d.appendChild(pe); } }
    wrap.appendChild(d);
  }
  for (const m of marks) { const sh = s.shapes.find((x) => x.id === m.shapeId); if (!sh || !sh.hasBox) continue; const h = el("div", `hl hl--${m.severity}`); Object.assign(h.style, { left: `${sh.x * k - 4}px`, top: `${sh.y * k - 4}px`, width: `${sh.w * k + 8}px`, height: `${sh.h * k + 8}px` }); wrap.appendChild(h); }
  host.appendChild(wrap);
}

/* ---------- reviewer's notes and client details (kept in this browser, per deck) ---------- */
const noteKey = (f) => `${f.code}|${f.slides.join(",")}|${f.title.slice(0, 48)}`;
const storeKey = () => `audit:${S.deck ? S.deck.name : ""}`;
function saveReview() { try { localStorage.setItem(storeKey(), JSON.stringify({ notes: S.notes, client: S.client })); } catch (e) { /* private mode */ } }
function loadReview() { S.notes = {}; S.client = {}; try { const j = JSON.parse(localStorage.getItem(storeKey()) || "null"); if (j) { S.notes = j.notes || {}; S.client = j.client || {}; } } catch (e) { /* start clean */ } }
const clientReport = () => clientReportHtml(S.deck, S.result, { dismissed: S.dismissed, notes: Object.fromEntries(S.result.findings.filter((f) => S.notes[noteKey(f)]).map((f) => [f.id, S.notes[noteKey(f)]])), client: S.client, recon: S.recon, compare: S.cmp ? { name: S.prev.name, result: S.cmp } : null });
function clientForm(anchor) {
  const m = $("menu"); m.textContent = ""; const f = el("div", "menu__form"); f.style.cssText = "min-width:460px;max-height:78vh;overflow:auto"; f.appendChild(el("b", "", "Client report"));
  const field = (key, label, ph, area) => { const l = el("label", "field"); l.appendChild(el("span", "", label)); const i = el(area ? "textarea" : "input"); if (!area) i.type = "text"; else i.rows = area; i.placeholder = ph; i.value = S.client[key] || ""; i.addEventListener("input", () => { S.client[key] = i.value; saveReview(); }); l.appendChild(i); f.appendChild(l); };
  field("client", "Prepared for", "Client name"); field("deckTitle", "Deck", S.deck.name.replace(/\.(pptx|pdf)$/i, "")); field("purpose", "For", "Board meeting, 12 December"); field("reviewer", "Reviewed by", "Your name");
  field("overall", "Our view", "Two or three sentences: what the deck says today, what it should say, what matters most. Left empty, a factual summary is used.", 4);
  field("rebuild", "The page to rebuild first", "Slide 3: EBITDA margin"); field("rebuildWhy", "Why that page", "One or two sentences.", 2);
  const withNotes = S.result.findings.filter((x) => S.notes[noteKey(x)] && !S.dismissed.has(x.id)).length, open = S.result.findings.filter((x) => !S.dismissed.has(x.id)).length;
  const p = el("p", "doc__meta", `${open} findings will be included, ${withNotes} with your note. Add a note by opening a finding on the right; set aside the ones that are not issues.`); p.style.whiteSpace = "normal"; f.appendChild(p);
  const go = el("button", "btn btn--primary btn--block", "Save the client report"); go.addEventListener("click", () => { m.hidden = true; download(new Blob([clientReport()], { type: "text/html" }), `${(S.client.deckTitle || S.deck.name.replace(/\.(pptx|pdf)$/i, "")).replace(/[\\/:*?"<>|]+/g, " ")} - Deck Audit.html`); toast("Report saved. Open it and print to PDF to send it."); }); f.appendChild(go);
  m.appendChild(f); m.hidden = false; const r = anchor.getBoundingClientRect(); m.style.top = `${r.bottom + 6}px`; m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
}

/* ---------- findings panel ---------- */
const visible = () => S.result.findings.filter((f) => (S.filter.pillar === "all" || f.pillar === S.filter.pillar) && (S.filter.sev === "all" || f.severity === S.filter.sev) && (!S.filter.slideOnly || f.slides.includes(S.slide)));
function goSlide(n, focus = null) { S.slide = n; S.focus = focus; S.view = "slides"; render(); }
function slideChip(n, f) { const b = el("button", "sl", String(n)); b.title = `Go to slide ${n}`; b.addEventListener("click", (e) => { e.stopPropagation(); goSlide(n, f ? f.id : null); }); return b; }
function findingCard(f, compact = false) {
  const c = el("article", `finding finding--${f.severity}${S.dismissed.has(f.id) ? " is-off" : ""}${S.focus === f.id ? " is-on" : ""}`); c.dataset.id = f.id;
  const h = el("header"); h.appendChild(el("b", "", SEV[f.severity])); h.appendChild(el("h3", "", f.title)); c.appendChild(h);
  c.appendChild(el("small", "", `${PILLAR[f.pillar]}${f.slides.length ? ` · slide${f.slides.length > 1 ? "s" : ""} ${f.slides.slice(0, 8).join(", ")}${f.slides.length > 8 ? "…" : ""}` : ""}`));
  if (S.open.has(f.id) || compact) { const m = el("div", "more"); m.appendChild(el("p", "", f.detail)); if (f.slides.length && !compact) { const ch = el("div", "chips"); f.slides.slice(0, 40).forEach((n) => ch.appendChild(slideChip(n, f))); m.appendChild(ch); }
    if (!compact) { const ta = el("textarea", "note"); ta.rows = 2; ta.placeholder = "Your note for the client report (optional)"; ta.value = S.notes[noteKey(f)] || ""; ta.setAttribute("aria-label", "Note for the client report"); ta.addEventListener("click", (e) => e.stopPropagation()); ta.addEventListener("input", () => { if (ta.value.trim()) S.notes[noteKey(f)] = ta.value; else delete S.notes[noteKey(f)]; saveReview(); }); m.appendChild(ta); }
    const acts = el("div", "acts"), off = el("button", "link", S.dismissed.has(f.id) ? "Reopen" : "Set aside"); off.title = "Mark as reviewed and not an issue; it leaves the report"; off.addEventListener("click", (e) => { e.stopPropagation(); if (S.dismissed.has(f.id)) S.dismissed.delete(f.id); else S.dismissed.add(f.id); render(); }); acts.appendChild(off); m.appendChild(acts); c.appendChild(m); }
  h.addEventListener("click", () => { if (compact) return; if (S.open.has(f.id)) S.open.delete(f.id); else S.open.add(f.id); S.focus = f.id; if (f.slides.length && S.view === "slides" && !f.slides.includes(S.slide)) S.slide = f.slides[0]; render(); });
  return c;
}
function renderSide() {
  const r = S.result, fl = $("filters"); fl.textContent = "";
  const chip = (label, on, fn) => { const b = el("button", on ? "is-on" : "", label); b.addEventListener("click", fn); fl.appendChild(b); };
  const cnt = (p) => r.findings.filter((f) => (p === "all" || f.pillar === p) && !S.dismissed.has(f.id)).length;
  chip(`All ${cnt("all")}`, S.filter.pillar === "all", () => { S.filter.pillar = "all"; render(); });
  for (const p of ["numbers", "structure", "design"]) chip(`${PILLAR[p].split(" ")[0] === "Numbers" ? "Numbers" : p === "structure" ? "Structure" : "Design"} ${cnt(p)}`, S.filter.pillar === p, () => { S.filter.pillar = p; render(); });
  for (const s of ["high", "medium", "low"]) chip(SEV[s], S.filter.sev === s, () => { S.filter.sev = S.filter.sev === s ? "all" : s; render(); });
  if (S.view === "slides") chip("This slide", S.filter.slideOnly, () => { S.filter.slideOnly = !S.filter.slideOnly; render(); });
  const list = $("findings"); list.textContent = ""; const vis = visible();
  if (!vis.length) list.appendChild(el("p", "none", r.findings.length ? "Nothing under this filter." : "No issues detected. Read it through once more all the same."));
  for (const f of vis) list.appendChild(findingCard(f));
  $("find-count").textContent = `${r.findings.filter((f) => !S.dismissed.has(f.id)).length} open${S.dismissed.size ? ` · ${S.dismissed.size} set aside` : ""}`;
  const on = list.querySelector(".is-on"); if (on) on.scrollIntoView({ block: "nearest" });
}
function renderRail() {
  const rail = $("rail"); rail.textContent = "";
  for (const s of S.deck.slides) { const b = el("button", s.index === S.slide && S.view === "slides" ? "is-on" : ""); b.appendChild(el("b", "", String(s.index))); b.appendChild(el("span", s.title ? "" : "untitled", s.title ? s.title.text : s.hidden ? "Hidden slide" : "No title"));
    const dots = el("div", "dots"), fs = S.result.findings.filter((f) => f.slides.includes(s.index) && !S.dismissed.has(f.id)); for (const sev of ["high", "medium", "low"]) if (fs.some((f) => f.severity === sev)) dots.appendChild(el("i", `dot dot--${sev}`)); b.appendChild(dots); b.title = fs.length ? `${fs.length} finding${fs.length > 1 ? "s" : ""}` : "No findings";
    b.addEventListener("click", () => goSlide(s.index)); rail.appendChild(b); }
  const on = rail.querySelector(".is-on"); if (on) on.scrollIntoView({ block: "nearest" });
}

/* ---------- views ---------- */
function viewOverview(v) {
  const r = S.result, d = S.deck, open = r.findings.filter((f) => !S.dismissed.has(f.id)), hi = open.filter((f) => f.severity === "high").length;
  v.appendChild(el("h1", "", hi ? `${hi} thing${hi > 1 ? "s" : ""} to fix before this deck goes out` : open.length ? "Nothing critical; a few points to check" : "No issues detected"));
  v.appendChild(el("p", "lede", `${r.stats.slides} slides, ${r.stats.words.toLocaleString("en")} words and ${r.stats.figures} figures were read${d.kind === "pdf" ? " from the PDF. Table totals, chart data and typefaces can only be checked in the PowerPoint file." : "."}${r.document ? " The pages are portrait, so this was read as a report: the slide rules for density and type size were not applied." : ""} Findings are prompts to look, sorted by how much a reader would mind.`));
  if (S.fixLog) { const c = el("div", "card"); c.style.cssText = "margin-bottom:14px;border-left:4px solid #2E6B3A"; c.appendChild(el("h2", "", "This is the corrected copy")).style.marginTop = "0"; const ul = el("ul"); ul.style.cssText = "margin:0 0 8px;padding-left:18px"; S.fixLog.log.forEach((t) => ul.appendChild(el("li", "", t))); c.appendChild(ul); c.appendChild(el("p", "doc__meta", `Made from ${S.fixLog.from}, which is unchanged. ${S.fixLog.before} findings before, ${open.length} now. Open the Compare tab to see what moved; check the corrected slides in PowerPoint before sending.`)).style.whiteSpace = "normal"; v.appendChild(c); }
  const ps = el("div", "pillars"), blurb = { numbers: "Every figure agrees with every other mention of it and with its own arithmetic.", structure: "An answer-first storyline, carried by titles that state conclusions.", design: "One typographic system, one grid, nothing left over from drafting." };
  for (const p of ["numbers", "structure", "design"]) { const fs = open.filter((f) => f.pillar === p), c = (s) => fs.filter((f) => f.severity === s).length, b = el("button", "card pillar"); b.innerHTML = `<small>${PILLAR[p]}</small><strong>${fs.length}<i>finding${fs.length === 1 ? "" : "s"}</i></strong><div class="bar">${fs.length ? `<i class="h" style="flex:${c("high")}"></i><i class="m" style="flex:${c("medium")}"></i><i class="l" style="flex:${c("low")}"></i>` : ""}</div>`; b.appendChild(el("p", "", fs.length ? `${c("high")} to fix · ${c("medium")} to check · ${c("low")} to polish` : blurb[p])); b.addEventListener("click", () => { S.filter.pillar = p; S.filter.sev = "all"; render(); }); ps.appendChild(b); }
  v.appendChild(ps);
  const fx = el("div", "facts"), fact = (n, l) => { const x = el("div"); x.appendChild(el("b", "", n)); x.appendChild(el("span", "", l)); fx.appendChild(x); };
  fact(`${r.stats.actionShare}%`, "of titles state a conclusion"); fact(String(r.groups.filter((g) => g.status === "mismatch").length), "figures that disagree"); fact(String(r.groups.length), "figures shown more than once"); fact(r.lang === "id" ? "Indonesian" : "English", "language of the deck"); v.appendChild(fx);
  const top = open.slice(0, 5); if (top.length) { v.appendChild(el("h2", "", "Start here")); const g = el("div", "slidefinds"); top.forEach((f) => { const c = findingCard(f, true); const ch = el("div", "chips"); f.slides.slice(0, 12).forEach((n) => ch.appendChild(slideChip(n, f))); c.querySelector(".more").insertBefore(ch, c.querySelector(".acts")); g.appendChild(c); }); v.appendChild(g); }
  if (d.fonts && d.fonts.length) { v.appendChild(el("h2", "", "Typefaces in the deck")); const c = el("div", "card"); d.fonts.slice(0, 8).forEach((f, i) => { const row = el("div", `fontrow${i >= 2 && f.share < 8 ? " is-stray" : ""}`); const nm = el("span", "", f.font); nm.style.fontFamily = `"${f.font}", var(--font)`; row.appendChild(nm); const bar = el("div"); bar.innerHTML = `<i style="width:${Math.max(1, f.share)}%"></i>`; row.appendChild(bar); row.appendChild(el("span", "doc__meta", `${f.share < 1 ? "<1" : f.share}%`)); c.appendChild(row); });
    if (S.brand) { const lb = el("label"); lb.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px;color:#44423E"; const cb = el("input"); cb.type = "checkbox"; cb.checked = S.useBrand; cb.addEventListener("change", () => { S.useBrand = cb.checked; run(); }); lb.appendChild(cb); lb.appendChild(document.createTextNode(`This is a Metanoia deck: flag every typeface other than ${S.brand.fonts.heading} and ${S.brand.fonts.body}`)); c.appendChild(lb); } v.appendChild(c); }
}
function viewSlides(v) {
  const d = S.deck, s = d.slides[S.slide - 1], bar = el("div", "stagebar");
  const prev = el("button", "btn", "‹"), next = el("button", "btn", "›"); prev.disabled = S.slide <= 1; next.disabled = S.slide >= d.slides.length; prev.title = "Previous slide (←)"; next.title = "Next slide (→)"; prev.addEventListener("click", () => goSlide(S.slide - 1)); next.addEventListener("click", () => goSlide(S.slide + 1));
  bar.appendChild(prev); bar.appendChild(el("span", "doc__meta", `${S.slide} / ${d.slides.length}`)); bar.appendChild(next); const h = el("h1", "", s.title ? s.title.text : "No title"); bar.appendChild(h); if (s.titleKind) bar.appendChild(el("span", `chipk chipk--${s.titleKind}`, KIND[s.titleKind])); v.appendChild(bar);
  const fs = S.result.findings.filter((f) => f.slides.includes(s.index) && !S.dismissed.has(f.id)), shown = S.focus && fs.some((f) => f.id === S.focus) ? fs.filter((f) => f.id === S.focus) : fs;
  const marks = shown.flatMap((f) => f.refs.filter((r) => r.slide === s.index).map((r) => ({ shapeId: r.shapeId, severity: f.severity })));
  const host = el("div"); v.appendChild(host); drawSlide(host, d, s, marks);
  v.appendChild(el("p", "previewnote", d.kind === "pdf" ? "Outlined areas are the ones the findings refer to." : "Layout preview built from the file's text, tables and pictures; artwork from the slide master is not drawn. Outlined areas are the ones the findings refer to."));
  const g = el("div", "slidefinds"); if (!fs.length) g.appendChild(el("p", "none", "No findings on this slide.")); fs.forEach((f) => g.appendChild(findingCard(f, true))); v.appendChild(g);
}
function viewStoryline(v) {
  const r = S.result; v.appendChild(el("h1", "", "The storyline, read from the titles alone"));
  v.appendChild(el("p", "lede", `A senior reader pages through the titles first. ${r.stats.actionShare}% of the titles here state a conclusion; the rest name a topic and leave the reader to work out the point.`));
  const tb = el("div", "toolbar2"), copy = el("button", "btn", "Copy the titles"); copy.addEventListener("click", async () => { const t = S.deck.slides.map((s) => `${s.index}. ${s.title ? s.title.text : "(no title)"}`).join("\n"); try { await navigator.clipboard.writeText(t); toast("Titles copied."); } catch (e) { toast("Copying is blocked by the browser.", "error"); } }); tb.appendChild(copy);
  const aib = el("button", "btn btn--ai", "Review the storyline with AI"); aib.disabled = !S.ai.available; aib.title = S.ai.available ? "Claude reads the titles and slide text and comments on the argument. The deck's text is sent to the Anthropic API." : "Optional. Add an Anthropic API key to a .env file in the app folder to switch this on (see README)."; aib.addEventListener("click", aiReview); tb.appendChild(aib); v.appendChild(tb);
  if (S.aiReview) { const a = S.aiReview, c = el("div", "card ai"); c.appendChild(el("h3", "", "Storyline review (AI-assisted)")); c.appendChild(el("p", "", a.summary)); for (const o of a.observations || []) { const p = el("p"); p.appendChild(el("strong", "", `${o.title}. `)); p.appendChild(document.createTextNode(o.detail + " ")); (o.slides || []).filter((n) => n >= 1 && n <= S.deck.slides.length).slice(0, 8).forEach((n) => p.appendChild(slideChip(n))); c.appendChild(p); } if (a.rebuildFirst) { const p = el("p"); p.appendChild(el("strong", "", "Rebuild first: ")); p.appendChild(document.createTextNode(`${a.rebuildFirst.page}. ${a.rebuildFirst.why} Suggested title: “${a.rebuildFirst.actionTitle}”`)); c.appendChild(p); } c.style.marginBottom = "14px"; v.appendChild(c); }
  const t = el("table", "tbl"); t.innerHTML = "<thead><tr><th>#</th><th>Title</th><th>Reads as</th><th style=\"text-align:right\">Words on slide</th></tr></thead>"; const body = el("tbody");
  for (const s of S.deck.slides) { const tr = el("tr"); tr.appendChild(el("td", "n", String(s.index))); const td = el("td", "", s.title ? s.title.text : "No title"); if (!s.title) td.style.cssText = "color:var(--muted);font-style:italic"; else if (s.titleKind === "action") td.style.fontWeight = "500"; tr.appendChild(td); const k = el("td"); k.appendChild(el("span", `chipk chipk--${s.titleKind}`, s.hidden ? "Hidden" : KIND[s.titleKind] || "")); tr.appendChild(k); tr.appendChild(el("td", "r", String(s.words))); tr.addEventListener("click", () => goSlide(s.index)); body.appendChild(tr); }
  t.appendChild(body); v.appendChild(t);
}
function viewNumbers(v) {
  const r = S.result, mism = r.groups.filter((g) => g.status === "mismatch").length; v.appendChild(el("h1", "", mism ? `${mism} figure${mism > 1 ? "s" : ""} disagree with ${mism > 1 ? "themselves" : "itself"}` : "Figures shown more than once agree"));
  v.appendChild(el("p", "lede", `${r.stats.figures} figures were read from text, tables and chart data. Those that describe the same thing in the same period are listed together, so each can be checked in one glance. Figures are matched by the words around them; a pairing that is not the same metric can be ignored.`));
  const tb = el("div", "toolbar2"), q = el("input", "search"); q.placeholder = "Find a metric or a number"; q.value = S.query; q.addEventListener("input", () => { S.query = q.value; fill(); }); tb.appendChild(q); v.appendChild(tb);
  const t = el("table", "tbl"); t.innerHTML = "<thead><tr><th>Metric</th><th>Period</th><th>Shown as</th><th></th></tr></thead>"; const body = el("tbody"); t.appendChild(body); v.appendChild(t);
  const order = { mismatch: 0, precision: 1, match: 2 }, label = { mismatch: "Disagree", precision: "Rounding differs", match: "Agree" };
  const fill = () => { body.textContent = ""; const needle = S.query.trim().toLowerCase(); const gs = r.groups.filter((g) => !needle || g.label.includes(needle) || g.facts.some((f) => f.raw.toLowerCase().includes(needle) || f.context.toLowerCase().includes(needle))).sort((a, b) => order[a.status] - order[b.status] || a.facts[0].slide - b.facts[0].slide);
    if (!gs.length) { const tr = el("tr"); const td = el("td", "none", needle ? "No figure matches." : "No figure appears more than once in this deck."); td.colSpan = 4; tr.appendChild(td); body.appendChild(tr); }
    for (const g of gs) { const tr = el("tr"); tr.style.cursor = "default"; tr.appendChild(el("td", "", g.label || "(unlabelled)")); tr.appendChild(el("td", "", g.periods.join(", "))); const td = el("td"); for (const f of g.facts) { const sp = el("span", "val", f.raw); sp.title = f.context; sp.appendChild(slideChip(f.slide)); td.appendChild(sp); } tr.appendChild(td); const st = el("td", "r"); st.appendChild(el("span", `chipk chipk--${g.status}`, label[g.status])); tr.appendChild(st); body.appendChild(tr); } };
  fill();
}
function viewCompare(v) {
  if (!S.cmp) { v.appendChild(el("h1", "", "What changed since the last version")); v.appendChild(el("p", "lede", "Open the previous version of this deck. Slides are paired even when pages were added, removed or moved, and every change to wording and figures is listed, ready to send to the client as a change log.")); const b = el("button", "btn btn--primary btn--lg", "Open the previous version"); b.addEventListener("click", () => $("file-prev").click()); v.appendChild(b); return; }
  const c = S.cmp.summary; v.appendChild(el("h1", "", `${c.changed + c.added + c.removed} of ${S.deck.slides.length} slides differ from the previous version`));
  v.appendChild(el("p", "lede", `Compared with ${S.prev.name}: ${c.changed} changed, ${c.added} added, ${c.removed} removed, ${c.moved} moved, ${c.same} unchanged. ${c.figures} figure${c.figures === 1 ? "" : "s"} changed.`));
  const tb = el("div", "toolbar2"), copy = el("button", "btn", "Copy the change log"); copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(changeLog()); toast("Change log copied."); } catch (e) { toast("Copying is blocked by the browser.", "error"); } }); tb.appendChild(copy); const other = el("button", "btn", "Compare with another file"); other.addEventListener("click", () => $("file-prev").click()); tb.appendChild(other); v.appendChild(tb);
  const wrap = el("div", "diff");
  for (const p of S.cmp.pairs) { if (p.status === "same") continue; const card = el("div", "card diffcard"), h = el("header"); h.appendChild(el("span", `st st--${p.status}`, p.status)); const s = p.b || p.a; h.appendChild(el("h3", "", `${p.b ? `Slide ${p.b.index}` : `Was slide ${p.a.index}`}${p.a && p.b && p.a.index !== p.b.index ? ` (was ${p.a.index})` : ""} · ${s.title ? s.title.text : "untitled"}`)); if (p.b) h.appendChild(slideChip(p.b.index)); card.appendChild(h);
    if (p.figures.length) { const f = el("p", "figs"); p.figures.forEach((x) => f.appendChild(el("span", "", `${x.from ?? "new"} → ${x.to ?? "removed"}`))); card.appendChild(f); }
    if (p.notes.length) card.appendChild(el("p", "doc__meta", p.notes.join(" · ")));
    const ul = el("ul"); for (const l of p.lines.filter((x) => x.op !== "same").slice(0, 40)) { const li = el("li"); if (l.op === "edit") l.words.forEach((w, i) => { if (i) li.appendChild(document.createTextNode(" ")); li.appendChild(w.op === "same" ? document.createTextNode(w.text) : el(w.op, "", w.text)); }); else li.appendChild(el(l.op, "", l.text)); ul.appendChild(li); } if (ul.children.length) card.appendChild(ul); wrap.appendChild(card); }
  if (!wrap.children.length) wrap.appendChild(el("p", "none", "The two versions have the same wording, figures and pictures.")); v.appendChild(wrap);
}
function changeLog() { const out = [`Changes: ${S.prev.name} → ${S.deck.name}`, ""]; for (const p of S.cmp.pairs) { if (p.status === "same") continue; const s = p.b || p.a; out.push(`${p.b ? `Slide ${p.b.index}` : `Former slide ${p.a.index}`} (${p.status}): ${s.title ? s.title.text : "untitled"}`); for (const f of p.figures) out.push(`  - Figure: ${f.from ?? "new"} → ${f.to ?? "removed"}`); for (const l of p.lines) { if (l.op === "edit") out.push(`  - Was: ${l.from}\n    Now: ${l.to}`); else if (l.op === "ins" && p.status === "changed") out.push(`  - Added: ${l.text}`); else if (l.op === "del" && p.status === "changed") out.push(`  - Removed: ${l.text}`); } for (const n of p.notes) out.push(`  - ${n}`); out.push(""); } return out.join("\n"); }
async function aiReview() {
  const res = await busy("Reviewing the storyline", async () => { progress("Reviewing the storyline", "Claude is reading the titles and slide text", 0.5); const r = await fetch("/api/storyline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: S.deck.name, language: S.result.lang, slides: S.deck.slides.filter((s) => !s.hidden).map((s) => ({ n: s.index, title: s.title ? s.title.text : "", text: s.text })) }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error({ no_key: "AI review needs an API key (see README).", not_installed: "Run npm install in the app folder first.", bad_key: "The API key was rejected.", busy: "The service is busy; try again shortly.", declined: "The request was declined." }[j.error] || "The AI review failed."); return j.result; });
  if (res) { S.aiReview = res; render(); }
}

/* ---------- frame ---------- */
function render() {
  const has = Boolean(S.deck); $("empty").hidden = has; $("audit").hidden = !has; $("tabs").hidden = !has; $("btn-fix").disabled = !has || S.deck.kind !== "pptx"; $("btn-export").disabled = !has; $("btn-compare").disabled = !has; $("btn-source").disabled = !has;
  if (!has) return; const d = S.deck;
  $("doc-name").textContent = d.name; $("doc-meta").textContent = `${d.slides.length} slides · ${d.kind === "pdf" ? "PDF" : "PowerPoint"}`; document.title = `${d.name} — Deck Auditor`;
  document.querySelectorAll("#tabs button").forEach((b) => { b.classList.toggle("is-on", b.dataset.view === S.view); if (b.dataset.view === "sources") b.innerHTML = S.recon && S.recon.summary.differs ? `Sources<sup>${S.recon.summary.differs}</sup>` : "Sources"; if (b.dataset.view === "compare") b.innerHTML = S.cmp ? `Compare<sup>${S.cmp.summary.changed + S.cmp.summary.added + S.cmp.summary.removed}</sup>` : "Compare"; });
  const v = $("view"), keep = v.dataset.view === S.view ? v.scrollTop : 0; v.textContent = ""; v.dataset.view = S.view;
  ({ overview: viewOverview, slides: viewSlides, storyline: viewStoryline, numbers: viewNumbers, sources: viewSources, compare: viewCompare })[S.view](v); v.scrollTop = keep;
  renderRail(); renderSide();
}
function exportMenu(anchor) {
  const m = $("menu"); m.textContent = ""; const item = (t, sub, fn) => { const b = el("button", "menu__item"); b.appendChild(el("b", "", t)); b.appendChild(el("small", "", sub)); b.addEventListener("click", () => { m.hidden = true; fn(); }); m.appendChild(b); };
  const stem = S.deck.name.replace(/\.(pptx|pdf)$/i, "");
  { const b = el("button", "menu__item"); b.appendChild(el("b", "", "Client report…")); b.appendChild(el("small", "", "The Deck Audit as handed to a client: cover, your view, priorities, what to do, your notes")); b.addEventListener("click", () => clientForm(anchor)); m.appendChild(b); }
  item("Working report", "The full internal list; open findings only", () => download(new Blob([reportHtml(S.deck, S.result, { dismissed: S.dismissed, compare: S.cmp ? { name: S.prev.name, result: S.cmp } : null, recon: S.recon, ai: S.aiReview })], { type: "text/html" }), `${stem} - audit.html`));
  item("Findings as a spreadsheet", "CSV for a tracker or a shared checklist", () => download(new Blob(["﻿" + findingsCsv(S.result, S.dismissed)], { type: "text/csv" }), `${stem} - findings.csv`));
  if (S.cmp) item("Change log", "What changed since the previous version, as text", () => download(new Blob([changeLog()], { type: "text/plain" }), `${stem} - changes.txt`));
  m.hidden = false; const r = anchor.getBoundingClientRect(); m.style.top = `${r.bottom + 6}px`; m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
}
async function boot() {
  try { S.brand = await (await fetch("/brand.json")).json(); } catch (e) { S.brand = null; }
  try { const st = await (await fetch("/api/status")).json(); S.ai.available = Boolean(st.ai); } catch (e) { /* offline is fine */ }
  $("btn-open").addEventListener("click", () => $("file").click()); $("btn-open-2").addEventListener("click", () => $("file").click()); $("btn-sample").addEventListener("click", sample);
  $("file").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; open(f); }); $("file-prev").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; openPrevious(f); });
  $("btn-source").addEventListener("click", () => $("file-src").click()); $("file-src").addEventListener("change", (e) => { const fs = [...e.target.files]; e.target.value = ""; openSources(fs); });
  $("btn-compare").addEventListener("click", () => $("file-prev").click()); $("btn-export").addEventListener("click", (e) => exportMenu(e.currentTarget)); $("btn-fix").addEventListener("click", (e) => fixMenu(e.currentTarget));
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.view = b.dataset.view; S.focus = null; if (S.view !== "slides") S.filter.slideOnly = false; render(); });
  document.addEventListener("pointerdown", (e) => { if (!$("menu").hidden && !$("menu").contains(e.target) && !e.target.closest("#btn-export,#btn-fix")) $("menu").hidden = true; }, true);
  let depth = 0; window.addEventListener("dragenter", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { depth++; document.body.classList.add("is-drop"); } }); window.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove("is-drop"); });
  window.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); }); window.addEventListener("drop", (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); depth = 0; document.body.classList.remove("is-drop"); const fs = [...e.dataTransfer.files]; if (S.deck && e.shiftKey) openPrevious(fs[0]); else open(fs[0]); });
  window.addEventListener("keydown", (e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; const mod = e.ctrlKey || e.metaKey; if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); $("file").click(); } else if (e.key === "Escape") $("menu").hidden = true; else if (S.deck && S.view === "slides" && e.key === "ArrowRight" && S.slide < S.deck.slides.length) goSlide(S.slide + 1); else if (S.deck && S.view === "slides" && e.key === "ArrowLeft" && S.slide > 1) goSlide(S.slide - 1); });
  let rz = 0; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (S.deck && S.view === "slides") render(); }, 120); });
  render(); window.__audit = { S, open, openPrevious, openSources, fix, clientReport, noteKey, saveReview, fixPlan: () => fixPlan(S.deck, S.result, S.dismissed), changeLog, report: () => reportHtml(S.deck, S.result, { dismissed: S.dismissed, compare: S.cmp ? { name: S.prev.name, result: S.cmp } : null, recon: S.recon }), csv: () => findingsCsv(S.result, S.dismissed) };
  document.documentElement.dataset.ready = "1";
}
boot();
