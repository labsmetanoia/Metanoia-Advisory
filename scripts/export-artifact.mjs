// Exports the preview build with relative URLs so it can be hosted under any sub-path (e.g. an artifact preview).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname, relative, posix } from "node:path";
const src = "_site", out = process.argv[2] || "artifact-export";
rmSync(out, { recursive: true, force: true });
const skip = new Set(["_headers", "_redirects", "robots.txt", "sitemap.xml", "404.html", "index.html"]);
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(src);
const list = [];
for (const f of files) {
  const rel = relative(src, f);
  if (skip.has(rel)) continue;
  const dest = join(out, rel); mkdirSync(dirname(dest), { recursive: true });
  const depth = rel.split("/").length - 1;
  const prefix = depth ? "../".repeat(depth) : "./";
  if (rel.endsWith(".html")) {
    let html = readFileSync(f, "utf8");
    html = html.replace(/\s(href|src|content)="(\/(?!\/)[^"]*)"/g, (m, attr, url) => {
      if (attr === "content" && !url.startsWith("/assets/")) return m;
      const [, path, qh] = url.match(/^([^?#]*)(.*)$/);
      let p = path.replace(/^\//, ""); if (p === "" || p.endsWith("/")) p += "index.html";
      return ` ${attr}="${prefix}${p}${qh}"`;
    });
    // 404 pages link home via "/": handled above. Root-chooser redirects do not exist in these pages.
    writeFileSync(dest, html);
  } else if (rel.endsWith(".css")) {
    writeFileSync(dest, readFileSync(f, "utf8").replace(/url\("\/assets\//g, 'url("../'));
  } else copyFileSync(f, dest);
  list.push({ path: rel });
}
writeFileSync(join(out, "files.json"), JSON.stringify(list));
console.log(`${list.length} files exported to ${out}`);
