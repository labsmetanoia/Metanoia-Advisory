// Application state, change notification and undo history.
import { uid } from "./util.js";

export const state = {
  project: null,            // { name, pages: [page], source }
  pageIndex: 0,
  selection: new Set(),     // layer ids on the current page
  tool: "select",           // select | text | lift | hand
  zoom: 1, panX: 0, panY: 0,
  showOriginal: false,
  settings: { lang: "eng", detail: 1, thorough: false },
  ai: { available: false, installed: false },
  busy: false,
};
const listeners = new Map();
export function on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, new Set()); listeners.get(evt).add(fn); return () => listeners.get(evt).delete(fn); }
export function emit(evt, data) { (listeners.get(evt) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }

export const page = () => (state.project ? state.project.pages[state.pageIndex] : null);
export const layers = () => (page() && page().layers) || [];
export const layerById = (id) => layers().find((l) => l.id === id);
export const selected = () => layers().filter((l) => state.selection.has(l.id));

/* ---------- history: snapshots of the layer list (bitmaps are shared by reference, never mutated in place) ---------- */
const cloneLayer = (l) => ({ ...l, runs: l.runs ? l.runs.map((r) => ({ ...r })) : l.runs, meta: l.meta ? { ...l.meta } : l.meta });
const snapshot = (p) => p.layers.map(cloneLayer);
function hist(p) { if (!p.history) p.history = { undo: [], redo: [] }; return p.history; }
// Call before changing layers. `key` coalesces rapid edits of the same kind (dragging a slider) into one step.
let lastKey = "", lastTime = 0;
export function checkpoint(key = "") {
  const p = page(); if (!p || !p.layers) return;
  const now = Date.now(); if (key && key === lastKey && now - lastTime < 900) { lastTime = now; return; }
  lastKey = key; lastTime = now;
  const h = hist(p); h.undo.push(snapshot(p)); if (h.undo.length > 80) h.undo.shift(); h.redo.length = 0; emit("history");
}
export function undo() { const p = page(); if (!p || !p.layers) return; const h = hist(p); if (!h.undo.length) return; h.redo.push(snapshot(p)); p.layers = h.undo.pop(); pruneSelection(); lastKey = ""; emit("layers"); emit("history"); }
export function redo() { const p = page(); if (!p || !p.layers) return; const h = hist(p); if (!h.redo.length) return; h.undo.push(snapshot(p)); p.layers = h.redo.pop(); pruneSelection(); lastKey = ""; emit("layers"); emit("history"); }
export const canUndo = () => Boolean(page() && page().history && page().history.undo.length);
export const canRedo = () => Boolean(page() && page().history && page().history.redo.length);
function pruneSelection() { const ids = new Set(layers().map((l) => l.id)); for (const id of [...state.selection]) if (!ids.has(id)) state.selection.delete(id); emit("selection"); }

/* ---------- selection ---------- */
export function select(ids, additive = false) { if (!additive) state.selection.clear(); for (const id of [].concat(ids || [])) { if (additive && state.selection.has(id)) state.selection.delete(id); else state.selection.add(id); } emit("selection"); }
export function clearSelection() { if (state.selection.size) { state.selection.clear(); emit("selection"); } }

/* ---------- layer operations (each one checkpoints first) ---------- */
export function updateLayers(ids, patch, key = "") { checkpoint(key); for (const l of layers()) if (ids.includes(l.id)) Object.assign(l, typeof patch === "function" ? patch(l) : patch); emit("layers", { ids }); }
export function addLayer(layer, selectIt = true) { checkpoint(); const l = { id: uid("l"), opacity: 1, visible: true, locked: false, meta: { source: "manual" }, ...layer }; page().layers.push(l); emit("layers"); if (selectIt) select(l.id); return l; }
export function removeLayers(ids) { const keep = layers().filter((l) => !(ids.includes(l.id) && l.type !== "background")); if (keep.length === layers().length) return; checkpoint(); page().layers = keep; pruneSelection(); emit("layers"); }
export function duplicateLayers(ids) { const src = layers().filter((l) => ids.includes(l.id) && l.type !== "background"); if (!src.length) return; checkpoint(); const copies = src.map((l) => ({ ...cloneLayer(l), id: uid("l"), name: l.name + " copy", x: l.x + 16, y: l.y + 16, locked: false })); page().layers.push(...copies); emit("layers"); select(copies.map((c) => c.id)); }
// Move layers in the stack: dir is "front" | "back" | "up" | "down". The background always stays at the bottom.
export function reorder(ids, dir) {
  const ls = layers(), bg = ls.filter((l) => l.type === "background"), rest = ls.filter((l) => l.type !== "background"); const sel = rest.filter((l) => ids.includes(l.id)); if (!sel.length) return; checkpoint();
  let out;
  if (dir === "front") out = rest.filter((l) => !ids.includes(l.id)).concat(sel);
  else if (dir === "back") out = sel.concat(rest.filter((l) => !ids.includes(l.id)));
  else { out = rest.slice(); const idxs = out.map((l, i) => (ids.includes(l.id) ? i : -1)).filter((i) => i >= 0); if (dir === "up") { for (const i of idxs.reverse()) if (i < out.length - 1 && !ids.includes(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]]; } else { for (const i of idxs) if (i > 0 && !ids.includes(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]]; } }
  page().layers = bg.concat(out); emit("layers");
}
export function moveLayerTo(id, targetId, after) { const ls = layers(); const from = ls.findIndex((l) => l.id === id), l = ls[from]; if (!l || l.type === "background") return; checkpoint(); ls.splice(from, 1); let to = ls.findIndex((x) => x.id === targetId); if (to < 0) to = ls.length - 1; if (after) to += 1; to = Math.max(1, to); ls.splice(to, 0, l); emit("layers"); }
export function setTool(tool) { state.tool = tool; emit("tool"); }
export function setPage(i) { if (!state.project) return; state.pageIndex = Math.max(0, Math.min(state.project.pages.length - 1, i)); state.selection.clear(); emit("page"); emit("selection"); emit("history"); }
