// Deck Auditor — the benchmark: many published decks audited one by one, then counted together. Only aggregate
// figures leave this module; no deck, company name or slide text is written into the report. Each deck is kept as a
// row of numbers (its metrics), so a study can grow over several sessions without holding the decks in memory.

const B = (en, id) => ({ en, id });

// What each kind of finding means for "share of decks with …". pptx: the check needs a PowerPoint file (a PDF keeps no
// typefaces, placeholders or picture sizes). long: the check runs only on decks of 8 slides or more.
export const MEASURES = [
  { key: "mismatch", pillar: "numbers", codes: ["mismatch"], label: B("A figure shown with two different values", "Angka yang ditampilkan dengan dua nilai berbeda") },
  { key: "arithmetic", pillar: "numbers", codes: ["total-row", "total-col", "chart-total", "shares", "growth"], label: B("A total, share or growth rate that does not add up", "Total, porsi atau pertumbuhan yang tidak sesuai hitungannya") },
  { key: "headline", pillar: "numbers", codes: ["headline"], label: B("A figure in a title that is not on its page", "Angka di judul yang tidak ada di halamannya") },
  { key: "precision", pillar: "numbers", codes: ["precision"], label: B("The same figure rounded differently", "Angka yang sama dengan pembulatan berbeda") },
  { key: "no-source", pillar: "numbers", codes: ["no-source"], label: B("A data page without a source line", "Halaman data tanpa baris sumber") },
  { key: "label-titles", pillar: "structure", codes: ["label-titles"], label: B("Titles that name a topic instead of stating a conclusion", "Judul yang hanya menyebut topik, bukan kesimpulan") },
  { key: "no-summary", pillar: "structure", codes: ["no-summary"], long: true, label: B("No executive summary near the front", "Tidak ada ringkasan eksekutif di bagian depan") },
  { key: "no-ask", pillar: "structure", codes: ["no-ask"], long: true, label: B("No page stating a decision or next steps", "Tidak ada halaman yang menyatakan keputusan atau langkah selanjutnya") },
  { key: "dense", pillar: "structure", codes: ["dense"], label: B("A page with more than 150 words", "Halaman dengan lebih dari 150 kata") },
  { key: "duplicate-title", pillar: "structure", codes: ["duplicate-title"], label: B("The same title on more than one page", "Judul yang sama di lebih dari satu halaman") },
  { key: "no-title", pillar: "structure", codes: ["no-title", "long-title"], label: B("A page with no title, or a title past two lines", "Halaman tanpa judul, atau judul lebih dari dua baris") },
  { key: "language", pillar: "structure", codes: ["language"], label: B("Pages left in the other language", "Halaman yang tertinggal dalam bahasa lain") },
  { key: "draft-marks", pillar: "design", codes: ["draft-marks"], label: B("Draft markers left in", "Penanda draf yang tertinggal") },
  { key: "small-type", pillar: "design", codes: ["small-type"], label: B("Body text too small to read on a shared screen", "Teks isi terlalu kecil untuk dibaca di layar bersama") },
  { key: "title-drift", pillar: "design", codes: ["title-size", "title-position"], label: B("Titles that change size or position", "Judul yang berubah ukuran atau posisi") },
  { key: "off-slide", pillar: "design", codes: ["off-slide", "margin"], label: B("Content past the page edge or the margin", "Konten melewati tepi halaman atau margin") },
  { key: "fonts", pillar: "design", codes: ["fonts"], pptx: true, label: B("Stray typefaces", "Jenis huruf asing") },
  { key: "pictures", pillar: "design", codes: ["stretched", "low-res"], pptx: true, label: B("Stretched or low-resolution pictures", "Gambar yang tertarik atau beresolusi rendah") },
  { key: "page-number", pillar: "design", codes: ["page-number", "empty-placeholder"], pptx: true, label: B("Missing page numbers or empty placeholders", "Nomor halaman hilang atau placeholder kosong") },
];

// One deck → one row of numbers. `name` stays on this computer; the report never prints it.
export function deckMetrics(deck, result, name = deck.name) {
  const live = deck.slides.filter((s) => !s.hidden), codes = [...new Set(result.findings.map((f) => f.code))].sort();
  const n = (s) => result.findings.filter((f) => f.severity === s).length;
  return { name, kind: deck.kind, lang: result.lang, slides: live.length, figures: result.stats.figures, words: Math.round(live.reduce((a, s) => a + (s.words || 0), 0) / Math.max(1, live.length)),
    actionShare: result.stats.actionShare, high: n("high"), medium: n("medium"), low: n("low"), codes };
}

const median = (xs) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
export const applies = (m, row) => (!m.pptx || row.kind === "pptx") && (!m.long || row.slides >= 8);

export function aggregate(rows) {
  const ok = rows.filter((r) => !r.error), N = ok.length;
  const measures = MEASURES.map((m) => { const base = ok.filter((r) => applies(m, r)), hit = base.filter((r) => m.codes.some((c) => r.codes.includes(c))).length; return { ...m, decks: hit, of: base.length, share: pct(hit, base.length) }; });
  const buckets = [[0, 25], [25, 50], [50, 75], [75, 101]].map(([lo, hi]) => ({ lo, hi: Math.min(hi, 100), decks: ok.filter((r) => r.actionShare >= lo && r.actionShare < hi).length }));
  return { n: N, pptx: ok.filter((r) => r.kind === "pptx").length, pdf: ok.filter((r) => r.kind === "pdf").length, failed: rows.length - N,
    langs: { en: ok.filter((r) => r.lang === "en").length, id: ok.filter((r) => r.lang === "id").length },
    medianSlides: median(ok.map((r) => r.slides)), medianWords: median(ok.map((r) => r.words)), medianAction: median(ok.map((r) => r.actionShare)), medianFindings: median(ok.map((r) => r.high + r.medium + r.low)),
    withFix: pct(ok.filter((r) => r.high > 0).length, N), mostlyAction: pct(ok.filter((r) => r.actionShare >= 50).length, N), measures, buckets };
}

// Codes for the decks, in an order that says nothing about the file names. The key (code → file) stays with the firm.
export function assignCodes(rows, seed = 1) {
  let x = seed >>> 0 || 1; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const order = rows.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const codes = new Array(rows.length); order.forEach((ri, k) => { codes[ri] = `D${String(k + 1).padStart(2, "0")}`; }); return codes;
}

const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function metricsCsv(rows, codes) {
  const head = ["deck", "format", "language", "slides", "figures", "words_per_slide", "titles_stating_a_conclusion_pct", "to_fix", "to_check", "to_polish", ...MEASURES.map((m) => m.key)];
  const lines = rows.map((r, i) => (r.error ? null : [codes[i], r.kind, r.lang, r.slides, r.figures, r.words, r.actionShare, r.high, r.medium, r.low, ...MEASURES.map((m) => (applies(m, r) ? (m.codes.some((c) => r.codes.includes(c)) ? 1 : 0) : ""))])).filter(Boolean);
  return [head, ...lines].map((l) => l.map(csvCell).join(",")).join("\n");
}
export const keyCsv = (rows, codes) => [["deck", "file"], ...rows.map((r, i) => [codes[i], r.name])].map((l) => l.map(csvCell).join(",")).join("\n");

/* ---------- the study report: aggregate figures only ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = {
  en: { locale: "en-GB", kicker: "Benchmark", decks: "Decks", period: "Period", by: "Prepared by", date: "Date", formats: (a) => `${a.n} decks: ${a.pptx} PowerPoint, ${a.pdf} PDF`,
    chosen: "How the decks were chosen", reading: "Our reading", headline: "The headline figures",
    tiles: [["medianAction", (v) => `${v}%`, "of titles state a conclusion in the median deck"], ["withFix", (v) => `${v}%`, "of decks have at least one point to fix before release"], ["m:mismatch", (v) => `${v}%`, "of decks show a figure with two different values"], ["m:draft-marks", (v) => `${v}%`, "of decks still carry a draft marker"]],
    pillar: { numbers: "Numbers that match", structure: "Consulting structure", design: "Executive-grade design" },
    lead: { numbers: "Share of decks in which the check found at least one case. Every figure was compared with every other mention of it, with its own arithmetic and with the exhibit beside it.", structure: "Read from the titles alone, the way a senior reader pages through a deck first.", design: "Anything that drifted from the deck's own system or was left over from drafting." },
    ofDecks: (m) => `${m.decks} of ${m.of}`, notApplicable: "not measurable in this sample", only: { pptx: "PowerPoint files only", long: "decks of 8 slides or more" },
    dist: "How many titles state a conclusion", distLead: "Decks grouped by the share of their titles that state a conclusion rather than name a topic.", bucket: (b) => `${b.lo}–${b.hi}% of titles`, decksN: (k) => `${k} deck${k === 1 ? "" : "s"}`,
    profile: "The sample", profileRows: (a) => [["Decks", `${a.n}`], ["In Indonesian / in English", `${a.langs.id} / ${a.langs.en}`], ["Slides in the median deck", `${a.medianSlides}`], ["Words per slide, median", `${a.medianWords}`], ["Automatic findings in the median deck", `${a.medianFindings}`]],
    method: "How this was done", method1: (a) => `Each deck was read by Metanoia Advisory's Deck Auditor, the software behind its Deck Audit, on the firm's own computers. The figures in this report are counts of its automatic findings; individual findings were not reviewed one by one, so a small share may be judgement calls rather than errors.${a.failed ? ` ${a.failed} file${a.failed > 1 ? "s" : ""} could not be read and ${a.failed > 1 ? "are" : "is"} not counted.` : ""}`,
    method2: "A PDF keeps the words and the layout of a deck but not its tables, chart data, typefaces or picture sizes, so some checks apply to PowerPoint files only and are counted against those. Charts pasted as pictures carry no figures and were not checked.",
    method3: "No company is named. The decks are identified only by a code; the list of codes is kept by the firm. Percentages are rounded to whole numbers.",
    footer: "Metanoia Advisory · Strategic Storytelling &amp; Corporate Communications" },
  id: { locale: "id-ID", kicker: "Tolok ukur", decks: "Dek", period: "Periode", by: "Disiapkan oleh", date: "Tanggal", formats: (a) => `${a.n} dek: ${a.pptx} PowerPoint, ${a.pdf} PDF`,
    chosen: "Bagaimana dek dipilih", reading: "Pembacaan kami", headline: "Angka utama",
    tiles: [["medianAction", (v) => `${v}%`, "judul menyatakan kesimpulan pada dek median"], ["withFix", (v) => `${v}%`, "dek memiliki setidaknya satu hal yang harus diperbaiki sebelum dirilis"], ["m:mismatch", (v) => `${v}%`, "dek menampilkan angka dengan dua nilai berbeda"], ["m:draft-marks", (v) => `${v}%`, "dek masih memuat penanda draf"]],
    pillar: { numbers: "Angka yang cocok", structure: "Struktur konsultansi", design: "Desain kelas eksekutif" },
    lead: { numbers: "Porsi dek yang memiliki setidaknya satu temuan. Setiap angka dibandingkan dengan setiap penyebutannya, dengan perhitungannya sendiri dan dengan peraga di sampingnya.", structure: "Dibaca dari judulnya saja, seperti cara pembaca senior membolak-balik dek lebih dulu.", design: "Apa pun yang menyimpang dari sistem dek itu sendiri atau tertinggal dari penyusunan." },
    ofDecks: (m) => `${m.decks} dari ${m.of}`, notApplicable: "tidak dapat diukur dalam sampel ini", only: { pptx: "hanya berkas PowerPoint", long: "dek dengan 8 slide atau lebih" },
    dist: "Berapa banyak judul yang menyatakan kesimpulan", distLead: "Dek dikelompokkan menurut porsi judul yang menyatakan kesimpulan, bukan sekadar menyebut topik.", bucket: (b) => `${b.lo}–${b.hi}% judul`, decksN: (k) => `${k} dek`,
    profile: "Sampel", profileRows: (a) => [["Dek", `${a.n}`], ["Berbahasa Indonesia / Inggris", `${a.langs.id} / ${a.langs.en}`], ["Jumlah slide pada dek median", `${a.medianSlides}`], ["Kata per slide, median", `${a.medianWords}`], ["Temuan otomatis pada dek median", `${a.medianFindings}`]],
    method: "Bagaimana kajian ini dilakukan", method1: (a) => `Setiap dek dibaca oleh Deck Auditor milik Metanoia Advisory, perangkat lunak di balik layanan Audit Dek, di komputer firma sendiri. Angka dalam laporan ini adalah hitungan temuan otomatisnya; temuan tidak ditelaah satu per satu, sehingga sebagian kecil mungkin merupakan pilihan yang disengaja, bukan kesalahan.${a.failed ? ` ${a.failed} berkas tidak dapat dibaca dan tidak dihitung.` : ""}`,
    method2: "Berkas PDF menyimpan kata dan tata letak dek, tetapi tidak menyimpan tabel, data grafik, jenis huruf maupun ukuran gambar, sehingga sebagian pemeriksaan hanya berlaku untuk berkas PowerPoint dan dihitung terhadap berkas tersebut. Grafik yang ditempel sebagai gambar tidak membawa angka dan tidak diperiksa.",
    method3: "Tidak ada perusahaan yang disebut namanya. Dek hanya diidentifikasi dengan kode; daftar kodenya disimpan oleh firma. Persentase dibulatkan ke bilangan bulat.",
    footer: "Metanoia Advisory · Strategic Storytelling &amp; Komunikasi Korporat" },
};

const bar = (label, share, value, note) => `<div class="row"><div class="lab">${esc(label)}${note ? `<small>${esc(note)}</small>` : ""}</div><div class="track">${share == null ? "" : `<i style="width:${Math.max(share, 0.6)}%"></i>`}</div><div class="val">${share == null ? "–" : `${share}%`}<small>${esc(value)}</small></div></div>`;

export function benchmarkHtml(agg, meta = {}, lang = "en") {
  const t = T[lang === "id" ? "id" : "en"], L = (m) => m.label[lang === "id" ? "id" : "en"], date = meta.date || new Date().toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" });
  const get = (k) => (k.startsWith("m:") ? (agg.measures.find((m) => m.key === k.slice(2)) || {}).share : agg[k]);
  const tiles = t.tiles.map(([k, f, text]) => { const v = get(k); return v == null ? "" : `<div><strong>${f(v)}</strong><span>${esc(text)}</span></div>`; }).join("");
  const sec = (p) => { const ms = agg.measures.filter((m) => m.pillar === p).sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
    return `<section><h2>${t.pillar[p]}</h2><p class="lead">${t.lead[p]}</p><div class="bars">${ms.map((m) => bar(L(m), m.of ? m.share : null, m.of ? t.ofDecks(m) : t.notApplicable, m.pptx ? t.only.pptx : m.long ? t.only.long : "")).join("")}</div></section>`; };
  const meta2 = [[t.decks, t.formats(agg)], [t.period, meta.period], [t.by, meta.author], [t.date, date]].filter((r) => r[1]);
  return `<!doctype html><html lang="${lang === "id" ? "id" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(meta.title || t.kicker)}</title><style>
@page{size:A4;margin:17mm 16mm}*{box-sizing:border-box}body{font:13.5px/1.55 Inter,"Segoe UI",system-ui,sans-serif;color:#111;max-width:820px;margin:0 auto;padding:40px 28px;background:#FAF8F4}
.cover{padding:8px 0 24px;border-bottom:2px solid #C09200;margin-bottom:22px}.brand{font:600 22px "Cormorant Garamond",Georgia,serif}.brand i{display:inline-block;width:1.5px;height:15px;background:#C09200;margin:0 9px -1px}.brand b{font:600 8px Manrope,Inter,sans-serif;letter-spacing:.42em;text-transform:uppercase;vertical-align:3px}
.k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7A5B00;font-weight:600;margin-top:32px}h1{font:600 34px/1.12 Fraunces,Georgia,serif;letter-spacing:-.02em;margin:8px 0 16px}
.meta{border-collapse:collapse}.meta th{font:600 11px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6B6862;text-align:left;padding:3px 22px 3px 0;white-space:nowrap}.meta td{padding:3px 0;font-size:14px}
h2{font:600 21px Fraunces,Georgia,serif;margin:32px 0 6px;padding-bottom:8px;border-bottom:1px solid #E3DED3;break-after:avoid}.lead{color:#44423E;margin:8px 0 14px}p.prose{font-size:15px;line-height:1.6;white-space:pre-line;margin:8px 0}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0 4px}.tiles div{background:#fff;border:1px solid #E3DED3;border-radius:10px;padding:14px 15px}.tiles strong{display:block;font:600 32px Fraunces,Georgia,serif;line-height:1.05;margin-bottom:6px}.tiles span{font-size:12.5px;color:#44423E;line-height:1.4;display:block}
.bars{display:grid;gap:9px}.row{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) 84px;gap:14px;align-items:center;break-inside:avoid}.lab{font-size:13px;line-height:1.35}.lab small{display:block;color:#6B6862;font-size:11.5px}
.track{height:12px;background:#EEE7DA;border-radius:0 4px 4px 0}.track i{display:block;height:100%;background:#A07C00;border-radius:0 4px 4px 0}.val{font-weight:700;font-size:14px;text-align:right}.val small{display:block;font-weight:500;font-size:11.5px;color:#6B6862}
table.p{border-collapse:collapse;width:100%;background:#fff;border:1px solid #E3DED3}table.p td{padding:7px 10px;border-bottom:1px solid #EEE7DA}table.p td:last-child{text-align:right;font-weight:600}
footer{margin-top:36px;color:#6B6862;font-size:11.5px;border-top:1px solid #E3DED3;padding-top:12px}@media print{body{background:#fff;padding:0;max-width:none}}@media (max-width:640px){.tiles{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr 70px}.track{grid-column:1/-1;grid-row:2}}</style></head><body>
<div class="cover"><div class="brand">Metanoia<i></i><b>Advisory</b></div><div class="k">${t.kicker}</div><h1>${esc(meta.title || "")}</h1><table class="meta">${meta2.map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")}</table></div>
<section><h2 style="margin-top:0">${t.headline}</h2><div class="tiles">${tiles}</div></section>
${(meta.commentary || "").trim() ? `<section><h2>${t.reading}</h2><p class="prose">${esc(meta.commentary.trim())}</p></section>` : ""}
${(meta.selection || "").trim() ? `<section><h2>${t.chosen}</h2><p class="prose">${esc(meta.selection.trim())}</p></section>` : ""}
${sec("numbers")}${sec("structure")}
<section><h2>${t.dist}</h2><p class="lead">${t.distLead}</p><div class="bars">${agg.buckets.map((b) => bar(t.bucket(b), agg.n ? Math.round((b.decks / agg.n) * 100) : null, t.decksN(b.decks))).join("")}</div></section>
${sec("design")}
<section><h2>${t.profile}</h2><table class="p">${t.profileRows(agg).map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</table></section>
<section><h2>${t.method}</h2><p class="lead">${t.method1(agg)}</p><p class="lead">${t.method2}</p><p class="lead">${t.method3}</p></section>
<footer>${t.footer}${meta.period ? ` · ${esc(meta.period)}` : ""}</footer></body></html>`;
}
