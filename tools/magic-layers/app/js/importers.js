// Opens images, PDFs (multi-page, with their text layer when present), PowerPoint files that hold picture slides,
// and saved Magic Layers projects. Every page starts un-analysed: { id, name, raw (canvas), pdfText }.
import { uid, makeCanvas, loadImage, fileStem, canvasToBlob } from "./util.js";
import { availableFonts } from "./fonts.js";

const PDF_SIDE = 2400;
let pdfjs = null;
async function getPdfjs() { if (!pdfjs) { pdfjs = await import("/vendor/pdfjs/pdf.min.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs"; } return pdfjs; }

export const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.bmp,.pdf,.pptx,.mlayers,.json";
const isImage = (f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name);

function rawPage(name, canvas, pdfText = null) { return { id: uid("p"), name, raw: canvas, width: canvas.width, height: canvas.height, pdfText, layers: null }; }
async function fromImageBlob(blob, name) { const url = URL.createObjectURL(blob); try { const img = await loadImage(url); const c = makeCanvas(img.naturalWidth, img.naturalHeight); c.getContext("2d").drawImage(img, 0, 0); return rawPage(name, c); } finally { URL.revokeObjectURL(url); } }

/* ---------- PDF ---------- */
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function parseFontName(name, fonts) {
  if (!name) return null;
  const clean = name.replace(/^[A-Z]{6}\+/, ""), key = squash(clean.split(/[-,]/)[0].replace(/(MT|PS|PSMT|Std|Pro)$/g, ""));
  const fam = fonts.find((f) => squash(f) === key) || fonts.find((f) => key.startsWith(squash(f)));
  if (!fam) return null;
  // weight only when the name states one: subset names of variable fonts often carry none, and the pixels decide then
  const weight = /Black|Heavy|ExtraBold/i.test(clean) ? 800 : /Semi|Demi/i.test(clean) ? 600 : /Bold/i.test(clean) ? 700 : /Medium/i.test(clean) ? 500 : /Light|Thin/i.test(clean) ? 300 : /Regular|Roman|Book/i.test(clean) ? 400 : null;
  return { family: fam, weight, italic: /Italic|Oblique/i.test(clean) };
}
async function pdfPages(file, onProgress) {
  const lib = await getPdfjs(), fonts = await availableFonts();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, wasmUrl: "/vendor/pdfjs/wasm/", cMapUrl: "/vendor/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/vendor/pdfjs/standard_fonts/", iccUrl: "/vendor/pdfjs/iccs/" }).promise;
  const pages = [], stem = fileStem(file.name);
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress(`Reading page ${n} of ${doc.numPages}`, n / doc.numPages);
    const page = await doc.getPage(n), base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, PDF_SIDE / Math.max(base.width, base.height)), vp = page.getViewport({ scale });
    const canvas = makeCanvas(vp.width, vp.height), ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    // text layer → lines. PDF writers split text unpredictably (per glyph when letter-spaced, around kerning pairs,
    // around punctuation), so pieces on one baseline are rejoined by the gaps between them: touching pieces are one
    // word, and a gap clearly wider than the line's letter-spacing is a space.
    const tc = await page.getTextContent(), items = []; let spaceBefore = false;
    for (const it of tc.items) {
      if (it.str === undefined) continue;
      if (!it.str.trim()) { if (it.str.length || it.hasEOL) spaceBefore = true; continue; }
      const tx = lib.Util.transform(vp.transform, it.transform);
      if (Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01) { spaceBefore = true; continue; }   // rotated text stays in the picture
      const fh = Math.hypot(tx[2], tx[3]), w = it.width * scale; if (fh < 3 || w < 1) { spaceBefore = true; continue; }
      const lead = /^\s/.test(it.str), trail = /\s$/.test(it.str), text = it.str.replace(/\s+/g, " ").trim();
      // trailing/leading spaces are part of the advance width: take them off the box
      const full = it.str.replace(/\s+/g, " "), per = w / Math.max(1, full.length), x0 = tx[4] + (lead ? per * 0.6 : 0), x1 = tx[4] + w - (trail ? per * 0.6 : 0);
      // "S E R V I C E S": the reader writes letter-spaced text with a space after every glyph; the page pixels settle the real word gaps later
      const toks = text.split(" "), spaced = toks.length >= 3 && text.replace(/ /g, "").length / toks.length <= 1.8;
      items.push({ text, spaced, x0, x1: Math.max(x0 + 1, x1), base: tx[5], h: fh, fontName: it.fontName, font: null, before: spaceBefore || lead, after: trail }); spaceBefore = Boolean(it.hasEOL);
    }
    // the face name when the reader exposes it (older builds do); otherwise lines are grouped by their embedded font and fitted together
    const fontOf = new Map();
    for (const it of items) { if (!fontOf.has(it.fontName)) { let f = null; try { const obj = page.commonObjs.has(it.fontName) ? page.commonObjs.get(it.fontName) : null; f = parseFontName(obj && obj.name, fonts); } catch (e) { f = null; } fontOf.set(it.fontName, f); } it.font = fontOf.get(it.fontName); }
    const rowsPdf = [];
    for (const it of items.slice().sort((a, b) => a.base - b.base || a.x0 - b.x0)) { const r = rowsPdf.find((q) => Math.abs(q.base - it.base) < it.h * 0.25 && Math.abs(q.h - it.h) < it.h * 0.2); if (r) r.items.push(it); else rowsPdf.push({ base: it.base, h: it.h, items: [it] }); }
    const lines = [];
    for (const r of rowsPdf) {
      r.items.sort((a, b) => a.x0 - b.x0);
      const gaps = []; for (let i = 1; i < r.items.length; i++) gaps.push(r.items[i].x0 - r.items[i - 1].x1);
      // letter-spaced line: most pieces are one or two glyphs; its tracking is the typical gap
      const tiny = r.items.filter((x) => x.text.length <= 2).length, spaced = r.items.length >= 4 && tiny >= r.items.length * 0.6;
      const pos = gaps.filter((g) => g > 0).sort((a, b) => a - b), track = spaced && pos.length ? pos[Math.floor(pos.length * 0.4)] : 0, spaceAt = track + r.h * (spaced ? 0.2 : 0.14);
      let cur = null;
      r.items.forEach((it, i) => {
        const gap = i ? gaps[i - 1] : 0, prev = r.items[i - 1];
        if (cur && gap > r.h * 1.6 + track * 3) cur = null;                               // far apart: a separate text (another column)
        const space = i > 0 && cur && (gap > spaceAt || ((it.before || prev.after) && gap > -r.h * 0.2 && !spaced));
        if (!cur) { cur = { base: r.base, h: r.h, font: it.font, fontKey: `${n}:${it.fontName}`, keyLen: it.text.length, track, units: [{ text: it.text, spaced: it.spaced, x0: it.x0, x1: it.x1 }] }; lines.push(cur); }
        else if (space) cur.units.push({ text: it.text, spaced: it.spaced, x0: it.x0, x1: it.x1 });
        else { const u = cur.units[cur.units.length - 1]; u.text += it.text; u.x1 = Math.max(u.x1, it.x1); }
        if (!cur.font && it.font) cur.font = it.font;
        if (it.text.length > cur.keyLen) { cur.keyLen = it.text.length; cur.fontKey = `${n}:${it.fontName}`; }
      });
    }
    const pdfText = lines.map((l) => { const words = l.units.map((u) => ({ text: u.text, spaced: Boolean(u.spaced), conf: 100, x0: Math.round(u.x0), y0: Math.round(l.base - l.h * 0.86), x1: Math.round(u.x1), y1: Math.round(l.base + l.h * 0.26) })); return { text: words.map((w) => w.text).join(" "), conf: 100, chars: words.reduce((a, w) => a + w.text.length, 0), source: "pdf", font: l.font, fontKey: l.fontKey, fontSize: l.h, words, x0: Math.min(...words.map((w) => w.x0)), y0: Math.min(...words.map((w) => w.y0)), x1: Math.max(...words.map((w) => w.x1)), y1: Math.max(...words.map((w) => w.y1)), score: 200 }; });
    pages.push(rawPage(doc.numPages > 1 ? `${stem} · page ${n}` : stem, canvas, pdfText.length ? pdfText : null));
    page.cleanup();
  }
  return pages;
}

/* ---------- PowerPoint: slides that are a single flattened picture ---------- */
async function pptxPages(file, onProgress) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files).map((p) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(p)).filter(Boolean).sort((a, b) => Number(a[1]) - Number(b[1]));
  const pages = [], stem = fileStem(file.name);
  for (const m of slides) {
    onProgress(`Reading slide ${m[1]} of ${slides.length}`, Number(m[1]) / slides.length);
    const rels = zip.file(`ppt/slides/_rels/slide${m[1]}.xml.rels`); if (!rels) continue;
    const targets = [...(await rels.async("string")).matchAll(/Target="\.\.\/media\/([^"]+\.(?:png|jpe?g|gif|bmp|webp))"/gi)].map((x) => x[1]);
    let best = null; for (const t of targets) { const f = zip.file(`ppt/media/${t}`); if (!f) continue; const blob = await f.async("blob"); if (!best || blob.size > best.blob.size) best = { blob, name: t }; }
    if (!best) continue;
    try { const pg = await fromImageBlob(best.blob, `${stem} · slide ${m[1]}`); if (pg.width >= 400 && pg.height >= 300) pages.push(pg); } catch (e) { /* unsupported picture format */ }
  }
  return pages;
}

/* ---------- saved projects ---------- */
async function canvasFromDataUrl(src) { const img = await loadImage(src); const c = makeCanvas(img.naturalWidth, img.naturalHeight); c.getContext("2d").drawImage(img, 0, 0); return c; }
async function projectFromJson(text) {
  const data = JSON.parse(text); if (!data || data.format !== "magic-layers" || !Array.isArray(data.pages)) throw new Error("This file is not a Magic Layers project.");
  const pages = [];
  for (const p of data.pages) {
    const raw = await canvasFromDataUrl(p.original);
    const page = { id: uid("p"), name: p.name, raw, original: raw, width: p.width, height: p.height, pdfText: null, layers: null, stats: p.stats || null };
    if (p.layers) { page.layers = []; for (const l of p.layers) { const layer = { ...l, id: uid("l") }; if (l.src) { layer.canvas = await canvasFromDataUrl(l.src); delete layer.src; } page.layers.push(layer); } }
    pages.push(page);
  }
  return { name: data.name || "Project", pages };
}

export async function openFiles(fileList, onProgress = () => {}) {
  const files = [...fileList]; if (!files.length) return null;
  const project = { name: fileStem(files[0].name), pages: [] }, skipped = [];
  for (const f of files) {
    try {
      if (/\.(mlayers|json)$/i.test(f.name)) { const p = await projectFromJson(await f.text()); if (files.length === 1) return { project: p, skipped }; project.pages.push(...p.pages); }
      else if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") project.pages.push(...(await pdfPages(f, onProgress)));
      else if (/\.pptx$/i.test(f.name)) { const pg = await pptxPages(f, onProgress); if (!pg.length) skipped.push(`${f.name}: no picture slides found (slides that are already editable do not need converting)`); project.pages.push(...pg); }
      else if (isImage(f)) project.pages.push(await fromImageBlob(f, fileStem(f.name)));
      else skipped.push(`${f.name}: unsupported file type`);
    } catch (e) { console.error(e); skipped.push(`${f.name}: ${e.message || "could not be opened"}`); }
  }
  return { project: project.pages.length ? project : null, skipped };
}
export async function thumbnail(canvas, side = 220) { const k = side / Math.max(canvas.width, canvas.height), c = makeCanvas(canvas.width * k, canvas.height * k), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(canvas, 0, 0, c.width, c.height); return URL.createObjectURL(await canvasToBlob(c, "image/jpeg", 0.8)); }
