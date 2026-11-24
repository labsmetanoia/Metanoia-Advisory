// Browser test of the free deck check, run against the built site under the site's own Content-Security-Policy.
//   npm run build && npm run test:deck-check        (needs Playwright; skipped with a note when it is not installed)
import http from "node:http";
import { createRequire } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const root = "_site", T = "tools/magic-layers/";
let chromium = null; try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("Deck check browser test skipped: Playwright is not installed."); process.exit(0); }
if (!existsSync(join(root, "en/strategic-storytelling/deck-check/index.html"))) { console.log("Deck check is switched off (tools.deckCheck), nothing to test."); process.exit(0); }
const csp = /Content-Security-Policy: (.*)/.exec(readFileSync(join(root, "_headers"), "utf8"))[1].trim();
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => { let p = join(root, decodeURIComponent(req.url.split("?")[0])); if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html"); if (!existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream", "content-security-policy": csp, "x-content-type-options": "nosniff" }); res.end(readFileSync(p)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}`;
let failed = 0; const check = (name, ok, detail = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ["--proxy-bypass-list=<-loopback>"] });
try {
  const open = async (path, w = 1280) => { const pg = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); pg.errors = []; pg.reqs = []; pg.on("console", (m) => { if (m.type() === "error") pg.errors.push(m.text()); }); pg.on("pageerror", (e) => pg.errors.push(e.message)); await pg.goto(base + path); await pg.waitForFunction(() => document.documentElement.dataset.deckCheck === "ready", null, { timeout: 20000 }); pg.on("request", (r) => pg.reqs.push({ method: r.method(), url: r.url() })); return pg; };
  const done = (pg) => pg.waitForFunction(() => !document.getElementById("dc-result").hidden || document.getElementById("dc-status").classList.contains("dc-drop__status--error"), null, { timeout: 90000 });
  const read = (pg) => pg.evaluate(() => ({ head: document.getElementById("dc-headline").textContent, counts: [...document.querySelectorAll(".dc-pillar__n strong")].map((e) => Number(e.textContent)), first: [...document.querySelectorAll(".dc-finding h4")].map((e) => e.textContent), todo: document.querySelectorAll(".dc-finding__do").length, more: document.getElementById("dc-more").textContent, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  const local = (pg) => pg.reqs.every((r) => r.method === "GET" && (r.url.startsWith(base) || r.url.startsWith("blob:")));

  let pg = await open("/en/strategic-storytelling/deck-check/"); await pg.setInputFiles("#dc-file", T + "app/sample/audit-sample.pptx"); await done(pg); let r = await read(pg);
  check("a PowerPoint is read and counted by pillar", r.counts.join() === "6,2,7" && /^5 things to fix/.test(r.head), JSON.stringify(r));
  check("three findings are shown in full, most serious first, with what to do", r.first.length === 3 && r.todo === 3 && /shown as 14% and 15%/.test(r.first[0]) && /12 more findings/.test(r.more), JSON.stringify(r.first));
  check("the file stays in the browser: nothing is sent, no other site is contacted", local(pg), JSON.stringify(pg.reqs.filter((x) => !(x.method === "GET" && (x.url.startsWith(base) || x.url.startsWith("blob:"))))));
  check("no script or policy errors", pg.errors.length === 0, pg.errors.slice(0, 2).join(" ; "));
  await pg.close();

  pg = await open("/id/storytelling-strategis/cek-dek/", 390); await pg.click("#dc-sample"); await done(pg); r = await read(pg);
  check("Indonesian page: the sample deck button works and the findings are in Indonesian", /^5 hal yang harus diperbaiki/.test(r.head) && /ditampilkan sebagai 14% dan 15%/.test(r.first[0]) && r.wide <= 0, JSON.stringify(r));
  await pg.close();

  pg = await open("/en/strategic-storytelling/deck-check/"); await pg.setInputFiles("#dc-file", T + "test/samples/credentials.pdf"); await done(pg); r = await read(pg);
  check("a PDF is read as text, without drawing its pages", /thing|Nothing|found/.test(r.head) && r.counts.length === 3 && local(pg) && pg.errors.length === 0, JSON.stringify(r) + pg.errors.join(";"));
  await pg.click("#dc-again").catch(() => {}); await pg.setInputFiles("#dc-file", { name: "old.ppt", mimeType: "application/vnd.ms-powerpoint", buffer: Buffer.from("x") }); await pg.waitForFunction(() => document.getElementById("dc-status").classList.contains("dc-drop__status--error"));
  const e1 = await pg.textContent("#dc-status"); await pg.setInputFiles("#dc-file", { name: "broken.pptx", mimeType: "application/zip", buffer: Buffer.from("not a zip") }); await pg.waitForFunction(() => /could not be read/.test(document.getElementById("dc-status").textContent));
  await pg.setInputFiles("#dc-file", T + "test/samples/flat-deck.pptx"); await pg.waitForFunction(() => /No text could be read/.test(document.getElementById("dc-status").textContent), null, { timeout: 60000 });
  check("an unsupported, a broken and a picture-only file each get a plain message", /not supported/.test(e1) && await pg.evaluate(() => document.getElementById("dc-result").hidden));
} catch (e) { check("browser run completed", false, e.message.split("\n")[0]); }
await b.close(); server.close();
console.log(failed ? `\nFAILED: ${failed}` : "\nDeck check OK."); process.exit(failed ? 1 : 0);
