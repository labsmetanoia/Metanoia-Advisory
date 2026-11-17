// Deck Auditor — the audit itself. Three pillars, as the firm sells them:
//   structure  "Consulting structure": an answer-first storyline carried by action titles
//   design     "Executive-grade design": one typographic system, one grid, nothing left over from drafting
//   numbers    "Numbers that match": every figure agrees with every other mention of it and with its own arithmetic
// Each finding names the slides and shapes it concerns so the reader can go straight to them.
import { detectLanguage, collectFacts, metricGroups, arithmeticChecks, headlineChecks } from "./numbers.js";

const VERB_EN = /\b(is|are|was|were|be|been|has|have|had|will|would|can|could|should|must|may|does|do|did|needs?|requires?|shows?|drives?|delivers?|remains?|becomes?|grows?|grew|rose|rises?|fell|falls?|leads?|led|gives?|takes?|makes?|keeps?|puts?|holds?|wins?|won|lost|loses?|cuts?|adds?|pays?|costs?|saves?|doubles?|triples?|halves|exceeds?|outperforms?|lags?|depends?|comes?|came|accounts?|represents?|supplied|supplies|recovered|reached|carry|carries|means?|lets?|allows?|enables?|turns?|moves?|shifts?)\b|\S\s+\w{3,}ed\b/i;   // "-ed" counts unless it opens the title ("Proposed structure"); "-ing" nouns (pricing, storytelling) do not
const VERB_ID = /\b(adalah|akan|telah|sudah|dapat|harus|perlu|naik|turun|tumbuh|tetap|menjadi|memiliki|menunjukkan|mendorong|memberikan|menghasilkan|mencapai|menurun|meningkat|butuh|ada|merupakan)\b|\b(me|mem|men|meng|ber|di|ter)[a-z]{4,}\b/i;
const EXEMPT = /^(executive summary|ringkasan eksekutif|key messages?|pesan utama|next steps?|langkah (selanjutnya|berikutnya)|agenda|contents?|table of contents|appendix|appendices|lampiran|daftar isi|thank you|thanks|terima kasih|q\s?&\s?a|questions\??|disclaimer|important notice|glossary|contact|kontak|backup|back-up)\b/i;
const DRAFT = /\b(lorem ipsum|tbd|tbc|to be (?:confirmed|determined|updated)|placeholder|xx+%?|x\.x+|\?\?+|insert (?:text|chart|image|logo|here)|click to (?:add|edit)|klik untuk|dummy|sample text|update (?:this|number|figure)|check (?:this|number|figure)|\[[^\]]{0,40}\])/i;
const SOURCE = /^\s*(sources?|sumber|note|notes|catatan|keterangan)\s*[:.]/im;
const mode = (arr) => { const m = new Map(); for (const v of arr) m.set(v, (m.get(v) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]; };
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const list = (ns, max = 12) => { const u = [...new Set(ns)].sort((a, b) => a - b); return u.length > max ? `${u.slice(0, max).join(", ")} and ${u.length - max} more` : u.join(", "); };
export const wordCount = (t) => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’%.,-]*/gu) || []).length;

export function classifyTitle(text, lang) {
  const t = text.trim(), n = wordCount(t); if (!t) return { kind: "missing", words: 0 };
  if (EXEMPT.test(t)) return { kind: "exempt", words: n };
  const verb = (lang === "id" ? VERB_ID : VERB_EN).test(t), figure = /\d/.test(t);
  if (n >= 6 && (verb || figure)) return { kind: "action", words: n };
  if (n >= 4 && verb) return { kind: "action", words: n };
  return { kind: n <= 5 ? "label" : "topic", words: n };
}

export function audit(deck, options = {}) {
  const findings = []; let seq = 0;
  const add = (pillar, f) => { const x = { id: `f${++seq}`, pillar, severity: "medium", slides: f.slide ? [f.slide] : [], refs: f.slide && f.shapeId ? [{ slide: f.slide, shapeId: f.shapeId }] : [], ...f }; x.slides = [...new Set(x.slides)].sort((a, b) => a - b); findings.push(x); };
  const document = deck.height > deck.width * 1.05;   // portrait pages are a report, not slides: density and type-size rules for slides do not apply
  const lang = detectLanguage(deck.slides.map((s) => s.text).join("\n")).lang; deck.lang = lang;
  const live = deck.slides.filter((s) => !s.hidden), n = live.length;
  const isCover = (s) => s.index === 1 || (!s.shapes.some((x) => x.kind === "chart" || x.kind === "table" || (x.kind === "picture" && x.w * x.h < deck.width * deck.height * 0.9 && x.w * x.h > deck.width * deck.height * 0.04)) && s.words <= 12);   // cover and section dividers
  const langOf = (s) => { const d = detectLanguage(s.text); return d.en + d.id >= 4 && d.share >= 0.7 ? d.lang : lang; };
  const content = live.filter((s) => !isCover(s) && !(s.title && EXEMPT.test(s.title.text)));

  /* ---------- structure ---------- */
  const titles = live.map((s) => ({ s, ...(s.title ? classifyTitle(s.title.text, langOf(s)) : { kind: "missing", words: 0 }) }));
  for (const t of titles) { t.cover = isCover(t.s); t.s.titleKind = t.cover && t.kind !== "action" ? (t.kind === "missing" ? "missing" : "cover") : t.kind; }
  const labels = titles.filter((t) => !t.cover && (t.kind === "label" || t.kind === "topic")), missing = titles.filter((t) => t.kind === "missing" && !t.cover && t.s.words > 8);
  const judged = titles.filter((t) => t.kind !== "exempt" && !(t.cover && t.kind !== "action")), actionShare = pct(judged.filter((t) => t.kind === "action").length, judged.length || 1);
  if (labels.length) add("structure", { code: "label-titles", severity: labels.length > content.length * 0.4 ? "high" : "medium", title: `${labels.length} slide${labels.length > 1 ? "s have" : " has"} a label where a conclusion should be`, detail: `An action title is a full sentence that states what the page proves. These titles name a topic instead: ${labels.slice(0, 6).map((t) => `"${t.s.title.text.slice(0, 60)}" (${t.s.index})`).join("; ")}${labels.length > 6 ? "; …" : ""}.`, slides: labels.map((t) => t.s.index), refs: labels.map((t) => ({ slide: t.s.index, shapeId: t.s.title.shapeId })) });
  if (missing.length) add("structure", { code: "no-title", severity: "high", title: `${missing.length} slide${missing.length > 1 ? "s have" : " has"} no title`, detail: `A reader skimming the deck by its titles loses the thread on slide${missing.length > 1 ? "s" : ""} ${list(missing.map((t) => t.s.index))}.`, slides: missing.map((t) => t.s.index) });
  const long = titles.filter((t) => t.words > 24); if (long.length) add("structure", { code: "long-title", severity: "low", title: `${long.length} title${long.length > 1 ? "s run" : " runs"} past two lines`, detail: `Titles over about 24 words stop being read as one thought: slide${long.length > 1 ? "s" : ""} ${list(long.map((t) => t.s.index))}.`, slides: long.map((t) => t.s.index), refs: long.map((t) => ({ slide: t.s.index, shapeId: t.s.title.shapeId })) });
  const seen = new Map(); for (const t of titles) if (t.s.title && !t.cover && t.kind !== "exempt") { const k = t.s.title.text.toLowerCase().replace(/\s+/g, " ").replace(/\s*\(?(cont(inued|'d|\.)?|lanjutan|\d+\/\d+)\)?$/i, ""); if (!seen.has(k)) seen.set(k, []); seen.get(k).push(t.s.index); }
  for (const [k, where] of seen) if (where.length > 1) add("structure", { code: "duplicate-title", severity: "medium", title: `The same title is used on ${where.length} slides`, detail: `"${k.slice(0, 90)}" appears on slides ${list(where)}. Each page should make its own point; if it is one argument over several pages, say what each adds.`, slides: where });
  if (n >= 8) {
    const front = live.slice(0, 4).some((s) => /executive summary|ringkasan eksekutif|key messages?|summary|ringkasan|at a glance|sekilas|overview of (the )?(recommendation|findings)/i.test((s.title && s.title.text) || s.text.slice(0, 80)));
    if (!front) add("structure", { code: "no-summary", severity: "medium", title: "No executive summary in the first pages", detail: "A senior reader should be able to stop after page two or three with the answer. No page near the front is titled as a summary or key messages.", slides: [] });
    const ask = live.some((s) => /\b(recommendation|recommend|next steps?|decision|the ask|approval|rekomendasi|langkah (selanjutnya|berikutnya)|keputusan|persetujuan)\b/i.test((s.title && s.title.text) || ""));
    if (!ask) add("structure", { code: "no-ask", severity: "low", title: "No page states the decision or next steps", detail: "None of the titles names a recommendation, a decision or next steps. If the deck asks for something, give the request its own page.", slides: [] });
  }
  const dense = document ? [] : content.filter((s) => s.words > 150); if (dense.length) add("structure", { code: "dense", severity: "low", title: `${dense.length} slide${dense.length > 1 ? "s carry" : " carries"} more than 150 words`, detail: `Slide${dense.length > 1 ? "s" : ""} ${dense.map((s) => `${s.index} (${s.words})`).join(", ")}. Past that, a page is read as a document, not presented. Split it or move detail to an appendix.`, slides: dense.map((s) => s.index) });
  const foreign = content.map((s) => ({ s, d: detectLanguage(s.text) })).filter((x) => x.d.en + x.d.id >= 6 && x.d.lang !== lang && x.d.share >= 0.7);
  if (foreign.length) add("structure", { code: "language", severity: "medium", title: `${foreign.length} slide${foreign.length > 1 ? "s are" : " is"} in ${lang === "en" ? "Indonesian" : "English"} in ${lang === "en" ? "an English" : "an Indonesian"} deck`, detail: `Slide${foreign.length > 1 ? "s" : ""} ${list(foreign.map((x) => x.s.index))}. Check that this is intended and not a page left over from the other language version.`, slides: foreign.map((x) => x.s.index) });

  /* ---------- numbers ---------- */
  const facts = collectFacts(deck, lang), groups = metricGroups(facts);
  for (const g of groups.filter((x) => x.status === "mismatch")) { const slides = [...new Set(g.facts.map((f) => f.slide))]; add("numbers", { code: "mismatch", severity: "high", title: `"${g.label}"${g.periods.length ? ` (${g.periods.join(", ")})` : ""} is shown as ${g.distinct.map((f) => f.raw).join(" and ")}`, detail: g.facts.map((f) => `Slide ${f.slide}: ${f.raw} — ${f.context}`).join("\n"), slides, refs: g.facts.map((f) => ({ slide: f.slide, shapeId: f.shapeId })), group: g }); }
  const prec = groups.filter((x) => x.status === "precision"); if (prec.length) add("numbers", { code: "precision", severity: "low", title: `${prec.length} figure${prec.length > 1 ? "s are" : " is"} shown with different rounding in different places`, detail: prec.slice(0, 8).map((g) => `"${g.label}": ${[...new Set(g.facts.map((f) => `${f.raw} (slide ${f.slide})`))].join(", ")}`).join("\n"), slides: [...new Set(prec.flatMap((g) => g.facts.map((f) => f.slide)))], refs: prec.flatMap((g) => g.facts.map((f) => ({ slide: f.slide, shapeId: f.shapeId }))) });
  for (const f of arithmeticChecks(deck, lang)) add("numbers", f);
  for (const f of headlineChecks(deck, facts)) add("numbers", f);
  const unsourced = content.filter((s) => { const data = s.shapes.some((x) => (x.kind === "chart" && x.chart) || x.kind === "table") || facts.filter((f) => f.slide === s.index && f.where === "body").length >= 5; return data && !SOURCE.test(s.text); });
  if (unsourced.length) add("numbers", { code: "no-source", severity: unsourced.length > 2 ? "medium" : "low", title: `${unsourced.length} data slide${unsourced.length > 1 ? "s have" : " has"} no source line`, detail: `Slide${unsourced.length > 1 ? "s" : ""} ${list(unsourced.map((s) => s.index))} show${unsourced.length > 1 ? "" : "s"} a chart, a table or several figures without "Source:" or "Note:". A figure without a source is the first thing a board member questions.`, slides: unsourced.map((s) => s.index) });

  /* ---------- design ---------- */
  const drafts = []; for (const s of live) for (const sh of s.shapes) { const m = DRAFT.exec(sh.text || ""); if (m) drafts.push({ slide: s.index, shapeId: sh.id, hit: m[0] }); }
  if (drafts.length) add("design", { code: "draft-marks", severity: "high", title: `${drafts.length} draft marker${drafts.length > 1 ? "s are" : " is"} still in the deck`, detail: drafts.slice(0, 10).map((d) => `Slide ${d.slide}: "${d.hit}"`).join("\n"), slides: drafts.map((d) => d.slide), refs: drafts });
  if (deck.kind === "pptx") {
    const empties = live.flatMap((s) => s.shapes.filter((x) => x.emptyPlaceholder && !["slidenum", "date", "footer"].includes(x.role)).map((x) => ({ slide: s.index, shapeId: x.id })));
    if (empties.length) add("design", { code: "empty-placeholder", severity: "low", title: `${empties.length} empty placeholder${empties.length > 1 ? "s" : ""} left on slides`, detail: `Slide${empties.length > 1 ? "s" : ""} ${list(empties.map((e) => e.slide))}. They do not print, but they show "Click to add text" to anyone who opens the file to edit it. Delete them.`, slides: empties.map((e) => e.slide), refs: empties });
    // typefaces
    const fontChars = new Map(), fontSlides = new Map(); let total = 0;
    for (const s of live) for (const sh of s.shapes) for (const p of sh.paras) for (const r of p.runs) { const c = r.text.trim().length; if (!c || !r.font) continue; total += c; fontChars.set(r.font, (fontChars.get(r.font) || 0) + c); if (!fontSlides.has(r.font)) fontSlides.set(r.font, new Map()); fontSlides.get(r.font).set(s.index, sh.id); }
    const ranked = [...fontChars.entries()].sort((a, b) => b[1] - a[1]); deck.fonts = ranked.map(([f, c]) => ({ font: f, share: pct(c, total), slides: [...fontSlides.get(f).keys()] }));
    const house = options.brand && options.brand.fonts ? [options.brand.fonts.heading, options.brand.fonts.body] : null;
    const stray = deck.fonts.filter((f, i) => (house ? !house.includes(f.font) : (i >= 2 && f.share < 8) || (i >= 1 && f.share < 10 && f.slides.length <= Math.max(1, n * 0.15))));   // a real second typeface recurs across the deck
    if (stray.length) add("design", { code: "fonts", severity: stray.some((f) => f.share >= 3) ? "medium" : "low", title: `${stray.length} stray typeface${stray.length > 1 ? "s" : ""} beside ${house ? "the house fonts" : deck.fonts.filter((f) => !stray.includes(f)).slice(0, 2).map((f) => f.font).join(" and ")}`, detail: stray.map((f) => `${f.font}: ${f.share < 1 ? "under 1" : f.share}% of the text, on slide${f.slides.length > 1 ? "s" : ""} ${list(f.slides, 8)}`).join("\n"), slides: [...new Set(stray.flatMap((f) => f.slides))], refs: stray.flatMap((f) => [...fontSlides.get(f.font).entries()].map(([slide, shapeId]) => ({ slide, shapeId }))) });
    // pictures: stretched or too coarse
    const stretched = [], coarse = [];
    for (const s of live) for (const sh of s.shapes) if (sh.kind === "picture" && sh.image && sh.w > 20 && sh.h > 20) { const cw = sh.image.pxW * (1 - sh.crop.l - sh.crop.r), chh = sh.image.pxH * (1 - sh.crop.t - sh.crop.b), ratio = (sh.w / sh.h) / (cw / chh); if (Math.abs(ratio - 1) > 0.04) stretched.push({ slide: s.index, shapeId: sh.id, by: Math.round(Math.abs(ratio - 1) * 100) }); const ppi = cw / (sh.w / 72); if (ppi < 96 && sh.w > deck.width * 0.18) coarse.push({ slide: s.index, shapeId: sh.id, ppi: Math.round(ppi) }); }
    if (stretched.length) add("design", { code: "stretched", severity: "medium", title: `${stretched.length} picture${stretched.length > 1 ? "s are" : " is"} stretched out of proportion`, detail: stretched.map((p) => `Slide ${p.slide}: distorted by ${p.by}%`).join("\n") + "\nReset the picture's size, then crop instead of dragging a side handle.", slides: stretched.map((p) => p.slide), refs: stretched });
    if (coarse.length) add("design", { code: "low-res", severity: "medium", title: `${coarse.length} picture${coarse.length > 1 ? "s are" : " is"} too coarse for the size shown`, detail: coarse.map((p) => `Slide ${p.slide}: ${p.ppi} pixels per inch`).join("\n") + "\nBelow about 96 it looks soft on screen; print needs 150 or more.", slides: coarse.map((p) => p.slide), refs: coarse });
    // page furniture
    const numbered = content.filter((s) => s.shapes.some((x) => x.role === "slidenum" || x.paras.some((p) => p.runs.some((r) => r.field === "slidenum"))));
    if (numbered.length >= content.length * 0.5 && numbered.length < content.length) { const miss = content.filter((s) => !numbered.includes(s)); add("design", { code: "page-number", severity: "low", title: `${miss.length} slide${miss.length > 1 ? "s have" : " has"} no page number`, detail: `Most slides are numbered; slide${miss.length > 1 ? "s" : ""} ${list(miss.map((s) => s.index))} ${miss.length > 1 ? "are" : "is"} not.`, slides: miss.map((s) => s.index) }); }
  }
  // titles: one size, one position
  const tshapes = content.filter((s) => s.title).map((s) => ({ s, sh: s.shapes.find((x) => x.id === s.title.shapeId) })).filter((x) => x.sh && x.sh.hasBox);
  if (tshapes.length >= 4) {
    const sized = tshapes.filter((x) => x.sh.size); if (sized.length >= 4) { const [ms] = mode(sized.map((x) => x.sh.size)); const off = sized.filter((x) => Math.abs(x.sh.size - ms) > Math.max(1, ms * 0.06)); if (off.length && off.length <= sized.length * 0.5) add("design", { code: "title-size", severity: "medium", title: `Title size changes on ${off.length} slide${off.length > 1 ? "s" : ""}`, detail: `Most titles are ${ms} pt. ${off.map((x) => `Slide ${x.s.index}: ${x.sh.size} pt`).join("; ")}.${deck.kind === "pptx" ? " Usually the text was shrunk to fit: shorten the title instead." : ""}`, slides: off.map((x) => x.s.index), refs: off.map((x) => ({ slide: x.s.index, shapeId: x.sh.id })) }); }
    const q = (v) => Math.round(v / (deck.width * 0.006)); const [mx] = mode(tshapes.map((x) => q(x.sh.x))), [my] = mode(tshapes.map((x) => q(x.sh.y)));
    const jump = tshapes.filter((x) => Math.abs(q(x.sh.x) - mx) > 2 || Math.abs(q(x.sh.y) - my) > 2); if (jump.length && jump.length <= tshapes.length * 0.4) add("design", { code: "title-position", severity: "low", title: `The title jumps position on ${jump.length} slide${jump.length > 1 ? "s" : ""}`, detail: `On most slides the title starts at the same point. On slide${jump.length > 1 ? "s" : ""} ${list(jump.map((x) => x.s.index))} it sits elsewhere, which shows as a flicker when paging through.`, slides: jump.map((x) => x.s.index), refs: jump.map((x) => ({ slide: x.s.index, shapeId: x.sh.id })) });
  }
  // small type and content past the edge
  const tiny = []; for (const s of document ? [] : content) for (const sh of s.shapes) if (sh.kind === "text" && sh.size && sh.size < (deck.kind === "pdf" ? deck.height * 0.0125 : 9) && sh.chars > 30 && !["footer", "slidenum", "date"].includes(sh.role) && !SOURCE.test(sh.text) && sh.y < deck.height * 0.9) tiny.push({ slide: s.index, shapeId: sh.id, size: sh.size });
  if (tiny.length) add("design", { code: "small-type", severity: "low", title: `Body text below ${deck.kind === "pdf" ? "a readable size" : "9 pt"} on ${new Set(tiny.map((t) => t.slide)).size} slide${new Set(tiny.map((t) => t.slide)).size > 1 ? "s" : ""}`, detail: `Slide${tiny.length > 1 ? "s" : ""} ${list(tiny.map((t) => t.slide))}. Text that small is not read in a meeting room or on a shared screen.`, slides: [...new Set(tiny.map((t) => t.slide))], refs: tiny });
  const over = []; for (const s of live) for (const sh of s.shapes) if (sh.hasBox && (sh.kind === "text" || sh.kind === "table" || sh.kind === "chart") && (sh.x < -1 || sh.y < -1 || sh.x + sh.w > deck.width + 1 || sh.y + sh.h > deck.height + 1)) over.push({ slide: s.index, shapeId: sh.id });
  if (over.length) add("design", { code: "off-slide", severity: "medium", title: `Content runs past the slide edge on ${new Set(over.map((o) => o.slide)).size} slide${new Set(over.map((o) => o.slide)).size > 1 ? "s" : ""}`, detail: `Slide${over.length > 1 ? "s" : ""} ${list(over.map((o) => o.slide))}: a text box, table or chart extends beyond the page and will be cut off in print and PDF.`, slides: [...new Set(over.map((o) => o.slide))], refs: over });
  const lefts = content.flatMap((s) => s.shapes.filter((x) => x.hasBox && x.kind === "text" && x.chars > 20 && x.x < deck.width * 0.3).map((x) => ({ s, x })));
  if (lefts.length >= 8) { const step = deck.width * 0.004, [ml, cnt] = mode(lefts.map((l) => Math.round(l.x.x / step))); if (cnt >= lefts.length * 0.3) { const tight = lefts.filter((l) => l.x.x < ml * step - step * 2.5 && l.x.x >= 0); const sl = [...new Set(tight.map((t) => t.s.index))]; if (sl.length && sl.length <= content.length * 0.4) add("design", { code: "margin", severity: "low", title: `Text breaks the left margin on ${sl.length} slide${sl.length > 1 ? "s" : ""}`, detail: `Most text starts ${Math.round(ml * step)} pt from the left edge. On slide${sl.length > 1 ? "s" : ""} ${list(sl)} a text box starts further out.`, slides: sl, refs: tight.map((t) => ({ slide: t.s.index, shapeId: t.x.id })) }); } }

  const order = { high: 0, medium: 1, low: 2 }; findings.sort((a, b) => order[a.severity] - order[b.severity] || (a.slides[0] || 0) - (b.slides[0] || 0));
  const count = (p) => ({ high: findings.filter((f) => f.pillar === p && f.severity === "high").length, medium: findings.filter((f) => f.pillar === p && f.severity === "medium").length, low: findings.filter((f) => f.pillar === p && f.severity === "low").length });
  return { findings, facts, groups, lang, document, stats: { slides: n, words: live.reduce((a, s) => a + s.words, 0), figures: facts.length, actionShare, titles: titles.length }, pillars: { structure: count("structure"), design: count("design"), numbers: count("numbers") } };
}
