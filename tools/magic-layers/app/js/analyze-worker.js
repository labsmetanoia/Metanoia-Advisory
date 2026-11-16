// Magic Layers — image analysis worker (pure JavaScript, no dependencies).
// Input: the page bitmap and the text lines found by OCR or read from a PDF.
// Output: a clean plate (text and objects removed), vector shapes, cut-out pictures and per-word text attributes.
"use strict";

const maxDiff = (r, g, b, c) => Math.max(Math.abs(r - c[0]), Math.abs(g - c[1]), Math.abs(b - c[2]));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const median = (arr) => { if (!arr.length) return 0; const a = Array.from(arr).sort((x, y) => x - y); return a[a.length >> 1]; };

/* ---------- small image helpers on separate channel planes ---------- */
function boxBlur3(src, W, H) {
  const tmp = new Float32Array(W * H), out = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) { const o = y * W; for (let x = 0; x < W; x++) { const a = src[o + (x > 0 ? x - 1 : x)], b = src[o + x], c = src[o + (x < W - 1 ? x + 1 : x)]; tmp[o + x] = a + b + c; } }
  for (let y = 0; y < H; y++) { const o = y * W, u = (y > 0 ? y - 1 : y) * W, d = (y < H - 1 ? y + 1 : y) * W; for (let x = 0; x < W; x++) out[o + x] = (tmp[u + x] + tmp[o + x] + tmp[d + x]) / 9; }
  return out;
}
function dilate(mask, W, H, r) {
  if (r <= 0) return mask;
  let cur = mask;
  for (let i = 0; i < r; i++) {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { const o = y * W; for (let x = 0; x < W; x++) { if (cur[o + x] || (x > 0 && cur[o + x - 1]) || (x < W - 1 && cur[o + x + 1]) || (y > 0 && cur[o - W + x]) || (y < H - 1 && cur[o + W + x])) out[o + x] = 1; } }
    cur = out;
  }
  return cur;
}
// Separable max filter for large radii (used for grouping nearby fragments).
function dilateBox(mask, W, H, r) {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) { const o = y * W; let last = -1e9; for (let x = 0; x < W; x++) { if (mask[o + x]) last = x; if (x - last <= r) tmp[o + x] = 1; } last = 1e9; for (let x = W - 1; x >= 0; x--) { if (mask[o + x]) last = x; if (last - x <= r) tmp[o + x] = 1; } }
  for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (tmp[y * W + x]) last = y; if (y - last <= r) out[y * W + x] = 1; } last = 1e9; for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) last = y; if (last - y <= r) out[y * W + x] = 1; } }
  return out;
}
// Connected components (8-neighbour) with an explicit stack. Returns labels (Int32, 0 = none) and component stats.
function label(mask, W, H) {
  const labels = new Int32Array(W * H), comps = [null];
  const stack = new Int32Array(W * H);
  let n = 0;
  for (let i0 = 0; i0 < W * H; i0++) {
    if (!mask[i0] || labels[i0]) continue;
    n++; let sp = 0; stack[sp++] = i0; labels[i0] = n;
    let x0 = W, y0 = H, x1 = -1, y1 = -1, area = 0;
    while (sp) {
      const i = stack[--sp], x = i % W, y = (i - x) / W; area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx; if (mask[j] && !labels[j]) { labels[j] = n; stack[sp++] = j; } } }
    }
    comps.push({ id: n, x0, y0, x1, y1, area });
  }
  return { labels, comps };
}

/* ---------- pull-push inpainting: fills masked pixels from their surroundings, smooth and fast ---------- */
function inpaint(R, G, B, mask, W, H) {
  const levels = [];
  let w = W, h = H;
  let cr = new Float32Array(w * h), cg = new Float32Array(w * h), cb = new Float32Array(w * h), cw = new Float32Array(w * h);
  let holes = 0;
  for (let i = 0; i < w * h; i++) { if (mask[i]) { holes++; } else { cr[i] = R[i]; cg[i] = G[i]; cb[i] = B[i]; cw[i] = 1; } }
  if (!holes) return;
  levels.push({ w, h, cr, cg, cb, cw });
  while (w > 1 || h > 1) {
    const nw = Math.max(1, (w + 1) >> 1), nh = Math.max(1, (h + 1) >> 1);
    const r2 = new Float32Array(nw * nh), g2 = new Float32Array(nw * nh), b2 = new Float32Array(nw * nh), w2 = new Float32Array(nw * nh);
    let empty = 0;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let sr = 0, sg = 0, sb = 0, sw = 0;
      for (let dy = 0; dy < 2; dy++) { const yy = y * 2 + dy; if (yy >= h) continue; for (let dx = 0; dx < 2; dx++) { const xx = x * 2 + dx; if (xx >= w) continue; const i = yy * w + xx, ww = cw[i]; if (ww > 0) { sr += cr[i] * ww; sg += cg[i] * ww; sb += cb[i] * ww; sw += ww; } } }
      const o = y * nw + x;
      if (sw > 0) { r2[o] = sr / sw; g2[o] = sg / sw; b2[o] = sb / sw; w2[o] = Math.min(1, sw); } else empty++;
    }
    w = nw; h = nh; cr = r2; cg = g2; cb = b2; cw = w2;
    levels.push({ w, h, cr, cg, cb, cw });
    if (!empty && levels.length > 3) break;
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const f = levels[l], c = levels[l + 1];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const i = y * f.w + x; if (f.cw[i] >= 1) continue;
      // bilinear sample of the coarser level
      const fx = (x + 0.5) / 2 - 0.5, fy = (y + 0.5) / 2 - 0.5;
      const x0 = clamp(Math.floor(fx), 0, c.w - 1), y0 = clamp(Math.floor(fy), 0, c.h - 1), x1 = Math.min(c.w - 1, x0 + 1), y1 = Math.min(c.h - 1, y0 + 1);
      const tx = clamp(fx - x0, 0, 1), ty = clamp(fy - y0, 0, 1);
      let sr = 0, sg = 0, sb = 0, sw = 0;
      const acc = (xx, yy, wt) => { const j = yy * c.w + xx, ww = c.cw[j] * wt; if (ww > 0) { sr += c.cr[j] * ww; sg += c.cg[j] * ww; sb += c.cb[j] * ww; sw += ww; } };
      acc(x0, y0, (1 - tx) * (1 - ty)); acc(x1, y0, tx * (1 - ty)); acc(x0, y1, (1 - tx) * ty); acc(x1, y1, tx * ty);
      if (sw <= 0) { const j = y0 * c.w + x0; sr = c.cr[j]; sg = c.cg[j]; sb = c.cb[j]; sw = 1; }
      const fw = f.cw[i], inv = 1 / sw;
      f.cr[i] = f.cr[i] * fw + sr * inv * (1 - fw); f.cg[i] = f.cg[i] * fw + sg * inv * (1 - fw); f.cb[i] = f.cb[i] * fw + sb * inv * (1 - fw); f.cw[i] = 1;
    }
  }
  const f = levels[0];
  for (let i = 0; i < W * H; i++) if (mask[i]) { R[i] = f.cr[i]; G[i] = f.cg[i]; B[i] = f.cb[i]; }
}

/* ---------- text: per-word mask, colour, ink box (nothing is committed until the line is accepted) ---------- */
function analyseWord(R, G, B, W, H, wd) {
  // generous sideways (OCR boxes clip italics and tracking), tight vertically (tightly leaded lines touch their neighbours)
  const hgt = wd.y1 - wd.y0, pad = Math.max(2, Math.round(hgt * 0.14)), vpad = Math.max(1, Math.round(hgt * 0.04));
  const x0 = clamp(wd.x0 - pad, 0, W - 1), y0 = clamp(wd.y0 - vpad, 0, H - 1), x1 = clamp(wd.x1 + pad, 0, W - 1), y1 = clamp(wd.y1 + vpad, 0, H - 1);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // background: median of a ring just outside the padded box
  const rr = [], rg = [], rb = [], ring = 2;
  for (let y = y0 - ring; y <= y1 + ring; y++) { if (y < 0 || y >= H) continue; const edgeRow = y < y0 || y > y1; for (let x = x0 - ring; x <= x1 + ring; x++) { if (x < 0 || x >= W) continue; if (edgeRow || x < x0 || x > x1) { const i = y * W + x; rr.push(R[i]); rg.push(G[i]); rb.push(B[i]); } } }
  const bg = [median(rr), median(rg), median(rb)];
  let spread = 0; for (let i = 0; i < rr.length; i++) spread += maxDiff(rr[i], rg[i], rb[i], bg); spread /= Math.max(1, rr.length);
  // Otsu threshold on distance-to-background inside the box
  const dist = new Uint8Array(bw * bh), hist = new Uint32Array(256);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = (y0 + y) * W + x0 + x, d = maxDiff(R[i], G[i], B[i], bg); dist[y * bw + x] = d; hist[d]++; }
  const n = bw * bh; let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 40;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; thr = t; } }
  thr = clamp(thr, spread > 10 ? 36 : 18, 120);
  // rows that hold ink; keep the main band (the text line) plus small satellites (dots, accents, commas)
  const rows = new Uint32Array(bh); let cnt = 0;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (dist[y * bw + x] > thr) { rows[y]++; cnt++; }
  if (cnt < 4) return { ok: false, bg, spread, coverage: 0 };
  const bands = []; let cur = null;
  for (let y = 0; y < bh; y++) { if (rows[y]) { if (!cur) { cur = { a: y, b: y, mass: 0 }; bands.push(cur); } cur.b = y; cur.mass += rows[y]; } else cur = null; }
  let main = bands[0]; for (const bd of bands) if (bd.mass > main.mass) main = bd;
  let ya = main.a, yb = main.b; const mh = main.b - main.a + 1;
  for (const bd of bands) { if (bd === main) continue; const gap = bd.a > main.b ? bd.a - main.b : main.a - bd.b; if (gap <= Math.max(2, mh * 0.3) && bd.mass < main.mass * 0.35 && (bd.b - bd.a + 1) < mh * 0.6) { ya = Math.min(ya, bd.a); yb = Math.max(yb, bd.b); } }
  let ix0 = bw, ix1 = -1, kept = 0; const ds = [];
  for (let y = ya; y <= yb; y++) for (let x = 0; x < bw; x++) { const d = dist[y * bw + x]; if (d > thr) { kept++; ds.push(d); if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; } }
  const coverage = kept / Math.max(1, (yb - ya + 1) * (ix1 - ix0 + 1));
  if (kept < 4 || coverage < 0.04 || coverage > 0.78) return { ok: false, bg, spread, coverage };
  ds.sort((p, q) => p - q); const strong = ds[Math.floor(ds.length * 0.5)];
  const tr = [], tg = [], tb = [], runs = [];
  for (let y = ya; y <= yb; y++) { let run = 0; for (let x = ix0; x <= ix1 + 1; x++) { const d = x <= ix1 ? dist[y * bw + x] : 0; if (d > thr) { run++; if (d >= strong) { const i = (y0 + y) * W + x0 + x; tr.push(R[i]); tg.push(G[i]); tb.push(B[i]); } } else if (run) { runs.push(run); run = 0; } } }
  return { ok: true, bg, spread, coverage, thr, color: [median(tr), median(tg), median(tb)], ink: { x0: x0 + ix0, y0: y0 + ya, x1: x0 + ix1 + 1, y1: y0 + yb + 1 }, stroke: median(runs), box: { x0, y0, bw, bh, ya, yb }, dist };
}
function commitWord(a, W, H, textMask, softMask) {
  const { x0, y0, bw, ya, yb } = a.box, soft = Math.max(7, a.thr * 0.3), ext = Math.max(2, Math.round((yb - ya + 1) * 0.12));
  for (let y = Math.max(0, ya - ext); y <= Math.min(a.box.bh - 1, yb + ext); y++) for (let x = 0; x < bw; x++) { const d = a.dist[y * bw + x], i = (y0 + y) * W + x0 + x; if (d > a.thr && y >= ya && y <= yb) textMask[i] = 1; else if (d > soft) softMask[i] = 1; }
}

/* ---------- background model ---------- */
function polyTerms(x, y) { return [1, x, y, x * x, x * y, y * y, x * x * x, x * x * y, x * y * y, y * y * y]; }
function solve(A, b) { // Gaussian elimination, A is n×n (array of arrays), b length n
  const n = b.length; for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]]; const d = A[i][i] || 1e-9; for (let r = i + 1; r < n; r++) { const f = A[r][i] / d; if (!f) continue; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / (A[i][i] || 1e-9); } return x;
}
function fitBackground(R, G, B, W, H) {
  // 1. smooth pixels: small local gradient on the blurred plate
  const N = W * H, smooth = new Uint8Array(N), tl = 5;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; const gx = Math.max(Math.abs(R[i + 1] - R[i - 1]), Math.abs(G[i + 1] - G[i - 1]), Math.abs(B[i + 1] - B[i - 1])), gy = Math.max(Math.abs(R[i + W] - R[i - W]), Math.abs(G[i + W] - G[i - W]), Math.abs(B[i + W] - B[i - W])); if (gx <= tl && gy <= tl) smooth[i] = 1; }
  const { labels, comps } = label(smooth, W, H);
  let core = null; for (let k = 1; k < comps.length; k++) if (!core || comps[k].area > core.area) core = comps[k];
  if (!core || core.area < N * 0.16) return { mode: "photo", coreShare: core ? core.area / N : 0 };
  // 2. solid? histogram of the core at 4 bits per channel
  const hist = new Uint32Array(4096);
  for (let i = 0; i < N; i++) if (labels[i] === core.id) hist[((R[i] >> 4) << 8) | ((G[i] >> 4) << 4) | (B[i] >> 4)]++;
  let top = 0; for (let k = 1; k < 4096; k++) if (hist[k] > hist[top]) top = k;
  const c0 = [((top >> 8) & 15) * 16 + 8, ((top >> 4) & 15) * 16 + 8, (top & 15) * 16 + 8];
  let sr = 0, sg = 0, sb = 0, sn = 0; for (let i = 0; i < N; i += 3) if (labels[i] === core.id && maxDiff(R[i], G[i], B[i], c0) <= 12) { sr += R[i]; sg += G[i]; sb += B[i]; sn++; }
  const solid = [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
  let within = 0, total = 0; for (let i = 0; i < N; i += 3) if (labels[i] === core.id) { total++; if (maxDiff(R[i], G[i], B[i], solid) <= 5) within++; }
  if (within / total >= 0.9) return { mode: "solid", color: solid, coreShare: core.area / N, T: 9, at: () => solid };
  // 3. smooth gradient: robust cubic surface per channel fitted on the core
  const step = Math.max(2, Math.round(Math.sqrt(core.area / 6000)));
  let pts = []; for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) { const i = y * W + x; if (labels[i] === core.id) pts.push(i); }
  let coef = null;
  for (let iter = 0; iter < 4; iter++) {
    const A = [0, 1, 2].map(() => Array.from({ length: 10 }, () => new Array(10).fill(0))), bv = [0, 1, 2].map(() => new Array(10).fill(0));
    for (const i of pts) { const x = (i % W) / W, y = ((i / W) | 0) / H, t = polyTerms(x, y), v = [R[i], G[i], B[i]]; for (let a = 0; a < 10; a++) { for (let c = 0; c < 3; c++) bv[c][a] += t[a] * v[c]; for (let b2 = 0; b2 < 10; b2++) { const p = t[a] * t[b2]; A[0][a][b2] += p; A[1][a][b2] += p; A[2][a][b2] += p; } } }
    coef = [0, 1, 2].map((c) => solve(A[c], bv[c]));
    const res = pts.map((i) => { const x = (i % W) / W, y = ((i / W) | 0) / H, t = polyTerms(x, y); let m = 0; for (let c = 0; c < 3; c++) { let v = 0; for (let a = 0; a < 10; a++) v += coef[c][a] * t[a]; m = Math.max(m, Math.abs(v - [R[i], G[i], B[i]][c])); } return m; });
    const sorted = res.slice().sort((a, b) => a - b), cut = Math.max(4, sorted[Math.floor(sorted.length * 0.8)] * 1.5);
    const kept = pts.filter((_, k) => res[k] <= cut); if (kept.length < pts.length * 0.5) break; pts = kept;
    if (iter === 3) { const rms = Math.sqrt(res.reduce((s, v) => s + v * v, 0) / res.length); if (rms > 9) coef = null; }
  }
  if (!coef) return { mode: "complex", coreShare: core.area / N, coreLabels: labels, coreId: core.id };
  const at = (x, y) => { const t = polyTerms(x / W, y / H), out = [0, 0, 0]; for (let c = 0; c < 3; c++) { let v = 0; for (let a = 0; a < 10; a++) v += coef[c][a] * t[a]; out[c] = v; } return out; };
  return { mode: "gradient", coreShare: core.area / N, T: 14, at };
}

/* ---------- element classification (recursive) ---------- */
function dominantColour(R, G, B, idx) {
  const hist = new Map();
  for (let k = 0; k < idx.length; k += 1) { const i = idx[k], key = ((R[i] >> 3) << 10) | ((G[i] >> 3) << 5) | (B[i] >> 3); hist.set(key, (hist.get(key) || 0) + 1); }
  let top = 0, tc = -1; for (const [k, c] of hist) if (c > tc) { tc = c; top = k; }
  const c0 = [((top >> 10) & 31) * 8 + 4, ((top >> 5) & 31) * 8 + 4, (top & 31) * 8 + 4];
  let sr = 0, sg = 0, sb = 0, sn = 0; for (const i of idx) if (maxDiff(R[i], G[i], B[i], c0) <= 10) { sr += R[i]; sg += G[i]; sb += B[i]; sn++; }
  const col = sn ? [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)] : c0;
  let within = 0; for (const i of idx) if (maxDiff(R[i], G[i], B[i], col) <= 12) within++;
  return { color: col, share: within / Math.max(1, idx.length) };
}

// True colour, thickness and centre of a thin stroke, measured on the sharp plate (blurring dilutes 1-pixel lines).
function thinColour(ctx, idx, x0, y0, x1, y1) {
  const { W, H, R0, G0, B0 } = ctx, horiz = (x1 - x0) >= (y1 - y0);
  // local background: median just outside the box
  const br = [], bgc = [], bb = []; const push = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; br.push(R0[i]); bgc.push(G0[i]); bb.push(B0[i]); };
  if (horiz) { for (let x = x0; x <= x1; x += 2) { push(x, y0 - 3); push(x, y1 + 3); } } else { for (let y = y0; y <= y1; y += 2) { push(x0 - 3, y); push(x1 + 3, y); } }
  const bg = [median(br), median(bgc), median(bb)];
  const ds = idx.map((i) => maxDiff(R0[i], G0[i], B0[i], bg)).sort((a, b) => a - b), strong = ds[Math.floor(ds.length * 0.8)] || 1;
  const cr = [], cg = [], cb = []; let sum = 0, mom = 0;
  for (const i of idx) { const d = maxDiff(R0[i], G0[i], B0[i], bg); if (d >= strong) { cr.push(R0[i]); cg.push(G0[i]); cb.push(B0[i]); } const pos = horiz ? ((i / W) | 0) : i % W; sum += d; mom += d * (pos + 0.5); }
  const len = horiz ? x1 - x0 + 1 : y1 - y0 + 1;
  return { color: [median(cr), median(cg), median(cb)], thickness: Math.max(1, Math.round(sum / Math.max(1, strong) / len)), centre: sum ? mom / sum : (horiz ? (y0 + y1 + 1) / 2 : (x0 + x1 + 1) / 2) };
}

// Corner radius of a filled rectangle from the empty area in its corners. All four corners must agree,
// otherwise the gaps are damage (a removed label, a crossing line) rather than rounding.
function cornerRadius(on, x0, y0, x1, y1) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, q = Math.max(2, Math.min(Math.floor(Math.min(w, h) / 2), 60)), e = [0, 0, 0, 0];
  // per corner: the empty area connected to the corner pixel itself (holes elsewhere in the quadrant do not count)
  const at = [(dx, dy) => on(x0 + dx, y0 + dy), (dx, dy) => on(x1 - dx, y0 + dy), (dx, dy) => on(x0 + dx, y1 - dy), (dx, dy) => on(x1 - dx, y1 - dy)];
  for (let c = 0; c < 4; c++) { if (at[c](0, 0)) continue; const seen = new Uint8Array(q * q), st = [0]; seen[0] = 1; let n = 0;
    while (st.length) { const v = st.pop(), dx = v % q, dy = (v / q) | 0; n++; for (const [ax, ay] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const nx = dx + ax, ny = dy + ay; if (nx < 0 || ny < 0 || nx >= q || ny >= q || seen[ny * q + nx]) continue; seen[ny * q + nx] = 1; if (!at[c](nx, ny)) st.push(ny * q + nx); } }
    e[c] = n; }
  const lo = Math.min(...e), hi = Math.max(...e); if (lo < 3 || lo < hi * 0.55) return 0;
  const r = Math.sqrt((e[0] + e[1] + e[2] + e[3]) / 4 / 0.2146); return r < 2.5 ? 0 : Math.round(Math.min(r, Math.min(w, h) / 2));
}

// Splits a multi-coloured group (a chart, a diagram) into flat-coloured rectangles and ellipses plus a remainder.
// Regions grow only through "interior" pixels (uniform 5×5 neighbourhood), so thin antialiased bridges such as an
// axis line touching every bar do not weld separate shapes together. Returns true when it emitted shapes.
function decompose(ctx, idx, box, depth, parent, out) {
  const { W, H, R, G, B, opt } = ctx, bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1, E = 2;
  const inGroup = new Uint8Array(bw * bh); for (const i of idx) inGroup[(((i / W) | 0) - box.y0) * bw + (i % W) - box.x0] = 1;
  const interior = new Uint8Array(bw * bh); let nInterior = 0;
  for (let y = E; y < bh - E; y++) for (let x = E; x < bw - E; x++) { const l = y * bw + x; if (!inGroup[l]) continue; const gi = (box.y0 + y) * W + box.x0 + x, r = R[gi], g = G[gi], b = B[gi]; let ok = true;
    for (let dy = -E; dy <= E && ok; dy += E) for (let dx = -E; dx <= E; dx += E) { const ll = l + dy * bw + dx; if (!inGroup[ll]) { ok = false; break; } const gj = gi + dy * W + dx; if (Math.abs(R[gj] - r) > 9 || Math.abs(G[gj] - g) > 9 || Math.abs(B[gj] - b) > 9) { ok = false; break; } }
    if (ok) { interior[l] = 1; nInterior++; } }
  if (opt.debug) console.log("decompose", JSON.stringify({ box, n: idx.length, interior: nInterior }));
  if (nInterior < idx.length * 0.4) return false;                                    // textured: a photograph, keep it whole
  const lab = new Int32Array(bw * bh), stack = new Int32Array(nInterior), regions = [];
  for (let l0 = 0; l0 < bw * bh; l0++) {
    if (!interior[l0] || lab[l0]) continue;
    const id = regions.length + 1, g0 = (box.y0 + ((l0 / bw) | 0)) * W + box.x0 + (l0 % bw), seed = [R[g0], G[g0], B[g0]];
    let sp = 0, area = 0, x0 = bw, y0 = bh, x1 = -1, y1 = -1; stack[sp++] = l0; lab[l0] = id;
    while (sp) { const l = stack[--sp], x = l % bw, y = (l / bw) | 0; area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let k = 0; k < 4; k++) { const xx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), yy = y + (k === 2 ? 1 : k === 3 ? -1 : 0); if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue; const ll = yy * bw + xx; if (!interior[ll] || lab[ll]) continue; const gj = (box.y0 + yy) * W + box.x0 + xx; if (maxDiff(R[gj], G[gj], B[gj], seed) <= 12) { lab[ll] = id; stack[sp++] = ll; } } }
    regions.push({ id, area, x0, y0, x1, y1, seed });
  }
  const minA = Math.max(opt.minArea * 5, 80), shapes = [];
  for (const r of regions) { const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1; if (r.area < minA || w < 6 || h < 6) continue; const f = r.area / (w * h); if (f >= 0.9) shapes.push({ r, shape: "rect" }); else if (Math.abs(f - 0.785) < 0.045 && w > 12 && h > 12) shapes.push({ r, shape: "ellipse" }); }
  if (!shapes.length) return false;
  // a bar crossed by a gridline arrives as two regions: rejoin same-coloured rectangles that share their edges
  for (let m = true; m;) { m = false; outer: for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) { const A = shapes[i].r, Bq = shapes[j].r; if (shapes[i].shape !== "rect" || shapes[j].shape !== "rect" || maxDiff(A.seed[0], A.seed[1], A.seed[2], Bq.seed) > 10) continue;
      const vert = Math.abs(A.x0 - Bq.x0) <= 2 && Math.abs(A.x1 - Bq.x1) <= 2 && Math.max(A.y0, Bq.y0) - Math.min(A.y1, Bq.y1) <= 9, horiz = Math.abs(A.y0 - Bq.y0) <= 2 && Math.abs(A.y1 - Bq.y1) <= 2 && Math.max(A.x0, Bq.x0) - Math.min(A.x1, Bq.x1) <= 9;
      if (!(vert || horiz)) continue;
      for (let y = Bq.y0; y <= Bq.y1; y++) for (let x = Bq.x0; x <= Bq.x1; x++) if (lab[y * bw + x] === Bq.id) lab[y * bw + x] = A.id;
      A.x0 = Math.min(A.x0, Bq.x0); A.y0 = Math.min(A.y0, Bq.y0); A.x1 = Math.max(A.x1, Bq.x1); A.y1 = Math.max(A.y1, Bq.y1); A.area += Bq.area; shapes.splice(j, 1); m = true; break outer; } }
  const covered = shapes.reduce((a, s) => a + s.r.area, 0); if (covered < idx.length * 0.2) return false;
  const taken = new Uint8Array(bw * bh);
  for (const s of shapes) {
    const r = s.r, col = r.seed;
    // grow the eroded region back to its true extent: neighbours of the same colour within the erosion margin
    const X0 = Math.max(0, r.x0 - E - 1), Y0 = Math.max(0, r.y0 - E - 1), X1 = Math.min(bw - 1, r.x1 + E + 1), Y1 = Math.min(bh - 1, r.y1 + E + 1);
    let fx0 = bw, fy0 = bh, fx1 = -1, fy1 = -1, sr = 0, sg = 0, sb = 0, sn = 0; const gidx = [];
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const l = y * bw + x; if (!inGroup[l] || taken[l]) continue; const gi = (box.y0 + y) * W + box.x0 + x; const mine = lab[l] === r.id, ring = x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1, near = !lab[l] && (ring || maxDiff(R[gi], G[gi], B[gi], col) <= 26); if (!(mine || near)) continue; taken[l] = 1; gidx.push(gi); if (mine) { sr += R[gi]; sg += G[gi]; sb += B[gi]; sn++; } if (mine || maxDiff(R[gi], G[gi], B[gi], col) <= 12) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; if (y < fy0) fy0 = y; if (y > fy1) fy1 = y; } }
    const w = fx1 - fx0 + 1, h = fy1 - fy0 + 1;
    let radius = 0; if (s.shape === "rect") radius = cornerRadius((x, y) => taken[(y - box.y0) * bw + (x - box.x0)] === 1, box.x0 + fx0, box.y0 + fy0, box.x0 + fx1, box.y0 + fy1);
    out.push({ depth, parent, kind: "shape", shape: s.shape, x: box.x0 + fx0, y: box.y0 + fy0, w, h, area: r.area, fill: [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)], radius: Math.round(radius), idx: gidx });
    // whatever sits on the shape (other colours inside its box) is segmented as its children
    const me = out.length - 1, child = new Uint8Array(W * H); let cc = 0;
    for (let y = fy0 + 1; y < fy1; y++) for (let x = fx0 + 1; x < fx1; x++) { const l = y * bw + x; if (inGroup[l] && !taken[l]) { taken[l] = 1; child[(box.y0 + y) * W + box.x0 + x] = 1; cc++; } }
    if (cc > opt.minArea && depth < opt.maxDepth) segment(ctx, child, { x0: box.x0 + fx0, y0: box.y0 + fy0, x1: box.x0 + fx1, y1: box.y0 + fy1 }, depth + 1, me, out);
    else if (cc) { for (let y = fy0 + 1; y < fy1; y++) for (let x = fx0 + 1; x < fx1; x++) { const gi = (box.y0 + y) * W + box.x0 + x; if (child[gi]) out[me].idx.push(gi); } }
  }
  // the rest of the group (connectors, axes, labels that were not read) is segmented again without further splitting
  const rest = new Uint8Array(W * H); let rc = 0;
  for (const i of idx) { const l = (((i / W) | 0) - box.y0) * bw + (i % W) - box.x0; if (!taken[l]) { rest[i] = 1; rc++; } }
  if (rc > opt.minArea) segment({ ...ctx, noSplit: true }, rest, box, depth, parent, out);
  return true;
}

function segment(ctx, mask, region, depth, parent, out) {
  // mask: Uint8 W×H of foreground pixels within `region`; groups nearby fragments, then classifies each group.
  const { W, H, R, G, B, opt } = ctx;
  const g = Math.max(1, Math.round(opt.group * (depth ? 0.6 : 1)));
  const grouped = dilateBox(mask, W, H, g);
  const { labels, comps } = label(grouped, W, H);
  const lists = comps.map(() => []);
  for (let y = region.y0; y <= region.y1; y++) for (let x = region.x0; x <= region.x1; x++) { const i = y * W + x; if (mask[i]) lists[labels[i]].push(i); }
  for (let k = 1; k < comps.length; k++) {
    const idx = lists[k]; if (!idx || idx.length < 3) continue;
    let x0 = W, y0 = H, x1 = -1, y1 = -1; for (const i of idx) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, area = idx.length;
    if (Math.max(w, h) < opt.minSize || area < opt.minArea) continue;                 // noise stays in the plate
    if (out.length >= opt.maxElements) return;
    const dom = dominantColour(R, G, B, idx), fill = area / (w * h), thin = Math.min(w, h);
    const el = { depth, parent, x: x0, y: y0, w, h, area };
    // thin straight line (also dashed)
    if (thin <= opt.lineMax && Math.max(w, h) >= 16 && Math.max(w, h) >= thin * 5) {
      const lc = thinColour(ctx, idx, x0, y0, x1, y1), horiz = w >= h, t = Math.max(1, Math.min(thin, lc.thickness));
      const le = horiz ? { ...el, y: Math.round(lc.centre - t / 2), h: t } : { ...el, x: Math.round(lc.centre - t / 2), w: t };
      out.push({ ...le, kind: "shape", shape: "line", fill: lc.color, dashed: fill < 0.8, idx }); continue;
    }
    // outline frame: a thin ring around an empty interior (tested before the colour gate: thin strokes blur to many tones)
    { const ringW = area / (2 * (w + h)); if (fill < 0.35 && w >= 24 && h >= 24 && ringW <= Math.max(7, 0.04 * Math.min(w, h))) {
        let edge = 0; const t = Math.min(3, Math.floor(Math.min(w, h) / 4)); const any = (x, y, dx, dy) => { for (let k = 0; k <= t; k++) if (mask[(y + dy * k) * W + x + dx * k]) return 1; return 0; };
        for (let x = x0; x <= x1; x++) { edge += any(x, y0, 0, 1) + any(x, y1, 0, -1); } for (let y = y0; y <= y1; y++) { edge += any(x0, y, 1, 0) + any(x1, y, -1, 0); }
        if (edge / (2 * (w + h)) > 0.82) { const lc = thinColour(ctx, idx, x0, y0, x1, y1); out.push({ ...el, kind: "shape", shape: "outline", stroke: lc.color, strokeWidth: Math.max(1, Math.round(ringW / 1.6)), radius: cornerRadius((x, y) => { for (let yy = y0; yy <= y1; yy++) { if (mask[yy * W + x]) return yy <= y; } return false; }, x0, y0, x1, y1), idx }); continue; } } }
    if (dom.share >= 0.6 && w >= 10 && h >= 10) {
      // core = pixels of the dominant colour; its box defines the shape (excludes soft shadows and halos)
      let cx0 = W, cy0 = H, cx1 = -1, cy1 = -1, coreArea = 0; const isCore = new Uint8Array(area);
      for (let n = 0; n < area; n++) { const i = idx[n]; if (maxDiff(R[i], G[i], B[i], dom.color) <= 12) { isCore[n] = 1; coreArea++; const x = i % W, y = (i / W) | 0; if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y; } }
      const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
      // how much of the core box is covered by the group (core colour or children drawn on it)
      let inBox = 0; for (const i of idx) { const x = i % W, y = (i / W) | 0; if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) inBox++; }
      const boxFill = inBox / (cw * ch), outside = area - inBox;
      const isRect = boxFill >= 0.93, isEllipse = Math.abs(boxFill - 0.785) < 0.045 && cw > 14 && ch > 14;
      if ((isRect || isEllipse) && outside <= area * 0.35) {
        let radius = 0;
        if (isRect) radius = cornerRadius((x, y) => mask[y * W + x] === 1, cx0, cy0, cx1, cy1);
        const shapeEl = { ...el, x: cx0, y: cy0, w: cw, h: ch, kind: "shape", shape: isRect ? "rect" : "ellipse", fill: dom.color, radius: Math.round(radius), idx };
        const me = out.length; out.push(shapeEl);
        // children: pixels inside the core box that differ from the fill
        if (depth < opt.maxDepth) {
          const child = new Uint8Array(W * H); let cc = 0;
          for (let n = 0; n < area; n++) { if (isCore[n]) continue; const i = idx[n], x = i % W, y = (i / W) | 0; if (x > cx0 && x < cx1 && y > cy0 && y < cy1 && maxDiff(R[i], G[i], B[i], dom.color) > 16) { child[i] = 1; cc++; } }
          if (cc > opt.minArea) segment(ctx, child, { x0: cx0, y0: cy0, x1: cx1, y1: cy1 }, depth + 1, me, out);
        }
        continue;
      }
    }
    // charts and diagrams: flat-coloured rectangles and ellipses inside a connected group become shapes of their own
    if (!ctx.noSplit && area >= opt.minArea * 12 && decompose(ctx, idx, { x0, y0, x1, y1 }, depth, parent, out)) continue;
    // everything else is a picture: opaque rectangle when it fills its box, otherwise a cut-out with transparency
    out.push({ ...el, kind: "image", opaque: fill >= 0.86, radius: fill >= 0.86 ? cornerRadius((x, y) => mask[y * W + x] === 1, x0, y0, x1, y1) : 0, solid: dom.share >= 0.85 ? dom.color : null, idx });
  }
}

/* ---------- main ---------- */
self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "inpaint") { // fill a rectangle of a bitmap from its surroundings (used by the Lift tool)
    const { width: W, height: H, rect } = msg, src = new Uint8ClampedArray(msg.rgba), N = W * H;
    const R = new Uint8ClampedArray(N), G = new Uint8ClampedArray(N), B = new Uint8ClampedArray(N), mask = new Uint8Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) { R[i] = src[j]; G[i] = src[j + 1]; B[i] = src[j + 2]; }
    for (let y = Math.max(0, rect.y); y < Math.min(H, rect.y + rect.h); y++) for (let x = Math.max(0, rect.x); x < Math.min(W, rect.x + rect.w); x++) mask[y * W + x] = 1;
    inpaint(R, G, B, mask, W, H);
    for (let i = 0, j = 0; i < N; i++, j += 4) { src[j] = R[i]; src[j + 1] = G[i]; src[j + 2] = B[i]; }
    self.postMessage({ type: "result", id: msg.id, rgba: src.buffer }, [src.buffer]); return;
  }
  if (msg.type !== "analyze") return;
  const t0 = performance.now();
  const { width: W, height: H } = msg, src = new Uint8ClampedArray(msg.rgba), N = W * H;
  const opt = Object.assign({ detail: 1, objects: true }, msg.options || {});
  const R = new Uint8ClampedArray(N), G = new Uint8ClampedArray(N), B = new Uint8ClampedArray(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) { R[i] = src[j]; G[i] = src[j + 1]; B[i] = src[j + 2]; }
  
  // --- text: candidates arrive best-first; a line is accepted when its words look like text and it does not
  //     overlap ink that an earlier (better) candidate already claimed
  const textMask = new Uint8Array(N), softMask = new Uint8Array(N), words = [], segments = [], claimed = [];
  const claimedShare = (ink) => { const area = Math.max(1, (ink.x1 - ink.x0) * (ink.y1 - ink.y0)); let ov = 0; for (const c of claimed) { const ox = Math.min(ink.x1, c.x1) - Math.max(ink.x0, c.x0), oy = Math.min(ink.y1, c.y1) - Math.max(ink.y0, c.y0); if (ox > 0 && oy > 0) ov += ox * oy; } return ov / area; };
  for (const line of msg.lines || []) {
    const res = line.words.map((wd) => ({ wd, a: analyseWord(R, G, B, W, H, wd) }));
    const allChars = res.reduce((s2, r) => s2 + (r.wd.n || 1), 0);
    let good = res.filter((r) => r.a.ok);
    if (good.reduce((s2, r) => s2 + (r.wd.n || 1), 0) < allChars * 0.6) continue;
    if (good.length > 1) { // a short end word on a different background is an icon or badge, not part of the line
      const ref = good.slice().sort((p, q) => (q.wd.n || 1) - (p.wd.n || 1))[0].a.bg;
      while (good.length > 1 && (good[0].wd.n || 1) <= 3 && maxDiff(good[0].a.bg[0], good[0].a.bg[1], good[0].a.bg[2], ref) > 22) good.shift();
      while (good.length > 1 && (good[good.length - 1].wd.n || 1) <= 3 && maxDiff(good[good.length - 1].a.bg[0], good[good.length - 1].a.bg[1], good[good.length - 1].a.bg[2], ref) > 22) good.pop();
    }
    // word by word: ink already claimed by a better candidate is skipped, the rest of the line is still used
    good = good.filter((r) => (r.a.ink.y1 - r.a.ink.y0) >= 5 && claimedShare(r.a.ink) <= 0.3);
    if (!good.length) continue;
    const keptChars = good.reduce((s2, r) => s2 + (r.wd.n || 1), 0), spread = good.reduce((s2, r) => s2 + r.a.spread, 0) / good.length;
    if (keptChars <= 3 && spread > 12) continue;                                    // short "words" on busy pixels are photo noise
    if (keptChars < 2 && allChars > 2) continue;                                    // a stray letter left over from a duplicate line
    // contiguous runs of kept words become segments
    let seg = null;
    for (const r of good) { if (!seg || r.wd.id !== seg.last + 1) { seg = { line: line.id, words: [], last: -2 }; segments.push(seg); } seg.words.push(r.wd.id); seg.last = r.wd.id;
      claimed.push(r.a.ink); commitWord(r.a, W, H, textMask, softMask); words.push({ line: line.id, word: r.wd.id, ok: true, bg: r.a.bg, spread: r.a.spread, color: r.a.color, ink: r.a.ink, stroke: r.a.stroke }); }
  }
  // remove text: the mask plus its antialiased fringe is filled from the surroundings
  const near = dilate(textMask, W, H, 2), far = dilate(near, W, H, 3), hole = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (near[i] || (softMask[i] && far[i])) hole[i] = 1;
  inpaint(R, G, B, hole, W, H);
  const tText = performance.now();

  // --- background model and foreground mask
  const bR = boxBlur3(R, W, H), bG = boxBlur3(G, W, H), bB = boxBlur3(B, W, H);
  let bgModel = { mode: "photo" }, elements = [];
  const fg = new Uint8Array(N);
  if (opt.objects) {
    bgModel = fitBackground(bR, bG, bB, W, H);
    if (bgModel.mode === "solid") { const c = bgModel.color, T = bgModel.T; for (let i = 0; i < N; i++) if (maxDiff(bR[i], bG[i], bB[i], c) > T) fg[i] = 1; }
    else if (bgModel.mode === "gradient") { const T = bgModel.T; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, c = bgModel.at(x, y); if (maxDiff(bR[i], bG[i], bB[i], c) > T) fg[i] = 1; } }
    else if (bgModel.mode === "complex") { for (let i = 0; i < N; i++) if (bgModel.coreLabels[i] !== bgModel.coreId) fg[i] = 1; }
    // resized and compressed slides carry a light halo around dark type (and inside its counters); where the page
    // background is known, the neighbourhood of removed text is reset to it so no ghost of the old wording remains
    if (bgModel.mode === "solid" || bgModel.mode === "gradient") {
      // only text that stood on the page background itself (not on a card or a picture)
      const onBg = new Uint8Array(N);
      for (const wd of words) { const k = wd.ink, cx = Math.min(W - 1, (k.x0 + k.x1) >> 1), cy = Math.min(H - 1, (k.y0 + k.y1) >> 1), c = bgModel.mode === "solid" ? bgModel.color : bgModel.at(cx, cy); if (maxDiff(wd.bg[0], wd.bg[1], wd.bg[2], c) > 9) continue; for (let y = Math.max(0, k.y0); y < Math.min(H, k.y1); y++) for (let x = Math.max(0, k.x0); x < Math.min(W, k.x1); x++) if (textMask[y * W + x]) onBg[y * W + x] = 1; }
      const wide = dilate(onBg, W, H, Math.max(5, Math.round(Math.max(W, H) * 0.005)));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!wide[i]) continue; const c = bgModel.mode === "solid" ? bgModel.color : bgModel.at(x, y); if (maxDiff(R[i], G[i], B[i], c) <= 26) { R[i] = c[0]; G[i] = c[1]; B[i] = c[2]; bR[i] = c[0]; bG[i] = c[1]; bB[i] = c[2]; } }
    }
    if (bgModel.mode !== "photo") {
      const scale = Math.max(W, H);
      const o = { group: Math.round(scale * [0.012, 0.006, 0.0025][opt.detail]), minSize: Math.round(scale * [0.012, 0.007, 0.004][opt.detail]), minArea: Math.round(scale * [0.02, 0.012, 0.008][opt.detail]), lineMax: Math.max(3, Math.round(scale * 0.0045)), maxDepth: [1, 3, 4][opt.detail], maxElements: 220, debug: opt.debug };
      segment({ W, H, R: bR, G: bG, B: bB, R0: R, G0: G, B0: B, opt: o }, fg, { x0: 0, y0: 0, x1: W - 1, y1: H - 1 }, 0, -1, elements);
    }
  }
  // collinear line segments (an axis interrupted by the bars standing on it) become one line again
  for (let m = true; m;) { m = false; outer: for (let i = 0; i < elements.length; i++) { const A = elements[i]; if (A.shape !== "line") continue; for (let j = i + 1; j < elements.length; j++) { const Bq = elements[j]; if (Bq.shape !== "line" || maxDiff(A.fill[0], A.fill[1], A.fill[2], Bq.fill) > 22) continue; const hA = A.w >= A.h, hB = Bq.w >= Bq.h; if (hA !== hB) continue;
      const ok = hA ? Math.abs(A.y - Bq.y) <= 2 && Math.abs(A.h - Bq.h) <= 2 && Math.max(A.x, Bq.x) - Math.min(A.x + A.w, Bq.x + Bq.w) <= W * 0.09 : Math.abs(A.x - Bq.x) <= 2 && Math.abs(A.w - Bq.w) <= 2 && Math.max(A.y, Bq.y) - Math.min(A.y + A.h, Bq.y + Bq.h) <= H * 0.09;
      if (!ok || A.dashed !== Bq.dashed) continue;
      const x0 = Math.min(A.x, Bq.x), y0 = Math.min(A.y, Bq.y), x1 = Math.max(A.x + A.w, Bq.x + Bq.w), y1 = Math.max(A.y + A.h, Bq.y + Bq.h); A.x = x0; A.y = y0; A.w = x1 - x0; A.h = y1 - y0; A.idx = A.idx.concat(Bq.idx); A.depth = Math.min(A.depth, Bq.depth);
      for (const e of elements) if (e.parent === j) e.parent = i; else if (e.parent > j) e.parent--; elements.splice(j, 1); m = true; break outer; } } }
  const tSeg = performance.now();

  // --- cut pictures out of the plate
  const transfers = [], outEls = [], lifted = new Uint8Array(N);
  // a picture must not carry a copy of the shapes drawn on it (moving the shape would leave its twin behind):
  // where shapes and pictures overlap, pictures are cut from a plate with the shapes filled in from their surroundings
  let Rp = R, Gp = G, Bp = B;
  { const pics = elements.filter((e) => e.kind === "image"), shapes = elements.filter((e) => e.kind === "shape" && e.idx && e.idx.length);
    if (pics.some((p) => shapes.some((q) => q.x < p.x + p.w && q.x + q.w > p.x && q.y < p.y + p.h && q.y + q.h > p.y))) {
      const sp = new Uint8Array(N); for (const q of shapes) for (const i of q.idx) sp[i] = 1;
      Rp = R.slice(); Gp = G.slice(); Bp = B.slice(); inpaint(Rp, Gp, Bp, dilate(sp, W, H, 2), W, H);
    } }
  for (const el of elements) {
    const e = { kind: el.kind, shape: el.shape, x: el.x, y: el.y, w: el.w, h: el.h, depth: el.depth, parent: el.parent, fill: el.fill, radius: el.radius, stroke: el.stroke, strokeWidth: el.strokeWidth, dashed: el.dashed, opaque: el.opaque, imgRadius: el.kind === "image" ? el.radius || 0 : 0 };
    for (const i of el.idx) lifted[i] = 1;
    if (el.kind === "image") {
      const buf = new Uint8ClampedArray(el.w * el.h * 4);
      if (el.opaque) { // near-rectangular picture: clean rectangular (or rounded) edge instead of a ragged mask
        const rad = el.radius || 0;
        for (let y = 0; y < el.h; y++) for (let x = 0; x < el.w; x++) { const i = (el.y + y) * W + el.x + x, j = (y * el.w + x) * 4; let a = 255;
          if (rad) { const cx = x < rad ? rad : x >= el.w - rad ? el.w - rad - 1 : x, cy = y < rad ? rad : y >= el.h - rad ? el.h - rad - 1 : y, dd = Math.hypot(x - cx, y - cy); a = dd <= rad - 0.5 ? 255 : dd >= rad + 0.5 ? 0 : Math.round((rad + 0.5 - dd) * 255); }
          buf[j] = Rp[i]; buf[j + 1] = Gp[i]; buf[j + 2] = Bp[i]; buf[j + 3] = a; if (a) lifted[i] = 1; }
      } else { // irregular cut-out: the mask with interior holes filled (bright areas inside a picture are not windows)
        const m = new Uint8Array(el.w * el.h); for (const i of el.idx) { const x = (i % W) - el.x, y = ((i / W) | 0) - el.y; m[y * el.w + x] = 1; }
        const outside = new Uint8Array(el.w * el.h), st = []; const seedO = (x, y) => { const k = y * el.w + x; if (!m[k] && !outside[k]) { outside[k] = 1; st.push(k); } };
        for (let x = 0; x < el.w; x++) { seedO(x, 0); seedO(x, el.h - 1); } for (let y = 0; y < el.h; y++) { seedO(0, y); seedO(el.w - 1, y); }
        while (st.length) { const k = st.pop(), x = k % el.w, y = (k / el.w) | 0; if (x > 0) seedO(x - 1, y); if (x < el.w - 1) seedO(x + 1, y); if (y > 0) seedO(x, y - 1); if (y < el.h - 1) seedO(x, y + 1); }
        for (let k = 0; k < m.length; k++) if (!m[k] && !outside[k]) { m[k] = 1; lifted[(el.y + ((k / el.w) | 0)) * W + el.x + (k % el.w)] = 1; }
        const md = dilate(m, el.w, el.h, 1);
        for (let y = 0; y < el.h; y++) for (let x = 0; x < el.w; x++) { const k = y * el.w + x; if (!md[k]) continue; const i = (el.y + y) * W + el.x + x, j = k * 4; buf[j] = Rp[i]; buf[j + 1] = Gp[i]; buf[j + 2] = Bp[i]; buf[j + 3] = m[k] ? 255 : 150; }
      }
      e.rgba = buf.buffer; transfers.push(buf.buffer);
    }
    outEls.push(e);
  }
  // --- background plate: lifted elements are removed
  let uniform = false;
  if (elements.length) {
    const holeEl = dilate(lifted, W, H, 2);
    if (bgModel.mode === "solid") { const c = bgModel.color; let residual = 0; for (let i = 0; i < N; i++) { if (holeEl[i]) { R[i] = c[0]; G[i] = c[1]; B[i] = c[2]; } else if (maxDiff(R[i], G[i], B[i], c) > 14) residual++; } uniform = residual < N * 0.0004; }
    else inpaint(R, G, B, holeEl, W, H);
  } else if (bgModel.mode === "solid") { const c = bgModel.color; let residual = 0; for (let i = 0; i < N; i++) if (maxDiff(R[i], G[i], B[i], c) > 14) residual++; uniform = residual < N * 0.0004; }
  const plate = new Uint8ClampedArray(N * 4);
  for (let i = 0, j = 0; i < N; i++, j += 4) { plate[j] = R[i]; plate[j + 1] = G[i]; plate[j + 2] = B[i]; plate[j + 3] = 255; }
  transfers.push(plate.buffer, textMask.buffer);
  self.postMessage({ type: "result", id: msg.id, width: W, height: H, plate: plate.buffer, textMask: textMask.buffer, words, segments: segments.map((g) => ({ line: g.line, words: g.words })), elements: outEls, background: { mode: bgModel.mode, color: bgModel.color || null, uniform, coreShare: bgModel.coreShare || 0 }, timings: { text: Math.round(tText - t0), segment: Math.round(tSeg - tText), total: Math.round(performance.now() - t0) } }, transfers);
};
