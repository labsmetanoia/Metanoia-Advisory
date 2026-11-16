// Copies the browser libraries the app needs from node_modules into app/vendor, so the app runs offline
// with nothing but Node. Run automatically after `npm install`; safe to run again.
import { copyFileSync, cpSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  ["tesseract.js/dist/tesseract.min.js", "tesseract/tesseract.min.js"],
  ["tesseract.js/dist/worker.min.js", "tesseract/worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract/tesseract-core-simd-lstm.wasm.js"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "tessdata/eng.traineddata.gz"],
  ["@tesseract.js-data/ind/4.0.0_best_int/ind.traineddata.gz", "tessdata/ind.traineddata.gz"],
  ["pdfjs-dist/build/pdf.min.mjs", "pdfjs/pdf.min.mjs"],
  ["pdfjs-dist/build/pdf.worker.min.mjs", "pdfjs/pdf.worker.min.mjs"],
  ["pptxgenjs/dist/pptxgen.bundle.js", "pptxgen/pptxgen.bundle.js"],
  ["jszip/dist/jszip.min.js", "jszip/jszip.min.js"],
  ["ag-psd/dist/bundle.js", "ag-psd/bundle.js"],
];
let n = 0, bytes = 0;
for (const [from, to] of files) {
  const src = join(root, "node_modules", from), dst = join(root, "app", "vendor", to);
  if (!existsSync(src)) { console.warn("missing", from); continue; }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst); n++; bytes += statSync(dst).size;
}
// pdf.js reads these on demand: decoders for JPEG 2000 / JBIG2 / colour profiles, character maps and the 14 standard fonts
for (const dir of ["wasm", "cmaps", "standard_fonts", "iccs"]) {
  const src = join(root, "node_modules", "pdfjs-dist", dir), dst = join(root, "app", "vendor", "pdfjs", dir);
  if (!existsSync(src)) { console.warn("missing", `pdfjs-dist/${dir}`); continue; }
  cpSync(src, dst, { recursive: true }); for (const f of readdirSync(dst)) { n++; bytes += statSync(join(dst, f)).size; }
}
console.log(`vendor: ${n} files, ${(bytes / 1048576).toFixed(1)} MB → app/vendor`);
