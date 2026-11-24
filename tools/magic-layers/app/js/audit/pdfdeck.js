// Deck Auditor — reads a PDF into the same deck model as a PowerPoint file. A PDF keeps the wording, positions and
// type sizes but not placeholders, tables or chart data, so titles are inferred and the table checks do not apply.
import { finishDeck } from "./pptx.js";

let pdfjs = null;
async function lib() { if (!pdfjs) { pdfjs = await import("/vendor/pdfjs/pdf.min.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs"; } return pdfjs; }

export async function readPdf(file, onProgress = () => {}, { render = true } = {}) {   // render: false reads the text only (the website's quick check shows no page pictures)
  const L = await lib();
  const doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, wasmUrl: "/vendor/pdfjs/wasm/", cMapUrl: "/vendor/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/vendor/pdfjs/standard_fonts/", iccUrl: "/vendor/pdfjs/iccs/" }).promise;
  const slides = []; let W = 0, H = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress(`Reading page ${n} of ${doc.numPages}`, n / doc.numPages);
    const page = await doc.getPage(n), vp = page.getViewport({ scale: 1 }); if (n === 1) { W = vp.width; H = vp.height; }
    // picture of the page for the preview
    let canvas = null;
    if (render) { const k = Math.min(3, 1500 / Math.max(vp.width, vp.height)), rv = page.getViewport({ scale: k }); canvas = document.createElement("canvas"); canvas.width = Math.round(rv.width); canvas.height = Math.round(rv.height);
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); await page.render({ canvasContext: ctx, viewport: rv }).promise; }
    // text → lines → blocks
    const tc = await page.getTextContent(), lines = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue; const t = L.Util.transform(vp.transform, it.transform); if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue;
      const size = Math.hypot(t[2], t[3]); if (size < 2) continue;
      let text = it.str.replace(/\s+/g, " ").trim(); const toks = text.split(" "); if (toks.length >= 3 && text.replace(/ /g, "").length / toks.length <= 1.8) text = collapseSpaced(text);   // letter-spaced text arrives glyph by glyph
      const item = { text, x: t[4], y: t[5] - size * 0.86, w: it.width, h: size * 1.15, size: Math.round(size * 10) / 10, font: it.fontName };
      const prev = lines.find((q) => Math.abs(q.y - item.y) < size * 0.3 && Math.abs(q.size - item.size) < 0.6 && item.x - (q.x + q.w) < size * 1.2 && item.x - (q.x + q.w) > -size * 0.4);
      if (prev) { prev.text += (item.x - (prev.x + prev.w) > size * 0.14 ? " " : "") + item.text; prev.w = item.x + item.w - prev.x; } else lines.push(item);
    }
    lines.sort((a, b) => a.y - b.y || a.x - b.x);
    const blocks = [];
    for (const l of lines) {
      const b = blocks.find((q) => { const last = q.lines[q.lines.length - 1]; return Math.abs(last.size - l.size) < 0.6 && last.font === l.font && Math.abs(q.x - l.x) < l.size * 0.6 && l.y - last.y > l.size * 0.6 && l.y - last.y < l.size * 2.1; });
      if (b) { b.lines.push(l); b.w = Math.max(b.w, l.x + l.w - b.x); b.h = l.y + l.h - b.y; } else blocks.push({ x: l.x, y: l.y, w: l.w, h: l.h, lines: [l] });
    }
    const shapes = blocks.map((b, i) => ({ id: `s${n}-${i + 1}`, name: "", kind: "text", role: "other", placeholder: false, x: b.x, y: b.y, w: b.w, h: b.h, hasBox: true,
      paras: [{ text: b.lines.map((l) => l.text).join(" "), level: 0, bullet: false, runs: [{ text: b.lines.map((l) => l.text).join(" "), size: b.lines[0].size, font: null, bold: false, italic: false, color: null }] }] }));
    slides.push({ index: n, hidden: false, background: "#FFFFFF", layoutName: "", shapes, canvas, pageW: vp.width, pageH: vp.height });
    page.cleanup();
  }
  return finishDeck({ name: file.name, kind: "pdf", width: W, height: H, theme: { major: null, minor: null, colors: {} }, slides });
}
// "S E R V I C E S · 1 / 2" → "SERVICES · 1/2": single glyphs are joined; a gap survives only next to a multi-letter piece or a separator
function collapseSpaced(text) { const t = text.split(" "); let out = ""; for (let i = 0; i < t.length; i++) { const a = t[i - 1], b = t[i]; const sep = (x) => /^[·•|–—-]$/.test(x); out += i && (sep(a) || sep(b)) ? ` ${b}` : b; } return out; }
