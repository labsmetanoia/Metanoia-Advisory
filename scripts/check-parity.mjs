// Bilingual parity: every page under /id/ has an /en/ alternate (and vice versa), the alternate exists,
// hreflang tags are present, lang attributes are set, and no placeholder text leaked into a production build.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const root = "_site"; const preview = process.env.SITE_PREVIEW === "1";
const pages = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") && pages.push(p); } })(root);
const errors = [];
let langPages = 0;
for (const f of pages) {
  const html = readFileSync(f, "utf8");
  const rel = "/" + f.replace(/^_site\//, "").replace(/index\.html$/, "");
  const m = rel.match(/^\/(id|en)\//);
  if (!m) continue;
  langPages++;
  const lang = m[1], other = lang === "id" ? "en" : "id";
  if (!new RegExp(`<html lang="${lang}"`).test(html)) errors.push(`${rel}: html lang is not ${lang}`);
  const alt = html.match(new RegExp(`data-lang-switch="${other}"[^>]*`)) || html.match(new RegExp(`href="([^"]+)"[^>]*hreflang="${other}"`));
  const switchHref = (html.match(new RegExp(`<a href="([^"]+)" lang="${other}" hreflang="${other}" data-lang-switch`)) || [])[1];
  if (!switchHref && !/404\.html$/.test(f)) errors.push(`${rel}: no language switch to ${other}`);
  if (switchHref) {
    const target = join(root, switchHref, switchHref.endsWith("/") ? "index.html" : "");
    if (!existsSync(target)) errors.push(`${rel}: alternate ${switchHref} does not exist`);
    if (!switchHref.startsWith(`/${other}/`)) errors.push(`${rel}: alternate ${switchHref} is not under /${other}/`);
  }
  if (!html.includes("<h1")) errors.push(`${rel}: no h1`);
  if ((html.match(/<h1[\s>]/g) || []).length > 1) errors.push(`${rel}: more than one h1`);
  if (!preview && /lorem|TBD|\[To be|xx|example\.com|Harus dilengkapi/i.test(html)) errors.push(`${rel}: placeholder text in production build`);
}
console.log(`Checked ${langPages} language pages.`);
if (errors.length) { console.error("Parity errors:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("Bilingual parity OK.");
