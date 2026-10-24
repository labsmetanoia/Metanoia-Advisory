import markdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { routes, pageUrl, itemUrl, serviceUrl, legalUrl, altUrl } from "./lib/routes.js";

const md = markdownIt({ html: true, typographer: true, linkify: false });

export default function (eleventyConfig) {
  // Static passthroughs
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/root": "/" });
  if (process.env.SITE_PREVIEW === "1") eleventyConfig.addPassthroughCopy({ "preview-assets": "assets" });
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
  eleventyConfig.addFilter("t", (ui, lang, key) => {
    const parts = key.split(".");
    let cur = ui[lang];
    for (const p of parts) cur = cur?.[p];
    if (cur === undefined) throw new Error(`Missing UI string "${key}" for lang "${lang}"`);
    return cur;
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

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  eleventyConfig.setServerOptions({ showAllHosts: false });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "md", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
