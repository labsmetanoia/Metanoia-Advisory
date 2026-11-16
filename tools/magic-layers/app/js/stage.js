// The canvas: draws the current page as DOM layers and handles selection, moving, resizing, text editing,
// marquee selection, the lift tool, snapping, zoom and pan.
import { state, on, emit, page, layers, layerById, selected, select, clearSelection, checkpoint, removeLayers, setTool } from "./state.js";
import { cssFamily, baselineOffset } from "./fonts.js";
import { layoutText, layerRuns } from "./render.js";
import { clamp, makeCanvas } from "./util.js";

let viewport, stage, pageEl, overlay, handlers = {};
let editing = null, spaceDown = false, drag = null, guides = [];
const measureCtx = makeCanvas(8, 8).getContext("2d");

export function toPage(e) { const r = viewport.getBoundingClientRect(); return { x: (e.clientX - r.left - state.panX) / state.zoom, y: (e.clientY - r.top - state.panY) / state.zoom }; }
function applyView() { stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`; stage.style.setProperty("--z", state.zoom); emit("view"); }
export function fitView() { const p = page(); if (!p) return; const r = viewport.getBoundingClientRect(), m = 56; const z = clamp(Math.min((r.width - m * 2) / p.width, (r.height - m * 2) / p.height), 0.05, 4); state.zoom = z; state.panX = (r.width - p.width * z) / 2; state.panY = (r.height - p.height * z) / 2; applyView(); }
export function zoomAt(factor, cx, cy) { const r = viewport.getBoundingClientRect(); const px = cx ?? r.width / 2, py = cy ?? r.height / 2; const z = clamp(state.zoom * factor, 0.05, 8), k = z / state.zoom; state.panX = px - (px - state.panX) * k; state.panY = py - (py - state.panY) * k; state.zoom = z; applyView(); }

/* ---------- text geometry ---------- */
// Natural size of a text layer's content (unwrapped: widest line; wrapped: current width).
export function measureText(l) { const lines = layoutText(measureCtx, l); measureCtx.letterSpacing = "0px"; const pad = l.meta?.pad ?? 0, L = (l.lineHeight || 1.2) * l.fontSize; return { w: l.wrap ? l.w : Math.ceil(Math.max(1, ...lines.map((x) => x.width)) + pad * 2), h: Math.ceil(lines.length * L), lines: lines.length }; }
// Apply a style change to a text layer while keeping its first baseline (and its alignment edge) where it is.
export function restyleText(l, patch) {
  const next = { ...l, ...patch }, m = measureText(next); const out = { ...patch, h: m.h };
  out.y = Math.round((l.y + baselineOffset(l) - baselineOffset(next)) * 100) / 100;
  if (!next.wrap) { out.w = m.w; if ((next.align || "left") === "center") out.x = l.x + (l.w - m.w) / 2; else if (next.align === "right") out.x = l.x + l.w - m.w; }
  return out;
}

/* ---------- drawing ---------- */
function textStyle(el, l) {
  const pad = l.meta?.pad ?? 0; const s = el.style;
  s.left = `${l.x}px`; s.top = `${l.y}px`; s.width = `${l.w}px`; s.minHeight = `${l.h}px`; s.padding = `0 ${pad}px`; s.boxSizing = "border-box";
  s.fontFamily = cssFamily(l.fontFamily); s.fontSize = `${l.fontSize}px`; s.fontWeight = l.fontWeight || 400; s.fontStyle = l.italic ? "italic" : "normal";
  s.lineHeight = String(l.lineHeight || 1.2); s.letterSpacing = `${l.letterSpacing || 0}px`; s.color = l.color; s.textAlign = l.align || "left"; s.fontKerning = "normal";
  el.classList.toggle("is-wrap", Boolean(l.wrap));
}
function textContent(el, l) { el.textContent = ""; for (const r of layerRuns(l)) { if (r.color && r.color !== l.color) { const sp = document.createElement("span"); sp.dataset.c = r.color; sp.style.color = r.color; sp.textContent = r.text; el.appendChild(sp); } else el.appendChild(document.createTextNode(r.text)); } }
function layerElement(l) {
  const el = document.createElement("div"); el.className = `layer layer--${l.type}`; el.dataset.id = l.id;
  if (l.locked) el.classList.add("is-locked"); if (!l.visible) el.style.display = "none"; el.style.opacity = l.opacity ?? 1;
  if (l.type === "text") { textStyle(el, l); textContent(el, l); return el; }
  const s = el.style; s.left = `${l.x}px`; s.top = `${l.y}px`; s.width = `${l.w}px`; s.height = `${l.h}px`;
  if (l.type === "background") { if (l.canvas) el.appendChild(l.canvas); else s.background = l.fill || "#fff"; }
  else if (l.type === "image") { if (l.canvas) el.appendChild(l.canvas); }
  else if (l.type === "shape") {
    if (l.shape === "line" && l.dashed) { const horiz = l.w >= l.h, t = horiz ? l.h : l.w; s.backgroundImage = `repeating-linear-gradient(${horiz ? "90deg" : "180deg"}, ${l.fill} 0 ${t * 3}px, transparent ${t * 3}px ${t * 5.5}px)`; }
    else { s.background = l.fill || "transparent"; if (l.shape === "ellipse") s.borderRadius = "50%"; else if (l.radius) s.borderRadius = `${l.radius}px`; if (l.stroke && l.strokeWidth) { s.boxShadow = `inset 0 0 0 ${l.strokeWidth}px ${l.stroke}`; } }
    if (l.shape === "line") { const horiz = l.w >= l.h; s[horiz ? "paddingBlock" : "paddingInline"] = "0"; el.dataset.thin = "1"; }
  }
  return el;
}
export function build() {
  const p = page(); pageEl.textContent = ""; overlay.textContent = ""; editing = null;
  document.getElementById("empty").hidden = Boolean(p);
  stage.style.display = p ? "" : "none";
  const old = viewport.querySelector(".pagecta"); if (old) old.remove();
  if (!p) return;
  pageEl.style.width = overlay.style.width = `${p.width}px`; pageEl.style.height = overlay.style.height = `${p.height}px`;
  if (!p.layers) { const c = p.raw; c.style.cssText = "display:block;width:100%;height:100%"; pageEl.appendChild(c); if (handlers.pendingCta) viewport.appendChild(handlers.pendingCta(p)); return; }
  const frag = document.createDocumentFragment(); for (const l of p.layers) frag.appendChild(layerElement(l)); pageEl.appendChild(frag);
  if (state.showOriginal && p.original) { p.original.className = "original"; pageEl.appendChild(p.original); }
  drawSelection();
}
function elFor(id) { return pageEl.querySelector(`.layer[data-id="${id}"]`); }
function box(l) { if (l.type === "shape" && l.shape === "line") { const horiz = l.w >= l.h, pad = Math.max(0, (6 / state.zoom - (horiz ? l.h : l.w)) / 2); return horiz ? { x: l.x, y: l.y - pad, w: l.w, h: l.h + pad * 2 } : { x: l.x - pad, y: l.y, w: l.w + pad * 2, h: l.h }; } return { x: l.x, y: l.y, w: l.w, h: l.h }; }
export function drawSelection(hoverId = null) {
  overlay.textContent = ""; if (!page() || !page().layers) return;
  const add = (cls, b) => { const d = document.createElement("div"); d.className = cls; d.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`; overlay.appendChild(d); return d; };
  const sel = selected();
  if (hoverId && !state.selection.has(hoverId)) { const l = layerById(hoverId); if (l) add("sel sel--hover", box(l)); }
  for (const l of sel) { const d = add("sel", box(l)); d.dataset.id = l.id; }
  if (sel.length === 1 && !sel[0].locked && editing !== sel[0].id) {
    const l = sel[0], b = box(l), isLine = l.type === "shape" && l.shape === "line", horiz = l.w >= l.h;
    const hs = isLine ? (horiz ? ["w", "e"] : ["n", "s"]) : l.type === "text" ? ["nw", "ne", "se", "sw", "e", "w"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    for (const h of hs) { const d = document.createElement("div"); d.className = "handle"; d.dataset.h = h; d.style.left = `${b.x + (h.includes("w") ? 0 : h.includes("e") ? b.w : b.w / 2)}px`; d.style.top = `${b.y + (h.includes("n") ? 0 : h.includes("s") ? b.h : b.h / 2)}px`; overlay.appendChild(d); }
  }
  for (const g of guides) { const d = document.createElement("div"); d.className = `guide guide--${g.v ? "v" : "h"}`; if (g.v) d.style.cssText = `left:${g.pos}px;top:0;height:${page().height}px`; else d.style.cssText = `top:${g.pos}px;left:0;width:${page().width}px`; overlay.appendChild(d); }
  if (drag && drag.marquee) { const m = drag.marquee, d = add(`marquee${drag.kind === "lift" ? " marquee--lift" : ""}`, m); d.dataset.m = "1"; }
}

/* ---------- text editing ---------- */
export function startEditing(id, selectAll = false) {
  const l = layerById(id), el = elFor(id); if (!l || !el || l.type !== "text" || l.locked) return;
  if (editing && editing !== id) finishEditing(true);
  editing = id; el.contentEditable = "plaintext-only"; if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
  el.style.minWidth = `${l.w}px`; if (!l.wrap) { el.style.width = "max-content"; el.style.maxWidth = `${wrapLimit(l)}px`; }
  el.focus(); const range = document.createRange(); range.selectNodeContents(el); if (!selectAll) range.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(range);
  drawSelection();
}
// Widest a non-wrapping text box may grow before it becomes a wrapping one: its paragraph width, or the space to the page edge.
function wrapLimit(l) { const p = page(), room = (l.align === "right" ? l.x + l.w : l.align === "center" ? Math.min(l.x + l.w / 2, p.width - l.x - l.w / 2) * 2 : p.width - l.x) - p.width * 0.03; return Math.max(l.w, l.text.includes("\n") ? l.w * 1.06 : room); }
function readRuns(el, l) { const runs = []; const walk = (node, colour) => { for (const n of node.childNodes) { if (n.nodeType === 3) { const t = n.nodeValue; if (!t) continue; const last = runs[runs.length - 1]; if (last && last.color === colour) last.text += t; else runs.push({ text: t, color: colour }); } else if (n.nodeName === "BR") { const last = runs[runs.length - 1]; if (last) last.text += "\n"; else runs.push({ text: "\n", color: colour }); } else { if (n.nodeName === "DIV" && runs.length) runs[runs.length - 1].text += "\n"; walk(n, n.dataset && n.dataset.c ? n.dataset.c : colour); } } }; walk(el, l.color); return runs; }
export function finishEditing(commit = true) {
  if (!editing) return; const id = editing, l = layerById(id), el = elFor(id); editing = null;
  if (!l || !el) return; el.contentEditable = "false"; getSelection().removeAllRanges();
  if (commit) {
    const runs = readRuns(el, l), text = runs.map((r) => r.text).join("").replace(/\n+$/, "");
    if (!text.trim()) { removeLayers([id]); return; }
    if (text !== l.text) { checkpoint(); if (runs.length) runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\n+$/, ""); const multi = new Set(runs.map((r) => r.color)).size > 1; const limit = wrapLimit(l); Object.assign(l, { text, runs: multi ? runs : null }); if (!l.wrap && measureText(l).w > limit + 1) { if (l.align === "right") l.x = l.x + l.w - limit; else if (l.align === "center") l.x = l.x + (l.w - limit) / 2; Object.assign(l, { wrap: true, w: Math.ceil(limit) }); } if (!l.meta || !l.meta.renamed) l.name = text.replace(/\s+/g, " ").slice(0, 36); Object.assign(l, restyleText(l, {})); }
  }
  emit("layers", { ids: [id] });
}
export const isEditing = () => Boolean(editing);

/* ---------- pointer interaction ---------- */
function snap(moving, dx, dy) {
  const p = page(), thr = 6 / state.zoom, gs = [];
  const b = { x0: Math.min(...moving.map((m) => m.ox)) + dx, y0: Math.min(...moving.map((m) => m.oy)) + dy, x1: Math.max(...moving.map((m) => m.ox + m.l.w)) + dx, y1: Math.max(...moving.map((m) => m.oy + m.l.h)) + dy };
  const ids = new Set(moving.map((m) => m.l.id)), xs = [0, p.width / 2, p.width], ys = [0, p.height / 2, p.height];
  for (const l of p.layers) { if (ids.has(l.id) || !l.visible || l.type === "background") continue; xs.push(l.x, l.x + l.w / 2, l.x + l.w); ys.push(l.y, l.y + l.h / 2, l.y + l.h); }
  const best = (cands, targets) => { let bd = thr, bt = null, bo = 0; for (const c of cands) for (const t of targets) { const d = t - c; if (Math.abs(d) < Math.abs(bd)) { bd = d; bt = t; bo = d; } } return bt === null ? null : { delta: bo, pos: bt }; };
  const sx = best([b.x0, (b.x0 + b.x1) / 2, b.x1], xs), sy = best([b.y0, (b.y0 + b.y1) / 2, b.y1], ys);
  if (sx) { dx += sx.delta; gs.push({ v: true, pos: sx.pos }); } if (sy) { dy += sy.delta; gs.push({ v: false, pos: sy.pos }); }
  guides = gs; return { dx, dy };
}
const alphaCache = new WeakMap();
function alphaMap(canvas) { let a = alphaCache.get(canvas); if (!a) { const k = Math.min(1, 256 / Math.max(canvas.width, canvas.height)), c = makeCanvas(canvas.width * k, canvas.height * k), x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(canvas, 0, 0, c.width, c.height); a = { w: c.width, h: c.height, data: x.getImageData(0, 0, c.width, c.height).data }; alphaCache.set(canvas, a); } return a; }
// Topmost layer under the pointer, looking through the transparent parts of cut-out pictures.
function hitLayer(e) {
  const pt = toPage(e);
  for (const n of document.elementsFromPoint(e.clientX, e.clientY)) {
    const el = n.closest && n.closest(".layer"); if (!el) continue; const l = layerById(el.dataset.id); if (!l || l.type === "background") continue;
    if (l.type === "image" && l.canvas && !state.selection.has(l.id)) { const a = alphaMap(l.canvas), ax = Math.floor((pt.x - l.x) / l.w * a.w), ay = Math.floor((pt.y - l.y) / l.h * a.h); if (ax >= 0 && ay >= 0 && ax < a.w && ay < a.h && a.data[(ay * a.w + ax) * 4 + 3] < 16) continue; }
    return el;
  }
  return null;
}
function onDown(e) {
  if (e.button === 1 || state.tool === "hand" || spaceDown) { drag = { kind: "pan", sx: e.clientX, sy: e.clientY, px: state.panX, py: state.panY }; viewport.classList.add("is-panning"); viewport.setPointerCapture(e.pointerId); return; }
  const p = page(); if (!p || !p.layers || e.button !== 0) return;
  const pt = toPage(e), handle = e.target.closest && e.target.closest(".handle");
  if (editing) { if (e.target.closest && e.target.closest(`.layer[data-id="${editing}"]`)) return; finishEditing(true); }
  viewport.setPointerCapture(e.pointerId);
  if (handle) { const l = selected()[0]; drag = { kind: "resize", h: handle.dataset.h, l, o: { x: l.x, y: l.y, w: l.w, h: l.h, fontSize: l.fontSize, letterSpacing: l.letterSpacing, pad: l.meta?.pad }, start: pt, moved: false }; return; }
  if (state.tool === "text") { handlers.addText && handlers.addText(pt); return; }
  if (state.tool === "lift") { drag = { kind: "lift", start: pt, marquee: { x: pt.x, y: pt.y, w: 0, h: 0 } }; return; }
  const el = hitLayer(e);
  if (el && layerById(el.dataset.id)) {
    const id = el.dataset.id; if (e.shiftKey || e.metaKey || e.ctrlKey) select(id, true); else if (!state.selection.has(id)) select(id);
    drag = { kind: "move", start: pt, moved: false, items: selected().filter((l) => !l.locked).map((l) => ({ l, ox: l.x, oy: l.y })) };
  } else { if (!e.shiftKey) clearSelection(); drag = { kind: "marquee", start: pt, marquee: { x: pt.x, y: pt.y, w: 0, h: 0 }, additive: e.shiftKey }; }
}
function onMove(e) {
  if (!drag) { if (page() && page().layers && !editing) { const el = hitLayer(e); drawSelection(el ? el.dataset.id : null); } return; }
  if (drag.kind === "pan") { state.panX = drag.px + e.clientX - drag.sx; state.panY = drag.py + e.clientY - drag.sy; applyView(); return; }
  const pt = toPage(e);
  if (drag.kind === "move") {
    let dx = pt.x - drag.start.x, dy = pt.y - drag.start.y; if (!drag.moved) { if (Math.hypot(dx, dy) * state.zoom < 3 || !drag.items.length) return; drag.moved = true; checkpoint(); }
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    if (!e.altKey) ({ dx, dy } = snap(drag.items, dx, dy)); else guides = [];
    for (const it of drag.items) { it.l.x = Math.round((it.ox + dx) * 100) / 100; it.l.y = Math.round((it.oy + dy) * 100) / 100; const el = elFor(it.l.id); if (el) { el.style.left = `${it.l.x}px`; el.style.top = `${it.l.y}px`; } }
    drawSelection(); emit("moving");
  } else if (drag.kind === "resize") {
    const { l, o, h } = drag; if (!drag.moved) { drag.moved = true; checkpoint(); }
    let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
    if (h.includes("w")) x0 = Math.min(pt.x, x1 - 4); if (h.includes("e")) x1 = Math.max(pt.x, x0 + 4); if (h.includes("n")) y0 = Math.min(pt.y, y1 - 4); if (h.includes("s")) y1 = Math.max(pt.y, y0 + 4);
    if (l.type === "text") {
      if (h.length === 2) { const k = Math.max(0.1, Math.max((x1 - x0) / o.w, (y1 - y0) / o.h)); const w = o.w * k, hh = o.h * k; Object.assign(l, { fontSize: Math.round(o.fontSize * k * 100) / 100, letterSpacing: Math.round((o.letterSpacing || 0) * k * 100) / 100, w, h: hh, x: h.includes("w") ? o.x + o.w - w : o.x, y: h.includes("n") ? o.y + o.h - hh : o.y }); if (l.meta && o.pad != null) l.meta.pad = o.pad * k; }
      else { l.wrap = true; l.x = x0; l.w = x1 - x0; l.h = measureText(l).h; }
      const el = elFor(l.id); if (el) { textStyle(el, l); }
    } else {
      const keep = (l.type === "image" && h.length === 2 && !e.shiftKey) || (l.type !== "image" && e.shiftKey && h.length === 2);
      if (keep) { const k = Math.max((x1 - x0) / o.w, (y1 - y0) / o.h), w = o.w * k, hh = o.h * k; if (h.includes("w")) x0 = x1 - w; else x1 = x0 + w; if (h.includes("n")) y0 = y1 - hh; else y1 = y0 + hh; }
      Object.assign(l, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); const el = elFor(l.id); if (el) { el.style.left = `${l.x}px`; el.style.top = `${l.y}px`; el.style.width = `${l.w}px`; el.style.height = `${l.h}px`; }
    }
    drawSelection(); emit("moving");
  } else if (drag.kind === "marquee" || drag.kind === "lift") {
    const p = page(); let x0 = Math.min(drag.start.x, pt.x), y0 = Math.min(drag.start.y, pt.y), x1 = Math.max(drag.start.x, pt.x), y1 = Math.max(drag.start.y, pt.y);
    if (drag.kind === "lift") { x0 = clamp(x0, 0, p.width); x1 = clamp(x1, 0, p.width); y0 = clamp(y0, 0, p.height); y1 = clamp(y1, 0, p.height); }
    drag.marquee = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; drawSelection();
  }
}
function onUp(e) {
  if (!drag) return; const d = drag; drag = null; guides = []; viewport.classList.remove("is-panning");
  try { viewport.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
  if (d.kind === "move" || d.kind === "resize") { if (d.moved) emit("layers", { geometry: true }); else drawSelection(); }
  else if (d.kind === "marquee") { const m = d.marquee; if (m.w > 2 || m.h > 2) { const hit = layers().filter((l) => l.visible && !l.locked && l.type !== "background" && l.x < m.x + m.w && l.x + l.w > m.x && l.y < m.y + m.h && l.y + l.h > m.y).map((l) => l.id); if (hit.length) select(d.additive ? [...state.selection, ...hit.filter((id) => !state.selection.has(id))] : hit); } drawSelection(); }
  else if (d.kind === "lift") { const m = d.marquee; drawSelection(); if (m.w >= 6 && m.h >= 6 && handlers.lift) handlers.lift({ x: Math.round(m.x), y: Math.round(m.y), w: Math.round(m.w), h: Math.round(m.h) }); setTool("select"); }
}
function onDbl(e) { const el = document.elementsFromPoint(e.clientX, e.clientY).map((n) => n.closest && n.closest(".layer--text")).find(Boolean); // pointer capture retargets the event to the viewport
  if (el && state.tool === "select") { select(el.dataset.id); startEditing(el.dataset.id, true); } }
function onWheel(e) { e.preventDefault(); const r = viewport.getBoundingClientRect(); if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top); else { state.panX -= e.deltaX; state.panY -= e.deltaY; applyView(); } }

export function initStage(h) {
  handlers = h || {}; viewport = document.getElementById("viewport"); stage = document.getElementById("stage"); pageEl = document.getElementById("page"); overlay = document.getElementById("overlay");
  viewport.addEventListener("pointerdown", onDown); viewport.addEventListener("pointermove", onMove); viewport.addEventListener("pointerup", onUp); viewport.addEventListener("pointercancel", onUp);
  viewport.addEventListener("dblclick", onDbl); viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("pointerleave", () => { if (!drag && !editing) drawSelection(); });
  pageEl.addEventListener("keydown", (e) => { if (!editing) return; e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); finishEditing(true); } });
  pageEl.addEventListener("focusout", (e) => { if (editing && e.target.dataset && e.target.dataset.id === editing) setTimeout(() => { if (editing && document.activeElement !== elFor(editing)) finishEditing(true); }, 0); });
  window.addEventListener("keydown", (e) => { if (e.code === "Space" && !isTyping(e) && !spaceDown) { spaceDown = true; viewport.classList.add("is-space"); e.preventDefault(); } });
  window.addEventListener("keyup", (e) => { if (e.code === "Space") { spaceDown = false; viewport.classList.remove("is-space"); } });
  window.addEventListener("resize", () => { if (page()) fitView(); });
  on("layers", build); on("page", () => { build(); fitView(); }); on("selection", () => drawSelection()); on("project", () => { build(); fitView(); });
  on("tool", () => { viewport.className = `canvas tool-${state.tool}`; if (state.tool !== "select" && editing) finishEditing(true); });
  on("original", build);
  build();
}
export function isTyping(e) { const t = e.target; return Boolean(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))); }
