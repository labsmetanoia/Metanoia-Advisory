// Proposal kit — the proposal and engagement letter as a list of blocks, built once per language. The HTML and Word
// writers both read these blocks; a bilingual document pairs the Indonesian and English blocks side by side, which is
// why both languages are built by the same code and always have the same shape.
import { offerByKey } from "./offers.js";
import { standardTerms } from "./terms.js";
import { money, moneyWords } from "./words.js";

const B = (en, id) => ({ en, id });
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));

export const DEFAULT_SETTINGS = {
  tradingName: "Metanoia Advisory", legalName: "", address: "Jakarta, Indonesia", email: "", phone: "", taxId: "",
  signatory: "", signatoryTitle: "", days: 14, notice: 30, validDays: 30, vatRate: "",
  bankName: "", bankAccount: "", bankHolder: "", forum: { en: "", id: "" }, meterai: true, reviewed: false, counter: 0,
};

export const LABELS = {
  en: { kicker: "Proposal and engagement letter", for: "for", preparedFor: "Prepared for", attention: "Attention", date: "Date", ref: "Reference", valid: "Valid until", by: "Prepared by",
    draft: (n) => `Draft for review by counsel: the standard terms in section ${n} have not yet been reviewed.`,
    situation: "Your situation", scope: "What we will do", deliverables: "What you receive", steps: "How it runs", step: "Step", what: "What happens", when: "When",
    inputs: "What we need from you", team: "Who will do the work", fee: "Fee and payment", feeLine: "Fee", monthly: "Monthly fee", months: "Term", monthsN: (n) => `${n} months`,
    vat: (r) => `VAT ${r}%`, total: "Total", totalTerm: (n) => `Total for ${n} months`, words: "In words", instalment: "Instalment", share: "Share", amount: "Amount", plusVat: "VAT is added to each invoice.",
    payDays: (d) => `Invoices are payable within ${d} days of the invoice date.`, bank: (b) => `Payment to ${b.bankName}, account ${b.bankAccount}, in the name of ${b.bankHolder}.`,
    assumptions: "Assumptions", excluded: "Not included", assumeHead: "Assumptions and what is not included", terms: "Terms of engagement",
    accept: "Acceptance", acceptText: "Signed by the authorised representatives of both parties.", forFirm: "For", name: "Name", title: "Title", sign: "Signature", signDate: "Date", meterai: "Stamp duty",
    footer: "Confidential", page: "Page" },
  id: { kicker: "Proposal dan surat penugasan", for: "untuk", preparedFor: "Disiapkan untuk", attention: "Up.", date: "Tanggal", ref: "Nomor", valid: "Berlaku hingga", by: "Disiapkan oleh",
    draft: (n) => `Draf untuk ditinjau penasihat hukum: ketentuan standar pada bagian ${n} belum ditinjau.`,
    situation: "Situasi Anda", scope: "Apa yang akan kami kerjakan", deliverables: "Yang Anda terima", steps: "Tahapan pekerjaan", step: "Tahap", what: "Kegiatan", when: "Waktu",
    inputs: "Yang kami perlukan dari Anda", team: "Tim yang mengerjakan", fee: "Biaya dan pembayaran", feeLine: "Biaya", monthly: "Biaya bulanan", months: "Jangka waktu", monthsN: (n) => `${n} bulan`,
    vat: (r) => `PPN ${r}%`, total: "Total", totalTerm: (n) => `Total untuk ${n} bulan`, words: "Terbilang", instalment: "Termin", share: "Porsi", amount: "Jumlah", plusVat: "PPN ditambahkan pada setiap tagihan.",
    payDays: (d) => `Tagihan dibayar dalam ${d} hari sejak tanggal tagihan.`, bank: (b) => `Pembayaran ke ${b.bankName}, rekening ${b.bankAccount}, atas nama ${b.bankHolder}.`,
    assumptions: "Asumsi", excluded: "Tidak termasuk", assumeHead: "Asumsi dan hal yang tidak termasuk", terms: "Ketentuan penugasan",
    accept: "Persetujuan", acceptText: "Ditandatangani oleh wakil yang berwenang dari kedua belah pihak.", forFirm: "Untuk", name: "Nama", title: "Jabatan", sign: "Tanda tangan", signDate: "Tanggal", meterai: "Meterai",
    footer: "Rahasia", page: "Halaman" },
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function newProposal(offerKey = "deckAudit", settings = DEFAULT_SETTINGS, today = new Date()) {
  const o = offerByKey(offerKey);
  return { ref: "", date: ymd(today), offer: o.key, mode: "bi", currency: "IDR", fee: 0, months: o.months || 12,
    client: { company: "", address: "", contact: "", email: "", signatory: "", signatoryTitle: "", indonesian: true },
    subject: B("", ""), situation: B("", ""), team: B("", ""),
    deliverables: copy(o.deliverables), steps: copy(o.steps).map((s) => ({ ...s, when: s.when || B("", "") })), inputs: copy(o.inputs),
    assumptions: copy(o.assumptions), exclusions: copy(o.exclusions), schedule: copy(o.schedule || []), payment: copy(o.payment || B("", "")) };
}
// MA/P/2026/11/007
export const makeRef = (date, n) => { const d = new Date(`${date}T00:00:00`); return `MA/P/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(n).padStart(3, "0")}`; };
export const langsOf = (mode) => (mode === "bi" ? ["id", "en"] : [mode === "id" ? "id" : "en"]);
const fmtDate = (iso, lang) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + Number(n || 0)); return ymd(d); };
const filled = (b) => Boolean(b && ((b.en || "").trim() || (b.id || "").trim()));
const pick = (b, lang) => ((b && (b[lang] || "").trim()) || (b && (b[lang === "id" ? "en" : "id"] || "").trim()) || "");
const vatRate = (s) => { const r = Number(String(s.vatRate ?? "").replace(",", ".")); return Number.isFinite(r) && r > 0 ? r : 0; };

export function totals(p, s) {
  const o = offerByKey(p.offer), r = vatRate(s), fee = Math.round(Number(p.fee) || 0), months = Math.max(1, Math.round(Number(p.months) || 1));
  if (o.basis === "monthly") { const vat = Math.round(fee * r / 100); return { basis: "monthly", fee, vat, rate: r, months, total: (fee + vat) * months }; }
  const vat = Math.round(fee * r / 100); return { basis: "fixed", fee, vat, rate: r, months: 1, total: fee + vat };
}

export function buildBlocks(p, s, lang) {
  const L = LABELS[lang], o = offerByKey(p.offer), cur = p.currency || "IDR", T = totals(p, s), firm = s.legalName || s.tradingName, client = p.client.company || "—";
  const out = [], sec = { n: 0 }, head = (text) => { sec.n += 1; out.push({ t: "h", n: sec.n, text: `${sec.n}. ${text}` }); return sec.n; };
  const validIso = addDays(p.date, s.validDays), title = `${pick(o.name, lang)} ${L.for} ${client}`;
  // terms section number, worked out in advance so the cover can name it
  const later = [filled(p.situation), true, p.steps.length > 0, p.inputs.length > 0, filled(p.team), true, p.assumptions.length + p.exclusions.length > 0].filter(Boolean).length, termsN = later + 1;
  out.push({ t: "cover", kicker: L.kicker, title, draft: s.reviewed ? null : L.draft(termsN),
    meta: [[L.preparedFor, [p.client.company, p.client.address].filter(Boolean).join(", ")], [L.attention, [p.client.contact, p.client.email].filter(Boolean).join(", ")], [L.date, fmtDate(p.date, lang)], [L.ref, p.ref], [L.valid, fmtDate(validIso, lang)], [L.by, [s.signatory, s.signatoryTitle, firm].filter(Boolean).join(", ")]].filter((m) => m[1]) });
  if (filled(p.situation)) { head(L.situation); for (const para of pick(p.situation, lang).split(/\n\s*\n/)) out.push({ t: "p", text: para.trim() }); }
  head(L.scope); out.push({ t: "p", text: pick(o.objective, lang).replace("{subject}", pick(p.subject, lang) || pick(o.subjectHint, lang)) });
  if (p.deliverables.length) { out.push({ t: "sub", text: L.deliverables }); out.push({ t: "list", items: p.deliverables.map((d) => pick(d, lang)) }); }
  if (p.steps.length) { const when = p.steps.some((x) => filled(x.when)); head(L.steps); out.push({ t: "table", head: when ? [L.step, L.what, L.when] : [L.step, L.what], widths: when ? [24, 52, 24] : [28, 72], rows: p.steps.map((x) => (when ? [pick(x.title, lang), pick(x.text, lang), pick(x.when, lang)] : [pick(x.title, lang), pick(x.text, lang)])) }); }
  if (p.inputs.length) { head(L.inputs); out.push({ t: "list", items: p.inputs.map((d) => pick(d, lang)) }); }
  if (filled(p.team)) { head(L.team); for (const para of pick(p.team, lang).split(/\n\s*\n/)) out.push({ t: "p", text: para.trim() }); }
  head(L.fee);
  const m = (v) => money(v, cur, lang), rows = [];
  if (T.basis === "monthly") { rows.push([L.monthly, m(T.fee)]); if (T.rate) rows.push([L.vat(T.rate), m(T.vat)]); rows.push([L.months, L.monthsN(T.months)]); rows.push([L.totalTerm(T.months), m(T.total)]); }
  else { rows.push([`${L.feeLine}: ${pick(o.name, lang)}`, m(T.fee)]); if (T.rate) rows.push([L.vat(T.rate), m(T.vat)]); rows.push([L.total, m(T.total)]); }
  out.push({ t: "table", head: null, widths: [62, 38], rows, total: true, align: ["left", "right"] });
  out.push({ t: "p", text: `${L.words}: ${moneyWords(T.total, cur, lang)}.`, em: true });
  if (T.basis === "monthly") out.push({ t: "p", text: pick(p.payment, lang) });
  else if (p.schedule.length) { out.push({ t: "table", head: [L.instalment, L.share, L.amount], widths: [50, 18, 32], align: ["left", "right", "right"], rows: p.schedule.map((x) => [pick(x.label, lang), `${x.pct}%`, m(Math.round(T.fee * (Number(x.pct) || 0) / 100))]) }); if (T.rate) out.push({ t: "p", text: L.plusVat }); }
  out.push({ t: "p", text: [L.payDays(s.days), s.bankName && s.bankAccount && s.bankHolder ? L.bank(s) : ""].filter(Boolean).join(" ") });
  if (p.assumptions.length + p.exclusions.length) { head(L.assumeHead); if (p.assumptions.length) { out.push({ t: "sub", text: L.assumptions }); out.push({ t: "list", items: p.assumptions.map((d) => pick(d, lang)) }); } if (p.exclusions.length) { out.push({ t: "sub", text: L.excluded }); out.push({ t: "list", items: p.exclusions.map((d) => pick(d, lang)) }); } }
  const n = head(L.terms);
  const ctx = { firm, client, days: s.days, notice: s.notice, vat: Boolean(T.rate), forum: (s.forum && (s.forum.en || s.forum.id)) ? { en: s.forum.en || s.forum.id, id: s.forum.id || s.forum.en } : null, bilingual: p.mode === "bi", basis: T.basis, validUntil: { en: fmtDate(validIso, "en"), id: fmtDate(validIso, "id") } };
  standardTerms(ctx, lang).forEach((c, i) => out.push({ t: "clause", n: `${n}.${i + 1}`, key: c.key, title: c.title, text: c.text }));
  head(L.accept); out.push({ t: "p", text: L.acceptText });
  out.push({ t: "sign", meterai: Boolean(s.meterai) && lang === "id", parties: [{ label: `${L.forFirm} ${firm}`, name: s.signatory, title: s.signatoryTitle }, { label: `${L.forFirm} ${client}`, name: p.client.signatory, title: p.client.signatoryTitle }], L: { name: L.name, title: L.title, sign: L.sign, date: L.signDate, meterai: L.meterai } });
  return out;
}

// What stops the document from going out, and what deserves a second look.
export function problems(p, s) {
  const out = [], o = offerByKey(p.offer), err = (text) => out.push({ level: "error", text }), warn = (text) => out.push({ level: "warn", text });
  if (!p.client.company.trim()) err("Add the client's company name.");
  if (!(Number(p.fee) > 0)) err(o.basis === "monthly" ? "Enter the monthly fee." : "Enter the fee.");
  if (!s.signatory.trim()) err("Add the firm's signatory in Settings.");
  if (!s.legalName.trim()) warn(`The letter names "${s.tradingName}". Add the firm's legal entity name in Settings so the right party signs.`);
  if (!p.client.signatory.trim()) warn("Add the client's signatory, or they will sign on a blank name line.");
  if (o.basis !== "monthly" && p.schedule.length) { const sum = p.schedule.reduce((a, x) => a + (Number(x.pct) || 0), 0); if (Math.abs(sum - 100) > 0.01) err(`The payment schedule adds up to ${sum}%, not 100%.`); }
  if (p.mode === "en" && p.client.indonesian) warn("The client is an Indonesian party. Agreements with Indonesian parties are generally required to be in Bahasa Indonesia; choose Bilingual unless your counsel advises otherwise.");
  if (p.mode === "bi") { const half = []; for (const [k, label] of [["subject", "the subject"], ["situation", "Your situation"], ["team", "Who will do the work"]]) { const b = p[k]; if (filled(b) && (!(b.en || "").trim() || !(b.id || "").trim())) half.push(label); }
    const lists = ["deliverables", "inputs", "assumptions", "exclusions"].filter((k) => p[k].some((x) => !(x.en || "").trim() || !(x.id || "").trim())); if (p.steps.some((x) => !(x.title.en && x.title.id && x.text.en && x.text.id))) lists.push("steps");
    if (half.length || lists.length) warn(`Some text is in one language only (${[...half, ...lists].join(", ")}); the other column repeats it untranslated.`); }
  if (!s.reviewed) warn("The standard terms have not been reviewed by counsel, so the document is marked as a draft.");
  return out;
}

/* ---------- HTML: one self-contained page that prints to A4 ---------- */
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function blockHtml(b) {
  switch (b.t) {
    case "h": return `<h2>${esc(b.text)}</h2>`;
    case "sub": return `<h3>${esc(b.text)}</h3>`;
    case "p": return `<p${b.em ? ' class="em"' : ""}>${esc(b.text)}</p>`;
    case "list": return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "table": return `<table class="${b.total ? "fee" : ""}">${b.head ? `<tr>${b.head.map((h, i) => `<th style="width:${b.widths[i]}%;text-align:${(b.align || [])[i] || "left"}">${esc(h)}</th>`).join("")}</tr>` : ""}${b.rows.map((r, ri) => `<tr${b.total && ri === b.rows.length - 1 ? ' class="tot"' : ""}>${r.map((c, i) => `<td style="${b.head ? "" : `width:${b.widths[i]}%;`}text-align:${(b.align || [])[i] || "left"}">${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    case "clause": return `<p class="clause"><b>${esc(b.n)} ${esc(b.title)}.</b> ${esc(b.text)}</p>`;
    default: return "";
  }
}
function coverHtml(c, c2) {
  const meta = (c2 ? c.meta.map((m, i) => [`${m[0]} / ${c2.meta[i] ? c2.meta[i][0] : ""}`, m[1] === (c2.meta[i] || [])[1] ? m[1] : `${m[1]} / ${(c2.meta[i] || [])[1] || ""}`]) : c.meta);
  return `<div class="cover"><div class="brand">Metanoia<i></i><b>Advisory</b></div><div class="k">${esc(c.kicker)}${c2 ? ` · ${esc(c2.kicker)}` : ""}</div><h1>${esc(c.title)}</h1>${c2 ? `<p class="h1b">${esc(c2.title)}</p>` : ""}
<table class="meta">${meta.map((m) => `<tr><th>${esc(m[0])}</th><td>${esc(m[1])}</td></tr>`).join("")}</table>${c.draft ? `<p class="draft">${esc(c.draft)}${c2 ? `<br>${esc(c2.draft)}` : ""}</p>` : ""}</div>`;
}
function signHtml(g, g2) {
  const lab = (k) => (g2 ? `${g.L[k]} / ${g2.L[k]}` : g.L[k]);
  return `<div class="sign">${g.parties.map((x, i) => `<div><p class="who">${esc(x.label)}${g2 ? `<br><span>${esc(g2.parties[i].label)}</span>` : ""}</p><div class="line">${g.meterai || (g2 && g2.meterai) ? `<span class="mat">${esc(lab("meterai"))}</span>` : ""}</div><p>${esc(lab("sign"))}</p><dl><dt>${esc(lab("name"))}</dt><dd>${esc(x.name) || "&nbsp;"}</dd><dt>${esc(lab("title"))}</dt><dd>${esc(x.title) || "&nbsp;"}</dd><dt>${esc(lab("date"))}</dt><dd>&nbsp;</dd></dl></div>`).join("")}</div>`;
}

export function proposalHtml(p, s) {
  const langs = langsOf(p.mode), models = langs.map((l) => buildBlocks(p, s, l)), a = models[0], b = models[1] || null, L = LABELS[langs[0]], L2 = b ? LABELS[langs[1]] : null;
  let body = ""; const last = a.map((x) => x.t).lastIndexOf("h");
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b ? b[i] : null;
    if (i === last) body += '<div class="keep">';   // the acceptance section stays on one page with its signatures
    if (x.t === "cover") body += coverHtml(x, y);
    else if (x.t === "sign") body += signHtml(x, y);
    else if (!y) body += blockHtml(x);
    else body += `<div class="bi"><div lang="${langs[0]}">${blockHtml(x)}</div><div lang="${langs[1]}">${blockHtml(y)}</div></div>`;
  }
  if (last >= 0) body += "</div>";
  const firm = s.legalName || s.tradingName, draft = s.reviewed ? "" : ` · ${b ? "DRAF / DRAFT" : p.mode === "id" ? "DRAF" : "DRAFT"}`;
  return `<!doctype html><html lang="${langs[0]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(p.ref || "Proposal")} ${esc(a[0].title)}</title><style>
@page{size:A4;margin:18mm 16mm 20mm}*{box-sizing:border-box}body{font:12.5px/1.55 Inter,"Segoe UI",Arial,sans-serif;color:#111;max-width:820px;margin:0 auto;padding:36px 28px;background:#fff}
.cover{padding:4px 0 22px;border-bottom:2px solid #C09200;margin-bottom:18px}.brand{font:600 21px "Cormorant Garamond",Georgia,serif;letter-spacing:-.01em}.brand i{display:inline-block;width:1.5px;height:14px;background:#C09200;margin:0 9px -1px}.brand b{font:600 7.5px Manrope,Inter,Arial,sans-serif;letter-spacing:.42em;text-transform:uppercase;vertical-align:3px}
.k{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#7A5B00;font-weight:600;margin-top:28px}h1{font:600 28px/1.15 Fraunces,Georgia,serif;letter-spacing:-.01em;margin:8px 0 4px}.h1b{font:500 17px/1.3 Fraunces,Georgia,serif;color:#55524C;margin:0 0 12px}
.keep{break-inside:avoid}.meta{border-collapse:collapse;margin-top:12px;width:auto}.meta th,.meta td{border:0}.meta th{font:600 10.5px Inter,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B6862;text-align:left;padding:3px 18px 3px 0;vertical-align:top;white-space:nowrap}.meta td{padding:3px 0;font-size:13px}
.draft{margin:14px 0 0;padding:8px 11px;background:#FBEDE9;border-left:3px solid #B3402F;color:#5C1F15;font-size:11.5px}
h2{font:600 16.5px Fraunces,Georgia,serif;margin:20px 0 6px;padding-bottom:5px;border-bottom:1px solid #E3DED3;break-after:avoid}h3{font-size:12px;font-weight:700;margin:10px 0 4px;break-after:avoid}
p{margin:5px 0}p.em{color:#44423E;font-style:italic}ul{margin:4px 0 6px;padding-left:18px}li{margin:2px 0}
table{width:100%;border-collapse:collapse;margin:6px 0}table.fee,tr{break-inside:avoid}th,td{padding:5px 7px;border-bottom:1px solid #E7E1D6;vertical-align:top;font-size:12px}th{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6B6862;border-bottom:1.5px solid #CFC7B8}
table.fee td{font-size:12.5px}table.fee tr.tot td{font-weight:700;border-top:1.5px solid #111;border-bottom:0}
.clause{margin:6px 0;break-inside:avoid}.bi{display:grid;grid-template-columns:1fr 1fr;gap:22px}.bi>div{min-width:0}.bi h2{font-size:14.5px}.bi td,.bi th{font-size:11px}.bi p,.bi li{font-size:11.5px}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:14px;break-inside:avoid}.sign .who{font-weight:700;margin:0 0 6px}.sign .who span{font-weight:500;color:#55524C}.sign .line{height:84px;border-bottom:1px solid #111;position:relative}.sign .mat{position:absolute;left:0;bottom:8px;border:1px dashed #9A948A;color:#6B6862;font-size:9.5px;padding:16px 10px}.sign p{font-size:10.5px;color:#6B6862;margin:3px 0 8px}
.sign dl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;margin:0}.sign dt{font-size:10.5px;color:#6B6862}.sign dd{margin:0;border-bottom:1px dotted #B9B4A8;min-height:16px}
footer{margin-top:26px;border-top:1px solid #E3DED3;padding-top:8px;color:#6B6862;font-size:10.5px}
@media print{body{padding:0;max-width:none}}</style></head><body>
${body}<footer>${esc(firm)} · ${esc(p.ref)} · ${esc(L.footer)}${L2 ? ` / ${esc(L2.footer)}` : ""}${draft}</footer></body></html>`;
}
