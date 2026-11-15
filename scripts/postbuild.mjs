// Minifies the stylesheet and script in _site after Eleventy writes them (the URLs already carry a content hash).
import { transform } from "esbuild";
import { readFileSync, writeFileSync, statSync } from "node:fs";
for (const [file, loader] of [["_site/assets/css/main.css", "css"], ["_site/assets/js/main.js", "js"]]) {
  const before = statSync(file).size;
  const out = await transform(readFileSync(file, "utf8"), { loader, minify: true, target: loader === "js" ? "es2017" : undefined, charset: "utf8" });
  writeFileSync(file, out.code);
  console.log(`${file}: ${(before / 1024).toFixed(0)} KB → ${(out.code.length / 1024).toFixed(0)} KB`);
}
