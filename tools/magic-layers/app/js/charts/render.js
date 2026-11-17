// Chart Builder — the preview. Draws a chart spec as SVG in the house style; the same geometry rules drive the
// PowerPoint export, so what is seen here is close to (not pixel-identical with) what PowerPoint draws.
export const PALETTE = { ink: "#111111", gold: "#E1A304", goldDark: "#C09200", neutral: "#D9D2C3", grey: "#8E897D", mid: "#5F5E5C", down: "#B3402F", line: "#BDB7AA", text: "#33312E", muted: "#6B6862" };
export const SERIES = ["#111111", "#C09200", "#8E897D", "#D9D2C3", "#7A5B00", "#5F5E5C", "#EAB200", "#B9B4A8"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function formatValue(v, f = {}) { if (v == null || !Number.isFinite(v)) return ""; const d = f.decimals ?? 0, abs = Math.abs(v).toLocaleString(f.locale === "id" ? "id-ID" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); return `${v < 0 ? "−" : ""}${f.prefix || ""}${abs}${f.suffix || ""}`; }
export function autoDecimals(data) { const vs = data.series.flatMap((s) => s.values).filter((v) => v != null); if (!vs.length) return 0; const frac = (v) => { const s = String(Math.round(Math.abs(v) * 1000) / 1000).split(".")[1]; return s ? s.length : 0; }; return Math.min(2, Math.max(...vs.map(frac))); }
// Lines may start above zero when all values sit in a band well above it; bars always start at zero.
export function lineScale(data) { const vs = data.series.flatMap((x) => x.values.filter((v) => v != null)); if (!vs.length) return { min: 0, max: 1, step: 1 }; const lo = Math.min(...vs), hi = Math.max(...vs); if (lo <= 0 || lo < hi * 0.5) return niceScale(lo, hi * 1.06); const raw = (hi - lo) / 3 || hi / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw); return { min: Math.max(0, Math.floor(lo / step) * step - step), max: Math.ceil(hi / step) * step + step, step }; }
function niceScale(min, max) { if (min > 0) min = 0; if (max < 0) max = 0; if (max === min) max = min + 1; const span = max - min, raw = span / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw); return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step }; }

// Colours for each series (and each point of a single series), from the spec's highlight choice.
export function colours(spec) {
  const d = spec.data, n = d.categories.length, single = d.series.length === 1, h = spec.highlight || { kind: "none" };
  if (spec.type === "pie") { const order = d.series[0] ? d.series[0].values.map((v, i) => i) : []; const idx = h.kind === "max" ? order.reduce((b, i) => ((d.series[0].values[i] ?? -Infinity) > (d.series[0].values[b] ?? -Infinity) ? i : b), 0) : h.kind === "last" ? n - 1 : h.kind === "category" ? h.index : -1; const greys = ["#111111", "#5F5E5C", "#8E897D", "#B9B4A8", "#D9D2C3", "#EEE7DA"]; let k = 0; return { points: order.map((i) => (i === idx ? PALETTE.gold : greys[k++ % greys.length])), series: [PALETTE.ink] }; }
  if (single && spec.type !== "line") { const v = d.series[0].values; const idx = h.kind === "last" ? n - 1 : h.kind === "max" ? v.reduce((b, x, i) => ((x ?? -Infinity) > (v[b] ?? -Infinity) ? i : b), 0) : h.kind === "category" ? h.index : -1; return { points: v.map((_, i) => (idx < 0 ? PALETTE.ink : i === idx ? PALETTE.gold : PALETTE.neutral)), series: [idx < 0 ? PALETTE.ink : PALETTE.neutral] }; }
  if (h.kind === "series" && d.series[h.index]) { const greys = ["#8E897D", "#B9B4A8", "#D9D2C3", "#5F5E5C", "#CFC9BC"]; let k = 0; return { series: d.series.map((_, i) => (i === h.index ? PALETTE.gold : greys[k++ % greys.length])) }; }
  return { series: d.series.map((_, i) => SERIES[i % SERIES.length]) };
}
// Waterfall: first value is the opening total, the rest are changes, then a closing total (given or computed).
export function bridge(spec) {
  const v = (spec.data.series[0] || { values: [] }).values.map((x) => x ?? 0), cats = spec.data.categories.slice(), given = Boolean(spec.lastIsTotal) && v.length >= 3;
  const deltas = v.slice(1, given ? -1 : undefined), end = v[0] + deltas.reduce((a, b) => a + b, 0), steps = [{ label: cats[0], kind: "total", from: 0, to: v[0], value: v[0] }]; let run = v[0];
  deltas.forEach((dv, i) => { steps.push({ label: cats[i + 1], kind: dv >= 0 ? "up" : "down", from: run, to: run + dv, value: dv }); run += dv; });
  steps.push({ label: given ? cats[cats.length - 1] : spec.totalLabel || "Total", kind: "total", from: 0, to: end, value: end });
  return { steps, end, stated: given ? v[v.length - 1] : null, crossesZero: steps.some((s) => Math.min(s.from, s.to) < 0) };
}
export function growthNote(spec) {
  const d = spec.data; if (!spec.growth || spec.growth === "none" || !d.series.length || spec.type === "pie" || spec.type === "waterfall") return "";
  const s = d.series.length === 1 ? d.series[0] : d.series[(spec.highlight && spec.highlight.kind === "series" && spec.highlight.index) || 0], pts = s.values.map((v, i) => [v, i]).filter(([v]) => v != null); if (pts.length < 2) return "";
  const [a, ia] = pts[0], [b, ib] = pts[pts.length - 1]; if (!a || a <= 0 && spec.growth === "cagr") return "";
  const sign = (x) => (x >= 0 ? "+" : "−") + Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: Math.abs(x) < 10 ? 1 : 0 });
  if (spec.growth === "cagr") { if (b <= 0) return ""; const r = ((b / a) ** (1 / (ib - ia)) - 1) * 100; return `CAGR ${sign(r)}% (${d.categories[ia]}–${d.categories[ib]})`; }
  if ((spec.format && spec.format.suffix === "%") || spec.growth === "points") return `${sign(b - a)} pp vs ${d.categories[ia]}`;
  return `${sign((b - a) / Math.abs(a) * 100)}% vs ${d.categories[ia]}`;
}

export function renderChart(spec, W = 960, H = 440) {
  const d = spec.data, f = { decimals: 0, ...spec.format }, col = colours(spec), n = d.categories.length, font = 'font-family="Inter, system-ui, sans-serif"';
  if (!n || !d.series.length) return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" ${font} font-size="15" fill="${PALETTE.muted}">Paste or type data to see the chart</text></svg>`;
  const out = [], legend = d.series.length > 1 && spec.type !== "pie" && spec.type !== "waterfall", top = legend ? 34 : 14, note = growthNote(spec);
  const T = (x, y, s, o = {}) => out.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${o.anchor || "middle"}" ${font} font-size="${o.size || 13}" font-weight="${o.weight || 500}" fill="${o.fill || PALETTE.text}">${esc(s)}</text>`);
  if (legend) { let x = 4; d.series.forEach((s, i) => { out.push(`<rect x="${x}" y="6" width="11" height="11" rx="2" fill="${col.series[i]}"/>`); T(x + 17, 16, s.name, { anchor: "start", size: 12.5, fill: PALETTE.muted }); x += 30 + s.name.length * 7.1; }); }
  if (note) { const w = note.length * 6.9 + 22; out.push(`<rect x="${W - w - 2}" y="2" width="${w}" height="24" rx="12" fill="#FBF3DA" stroke="${PALETTE.goldDark}"/>`); T(W - w / 2 - 2, 18.5, note, { size: 12.5, weight: 600, fill: "#7A5B00" }); }
  if (spec.type === "pie") {
    const v = d.series[0].values.map((x) => Math.max(0, x ?? 0)), sum = v.reduce((a, b) => a + b, 0) || 1, cx = W * 0.34, cy = H / 2, R = Math.min(H * 0.42, W * 0.26), r0 = spec.doughnut ? R * 0.56 : 0; let a0 = -Math.PI / 2;
    v.forEach((x, i) => { const a1 = a0 + (x / sum) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = (a, r) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`; if (x > 0) out.push(v.filter((y) => y > 0).length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col.points[i]}"/>` : `<path d="M${p(a0, R)} A${R},${R} 0 ${big} 1 ${p(a1, R)} L${p(a1, r0)} ${r0 ? `A${r0},${r0} 0 ${big} 0 ${p(a0, r0)}` : ""} Z" fill="${col.points[i]}" stroke="#fff" stroke-width="2"/>`); a0 = a1; });
    if (spec.labels !== false) { let b0 = -Math.PI / 2; v.forEach((x, i) => { const b1 = b0 + (x / sum) * Math.PI * 2, mid = (b0 + b1) / 2, rr = r0 ? (R + r0) / 2 : R * 0.62; if (b1 - b0 > 0.3) { const c = col.points[i].replace("#", ""), lum = 0.299 * parseInt(c.slice(0, 2), 16) + 0.587 * parseInt(c.slice(2, 4), 16) + 0.114 * parseInt(c.slice(4, 6), 16); T(cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr + 5, formatValue(d.series[0].values[i], f), { weight: 600, size: 14, fill: lum < 140 ? "#FFFFFF" : PALETTE.ink }); } b0 = b1; }); }
    const ly = cy - (n * 30) / 2 + 10; d.categories.forEach((c, i) => { out.push(`<rect x="${W * 0.64}" y="${ly + i * 30 - 11}" width="13" height="13" rx="2" fill="${col.points[i]}"/>`); T(W * 0.64 + 22, ly + i * 30, c, { anchor: "start", size: 14 }); T(W - 8, ly + i * 30, formatValue(d.series[0].values[i], f), { anchor: "end", size: 14, weight: 600 }); });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${out.join("")}</svg>`;
  }
  const horiz = spec.type === "bar", stacked = spec.type === "stacked" || spec.type === "stacked100", wf = spec.type === "waterfall" ? bridge(spec) : null;
  const cats = wf ? wf.steps.map((s) => s.label) : d.categories, m = cats.length;
  const share = (i) => d.series.reduce((a, s) => a + Math.abs(s.values[i] ?? 0), 0) || 1, val = (s, i) => (spec.type === "stacked100" ? ((s.values[i] ?? 0) / share(i)) * 100 : s.values[i] ?? 0);
  let lo = 0, hi = 0; if (wf) { lo = Math.min(0, ...wf.steps.map((s) => Math.min(s.from, s.to))); hi = Math.max(...wf.steps.map((s) => Math.max(s.from, s.to))); } else if (stacked) { for (let i = 0; i < m; i++) { hi = Math.max(hi, d.series.reduce((a, s) => a + Math.max(0, val(s, i)), 0)); lo = Math.min(lo, d.series.reduce((a, s) => a + Math.min(0, val(s, i)), 0)); } } else { const all = d.series.flatMap((s) => s.values.filter((v) => v != null)); hi = Math.max(0, ...all); lo = Math.min(0, ...all); }
  const sc = spec.type === "stacked100" ? { min: 0, max: 100, step: 25 } : spec.type === "line" ? lineScale(d) : niceScale(lo, hi * (spec.labels !== false ? 1.08 : 1));
  const catW = horiz ? Math.min(220, Math.max(60, Math.max(...cats.map((c) => c.length)) * 7.4)) : 0, L = horiz ? catW + 8 : 6, Rr = W - (horiz ? 56 : 6), Tt = top + (note && !legend ? 22 : 8), Bb = H - (horiz ? 8 : 34);
  const pos = (v) => (horiz ? L + ((v - sc.min) / (sc.max - sc.min)) * (Rr - L) : Bb - ((v - sc.min) / (sc.max - sc.min)) * (Bb - Tt)), band = (horiz ? Bb - Tt : Rr - L) / m, zero = pos(0);
  const rect = (i, off, wd, v0, v1, fill) => { const a = pos(Math.min(v0, v1)), b = pos(Math.max(v0, v1)), c0 = (horiz ? Tt : L) + i * band + off; out.push(horiz ? `<rect x="${a.toFixed(1)}" y="${c0.toFixed(1)}" width="${Math.max(0.5, b - a).toFixed(1)}" height="${wd.toFixed(1)}" fill="${fill}"/>` : `<rect x="${c0.toFixed(1)}" y="${b.toFixed(1)}" width="${wd.toFixed(1)}" height="${Math.max(0.5, a - b).toFixed(1)}" fill="${fill}"/>`); return { c: c0 + wd / 2, a, b }; };
  const lab = (r, v, txt, inside, fill) => { if (spec.labels === false || !txt) return; if (horiz) T(inside ? (r.a + r.b) / 2 : (v >= 0 ? r.b + 6 : r.a - 6), r.c + 4.5, txt, { anchor: inside ? "middle" : v >= 0 ? "start" : "end", weight: 600, fill }); else T(r.c, inside ? (r.a + r.b) / 2 + 4.5 : v >= 0 ? r.b - 7 : r.a + 17, txt, { weight: 600, fill }); };
  const onDark = (c) => { const h = c.replace("#", ""), l = 0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16); return l < 140 ? "#FFFFFF" : PALETTE.ink; };
  if (spec.type === "line") {
    d.series.forEach((s, si) => { const pts = s.values.map((v, i) => (v == null ? null : [L + band * (i + 0.5), pos(v), v])).filter(Boolean); out.push(`<polyline points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" fill="none" stroke="${col.series[si]}" stroke-width="${col.series[si] === PALETTE.gold || d.series.length === 1 ? 3 : 2.2}" stroke-linejoin="round"/>`); pts.forEach((p, k) => { out.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${col.series[si]}" stroke="#fff" stroke-width="1.5"/>`); if (spec.labels !== false && (d.series.length === 1 || k === pts.length - 1)) T(p[0] + (d.series.length > 1 ? 0 : 0), p[1] - 10, formatValue(p[2], f), { weight: 600 }); }); });
  } else if (wf) {
    const bw = band * 0.62; wf.steps.forEach((s, i) => { const fill = s.kind === "total" ? PALETTE.ink : s.kind === "up" ? PALETTE.goldDark : PALETTE.down, r = rect(i, (band - bw) / 2, bw, s.from, s.to, fill); lab(r, 1, (s.kind === "up" ? "+" : "") + formatValue(s.value, f), false); });
  } else if (stacked) {
    const bw = band * 0.62; for (let i = 0; i < m; i++) { let up = 0, dn = 0; d.series.forEach((s, si) => { const v = val(s, i); if (!v) return; const from = v >= 0 ? up : dn, r = rect(i, (band - bw) / 2, bw, from, from + v, col.series[si]); if (v >= 0) up += v; else dn += v; if (Math.abs(r.a - r.b) > 17) lab(r, v, formatValue(spec.type === "stacked100" ? v : s.values[i], spec.type === "stacked100" ? { decimals: 0, suffix: "%" } : f), true, onDark(col.series[si])); });
      if (spec.totals !== false && spec.type === "stacked" && spec.labels !== false && d.series.length > 1 && d.series.every((s) => s.values.every((v) => (v ?? 0) >= 0))) { const tot = d.series.reduce((a, s) => a + (s.values[i] ?? 0), 0), c = (horiz ? Tt : L) + i * band + band / 2; if (horiz) T(pos(up) + 6, c + 4.5, formatValue(tot, f), { anchor: "start", weight: 700 }); else T(c, pos(up) - 7, formatValue(tot, f), { weight: 700 }); } }
  } else {
    const k = d.series.length, group = band * 0.68, bw = group / k; d.series.forEach((s, si) => s.values.forEach((v, i) => { if (v == null) return; const r = rect(i, (band - group) / 2 + si * bw + (k > 1 ? bw * 0.06 : 0), bw * (k > 1 ? 0.88 : 1), 0, v, col.points && k === 1 ? col.points[i] : col.series[si]); lab(r, v, formatValue(v, f), false); }));
  }
  out.push(horiz ? `<line x1="${zero.toFixed(1)}" y1="${Tt}" x2="${zero.toFixed(1)}" y2="${Bb}" stroke="${PALETTE.line}"/>` : `<line x1="${L}" y1="${zero.toFixed(1)}" x2="${Rr}" y2="${zero.toFixed(1)}" stroke="${PALETTE.line}"/>`);
  cats.forEach((c, i) => { if (horiz) T(L - 10, Tt + band * (i + 0.5) + 4.5, c, { anchor: "end", fill: PALETTE.muted }); else T(L + band * (i + 0.5), H - 12, c.length > band / 6.6 ? `${c.slice(0, Math.max(3, Math.floor(band / 6.6) - 1))}…` : c, { fill: PALETTE.muted, size: 12.5 }); });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${out.join("")}</svg>`;
}
