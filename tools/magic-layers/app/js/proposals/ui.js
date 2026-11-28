// Proposal kit — the screen. A form on the left, the document as it will print on the right. Everything stays in this
// browser: the current proposal, the last thirty proposals and the firm's settings are kept in local storage.
import { OFFERS, offerByKey } from "./offers.js";
import { DEFAULT_SETTINGS, newProposal, makeRef, problems, proposalHtml, totals } from "./doc.js";
import { proposalDocx } from "./docx.js";
import { money, moneyWords, parseAmount, CURRENCIES } from "./words.js";
import { decodeBrief, proposalFromBrief } from "./brief.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function toast(msg, kind = "") { const t = el("div", `toast${kind ? ` toast--${kind}` : ""}`, msg); $("toasts").appendChild(t); setTimeout(() => t.remove(), kind === "error" ? 7000 : 3800); }
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const B = (en = "", id = "") => ({ en, id });
const KEY = { settings: "proposals:settings", current: "proposals:current", saved: "proposals:saved" };
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };

const S = { p: null, s: null };

/* ---------- state ---------- */
function loadSettings() { const s = { ...DEFAULT_SETTINGS, ...read(KEY.settings, {}) }; s.forum = { ...B(), ...(s.forum || {}) }; return s; }
const saveSettings = () => write(KEY.settings, S.s);
function fresh(offer = "deckAudit") { S.s.counter = (Number(S.s.counter) || 0) + 1; saveSettings(); const p = newProposal(offer, S.s); p.ref = makeRef(p.date, S.s.counter); return p; }
function save() {
  S.p.updated = Date.now(); write(KEY.current, S.p);
  const all = read(KEY.saved, {}); all[S.p.ref] = S.p;
  const keep = Object.values(all).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 30); write(KEY.saved, Object.fromEntries(keep.map((x) => [x.ref, x])));
}
const edited = (p) => Boolean(p.client.company.trim() || Number(p.fee) > 0);

/* ---------- form pieces ---------- */
function field(label, input, hint) { const f = el("label", "field"); f.appendChild(el("span", "", label)); f.appendChild(input); if (hint) f.appendChild(el("p", "pk__hint", hint)); return f; }
function input(get, set, o = {}) {
  const i = el(o.area ? "textarea" : "input"); if (!o.area) i.type = o.type || "text"; if (o.area === "tall") i.className = "tall";
  if (o.ph) i.placeholder = o.ph; i.value = get() ?? "";
  i.addEventListener("input", () => { set(o.type === "number" ? Number(i.value) : i.value); changed(); }); return i;
}
function select(options, get, set) { const s = el("select"); for (const [v, t] of options) { const o = el("option", "", t); o.value = v; s.appendChild(o); } s.value = get(); s.addEventListener("change", () => set(s.value)); return s; }
function check(label, get, set) { const l = el("label", "check"), i = el("input"); i.type = "checkbox"; i.checked = Boolean(get()); i.addEventListener("change", () => { set(i.checked); changed(); }); l.appendChild(i); l.appendChild(el("span", "", label)); return l; }
// one text in both languages; the form shows the halves the chosen language needs
function pair(label, obj, key, o = {}) {
  const w = el("div", "pk__pair"); if (!obj[key]) obj[key] = B();
  for (const l of ["id", "en"]) { const f = field(label, input(() => obj[key][l], (v) => { obj[key][l] = v; }, { area: o.area, ph: o.ph ? o.ph[l] : "" })); f.dataset.lang = l; f.firstChild.dataset.l = l === "id" ? "ID" : "EN"; w.appendChild(f); }
  return w;
}
function section(title, open, build, count) {
  const d = el("details"); d.open = open; const s = el("summary", "", title); if (count != null) s.appendChild(el("small", "", count)); d.appendChild(s);
  const body = el("div", "pk__body"); build(body); d.appendChild(body); return d;
}

// an editable list of bilingual items (deliverables, inputs, assumptions, exclusions)
function listEditor(body, arr, label, rebuild) {
  arr.forEach((item, i) => { const row = el("div", "pk__item"); row.appendChild(pair(`${label} ${i + 1}`, arr, i, { area: true })); const del = el("button", "pk__del", "Remove"); del.type = "button"; del.addEventListener("click", () => { arr.splice(i, 1); rebuild(); changed(); }); row.appendChild(del); body.appendChild(row); });
  const add = el("button", "btn pk__add", "Add"); add.type = "button"; add.addEventListener("click", () => { arr.push(B()); rebuild(); changed(); }); body.appendChild(add);
}
function stepsEditor(body, arr, rebuild) {
  arr.forEach((st, i) => { const row = el("div", "pk__item"); row.appendChild(pair(`Step ${i + 1}`, st, "title")); row.appendChild(pair("What happens", st, "text", { area: true })); row.appendChild(pair("When (optional)", st, "when"));
    const del = el("button", "pk__del", "Remove"); del.type = "button"; del.addEventListener("click", () => { arr.splice(i, 1); rebuild(); changed(); }); row.appendChild(del); body.appendChild(row); });
  const add = el("button", "btn pk__add", "Add a step"); add.type = "button"; add.addEventListener("click", () => { arr.push({ title: B(), text: B(), when: B() }); rebuild(); changed(); }); body.appendChild(add);
}
function scheduleEditor(body, rebuild) {
  const p = S.p; let sum = null;
  p.schedule.forEach((x, i) => { const row = el("div", "pk__item"), line = el("div", "pk__sched"); line.appendChild(pair(`Instalment ${i + 1}`, x, "label"));
    const pct = input(() => x.pct, (v) => { x.pct = v; }, { type: "number" }); pct.min = 0; pct.max = 100; pct.addEventListener("input", () => showSum()); line.appendChild(field("%", pct));
    const del = el("button", "pk__del", "Remove"); del.type = "button"; del.addEventListener("click", () => { p.schedule.splice(i, 1); rebuild(); changed(); }); line.appendChild(del); row.appendChild(line); body.appendChild(row); });
  const add = el("button", "btn pk__add", "Add an instalment"); add.type = "button"; add.addEventListener("click", () => { p.schedule.push({ label: B(), pct: 0 }); rebuild(); changed(); }); body.appendChild(add);
  sum = el("p", "pk__sum"); body.appendChild(sum);
  function showSum() { const t = p.schedule.reduce((a, x) => a + (Number(x.pct) || 0), 0); sum.textContent = `Instalments add up to ${t}%.`; sum.classList.toggle("is-bad", Math.abs(t - 100) > 0.01); }
  showSum();
}

/* ---------- the form ---------- */
function buildForm() {
  const f = $("form"), p = S.p, o = offerByKey(p.offer); f.textContent = ""; f.dataset.mode = p.mode;
  f.appendChild(section("Proposal", true, (b) => {
    b.appendChild(field("Offer", select(OFFERS.map((x) => [x.key, x.name.en]), () => p.offer, (v) => switchOffer(v))));
    const seg = el("div", "seg"); for (const [v, t] of [["bi", "Bilingual"], ["id", "Bahasa Indonesia"], ["en", "English"]]) { const btn = el("button", p.mode === v ? "is-on" : "", t); btn.type = "button"; btn.addEventListener("click", () => { p.mode = v; buildForm(); changed(); }); seg.appendChild(btn); }
    b.appendChild(field("Language", seg));
    const r = el("div", "pk__row"); r.appendChild(field("Date", input(() => p.date, (v) => { p.date = v || p.date; }, { type: "date" }))); r.appendChild(field("Reference", input(() => p.ref, (v) => { p.ref = v; }))); b.appendChild(r);
  }));
  f.appendChild(section("Client", true, (b) => {
    const c = p.client; b.appendChild(field("Company", input(() => c.company, (v) => { c.company = v; }, { ph: "PT …" }))); b.appendChild(field("Address", input(() => c.address, (v) => { c.address = v; })));
    let r = el("div", "pk__row"); r.appendChild(field("Contact person", input(() => c.contact, (v) => { c.contact = v; }))); r.appendChild(field("Contact email", input(() => c.email, (v) => { c.email = v; }, { type: "email" }))); b.appendChild(r);
    r = el("div", "pk__row"); r.appendChild(field("Signatory", input(() => c.signatory, (v) => { c.signatory = v; }))); r.appendChild(field("Signatory's title", input(() => c.signatoryTitle, (v) => { c.signatoryTitle = v; }))); b.appendChild(r);
    b.appendChild(check("Indonesian party (the agreement should be in Bahasa Indonesia)", () => c.indonesian, (v) => { c.indonesian = v; }));
  }));
  f.appendChild(section("Engagement", true, (b) => {
    b.appendChild(pair("Subject", p, "subject", { ph: o.subjectHint }));
    b.appendChild(el("p", "pk__hint", `Completes the sentence: "${o.objective.en.split("{subject}")[0]}…"`));
    b.appendChild(pair("Your situation (optional)", p, "situation", { area: "tall" }));
    b.appendChild(pair("Who will do the work (optional)", p, "team", { area: true }));
    b.appendChild(el("p", "pk__hint", "Name only the people who will actually do the work. Empty sections are left out of the document."));
  }));
  f.appendChild(section("Fee", true, (b) => {
    const row = el("div", "pk__fee"), words = el("p", "pk__words");
    row.appendChild(field("Currency", select(Object.keys(CURRENCIES).map((k) => [k, k]), () => p.currency, (v) => { p.currency = v; changed(); showWords(); })));
    const fee = input(() => (p.fee ? money(p.fee, p.currency, "en").replace(/^\S+\s/, "") : ""), (v) => { p.fee = parseAmount(v); showWords(); }, { ph: o.planFee ? `Working price in the business plan: ${money(o.planFee, "IDR", "en")}` : "" }); fee.inputMode = "numeric";
    fee.addEventListener("blur", () => { fee.value = p.fee ? money(p.fee, p.currency, "en").replace(/^\S+\s/, "") : ""; });
    row.appendChild(field(o.basis === "monthly" ? "Monthly fee" : "Fee", fee)); b.appendChild(row); b.appendChild(words);
    if (o.basis === "monthly") { const m = input(() => p.months, (v) => { p.months = v; showWords(); }, { type: "number" }); m.min = 1; b.appendChild(field("Term (months)", m)); b.appendChild(pair("How it is invoiced", p, "payment", { area: true })); }
    else { const sched = el("div", "pk__body"); sched.style.padding = "0"; const draw = () => { sched.textContent = ""; scheduleEditor(sched, draw); }; draw(); b.appendChild(sched); }
    function showWords() { const T = totals(p, S.s); words.textContent = T.total ? `${money(T.total, p.currency, "en")}${T.basis === "monthly" ? ` for ${T.months} months` : ""}${T.rate ? ` including VAT ${T.rate}%` : ""}: ${moneyWords(T.total, p.currency, "en")} / ${moneyWords(T.total, p.currency, "id")}` : ""; }
    showWords();
  }));
  const lists = [["deliverables", "What you receive", "Item"], ["inputs", "What we need from you", "Item"], ["assumptions", "Assumptions", "Assumption"], ["exclusions", "Not included", "Item"]];
  const scope = (key, title, label) => { const d = section(title, false, (b) => { const draw = () => { b.textContent = ""; listEditor(b, p[key], label, () => { draw(); d.querySelector("small").textContent = String(p[key].length); }); }; draw(); }, String(p[key].length)); return d; };
  f.appendChild(scope(...lists[0]));
  const steps = section("How it runs", false, (b) => { const draw = () => { b.textContent = ""; stepsEditor(b, p.steps, () => { draw(); steps.querySelector("small").textContent = String(p.steps.length); }); }; draw(); }, String(p.steps.length)); f.appendChild(steps);
  for (const x of lists.slice(1)) f.appendChild(scope(...x));
}

function switchOffer(key) {
  if (key === S.p.offer) return;
  if (edited(S.p) && !confirm(`Replace the scope, steps and payment schedule with the ${offerByKey(key).name.en} defaults? The client details are kept; the fee is cleared.`)) { buildForm(); return; }
  const keep = S.p, p = newProposal(key, S.s); Object.assign(p, { ref: keep.ref, date: keep.date, mode: keep.mode, currency: keep.currency, client: keep.client, situation: keep.situation, team: keep.team });
  S.p = p; buildForm(); changed();
}

/* ---------- settings ---------- */
function buildSettings() {
  const f = $("settings-form"), s = S.s; f.textContent = ""; f.dataset.mode = "bi";
  f.appendChild(el("h2", "", "Settings"));
  f.appendChild(el("p", "pk__hint", "Kept in this browser and used for every proposal. Nothing here is sent anywhere."));
  const txt = (label, key, o = {}) => field(label, input(() => s[key], (v) => { s[key] = v; saveSettings(); }, o), o.hint);
  const row = (...xs) => { const r = el("div", `pk__row${xs.length === 3 ? " pk__row--3" : ""}`); xs.forEach((x) => r.appendChild(x)); return r; };
  f.appendChild(el("h3", "", "The firm"));
  f.appendChild(row(txt("Trading name", "tradingName"), txt("Legal entity name", "legalName", { ph: "PT …", hint: "The party that signs the letter." })));
  f.appendChild(txt("Address", "address"));
  f.appendChild(row(txt("Signatory", "signatory"), txt("Signatory's title", "signatoryTitle")));
  f.appendChild(el("h3", "", "Payment"));
  f.appendChild(row(txt("Invoices payable within (days)", "days", { type: "number" }), txt("Notice to end (days)", "notice", { type: "number" }), txt("Proposal valid for (days)", "validDays", { type: "number" })));
  f.appendChild(txt("VAT rate (%)", "vatRate", { ph: "Leave empty unless the firm charges VAT", hint: "Only if the firm is registered to charge VAT (PKP). Empty: the terms say fees exclude VAT and other taxes." }));
  f.appendChild(row(txt("Bank", "bankName"), txt("Account number", "bankAccount"), txt("Account holder", "bankHolder")));
  f.appendChild(txt("Website for online acceptance", "acceptUrl", { ph: "https://www.metanoiaadvisors.com", hint: "Once the terms are reviewed by counsel, the acceptance section names the website's acceptance page with the proposal's reference filled in. Leave empty to leave it out." }));
  f.appendChild(el("h3", "", "Terms"));
  const forum = pair("Disputes are settled by (optional)", s, "forum"); forum.addEventListener("input", saveSettings); f.appendChild(forum);
  f.appendChild(el("p", "pk__hint", "For example a named court or arbitration body. Leave empty until counsel advises: the clause then ends after 30 days of good-faith discussion."));
  f.appendChild(check("Leave space for stamp duty (meterai) in the Indonesian signature block", () => s.meterai, (v) => { s.meterai = v; saveSettings(); }));
  const rv = el("div", "pk__reviewed"); rv.appendChild(check("The standard terms have been reviewed by our counsel", () => s.reviewed, (v) => { s.reviewed = v; saveSettings(); }));
  rv.appendChild(el("p", "pk__hint", "Until this is ticked, every proposal says it is a draft for review by counsel. The wording of the terms is in js/proposals/terms.js; tick this only once counsel has approved that text.")); f.appendChild(rv);
  const foot = el("footer"), close = el("button", "btn btn--primary", "Done"); close.value = "done"; foot.appendChild(close); f.appendChild(foot);
}

/* ---------- preview, problems, export ---------- */
let timer = 0;
function changed() { clearTimeout(timer); timer = setTimeout(render, 180); }
function render() {
  const p = S.p, o = offerByKey(p.offer), frame = $("preview"), y = frame.contentWindow ? frame.contentWindow.scrollY : 0;
  save();
  $("doc-name").textContent = p.ref; $("doc-meta").textContent = [o.name.en, p.client.company].filter(Boolean).join(" · ");
  frame.onload = () => { try { frame.contentWindow.scrollTo(0, y); } catch (e) { /* not yet ready */ } };
  frame.srcdoc = proposalHtml(p, S.s);
  const list = $("problems"), ps = problems(p, S.s); list.textContent = "";
  for (const x of ps) list.appendChild(el("li", x.level === "error" ? "is-error" : "", x.text));
  if (!ps.length) list.appendChild(el("li", "is-ok", "Ready to send."));
  const blocked = ps.some((x) => x.level === "error"); $("btn-docx").disabled = blocked; $("btn-print").disabled = blocked;
  $("btn-docx").title = blocked ? "Fix the points marked in red first" : "Save as a Word document for counsel or the client to mark up";
  fillRecent();
}
function fillRecent() {
  const sel = $("recent"), all = Object.values(read(KEY.saved, {})).sort((a, b) => (b.updated || 0) - (a.updated || 0)); sel.textContent = "";
  const head = el("option", "", "Recent proposals"); head.value = ""; sel.appendChild(head);
  for (const x of all) { const o = el("option", "", `${x.ref} · ${x.client.company || "no client yet"}`); o.value = x.ref; sel.appendChild(o); }
  sel.value = "";
}
const fileBase = () => { const p = S.p; return [p.ref.replace(/[\\/:*?"<>|]+/g, "-"), p.client.company, offerByKey(p.offer).name[p.mode === "id" ? "id" : "en"]].filter(Boolean).join(" ").replace(/[\\/:*?"<>|]+/g, " ").trim(); };
async function saveDocx() {
  try { const blob = await proposalDocx(S.p, S.s, window.JSZip).generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); download(blob, `${fileBase()}.docx`); toast(S.s.reviewed ? "Word document saved." : "Word document saved. It is marked as a draft until counsel has reviewed the terms."); }
  catch (e) { toast("The Word document could not be made.", "error"); }
}
function print() { const t = document.title; document.title = fileBase(); const w = $("preview").contentWindow; w.focus(); w.print(); setTimeout(() => { document.title = t; }, 1000); }

/* ---------- a brief from the website ---------- */
function importBrief(text) {
  let b; try { b = decodeBrief(text); } catch (e) { $("brief-error").textContent = e.message; return false; }
  S.s.counter = (Number(S.s.counter) || 0) + 1; saveSettings();
  const p = proposalFromBrief(b, newProposal, S.s); p.ref = makeRef(p.date, S.s.counter); S.p = p;
  $("brief").close(); buildForm(); render();
  toast(`Proposal ${p.ref} started from ${b.company || "the"} brief. Check the offer, write the subject in the other language if needed, and enter the fee.`);
  return true;
}

/* ---------- start ---------- */
function start() {
  S.s = loadSettings(); S.p = read(KEY.current, null) || fresh();
  buildForm(); buildSettings(); render();
  $("btn-new").addEventListener("click", () => { S.p = fresh(S.p.offer); buildForm(); render(); toast(`New proposal ${S.p.ref}.`); });
  $("btn-settings").addEventListener("click", () => { buildSettings(); $("settings").showModal(); });
  $("settings").addEventListener("close", () => { buildForm(); render(); });
  $("btn-docx").addEventListener("click", saveDocx);
  $("btn-brief").addEventListener("click", () => { $("brief-text").value = ""; $("brief-error").textContent = ""; $("brief").showModal(); $("brief-text").focus(); });
  $("brief-cancel").addEventListener("click", () => $("brief").close());
  $("brief-go").addEventListener("click", () => importBrief($("brief-text").value));
  $("btn-print").addEventListener("click", print);
  $("recent").addEventListener("change", (e) => { const x = read(KEY.saved, {})[e.target.value]; if (x) { S.p = x; buildForm(); render(); } });
  window.__proposals = { S, render, buildForm, importBrief, problems: () => problems(S.p, S.s), html: () => proposalHtml(S.p, S.s), docx: () => proposalDocx(S.p, S.s, window.JSZip), fresh: (k) => { S.p = fresh(k); buildForm(); render(); } };
  document.documentElement.dataset.ready = "1";
}
if (window.JSZip) start(); else window.addEventListener("load", start);
