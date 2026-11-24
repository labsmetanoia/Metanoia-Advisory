// The free deck check. It runs the Deck Auditor's own modules in the visitor's browser: the file is read locally and
// nothing about it is sent anywhere. The page shows the counts and the three findings to look at first.
import { readPptx } from "./audit/pptx.js";
import { audit } from "./audit/checks.js";
import { idFinding, ACTIONS_ID } from "./audit/id.js";
import { ACTIONS } from "./audit/report.js";

const $ = (id) => document.getElementById(id), el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const T = JSON.parse($("dc-strings").textContent), lang = $("dc-script").dataset.lang === "id" ? "id" : "en";
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : ""));
const drop = $("dc-drop"), status = $("dc-status"), input = $("dc-file"), result = $("dc-result");
const MAX = 150 * 1024 * 1024, RANK = { high: 0, medium: 1, low: 2 };

function say(text, error = false) { status.textContent = text; status.classList.toggle("dc-drop__status--error", error); }
function state(s) { drop.dataset.state = s; }

// The three to show: the most serious first, and among equals one from each pillar before a second from the same one.
function firstThree(findings) {
  const left = findings.slice(), out = [], used = {};
  while (out.length < 3 && left.length) { let best = 0, score = Infinity; left.forEach((f, i) => { const s = RANK[f.severity] * 10 + (used[f.pillar] || 0); if (s < score) { score = s; best = i; } }); const [f] = left.splice(best, 1); used[f.pillar] = (used[f.pillar] || 0) + 1; out.push(f); }
  return out;
}

function show(file, deck, res) {
  const all = res.findings, n = (s, list = all) => list.filter((f) => f.severity === s).length, high = n("high");
  $("dc-name").textContent = file.name;
  $("dc-headline").textContent = high > 1 ? fill(T.headFix, { n: high }) : high === 1 ? T.headFix1 : all.length ? fill(T.headCheck, { n: all.length }) : T.headClean;
  $("dc-meta").textContent = fill(deck.kind === "pdf" ? T.metaPdf : T.meta, { slides: res.stats.slides, figures: res.stats.figures, share: res.stats.actionShare }) + (all.length ? "" : ` ${T.cleanText}`);
  const pillars = $("dc-pillars"); pillars.textContent = "";
  for (const p of ["numbers", "structure", "design"]) { const fs = all.filter((f) => f.pillar === p), box = el("div", "dc-pillar"); box.appendChild(el("p", "dc-pillar__name", T.pillars[p])); const big = el("p", "dc-pillar__n"); big.appendChild(el("strong", "", String(fs.length))); big.appendChild(el("span", "", ` ${T.findings}`)); box.appendChild(big);
    const bar = el("div", "dc-pillar__bar"); for (const s of ["high", "medium", "low"]) { const k = n(s, fs); if (k) { const seg = el("i", `dc-sev--${s}`); seg.style.flexGrow = String(k); bar.appendChild(seg); } } box.appendChild(bar);
    box.appendChild(el("p", "dc-pillar__counts", fill(T.counts, { h: n("high", fs), m: n("medium", fs), l: n("low", fs) }))); pillars.appendChild(box); }
  const first = firstThree(all), list = $("dc-findings"); list.textContent = ""; $("dc-first-wrap").hidden = !first.length;
  for (const f of first) { const t = lang === "id" ? idFinding(f) : f, card = el("article", `dc-finding dc-finding--${f.severity}`), head = el("header");
    head.appendChild(el("b", "", T.sev[f.severity])); head.appendChild(el("h4", "", t.title)); head.appendChild(el("i", "", f.slides.length ? `${f.slides.length > 1 ? T.slides : T.slide} ${f.slides.slice(0, 12).join(", ")}${f.slides.length > 12 ? "…" : ""}` : T.whole)); card.appendChild(head);
    card.appendChild(el("p", "dc-finding__detail", t.detail)); const act = (lang === "id" ? ACTIONS_ID : ACTIONS)[f.code]; if (act) { const p = el("p", "dc-finding__do"); p.appendChild(el("strong", "", `${T.todo} `)); p.appendChild(document.createTextNode(act)); card.appendChild(p); }
    list.appendChild(card); }
  const rest = all.filter((f) => !first.includes(f));
  $("dc-more").textContent = rest.length > 1 ? fill(T.moreLine, { n: rest.length, h: n("high", rest), m: n("medium", rest), l: n("low", rest) }) : rest.length === 1 ? T.moreLine1 : T.moreNone;
  document.querySelector(".dc-more").hidden = !all.length;
  result.hidden = false; state("done"); say(""); $("dc-headline").focus({ preventScroll: true }); result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

async function run(file) {
  if (!file) return; result.hidden = true;
  const kind = /\.pptx$/i.test(file.name) ? "pptx" : /\.pdf$/i.test(file.name) || file.type === "application/pdf" ? "pdf" : null;
  if (!kind) { state("idle"); return say(T.errType, true); }
  if (file.size > MAX) { state("idle"); return say(T.errSize, true); }
  state("busy"); say(T.reading);
  try {
    const deck = kind === "pptx" ? await readPptx(file) : await (await import("./audit/pdfdeck.js")).readPdf(file, () => {}, { render: false });
    if (!deck.slides.length || deck.slides.reduce((a, s) => a + s.words, 0) < 12) { state("idle"); return say(T.errEmpty, true); }
    say(T.checking); await new Promise((r) => setTimeout(r, 30));
    show(file, deck, audit(deck, {}));
  } catch (e) { state("idle"); say(T.errRead, true); }
}

input.addEventListener("change", () => { run(input.files[0]); input.value = ""; });
for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); });
for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); });
drop.addEventListener("drop", (e) => run(e.dataTransfer && e.dataTransfer.files[0]));
// a file dropped beside the box should be checked, not opened by the browser
window.addEventListener("dragover", (e) => e.preventDefault()); window.addEventListener("drop", (e) => { e.preventDefault(); if (!drop.contains(e.target)) run(e.dataTransfer && e.dataTransfer.files[0]); });
$("dc-sample").addEventListener("click", async () => { state("busy"); say(T.reading); try { const r = await fetch($("dc-sample").dataset.src); if (!r.ok) throw new Error("missing"); run(new File([await r.blob()], "sample-deck.pptx")); } catch (e) { state("idle"); say(T.errRead, true); } });
$("dc-again").addEventListener("click", () => { result.hidden = true; state("idle"); say(""); drop.scrollIntoView({ block: "center" }); input.click(); });
document.documentElement.dataset.deckCheck = "ready";
