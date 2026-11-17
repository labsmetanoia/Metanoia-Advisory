// Chart Builder — data in. A grid of cells (first row: series names, first column: categories) comes from a paste
// out of Excel, a CSV file or an .xlsx workbook, and becomes { categories, series: [{ name, values }] }.
import { parseNumber, detectLanguage } from "../audit/numbers.js";

export function parseDelimited(text) {
  const t = text.replace(/\r\n?/g, "\n").replace(/\n+$/, ""); if (!t.trim()) return [];
  const first = t.split("\n")[0], delim = first.includes("\t") ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && !cell) q = true; else if (c === delim) { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c; }
  row.push(cell); rows.push(row);
  const w = Math.max(...rows.map((r) => r.length)); return rows.map((r) => Array.from({ length: w }, (_, i) => (r[i] ?? "").trim()));
}

// A small reader for .xlsx: cell values (cached results for formulas) of every sheet, percentages and dates as shown.
export async function readXlsx(file) {
  const zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer()), xml = async (p) => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async("string"), "application/xml") : null; };
  const by = (d, n) => (d ? [...d.getElementsByTagName("*")].filter((e) => e.localName === n) : []);
  const wb = await xml("xl/workbook.xml"); if (!wb) throw new Error("This file is not an Excel workbook (.xlsx).");
  const rels = await xml("xl/_rels/workbook.xml.rels"), target = new Map(by(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target").replace(/^\/?(xl\/)?/, "xl/")]));
  const shared = by(await xml("xl/sharedStrings.xml"), "si").map((si) => by(si, "t").map((t) => t.textContent).join(""));
  const styles = await xml("xl/styles.xml"), custom = new Map(by(styles, "numFmt").map((f) => [f.getAttribute("numFmtId"), f.getAttribute("formatCode")])), xfs = by(by(styles, "cellXfs")[0], "xf").map((x) => x.getAttribute("numFmtId"));
  const kind = (s) => { const id = xfs[Number(s)] || "0", code = custom.get(id) || ""; if (id === "9" || id === "10" || /%/.test(code)) return "pct"; if ((Number(id) >= 14 && Number(id) <= 22) || (Number(id) >= 45 && Number(id) <= 47) || (/[ymd]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, "")) && !/[#0]/.test(code))) return "date"; return ""; };
  const col = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const sheets = [];
  for (const s of by(wb, "sheet")) {
    const d = await xml(target.get(s.getAttribute("r:id")) || ""); if (!d) continue; const rows = [];
    for (const r of by(d, "row")) { const ri = Number(r.getAttribute("r")) - 1; for (const c of by(r, "c")) { const v = by(c, "v")[0], t = c.getAttribute("t"); let val = t === "inlineStr" ? by(c, "t").map((x) => x.textContent).join("") : v ? v.textContent : ""; if (!val) continue;
        if (t === "s") val = shared[Number(val)] ?? ""; else if (t !== "str" && t !== "inlineStr" && t !== "b" && t !== "e") { const k = kind(c.getAttribute("s") || "0"), n = Number(val); if (k === "pct") val = `${Math.round(n * 1e6) / 1e4}%`; else if (k === "date") { const dt = new Date(Date.UTC(1899, 11, 30) + n * 864e5); val = dt.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }); } else val = String(Math.round(n * 1e10) / 1e10); }
        (rows[ri] ||= [])[col(c.getAttribute("r"))] = String(val).trim(); } }
    // trim to the used block
    const used = rows.map((r, i) => (r && r.some((x) => x) ? i : -1)).filter((i) => i >= 0); if (!used.length) continue; const cols = rows.flatMap((r) => (r ? r.map((x, i) => (x ? i : -1)).filter((i) => i >= 0) : [])), c0 = Math.min(...cols), c1 = Math.max(...cols);
    sheets.push({ name: s.getAttribute("name"), grid: rows.slice(used[0], used[used.length - 1] + 1).map((r) => Array.from({ length: c1 - c0 + 1 }, (_, i) => (r && r[c0 + i]) || "")) });
  }
  if (!sheets.length) throw new Error("The workbook has no data."); return sheets;
}

const numeric = (cell, lang) => { const s = String(cell ?? "").trim(); if (!s) return null; const neg = /^\(.*\)$/.test(s) || /^[-−–]/.test(s), m = /\d[\d.,]*/.exec(s); if (!m || /[\p{L}]{4,}/u.test(s.replace(/(?:Rp|IDR|USD|EUR|SGD)/gi, ""))) return null; const v = parseNumber(m[0].replace(/[.,]$/, ""), lang).value; return Number.isFinite(v) ? (neg ? -v : v) : null; };
export const gridLanguage = (grid) => { const cells = grid.flat().filter((c) => /\d[.,]\d/.test(c)); const id = cells.filter((c) => /\d,\d{1,2}(?!\d)/.test(c) && !/\d\.\d{1,2}(?!\d)/.test(c)).length, en = cells.filter((c) => /\d\.\d{1,2}(?!\d)/.test(c)).length; return id > en ? "id" : detectLanguage(grid.flat().join(" ")).id > 3 && !en ? "id" : "en"; };

// Grid → chart data. Rows that hold no number and empty columns are dropped; a unit seen on most cells is reported.
export function gridToData(grid, lang = gridLanguage(grid)) {
  const g = grid.filter((r) => r.some((c) => String(c).trim())); if (g.length < 2) return { categories: [], series: [], unit: "" };
  const head = g[0], body = g.slice(1), cols = []; for (let c = 1; c < head.length; c++) if (body.some((r) => numeric(r[c], lang) !== null)) cols.push(c);
  const rows = body.filter((r) => cols.some((c) => numeric(r[c], lang) !== null));
  const cells = rows.flatMap((r) => cols.map((c) => String(r[c] || ""))), pct = cells.filter((c) => /%/.test(c)).length;
  return { categories: rows.map((r) => String(r[0] || "").trim()), series: cols.map((c) => ({ name: String(head[c] || "").trim() || `Series ${c}`, values: rows.map((r) => numeric(r[c], lang)) })), unit: cells.length && pct >= cells.length * 0.6 ? "%" : "", lang };
}
export const transpose = (grid) => { const w = Math.max(0, ...grid.map((r) => r.length)); return Array.from({ length: w }, (_, c) => grid.map((r) => r[c] ?? "")); };
export const dataToGrid = (d) => [["", ...d.series.map((s) => s.name)], ...d.categories.map((c, i) => [c, ...d.series.map((s) => (s.values[i] == null ? "" : String(s.values[i])))])];
