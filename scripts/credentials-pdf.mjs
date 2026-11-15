// Renders the firm credentials document (A4, eight pages, one PDF per language) from the site's own content files,
// using the site's design tokens and fonts. Output: src/root/downloads/metanoia-advisory-credentials-{lang}.pdf
// Run locally (Playwright is pre-installed in the development environment); commit the PDFs.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const L = (v, lang) => (v && typeof v === "object" && !Array.isArray(v) && lang in v ? v[lang] : v);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const em = (s) => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const cfg = json("site.config.json");
const home = json("content/pages/home.json"), hubs = json("content/pages/hubs.json"), about = json("content/pages/about.json"), faq = json("content/pages/faq.json"), contact = json("content/pages/contact.json");
const services = readdirSync("content/services").filter((f) => f.endsWith(".json")).map((f) => json(`content/services/${f}`)).sort((a, b) => (a.order || 0) - (b.order || 0));
const practiceNames = {
  marketEntry: { en: "Indonesia Market Entry & Localization Strategy", id: "Strategi Masuk Pasar & Lokalisasi Indonesia" },
  advisory: { en: "Strategy & Investment Advisory", id: "Advisory Strategi & Investasi" },
  presentation: { en: "Strategic Storytelling & Corporate Communications", id: "Strategic Storytelling & Komunikasi Korporat" },
};
const b64 = (p) => readFileSync(p).toString("base64");
const fonts = {
  fraunces: b64("src/assets/fonts/fraunces-normal-latin.woff2"), frauncesI: b64("src/assets/fonts/fraunces-italic-latin.woff2"), inter: b64("src/assets/fonts/inter-normal-latin.woff2"),
  cormorant: b64("src/assets/fonts/cormorant-garamond-normal-latin.woff2"), manrope: b64("src/assets/fonts/manrope-normal-latin.woff2"),
};
// Photographs are resized to print size first (sharp is not a dependency, so this uses the PIL one-liner in docs/operations-playbook.md); fall back to the site images.
import { existsSync } from "node:fs";
const IMG_DIR = process.env.PDF_IMG_DIR || "assets-src/pdf";
const img = (name) => existsSync(`${IMG_DIR}/${name}.jpg`) ? `data:image/jpeg;base64,${b64(`${IMG_DIR}/${name}.jpg`)}` : `data:image/webp;base64,${b64(`src/assets/img/photos/${name}.webp`)}`;
const photos = { cover: img("about-hero-skyline"), story: img("hero-storytelling"), me: img("adv-market-entry"), adv: img("adv-strategy"), work: img("contact-hero") };

const T = {
  en: { doc: "Firm credentials", sub: "Strategic Storytelling & Corporate Communications, with two advisory practices behind it", date: "November 2026", contents: "Contents", practices: "One firm, three practices", services: "Services", storytelling: "Strategic Storytelling & Corporate Communications: eleven services on one standard", advisory: "Advisory practices behind the story", how: "How we work with you", principles: "Three principles on every page", model: "How an engagement works", contact: "Start with a working session", page: "Page", who: "Who it is for", get: "What you get", from: "From first conversation to delivery", background: "What works in the background", email: "Email", web: "Website", languages: "Indonesian and English", footer: "Metanoia Advisory · Firm credentials" },
  id: { doc: "Kredensial firma", sub: "Strategic Storytelling & Komunikasi Korporat, dengan dua praktik advisory di belakangnya", date: "November 2026", contents: "Daftar isi", practices: "Satu firma, tiga praktik", services: "Layanan", storytelling: "Strategic Storytelling & Komunikasi Korporat: sebelas layanan dalam satu standar", advisory: "Praktik advisory di balik kisah", how: "Cara kami bekerja bersama Anda", principles: "Tiga prinsip di setiap halaman", model: "Bagaimana penugasan berjalan", contact: "Mulai dengan sesi kerja", page: "Halaman", who: "Untuk siapa", get: "Yang Anda peroleh", from: "Dari percakapan pertama hingga pengiriman", background: "Yang bekerja di latar belakang", email: "Email", web: "Situs web", languages: "Bahasa Indonesia dan Inggris", footer: "Metanoia Advisory · Kredensial firma" },
};

function page(lang, n, body, cls = "") {
  const t = T[lang];
  return `<section class="page ${cls}"><div class="page__body">${body}</div><footer class="page__foot"><span>${t.footer}</span><span>${t.page} ${n}</span></footer></section>`;
}
function build(lang) {
  const t = T[lang];
  const pres = services.filter((s) => s.practice === "presentation"), me = services.filter((s) => s.practice === "marketEntry"), adv = services.filter((s) => s.practice === "advisory");
  const svc = (s) => `<li><strong>${esc(L(s.title, lang))}</strong><span>${esc(L(s.promiseM || s.promise, lang))}</span></li>`;
  const practice = (key, photo, hub) => `<div class="practice"><img src="${photo}" alt=""><div><span class="kicker">${esc(L(hub.tagline, lang))}</span><h3>${esc(L(practiceNames[key], lang))}</h3><p>${esc(L(hub.situationLine, lang))}</p><ul class="ticks">${hub.doorBullets.map((b) => `<li>${esc(L(b, lang))}</li>`).join("")}</ul></div></div>`;
  const stages = home.approach.stages.map((s, i) => `<li><span class="num">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(L(s.title, lang))}</strong><span>${esc(L(s.text, lang))}</span></div></li>`).join("");
  const bg = home.approach.background.items.map((s) => `<li><strong>${esc(L(s.title, lang))}</strong><span>${esc(L(s.text, lang))}</span></li>`).join("");
  const faqs = faq.general.items.map((q) => `<div class="qa"><strong>${esc(L(q.q, lang))}</strong><p>${esc(L(q.a, lang))}</p></div>`).join("");
  const toc = [[t.practices, 2], [t.storytelling.split(":")[0], 3], [t.advisory, 5], [t.how, 6], [t.model, 7], [t.contact, 8]];
  const pages = [
    `<section class="page cover"><img class="cover__img" src="${photos.cover}" alt=""><div class="cover__veil"></div><div class="cover__body"><div class="lockup"><span class="lockup__name">Metanoia</span><span class="lockup__bar"></span><span class="lockup__sub">Advisory</span></div><h1>${t.doc}</h1><p class="cover__sub">${t.sub}</p><p class="cover__date">${t.date} · ${t.languages}</p></div></section>`,
    page(lang, 2, `<span class="kicker">${t.contents}</span><h2>${em(L(home.practices.title, lang))}</h2><p class="lede">${esc(L(home.practices.text, lang))}</p>
      <div class="two"><div class="principles"><span class="kicker">${t.principles}</span>${home.flagship.points.map((p, i) => `<div class="principle"><span class="num">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(L(p.title, lang))}</strong><span>${esc(L(p.text, lang))}</span></div></div>`).join("")}</div>
      <ol class="toc">${toc.map(([n, p]) => `<li><span>${esc(n)}</span><i></i><b>${p}</b></li>`).join("")}</ol></div>`),
    page(lang, 3, `<span class="kicker">${t.services} · 1/2</span><h2>${esc(L(practiceNames.presentation, lang))}</h2><p class="lede">${esc(L(hubs.presentation.hero.textM || hubs.presentation.hero.text, lang))}</p><ul class="svc">${pres.slice(0, 6).map(svc).join("")}</ul>`),
    page(lang, 4, `<span class="kicker">${t.services} · 2/2</span><h2>${esc(L(practiceNames.presentation, lang))}</h2><ul class="svc">${pres.slice(6).map(svc).join("")}</ul><div class="band"><span class="kicker">${esc(L(home.ai.pill, lang))}</span><h3>${em(L(home.ai.title, lang))}</h3><p>${esc(L(home.ai.textM || home.ai.text, lang))}</p><ul class="ticks ticks--inline">${home.ai.guards.map((g) => `<li>${esc(L(g.text, lang))}</li>`).join("")}</ul></div>`),
    page(lang, 5, `<span class="kicker">${t.advisory}</span><h2>${em(L(home.advisory.title, lang))}</h2>${practice("marketEntry", photos.me, hubs.marketEntry)}<ul class="svc svc--tight">${me.map(svc).join("")}</ul>${practice("advisory", photos.adv, hubs.advisory)}<ul class="svc svc--tight">${adv.map(svc).join("")}</ul>`),
    page(lang, 6, `<span class="kicker">${t.how}</span><h2>${em(L(home.approach.title, lang))}</h2><p class="lede">${esc(L(home.approach.text, lang))}</p><div class="two"><div><span class="kicker">${t.from}</span><ol class="stages">${stages}</ol></div><div><span class="kicker">${t.background}</span><ul class="bg">${bg}</ul><img class="photo" src="${photos.work}" alt=""></div></div>`),
    page(lang, 7, `<span class="kicker">${t.model}</span><h2>${esc(L(faq.general.title, lang))}</h2><div class="qas">${faqs}</div>`),
    page(lang, 8, `<span class="kicker">${t.contact}</span><h2>${em(L(home.cta.title, lang))}</h2><p class="lede">${esc(L(contact.book.text, lang))}</p><div class="pillars">${home.cta.pillars.map((p) => `<div><strong>${esc(L(p.title, lang))}</strong><span>${esc(L(p.text, lang))}</span></div>`).join("")}</div><div class="contact"><div><span class="kicker">${t.email}</span><strong>${esc(cfg.email)}</strong></div><div><span class="kicker">${t.web}</span><strong>${esc(cfg.domain.replace(/^https?:\/\//, ""))}</strong></div><div><span class="kicker">${esc(L(contact.office.title || { en: "Office", id: "Kantor" }, lang))}</span><strong>${esc(cfg.addressJakarta)}</strong></div></div><p class="statement">${esc(L(contact.confidentiality.text || contact.confidentiality, lang))}</p><div class="lockup lockup--stack"><span class="lockup__name">Metanoia</span><span class="lockup__sub">Advisory</span></div>`, "last"),
  ];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
  @font-face{font-family:"Fraunces";src:url(data:font/woff2;base64,${fonts.fraunces}) format("woff2");font-weight:500 600}
  @font-face{font-family:"Fraunces";font-style:italic;src:url(data:font/woff2;base64,${fonts.frauncesI}) format("woff2");font-weight:500 600}
  @font-face{font-family:"Inter";src:url(data:font/woff2;base64,${fonts.inter}) format("woff2");font-weight:400 600}
  @font-face{font-family:"Cormorant Garamond";src:url(data:font/woff2;base64,${fonts.cormorant}) format("woff2");font-weight:300 700}
  @font-face{font-family:"Manrope";src:url(data:font/woff2;base64,${fonts.manrope}) format("woff2");font-weight:200 800}
  :root{--paper:#FAF8F4;--sand:#EEE7DA;--gold:#EAB200;--gold-dark:#C09200;--gold-text:#9A7200;--ink:#000;--grey:#5F5E5C;--rule:#D9D5CC}
  *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff;color:var(--ink);font-family:"Inter",sans-serif;font-size:10.5pt;line-height:1.5}
  @page{size:A4;margin:0}
  .page{width:210mm;height:297mm;position:relative;page-break-after:always;overflow:hidden;background:var(--paper);display:flex;flex-direction:column}
  .page__body{padding:18mm 18mm 10mm;flex:1} .page__foot{display:flex;justify-content:space-between;padding:0 18mm 10mm;font-size:8pt;letter-spacing:.12em;text-transform:uppercase;color:var(--grey)}
  h1,h2,h3{font-family:"Fraunces",serif;font-weight:600;letter-spacing:-.02em;margin:0} h2{font-size:24pt;line-height:1.1;margin:4mm 0 4mm} h3{font-size:14pt;line-height:1.2} em{font-style:normal;color:var(--gold-text)}
  .kicker{display:inline-flex;align-items:center;gap:8px;font-size:8pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#7A5B00;margin-bottom:2mm} .kicker::after{content:"";width:28px;height:1px;background:var(--gold)}
  .lede{font-size:11.5pt;line-height:1.55;color:#333;margin:0 0 6mm;max-width:150mm}
  .lockup{display:inline-flex;align-items:center;font-family:"Cormorant Garamond",serif;font-weight:600;font-size:30pt;letter-spacing:-.02em;line-height:1} .lockup__bar{width:1.5px;height:.72em;background:var(--gold-dark);margin:0 .38em 0 .34em} .lockup__sub{font-family:"Manrope",sans-serif;font-weight:600;font-size:.34em;letter-spacing:.42em;text-transform:uppercase;position:relative;top:.04em}
  .lockup--stack{flex-direction:column;align-items:center;gap:.34em;font-size:26pt;margin-top:10mm} .lockup--stack .lockup__sub{display:inline-flex;align-items:center;gap:.9em;font-size:.28em;top:0} .lockup--stack .lockup__sub::before,.lockup--stack .lockup__sub::after{content:"";width:1.5em;height:1.5px;background:var(--gold)}
  .cover{background:#000;color:var(--paper)} .cover__img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55} .cover__veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.85))}
  .cover__body{position:absolute;left:18mm;right:18mm;bottom:24mm} .cover .lockup{color:var(--paper);font-size:34pt;margin-bottom:28mm} .cover .lockup__bar{background:var(--gold)} .cover h1{font-size:40pt;line-height:1.05;margin-bottom:6mm} .cover__sub{font-size:13pt;line-height:1.45;max-width:120mm;margin:0 0 10mm;color:rgba(250,248,244,.9)} .cover__date{font-size:9pt;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin:0}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:10mm;align-items:start}
  .principle{display:grid;grid-template-columns:12mm 1fr;gap:3mm;padding:4mm 0;border-top:1px solid var(--rule)} .principle .num,.stages .num{font-family:"Fraunces",serif;font-weight:600;color:var(--gold-dark);font-size:14pt;line-height:1} .principle strong{display:block;font-family:"Fraunces",serif;font-size:12pt;margin-bottom:1mm} .principle span,.stages div span,.bg span,.svc span{display:block;font-size:9.5pt;line-height:1.45;color:#444}
  .toc{list-style:none;margin:0;padding:0;border-top:2px solid var(--gold)} .toc li{display:flex;align-items:baseline;gap:3mm;padding:3.2mm 0;border-bottom:1px solid var(--rule);font-size:10.5pt} .toc i{flex:1;border-bottom:1px dotted var(--rule)} .toc b{font-family:"Fraunces",serif;color:var(--gold-text)}
  .svc{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm} .svc li{padding:4mm 0 0;border-top:1px solid var(--rule)} .svc strong{display:block;font-family:"Fraunces",serif;font-size:12.5pt;line-height:1.2;margin-bottom:1.5mm} .svc--tight{gap:2mm 8mm;margin-bottom:7mm} .svc--tight li{padding-top:2.5mm} .svc--tight strong{font-size:11pt}
  .band{margin-top:8mm;background:#000;color:var(--paper);padding:8mm;border-radius:4mm} .band .kicker{color:var(--gold)} .band .kicker::after{display:none} .band h3{font-size:16pt;margin:2mm 0 3mm} .band em{color:var(--gold)} .band p{margin:0 0 3mm;color:rgba(250,248,244,.85);font-size:10pt}
  .ticks{list-style:none;margin:2mm 0 0;padding:0} .ticks li{position:relative;padding-left:6mm;font-size:9.5pt;line-height:1.5} .ticks li::before{content:"";position:absolute;left:0;top:.45em;width:3mm;height:3mm;border-radius:50%;background:var(--gold)} .ticks--inline{display:flex;gap:6mm} .ticks--inline li::before{background:var(--gold)}
  .practice{display:grid;grid-template-columns:48mm 1fr;gap:6mm;align-items:start;margin:2mm 0 4mm} .practice img{width:48mm;height:36mm;object-fit:cover;border-radius:2mm} .practice h3{margin:1mm 0 2mm} .practice p{margin:0;font-size:10pt;color:#333}
  .stages{list-style:none;margin:0;padding:0} .stages li{display:grid;grid-template-columns:10mm 1fr;gap:3mm;padding:3mm 0;border-top:1px solid var(--rule)} .stages strong{display:block;font-family:"Fraunces",serif;font-size:11.5pt;margin-bottom:.5mm}
  .bg{list-style:none;margin:0 0 5mm;padding:0} .bg li{padding:2.5mm 0;border-top:1px solid var(--rule)} .bg strong{display:block;font-family:"Fraunces",serif;font-size:11pt} .photo{width:100%;height:50mm;object-fit:cover;border-radius:2mm}
  .qas{columns:1} .qa{padding:3.5mm 0;border-top:1px solid var(--rule)} .qa strong{display:block;font-family:"Fraunces",serif;font-size:12pt;margin-bottom:1.5mm} .qa p{margin:0;font-size:9.8pt;line-height:1.5;color:#333}
  .pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin:4mm 0 10mm} .pillars div{border-top:2px solid var(--gold);padding-top:3mm} .pillars strong{display:block;font-family:"Fraunces",serif;font-size:12pt} .pillars span{font-size:9.5pt;color:#444}
  .contact{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin:6mm 0} .contact strong{display:block;font-family:"Fraunces",serif;font-size:13pt} .statement{font-size:9pt;line-height:1.5;color:var(--grey);border-left:2px solid var(--gold);padding-left:4mm;max-width:150mm}
  .last .page__body{display:flex;flex-direction:column} .last .lockup--stack{align-self:center;margin-top:auto}
  </style></head><body>${pages.join("")}</body></html>`;
}

mkdirSync("src/root/downloads", { recursive: true });
const browser = await chromium.launch();
for (const lang of ["en", "id"]) {
  const pg = await browser.newPage();
  await pg.setContent(build(lang), { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  const out = `src/root/downloads/metanoia-advisory-credentials-${lang}.pdf`;
  await pg.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
  console.log("wrote", out);
  await pg.close();
}
await browser.close();
