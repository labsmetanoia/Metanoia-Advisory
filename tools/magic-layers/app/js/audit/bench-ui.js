// Benchmark — the screen. Decks are read and audited one at a time on this computer; only each deck's figures
// (its metrics row) are kept, in this browser's storage, so a study can be built up over several sittings.
import { readPptx } from "./pptx.js";
import { readPdf } from "./pdfdeck.js";
import { audit } from "./checks.js";
import { deckMetrics, aggregate, assignCodes, metricsCsv, keyCsv, benchmarkHtml } from "./benchmark.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function toast(msg, kind = "") { const t = el("div", `toast${kind ? ` toast--${kind}` : ""}`, msg); $("toasts").appendChild(t); setTimeout(() => t.remove(), kind === "error" ? 7000 : 3800); }
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };

const S = { rows: read("bench:rows", []), meta: { title: "", period: "", author: "Metanoia Advisory", selection: "", commentary: "", lang: "en", seed: 0, ...read("bench:meta", {}) }, busy: false };
if (!S.meta.seed) S.meta.seed = 1 + Math.floor(Math.random() * 2 ** 31);
const save = () => { write("bench:rows", S.rows); write("bench:meta", S.meta); };
const codes = () => assignCodes(S.rows, S.meta.seed);

function problems() {
  const ok = S.rows.filter((r) => !r.error).length, out = [];
  if (!ok) out.push({ level: "error", text: "Add the decks to study." });
  if (!S.meta.title.trim()) out.push({ level: "error", text: "Give the study a title." });
  if (!S.meta.selection.trim()) out.push({ level: "error", text: "Describe how the decks were chosen. The report prints it: a benchmark is only as good as its sample." });
  if (ok && ok < 10) out.push({ level: "warn", text: `${ok} deck${ok > 1 ? "s" : ""} so far. With fewer than 10, one deck moves a percentage by ${Math.round(100 / ok)} points or more; add decks or say so in your reading.` });
  if (S.rows.some((r) => r.error)) out.push({ level: "warn", text: `${S.rows.filter((r) => r.error).length} file(s) could not be read and are left out; the report says how many.` });
  return out;
}

/* ---------- form ---------- */
function buildForm() {
  const f = $("form"); f.textContent = "";
  const field = (label, key, o = {}) => { const l = el("label", "field"); l.appendChild(el("span", "", label)); const i = el(o.area ? "textarea" : "input"); if (o.area) { i.rows = o.area; if (o.area > 3) i.className = "tall"; } else i.type = "text"; i.placeholder = o.ph || ""; i.value = S.meta[key] || "";
    i.addEventListener("input", () => { S.meta[key] = i.value; changed(); }); l.appendChild(i); if (o.hint) l.appendChild(el("p", "pk__hint", o.hint)); return l; };
  const d = el("details"); d.open = true; d.appendChild(el("summary", "", "The study")); const b = el("div", "pk__body");
  b.appendChild(field("Title", "title", { ph: "What 40 public-expose decks tell investors, 2026" }));
  const r = el("div", "pk__row"); r.appendChild(field("Period", "period", { ph: "Public expose 2026" })); r.appendChild(field("Prepared by", "author")); b.appendChild(r);
  const seg = el("div", "seg"); for (const [v, t] of [["en", "English"], ["id", "Bahasa Indonesia"]]) { const btn = el("button", S.meta.lang === v ? "is-on" : "", t); btn.type = "button"; btn.addEventListener("click", () => { S.meta.lang = v; buildForm(); changed(); }); seg.appendChild(btn); }
  const lf = el("label", "field"); lf.appendChild(el("span", "", "Report language")); lf.appendChild(seg); b.appendChild(lf);
  b.appendChild(field("How the decks were chosen", "selection", { area: 5, ph: "For example: the public-expose decks published on the IDX website between July and December 2026 by the LQ45 constituents, as downloaded on 1 December. Decks made only of scanned pages were left out.", hint: "Printed in the report. Say which companies, which documents, which dates, and what was left out." }));
  b.appendChild(field("Our reading (optional)", "commentary", { area: 6, ph: "Two or three paragraphs on what the figures mean. Only claims the figures support.", hint: "Printed as written. Leave empty until the sample is complete." }));
  d.appendChild(b); f.appendChild(d);
  const n = el("details"); n.appendChild(el("summary", "", "What stays private")); const nb = el("div", "pk__body");
  nb.appendChild(el("p", "pk__hint", "The report and the figures file contain no file name, company name or slide text: each deck is a code such as D07, in an order unrelated to the file names. The key file links codes to files; keep it inside the firm. The decks themselves are not kept: only their figures, in this browser."));
  const clear = el("button", "btn", "Start a new study"); clear.type = "button"; clear.addEventListener("click", () => { if (!confirm("Remove every deck from this study? The study details are kept.")) return; S.rows = []; S.meta.seed = 1 + Math.floor(Math.random() * 2 ** 31); changed(); renderTable(); }); nb.appendChild(clear);
  n.appendChild(nb); f.appendChild(n);
}

/* ---------- decks ---------- */
function renderTable() {
  const t = $("table"), cs = codes(); t.textContent = "";
  if (!S.rows.length) return;
  const h = el("tr"); for (const x of ["Code", "File", "Type", "Slides", "Titles that conclude", "Fix · check · polish", ""]) h.appendChild(el("th", "", x)); t.appendChild(h);
  S.rows.forEach((r, i) => { const tr = el("tr", r.error ? "is-error" : ""); tr.appendChild(el("td", "", cs[i])); const f = el("td", "file", r.name); f.title = r.name; tr.appendChild(f);
    if (r.error) { const td = el("td", "", r.error); td.colSpan = 4; tr.appendChild(td); } else { tr.appendChild(el("td", "", r.kind === "pptx" ? "PPTX" : "PDF")); tr.appendChild(el("td", "n", String(r.slides))); tr.appendChild(el("td", "n", `${r.actionShare}%`)); tr.appendChild(el("td", "n", `${r.high} · ${r.medium} · ${r.low}`)); }
    const del = el("button", "", "✕"); del.title = "Remove from the study"; del.addEventListener("click", () => { S.rows.splice(i, 1); changed(); renderTable(); }); const td = el("td"); td.appendChild(del); tr.appendChild(td); t.appendChild(tr); });
}
async function addFiles(files) {
  if (S.busy) return; const list = [...files].filter((f) => /\.(pptx|pdf)$/i.test(f.name)); if (!list.length) { toast("Choose PowerPoint (.pptx) or PDF files.", "error"); return; }
  S.busy = true; let done = 0, skipped = 0;
  for (const file of list) {
    if (S.rows.some((r) => r.name === file.name)) { skipped++; continue; }
    $("progress").textContent = `Reading ${done + 1} of ${list.length - skipped}: ${file.name}`; await new Promise((r) => setTimeout(r, 20));
    try { const deck = /\.pdf$/i.test(file.name) ? await readPdf(file, () => {}, { render: false }) : await readPptx(file);
      if (!deck.slides.length || deck.slides.reduce((a, s) => a + (s.words || 0), 0) < 12) S.rows.push({ name: file.name, error: "No text could be read (scanned or picture pages)" });
      else S.rows.push(deckMetrics(deck, audit(deck, {}), file.name)); }
    catch (e) { S.rows.push({ name: file.name, error: "Could not be read" }); }
    done++; save(); renderTable(); changed();
  }
  $("progress").textContent = ""; S.busy = false;
  toast(`${done} deck${done === 1 ? "" : "s"} added${skipped ? `; ${skipped} already in the study` : ""}.`);
}

/* ---------- report ---------- */
let timer = 0;
function changed() { clearTimeout(timer); timer = setTimeout(render, 200); }
const html = () => benchmarkHtml(aggregate(S.rows), S.meta, S.meta.lang);
function render() {
  save(); const a = aggregate(S.rows), ps = problems();
  $("doc-meta").textContent = a.n ? `${a.n} deck${a.n === 1 ? "" : "s"}: ${a.pptx} PowerPoint, ${a.pdf} PDF` : "No decks yet";
  const list = $("problems"); list.textContent = ""; for (const x of ps) list.appendChild(el("li", x.level === "error" ? "is-error" : "", x.text)); if (!ps.length) list.appendChild(el("li", "is-ok", "Ready."));
  const blocked = ps.some((x) => x.level === "error"); for (const id of ["btn-report", "btn-csv", "btn-key"]) $(id).disabled = blocked && !(id !== "btn-report" && a.n);
  const frame = $("preview"); frame.srcdoc = a.n ? html() : "<p style='font:14px system-ui;color:#6B6862;padding:24px'>The report appears here once decks are added.</p>";
}
const stem = () => (S.meta.title || "Benchmark").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80);

function start() {
  buildForm(); renderTable(); render();
  $("btn-add").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", (e) => { const fs = [...e.target.files]; e.target.value = ""; addFiles(fs); });
  const drop = $("drop");
  for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); });
  for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); });
  drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  $("btn-report").addEventListener("click", () => { download(new Blob([html()], { type: "text/html" }), `${stem()} - report.html`); toast("Report saved. Open it and print to PDF."); });
  $("btn-csv").addEventListener("click", () => download(new Blob(["﻿" + metricsCsv(S.rows, codes())], { type: "text/csv" }), `${stem()} - figures.csv`));
  $("btn-key").addEventListener("click", () => { download(new Blob(["﻿" + keyCsv(S.rows, codes())], { type: "text/csv" }), `${stem()} - key (private).csv`); toast("Key saved. It names the files: keep it inside the firm."); });
  window.__bench = { S, addFiles, problems, html, render };
  document.documentElement.dataset.ready = "1";
}
if (window.JSZip) start(); else window.addEventListener("load", start);
