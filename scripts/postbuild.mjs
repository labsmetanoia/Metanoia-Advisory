// Minifies the stylesheet and script in _site after Eleventy writes them (the URLs already carry a content hash).
import { transform } from "esbuild";
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
for (const [file, loader] of [["_site/assets/css/main.css", "css"], ["_site/assets/js/main.js", "js"]]) {
  const before = statSync(file).size;
  const out = await transform(readFileSync(file, "utf8"), { loader, minify: true, target: loader === "js" ? "es2017" : undefined, charset: "utf8" });
  writeFileSync(file, out.code);
  console.log(`${file}: ${(before / 1024).toFixed(0)} KB → ${(out.code.length / 1024).toFixed(0)} KB`);
}

// Hosts other than Netlify (Cloudflare Pages sets CF_PAGES): drop the redirect rules written in Netlify-only syntax
// (a forced status such as "302!", or a condition such as "Language=id"). The plain 301 rules are understood by both.
if (!process.env.NETLIFY && (process.env.CF_PAGES || process.env.REDIRECTS_PLAIN) && existsSync("_site/_redirects")) {
  const lines = readFileSync("_site/_redirects", "utf8").split("\n"), kept = lines.filter((l) => l.trim().startsWith("#") || !l.trim() || !(/\s\d{3}!/.test(l) || /\s[A-Z][a-z]+=\S+\s*$/.test(l)));
  writeFileSync("_site/_redirects", kept.join("\n"));
  console.log(`_site/_redirects: ${lines.length - kept.length} Netlify-only rule(s) removed for this host`);
}
