// Runs axe-core against representative templates on a local static server. Fails on critical/serious issues.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = join("_site", decodeURIComponent(req.url.split("?")[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" }); res.end(readFileSync(p));
}).listen(0);
const port = server.address().port;
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ["/en/", "/id/", "/en/about/", "/en/indonesia-market-entry/", "/id/storytelling-strategis/", "/en/advisory/business-cases-and-investment-analysis/", "/en/insights/", "/en/insights/bkpm-regulation-5-2025-mid-market-entrants/", "/en/contact/", "/id/kontak/", "/en/legal/privacy/", "/en/404.html"];
const browser = await chromium.launch();
let failed = false;
for (const url of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const resp = await page.goto(`http://localhost:${port}${url}`, { waitUntil: "load" });
  if (!resp || resp.status() >= 400) { console.log(`SKIP ${url} (${resp && resp.status()})`); await page.close(); continue; }
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.evaluate(() => document.querySelectorAll(".fade-up, .stagger").forEach((e) => e.classList.add("is-visible")));
  await page.waitForTimeout(1500); // let reveal transitions and the hero load sequence finish before measuring contrast
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }));
  const serious = results.violations.filter((v) => ["critical", "serious"].includes(v.impact));
  const minor = results.violations.filter((v) => !["critical", "serious"].includes(v.impact));
  console.log(`${url}: ${serious.length} critical/serious, ${minor.length} moderate/minor${consoleErrors.length ? `, ${consoleErrors.length} JS errors` : ""}`);
  for (const v of results.violations) console.log(`   [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target?.join(" ")}`);
  if (serious.length || consoleErrors.length) failed = true;
  await page.close();
}
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
