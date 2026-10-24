// Renders the 1200×630 Open Graph image per template type into src/assets/img/og/ using the design tokens.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
const tok = { paper: "#FAF8F4", ink: "#000000", accent: "#EAB200", sand: "#EEE7DA", font: "Fraunces", file: "fraunces-normal-latin.woff2" };
const fontData = readFileSync(`src/assets/fonts/${tok.file}`).toString("base64");
const interData = readFileSync("src/assets/fonts/inter-normal-latin.woff2").toString("base64");
const types = {
  default: ["Metanoia Advisory", "Turning complex ideas into compelling business outcomes."],
  home: ["Global Perspective. Proven Expertise.", "Turning complex ideas into compelling business outcomes."],
  hub: ["Practice", "Presentation design, Indonesia market entry and localization, strategy and investment advisory. Jakarta."],
  service: ["Service", "Who it is for · What you get · How long · What happens next"],
  case: ["Work", "The situation, the decision at stake, what we built, and one sourced outcome."],
  insight: ["Insights", "Finding first, then evidence, with a source under every chart."],
  person: ["People", "A senior team that builds the case, presents it, and stays through delivery."],
};
mkdirSync("src/assets/img/og", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [key, [kicker, line]] of Object.entries(types)) {
  const html = `<!doctype html><html><head><style>
  @font-face{font-family:"D";src:url(data:font/woff2;base64,${fontData}) format("woff2");font-weight:500 600}
  @font-face{font-family:"T";src:url(data:font/woff2;base64,${interData}) format("woff2");font-weight:400 600}
  body{margin:0;width:1200px;height:630px;background:${tok.paper};color:${tok.ink};font-family:"T",sans-serif;position:relative}
  .k{position:absolute;left:80px;top:80px;font-size:22px;letter-spacing:.06em;text-transform:uppercase;color:#5E6166;font-weight:500}
  .w{position:absolute;left:80px;top:130px;font-family:"D",serif;font-size:64px;font-weight:600;letter-spacing:-0.01em}
  .w span{font-family:"T";font-size:20px;letter-spacing:.08em;text-transform:uppercase;color:#5E6166;margin-left:14px;font-weight:400}
  .l{position:absolute;left:80px;right:80px;top:270px;font-family:"D",serif;font-size:${line.length > 90 ? 36 : 44}px;line-height:1.2;font-weight:500;max-width:980px}
  .r{position:absolute;left:80px;right:80px;bottom:80px;border-top:1px solid #A5A7AA;padding-top:20px;font-size:20px;color:#5E6166;display:flex;justify-content:space-between}
  .a{position:absolute;left:80px;bottom:112px;width:120px;height:6px;background:${tok.accent}} .w span,.k,.r{color:#5F5E5C}
  </style></head><body><div class="k">${kicker}</div><div class="w">Metanoia<span>Advisory</span></div><div class="l">${line}</div><div class="a"></div><div class="r"><span>Jakarta</span><span>ID / EN</span></div></body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(`src/assets/img/og/og-${key}.png`, await page.screenshot({ type: "png" }));
}
await browser.close();
console.log("OG images written to src/assets/img/og/");

// Favicon PNG fallbacks from the SVG monogram.
{
  const b = await chromium.launch();
  const svg = readFileSync("src/root/favicon.svg", "utf8");
  for (const [size, name] of [[32, "src/root/favicon-32.png"], [180, "src/root/apple-touch-icon.png"]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    writeFileSync(name, await p.screenshot({ type: "png", omitBackground: true }));
    await p.close();
  }
  await b.close();
  console.log("Favicons written.");
}
