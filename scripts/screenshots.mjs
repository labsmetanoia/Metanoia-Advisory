// Captures desktop (1280) and mobile (390) screenshots of key templates into ./screenshots.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = createServer((req, res) => {
  let p = join("_site", decodeURIComponent(req.url.split("?")[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" }); res.end(readFileSync(p));
}).listen(0);
const port = server.address().port;
mkdirSync("screenshots", { recursive: true });
const shots = [
  ["home-en", "/en/"], ["home-id", "/id/"], ["about-en", "/en/about/"], ["hub-market-entry-en", "/en/indonesia-market-entry/"], ["hub-advisory-id", "/id/strategi-investasi/"], ["hub-presentation-en", "/en/strategic-storytelling/"],
  ["service-en", "/en/advisory/business-cases-and-investment-analysis/"], ["insights-en", "/en/insights/"], ["article-en", "/en/insights/bkpm-regulation-5-2025-mid-market-entrants/"], ["contact-id", "/id/kontak/"],
];
const route = "gold";
const browser = await chromium.launch();
for (const [name, url] of shots) {
  for (const [w, label] of [[1280, "desktop"], [390, "mobile"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${port}${url}`, { waitUntil: "load" });
    await page.evaluate((r) => { document.querySelectorAll(".fade-up").forEach((e) => e.classList.add("is-visible")); const c = document.querySelector(".consent"); c && c.classList.remove("is-open"); }, route);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/${route}-${name}-${label}.png`, fullPage: true });
    await page.close();
  }
}
await browser.close(); server.close();
console.log(`Screenshots written to ./screenshots (${route}).`);
