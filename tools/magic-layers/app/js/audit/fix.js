// Deck Auditor — one-click fixes. Repairs the findings whose remedy is mechanical and writes a corrected copy of the
// PowerPoint file; the original is never changed. Only the slide XML that needs it is touched, everything else in the
// file (masters, media, charts, notes) is carried over byte for byte.
//   fonts              stray typefaces are set to the deck's own body or heading typeface
//   title-size         a title set in another size is set to the size the other titles use
//   title-position     a title that sits elsewhere is moved to where the other titles start
//   stretched          a squeezed picture is trimmed to its frame instead (same place, same size, no distortion)
//   empty-placeholder  empty placeholders are deleted
const A = "http://schemas.openxmlformats.org/drawingml/2006/main", EMU = 12700;
const kid = (el, name) => (el ? [...el.children].find((c) => c.localName === name) || null : null);
const all = (el, name) => (el ? [...el.getElementsByTagName("*")].filter((c) => c.localName === name) : []);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const slidesOf = (f) => (f.slides.length > 6 ? `${f.slides.slice(0, 6).join(", ")}…` : f.slides.join(", "));

// What can be fixed in this deck, in the words shown to the user.
export function fixPlan(deck, result, dismissed = new Set()) {
  if (!deck || deck.kind !== "pptx") return [];
  const out = [], get = (code) => result.findings.find((f) => f.code === code && !dismissed.has(f.id));
  let f = get("fonts"); if (f && f.data && f.data.body) out.push({ code: "fonts", id: f.id, label: `Set ${plural(f.data.stray.length, "stray typeface")} (${f.data.stray.slice(0, 3).join(", ")}${f.data.stray.length > 3 ? "…" : ""}) to ${f.data.heading && f.data.heading !== f.data.body ? `${f.data.body}, and ${f.data.heading} in titles` : f.data.body}` });
  f = get("title-size"); if (f) { const refs = f.refs.filter((r) => { const sh = shapeOf(deck, r); return sh && !sh.shrunk; }); if (refs.length) out.push({ code: "title-size", id: f.id, label: `Set the title on slide${refs.length > 1 ? "s" : ""} ${[...new Set(refs.map((r) => r.slide))].join(", ")} to ${f.data.size} pt, like the others` }); }
  f = get("title-position"); if (f) out.push({ code: "title-position", id: f.id, label: `Move the title on slide${f.slides.length > 1 ? "s" : ""} ${slidesOf(f)} to where the other titles start` });
  f = get("stretched"); if (f) out.push({ code: "stretched", id: f.id, label: `Trim ${plural(f.refs.length, "stretched picture")} to ${f.refs.length > 1 ? "their frames" : "its frame"} instead of squeezing ${f.refs.length > 1 ? "them" : "it"} (slide${f.slides.length > 1 ? "s" : ""} ${slidesOf(f)})` });
  f = get("empty-placeholder"); if (f) out.push({ code: "empty-placeholder", id: f.id, label: `Delete ${plural(f.refs.length, "empty placeholder")} (slide${f.slides.length > 1 ? "s" : ""} ${slidesOf(f)})` });
  return out;
}
const shapeOf = (deck, ref) => { const s = deck.slides[ref.slide - 1]; return s ? s.shapes.find((x) => x.id === ref.shapeId) : null; };
// The shapes of a slide in the order the reader numbered them (s3-7 is the seventh on slide 3).
function indexShapes(doc) {
  const map = new Map(); let seq = 0; const tree = kid(kid(doc.documentElement, "cSld"), "spTree");
  const walk = (node) => { for (const el of node.children) { const n = el.localName; if (n === "AlternateContent") { const pick = kid(el, "Choice") || kid(el, "Fallback"); if (pick) walk(pick); } else if (n === "grpSp") walk(el); else if (["sp", "pic", "graphicFrame", "cxnSp"].includes(n)) map.set(++seq, el); } };
  if (tree) walk(tree); return map;
}
// Where the titles of the deck usually start: the most common position among them.
function usualTitlePosition(deck) {
  const ts = deck.slides.map((s) => s.title && s.shapes.find((x) => x.id === s.title.shapeId)).filter((x) => x && x.hasBox); if (ts.length < 3) return null;
  const top = (vals) => { const m = new Map(); for (const v of vals) { const k = Math.round(v); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
  return { x: top(ts.map((t) => t.x)), y: top(ts.map((t) => t.y)) };
}

export async function applyFixes(file, deck, result, codes) {
  const zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer()), log = [], want = new Set(codes), finding = (c) => (want.has(c) ? result.findings.find((f) => f.code === c) : null);
  const fonts = finding("fonts"), tsize = finding("title-size"), tpos = finding("title-position"), stretched = finding("stretched"), empty = finding("empty-placeholder"), usual = tpos ? usualTitlePosition(deck) : null;
  const refsOn = (f, n) => (f ? f.refs.filter((r) => r.slide === n) : []), seqOf = (id) => Number(id.split("-")[1]), count = { fonts: 0, size: [], pos: [], pics: [], empty: [] };
  for (const slide of deck.slides) {
    const entry = slide.part && zip.file(slide.part); if (!entry) continue;
    const doc = new DOMParser().parseFromString(await entry.async("string"), "application/xml"); if (doc.getElementsByTagName("parsererror").length) continue;
    const shapes = indexShapes(doc), n = slide.index; let changed = false;
    if (fonts && fonts.data.body) for (const sh of slide.shapes) { const el = shapes.get(seqOf(sh.id)); if (!el) continue; for (const lat of all(el, "latin")) if (fonts.data.stray.includes(lat.getAttribute("typeface"))) { lat.setAttribute("typeface", sh.isTitle && fonts.data.heading ? fonts.data.heading : fonts.data.body); count.fonts++; changed = true; } }
    for (const r of refsOn(tsize, n)) { const sh = shapeOf(deck, r), el = shapes.get(seqOf(r.shapeId)); if (!sh || !el || sh.shrunk) continue; let hit = false; for (const tag of ["rPr", "endParaRPr", "defRPr"]) for (const pr of all(el, tag)) if (pr.hasAttribute("sz")) { pr.setAttribute("sz", String(Math.round(tsize.data.size * 100))); hit = true; } if (hit) { count.size.push(n); changed = true; } }
    if (usual) for (const r of refsOn(tpos, n)) { const sh = shapeOf(deck, r), el = shapes.get(seqOf(r.shapeId)), spPr = el && kid(el, "spPr"); if (!sh || !spPr) continue;
      let x = kid(spPr, "xfrm"); if (!x) { x = doc.createElementNS(A, "a:xfrm"); const off = doc.createElementNS(A, "a:off"), ext = doc.createElementNS(A, "a:ext"); ext.setAttribute("cx", String(Math.round(sh.w * EMU))); ext.setAttribute("cy", String(Math.round(sh.h * EMU))); x.appendChild(off); x.appendChild(ext); spPr.insertBefore(x, spPr.firstChild); }
      const off = kid(x, "off"); if (!off) continue; off.setAttribute("x", String(Math.round(usual.x * EMU))); off.setAttribute("y", String(Math.round(usual.y * EMU))); count.pos.push(n); changed = true; }
    for (const r of refsOn(stretched, n)) { const sh = shapeOf(deck, r), el = shapes.get(seqOf(r.shapeId)), fill = el && kid(el, "blipFill"), blip = fill && kid(fill, "blip"); if (!sh || !sh.image || !blip) continue;
      const c = { ...sh.crop }, cw = sh.image.pxW * (1 - c.l - c.r), ch = sh.image.pxH * (1 - c.t - c.b), rf = sh.w / sh.h, ri = cw / ch;
      if (rf > ri) { const e = (ch - cw / rf) / sh.image.pxH / 2; c.t += e; c.b += e; } else { const e = (cw - ch * rf) / sh.image.pxW / 2; c.l += e; c.r += e; }
      let src = kid(fill, "srcRect"); if (!src) { src = doc.createElementNS(A, "a:srcRect"); fill.insertBefore(src, blip.nextSibling); }
      for (const k of ["l", "t", "r", "b"]) { const v = Math.round(c[k] * 100000); if (v > 0) src.setAttribute(k, String(v)); else src.removeAttribute(k); } count.pics.push(n); changed = true; }
    for (const r of refsOn(empty, n)) { const el = shapes.get(seqOf(r.shapeId)); if (el && el.localName === "sp" && !all(el, "t").some((t) => t.textContent.trim())) { el.parentNode.removeChild(el); count.empty.push(n); changed = true; } }
    if (changed) zip.file(slide.part, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, "")}`);
  }
  const on = (a) => `slide${new Set(a).size > 1 ? "s" : ""} ${[...new Set(a)].join(", ")}`;
  if (count.fonts) log.push(`${plural(count.fonts, "piece")} of text in ${fonts.data.stray.join(", ")} set to ${fonts.data.body}${fonts.data.heading && fonts.data.heading !== fonts.data.body ? ` (titles: ${fonts.data.heading})` : ""}`);
  if (count.size.length) log.push(`Title set to ${tsize.data.size} pt on ${on(count.size)}`);
  if (count.pos.length) log.push(`Title moved to its usual place on ${on(count.pos)}`);
  if (count.pics.length) log.push(`${plural(count.pics.length, "picture")} trimmed to ${count.pics.length > 1 ? "their frames" : "its frame"} on ${on(count.pics)}: the edges are cropped, nothing is squeezed`);
  if (count.empty.length) log.push(`${plural(count.empty.length, "empty placeholder")} deleted on ${on(count.empty)}`);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
  return { blob, log };
}
