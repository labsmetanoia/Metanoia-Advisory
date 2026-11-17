// Chart Builder — interface: a set of charts, each with its data grid, type, options and wording; live preview;
// export to PowerPoint (native charts), PNG or SVG. Work is kept in this browser between sessions and can be saved.
import { parseDelimited, readXlsx, gridToData, transpose } from "./data.js";
import { renderChart, bridge, autoDecimals, formatValue } from "./render.js";
import { exportCharts } from "./pptx.js";
import { factsInText } from "../audit/numbers.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const TYPES = [["column", "Columns", "M3 20V9h5v11zM11 20V4h5v16zM19 20v-8h5v8z"], ["bar", "Bars", "M3 3h15v5H3zM3 10h22v5H3zM3 17h10v5H3z"], ["stacked", "Stacked", "M3 20v-6h5v6zM3 13V8h5v5zM11 20v-9h5v9zM11 10V4h5v6zM19 20v-5h5v5zM19 14v-4h5v4z"], ["stacked100", "100%", "M3 20v-8h5v8zM3 11V3h5v8zM11 20v-5h5v5zM11 14V3h5v11zM19 20V9h5v11zM19 8V3h5v5z"], ["line", "Line", "M3 17l6-7 6 4 9-10v3l-9 10-6-4-6 7z"], ["pie", "Pie", "M14 2a10 10 0 1010 10H14zM16 0v10h10A10 10 0 0016 0z"], ["waterfall", "Bridge", "M2 20V8h5v12zM9 8V4h5v4zM16 9V4h5v5zM23 20V9h4v11z"]];
const SAMPLE = { type: "column", title: "EBITDA margin recovered to 14% in Q3 25 as logistics costs normalised", subtitle: "EBITDA margin, %, by quarter", source: "Source: company management accounts (illustrative figures).", grid: [["", "EBITDA margin"], ["Q2 24", "11"], ["Q3 24", "12"], ["Q4 24", "9"], ["Q1 25", "10"], ["Q2 25", "13"], ["Q3 25", "14"]], highlight: { kind: "last" }, labels: true, format: { suffix: "%" }, growth: "change", sort: "none" };
const blank = () => ({ type: "column", title: "", subtitle: "", source: "", grid: [["", "Series 1"], ["A", ""], ["B", ""], ["C", ""]], highlight: { kind: "none" }, labels: true, format: {}, growth: "none", sort: "none" });
const S = { charts: [], cur: 0, brand: null, sheets: null, officeFonts: false, paper: true };
const cur = () => S.charts[S.cur];
function toast(msg, kind = "") { const t = el("div", `toast${kind ? ` toast--${kind}` : ""}`, msg); $("toasts").appendChild(t); setTimeout(() => t.remove(), kind === "error" ? 7000 : 3400); }
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const stem = (c) => (c.title || "chart").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "chart";
function persist() { try { localStorage.setItem("mcharts", JSON.stringify({ charts: S.charts, cur: S.cur })); } catch (e) { /* private mode */ } }

// The chart spec the renderer and the exporter read: parsed data, sorting and format applied.
export function specOf(c) {
  const d = gridToData(c.grid), single = d.series.length === 1;
  if (single && c.sort && c.sort !== "none" && c.type !== "waterfall" && c.type !== "line") { const order = d.categories.map((_, i) => i).sort((a, b) => (c.sort === "desc" ? 1 : -1) * ((d.series[0].values[b] ?? 0) - (d.series[0].values[a] ?? 0))); d.categories = order.map((i) => d.categories[i]); d.series[0].values = order.map((i) => d.series[0].values[i]); }
  const type = c.type === "pie" || c.type === "waterfall" ? c.type : c.type, data = c.type === "pie" || c.type === "waterfall" ? { ...d, series: d.series.slice(0, 1) } : d;
  const format = { decimals: c.format.decimals ?? autoDecimals(data), prefix: c.format.prefix || "", suffix: c.format.suffix ?? (d.unit === "%" ? "%" : ""), locale: d.lang };
  return { type, title: c.title, subtitle: c.subtitle, source: c.source, data, highlight: c.highlight, labels: c.labels !== false, totals: c.totals !== false, format, growth: c.growth, doughnut: c.doughnut, lastIsTotal: c.lastIsTotal, unit: d.unit };
}
// The checks a chart gets before it leaves: the figure in the title, shares, the bridge total.
export function warningsOf(c, spec = specOf(c)) {
  const out = [], d = spec.data, vals = d.series.flatMap((s) => s.values).filter((v) => v != null);
  if (!d.categories.length || !vals.length) return out;
  const pool = vals.slice(); if (spec.type === "stacked") d.categories.forEach((_, i) => pool.push(d.series.reduce((a, s) => a + (s.values[i] ?? 0), 0))); if (spec.type === "waterfall") pool.push(bridge(spec).end); if (vals.length >= 2) pool.push(vals[vals.length - 1] - vals[0], ((vals[vals.length - 1] - vals[0]) / Math.abs(vals[0] || 1)) * 100);
  for (const f of factsInText(c.title || "", d.lang || "en", {})) { if (f.unit && f.unit !== "%" && f.unit !== "pp" && !["bn", "tn", "m", "k", "x"].includes(f.unit)) continue; const tol = 0.5 * 10 ** -f.decimals + 1e-9; if (pool.some((v) => Math.abs(Math.abs(v) - Math.abs(f.value)) <= tol)) continue; const near = vals.slice().sort((a, b) => Math.abs(Math.abs(a) - Math.abs(f.value)) - Math.abs(Math.abs(b) - Math.abs(f.value)))[0]; out.push({ kind: "error", code: "title-figure", text: `The title says ${f.raw}, but no such figure is in the data (closest: ${formatValue(near, { decimals: Math.max(f.decimals, spec.format.decimals), suffix: spec.format.suffix })}). Readers check the headline against the chart first.` }); }
  if (spec.type === "pie") { const sum = vals.reduce((a, b) => a + b, 0); if (vals.every((v) => v >= 0 && v <= 100) && sum > 90 && sum < 110 && Math.abs(sum - 100) > 0.6) out.push({ kind: "error", code: "shares", text: `The shares add up to ${Math.round(sum * 10) / 10}%, not 100%.` }); if (d.categories.length > 6) out.push({ kind: "note", code: "slices", text: `${d.categories.length} slices are hard to compare. Group the smallest into "Other", or use bars.` }); }
  if (spec.type === "waterfall") { const b = bridge(spec); if (b.stated != null && Math.abs(b.stated - b.end) > 0.5 * 10 ** -spec.format.decimals + 1e-9) out.push({ kind: "error", code: "bridge-total", text: `The steps add up to ${formatValue(b.end, spec.format)}, but the last row says ${formatValue(b.stated, spec.format)}.` }); if (b.crossesZero) out.push({ kind: "note", code: "bridge-zero", text: "This bridge passes below zero, which the PowerPoint chart cannot draw correctly. Check the exported chart." }); }
  if (!c.title.trim()) out.push({ kind: "note", code: "no-title", text: "Give the chart an action title: the conclusion it proves, as a full sentence." });
  if (!c.source.trim()) out.push({ kind: "note", code: "no-source", text: "Add a source line. A figure without a source is the first thing a board member questions." });
  if (gridToData(c.grid).series.length > 1 && (c.type === "pie" || c.type === "waterfall")) out.push({ kind: "note", code: "one-series", text: `A ${c.type === "pie" ? "pie" : "bridge"} shows one series; only "${spec.data.series[0].name}" is drawn.` });
  return out;
}

/* ---------- rendering ---------- */
function renderGrid() {
  const c = cur(), t = $("grid"); t.textContent = "";
  c.grid.forEach((row, r) => { const tr = el("tr"); row.forEach((v, ci) => { const td = el("td"), inp = el("input"); inp.value = v; inp.dataset.r = r; inp.dataset.c = ci; inp.setAttribute("aria-label", r === 0 ? `Series name ${ci}` : ci === 0 ? `Category ${r}` : `Value row ${r} column ${ci}`); td.appendChild(inp); tr.appendChild(td); }); t.appendChild(tr); });
}
function renderTypes() { const box = $("types"); box.textContent = ""; for (const [id, name, path] of TYPES) { const b = el("button", cur().type === id ? "is-on" : ""); b.innerHTML = `<svg viewBox="0 0 28 24"><path d="${path}" fill="currentColor"/></svg>`; b.appendChild(el("span", "", name)); b.title = name; b.addEventListener("click", () => { cur().type = id; change(); renderTypes(); renderOptions(); }); box.appendChild(b); } }
function renderOptions() {
  const c = cur(), d = gridToData(c.grid), box = $("options"); box.textContent = ""; box.appendChild(el("h3", "", "Options")); const o = el("div", "opt"); box.appendChild(o);
  const sel = (label, value, items, fn) => { o.appendChild(el("label", "", label)); const s = el("select"); for (const [v, t] of items) { const op = el("option", "", t); op.value = v; s.appendChild(op); } s.value = value; s.addEventListener("change", () => { fn(s.value); change(); renderOptions(); }); o.appendChild(s); };
  const chk = (label, on, fn) => { const l = el("label", "check"), i = el("input"); i.type = "checkbox"; i.checked = on; i.addEventListener("change", () => { fn(i.checked); change(); }); l.appendChild(i); l.appendChild(document.createTextNode(label)); o.appendChild(l); };
  const single = d.series.length === 1 || c.type === "pie" || c.type === "waterfall";
  if (c.type !== "waterfall") { const hv = c.highlight.kind === "category" || c.highlight.kind === "series" ? `${c.highlight.kind}:${c.highlight.index}` : c.highlight.kind; const items = [["none", "None"]]; if (single && c.type !== "line") { items.push(["last", "The last one"], ["max", "The largest"]); d.categories.forEach((n, i) => items.push([`category:${i}`, n || `Row ${i + 1}`])); } else d.series.forEach((s, i) => items.push([`series:${i}`, s.name])); sel("Highlight", items.some(([v]) => v === hv) ? hv : "none", items, (v) => { const [k, i] = v.split(":"); c.highlight = i == null ? { kind: k } : { kind: k, index: Number(i) }; }); }
  if (single && c.type !== "waterfall" && c.type !== "line") sel("Order", c.sort || "none", [["none", "As entered"], ["desc", "Largest first"], ["asc", "Smallest first"]], (v) => { c.sort = v; });
  o.appendChild(el("label", "", "Number format")); const pair = el("div", "pair"), dec = el("select"); [["auto", "Auto"], ["0", "0"], ["1", "0.0"], ["2", "0.00"]].forEach(([v, t]) => { const op = el("option", "", t); op.value = v; dec.appendChild(op); }); dec.value = c.format.decimals == null ? "auto" : String(c.format.decimals); dec.addEventListener("change", () => { if (dec.value === "auto") delete c.format.decimals; else c.format.decimals = Number(dec.value); change(); });
  const unit = el("input"); unit.type = "text"; unit.placeholder = "Unit after: %, bn"; unit.value = c.format.suffix ?? (d.unit === "%" ? "%" : ""); unit.setAttribute("aria-label", "Unit after the number"); unit.addEventListener("input", () => { c.format.suffix = unit.value; change(); }); pair.appendChild(dec); pair.appendChild(unit); o.appendChild(pair);
  o.appendChild(el("label", "", "Before the number")); const pre = el("input"); pre.type = "text"; pre.placeholder = "Rp, USD"; pre.value = c.format.prefix || ""; pre.addEventListener("input", () => { c.format.prefix = pre.value ? `${pre.value.trim()} ` : ""; change(); }); o.appendChild(pre);
  if (c.type !== "pie" && c.type !== "waterfall") sel("Growth note", c.growth || "none", [["none", "None"], ["change", "Change, first to last"], ["cagr", "CAGR, first to last"]], (v) => { c.growth = v; });
  chk("Show the values on the chart", c.labels !== false, (v) => { c.labels = v; });
  if (c.type === "pie") chk("Doughnut", Boolean(c.doughnut), (v) => { c.doughnut = v; });
  if (c.type === "waterfall") chk("The last row is the closing total (otherwise it is calculated)", Boolean(c.lastIsTotal), (v) => { c.lastIsTotal = v; });
}
function renderPreview() {
  const c = cur(), spec = specOf(c); $("chart").innerHTML = renderChart(spec, 960, 400);
  const w = $("warnings"); w.textContent = ""; for (const x of warningsOf(c, spec)) w.appendChild(el("div", `warn${x.kind === "note" ? " warn--note" : ""}`, x.text));
  $("doc-meta").textContent = `${S.charts.length} chart${S.charts.length > 1 ? "s" : ""} · saved in this browser`;
}
function renderRail() {
  const rail = $("rail"); rail.textContent = "";
  S.charts.forEach((c, i) => { const b = el("button", `thumb${i === S.cur ? " is-on" : ""}`); b.innerHTML = renderChart({ ...specOf(c), labels: false, growth: "none" }, 320, 150); b.appendChild(el("span", "", c.title || "Untitled chart")); b.addEventListener("click", () => { S.cur = i; renderAll(); }); rail.appendChild(b); });
  const add = el("button", "btn add", "+ New chart"); add.addEventListener("click", () => { S.charts.push(blank()); S.cur = S.charts.length - 1; renderAll(); persist(); }); rail.appendChild(add);
  if (S.charts.length) { const row = el("div", "gridacts"); const dup = el("button", "link", "Duplicate"), del = el("button", "link", "Delete"); dup.addEventListener("click", () => { S.charts.splice(S.cur + 1, 0, JSON.parse(JSON.stringify(cur()))); S.cur++; renderAll(); persist(); }); del.addEventListener("click", () => { if (!confirm("Delete this chart?")) return; S.charts.splice(S.cur, 1); if (!S.charts.length) S.charts.push(blank()); S.cur = Math.min(S.cur, S.charts.length - 1); renderAll(); persist(); }); row.appendChild(dup); row.appendChild(del); rail.appendChild(row); }
}
function renderText() { const c = cur(); $("f-title").textContent = c.title; $("f-subtitle").textContent = c.subtitle; $("f-source").textContent = c.source; }
function change() { renderPreview(); persist(); clearTimeout(change.t); change.t = setTimeout(renderRail, 350); }
function renderAll() { renderRail(); renderText(); renderTypes(); renderGrid(); renderOptions(); renderPreview(); }

/* ---------- data in ---------- */
function setGrid(grid, at = null) {
  const c = cur(); if (!grid.length) return;
  if (at && (at.r || at.c)) { grid.forEach((row, r) => row.forEach((v, ci) => { while (c.grid.length <= at.r + r) c.grid.push(Array(c.grid[0].length).fill("")); const w = at.c + ci + 1; if (c.grid[0].length < w) c.grid.forEach((x) => { while (x.length < w) x.push(""); }); c.grid[at.r + r][at.c + ci] = v; })); }
  else c.grid = grid.map((r) => r.slice());
  delete c.format.suffix; c.highlight = c.highlight.kind === "category" || c.highlight.kind === "series" ? { kind: "none" } : c.highlight; renderGrid(); renderOptions(); change();
}
async function openFile(file) {
  if (!file) return;
  try {
    if (/\.(mcharts|json)$/i.test(file.name)) { const j = JSON.parse(await file.text()); if (!Array.isArray(j.charts) || !j.charts.length) throw new Error("This file holds no charts."); S.charts = j.charts; S.cur = 0; S.sheets = null; $("sheets").hidden = true; renderAll(); persist(); toast(`${j.charts.length} chart${j.charts.length > 1 ? "s" : ""} opened.`); return; }
    if (/\.xlsx$/i.test(file.name)) { const sheets = await readXlsx(file); S.sheets = sheets; const s = $("sheets"); s.textContent = ""; sheets.forEach((sh, i) => { const o = el("option", "", `Sheet: ${sh.name}`); o.value = i; s.appendChild(o); }); s.hidden = sheets.length < 2; setGrid(sheets[0].grid); toast(`${file.name}: ${sheets[0].grid.length - 1} rows read${sheets.length > 1 ? ` from "${sheets[0].name}"; choose another sheet under the grid` : ""}.`); return; }
    if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files cannot be read. Save the workbook as .xlsx, or copy the range and paste it.");
    setGrid(parseDelimited(await file.text())); toast(`${file.name} read.`);
  } catch (e) { console.error(e); toast(e.message || "The file could not be read.", "error"); }
}
async function exportPptx(all) { const list = (all ? S.charts : [cur()]).map(specOf).filter((s) => s.data.categories.length && s.data.series.length); if (!list.length) return toast("There is no data to chart yet.", "error"); try { const fonts = S.officeFonts || !S.brand ? { heading: "Georgia", body: "Arial" } : S.brand.fonts; const blob = await exportCharts(list, { fonts, paper: S.paper, name: all ? "Charts" : stem(cur()) }); download(blob, `${all ? "Charts" : stem(cur())}.pptx`); toast(`${list.length} slide${list.length > 1 ? "s" : ""} saved. In PowerPoint, right-click a chart and choose Edit Data to change it.`); } catch (e) { console.error(e); toast(e.message || "The export failed.", "error"); } }
async function exportImage(kind) { const svg = renderChart(specOf(cur()), 1600, 720).replace("<svg ", '<svg width="1600" height="720" '); if (kind === "svg") return download(new Blob([svg], { type: "image/svg+xml" }), `${stem(cur())}.svg`); await document.fonts.ready; const img = new Image(); img.onload = () => { const cv = document.createElement("canvas"); cv.width = 3200; cv.height = 1440; const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob((b) => download(b, `${stem(cur())}.png`), "image/png"); }; img.onerror = () => toast("The picture could not be made.", "error"); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
function exportMenu(anchor) {
  const m = $("menu"); m.textContent = ""; const item = (t, sub, fn) => { const b = el("button", "menu__item"); b.appendChild(el("b", "", t)); b.appendChild(el("small", "", sub)); b.addEventListener("click", () => { m.hidden = true; fn(); }); m.appendChild(b); };
  if (S.charts.length > 1) item("PowerPoint, all charts", `${S.charts.length} slides, each with an editable chart`, () => exportPptx(true));
  item(S.charts.length > 1 ? "PowerPoint, this chart" : "PowerPoint", "One slide with a native chart: Edit Data works", () => exportPptx(false));
  item("Picture (PNG)", "The chart alone, for a report or an email", () => exportImage("png")); item("Vector (SVG)", "The chart alone, scalable", () => exportImage("svg"));
  const f = el("div", "menu__form"); const mk = (label, key) => { const l = el("label"), i = el("input"); i.type = "checkbox"; i.checked = S[key]; i.addEventListener("change", () => { S[key] = i.checked; }); l.appendChild(i); l.appendChild(document.createTextNode(` ${label}`)); f.appendChild(l); }; mk("Office fonts (Georgia, Arial) instead of the house fonts", "officeFonts"); mk("Paper background", "paper"); m.appendChild(f);
  m.hidden = false; const r = anchor.getBoundingClientRect(); m.style.top = `${r.bottom + 6}px`; m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
}
async function boot() {
  try { S.brand = await (await fetch("/brand.json")).json(); } catch (e) { S.brand = null; }
  try { const j = JSON.parse(localStorage.getItem("mcharts") || "null"); if (j && Array.isArray(j.charts) && j.charts.length) { S.charts = j.charts; S.cur = Math.min(j.cur || 0, j.charts.length - 1); } } catch (e) { /* start fresh */ }
  if (!S.charts.length) S.charts = [JSON.parse(JSON.stringify(SAMPLE))];
  for (const [id, key] of [["f-title", "title"], ["f-subtitle", "subtitle"], ["f-source", "source"]]) { const n = $(id); if (n.contentEditable !== "plaintext-only") n.contentEditable = "true"; n.addEventListener("input", () => { cur()[key] = n.textContent.replace(/\s*\n\s*/g, " "); change(); }); n.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); n.blur(); } }); n.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData.getData("text/plain") || "").replace(/\s+/g, " ")); }); }
  const grid = $("grid");
  grid.addEventListener("input", (e) => { const i = e.target; if (i.tagName !== "INPUT") return; cur().grid[Number(i.dataset.r)][Number(i.dataset.c)] = i.value; change(); clearTimeout(boot.t); boot.t = setTimeout(renderOptions, 600); });
  grid.addEventListener("paste", (e) => { const t = e.clipboardData.getData("text/plain"); if (!/[\t\n]/.test(t.trim())) return; e.preventDefault(); const i = e.target, at = { r: Number(i.dataset.r || 0), c: Number(i.dataset.c || 0) }, g = parseDelimited(t); setGrid(g, at); toast(`${g.length} row${g.length > 1 ? "s" : ""} pasted.`); });
  grid.addEventListener("keydown", (e) => { const i = e.target; if (i.tagName !== "INPUT") return; const r = Number(i.dataset.r), c = Number(i.dataset.c), go = (rr, cc) => { const n = grid.querySelector(`input[data-r="${rr}"][data-c="${cc}"]`); if (n) { e.preventDefault(); n.focus(); n.select(); } }; if (e.key === "Enter" || e.key === "ArrowDown") go(r + 1, c); else if (e.key === "ArrowUp") go(r - 1, c); });
  document.querySelector(".gridacts").addEventListener("click", async (e) => { const a = e.target.dataset.g, c = cur(); if (!a) return;
    if (a === "row") c.grid.push(Array(c.grid[0].length).fill("")); else if (a === "col") c.grid.forEach((r, i) => r.push(i ? "" : `Series ${r.length}`)); else if (a === "swap") c.grid = transpose(c.grid); else if (a === "clear") { if (!confirm("Clear the data of this chart?")) return; c.grid = blank().grid; }
    else if (a === "paste") { try { const t = await navigator.clipboard.readText(); if (!t.trim()) throw new Error("empty"); setGrid(parseDelimited(t)); toast("Pasted from the clipboard."); } catch (err) { toast("Click the first cell of the grid and press Ctrl+V (the browser did not allow reading the clipboard directly).", "error"); } return; }
    c.highlight = { kind: c.highlight.kind === "last" || c.highlight.kind === "max" ? c.highlight.kind : "none" }; renderGrid(); renderOptions(); change(); });
  $("sheets").addEventListener("change", (e) => { if (S.sheets) setGrid(S.sheets[Number(e.target.value)].grid); });
  $("btn-open").addEventListener("click", () => $("file").click()); $("file").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; openFile(f); });
  $("btn-save").addEventListener("click", () => download(new Blob([JSON.stringify({ format: "metanoia-charts", version: 1, charts: S.charts }, null, 1)], { type: "application/json" }), "Charts.mcharts"));
  $("btn-export").addEventListener("click", (e) => exportMenu(e.currentTarget));
  document.addEventListener("pointerdown", (e) => { if (!$("menu").hidden && !$("menu").contains(e.target) && !e.target.closest("#btn-export")) $("menu").hidden = true; }, true);
  let depth = 0; window.addEventListener("dragenter", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { depth++; document.body.classList.add("is-drop"); } }); window.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove("is-drop"); }); window.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); }); window.addEventListener("drop", (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); depth = 0; document.body.classList.remove("is-drop"); openFile(e.dataTransfer.files[0]); });
  window.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); $("file").click(); } else if (e.key === "Escape") $("menu").hidden = true; });
  renderAll(); window.__charts = { S, specOf, warningsOf, setGrid, openFile, exportCharts, renderAll, blank };
  document.documentElement.dataset.ready = "1";
}
boot();
