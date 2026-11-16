// Magic Layers — application wiring: opening files, running the analysis, tools, menus, shortcuts, exports, AI assist.
import { state, on, emit, page, layers, layerById, selected, select, clearSelection, checkpoint, undo, redo, canUndo, canRedo, updateLayers, addLayer, removeLayers, duplicateLayers, reorder, setTool, setPage } from "./state.js";
import { initStage, fitView, zoomAt, startEditing, finishEditing, isEditing, isTyping, restyleText, measureText } from "./stage.js";
import { initPanels } from "./panels.js";
import { openFiles } from "./importers.js";
import { analyzePage, inpaintRect } from "./pipeline.js";
import { exportPptx, exportPng, exportSvg, exportPsd, exportProject } from "./exporters.js";
import { renderPage, drawLayer } from "./render.js";
import { SERIF } from "./fonts.js";
import { uid, makeCanvas, loadImage, download, canvasToBlob, median, fileStem } from "./util.js";

const $ = (id) => document.getElementById(id);
let brand = { fonts: { heading: "Fraunces", body: "Inter" }, colors: [] }, dirty = false;

/* ---------- feedback ---------- */
function toast(msg, kind = "") { const t = document.createElement("div"); t.className = `toast${kind ? ` toast--${kind}` : ""}`; t.textContent = msg; $("toasts").appendChild(t); setTimeout(() => t.remove(), kind === "error" ? 7000 : 3800); }
function progress(title, step = "", frac = null) { $("progress").hidden = false; $("progress-title").textContent = title; $("progress-step").textContent = step; if (frac != null) $("progress-bar").style.width = `${Math.round(frac * 100)}%`; }
function progressDone() { $("progress").hidden = true; $("progress-bar").style.width = "0"; }
async function busy(title, fn) { if (state.busy) return; state.busy = true; progress(title, "", 0.03); try { return await fn(); } catch (e) { console.error(e); toast(e.message || "Something went wrong.", "error"); } finally { state.busy = false; progressDone(); } }

/* ---------- menus ---------- */
function closeMenu() { $("menu").hidden = true; $("menu").textContent = ""; }
function openMenu(anchor, build) { const m = $("menu"); m.textContent = ""; build(m); m.hidden = false; const r = anchor.getBoundingClientRect(), w = m.offsetWidth; m.style.top = `${r.bottom + 6}px`; m.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w))}px`; }
function menuItem(m, title, sub, hint, fn, disabled = false) { const b = document.createElement("button"); b.className = "menu__item"; b.disabled = disabled; b.innerHTML = `<b></b><i></i><small></small>`; b.children[0].textContent = title; b.children[1].textContent = hint || ""; b.children[2].textContent = sub || ""; if (!sub) b.children[2].remove(); b.addEventListener("click", () => { closeMenu(); fn(); }); m.appendChild(b); return b; }
const menuSep = (m) => { const d = document.createElement("div"); d.className = "menu__sep"; m.appendChild(d); };

/* ---------- opening ---------- */
async function open(files) {
  if (!files || !files.length) return;
  if (dirty && !confirm("Open a new file? Unsaved changes to the current one will be lost (save a project file first to keep them).")) return;
  const res = await busy("Opening", () => openFiles(files, (step, f) => progress("Opening", step, f)));
  if (!res) return; (res.skipped || []).forEach((s) => toast(s, "error")); if (!res.project) return;
  state.project = res.project; state.pageIndex = 0; state.selection.clear(); dirty = false; emit("project"); emit("history"); updateChrome();
  if (!page().layers) await analyse();
}
async function openSample() { const blob = await (await fetch("/sample/sample-slide.png")).blob(); await open([new File([blob], "Sample slide.png", { type: "image/png" })]); }

/* ---------- analysis ---------- */
async function analysePage(p, label = "Creating layers") {
  const opts = { lang: state.settings.lang, detail: state.settings.detail, thorough: state.settings.thorough, pdfText: p.pdfText, name: p.name };
  let res = await analyzePage(p.raw || p.original, opts, (step, f) => progress(label, step, f * (state.settings.useAi && state.ai.available ? 0.7 : 1)));
  let aiNote = "";
  if (state.settings.useAi && state.ai.available) { try { const out = await aiAssist(res, opts, (step) => progress(label, step, 0.85)); res = out.page; aiNote = out.note; } catch (e) { console.error(e); toast(`AI assist: ${e.message}`, "error"); } }
  Object.assign(p, { width: res.width, height: res.height, original: res.original, layers: res.layers, stats: { ...res.stats, aiNote }, ocrLines: res.ocrLines, history: { undo: [], redo: [] } });
  return p;
}
async function analyse() {
  const p = page(); if (!p) return;
  if (p.layers && p.history && p.history.undo.length && !confirm("Create the layers again? Edits made on this page will be replaced.")) return;
  await busy("Creating layers", async () => { finishEditing(true); await analysePage(p); state.selection.clear(); dirty = true; emit("page"); emit("history"); updateChrome(); const s = p.stats; toast(`Done: ${s.text} text boxes, ${s.shapes} shapes, ${s.pictures} pictures.`); });
}
async function analyseAll() {
  const pr = state.project; if (!pr) return; const todo = pr.pages.filter((p) => !p.layers); if (!todo.length) return;
  await busy("Creating layers", async () => { let n = 0; for (const p of todo) { n++; await analysePage(p, `Creating layers · page ${n} of ${todo.length}`); emit("layers"); } dirty = true; emit("page"); updateChrome(); toast(`${todo.length} pages separated into layers.`); });
}

/* ---------- AI assist (optional) ---------- */
const lev = (a, b) => { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; };
const iou = (a, b) => { const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ix <= 0 || iy <= 0) return 0; const inter = ix * iy; return inter / (a.w * a.h + b.w * b.h - inter); };
async function askAi(pg) {
  const k = Math.min(1, 1568 / Math.max(pg.width, pg.height)), c = makeCanvas(pg.width * k, pg.height * k); c.getContext("2d").drawImage(pg.original, 0, 0, c.width, c.height);
  const r = await fetch("/api/ai-assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: c.toDataURL("image/jpeg", 0.9) }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error({ no_key: "no API key is configured", not_installed: "run npm install in the app folder first", bad_key: "the API key was rejected", busy: "the service is busy, try again shortly", declined: "the request was declined" }[j.error] || "the request failed");
  const sx = pg.width / 1000, sy = pg.height / 1000, toBox = (o) => ({ x: o.x0 * sx, y: o.y0 * sy, w: Math.max(1, (o.x1 - o.x0) * sx), h: Math.max(1, (o.y1 - o.y0) * sy) });
  return { lines: (j.result.lines || []).map((l) => ({ ...l, box: toBox(l) })), objects: (j.result.objects || []).map((o) => ({ ...o, box: toBox(o) })), note: j.result.note || "" };
}
// Apply the model's reading to a page: fix misread lines, name pictures. Returns the lines no local text layer covers.
function applyAi(pg, ai) {
  const missing = []; let fixed = 0, named = 0;
  const local = []; for (const l of pg.layers) { if (l.type !== "text") continue; const lines = l.text.split("\n"), L = l.h / lines.length; lines.forEach((t, i) => local.push({ l, i, text: t, box: { x: l.x, y: l.y + i * L, w: l.w, h: L } })); }
  const patches = new Map();
  for (const a of ai.lines) {
    if (a.role === "logo") continue;
    let best = null, bs = 0; for (const q of local) { const ov = iou(a.box, q.box); if (ov > bs) { bs = ov; best = q; } }
    if (!best || bs < 0.18) { missing.push(a); continue; }
    const A = a.text.trim(), Bt = best.text.trim(); if (A === Bt || !A) continue;
    const sim = 1 - lev(A.toLowerCase(), Bt.toLowerCase()) / Math.max(A.length, Bt.length);
    if (sim >= 0.5 && sim < 1) { const arr = patches.get(best.l.id) || best.l.text.split("\n"); arr[best.i] = A; patches.set(best.l.id, arr); fixed++; }
  }
  for (const [id, arr] of patches) { const l = pg.layers.find((x) => x.id === id), text = arr.join("\n"); Object.assign(l, { text, runs: null, name: text.replace(/\s+/g, " ").slice(0, 36) }); Object.assign(l, restyleText(l, {})); l.meta = { ...(l.meta || {}), confidence: 99, source: "ai" }; }
  for (const o of ai.objects) { let best = null, bs = 0; for (const l of pg.layers) { if (l.type !== "image" && !(l.type === "shape" && l.shape !== "line")) continue; const ov = iou(o.box, l); if (ov > bs) { bs = ov; best = l; } } if (best && bs >= 0.4 && !(best.meta && best.meta.renamed)) { best.name = o.name; named++; } }
  return { missing, fixed, named };
}
async function aiAssist(pg, opts, onStep = () => {}) {
  onStep("AI assist is reading the slide");
  const ai = await askAi(pg); let out = applyAi(pg, ai), added = 0;
  if (out.missing.length && opts) {
    onStep("Adding the text the first pass missed");
    const extra = out.missing.map((a) => { const b = { x0: Math.round(a.box.x), y0: Math.round(a.box.y), x1: Math.round(a.box.x + a.box.w), y1: Math.round(a.box.y + a.box.h) }; return { text: a.text, conf: 80, chars: a.text.length, source: "ai", score: 40, ...b, words: [{ text: a.text, conf: 80, ...b }] }; });
    const before = pg.layers.filter((l) => l.type === "text").length;
    pg = await analyzePage(pg.original, { ...opts, ocrLines: pg.ocrLines || undefined, pdfText: opts.pdfText, extraLines: extra }, () => {});
    added = Math.max(0, pg.layers.filter((l) => l.type === "text").length - before); out = { ...applyAi(pg, ai), missing: out.missing };
  }
  const parts = []; if (out.fixed) parts.push(`${out.fixed} lines corrected`); if (added) parts.push(`${added} text boxes recovered`); if (out.named) parts.push(`${out.named} layers named`);
  return { page: pg, note: `${parts.length ? parts.join(", ") + ". " : "Nothing needed correcting. "}${ai.note}`, missing: out.missing.length, added };
}
async function runAiAssist() {
  const p = page(); if (!p || !p.layers) return;
  await busy("AI assist", async () => { finishEditing(true); const edited = p.history && p.history.undo.length > 0; checkpoint();
    const opts = edited ? null : { lang: state.settings.lang, detail: state.settings.detail, thorough: state.settings.thorough, pdfText: p.pdfText, name: p.name };
    const out = await aiAssist(p, opts, (s) => progress("AI assist", s, 0.5));
    if (out.page !== p) Object.assign(p, { layers: out.page.layers, original: out.page.original, ocrLines: out.page.ocrLines });
    p.stats = { ...(p.stats || {}), aiNote: out.note + (edited && out.missing ? ` ${out.missing} lines of text were not picked up locally: run Analyse with AI assist switched on to add them.` : "") };
    state.selection.clear(); dirty = true; emit("layers"); emit("selection"); toast(`AI assist: ${out.note}`); });
}

/* ---------- canvas actions ---------- */
function addText(pt) {
  const ts = layers().filter((l) => l.type === "text"), fam = ts.length ? mode(ts.map((l) => l.fontFamily)) : brand.fonts.body, size = ts.length ? median(ts.map((l) => l.fontSize)) : Math.round(page().height * 0.035), color = ts.length ? mode(ts.map((l) => l.color)) : "#111111";
  const l = { type: "text", name: "Text", text: "Text", runs: null, x: pt.x, y: pt.y, w: 10, h: 10, fontFamily: fam, fontSize: Math.round(size), fontWeight: 400, italic: false, color, align: "left", lineHeight: 1.2, letterSpacing: 0, wrap: false, meta: { source: "manual", pad: Math.ceil(size * 0.08) } };
  const m = measureText(l); l.w = m.w; l.h = m.h; l.y = pt.y - m.h / 2;
  const added = addLayer(l); setTool("select"); dirty = true; requestAnimationFrame(() => startEditing(added.id, true));
}
const mode = (arr) => { const c = new Map(); for (const v of arr) c.set(v, (c.get(v) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
async function lift(rect) {
  const p = page(); if (!p || !p.layers) return;
  // target: a selected picture that contains the rectangle, otherwise the background
  const sel = selected()[0]; const target = sel && sel.type === "image" && sel.canvas && rect.x >= sel.x - 1 && rect.y >= sel.y - 1 && rect.x + rect.w <= sel.x + sel.w + 1 && rect.y + rect.h <= sel.y + sel.h + 1 ? sel : p.layers.find((l) => l.type === "background");
  if (!target || !target.canvas) { toast("Nothing to lift here: the background is a plain colour.", "error"); return; }
  await busy("Lifting", async () => {
    const kx = target.canvas.width / target.w, ky = target.canvas.height / target.h, r = { x: Math.round((rect.x - target.x) * kx), y: Math.round((rect.y - target.y) * ky), w: Math.round(rect.w * kx), h: Math.round(rect.h * ky) };
    const piece = makeCanvas(r.w, r.h); piece.getContext("2d").drawImage(target.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    let next;
    next = await inpaintRect(target.canvas, r);
    if (target.type !== "background") { const c = next.getContext("2d"); c.globalCompositeOperation = "destination-in"; c.drawImage(target.canvas, 0, 0); c.globalCompositeOperation = "source-over"; }   // keep the cut-out's own outline
    checkpoint(); target.canvas = next; if (target.type === "background") target.uniform = false;
    const idx = p.layers.indexOf(target); const layer = { id: uid("i"), type: "image", name: "Lifted area", x: rect.x, y: rect.y, w: rect.w, h: rect.h, canvas: piece, opacity: 1, visible: true, locked: false, meta: { source: "lift" } };
    p.layers.splice(idx + 1, 0, layer); dirty = true; emit("layers"); select(layer.id); toast("Lifted into its own layer. The gap behind it was repaired.");
  });
}
function rasterise() {
  const p = page(), l = selected()[0]; if (!l || l.type !== "text" || !p.original) return;
  const m = Math.ceil(l.fontSize * 0.25), x = Math.max(0, Math.floor(l.x - m)), y = Math.max(0, Math.floor(l.y - m)), w = Math.min(p.width - x, Math.ceil(l.w + m * 2)), h = Math.min(p.height - y, Math.ceil(l.h + m * 2));
  const c = makeCanvas(w, h); c.getContext("2d").drawImage(p.original, x, y, w, h, 0, 0, w, h);
  checkpoint(); const idx = p.layers.indexOf(l); const layer = { id: uid("i"), type: "image", name: `${l.name} (picture)`, x, y, w, h, canvas: c, opacity: l.opacity ?? 1, visible: true, locked: false, meta: { source: "restore" } };
  p.layers.splice(idx, 1, layer); dirty = true; emit("layers"); select(layer.id);
}
function merge() {
  const p = page(), sel = selected().filter((l) => l.type !== "background"); if (sel.length < 2) return;
  const x0 = Math.floor(Math.min(...sel.map((l) => l.x))), y0 = Math.floor(Math.min(...sel.map((l) => l.y))), x1 = Math.ceil(Math.max(...sel.map((l) => l.x + l.w))), y1 = Math.ceil(Math.max(...sel.map((l) => l.y + l.h)));
  const c = makeCanvas(x1 - x0, y1 - y0), ctx = c.getContext("2d"); ctx.translate(-x0, -y0); for (const l of p.layers) if (sel.includes(l)) drawLayer(ctx, l);
  checkpoint(); const top = Math.max(...sel.map((l) => p.layers.indexOf(l))); const layer = { id: uid("i"), type: "image", name: "Merged picture", x: x0, y: y0, w: x1 - x0, h: y1 - y0, canvas: c, opacity: 1, visible: true, locked: false, meta: { source: "merge", cutout: true } };
  p.layers.splice(top + 1, 0, layer); p.layers = p.layers.filter((l) => !sel.includes(l)); dirty = true; emit("layers"); select(layer.id);
}
function pickImage() { return new Promise((res) => { const i = $("file-image"); i.value = ""; i.onchange = async () => { const f = i.files[0]; if (!f) return res(null); const url = URL.createObjectURL(f); try { const img = await loadImage(url); const c = makeCanvas(img.naturalWidth, img.naturalHeight); c.getContext("2d").drawImage(img, 0, 0); res(c); } catch (e) { toast("That picture could not be opened.", "error"); res(null); } finally { URL.revokeObjectURL(url); } }; i.click(); }); }
async function replaceImage() { const l = selected()[0]; if (!l || l.type !== "image") return; const c = await pickImage(); if (!c) return; const k = Math.max(l.w / c.width, l.h / c.height), fit = makeCanvas(Math.round(l.w * 2), Math.round(l.h * 2)), ctx = fit.getContext("2d"), w = c.width * k * 2, h = c.height * k * 2; ctx.drawImage(c, (fit.width - w) / 2, (fit.height - h) / 2, w, h); updateLayers([l.id], { canvas: fit, meta: { ...(l.meta || {}), cutout: false } }); dirty = true; }
async function saveImage() { const l = selected()[0]; if (!l || !l.canvas) return; download(await canvasToBlob(l.canvas), `${fileStem(l.name)}.png`); }
function insert(kind) {
  const p = page(); if (!p || !p.layers) return; const w = Math.round(p.width * 0.22), h = Math.round(p.height * 0.2), x = Math.round((p.width - w) / 2), y = Math.round((p.height - h) / 2), fill = brand.colors[3] || "#EAB200";
  if (kind === "rect") addLayer({ type: "shape", shape: "rect", name: "Rectangle", x, y, w, h, fill, radius: 0 });
  else if (kind === "round") addLayer({ type: "shape", shape: "rect", name: "Rounded rectangle", x, y, w, h, fill, radius: Math.round(h * 0.12) });
  else if (kind === "ellipse") addLayer({ type: "shape", shape: "ellipse", name: "Ellipse", x: Math.round((p.width - h) / 2), y, w: h, h, fill });
  else if (kind === "line") addLayer({ type: "shape", shape: "line", name: "Line", x, y: Math.round(p.height / 2), w, h: Math.max(2, Math.round(p.height * 0.004)), fill: "#111111", horizontal: true });
  dirty = true;
}
async function insertPicture() { const p = page(); if (!p || !p.layers) return; const c = await pickImage(); if (!c) return; const k = Math.min(1, (p.width * 0.5) / c.width, (p.height * 0.5) / c.height); addLayer({ type: "image", name: "Picture", x: Math.round((p.width - c.width * k) / 2), y: Math.round((p.height - c.height * k) / 2), w: Math.round(c.width * k), h: Math.round(c.height * k), canvas: c }); dirty = true; }
function brandFonts() {
  const ts = layers().filter((l) => l.type === "text"); if (!ts.length) return; const med = median(ts.map((l) => l.fontSize));
  updateLayers(ts.map((l) => l.id), (l) => { const heading = (l.meta && l.meta.role === "title") || l.fontSize >= med * 1.45 || SERIF.has(l.fontFamily); const fam = heading ? brand.fonts.heading : brand.fonts.body; return restyleText(l, { fontFamily: fam, fontWeight: heading ? 600 : (l.fontWeight || 400) >= 600 ? 600 : 400 }); });
  dirty = true; toast(`Brand fonts applied: ${brand.fonts.heading} for titles, ${brand.fonts.body} for the rest.`);
}

/* ---------- export ---------- */
async function doExport(kind, opts = {}) {
  const pr = state.project, p = page(); if (!pr || !p) return; finishEditing(true);
  if (kind === "pptx" && pr.pages.some((x) => !x.layers) && opts.all) await analyseAll();
  await busy("Exporting", async () => {
    progress("Exporting", { pptx: "Building the PowerPoint file", psd: "Building the Photoshop file", png: "Rendering", svg: "Writing SVG", project: "Saving the project" }[kind], 0.5);
    let out;
    if (kind === "pptx") out = await exportPptx(pr, { safeFonts: opts.safeFonts, pages: opts.all ? null : [p] });
    else if (kind === "png") out = await exportPng(p, opts.scale || 1); else if (kind === "svg") out = await exportSvg(p); else if (kind === "psd") out = await exportPsd(p); else out = await exportProject(pr);
    download(out.blob, out.name); if (kind === "project") dirty = false;
    toast(kind === "pptx" ? `Saved ${out.name} (${out.slides} slide${out.slides > 1 ? "s" : ""}). Text boxes, shapes and pictures are editable in PowerPoint.` : `Saved ${out.name}.`);
  });
}
function exportMenu(anchor) {
  const pr = state.project, p = page(); if (!pr) return; const layered = Boolean(p && p.layers), multi = pr.pages.length > 1, flat = pr.pages.filter((x) => !x.layers).length;
  openMenu(anchor, (m) => {
    if (multi) menuItem(m, "PowerPoint, all pages", flat ? `${flat} flat page${flat > 1 ? "s" : ""} will be separated first` : `${pr.pages.length} editable slides`, ".pptx", () => doExport("pptx", { all: true }));
    menuItem(m, multi ? "PowerPoint, this page" : "PowerPoint", "Live text boxes, shapes and pictures", ".pptx", () => doExport("pptx", {}), !layered);
    menuItem(m, "PowerPoint with Office fonts", "Same, with Arial and Georgia for computers without the matched fonts", ".pptx", () => doExport("pptx", { safeFonts: true, all: multi }), !layered && !multi);
    menuSep(m);
    menuItem(m, "Photoshop layers", "One named layer per element (text as pixels)", ".psd", () => doExport("psd"), !layered);
    menuItem(m, "SVG", "Vector shapes and real text", ".svg", () => doExport("svg"), !layered);
    menuItem(m, "PNG", "The page as edited", ".png", () => doExport("png"), !layered);
    menuItem(m, "PNG, double size", "For retina screens and print drafts", ".png", () => doExport("png", { scale: 2 }), !layered);
    menuSep(m);
    menuItem(m, "Save project", "Reopen later with every layer intact", ".mlayers", () => doExport("project"));
  });
}
function analyseMenu(anchor) {
  openMenu(anchor, (m) => {
    const f = document.createElement("div"); f.className = "menu__form";
    f.innerHTML = `<label class="field"><span>Text language</span><select id="set-lang"><option value="eng">English</option><option value="ind">Indonesian</option><option value="eng+ind">English and Indonesian</option></select></label>
      <label class="field"><span>Detail</span><select id="set-detail"><option value="0">Simple: fewer, larger layers</option><option value="1">Balanced</option><option value="2">Detailed: more small elements</option></select></label>
      <label title="Reads the page a second time after the first text is removed. Slower; helps on dense slides."><input type="checkbox" id="set-thorough"> Thorough text search (slower)</label>
      <label title="${state.ai.available ? "Claude checks the reading, recovers missed text and names the layers. The slide image is sent to the Anthropic API." : "Add an Anthropic API key to a .env file in the app folder to enable this."}"><input type="checkbox" id="set-ai" ${state.ai.available ? "" : "disabled"}> Use AI assist ${state.ai.available ? "" : "(not configured)"}</label>
      <button class="btn btn--primary btn--block" id="set-run">${page() && page().layers ? "Create layers again" : "Create layers"}</button>${state.project && state.project.pages.some((x) => !x.layers) && state.project.pages.length > 1 ? '<button class="btn btn--block" id="set-all">Create layers for every page</button>' : ""}`;
    m.appendChild(f);
    f.querySelector("#set-lang").value = state.settings.lang; f.querySelector("#set-detail").value = String(state.settings.detail); f.querySelector("#set-thorough").checked = state.settings.thorough; f.querySelector("#set-ai").checked = Boolean(state.settings.useAi && state.ai.available);
    f.addEventListener("change", () => { state.settings.lang = f.querySelector("#set-lang").value; state.settings.detail = Number(f.querySelector("#set-detail").value); state.settings.thorough = f.querySelector("#set-thorough").checked; state.settings.useAi = f.querySelector("#set-ai").checked; try { localStorage.setItem("ml-settings", JSON.stringify(state.settings)); } catch (e) { /* private mode */ } });
    f.querySelector("#set-run").addEventListener("click", () => { closeMenu(); analyse(); }); const all = f.querySelector("#set-all"); if (all) all.addEventListener("click", () => { closeMenu(); analyseAll(); });
  });
}
function insertMenu(anchor) { openMenu(anchor, (m) => { menuItem(m, "Rectangle", "", "", () => insert("rect")); menuItem(m, "Rounded rectangle", "", "", () => insert("round")); menuItem(m, "Ellipse", "", "", () => insert("ellipse")); menuItem(m, "Line", "", "", () => insert("line")); menuSep(m); menuItem(m, "Picture from file", "", "", insertPicture); }); const r = anchor.getBoundingClientRect(); $("menu").style.left = `${r.left}px`; }

/* ---------- chrome ---------- */
function updateChrome() {
  const pr = state.project, p = page();
  $("doc-name").textContent = pr ? pr.name : ""; $("doc-meta").textContent = p ? `${p.width} × ${p.height}${pr.pages.length > 1 ? ` · page ${state.pageIndex + 1} of ${pr.pages.length}` : ""}` : "";
  $("btn-export").disabled = !pr; $("btn-analyse").disabled = !pr; $("btn-ai").hidden = !state.ai.available; $("btn-ai").disabled = !(p && p.layers);
  $("btn-undo").disabled = !canUndo(); $("btn-redo").disabled = !canRedo(); $("zoom-label").textContent = `${Math.round(state.zoom * 100)}%`;
  document.querySelectorAll("#toolbar [data-tool]").forEach((b) => b.classList.toggle("is-active", b.dataset.tool === state.tool));
  document.title = pr ? `${pr.name} — Magic Layers` : "Magic Layers — Metanoia Advisory";
}
function setOriginal(on2) { if (state.showOriginal === on2) return; state.showOriginal = on2; $("btn-compare").classList.toggle("is-on", on2); emit("original"); }

function initEvents() {
  $("btn-open").addEventListener("click", () => $("file").click()); $("btn-open-2").addEventListener("click", () => $("file").click()); $("btn-sample").addEventListener("click", openSample);
  $("file").addEventListener("change", (e) => { const fs = [...e.target.files]; e.target.value = ""; open(fs); });
  $("btn-export").addEventListener("click", (e) => exportMenu(e.currentTarget)); $("btn-analyse").addEventListener("click", (e) => analyseMenu(e.currentTarget)); $("btn-ai").addEventListener("click", runAiAssist); $("btn-analyse-all").addEventListener("click", analyseAll);
  $("toolbar").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.tool) return setTool(b.dataset.tool); const a = b.dataset.action; if (a === "undo") undo(); else if (a === "redo") redo(); else if (a === "zoom-in") zoomAt(1.25); else if (a === "zoom-out") zoomAt(0.8); else if (a === "zoom-fit") fitView(); else if (a === "insert") insertMenu(b); });
  const cmp = $("btn-compare"); cmp.addEventListener("pointerdown", () => setOriginal(true)); ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => cmp.addEventListener(ev, () => setOriginal(false)));
  document.addEventListener("pointerdown", (e) => { if (!$("menu").hidden && !$("menu").contains(e.target) && !e.target.closest("#btn-export,#btn-analyse,[data-action=insert]")) closeMenu(); }, true);
  // drag and drop
  const vp = $("viewport"); let depth = 0;
  window.addEventListener("dragenter", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { depth++; vp.classList.add("is-drop"); } });
  window.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) vp.classList.remove("is-drop"); });
  window.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  window.addEventListener("drop", (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); depth = 0; vp.classList.remove("is-drop"); open([...e.dataTransfer.files]); });
  window.addEventListener("paste", (e) => { if (isTyping(e)) return; const f = [...(e.clipboardData ? e.clipboardData.files : [])].filter((x) => /^image\//.test(x.type)); if (f.length) open(f.map((x) => new File([x], "Pasted image.png", { type: x.type }))); });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  // keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeMenu(); if (!isTyping(e)) { clearSelection(); setTool("select"); } return; }
    if (isTyping(e) || isEditing()) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), ids = selected().map((l) => l.id);
    if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } else if (mod && k === "y") { e.preventDefault(); redo(); }
    else if (mod && k === "o") { e.preventDefault(); $("file").click(); } else if (mod && k === "s") { e.preventDefault(); doExport("project"); } else if (mod && k === "e") { e.preventDefault(); doExport("pptx", { all: state.project && state.project.pages.length > 1 }); }
    else if (mod && k === "d") { e.preventDefault(); duplicateLayers(ids); dirty = true; } else if (mod && k === "a") { e.preventDefault(); select(layers().filter((l) => !l.locked && l.visible && l.type !== "background").map((l) => l.id)); }
    else if (mod && (k === "=" || k === "+")) { e.preventDefault(); zoomAt(1.25); } else if (mod && k === "-") { e.preventDefault(); zoomAt(0.8); } else if (mod && k === "0") { e.preventDefault(); fitView(); }
    else if (mod) return;
    else if (k === "delete" || k === "backspace") { if (ids.length) { e.preventDefault(); removeLayers(ids); dirty = true; } }
    else if (k === "v") setTool("select"); else if (k === "t") setTool("text"); else if (k === "l") setTool("lift"); else if (k === "h") setTool("hand"); else if (k === "1") fitView();
    else if (k === "]") reorder(ids, e.shiftKey ? "front" : "up"); else if (k === "[") reorder(ids, e.shiftKey ? "back" : "down"); else if (k === "\\") setOriginal(true);
    else if (k === "enter" && selected().length === 1 && selected()[0].type === "text") { e.preventDefault(); startEditing(ids[0], true); }
    else if (k.startsWith("arrow") && ids.length) { e.preventDefault(); const d = e.shiftKey ? 10 : 1, dx = k === "arrowleft" ? -d : k === "arrowright" ? d : 0, dy = k === "arrowup" ? -d : k === "arrowdown" ? d : 0; updateLayers(selected().filter((l) => !l.locked).map((l) => l.id), (l) => ({ x: l.x + dx, y: l.y + dy }), "nudge"); dirty = true; }
  });
  window.addEventListener("keyup", (e) => { if (e.key === "\\") setOriginal(false); });
  on("history", updateChrome); on("tool", updateChrome); on("view", updateChrome); on("page", updateChrome); on("selection", updateChrome); on("layers", () => { dirty = true; updateChrome(); });
}

async function boot() {
  try { const s = JSON.parse(localStorage.getItem("ml-settings") || "null"); if (s) Object.assign(state.settings, s); } catch (e) { /* ignore */ }
  try { const st = await (await fetch("/api/status")).json(); state.ai = { available: Boolean(st.ai), installed: Boolean(st.aiInstalled) }; } catch (e) { state.ai = { available: false, installed: false }; }
  initStage({ addText, lift, pendingCta: (p) => { const d = document.createElement("div"); d.className = "pagecta"; d.innerHTML = `<span>This page is flat${p.pdfText ? " (its PDF text will be used exactly)" : ""}.</span>`; const b = document.createElement("button"); b.className = "btn btn--primary"; b.textContent = "Create layers"; b.addEventListener("click", analyse); d.appendChild(b); return d; } });
  const panels = await initPanels({ analyse, rasterise, merge, "replace-image": replaceImage, "save-image": saveImage, "brand-fonts": brandFonts }); brand = panels.brand && panels.brand.fonts ? panels.brand : brand;
  initEvents(); updateChrome();
  window.__ml = { state, open, analyse, doExport, exportPptx, exportSvg, exportPsd, exportProject, exportPng, renderPage, page, lift };   // for automated tests
  document.documentElement.dataset.ready = "1";
}
boot();
