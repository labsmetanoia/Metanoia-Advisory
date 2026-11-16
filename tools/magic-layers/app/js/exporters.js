// Exports: editable PowerPoint, PNG, SVG, layered Photoshop file, and the Magic Layers project file.
import { rgb, makeCanvas, canvasToBlob, download, fileStem, escapeXml } from "./util.js";
import { renderPage, drawLayer, layoutText, layerRuns } from "./render.js";
import { fontMetrics, cssFamily, SERIF, baselineOffset } from "./fonts.js";

const noHash = (h) => (h || "#000000").replace("#", "").toUpperCase();
const dataUrl = (canvas, type = "image/png", q) => canvas.toDataURL(type, q);
const OFFICE_SAFE = (family) => (SERIF.has(family) ? "Georgia" : /Courier|Consolas/.test(family) ? "Courier New" : "Arial");

/* ---------- PowerPoint ---------- */
export async function exportPptx(project, { safeFonts = false, pages = null } = {}) {
  const list = (pages || project.pages).filter((p) => p.layers);
  if (!list.length) throw new Error("Nothing to export yet: analyse a page first.");
  const pptx = new PptxGenJS();
  const first = list[0], ratio = first.width / first.height;
  const hIn = 7.5, wIn = Math.abs(ratio - 16 / 9) < 0.02 ? 13.333 : Math.abs(ratio - 4 / 3) < 0.02 ? 10 : Math.min(56, Math.round(hIn * ratio * 1000) / 1000);
  pptx.defineLayout({ name: "MAGIC", width: wIn, height: hIn }); pptx.layout = "MAGIC";
  pptx.title = project.name; pptx.company = "Metanoia Advisory";
  for (const page of list) {
    const slide = pptx.addSlide(), k = Math.min(wIn / page.width, hIn / page.height), ox = (wIn - page.width * k) / 2, oy = (hIn - page.height * k) / 2;
    const X = (v) => ox + v * k, Y = (v) => oy + v * k, S = (v) => v * k;
    for (const l of page.layers) {
      if (!l.visible) continue;
      const tr = Math.round((1 - (l.opacity ?? 1)) * 100);
      if (l.type === "background") {
        if (l.uniform && l.fill) slide.background = { color: noHash(l.fill) };
        else if (l.canvas) { const photo = l.meta && (l.meta.mode === "photo" || l.meta.mode === "complex"); slide.background = { data: dataUrl(l.canvas, photo ? "image/jpeg" : "image/png", 0.92).replace(/^data:/, "") }; }
        else if (l.fill) slide.background = { color: noHash(l.fill) };
      } else if (l.type === "image" && l.canvas) {
        slide.addImage({ data: dataUrl(l.canvas).replace(/^data:/, ""), x: X(l.x), y: Y(l.y), w: S(l.w), h: S(l.h), transparency: tr, altText: l.name });
      } else if (l.type === "shape") {
        if (l.shape === "line") { const horiz = l.horizontal !== false && l.w >= l.h; slide.addShape(pptx.ShapeType.line, { x: X(horiz ? l.x : l.x + l.w / 2), y: Y(horiz ? l.y + l.h / 2 : l.y), w: horiz ? S(l.w) : 0, h: horiz ? 0 : S(l.h), line: { color: noHash(l.fill), width: Math.max(0.25, S(horiz ? l.h : l.w) * 72), dashType: l.dashed ? "dash" : "solid", transparency: tr } }); }
        else {
          const round = l.shape === "rect" && l.radius > 0, type = l.shape === "ellipse" ? pptx.ShapeType.ellipse : round ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
          const o = { x: X(l.x), y: Y(l.y), w: S(l.w), h: S(l.h), fill: l.fill ? { color: noHash(l.fill), transparency: tr } : { type: "none" }, line: l.stroke && l.strokeWidth ? { color: noHash(l.stroke), width: Math.max(0.25, S(l.strokeWidth) * 72) } : { type: "none" } };
          if (round) o.rectRadius = Math.min(S(l.radius), Math.min(o.w, o.h) / 2);
          slide.addShape(type, o);
        }
      } else if (l.type === "text") {
        const fam = safeFonts ? OFFICE_SAFE(l.fontFamily) : l.fontFamily, fm = fontMetrics(l.fontFamily, l.fontWeight || 400, l.italic);
        const natural = fm.ascent + fm.descent + 0.03, mult = (l.lineHeight || 1.2) / natural, pad = l.meta?.pad ?? 0;
        const baseline = l.y + baselineOffset(l), top = baseline - mult * fm.ascent * l.fontSize;
        const lines = (l.text || "").split("\n").length;
        const parts = [];
        for (const run of layerRuns(l)) { const segs = run.text.split("\n"); segs.forEach((seg, i) => { if (i) { if (parts.length) parts[parts.length - 1].options.breakLine = true; else parts.push({ text: "", options: { breakLine: true } }); } if (seg) parts.push({ text: seg, options: { color: noHash(run.color || l.color) } }); }); }
        slide.addText(parts.length ? parts : [{ text: "", options: {} }], {
          x: X(l.x + pad), y: Y(top), w: S(l.w - pad * 2) * (l.wrap ? 1 : 1.02) + 0.02, h: S(lines * (l.lineHeight || 1.2) * l.fontSize) + 0.04,
          fontFace: fam, fontSize: Math.round(S(l.fontSize) * 72 * 10) / 10, color: noHash(l.color), bold: (l.fontWeight || 400) >= 600, italic: Boolean(l.italic),
          align: l.align || "left", valign: "top", margin: 0, wrap: Boolean(l.wrap), fit: "none", charSpacing: l.letterSpacing ? Math.round(S(l.letterSpacing) * 72 * 100) / 100 : undefined,
          lineSpacingMultiple: Math.round(mult * 1000) / 1000, paraSpaceBefore: 0, paraSpaceAfter: 0, transparency: tr, isTextBox: true,
        });
      }
    }
  }
  const blob = await pptx.write({ outputType: "blob" });
  return { blob, name: `${fileStem(project.name)} - editable.pptx`, slides: list.length };
}

/* ---------- PNG ---------- */
export async function exportPng(page, scale = 1) { const c = renderPage(page, makeCanvas(1, 1), { scale }); return { blob: await canvasToBlob(c, "image/png"), name: `${fileStem(page.name)}.png` }; }

/* ---------- SVG (text stays text, shapes stay vectors, pictures are embedded) ---------- */
export async function exportSvg(page) {
  const ctx = makeCanvas(8, 8).getContext("2d"), out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">`);
  for (const l of page.layers) {
    if (!l.visible) continue; const op = (l.opacity ?? 1) < 1 ? ` opacity="${l.opacity}"` : "", id = ` id="${escapeXml(l.id)}" data-name="${escapeXml(l.name || "")}"`;
    if (l.type === "background" || l.type === "image") { if (l.canvas) out.push(`<image${id} x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" preserveAspectRatio="none" xlink:href="${dataUrl(l.canvas)}"${op}/>`); else if (l.fill) out.push(`<rect${id} x="0" y="0" width="${page.width}" height="${page.height}" fill="${l.fill}"/>`); }
    else if (l.type === "shape") {
      const paint = `fill="${l.fill || "none"}"${l.stroke && l.strokeWidth ? ` stroke="${l.stroke}" stroke-width="${l.strokeWidth}"` : ""}${op}`;
      if (l.shape === "ellipse") out.push(`<ellipse${id} cx="${l.x + l.w / 2}" cy="${l.y + l.h / 2}" rx="${l.w / 2}" ry="${l.h / 2}" ${paint}/>`);
      else if (l.shape === "line" && l.dashed) { const horiz = l.w >= l.h, t = horiz ? l.h : l.w; out.push(`<line${id} x1="${horiz ? l.x : l.x + l.w / 2}" y1="${horiz ? l.y + l.h / 2 : l.y}" x2="${horiz ? l.x + l.w : l.x + l.w / 2}" y2="${horiz ? l.y + l.h / 2 : l.y + l.h}" stroke="${l.fill}" stroke-width="${t}" stroke-dasharray="${t * 3} ${t * 2.5}"${op}/>`); }
      else out.push(`<rect${id} x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}"${l.radius ? ` rx="${l.radius}"` : ""} ${paint}/>`);
    } else if (l.type === "text") {
      const lines = layoutText(ctx, l), L = (l.lineHeight || 1.2) * l.fontSize, base = baselineOffset(l), pad = l.meta?.pad ?? 0;
      const anchor = l.align === "center" ? "middle" : l.align === "right" ? "end" : "start", ax = l.align === "center" ? l.x + l.w / 2 : l.align === "right" ? l.x + l.w - pad : l.x + pad;
      out.push(`<text${id} font-family='${cssFamily(l.fontFamily)}' font-size="${l.fontSize}" font-weight="${l.fontWeight || 400}"${l.italic ? ' font-style="italic"' : ""}${l.letterSpacing ? ` letter-spacing="${l.letterSpacing}"` : ""} fill="${l.color}" text-anchor="${anchor}" xml:space="preserve"${op}>`);
      lines.forEach((ln, i) => { out.push(`<tspan x="${ax}" y="${l.y + base + i * L}">${ln.runs.map((r) => (r.color && r.color !== l.color ? `<tspan fill="${r.color}">${escapeXml(r.text)}</tspan>` : escapeXml(r.text))).join("")}</tspan>`); });
      out.push("</text>");
    }
  }
  out.push("</svg>");
  return { blob: new Blob([out.join("\n")], { type: "image/svg+xml" }), name: `${fileStem(page.name)}.svg` };
}

/* ---------- Photoshop: one raster layer per layer, names and order preserved ---------- */
export async function exportPsd(page) {
  const children = [];
  for (const l of page.layers) {
    let canvas, left = Math.round(l.x), top = Math.round(l.y);
    if ((l.type === "image" || l.type === "background") && l.canvas && Math.round(l.w) === l.canvas.width && Math.round(l.h) === l.canvas.height) canvas = l.canvas;
    else { const m = l.type === "text" ? Math.ceil(l.fontSize * 0.4) : 2; left = Math.floor(l.x - m); top = Math.floor(l.y - m); canvas = makeCanvas(Math.ceil(l.w + m * 2), Math.ceil(l.h + m * 2)); const c = canvas.getContext("2d"); c.translate(-left, -top); drawLayer(c, { ...l, visible: true, opacity: 1 }); }
    children.push({ name: l.name || l.type, left, top, canvas, opacity: l.opacity ?? 1, hidden: !l.visible });
  }
  const buffer = agPsd.writePsd({ width: page.width, height: page.height, children }, { generateThumbnail: true });
  return { blob: new Blob([buffer], { type: "image/vnd.adobe.photoshop" }), name: `${fileStem(page.name)}.psd` };
}

/* ---------- project file ---------- */
export async function exportProject(project) {
  const pages = project.pages.map((p) => ({ name: p.name, width: p.width, height: p.height, original: dataUrl(p.original || p.raw, "image/png"), stats: p.stats || null, layers: p.layers ? p.layers.map((l) => { const { canvas, ...rest } = l; return canvas ? { ...rest, src: dataUrl(canvas) } : rest; }) : null }));
  return { blob: new Blob([JSON.stringify({ format: "magic-layers", version: 1, name: project.name, saved: new Date().toISOString(), pages })], { type: "application/json" }), name: `${fileStem(project.name)}.mlayers` };
}
export { download, rgb };
