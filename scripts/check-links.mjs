// Verifies every internal href/src in _site resolves to a built file. Exit 1 on any broken link.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
const root = "_site";
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") && files.push(p); } })(root);
const broken = []; let checked = 0;
for (const f of files) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/\s(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(url)) continue;
    let target = url.startsWith("/") ? join(root, url) : resolve(dirname(f), url);
    checked++;
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
    if (!existsSync(target)) broken.push(`${f} → ${url}`);
  }
}
console.log(`Checked ${checked} internal links in ${files.length} pages.`);
if (broken.length) { console.error("Broken links:\n  " + broken.join("\n  ")); process.exit(1); }
console.log("No broken links.");
