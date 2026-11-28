import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import markdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { routes, pageUrl, itemUrl, serviceUrl, legalUrl, altUrl } from "./lib/routes.js";

const md = markdownIt({ html: true, typographer: true, linkify: false });

export default function (eleventyConfig) {
  // Static passthroughs
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/root": "/" });
  if (process.env.SITE_PREVIEW === "1") eleventyConfig.addPassthroughCopy({ "preview-assets": "assets" });
  // The in-browser deck check runs the Deck Auditor's own modules (tools/magic-layers) in the visitor's browser.
  // They expect their libraries at /vendor/…, the same paths the desktop tool serves.
  for (const f of ["pptx", "pdfdeck", "numbers", "checks", "id", "report", "titles"]) eleventyConfig.addPassthroughCopy({ [`tools/magic-layers/app/js/audit/${f}.js`]: `assets/deck-check/audit/${f}.js` });
  eleventyConfig.addPassthroughCopy({ "tools/magic-layers/app/sample/audit-sample.pptx": "assets/deck-check/sample-deck.pptx" });
  eleventyConfig.addPassthroughCopy({ "tools/magic-layers/app/js/proposals/brief.js": "assets/brief/brief-code.js" });
  // The content editor at /admin/ (Sveltia CMS), served from this site rather than a CDN
  eleventyConfig.addPassthroughCopy({ "node_modules/@sveltia/cms/dist/sveltia-cms.js": "admin/sveltia-cms.js", "node_modules/@sveltia/cms/dist/chunks/*.js": "admin/chunks" });   // the brief code, shared with Proposals → Import brief
  eleventyConfig.addPassthroughCopy({ "node_modules/jszip/dist/jszip.min.js": "vendor/jszip/jszip.min.js" });
  eleventyConfig.addPassthroughCopy({ "node_modules/pdfjs-dist/build/pdf.min.mjs": "vendor/pdfjs/pdf.min.mjs", "node_modules/pdfjs-dist/build/pdf.worker.min.mjs": "vendor/pdfjs/pdf.worker.min.mjs", "node_modules/pdfjs-dist/cmaps": "vendor/pdfjs/cmaps" });
  eleventyConfig.addWatchTarget("content/");
  eleventyConfig.addWatchTarget("site.config.json");

  // Filters: routing
  eleventyConfig.addFilter("pageUrl", (key, lang) => pageUrl(key, lang));
  eleventyConfig.addFilter("itemUrl", (type, item, lang) => itemUrl(type, item, lang));
  eleventyConfig.addFilter("serviceUrl", (service, lang) => serviceUrl(service, lang));
  eleventyConfig.addFilter("legalUrl", (key, lang) => legalUrl(key, lang));

  // Filters: content
  eleventyConfig.addFilter("md", (s) => (s ? md.render(String(s)) : ""));
  eleventyConfig.addFilter("mdInline", (s) => (s ? md.renderInline(String(s)) : ""));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  // A content object with { en, id } leaves, resolved to one language and safe to place inside a <script type="application/json"> block.
  const pick = (v, lang) => (Array.isArray(v) ? v.map((x) => pick(x, lang)) : v && typeof v === "object" ? ("en" in v && "id" in v && typeof v.en !== "object" ? v[lang] : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pick(x, lang)]))) : v);
  eleventyConfig.addFilter("jsonFor", (v, lang) => JSON.stringify(pick(v, lang)).replace(/</g, "\\u003c"));
  // Cache-busting: the stylesheet and script URLs carry a hash of their contents, so a deploy always reaches the browser.
  // Build stamp: served at /version.txt and as a <meta> tag so a deploy can be verified from any browser.
  eleventyConfig.addGlobalData("buildInfo", () => {
    let sha = process.env.COMMIT_REF || process.env.CF_PAGES_COMMIT_SHA || "";
    if (!sha) { try { sha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (e) { sha = "unknown"; } }
    return { sha: sha.slice(0, 7), date: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC", revision: "2.12" };
  });
  eleventyConfig.addGlobalData("assetVersion", () => createHash("sha1").update(readFileSync("src/assets/css/main.css")).update(readFileSync("src/assets/js/main.js")).digest("hex").slice(0, 10));
  eleventyConfig.addFilter("t", (ui, lang, key) => {
    const parts = key.split(".");
    let cur = ui[lang];
    for (const p of parts) cur = cur?.[p];
    if (cur === undefined) throw new Error(`Missing UI string "${key}" for lang "${lang}"`);
    return cur;
  });
  // Mobile copy: render the full text for desktop and a shorter variant for phones (CSS swaps them at ≤767px).
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  eleventyConfig.addFilter("mc", (full, short, html) => {
    if (!short || short === full) return html ? full : esc(full);
    const f = html ? full : esc(full), m = html ? short : esc(short);
    return `<span class="dcopy">${f}</span><span class="mcopy">${m}</span>`;
  });
  eleventyConfig.addFilter("L", (obj, lang) => {
    // Pick a localised value from {en, id} or return the value itself.
    if (obj && typeof obj === "object" && !Array.isArray(obj) && (lang in obj)) return obj[lang];
    return obj;
  });
  eleventyConfig.addFilter("date", (d, lang) => {
    const dt = new Date(d);
    return dt.toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("where", (arr, key, val) => (arr || []).filter((x) => x[key] === val));
  eleventyConfig.addFilter("whereIncludes", (arr, key, val) => (arr || []).filter((x) => Array.isArray(x[key]) && x[key].includes(val)));
  eleventyConfig.addFilter("find", (arr, key, val) => (arr || []).find((x) => x[key] === val));
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("initials", (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(""));
  eleventyConfig.addFilter("readFile", (p) => readFileSync(p, "utf8"));
  eleventyConfig.addFilter("truncate", (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; });

  eleventyConfig.addFilter("breadcrumbLd", (crumbs, baseUrl, pageUrl) => crumbs.map((c, i) => ({
    "@type": "ListItem", position: i + 1, name: c.name, item: (baseUrl || "") + (c.url || pageUrl),
  })));
  eleventyConfig.addFilter("first", (arr) => (Array.isArray(arr) ? arr[0] : arr));
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));
  // Wrap the last n words of a plain-text title in <em> (gold emphasis in headings)
  eleventyConfig.addFilter("emTail", (s, n) => { const w = String(s || "").split(" "); n = Math.min(Math.max(1, Number(n) || 1), w.length - 1 || 1); const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;"); return w.length < 2 ? esc(s) : `${esc(w.slice(0, -n).join(" "))} <em>${esc(w.slice(-n).join(" "))}</em>`; });

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  eleventyConfig.setServerOptions({ showAllHosts: false });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "md", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
