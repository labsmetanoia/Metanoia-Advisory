// Font catalogue, availability detection and metric helpers shared by the analyser, the editor and the exporters.
import { makeCanvas } from "./util.js";

// Bundled faces are always available; system faces are offered only when installed on this computer.
export const BUNDLED = ["Inter", "Fraunces", "Manrope", "Cormorant Garamond"];
// Weights worth testing per family (bundled variable fonts cover a limited range; system fonts have regular and bold).
const WEIGHTS = { Inter: [400, 500, 600], Fraunces: [500, 600], Manrope: [400, 600, 700], "Cormorant Garamond": [400, 600, 700] };
export const weightsFor = (family) => WEIGHTS[family] || [400, 700];
export const allWeights = (family) => (WEIGHTS[family] ? WEIGHTS[family] : [400, 700]);
const SYSTEM = ["Arial", "Helvetica Neue", "Calibri", "Aptos", "Segoe UI", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Source Sans Pro", "Verdana", "Tahoma", "Trebuchet MS", "Century Gothic", "Gill Sans", "Georgia", "Times New Roman", "Cambria", "Garamond", "Palatino Linotype", "Book Antiqua", "Baskerville", "Playfair Display", "Merriweather", "Courier New", "Consolas"];
export const SERIF = new Set(["Fraunces", "Cormorant Garamond", "Georgia", "Times New Roman", "Cambria", "Garamond", "Palatino Linotype", "Book Antiqua", "Baskerville", "Playfair Display", "Merriweather"]);
export const generic = (family) => (SERIF.has(family) ? "serif" : /Courier|Consolas/.test(family) ? "monospace" : "sans-serif");
export const cssFamily = (family) => `"${family}", ${generic(family)}`;

const mctx = makeCanvas(8, 8).getContext("2d", { willReadFrequently: true });
let available = null;
export async function availableFonts() {
  if (available) return available;
  await Promise.all(BUNDLED.flatMap((f) => [document.fonts.load(`400 20px "${f}"`), document.fonts.load(`600 20px "${f}"`)])).catch(() => {});
  const probe = "mmmMWlli10 Qagy";
  const base = {}; for (const g of ["monospace", "serif"]) { mctx.font = `72px ${g}`; base[g] = mctx.measureText(probe).width; }
  const has = (f) => ["monospace", "serif"].some((g) => { mctx.font = `72px "${f}", ${g}`; return Math.abs(mctx.measureText(probe).width - base[g]) > 0.5; });
  available = [...BUNDLED, ...SYSTEM.filter(has)];
  return available;
}
export const fontString = (l, size = l.fontSize) => `${l.italic ? "italic " : ""}${l.fontWeight || 400} ${size}px ${cssFamily(l.fontFamily)}`;

// Line metrics for a font at a size: ascent and descent of the font box (what CSS line layout uses).
const metricCache = new Map();
export function fontMetrics(family, weight, italic) {
  const key = `${family}|${weight}|${italic ? 1 : 0}`; let m = metricCache.get(key);
  if (!m) { mctx.font = `${italic ? "italic " : ""}${weight} 100px ${cssFamily(family)}`; const t = mctx.measureText("Hxgp"); m = { ascent: (t.fontBoundingBoxAscent ?? 90) / 100, descent: (t.fontBoundingBoxDescent ?? 25) / 100 }; metricCache.set(key, m); }
  return m;
}
// Distance from the top of the first line box to its baseline, for a text layer (CSS half-leading model).
export function baselineOffset(l) { const m = fontMetrics(l.fontFamily, l.fontWeight || 400, l.italic); const L = (l.lineHeight || 1.2) * l.fontSize; return (L - (m.ascent + m.descent) * l.fontSize) / 2 + m.ascent * l.fontSize; }
export function measure(text, family, weight, italic, size, letterSpacing = 0) {
  mctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${cssFamily(family)}`; mctx.letterSpacing = `${letterSpacing}px`;
  const t = mctx.measureText(text); mctx.letterSpacing = "0px";
  return { width: t.width, left: t.actualBoundingBoxLeft, right: t.actualBoundingBoxRight, ascent: t.actualBoundingBoxAscent, descent: t.actualBoundingBoxDescent };
}
