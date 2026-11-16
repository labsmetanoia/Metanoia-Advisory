// Magic Layers — analysis pipeline. Turns one flat page (a bitmap, optionally with text read from a PDF)
// into a page object: { width, height, original, layers[] } with background, shapes, pictures and live text.
import { clamp, uid, hex, colourDist, median, makeCanvas, canvasFromRGBA } from "./util.js";
import { availableFonts, fontMetrics, cssFamily, SERIF, weightsFor, BUNDLED } from "./fonts.js";

const MAX_SIDE = 2400;        // analysis and editing resolution (long side)
const OCR_TARGET = 2800;      // small text is upscaled before OCR

/* ---------- OCR: a small ensemble, because slide text is hard for any single pass ----------
   native size, 2× upscale, and a contrast-normalised 2× pass (catches pale, coloured and light-on-dark text).
   All candidates go to the pixel stage, which keeps the best non-overlapping ones. */
let scheduler = null, ocrLang = "";
async function getScheduler(lang) {
  if (scheduler && ocrLang === lang) return scheduler;
  if (scheduler) { await scheduler.terminate(); scheduler = null; }
  scheduler = Tesseract.createScheduler();
  const n = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
  for (let i = 0; i < n; i++) { const w = await Tesseract.createWorker(lang, 1, { workerPath: "/vendor/tesseract/worker.min.js", corePath: "/vendor/tesseract/", langPath: "/vendor/tessdata/", gzip: true, workerBlobURL: false }); await w.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" }); scheduler.addWorker(w); }
  ocrLang = lang; return scheduler;
}
const looksLikeText = (t) => { const s = t.replace(/\s/g, ""); if (!s) return false; const alnum = (s.match(/[\p{L}\p{N}]/gu) || []).length; return alnum / s.length >= 0.5; };
function scaled(canvas, scale) { if (scale <= 1.02) return canvas; const c = makeCanvas(canvas.width * scale, canvas.height * scale), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(canvas, 0, 0, c.width, c.height); return c; }
// Dark-on-white rendering of "how different is each pixel from its neighbourhood": text of any colour becomes black ink.
function normalised(canvas) {
  const w = canvas.width, h = canvas.height, r = Math.max(10, Math.round(Math.max(w, h) * 0.012));
  const blur = makeCanvas(w, h), bx = blur.getContext("2d", { willReadFrequently: true }); bx.filter = `blur(${r}px)`; bx.drawImage(canvas, 0, 0); bx.filter = "none";
  const a = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h), b = bx.getImageData(0, 0, w, h).data, d = a.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - Math.min(255, Math.max(Math.abs(d[i] - b[i]), Math.abs(d[i + 1] - b[i + 1]), Math.abs(d[i + 2] - b[i + 2])) * 3.2); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  const out = makeCanvas(w, h); out.getContext("2d").putImageData(a, 0, 0); return out;
}
function toLines(data, s, pass) {
  const lines = [];
  for (const block of data.blocks || []) for (const par of block.paragraphs || []) for (const ln of par.lines || []) {
    const words = (ln.words || []).filter((w) => w.text && w.text.trim()).map((w) => ({ text: w.text.trim(), conf: w.confidence, x0: Math.round(w.bbox.x0 / s), y0: Math.round(w.bbox.y0 / s), x1: Math.round(w.bbox.x1 / s), y1: Math.round(w.bbox.y1 / s) }));
    // icons and bullets at either end of a line are often read as low-confidence "words": trim them
    const junk = (w) => w.conf < 40 || (w.text.length <= 3 && w.conf < 60 && !/^[\p{L}\p{N}]+[.,:;%]?$/u.test(w.text));
    while (words.length > 1 && junk(words[0])) words.shift();
    while (words.length > 1 && junk(words[words.length - 1])) words.pop();
    if (!words.length) continue;
    // split a line at very wide gaps (table columns, axis labels read as one row)
    const hgt = median(words.map((w) => w.y1 - w.y0)) || 10; let cur = [];
    const flush = () => { if (!cur.length) return; const chars = cur.reduce((a, w) => a + w.text.length, 0); lines.push({ text: cur.map((w) => w.text).join(" "), conf: cur.reduce((a, w) => a + w.conf * w.text.length, 0) / chars, chars, words: cur, x0: Math.min(...cur.map((w) => w.x0)), y0: Math.min(...cur.map((w) => w.y0)), x1: Math.max(...cur.map((w) => w.x1)), y1: Math.max(...cur.map((w) => w.y1)), source: "ocr", pass }); cur = []; };
    for (const w of words) { if (cur.length && w.x0 - cur[cur.length - 1].x1 > hgt * 2.4) flush(); cur.push(w); }
    flush();
  }
  return lines.filter((l) => { const h = l.y1 - l.y0; if (h < 6 || l.x1 - l.x0 < 4 || !looksLikeText(l.text)) return false; if (l.chars === 1) return l.conf >= 92; if (l.chars <= 3) return l.conf >= 78; return l.conf >= 68; });
}
async function ocrLines(canvas, lang) {
  const sch = await getScheduler(lang);
  const s2 = clamp(OCR_TARGET / Math.max(canvas.width, canvas.height), 1, 2.5), big = scaled(canvas, s2);
  const jobs = [[canvas, 1, "native"], [normalised(big), s2, "contrast"]]; if (s2 > 1.2) jobs.push([big, s2, "upscaled"]);
  const results = await Promise.all(jobs.map(([img, s, pass]) => sch.addJob("recognize", img, {}, { blocks: true }).then((r) => toLines(r.data, s, pass))));
  // best first: confidence, with a bonus for longer lines so a whole line beats its own fragment
  return results.flat().map((l) => ({ ...l, score: l.conf + 2 * Math.min(l.chars, 30) })).sort((a, b) => b.score - a.score);
}

/* ---------- worker ---------- */
let cvWorker = null, cvSeq = 0; const pending = new Map();
function runWorker(payload, transfer) {
  if (!cvWorker) { cvWorker = new Worker("/js/analyze-worker.js"); cvWorker.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p.resolve(e.data); } }; cvWorker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || "analysis failed")); pending.clear(); cvWorker = null; }; }
  return new Promise((resolve, reject) => { const id = ++cvSeq; pending.set(id, { resolve, reject }); cvWorker.postMessage({ type: "analyze", ...payload, id }, transfer || []); });
}

/* ---------- font fitting: pick the face, weight, size and tracking that best reproduce the detected ink ---------- */
// Optical-size fonts (Fraunces, Inter) change proportions with size, so candidates are drawn at the real size and
// their ink is measured from pixels rather than scaled from a reference measurement.
const fitCanvas = makeCanvas(800, 140), fitCtx = fitCanvas.getContext("2d", { willReadFrequently: true });
function drawAndScan(text, font, F, ls, Wd, H) {
  const pad = Math.ceil(F * 0.35) + 4, cw = Math.ceil(Wd * 1.25) + pad * 2, ch = Math.ceil(H * 1.5) + pad * 2;
  if (fitCanvas.width < cw) fitCanvas.width = cw; if (fitCanvas.height < ch) fitCanvas.height = ch;
  fitCtx.setTransform(1, 0, 0, 1, 0, 0); fitCtx.clearRect(0, 0, cw, ch);
  fitCtx.font = font(F); fitCtx.letterSpacing = `${ls}px`; fitCtx.fillStyle = "#000"; fitCtx.textBaseline = "alphabetic";
  const penX = pad, baseY = pad + Math.ceil(H * 1.1); fitCtx.fillText(text, penX, baseY); fitCtx.letterSpacing = "0px";
  const d = fitCtx.getImageData(0, 0, cw, ch).data; let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let y = 0; y < ch; y++) { const o = y * cw * 4; for (let x = 0; x < cw; x++) if (d[o + x * 4 + 3] > 96) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { d, cw, ch, x0, y0, x1, y1, penX, baseY, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function overlapScore(r, s, H, Wd, ink, maskCrop) {
  let inter = 0, uni = 0;
  for (let y = 0; y < H; y++) { const sy = Math.min(ink.h - 1, Math.floor((y + 0.5) / s)), ry = r.y0 + y; for (let x = 0; x < Wd; x++) { const sx = Math.min(ink.w - 1, Math.floor((x + 0.5) / s)), rx = r.x0 + x; const a = rx < r.cw && ry < r.ch && r.d[(ry * r.cw + rx) * 4 + 3] > 110, b = maskCrop[sy * ink.w + sx] === 1; if (a && b) inter++; if (a || b) uni++; } }
  return uni ? inter / uni : 0;
}
// One candidate at one size: tracking is solved from the width, then the drawn ink is compared with the detected ink
// (anchored at the top-left, so a line whose descenders were clipped by the next line still scores at its true size).
function tryFace(text, font, F, s, H, Wd, ink, maskCrop, n) {
  let ls = 0, r = drawAndScan(text, font, F, 0, Wd, H); if (r.x1 < 0) return null;
  if (n > 1 && Math.abs(r.w - Wd) / Wd > 0.02) { ls = clamp((Wd - r.w) / (n - 1), -0.09 * F, 0.9 * F); r = drawAndScan(text, font, F, ls, Wd, H); if (r.x1 < 0) return null; }
  const track = Math.abs(ls) / F, widthErr = Math.abs(r.w - Wd) / Wd;
  // typefaces are rarely set tighter or looser than a few percent: needing more tracking than that counts against the face
  const score = overlapScore(r, s, H, Wd, ink, maskCrop) - widthErr * 0.5 - Math.min(track, 0.08) * 0.9;
  return { score, F, ls, r };
}
export function scoreFace(text, family, weight, italic, ink, maskCrop, sweep = false, knownSize = 0) {
  const s = Math.min(1, 96 / ink.h), H = Math.max(6, Math.round(ink.h * s)), Wd = Math.max(6, Math.round(ink.w * s));
  const font = (F) => `${italic ? "italic " : ""}${weight} ${F}px ${cssFamily(family)}`, n = [...text].length;
  let F = H / 0.92; const first = drawAndScan(text, font, F, 0, Wd, H); if (first.x1 < 0) return null;
  F *= H / first.h; const second = drawAndScan(text, font, F, 0, Wd, H); if (second.x1 < 0) return null; F *= H / second.h;
  let best = null;
  if (knownSize) F = knownSize * s;
  for (const k of (knownSize ? [1] : sweep ? [1, 0.93, 0.965, 1.035, 1.07, 1.11] : [1, 0.945])) { const t = tryFace(text, font, F * k, s, H, Wd, ink, maskCrop, n); if (t && (!best || t.score > best.score + (k === 1 ? 0 : 0.012))) best = t; }
  if (!best) return null;
  const r = best.r;
  let on = 0; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (r.d[(y * r.cw + x) * 4 + 3] > 110) on++;
  let mk = 0; for (let i = 0; i < maskCrop.length; i++) mk += maskCrop[i];
  const density = (on / (r.w * r.h)) / Math.max(1e-6, mk / (ink.w * ink.h));   // > 1: the candidate is heavier than the original
  return { family, weight, italic, iou: best.score, density, fontSize: best.F / s, letterSpacing: best.ls / s, ascent: (r.baseY - r.y0) / s, originDX: (r.penX - r.x0) / s };
}
function cropMask(mask, W, ink) { const out = new Uint8Array(ink.w * ink.h); for (let y = 0; y < ink.h; y++) for (let x = 0; x < ink.w; x++) out[y * ink.w + x] = mask[(ink.y + y) * W + ink.x + x]; return out; }

const lineById0 = (lines, id) => lines[id];

const HOUSE = new Set(BUNDLED);   // near-ties go to the typefaces that ship with the app
/* ---------- main entry ---------- */
export async function analyzePage(source, options = {}, onProgress = () => {}) {
  const opt = Object.assign({ lang: "eng", detail: 1, objects: true, pdfText: null, name: "Page" }, options);
  // 1. working bitmap
  const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh)), W = Math.round(sw * k), H = Math.round(sh * k);
  const original = makeCanvas(W, H); { const c = original.getContext("2d"); c.imageSmoothingQuality = "high"; c.drawImage(source, 0, 0, W, H); }
  // 2. text lines: from the PDF text layer when there is one, otherwise OCR
  onProgress("Reading text", 0.1);
  let lines;
  if (opt.pdfText && opt.pdfText.length) lines = opt.pdfText.map((l) => ({ ...l, fontSize: l.fontSize ? l.fontSize * k : 0, x0: Math.round(l.x0 * k), y0: Math.round(l.y0 * k), x1: Math.round(l.x1 * k), y1: Math.round(l.y1 * k), words: l.words.map((w) => ({ ...w, x0: Math.round(w.x0 * k), y0: Math.round(w.y0 * k), x1: Math.round(w.x1 * k), y1: Math.round(w.y1 * k) })) }));
  else if (opt.ocrLines) lines = opt.ocrLines.map((l) => ({ ...l, words: l.words.map((w) => ({ ...w })) }));
  else lines = opt.skipText ? [] : await ocrLines(original, opt.lang);
  const ocrCache = opt.pdfText ? null : lines.map((l) => ({ ...l, words: l.words.map((w) => ({ ...w })) }));
  if (opt.extraLines && opt.extraLines.length) lines = lines.concat(opt.extraLines.map((l) => ({ ...l, words: l.words.map((w) => ({ ...w })) })));
  lines.forEach((l, i) => { l.id = i; l.words.forEach((w, j) => { w.id = j; }); });
  // 3. pixels: text removal, background model, shapes and pictures
  onProgress("Separating layers", 0.45);
  const rgba = original.getContext("2d").getImageData(0, 0, W, H).data;
  let res = await runWorker({ width: W, height: H, rgba: rgba.buffer, lines: lines.map((l) => ({ id: l.id, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, conf: l.conf, words: l.words.map((w) => ({ id: w.id, n: w.text.length, x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 })) })), options: { detail: opt.detail, objects: opt.objects, debug: opt.debug } }, [rgba.buffer]);
  if (!opt.pdfText && !opt.skipText && opt.thorough) {
    // second look: with the recognised text gone, the page is simpler and text missed the first time is often readable
    onProgress("Second look for missed text", 0.6);
    const plate0 = canvasFromRGBA(res.plate.slice(0), W, H), sch = await getScheduler(opt.lang);
    const s2 = clamp(OCR_TARGET / Math.max(W, H), 1, 2.5), big = scaled(plate0, s2);
    const extra = (await Promise.all([[normalised(big), s2, "second-contrast"], [big, s2, "second"]].map(([img, sc, pass]) => sch.addJob("recognize", img, {}, { blocks: true }).then((r) => toLines(r.data, sc, pass))))).flat();
    if (extra.length) {
      // keep what was accepted (in order), then offer the new candidates
      const kept = res.segments.map((sg) => { const l = lineById0(lines, sg.line); const ws = sg.words.map((id) => l.words[id]); return { ...l, words: ws, text: ws.map((w) => w.text).join(" "), x0: Math.min(...ws.map((w) => w.x0)), y0: Math.min(...ws.map((w) => w.y0)), x1: Math.max(...ws.map((w) => w.x1)), y1: Math.max(...ws.map((w) => w.y1)) }; });
      lines = kept.concat(extra.map((l) => ({ ...l, score: l.conf + 2 * Math.min(l.chars, 30) })).sort((a, b) => b.score - a.score));
      lines.forEach((l, i) => { l.id = i; l.words = l.words.map((w, j) => ({ ...w, id: j })); });
      const rgba2 = original.getContext("2d").getImageData(0, 0, W, H).data;
      res = await runWorker({ width: W, height: H, rgba: rgba2.buffer, lines: lines.map((l) => ({ id: l.id, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, conf: l.conf, words: l.words.map((w) => ({ id: w.id, n: w.text.length, x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 })) })), options: { detail: opt.detail, objects: opt.objects, debug: opt.debug } }, [rgba2.buffer]);
    }
  }
  // 4. text layers
  onProgress("Matching fonts", 0.75);
  const fonts = await availableFonts();
  const pixels = (ls) => { const px = original.getContext("2d").getImageData(0, 0, W, H).data; return runWorker({ width: W, height: H, rgba: px.buffer, lines: ls.map((l) => ({ id: l.id, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, conf: l.conf, words: l.words.map((w) => ({ id: w.id, n: w.text.length, x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 })) })), options: { detail: opt.detail, objects: opt.objects, debug: opt.debug } }, [px.buffer]); };
  const fitText = (res) => {
  const textMask = new Uint8Array(res.textMask);
  const wordInfo = new Map(res.words.map((w) => [`${w.line}:${w.word}`, w]));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  // accepted segments → rows; neighbours on the same row are joined (a line found in two pieces, a highlighted word)
  let rows = res.segments.map((sg) => { const l = lineById.get(sg.line); const ws = sg.words.map((id) => ({ w: l.words[id], a: wordInfo.get(`${sg.line}:${id}`) })).filter((x) => x.a); return { l, ws, ids: [l.id] }; }).filter((r) => r.ws.length);
  const inkOf = (ws) => { const k = { x: Math.min(...ws.map((x) => x.a.ink.x0)), y: Math.min(...ws.map((x) => x.a.ink.y0)), x1: Math.max(...ws.map((x) => x.a.ink.x1)), y1: Math.max(...ws.map((x) => x.a.ink.y1)) }; k.w = k.x1 - k.x; k.h = k.y1 - k.y; return k; };
  rows.forEach((r) => { r.ink = inkOf(r.ws); });
  for (let merged = true; merged;) { merged = false; rows.sort((a, b) => a.ink.x - b.ink.x);
    outer: for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) { const A = rows[i].ink, Bk = rows[j].ink, hmin = Math.min(A.h, Bk.h), hmax = Math.max(A.h, Bk.h); const vo = Math.min(A.y1, Bk.y1) - Math.max(A.y, Bk.y), gap = Bk.x - A.x1;
      if (vo >= hmin * 0.55 && hmax <= hmin * 1.45 && gap >= -hmin * 0.2 && gap <= hmax * 0.95) { rows[i] = { l: rows[i].l, ids: rows[i].ids.concat(rows[j].ids), ws: rows[i].ws.concat(rows[j].ws), ink: null, conf: Math.min(rows[i].l.conf, rows[j].l.conf) }; rows[i].ink = inkOf(rows[i].ws); rows.splice(j, 1); merged = true; break outer; } } }
  // a label read without its space ("Q224"): when every letter is a separate blob and one gap is far wider than the rest, it is a space
  const unglue = (text, k) => {
    const chars = [...text], n = chars.length; if (n < 3 || n > 14 || /\s/.test(text)) return text;
    const runsX = []; let open = -1;
    for (let x = k.x0; x <= k.x1 + 1; x++) { let any = false; if (x <= k.x1) for (let y = k.y0; y <= k.y1; y++) if (textMask[y * W + x]) { any = true; break; } if (any && open < 0) open = x; else if (!any && open >= 0) { runsX.push([open, x - 1]); open = -1; } }
    if (runsX.length !== n) return text;
    const gaps = []; for (let i = 1; i < n; i++) gaps.push(runsX[i][0] - runsX[i - 1][1] - 1);
    const mx = Math.max(...gaps), rest = gaps.filter((g) => g < mx * 0.8), base = rest.length ? median(rest) : mx, h = k.y1 - k.y0 + 1;
    if (!rest.length || mx < 4 || mx < h * 0.36 || mx < Math.max(1, base) * 2.3 + 1) return text;
    return chars.map((c, i) => (i && gaps[i - 1] >= mx * 0.8 ? " " + c : c)).join("");
  };
  // letter-spaced text from a PDF arrives as "S E R V I C E S · 1 / 2": drop the per-glyph spaces and put back the ones the pixels show
  const respace = (text, k) => {
    const chars = [...text.replace(/ /g, "")], n = chars.length; if (n < 2) return text;
    const runsX = []; let open = -1;
    for (let x = k.x0; x <= k.x1 + 1; x++) { let any = false; if (x <= k.x1) for (let y = k.y0; y <= k.y1; y++) if (textMask[y * W + x]) { any = true; break; } if (any && open < 0) open = x; else if (!any && open >= 0) { runsX.push([open, x - 1]); open = -1; } }
    if (runsX.length !== n) return text;
    const gaps = []; for (let i = 1; i < n; i++) gaps.push(runsX[i][0] - runsX[i - 1][1] - 1);
    const sorted = gaps.slice().sort((a, b) => a - b), base = sorted[Math.floor(sorted.length * 0.4)], h = k.y1 - k.y0 + 1, cut = base + Math.max(2, h * 0.22);
    return chars.map((c, i) => (i && gaps[i - 1] > cut ? " " + c : c)).join("");
  };
  for (const row of rows) for (const x of row.ws) { if (!x.a.ink) continue; if (row.l.source === "pdf") { if (x.w.spaced) x.w = { ...x.w, text: respace(x.w.text, x.a.ink) }; } else x.w = { ...x.w, text: unglue(x.w.text, x.a.ink) }; }
  const fitted = [];
  for (const row of rows) {
    const l = row.l, ws = row.ws, ink = row.ink;
    if (ink.w < 3 || ink.h < 4) continue;
    const text = ws.map((x) => x.w.text).join(" ");
    // colour runs: neighbouring words whose colours differ start a new run
    const runs = []; for (const x of ws) { const col = x.a.color, last = runs[runs.length - 1]; if (last && colourDist(last.rgb, col) < 42) { last.text += " " + x.w.text; last.n += x.w.text.length; } else runs.push({ text: (runs.length ? " " : "") + x.w.text, rgb: col, n: x.w.text.length }); }
    const main = runs.slice().sort((a, b) => b.n - a.n)[0].rgb;
    const crop = cropMask(textMask, W, ink);
    let cands = [];
    const known = l.source === "pdf" && l.fontSize ? l.fontSize : 0;      // a PDF states its type size exactly
    const families = l.font && fonts.includes(l.font.family) ? [l.font.family] : fonts;
    for (const fam of families) for (const wgt of (l.font && l.font.weight ? [l.font.weight] : weightsFor(fam))) { const r = scoreFace(text, fam, wgt, Boolean(l.font && l.font.italic), ink, crop, false, known); if (r) cands.push(r); }
    cands.sort((a, b) => b.iou - a.iou);
    // refine the leaders with a size sweep (handles clipped descenders and tight leading)
    if (!known) cands = cands.slice(0, 5).map((c) => scoreFace(text, c.family, c.weight, c.italic, ink, crop, true) || c).concat(cands.slice(5)).sort((a, b) => b.iou - a.iou);
    if (runs.length > 1 && !row.part && (!cands.length || cands[0].iou < 0.3)) { let cur = null; for (const x of ws) { if (cur && colourDist(cur.col, x.a.color) < 42) cur.ws.push(x); else { cur = { col: x.a.color, ws: [x] }; rows.push({ l, ids: row.ids, ws: cur.ws, conf: row.conf, part: true }); } } for (const r of rows) if (r.part && !r.ink) r.ink = inkOf(r.ws); continue; }
    fitted.push({ line: l, ids: row.ids, crop, known, spread: ws.reduce((a, x) => a + (x.a.spread || 0), 0) / ws.length, conf: row.conf ?? l.conf, ink, text, runs, main, cands, chars: text.length, bg: ws[0].a.bg });
    if (opt.debug) (window.__fits ||= []).push({ text, ink, crop: Array.from(crop), cands: cands.slice(0, 8).map((c) => ({ f: c.family, w: c.weight, iou: +c.iou.toFixed(3), den: +c.density.toFixed(3), size: +c.fontSize.toFixed(1), ls: +c.letterSpacing.toFixed(2) })) });
  }
  // one embedded PDF font is one face: every line set in it votes together for family, weight and italic
  const byFont = new Map(); for (const f of fitted) if (f.line.fontKey && f.cands.length && !f.line.font) { if (!byFont.has(f.line.fontKey)) byFont.set(f.line.fontKey, []); byFont.get(f.line.fontKey).push(f); }
  for (const g of byFont.values()) {
    const top = (f, fam, wgt) => { let b = null; for (const c of f.cands) if (c.family === fam && (wgt == null || c.weight === wgt) && (!b || c.iou > b.iou)) b = c; return b; };
    const famScore = new Map(); for (const fam of fonts) { let sc = 0; for (const f of g) { const c = top(f, fam); sc += f.chars * (c ? c.iou + (HOUSE.has(fam) ? 0.03 : 0) : -0.2); } famScore.set(fam, sc); }
    const fam = [...famScore.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const wv = new Map(); for (const f of g) for (const c of f.cands) if (c.family === fam) wv.set(c.weight, (wv.get(c.weight) || 0) + f.chars * (c.iou - 0.6 * Math.abs(Math.log(Math.max(0.05, c.density)))));
    const wgt = [...wv.entries()].sort((a, b) => b[1] - a[1])[0][0];
    let sumN = 0, sumI = 0; const ital = new Map();
    for (const f of g) { const c = top(f, fam, wgt), it = scoreFace(f.text, fam, wgt, true, f.ink, f.crop, false, f.known); if (it) ital.set(f, it); sumN += f.chars * (c ? c.iou : 0); sumI += f.chars * (it ? it.iou : 0); }
    const useItalic = sumI > sumN * 1.06;
    for (const f of g) { const c = useItalic ? ital.get(f) : top(f, fam, wgt); if (c) f.cands = [c]; }
  }
  // a PDF line arrives as one piece, so a highlighted word is found afterwards: each word's ink is sampled under the fitted type
  const pdfRows = fitted.filter((f) => f.line.source === "pdf" && f.cands.length && f.text.includes(" "));
  if (pdfRows.length) {
    const px = original.getContext("2d").getImageData(0, 0, W, H).data;
    for (const f of pdfRows) {
      const c = f.cands[0]; fitCtx.font = `${c.italic ? "italic " : ""}${c.weight} ${c.fontSize}px ${cssFamily(c.family)}`; fitCtx.letterSpacing = `${c.letterSpacing}px`;
      const words = f.text.split(" "), runs = []; let at = 0;
      for (const wd of words) {
        const x0 = Math.round(f.ink.x - c.originDX + fitCtx.measureText(f.text.slice(0, at)).width), x1 = Math.round(x0 + fitCtx.measureText(wd).width); at += wd.length + 1;
        const rs = [], gs = [], bs = [];
        for (let y = f.ink.y; y < f.ink.y1; y += 2) for (let x = Math.max(f.ink.x, x0 + 1); x < Math.min(f.ink.x1, x1 - 1); x++) { const i = y * W + x; if (textMask[i]) { rs.push(px[i * 4]); gs.push(px[i * 4 + 1]); bs.push(px[i * 4 + 2]); } }
        // the darkest (or, on dark pages, lightest) third of the ink is the true colour; the rest is antialiasing
        let col = f.main; if (rs.length >= 6) { const lum = rs.map((r, i) => [r + gs[i] + bs[i], i]).sort((a, b) => a[0] - b[0]), bgL = f.bg ? f.bg[0] + f.bg[1] + f.bg[2] : 765, mainL = f.main[0] + f.main[1] + f.main[2]; const pick = (mainL < bgL ? lum.slice(0, Math.ceil(lum.length / 3)) : lum.slice(-Math.ceil(lum.length / 3))).map((v) => v[1]); col = [median(pick.map((i) => rs[i])), median(pick.map((i) => gs[i])), median(pick.map((i) => bs[i]))]; }
        const last = runs[runs.length - 1]; if (last && colourDist(last.rgb, col) < 60) { last.text += " " + wd; last.n += wd.length; } else runs.push({ text: (runs.length ? " " : "") + wd, rgb: col, n: wd.length });
      }
      fitCtx.letterSpacing = "0px";
      if (runs.length > 1 && runs.length <= 4) { f.runs = runs; f.main = runs.slice().sort((a, b) => b.n - a.n)[0].rgb; } else if (runs.length === 1) { f.runs = runs; f.main = runs[0].rgb; }
    }
  }
  return fitted;
  };
  let fitted = fitText(res);
  // a short, unsure reading that no font reproduces is usually part of a picture (a logo, an icon, a photographed sign):
  // it is taken out of the text and the page separated again, so it stays intact inside its picture
  if (!opt.pdfText) {
    const weak = (f) => { if (!f.cands.length || f.line.source === "ai") return false; const top = f.cands[0].iou; if (opt.debug) console.log("decompose weak?", f.text, f.conf, top.toFixed(2), f.spread.toFixed(1)); if (f.chars <= 12 && f.spread > 12 && top < 0.4) return true; return f.chars <= 6 && ((f.conf < 80 && top < 0.5) || (f.conf < 90 && top < 0.36)); };
    for (let round = 0; round < 3; round++) {
      const bad = new Set(fitted.filter(weak).flatMap((f) => f.ids)), good = new Set(fitted.filter((f) => !weak(f)).flatMap((f) => f.ids));
      const drop = [...bad].filter((id) => !good.has(id)); if (!drop.length) break;
      lines = lines.filter((l) => !drop.includes(l.id)); lines.forEach((l, i) => { l.id = i; l.words.forEach((w, j) => { w.id = j; }); }); res = await pixels(lines); fitted = fitText(res);
    }
  }
  // 5. paragraphs first (geometry only), then one face per paragraph and at most two families per page.
  //    Voting across a paragraph's lines rescues a line that fits badly on its own (numeral styles, clipped descenders).
  const items = fitted.filter((f) => f.cands.length).sort((a, b) => a.ink.y - b.ink.y || a.ink.x - b.ink.x), paras = [];
  for (const f of items) {
    f.size0 = f.cands[0].fontSize;
    const p = paras.find((q) => { const last = q.lines[q.lines.length - 1], first = q.lines[0], sz = last.size0; const gap = f.ink.y - last.ink.y1, snug = Math.abs(f.ink.x - first.ink.x) < sz * 0.25 && gap > -sz * 0.2 && gap < sz * 0.6; if (Math.abs(f.size0 - sz) / sz > (snug ? 0.26 : 0.16)) return false; if (gap < -sz * 0.35 || gap > sz * 0.95) return false; if (colourDist(f.main, last.main) > 60 && f.runs.length === 1 && last.runs.length === 1 && !(snug && Math.abs(f.size0 - sz) / sz < 0.14)) return false; const leftOk = Math.abs(f.ink.x - first.ink.x) < sz * 0.7, cOk = Math.abs((f.ink.x + f.ink.x1) / 2 - (first.ink.x + first.ink.x1) / 2) < sz * 0.7, rOk = Math.abs(f.ink.x1 - first.ink.x1) < sz * 0.5; if (!(leftOk || cOk || rOk)) return false; return Math.min(f.ink.x1, last.ink.x1) - Math.max(f.ink.x, last.ink.x) > 0; });
    if (p) p.lines.push(f); else paras.push({ lines: [f] });
  }
  const wScore = (c) => c.iou - 0.6 * Math.abs(Math.log(Math.max(0.05, c.density)));
  const bestOf = (f, fam, wgt) => { let b = null; for (const c of f.cands) if (c.family === fam && (wgt == null || c.weight === wgt) && (!b || c.iou > b.iou)) b = c; return b; };
  for (const p of paras) { p.chars = p.lines.reduce((a, f) => a + f.chars, 0); p.scores = new Map(); for (const fam of fonts) { let sc = 0; for (const f of p.lines) { const c = bestOf(f, fam); sc += f.chars * (c ? c.iou : -0.2); } p.scores.set(fam, sc / p.chars); } p.rank = [...p.scores.entries()].sort((a, b) => b[1] - a[1]); }
  const votes = new Map();
  for (const p of paras) for (const [fam, sc] of p.rank) if (sc >= p.rank[0][1] - 0.04) votes.set(fam, (votes.get(fam) || 0) + p.chars * sc);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const allowed = new Set(ranked.slice(0, 1).map((r) => r[0]));
  if (ranked[1]) { const other = ranked.find((r) => SERIF.has(r[0]) !== SERIF.has(ranked[0][0])); if (other && other[1] > ranked[0][1] * 0.2) allowed.add(other[0]); }
  for (const p of paras) {
    const tol = p.chars <= 8 ? 0.3 : p.chars <= 20 ? 0.16 : 0.09;
    let fam = (p.rank.find(([f2, sc]) => allowed.has(f2) && sc >= p.rank[0][1] - tol) || p.rank[0])[0];
    // a paragraph that is clearly serif (or clearly sans) is not forced into the other class: it takes the page's family of its own class, or its own best face
    if (p.chars > 12) { const top = p.rank[0], cls = SERIF.has(top[0]), rival = p.rank.find(([f2]) => SERIF.has(f2) !== cls); if (SERIF.has(fam) !== cls && (!rival || top[1] - rival[1] >= (median(p.lines.map((f) => f.size0)) < 20 ? 0.14 : 0.05))) { const own = ranked.find(([f2]) => SERIF.has(f2) === cls); fam = own && p.scores.get(own[0]) >= top[1] - tol ? own[0] : top[0]; } }
    // weight: overlap alone is noisy at small sizes, so the amount of ink (stroke thickness) decides with it
    const wv = new Map(); for (const f of p.lines) for (const c of f.cands) if (c.family === fam) wv.set(c.weight, (wv.get(c.weight) || 0) + f.chars * wScore(c));
    const wgt = wv.size ? [...wv.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
    p.fam = fam; for (const f of p.lines) f.fit = bestOf(f, fam, wgt) || bestOf(f, fam) || f.cands[0];
  }
  // sibling labels (axis ticks, column heads, legend entries) share one size and weight; a label that is clearly
  // heavier or lighter than its siblings keeps its own weight
  { const singles = paras.filter((p) => p.lines.length === 1 && p.lines[0].fit), par = singles.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
    const geo = singles.map((p) => { const f = p.lines[0], fs = f.fit.fontSize; return { fs, base: f.ink.y + f.fit.ascent, x0: f.ink.x, cx: (f.ink.x + f.ink.x1) / 2, x1: f.ink.x1 }; });
    for (let i = 0; i < singles.length; i++) for (let j = i + 1; j < singles.length; j++) { const a = geo[i], b = geo[j], fs = Math.min(a.fs, b.fs); if (singles[i].fam !== singles[j].fam || Math.abs(a.fs - b.fs) / fs > 0.2) continue; if (Math.abs(a.base - b.base) < fs * 0.22 || Math.abs(a.x0 - b.x0) < fs * 0.2 || Math.abs(a.cx - b.cx) < fs * 0.2 || Math.abs(a.x1 - b.x1) < fs * 0.2) par[find(i)] = find(j); }
    const groups = new Map(); singles.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
    for (const g of groups.values()) { if (g.length < 3) continue; const fam = g[0].fam, fs = g.map((p) => p.lines[0]);
      const wv = new Map(); for (const f of fs) for (const c of f.cands) if (c.family === fam) wv.set(c.weight, (wv.get(c.weight) || 0) + f.chars * wScore(c));
      const wg = [...wv.entries()].sort((a, b) => b[1] - a[1])[0][0], dens = fs.map((f) => (bestOf(f, fam, wg) || f.fit).density), md = median(dens);
      fs.forEach((f, i) => { let c = bestOf(f, fam, wg) || f.fit; if (dens[i] < md * 0.84 || dens[i] > md * 1.2) { for (const o of f.cands) if (o.family === fam && Math.abs(Math.log(o.density / md)) < Math.abs(Math.log(c.density / md))) c = o; } f.fit = c; });
      const ms = median(fs.map((f) => f.fit.fontSize)); for (const f of fs) if (Math.abs(f.fit.fontSize - ms) / ms < 0.2) f.fit = { ...f.fit, ascent: f.fit.ascent * ms / f.fit.fontSize, letterSpacing: f.fit.letterSpacing * ms / f.fit.fontSize, fontSize: ms }; } }
  const textLayers = paras.map((p) => {
    const ls = p.lines, first = ls[0].fit, fontSize = median(ls.map((x) => x.fit.fontSize));
    const weightVotes = {}; ls.forEach((x) => { weightVotes[x.fit.weight] = (weightVotes[x.fit.weight] || 0) + x.chars; }); const fontWeight = Number(Object.entries(weightVotes).sort((a, b) => b[1] - a[1])[0][0]);
    const base = ls.map((x) => x.ink.y + x.fit.ascent * (fontSize / x.fit.fontSize));
    let lineHeight = 1.2; if (ls.length > 1) { const d = []; for (let i = 1; i < base.length; i++) d.push(base[i] - base[i - 1]); lineHeight = clamp(median(d) / fontSize, 0.85, 2.4); }
    const x0 = Math.min(...ls.map((x) => x.ink.x)), x1 = Math.max(...ls.map((x) => x.ink.x1));
    let align = "left"; if (ls.length > 1) { const lv = Math.max(...ls.map((x) => Math.abs(x.ink.x - x0))), rv = Math.max(...ls.map((x) => Math.abs(x.ink.x1 - x1))), cv = Math.max(...ls.map((x) => Math.abs((x.ink.x + x.ink.x1) / 2 - (x0 + x1) / 2))); if (lv > fontSize * 0.35) align = cv < fontSize * 0.35 ? "center" : rv < fontSize * 0.35 ? "right" : "left"; }
    const fm = fontMetrics(first.family, fontWeight, first.italic), L = lineHeight * fontSize;
    const baselineInBox = (L - (fm.ascent + fm.descent) * fontSize) / 2 + fm.ascent * fontSize;
    const pad = Math.ceil(fontSize * 0.08);
    const allRuns = []; ls.forEach((x, i) => { x.runs.forEach((r, j) => allRuns.push({ text: (i && !j ? "\n" : "") + r.text, color: hex(r.rgb) })); });
    const mainRgb = ls.slice().sort((a, b) => b.chars - a.chars)[0].main, color = hex(mainRgb);
    const runs = []; for (const r of allRuns) { const c = colourDist(mainRgb, [parseInt(r.color.slice(1, 3), 16), parseInt(r.color.slice(3, 5), 16), parseInt(r.color.slice(5, 7), 16)]) < 42 ? color : r.color; const last = runs[runs.length - 1]; if (last && last.color === c) last.text += r.text; else runs.push({ text: r.text, color: c }); }
    const text = runs.map((r) => r.text).join("");
    return { id: uid("t"), type: "text", name: text.replace(/\s+/g, " ").slice(0, 36), x: x0 - pad + (align === "left" ? first.originDX : 0), y: Math.round((base[0] - baselineInBox) * 100) / 100, w: x1 - x0 + pad * 2, h: Math.ceil(L * ls.length), text, runs: runs.length > 1 ? runs : null, fontFamily: first.family, fontSize: Math.round(fontSize * 100) / 100, fontWeight, italic: first.italic, color, align, lineHeight: Math.round(lineHeight * 1000) / 1000, letterSpacing: Math.round(median(ls.map((x) => x.fit.letterSpacing)) * 100) / 100, wrap: false, opacity: 1, visible: true, locked: false, meta: { source: ls[0].line.source || "ocr", confidence: Math.round(Math.min(...ls.map((x) => x.conf ?? x.line.conf ?? 100))), fit: Math.round(first.iou * 100) / 100, pad } };
  });
  // 6. assemble layers, bottom to top
  onProgress("Building layers", 0.92);
  const layers = [];
  const bg = res.background, plate = canvasFromRGBA(res.plate, W, H);
  layers.push({ id: uid("b"), type: "background", name: "Background", x: 0, y: 0, w: W, h: H, canvas: plate, fill: bg.color ? hex(bg.color) : null, uniform: Boolean(bg.uniform), opacity: 1, visible: true, locked: true, meta: { mode: bg.mode } });
  let nShape = 0, nPic = 0, nLine = 0;
  const order = res.elements.map((e, i) => ({ e, i })).sort((a, b) => a.e.depth - b.e.depth || (b.e.w * b.e.h) - (a.e.w * a.e.h));
  for (const { e } of order) {
    if (e.kind === "shape") {
      if (e.shape === "line") { const horizontal = e.w >= e.h; layers.push({ id: uid("s"), type: "shape", shape: "line", name: `Line ${++nLine}`, x: e.x, y: e.y, w: e.w, h: e.h, fill: hex(e.fill), horizontal, dashed: Boolean(e.dashed), radius: 0, opacity: 1, visible: true, locked: false, meta: { source: "auto" } }); }
      else if (e.shape === "outline") layers.push({ id: uid("s"), type: "shape", shape: "rect", name: `Frame ${++nShape}`, x: e.x, y: e.y, w: e.w, h: e.h, fill: null, stroke: hex(e.stroke), strokeWidth: e.strokeWidth, radius: e.radius || 0, opacity: 1, visible: true, locked: false, meta: { source: "auto" } });
      else layers.push({ id: uid("s"), type: "shape", shape: e.shape, name: `${e.shape === "ellipse" ? "Ellipse" : "Shape"} ${++nShape}`, x: e.x, y: e.y, w: e.w, h: e.h, fill: hex(e.fill), radius: e.radius || 0, opacity: 1, visible: true, locked: false, meta: { source: "auto" } });
    } else layers.push({ id: uid("i"), type: "image", name: `Picture ${++nPic}`, x: e.x, y: e.y, w: e.w, h: e.h, canvas: canvasFromRGBA(e.rgba, e.w, e.h), opacity: 1, visible: true, locked: false, meta: { source: "auto", cutout: !e.opaque } });
  }
  textLayers.sort((a, b) => a.y - b.y || a.x - b.x);
  if (textLayers.length) { const biggest = textLayers.slice().sort((a, b) => b.fontSize - a.fontSize)[0]; if (biggest.fontSize > median(textLayers.map((t) => t.fontSize)) * 1.3) biggest.meta.role = "title"; }
  layers.push(...textLayers);
  onProgress("Done", 1);
  return { id: uid("p"), name: opt.name, width: W, height: H, original, layers, ocrLines: ocrCache, stats: { text: textLayers.length, shapes: nShape + nLine, pictures: nPic, background: bg.mode, timings: res.timings } };
}
// Fill a rectangle of a canvas from its surroundings; returns a new canvas (the input is left untouched).
export async function inpaintRect(canvas, rect) {
  const W = canvas.width, H = canvas.height, data = canvas.getContext("2d").getImageData(0, 0, W, H).data;
  const res = await runWorker({ type: "inpaint", width: W, height: H, rgba: data.buffer, rect }, [data.buffer]);
  return canvasFromRGBA(res.rgba, W, H);
}
export async function shutdown() { if (scheduler) { await scheduler.terminate(); scheduler = null; } if (cvWorker) { cvWorker.terminate(); cvWorker = null; } }
