// Draws a page (or a single layer) onto a canvas. Used for thumbnails, the before/after check and PNG, SVG and PSD export.
import { fontString, baselineOffset, cssFamily } from "./fonts.js";

export function layerRuns(l) { return l.runs && l.runs.length ? l.runs : [{ text: l.text || "", color: l.color }]; }
// Break a text layer into lines of runs. Hard breaks always apply; soft wrapping applies when layer.wrap is on.
export function layoutText(ctx, l) {
  ctx.font = fontString(l); ctx.letterSpacing = `${l.letterSpacing || 0}px`;
  const lines = [[]];
  for (const run of layerRuns(l)) { const parts = run.text.split("\n"); parts.forEach((part, i) => { if (i) lines.push([]); if (part) lines[lines.length - 1].push({ text: part, color: run.color || l.color }); }); }
  if (!l.wrap) return lines.map((runs) => ({ runs, width: runs.reduce((a, r) => a + ctx.measureText(r.text).width, 0) }));
  const out = [];
  for (const runs of lines) {
    let cur = [], width = 0;
    const push = () => { out.push({ runs: cur, width }); cur = []; width = 0; };
    for (const r of runs) for (const tok of r.text.split(/(\s+)/)) { if (!tok) continue; const w = ctx.measureText(tok).width; if (width + w > l.w + 0.5 && width > 0 && tok.trim()) push(); if (!width && !tok.trim()) continue; const last = cur[cur.length - 1]; if (last && last.color === r.color) last.text += tok; else cur.push({ text: tok, color: r.color }); width += w; }
    push();
  }
  return out;
}
export function drawLayer(ctx, l) {
  if (!l.visible) return;
  ctx.save(); ctx.globalAlpha = l.opacity ?? 1;
  if (l.type === "background") { if (l.canvas) ctx.drawImage(l.canvas, l.x, l.y, l.w, l.h); else { ctx.fillStyle = l.fill || "#fff"; ctx.fillRect(l.x, l.y, l.w, l.h); } }
  else if (l.type === "image") { if (l.canvas) ctx.drawImage(l.canvas, l.x, l.y, l.w, l.h); }
  else if (l.type === "shape") {
    ctx.beginPath();
    if (l.shape === "ellipse") ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
    else if (l.shape === "line") { if (l.dashed) { ctx.setLineDash(l.horizontal ? [l.h * 3, l.h * 2.5] : [l.w * 3, l.w * 2.5]); ctx.lineWidth = l.horizontal ? l.h : l.w; ctx.strokeStyle = l.fill; if (l.horizontal) { ctx.moveTo(l.x, l.y + l.h / 2); ctx.lineTo(l.x + l.w, l.y + l.h / 2); } else { ctx.moveTo(l.x + l.w / 2, l.y); ctx.lineTo(l.x + l.w / 2, l.y + l.h); } ctx.stroke(); ctx.restore(); return; } ctx.rect(l.x, l.y, l.w, l.h); }
    else if (l.radius) ctx.roundRect(l.x, l.y, l.w, l.h, Math.min(l.radius, l.w / 2, l.h / 2)); else ctx.rect(l.x, l.y, l.w, l.h);
    if (l.fill) { ctx.fillStyle = l.fill; ctx.fill(); }
    if (l.stroke && l.strokeWidth) { ctx.lineWidth = l.strokeWidth; ctx.strokeStyle = l.stroke; ctx.stroke(); }
  } else if (l.type === "text") {
    const lines = layoutText(ctx, l), L = (l.lineHeight || 1.2) * l.fontSize, base = baselineOffset(l), pad = l.meta?.pad ?? 0;
    ctx.textBaseline = "alphabetic";
    lines.forEach((ln, i) => { let x = l.align === "center" ? l.x + (l.w - ln.width) / 2 : l.align === "right" ? l.x + l.w - pad - ln.width : l.x + pad; const y = l.y + base + i * L; for (const r of ln.runs) { ctx.fillStyle = r.color || l.color; ctx.fillText(r.text, x, y); x += ctx.measureText(r.text).width; } });
    ctx.letterSpacing = "0px";
  }
  ctx.restore();
}
export function renderPage(page, canvas, { scale = 1, filter = null, background = true } = {}) {
  canvas.width = Math.round(page.width * scale); canvas.height = Math.round(page.height * scale);
  const ctx = canvas.getContext("2d"); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, page.width, page.height);
  for (const l of page.layers) { if (filter && !filter(l)) continue; if (!background && l.type === "background") continue; drawLayer(ctx, l); }
  return canvas;
}
export { cssFamily };
