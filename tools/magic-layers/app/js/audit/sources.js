// Deck Auditor — Source Check. Reads a source of truth (the client's Excel model, a CSV export, or a second document
// such as the annual report, a press release or another deck) and reconciles every figure in the deck against it:
// confirmed, different from the source, derived from it (a growth rate, a share), or not traceable.
import { readXlsx, parseDelimited } from "../charts/data.js";
import { readPptx, finishDeck } from "./pptx.js";
import { readPdf } from "./pdfdeck.js";
import { collectFacts, factsInText, parseNumber, wordsOf, periodsOf, PERIOD, detectLanguage } from "./numbers.js";

const colName = (c) => { let s = "", n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const yearLike = (n) => Number.isInteger(n) && n >= 1990 && n <= 2100;
const UNITHINT = /\b(Rp|IDR|USD|US\$|EUR|SGD)\b|(%)|\b(triliun|trillion|tn|miliar|milyar|billion|bn|juta|million|mn|ribu|thousand|000)\b/i;

// Every number in a sheet with the words that label it: the text to its left and the headers above it.
function sheetFacts(sheet, source) {
  const out = [], g = sheet.grid, n = sheet.nums, R = g.length, C = g[0] ? g[0].length : 0;
  const isNum = (r, c) => Boolean(n[r] && n[r][c]), text = (r, c) => (g[r] && g[r][c] && !isNum(r, c) ? g[r][c] : "");
  const headerRow = (r) => { const cells = []; for (let c = 0; c < C; c++) if (isNum(r, c)) cells.push(n[r][c].n); return cells.length >= 2 && cells.every(yearLike); };   // a row of years is a header, not data
  const heads = Array.from({ length: R }, (_, r) => headerRow(r));
  for (let r = 0; r < R; r++) { if (heads[r]) continue;
    for (let c = 0; c < C; c++) { if (!isNum(r, c)) continue; const cell = n[r][c];
      const left = []; for (let k = c - 1; k >= 0 && left.length < 2; k--) { const t = text(r, k); if (t) left.push(t); }
      const up = []; for (let k = r - 1; k >= 0 && up.length < 2; k--) { const t = text(k, c) || (heads[k] && isNum(k, c) ? String(n[k][c].n) : ""); if (t) up.push(t); else if (up.length && !isNum(k, c)) break; }
      if (!left.length && !up.length) continue;
      const hd = `${left.join(" ")} ${up.join(" ")}`, hint = UNITHINT.exec(`${hd} ${g[0].join(" ")} ${sheet.name}`), value = cell.pct ? cell.n * 100 : cell.n;
      out.push({ source, where: "sheet", value, pct: cell.pct || /%/.test(hd), unitHint: hint ? hint[0] : "", label: [...new Set(wordsOf(hd.replace(PERIOD, " ")))], periods: [...periodsOf(hd)], rowLabel: left.slice().reverse().join(" · "), colLabel: up.slice().reverse().join(" · "),
        shown: g[r][c], at: `${sheet.name}!${colName(sheet.origin.c + c)}${sheet.origin.r + r + 1}`, row: r, col: c, sheet: sheet.name });
    } }
  return out;
}
function gridSheet(grid, name, lang) { const nums = grid.map((row) => row.map((cell) => { const s = String(cell || "").trim(), m = /^[(\-−–]?\s*(?:Rp\.?|USD|IDR|\$)?\s*(\d[\d.,]*)\s*%?\)?$/.exec(s); if (!m) return null; const v = parseNumber(m[1].replace(/[.,]$/, ""), lang).value; return Number.isFinite(v) ? { n: (/^[(\-−–]/.test(s) ? -1 : 1) * (/%/.test(s) ? v / 100 : v), pct: /%/.test(s) } : null; })); return { name, grid, nums, origin: { r: 0, c: 0 } }; }

// A Word document: paragraphs and tables, read as one long page.
async function readDocx(file) {
  const zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer()), f = zip.file("word/document.xml"); if (!f) throw new Error("This file is not a Word document (.docx).");
  const doc = new DOMParser().parseFromString(await f.async("string"), "application/xml"), by = (el, nm) => [...el.getElementsByTagName("*")].filter((e) => e.localName === nm), shapes = []; let seq = 0;
  const textOf = (p) => by(p, "t").map((t) => t.textContent).join(""), para = (t) => ({ text: t, level: 0, bullet: false, runs: [{ text: t, size: 11, font: null, bold: false, italic: false, color: null }] });
  const body = by(doc, "body")[0]; if (!body) throw new Error("The document is empty.");
  for (const el of body.children) {
    if (el.localName === "p") { const t = textOf(el).trim(); if (t) shapes.push({ id: `d${++seq}`, kind: "text", role: "other", hasBox: false, x: 0, y: seq, w: 0, h: 0, paras: [para(t)] }); }
    else if (el.localName === "tbl") { const rows = by(el, "tr").map((tr) => [...tr.children].filter((c) => c.localName === "tc").map((tc) => by(tc, "p").map(textOf).join(" ").trim())); shapes.push({ id: `d${++seq}`, kind: "table", role: "other", hasBox: false, x: 0, y: seq, w: 0, h: 0, rows, table: rows.map((r) => r.map((c) => [para(c)])), paras: rows.flat().map(para) }); }
  }
  return finishDeck({ name: file.name, kind: "docx", width: 595, height: 842, theme: { colors: {} }, slides: [{ index: 1, hidden: false, background: "#fff", layoutName: "", shapes }] });
}

export const SOURCE_ACCEPT = ".xlsx,.csv,.tsv,.pdf,.pptx,.docx";
export async function readSource(file, onProgress = () => {}) {
  const name = file.name;
  if (/\.xlsx$/i.test(name)) { const sheets = await readXlsx(file); return { name, kind: "workbook", facts: sheets.flatMap((s) => sheetFacts(s, name)), note: `${sheets.length} sheet${sheets.length > 1 ? "s" : ""}` }; }
  if (/\.(csv|tsv|txt)$/i.test(name)) { const text = await file.text(), grid = parseDelimited(text), lang = /\d,\d{1,2}(?!\d)/.test(text) && !/\d\.\d{1,2}(?!\d)/.test(text) ? "id" : "en"; return { name, kind: "workbook", facts: sheetFacts(gridSheet(grid, name.replace(/\.\w+$/, ""), lang), name), note: `${grid.length} rows` }; }
  if (/\.xls$/i.test(name)) throw new Error("Old .xls files cannot be read. Save the workbook as .xlsx and open that.");
  const deck = /\.pptx$/i.test(name) ? await readPptx(file, onProgress) : /\.pdf$/i.test(name) ? await readPdf(file, onProgress) : /\.docx$/i.test(name) ? await readDocx(file) : null;
  if (!deck) throw new Error("Open an Excel workbook (.xlsx), a CSV file, a PDF, a Word document (.docx) or a PowerPoint (.pptx) as the source.");
  const lang = detectLanguage(deck.slides.map((s) => s.text).join("\n")).lang, unit = deck.kind === "pptx" ? "slide" : deck.kind === "pdf" ? "page" : "";
  return { name, kind: "document", facts: collectFacts(deck, lang).filter((f) => f.where !== "footer").map((f) => ({ ...f, source: name, where: "document", pct: f.unit === "%", shown: f.raw, at: unit ? `${unit} ${f.slide}` : "", unitDoc: f.unit, rowLabel: f.context })), note: unit ? `${deck.slides.length} ${unit}s` : "document" };
}

const SCALES = [1, 1e-3, 1e-6, 1e-9, 1e-12, 1e3, 1e6];
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const sig = (f) => String(Math.abs(f.value)).replace(/[.\-]/g, "").replace(/^0+|0+$/g, "").length + (f.decimals ? 1 : 0);   // how distinctive a figure is
// Does a source number equal a deck figure once rounded to the deck's precision (and, for amounts, rescaled: millions ↔ trillions)?
function matchValue(f, s) {
  const tol = 0.5 * 10 ** -f.decimals + 1e-9, pct = f.unit === "%" || f.unit === "pp";
  if (s.where === "document") return (s.unitDoc === f.unit || !s.unitDoc || !f.unit) && Math.abs(round(s.value, f.decimals) - f.value) <= tol ? { scale: 1, shown: s.value } : null;
  if (pct) { for (const v of s.pct ? [s.value] : Math.abs(s.value) <= 1.5 ? [s.value * 100, s.value] : [s.value]) if (Math.abs(round(v, f.decimals) - f.value) <= 1e-9) return { scale: 1, shown: v }; return null; }
  if (s.pct) return null;
  for (const k of SCALES) { const v = s.value * k; if (Math.abs(round(v, f.decimals) - f.value) <= 1e-9 && (k === 1 || Math.abs(v) >= 0.1)) return { scale: k, shown: v }; }
  return null;
}
const overlap = (a, b) => { const B = new Set(b), common = a.filter((x) => B.has(x)).length; return { common, score: common / (new Set([...a, ...b]).size || 1) }; };
const periodsOk = (f, s) => !f.periods.length || !s.periods.length || f.periods.some((p) => s.periods.includes(p));
const periodsSame = (f, s) => f.periods.length === s.periods.length && f.periods.every((p) => s.periods.includes(p));
const where = (s) => `${s.source}${s.at ? `, ${s.at}` : ""}`;
const show = (v, d) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// Reconciles the deck's figures with the sources. Each deck figure gets one status:
//   confirmed  the source holds this value under labels that agree
//   differs    the source holds the same metric and period with another value
//   derived    a percentage that equals the growth between two source values, or a share of a total
//   found      the value is in the source, but under labels that could not be matched
//   missing    nothing in the source corresponds
export function reconcile(deckFacts, sources) {
  const src = sources.flatMap((s) => s.facts), rows = new Map();
  for (const s of src) if (s.where === "sheet") { const k = `${s.source}|${s.sheet}|${s.row}`; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(s); }
  const items = [];
  for (const f of deckFacts) {
    if (f.where === "footer" || !Number.isFinite(f.value)) continue;
    const pct = f.unit === "%" || f.unit === "pp", item = { fact: f, status: "missing", source: null, note: "" };
    // a figure with no words of its own ("from Rp 50 tn to Rp 56 tn") borrows the words of its sentence; the sentence's period may then belong to its neighbour
    const weak = !f.label.length, lab = weak ? wordsOf(f.context.replace(PERIOD, " ")) : f.label;
    const cands = []; for (const s of src) { const m = matchValue(f, s); if (m) cands.push({ s, m, o: overlap(lab, s.label), p: weak || periodsOk(f, s) }); }
    const good = cands.filter((c) => c.o.common >= 1 && c.p).sort((a, b) => (periodsSame(f, b.s) - periodsSame(f, a.s)) || b.o.score - a.o.score || (a.m.scale === 1 ? -1 : 1))[0];
    if (good) { Object.assign(item, { status: "confirmed", source: good.s, note: `${good.s.shown}${good.m.scale !== 1 ? ` (shown in the deck as ${f.raw})` : ""}` }); items.push(item); continue; }
    // same metric and period in the source, another value
    let twin = null; for (const s of src) { if ((s.pct || s.unitDoc === "%") !== pct && !(pct && s.where === "sheet" && Math.abs(s.value) <= 1.5)) continue; if (!f.periods.length || !periodsSame(f, s)) continue; const o = overlap(f.label, s.label); if (o.common >= 2 && o.score >= 0.6 && (!twin || o.score > twin.o.score)) twin = { s, o }; }
    // a figure with no period in its sentence: if the source holds that metric and none of its periods shows this value, it differs from all of them
    if (!twin && !f.periods.length && f.label.length >= 2) { const tw = src.filter((s) => { if ((s.pct || s.unitDoc === "%") !== pct) return false; const o = overlap(f.label, s.label); return o.common >= 2 && o.score >= 0.75; });
      if (tw.length && tw.length <= 12) { Object.assign(item, { status: "differs", source: tw[tw.length - 1], sourceValue: tw.slice(-3).map((s) => `${s.shown}${s.colLabel ? ` (${s.colLabel})` : ""}`).join(", "), note: "no period of this metric in the source shows the deck's value" }); items.push(item); continue; } }
    if (twin) { const s = twin.s; let v = s.value; if (pct && !s.pct && Math.abs(v) <= 1.5 && s.where === "sheet") v *= 100; else if (!pct && s.where === "sheet") { const k = SCALES.slice().sort((a, b) => Math.abs(Math.log10(Math.abs(s.value * a) || 1e-9) - Math.log10(Math.abs(f.value) || 1e-9)) - Math.abs(Math.log10(Math.abs(s.value * b) || 1e-9) - Math.log10(Math.abs(f.value) || 1e-9)))[0]; v = s.value * k; }
      Object.assign(item, { status: "differs", source: s, sourceValue: `${show(v, Math.max(f.decimals, pct ? 1 : f.decimals))}${pct ? "%" : ""}`, note: `the source shows ${s.shown}` }); items.push(item); continue; }
    // a percentage worked out from the source: growth along a row, or a share of the row labelled total
    if (pct) { let hit = null; const said = `${f.label.join(" ")} ${f.context}`.toLowerCase(), isShare = /\b(share|shares|mix|proportion|porsi|pangsa|kontribusi|komposisi)\b|% of\b/.test(said), isGrowth = /\b(grow|grew|growth|increase|increased|rose|fell|decline|declined|change|yoy|cagr|tumbuh|naik|turun|pertumbuhan|kenaikan|penurunan)\b/.test(said);
      if (!isShare || isGrowth) for (const row of rows.values()) { if (hit) break; const o = overlap(f.label, row[0].label); if (!o.common) continue; const cells = row.filter((s) => !s.pct).sort((a, b) => a.col - b.col);
        for (let i = 0; i < cells.length && !hit; i++) for (let j = i + 1; j < cells.length; j++) { const a = cells[i].value, b = cells[j].value; if (!a) continue; const g = ((b - a) / Math.abs(a)) * 100; if (Math.abs(round(Math.abs(g), f.decimals) - Math.abs(f.value)) <= 1e-9 && Math.abs(g) > 0.05) { hit = { s: cells[j], text: `growth of ${cells[i].rowLabel || "the row"} from ${cells[i].colLabel || cells[i].at} to ${cells[j].colLabel || cells[j].at} (${show(g, Math.max(1, f.decimals))}%)` }; break; } } }
      if (!hit && (!isGrowth || isShare)) for (const s of src) { if (hit || s.where !== "sheet" || s.pct || !overlap(f.label, s.label).common || !periodsOk(f, s)) continue; const tot = src.find((t) => t.where === "sheet" && t.source === s.source && t.sheet === s.sheet && t.col === s.col && t !== s && /^(grand\s+)?(total|jumlah)\b/i.test(t.rowLabel)); if (tot && tot.value) { const sh = (s.value / tot.value) * 100; if (Math.abs(round(sh, f.decimals) - f.value) <= 1e-9) hit = { s, text: `${s.rowLabel} as a share of ${tot.rowLabel} in ${s.colLabel || s.at} (${show(sh, Math.max(1, f.decimals))}%)` }; } }
      if (hit) { Object.assign(item, { status: "derived", source: hit.s, note: hit.text }); items.push(item); continue; } }
    const loose = cands.filter((c) => c.p).sort((a, b) => (a.m.scale === 1 ? -1 : 1) - (b.m.scale === 1 ? -1 : 1))[0];
    if (loose && sig(f) >= 2) Object.assign(item, { status: "found", source: loose.s, note: `${loose.s.shown} under "${[loose.s.rowLabel, loose.s.colLabel].filter(Boolean).join(" · ").slice(0, 70)}"` });
    items.push(item);
  }
  const count = (st) => items.filter((i) => i.status === st).length;
  return { items, summary: { total: items.length, confirmed: count("confirmed"), differs: count("differs"), derived: count("derived"), found: count("found"), missing: count("missing") }, sources: sources.map((s) => ({ name: s.name, kind: s.kind, figures: s.facts.length, note: s.note })) };
}
// The reconciliation as audit findings.
export function sourceFindings(recon) {
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), asWritten = (f) => f.label.map((w) => { const m = new RegExp(`(?<![\\p{L}])${esc(w)}[\\p{L}]{0,2}(?![\\p{L}])`, "iu").exec(f.context); return m ? m[0] : w; }).join(" ");
  const out = [], lab = (i) => { const f = i.fact, nm = i.source && i.source.where === "sheet" && i.source.rowLabel ? i.source.rowLabel : asWritten(f); return nm ? `"${nm}"${f.periods.length ? ` (${f.periods.join(", ")})` : ""}` : "a figure"; };
  for (const i of recon.items.filter((x) => x.status === "differs")) out.push({ code: "source-differs", severity: "high", slide: i.fact.slide, shapeId: i.fact.shapeId, title: `Slide ${i.fact.slide} says ${i.fact.raw} for ${lab(i)}; the source says ${i.sourceValue}`, detail: `Deck: ${i.fact.context}\nSource: ${[i.source.rowLabel, i.source.colLabel].filter(Boolean).join(" · ")} = ${i.source.shown} (${where(i.source)})` });
  const miss = recon.items.filter((x) => x.status === "missing"); if (miss.length) out.push({ code: "source-missing", severity: miss.length > recon.summary.total * 0.25 && recon.sources.some((x) => x.kind === "workbook") ? "medium" : "low", title: `${miss.length} figure${miss.length > 1 ? "s" : ""} could not be traced to the source`, detail: `${miss.slice(0, 12).map((i) => `Slide ${i.fact.slide}: ${i.fact.raw} — ${i.fact.context.slice(0, 90)}`).join("\n")}${miss.length > 12 ? `\n… and ${miss.length - 12} more, listed under Sources.` : ""}\nThey may be calculated, come from another source, or be worded differently there. Each should be traceable before the deck goes out.`, slides: [...new Set(miss.map((i) => i.fact.slide))], refs: miss.map((i) => ({ slide: i.fact.slide, shapeId: i.fact.shapeId })) });
  return out;
}
export { where as sourceLocation };
