// Shared helpers.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const uid = (() => { let n = 0; return (p = "l") => `${p}${Date.now().toString(36)}${(n++).toString(36)}`; })();
export const hex = (c) => "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
export const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return [0, 0, 0]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const colourDist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
export const median = (arr) => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
export function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
export function canvasFromRGBA(buf, w, h) { const c = makeCanvas(w, h); c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(buf), w, h), 0, 0); return c; }
export const canvasToBlob = (canvas, type = "image/png", q) => new Promise((res) => canvas.toBlob(res, type, q));
export async function loadImage(src) { const img = new Image(); img.decoding = "async"; img.src = src; await img.decode(); return img; }
export function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
export const fileStem = (name) => (name || "untitled").replace(/\.[a-z0-9]+$/i, "").replace(/[^\w\- ]+/g, "").trim() || "untitled";
export const escapeXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
