// Side panels: pages, layers list, and the properties inspector.
import { state, on, emit, page, layers, layerById, selected, select, updateLayers, removeLayers, duplicateLayers, reorder, moveLayerTo, setPage, checkpoint } from "./state.js";
import { availableFonts, allWeights } from "./fonts.js";
import { restyleText, measureText, startEditing } from "./stage.js";
import { thumbnail } from "./importers.js";
import { escapeXml as esc, makeCanvas } from "./util.js";

let actions = {}, fonts = [], brand = { colors: [] };
const $ = (id) => document.getElementById(id);
const ICON = {
  text: '<svg viewBox="0 0 20 20"><path d="M4 5V3.5h12V5M10 3.5v13M7.5 16.5h5"/></svg>',
  eye: '<svg viewBox="0 0 20 20"><path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10z"/><circle cx="10" cy="10" r="2.4"/></svg>',
  eyeOff: '<svg viewBox="0 0 20 20"><path d="M3 3l14 14M8.3 5c.5-.1 1.1-.2 1.7-.2 5.2 0 8.2 5.2 8.2 5.2s-.8 1.500-2.300 2.900M12.900 14.600c-.9.4-1.800.6-2.900.6C4.800 15.200 1.800 10 1.800 10s1-1.800 2.800-3.300"/></svg>',
  lock: '<svg viewBox="0 0 20 20"><rect x="4.500" y="9" width="11" height="8" rx="1.500"/><path d="M7 9V6.500a3 3 0 016 0V9"/></svg>',
  unlock: '<svg viewBox="0 0 20 20"><rect x="4.500" y="9" width="11" height="8" rx="1.500"/><path d="M7 9V6.500a3 3 0 015.700-1.200"/></svg>',
  line: '<svg viewBox="0 0 20 20"><path d="M3 10h14"/></svg>',
  bg: '<svg viewBox="0 0 20 20"><rect x="2.500" y="4" width="15" height="12" rx="1.500"/><path d="M2.500 13l4-3.500 3.500 3 2.500-2 5 4"/></svg>',
};

/* ---------- pages ---------- */
async function renderPages() {
  const pr = state.project, panel = $("pages-panel"); if (!pr || pr.pages.length < 2) { panel.hidden = true; return; }
  panel.hidden = false; const box = $("pages"); box.textContent = "";
  for (const [i, p] of pr.pages.entries()) {
    if (!p.thumb) p.thumb = await thumbnail(p.raw || p.original);
    const b = document.createElement("button"); b.className = `pagecard${i === state.pageIndex ? " is-active" : ""}`; b.title = p.name;
    b.innerHTML = `<span class="pagecard__n">${i + 1}</span><span class="pagecard__thumb"><img src="${p.thumb}" alt=""><span class="pagecard__badge${p.layers ? " is-done" : ""}">${p.layers ? "Layered" : "Flat"}</span></span>`;
    b.addEventListener("click", () => setPage(i)); box.appendChild(b);
  }
  $("btn-analyse-all").hidden = pr.pages.every((p) => p.layers);
}

/* ---------- layers list ---------- */
const thumbCache = new WeakMap();
function layerThumb(l) { if (!l.canvas) return ""; let url = thumbCache.get(l.canvas); if (!url) { const k = 44 / Math.max(l.canvas.width, l.canvas.height), c = makeCanvas(Math.max(1, l.canvas.width * k), Math.max(1, l.canvas.height * k)); c.getContext("2d").drawImage(l.canvas, 0, 0, c.width, c.height); url = c.toDataURL("image/png"); thumbCache.set(l.canvas, url); } return `<img class="thumb" src="${url}" alt="">`; }
function rowIcon(l) { if (l.type === "text") return ICON.text; if (l.type === "background") return l.canvas ? layerThumb(l) : ICON.bg; if (l.type === "image") return layerThumb(l); if (l.shape === "line") return ICON.line; return `<span class="swatch" style="background:${l.fill || "transparent"};${l.shape === "ellipse" ? "border-radius:50%;" : ""}${!l.fill && l.stroke ? `border:2px solid ${l.stroke};` : ""}"></span>`; }
function renderLayers() {
  const box = $("layers"), ls = layers(); $("layer-count").textContent = ls.length ? `${ls.length}` : "";
  if (!page()) { box.innerHTML = '<p class="layers__empty">Open a file to see its layers here.</p>'; return; }
  if (!page().layers) { box.innerHTML = '<p class="layers__empty">This page is still flat. Press <strong>Create layers</strong> to separate it.</p>'; return; }
  box.textContent = "";
  for (const l of ls.slice().reverse()) {
    const row = document.createElement("div"); row.className = `lrow${state.selection.has(l.id) ? " is-selected" : ""}${l.visible ? "" : " is-hidden"}`; row.dataset.id = l.id; row.draggable = l.type !== "background"; row.setAttribute("role", "option"); row.setAttribute("aria-selected", state.selection.has(l.id));
    row.innerHTML = `<span class="lrow__icon">${rowIcon(l)}</span><span class="lrow__name" title="${esc(l.name || "")}">${esc(l.name || l.type)}</span><button class="lrow__btn${l.locked ? " is-on" : ""}" data-act="lock" title="${l.locked ? "Unlock" : "Lock"}">${l.locked ? ICON.lock : ICON.unlock}</button><button class="lrow__btn${l.visible ? "" : " is-on"}" data-act="eye" title="${l.visible ? "Hide" : "Show"}">${l.visible ? ICON.eye : ICON.eyeOff}</button>`;
    box.appendChild(row);
  }
}
function initLayerEvents() {
  const box = $("layers");
  box.addEventListener("click", (e) => { const row = e.target.closest(".lrow"); if (!row) return; const id = row.dataset.id, act = e.target.closest("[data-act]"); const l = layerById(id); if (!l) return;
    if (act) { e.stopPropagation(); if (act.dataset.act === "eye") updateLayers([id], { visible: !l.visible }); else updateLayers([id], { locked: !l.locked }); return; }
    if (e.shiftKey && state.selection.size) { const order = layers().map((x) => x.id), last = [...state.selection].pop(), a = order.indexOf(last), b = order.indexOf(id); select(order.slice(Math.min(a, b), Math.max(a, b) + 1)); } else select(id, e.metaKey || e.ctrlKey); });
  box.addEventListener("dblclick", (e) => { const name = e.target.closest(".lrow__name"); if (!name) return; const row = name.closest(".lrow"), l = layerById(row.dataset.id); if (!l) return; const input = document.createElement("input"); input.value = l.name || ""; name.textContent = ""; name.appendChild(input); input.focus(); input.select(); const done = (ok) => { if (ok && input.value.trim() && input.value !== l.name) updateLayers([l.id], (x) => ({ name: input.value.trim(), meta: { ...(x.meta || {}), renamed: true } })); else renderLayers(); }; input.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); }); input.addEventListener("blur", () => done(true)); });
  let dragId = null;
  box.addEventListener("dragstart", (e) => { const row = e.target.closest(".lrow"); if (!row) return; dragId = row.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
  box.addEventListener("dragover", (e) => { const row = e.target.closest(".lrow"); if (!row || !dragId) return; e.preventDefault(); box.querySelectorAll(".drop-before,.drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after")); const r = row.getBoundingClientRect(); row.classList.add(e.clientY < r.top + r.height / 2 ? "drop-before" : "drop-after"); });
  box.addEventListener("dragleave", () => box.querySelectorAll(".drop-before,.drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after")));
  box.addEventListener("drop", (e) => { const row = e.target.closest(".lrow"); if (!row || !dragId) return; e.preventDefault(); const before = row.classList.contains("drop-before"); box.querySelectorAll(".drop-before,.drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after")); if (row.dataset.id !== dragId) moveLayerTo(dragId, row.dataset.id, before); dragId = null; });   // the list is top-first, so "before" in the list is "after" in the stack
}

/* ---------- properties ---------- */
const num = (label, prop, value, attrs = "") => `<label class="field"><span>${label}</span><input type="number" data-prop="${prop}" value="${value}" ${attrs}></label>`;
const colourField = (label, prop, value) => `<div class="field"><span>${label}</span><div class="colour"><input type="color" data-prop="${prop}" value="${/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000"}"><input type="text" data-prop="${prop}" data-hex value="${value || ""}" placeholder="none" maxlength="7" spellcheck="false"></div></div>`;
const swatches = (prop, colours) => (colours.length ? `<div class="swatches" data-swatches="${prop}">${colours.map((c) => `<button style="background:${c}" data-colour="${c}" title="${c}"></button>`).join("")}</div>` : "");
const round = (v) => Math.round(v * 10) / 10;
function pageColours() { const seen = new Map(); for (const l of layers()) for (const c of [l.color, l.fill, l.stroke, ...(l.runs || []).map((r) => r.color)]) if (c && /^#[0-9a-f]{6}$/i.test(c)) seen.set(c.toUpperCase(), (seen.get(c.toUpperCase()) || 0) + 1); return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e[0]); }
const ALIGN_ICON = { left: '<svg viewBox="0 0 20 20"><path d="M3 5h14M3 10h9M3 15h12"/></svg>', center: '<svg viewBox="0 0 20 20"><path d="M3 5h14M5.500 10h9M4 15h12"/></svg>', right: '<svg viewBox="0 0 20 20"><path d="M3 5h14M8 10h9M5 15h12"/></svg>' };
const PAGE_ALIGN = [["left", "Align left edge", "M4 3v14M7 6h8v3H7zM7 11h5v3H7z"], ["hcenter", "Centre horizontally", "M10 3v14M5 6h10v3H5zM7 11h6v3H7z"], ["right", "Align right edge", "M16 3v14M5 6h8v3H5zM8 11h5v3H8z"], ["top", "Align top edge", "M3 4h14M6 7h3v8H6zM11 7h3v5h-3z"], ["vcenter", "Centre vertically", "M3 10h14M6 5h3v10H6zM11 7h3v6h-3z"], ["bottom", "Align bottom edge", "M3 16h14M6 5h3v8H6zM11 8h3v5h-3z"]];

function renderProps() {
  const box = $("props"), p = page(), sel = selected();
  if (!p) { box.innerHTML = `<div class="group"><h3>How it works</h3><p class="note"><strong>1. Open</strong> a flat slide, PDF or picture deck.</p><p class="note"><strong>2. Create layers.</strong> Text is read and rebuilt as live text in the closest font on this computer; shapes, lines and pictures are separated; the background is repaired behind them.</p><p class="note"><strong>3. Edit and export</strong> to an editable PowerPoint, a layered Photoshop file, SVG or PNG.</p></div>${shortcutsHtml()}`; return; }
  if (!p.layers) { box.innerHTML = `<div class="group"><h3>Page</h3><p class="note">${esc(p.name)}<br>${p.width} × ${p.height} px${p.pdfText ? " · text layer found in the PDF (exact text, no OCR needed)" : ""}</p><button class="btn btn--primary btn--block" data-action="analyse">Create layers</button></div>${shortcutsHtml()}`; return; }
  if (!sel.length) { box.innerHTML = pageProps(p); return; }
  const one = sel.length === 1 ? sel[0] : null, allText = sel.every((l) => l.type === "text"), allShape = sel.every((l) => l.type === "shape"), ids = sel.map((l) => l.id);
  const typeName = one ? ({ text: "Text", image: "Picture", shape: one.shape === "line" ? "Line" : "Shape", background: "Background" })[one.type] : `${sel.length} layers`;
  let html = `<div class="group"><h3><span>${typeName}</span>${one && one.meta && one.meta.confidence != null && one.meta.confidence < 80 ? '<span class="tag tag--warn" title="The text recognition was unsure here: check the wording">Check text</span>' : ""}</h3>`;
  if (one && one.type !== "background") html += `<div class="row"> ${num("X", "x", round(one.x))}${num("Y", "y", round(one.y))}</div><div class="row">${num("Width", "w", round(one.w), 'min="1"')}${num("Height", "h", round(one.h), `min="1"${one.type === "text" ? " disabled" : ""}`)}</div>`;
  html += `<label class="field"><span>Opacity</span><input type="range" data-prop="opacity" min="0" max="1" step="0.01" value="${one ? one.opacity ?? 1 : 1}"></label>`;
  if (!(one && one.type === "background")) html += `<div class="seg" title="Align on the page">${PAGE_ALIGN.map(([k, t, d]) => `<button data-align="${k}" title="${t}"><svg viewBox="0 0 20 20"><path d="${d}"/></svg></button>`).join("")}</div><div class="seg"><button data-order="front" title="Bring to front">Front</button><button data-order="up" title="Bring forward ( ] )">Forward</button><button data-order="down" title="Send backward ( [ )">Back</button><button data-order="back" title="Send to back">Bottom</button></div>`;
  html += "</div>";
  if (allText) {
    const l = sel[0], same = (k) => sel.every((x) => x[k] === l[k]);
    html += `<div class="group"><h3>Text</h3>`;
    if (one) html += `<label class="field"><span>Content</span><textarea data-prop="text" spellcheck="true">${esc(one.text || "")}</textarea></label>`;
    html += `<label class="field"><span>Font</span><select data-prop="fontFamily">${fonts.map((f) => `<option value="${esc(f)}"${same("fontFamily") && f === l.fontFamily ? " selected" : ""}>${esc(f)}</option>`).join("")}${fonts.includes(l.fontFamily) ? "" : `<option selected>${esc(l.fontFamily)}</option>`}</select></label>`;
    html += `<div class="row">${num("Size", "fontSize", same("fontSize") ? round(l.fontSize) : "", 'min="2" step="0.5"')}<label class="field"><span>Weight</span><select data-prop="fontWeight">${[[400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"]].map(([w, n]) => `<option value="${w}"${Number(l.fontWeight || 400) === w ? " selected" : ""}>${n}</option>`).join("")}</select></label></div>`;
    html += `<div class="row"><div class="field"><span>Align</span><div class="seg">${["left", "center", "right"].map((a) => `<button data-set="align" data-value="${a}" class="${(l.align || "left") === a ? "is-on" : ""}" title="${a}">${ALIGN_ICON[a]}</button>`).join("")}</div></div><div class="field"><span>Style</span><div class="seg"><button data-toggle="italic" class="${l.italic ? "is-on" : ""}" title="Italic" style="font-style:italic;font-family:Georgia,serif">I</button><button data-toggle="wrap" class="${l.wrap ? "is-on" : ""}" title="Reflow: let the text wrap inside its box instead of keeping the original line breaks">Wrap</button></div></div></div>`;
    html += `<div class="row">${num("Line height", "lineHeight", same("lineHeight") ? Math.round((l.lineHeight || 1.2) * 100) / 100 : "", 'min="0.6" max="4" step="0.05"')}${num("Letter spacing", "letterSpacing", same("letterSpacing") ? Math.round((l.letterSpacing || 0) * 100) / 100 : "", 'step="0.1"')}</div>`;
    html += colourField("Colour", "color", same("color") ? l.color : "") + swatches("color", [...new Set([...pageColours(), ...brand.colors])].slice(0, 14));
    if (one && one.runs) html += `<p class="note">This text has ${one.runs.length} colour runs. Changing the colour applies to the whole box.</p>`;
    if (one) html += `<p class="note">Font matched automatically${one.meta && one.meta.fit != null ? ` (fit ${Math.round(one.meta.fit * 100)}%)` : ""}. Double-click the text on the canvas to edit it in place.</p><button class="btn btn--block" data-action="rasterise" title="Replace this text with the original pixels, for logos or lettering that should stay a picture">Convert back to picture</button>`;
    html += "</div>";
  }
  if (allShape) {
    const l = sel[0];
    html += `<div class="group"><h3>${l.shape === "line" ? "Line" : "Shape"}</h3>${colourField(l.shape === "line" ? "Colour" : "Fill", "fill", l.fill || "")}${swatches("fill", [...new Set([...pageColours(), ...brand.colors])].slice(0, 14))}`;
    if (l.shape === "rect") html += `<div class="row">${num("Corner radius", "radius", Math.round(l.radius || 0), 'min="0"')}${num("Outline width", "strokeWidth", l.strokeWidth || 0, 'min="0" step="0.5"')}</div>${colourField("Outline colour", "stroke", l.stroke || "")}`;
    if (l.shape === "line") html += `<div class="row">${num("Thickness", "thickness", Math.round(Math.min(l.w, l.h) * 10) / 10, 'min="0.5" step="0.5"')}<div class="field"><span>Style</span><div class="seg"><button data-toggle="dashed" class="${l.dashed ? "is-on" : ""}">Dashed</button></div></div></div>`;
    html += "</div>";
  }
  if (one && one.type === "image") html += `<div class="group"><h3>Picture</h3><p class="note">${one.canvas ? `${one.canvas.width} × ${one.canvas.height} px` : ""}${one.meta && one.meta.cutout ? " · cut out with transparency" : ""}</p><div class="row"><button class="btn" data-action="replace-image">Replace</button><button class="btn" data-action="save-image">Save PNG</button></div></div>`;
  if (one && one.type === "background") html += `<div class="group"><h3>Background</h3><p class="note">The background is what remains after text and objects were lifted off: ${one.uniform ? "a single colour" : "a repaired picture"}. It is locked so it does not move by accident.</p>${one.uniform ? colourField("Colour", "bgfill", one.fill || "#FFFFFF") : ""}</div>`;
  html += `<div class="group"><h3>Actions</h3><div class="row">${one && one.type === "background" ? "" : '<button class="btn" data-action="duplicate" title="Ctrl+D">Duplicate</button><button class="btn" data-action="delete" title="Delete">Delete</button>'}</div>${sel.length > 1 ? '<button class="btn btn--block" data-action="merge" title="Flatten the selected layers into one picture">Merge into one picture</button>' : ""}</div>`;
  box.innerHTML = html; box.dataset.ids = ids.join(",");
}
function pageProps(p) {
  const st = { text: 0, shape: 0, image: 0 }; for (const l of p.layers) if (st[l.type] != null) st[l.type]++;
  const bg = p.layers.find((l) => l.type === "background"), mode = bg && bg.meta ? bg.meta.mode : "";
  const modeNote = { solid: "Plain background: shapes and pictures were separated.", gradient: "Soft gradient background: shapes and pictures were separated.", complex: "Textured background: larger objects were separated.", photo: "Full-bleed photograph: text was lifted off; use the Lift tool to pull out any object." }[mode] || "";
  const low = p.layers.filter((l) => l.type === "text" && l.meta && l.meta.confidence != null && l.meta.confidence < 80).length;
  return `<div class="group"><h3>Page</h3><div class="stat"><div><b>${st.text}</b><span>text boxes</span></div><div><b>${st.shape}</b><span>shapes</span></div><div><b>${st.image}</b><span>pictures</span></div></div><p class="note">${modeNote}</p>${low ? `<p class="note"><span class="tag tag--warn">${low} to check</span> Text boxes where the reading was unsure are marked in the inspector.</p>` : ""}${p.stats && p.stats.aiNote ? `<p class="note"><span class="tag">AI assist</span> ${esc(p.stats.aiNote)}</p>` : ""}</div>
  <div class="group"><h3>Brand kit</h3><p class="note">Apply the firm's typefaces to every text box: <strong>${esc(brand.fonts ? brand.fonts.heading : "Fraunces")}</strong> for titles, <strong>${esc(brand.fonts ? brand.fonts.body : "Inter")}</strong> for everything else.</p><button class="btn btn--block" data-action="brand-fonts">Apply brand fonts</button>${swatches("none", brand.colors)}</div>
  <div class="group"><h3>Tips</h3><p class="note"><strong>Something still stuck in a picture?</strong> Use the Lift tool (L) and drag a rectangle around it.</p><p class="note"><strong>A logo turned into text?</strong> Select it and choose Convert back to picture.</p><p class="note"><strong>Compare</strong> with the original at any time: hold the Original button or press \\.</p></div>${shortcutsHtml()}`;
}
function shortcutsHtml() { return `<div class="group"><h3>Shortcuts</h3><div class="kbd"><kbd>V</kbd><span>Select</span><kbd>T</kbd><span>Add text</span><kbd>L</kbd><span>Lift an area</span><kbd>Space</kbd><span>Pan</span><kbd>Ctrl + wheel</kbd><span>Zoom</span><kbd>Arrows</kbd><span>Nudge (Shift: 10 px)</span><kbd>Ctrl Z / Y</kbd><span>Undo, redo</span><kbd>Ctrl D</kbd><span>Duplicate</span><kbd>[ ]</kbd><span>Backward, forward</span><kbd>\\</kbd><span>Show original</span></div></div>`; }

function applyProp(prop, raw, key) {
  const sel = selected(); if (!sel.length) return; const ids = sel.map((l) => l.id);
  const n = Number(raw);
  if (["x", "y", "w", "h", "opacity", "radius", "strokeWidth"].includes(prop)) { if (raw === "" || Number.isNaN(n)) return; updateLayers(ids, (l) => (prop === "w" && l.type === "text" ? { w: n, wrap: true, h: measureText({ ...l, w: n, wrap: true }).h } : { [prop]: prop === "w" || prop === "h" ? Math.max(1, n) : n }), key); }
  else if (prop === "thickness") { if (Number.isNaN(n) || n <= 0) return; updateLayers(ids, (l) => (l.w >= l.h ? { y: l.y + l.h / 2 - n / 2, h: n } : { x: l.x + l.w / 2 - n / 2, w: n }), key); }
  else if (prop === "bgfill") updateLayers(ids, { fill: raw }, key);
  else if (["fill", "stroke"].includes(prop)) updateLayers(ids, (l) => ({ [prop]: raw || null, ...(prop === "stroke" && raw && !l.strokeWidth ? { strokeWidth: 2 } : {}) }), key);
  else if (prop === "color") updateLayers(ids, { color: raw, runs: null }, key);
  else if (prop === "text") updateLayers(ids, (l) => { const next = { text: raw, runs: null }; return { ...next, ...restyleText({ ...l, ...next }, {}), name: l.meta && l.meta.renamed ? l.name : raw.replace(/\s+/g, " ").slice(0, 36) }; }, key);
  else if (["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "align", "italic", "wrap"].includes(prop)) { const v = ["fontSize", "fontWeight", "lineHeight", "letterSpacing"].includes(prop) ? n : raw; if (typeof v === "number" && (Number.isNaN(v) || raw === "")) return; updateLayers(ids, (l) => restyleText(l, { [prop]: v }), key); }
}
function alignOnPage(kind) { const p = page(), sel = selected().filter((l) => l.type !== "background"); if (!sel.length) return; const group = sel.length > 1; const b = group ? { x0: Math.min(...sel.map((l) => l.x)), y0: Math.min(...sel.map((l) => l.y)), x1: Math.max(...sel.map((l) => l.x + l.w)), y1: Math.max(...sel.map((l) => l.y + l.h)) } : { x0: 0, y0: 0, x1: p.width, y1: p.height };
  updateLayers(sel.map((l) => l.id), (l) => ({ left: { x: b.x0 }, right: { x: b.x1 - l.w }, hcenter: { x: (b.x0 + b.x1 - l.w) / 2 }, top: { y: b.y0 }, bottom: { y: b.y1 - l.h }, vcenter: { y: (b.y0 + b.y1 - l.h) / 2 } })[kind]); }

function initPropEvents() {
  const box = $("props");
  box.addEventListener("input", (e) => { const t = e.target, prop = t.dataset.prop; if (!prop) return; if (t.dataset.hex !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(t.value) && t.value !== "") return; } applyProp(prop, t.type === "color" ? t.value.toUpperCase() : t.value, `prop:${prop}`); });
  box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && e.target.tagName === "INPUT") e.target.blur(); });
  box.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.colour) { const prop = b.parentNode.dataset.swatches; if (prop && prop !== "none") applyProp(prop, b.dataset.colour); return; }
    if (b.dataset.set) return applyProp(b.dataset.set, b.dataset.value);
    if (b.dataset.toggle) { const l = selected()[0]; if (!l) return; if (b.dataset.toggle === "dashed") return updateLayers(selected().map((x) => x.id), { dashed: !l.dashed }); return applyProp(b.dataset.toggle, !l[b.dataset.toggle]); }
    if (b.dataset.align) return alignOnPage(b.dataset.align);
    if (b.dataset.order) return reorder(selected().map((l) => l.id), b.dataset.order);
    const a = b.dataset.action; if (!a) return;
    if (a === "duplicate") duplicateLayers(selected().map((l) => l.id)); else if (a === "delete") removeLayers(selected().map((l) => l.id)); else if (actions[a]) actions[a](); });
}
// Keep focus and caret when the inspector re-renders during typing: skip rebuilds caused by its own edits.
let lastSig = "";
function refreshProps(force) { const active = document.activeElement, own = active && $("props").contains(active) && active.dataset && active.dataset.prop; const sig = `${state.pageIndex}|${[...state.selection].join(",")}|${page() && page().layers ? 1 : 0}`; if (own && sig === lastSig && !force) { syncGeometry(active); return; } lastSig = sig; renderProps(); }
function syncGeometry(skip) { const l = selected().length === 1 ? selected()[0] : null; if (!l) return; for (const k of ["x", "y", "w", "h"]) { const i = $("props").querySelector(`input[data-prop="${k}"]`); if (i && i !== skip) i.value = round(l[k]); } }

export async function initPanels(a) {
  actions = a || {}; fonts = await availableFonts();
  try { brand = await (await fetch("/brand.json")).json(); } catch (e) { brand = { colors: [] }; }
  initLayerEvents(); initPropEvents();
  on("layers", () => { renderLayers(); refreshProps(); renderPages(); }); on("selection", () => { renderLayers(); refreshProps(true); });
  on("page", () => { renderLayers(); refreshProps(true); renderPages(); }); on("project", () => { renderLayers(); refreshProps(true); renderPages(); });
  on("moving", () => syncGeometry(null));
  renderLayers(); renderProps(); renderPages();
  return { brand, fonts };
}
export { startEditing };
