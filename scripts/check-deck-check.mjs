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
  // the headline checker: titles pasted as text, read by the same rule
  if (existsSync(join(root, "en/strategic-storytelling/headline-check/index.html"))) {
    const hopen = async (path, w = 1280) => { const pg = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); pg.errors = []; pg.reqs = []; pg.on("console", (m) => { if (m.type() === "error") pg.errors.push(m.text()); }); pg.on("pageerror", (e) => pg.errors.push(e.message)); await pg.goto(base + path); await pg.waitForFunction(() => document.documentElement.dataset.headlineCheck === "ready", null, { timeout: 20000 }); pg.on("request", (r) => pg.reqs.push(r.url())); return pg; };
    let pg = await hopen("/en/strategic-storytelling/headline-check/");
    await pg.fill("#hc-text", "1. FY25 board update\nExecutive summary\nEBITDA margin recovered to 14% in Q3 25\n- Revenue by segment\nMarket overview\nMarket overview\nConsumer now supplies two-fifths of revenue\nCapex plan\nThree projects take 70% of next year's capex\nNext steps"); await pg.click("#hc-form button[type=submit]");
    await pg.waitForFunction(() => !document.getElementById("hc-result").hidden);
    const h = await pg.evaluate(() => ({ head: document.getElementById("hc-headline").textContent, tags: [...document.querySelectorAll(".hc-tag")].map((e) => e.textContent).join("|"), story: document.querySelectorAll("#hc-story li").length, repeat: /Same title as 5/.test(document.getElementById("hc-list").textContent), structure: document.getElementById("hc-structure").textContent }));
    check("headline check: titles read one by one, repeats flagged, the storyline and the structure shown", h.head === "3 of 7 titles state a conclusion" && h.story === 3 && h.repeat && /FoundA page with the decision or next stepsFound/.test(h.structure), JSON.stringify(h));
    check("headline check: nothing leaves the browser, no script or policy errors", pg.reqs.length === 0 && pg.errors.length === 0, JSON.stringify([pg.reqs, pg.errors]));
    await pg.close(); pg = await hopen("/id/storytelling-strategis/cek-judul/", 390); await pg.click("#hc-example"); await pg.waitForFunction(() => !document.getElementById("hc-result").hidden);
    const hi = await pg.evaluate(() => ({ head: document.getElementById("hc-headline").textContent, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    check("headline check: the Indonesian example at phone width", /^3 dari 7 judul menyatakan kesimpulan$/.test(hi.head) && hi.wide <= 0, JSON.stringify(hi));
    await pg.close();
  }
  // the online brief and proposal acceptance
  if (existsSync(join(root, "en/contact/brief/index.html"))) {
    const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message)); pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await pg.goto(base + "/id/kontak/brief/"); await pg.waitForFunction(() => document.documentElement.dataset.brief === "ready", null, { timeout: 20000 });
    await pg.fill("#b-name", "Siti Rahma"); await pg.fill("#b-company", "PT Contoh Logistik"); await pg.fill("#b-email", "siti@contoh.test"); await pg.selectOption("#b-offer", "deckAuditQuarterly"); await pg.fill("#b-subject", "dek hasil kuartalan 2026");
    await pg.fill("#b-audience", "Analis & investor"); await pg.fill("#b-decision", "Mempertahankan rekomendasi"); await pg.check("#b-mnpi");
    const br = await pg.evaluate(async () => { const { decodeBrief } = await import("/assets/brief/brief-code.js"); const code = document.getElementById("b-code").value; return { note: !document.getElementById("b-mnpi-note").hidden, brief: decodeBrief(`brief_code: ${code}\nlanguage: id`) }; });
    check("brief: the answers travel as a brief code the Proposals tool can read, and the confidentiality note shows", br.note && br.brief.lang === "id" && br.brief.offer === "deckAuditQuarterly" && br.brief.company === "PT Contoh Logistik" && br.brief.audience === "Analis & investor" && br.brief.mnpi && br.brief.indonesian, JSON.stringify(br));
    await pg.goto(base + "/en/contact/accept/?ref=MA/P/2026/11/007"); await pg.waitForFunction(() => document.documentElement.dataset.accept === "ready", null, { timeout: 20000 });
    const ac = await pg.evaluate(() => ({ ref: document.getElementById("a-ref").value, robots: (document.querySelector("meta[name=robots]") || {}).content }));
    check("accept: the reference comes from the proposal's link and the page stays out of search", ac.ref === "MA/P/2026/11/007" && /noindex/.test(ac.robots || ""), JSON.stringify(ac));
    check("brief and accept: no script or policy errors", errs.length === 0, errs.join(" ; "));
  }
} catch (e) { check("browser run completed", false, e.message.split("\n")[0]); }
await b.close(); server.close();
console.log(failed ? `\nFAILED: ${failed}` : "\nDeck check OK."); process.exit(failed ? 1 : 0);
