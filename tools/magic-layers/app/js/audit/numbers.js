// Deck Auditor — "numbers that match". Finds every figure in a deck with the words that describe it, then checks:
// the same metric shown with different values, totals that do not add up, shares that do not make 100%,
// growth rates that do not follow from their own figures, and headline figures missing from their exhibit.
export const PERIOD = /\b(?:FY\s?'?\d{2,4}[EFA]?|[1-4]Q\s?'?\d{2,4}|Q[1-4](?:\s?'?\d{2,4})?|[12]H\s?'?\d{2,4}|H[12](?:\s?'?\d{2,4})?|9M\s?'?\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Mei|Jun|Jul|Aug|Agu|Sep|Oct|Okt|Nov|Dec|Des)[a-z]*\.?(?:\s*[-–]\s*[A-Z][a-z]+)?\s+(?:\d{1,2},?\s+)?(?:19|20)\d{2}|(?:19|20)\d{2}(?:\s?[/–-]\s?(?:(?:19|20)\d{2}|\d{2}))?[EFA]?|LTM|YTD|TTM)(?![\w%])/gi;
const NUMBER = /(?<![\p{L}\p{N}.,])([+\-−–]?)\s?(Rp\.?|IDR|USD|US\$|S\$|SGD|EUR|\$|€|£)?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s?(%|pp\b|bps\b|x\b|bn\b|billion\b|mn\b|million\b|mio\b|tn\b|trillion\b|triliun\b|miliar\b|milyar\b|juta\b|jt\b|ribu\b|rb\b|k\b|m\b|M\b|B\b|T\b|K\b)?/gu;
const UNIT = { "%": "%", pp: "pp", bps: "bps", x: "x", bn: "bn", billion: "bn", b: "bn", miliar: "bn", milyar: "bn", mn: "m", million: "m", mio: "m", m: "m", juta: "m", jt: "m", tn: "tn", trillion: "tn", triliun: "tn", t: "tn", ribu: "k", rb: "k", k: "k" };
const CURRENCY = { "rp": "IDR", "rp.": "IDR", idr: "IDR", usd: "USD", "us$": "USD", "$": "USD", "s$": "SGD", sgd: "SGD", eur: "EUR", "€": "EUR", "£": "GBP" };
const STOP = new Set(("the a an and or of to in on at for with by from as is are was were be been will would has have had this that these those its their our your it we they than then into over under per about around approximately nearly more less up down vs versus not no yes also only both each all any which who what when where while during after before between among across " +
  "recovered reached grew grow grows growing rose rise rises increased increase increases decreased decrease fell fall falls declined decline dropped stood remained remains expected estimated forecast compared delivered achieved recorded reported amounted totalled totaled came " +
  "dan atau yang di ke dari untuk dengan pada ini itu adalah akan telah sudah sebagai oleh dalam tidak juga lebih kurang sekitar hingga sampai atas bawah per antara serta karena saat sejak kami kita mereka nya " +
  "mencapai naik turun tumbuh meningkat menurun menjadi sebesar tercatat dibandingkan diperkirakan sebanyak senilai against compared previous prior terhadap dibanding sebelumnya").split(/\s+/));
const UNITWORD = new Set(["percent", "persen", "billion", "million", "trillion", "miliar", "juta", "triliun", "ribu", "usd", "idr", "rupiah", "dollar", "dollars", "rp", "bps", "basis", "points", "point", "poin"]);

export function detectLanguage(text) { const w = (text.toLowerCase().match(/[a-z]+/g) || []); let en = 0, id = 0; const E = new Set(["the", "and", "of", "to", "in", "for", "with", "is", "from", "by", "our", "that"]), I = new Set(["dan", "yang", "di", "untuk", "dengan", "dari", "pada", "ini", "adalah", "ke", "dalam", "akan"]); for (const x of w) { if (E.has(x)) en++; else if (I.has(x)) id++; } return { lang: id > en ? "id" : "en", en, id, share: (en + id) ? Math.max(en, id) / (en + id) : 1 }; }

// "1,250.5" / "1.250,5" / "12,6" / "1.250" → value and number of decimals, by the deck's language
export function parseNumber(raw, lang = "en") {
  const dots = (raw.match(/\./g) || []).length, commas = (raw.match(/,/g) || []).length; let dec = null;
  if (dots && commas) dec = raw.lastIndexOf(".") > raw.lastIndexOf(",") ? "." : ",";
  else if (dots + commas === 1) { const sep = dots ? "." : ",", [a, b] = raw.split(sep), grouped = b.length === 3 && a.length <= 3 && a !== "0";
    if (!grouped) dec = sep; else dec = (sep === "." ? lang !== "id" : lang === "id") ? sep : null; }   // "1.250" is a decimal in English and a thousand in Indonesian
  const clean = dec ? raw.split(dec === "." ? "," : ".").join("").replace(dec, ".") : raw.replace(/[.,]/g, "");
  return { value: Number(clean), decimals: dec ? clean.split(".")[1].length : 0 };
}
const stem = (w) => (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w);
export const wordsOf = (s) => (s.toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) || []).map((w) => w.replace(/['’-]/g, "")).filter((w) => w.length >= 2 && !STOP.has(w) && !UNITWORD.has(w)).map(stem);
// "Q3 2025", "Q3'25" and "Q3 25" are one period
const normPeriod = (p) => p.toUpperCase().replace(/[\s'.,]/g, "").replace(/^(FY|[1-4]Q|Q[1-4]|[12]H|H[12]|9M)20(\d{2})([EFA]?)$/, "$1$2$3").replace(/^(Q[1-4]|[1-4]Q|H[12]|[12]H|9M)(\d{2})$/, "$1 $2");
export const periodsOf = (s) => new Set((s.match(PERIOD) || []).map(normPeriod));
export const sameValue = (a, b) => { const d = Math.min(a.decimals, b.decimals), r = (v) => Math.round(v.value * 10 ** d) / 10 ** d; return Math.abs(r(a) - r(b)) < 1e-9; };
export const fmt = (f) => f.raw;

// Every figure in a run of text, each with the words around it.
export function factsInText(text, lang, base, opts = {}) {
  const out = [];
  for (const sentence of text.split(/(?<=[.;:!?])\s+|\s[–—|•]\s|\n/)) {
    if (!sentence.trim()) continue;
    const periods = periodsOf(sentence), masked = sentence.replace(PERIOD, (m) => " ".repeat(m.length));
    const found = []; let m; NUMBER.lastIndex = 0;
    while ((m = NUMBER.exec(masked))) {
      const raw = m[0].trim(); if (!raw) { NUMBER.lastIndex++; continue; }
      const at = m.index + m[0].indexOf(m[3]), cur = m[2] ? CURRENCY[m[2].toLowerCase()] || null : null; let unit = m[4] ? UNIT[m[4].toLowerCase()] || UNIT[m[4]] : null;
      if (unit === "m" && m[4] === "M" && lang === "id") unit = "bn";                       // "Rp 5 M" is miliar in Indonesian decks
      const { value, decimals } = parseNumber(m[3], lang), sign = /[-−–]/.test(m[1]) && /[\s(]/.test(masked[m.index - 1] || " ") ? -1 : 1;
      if (/^\s*$/.test(masked.slice(0, m.index)) && /^[.)]/.test(masked.slice(m.index + m[0].length)) && !unit && !cur) continue;      // "1." list marker
      if (!opts.all && !unit && !cur && decimals === 0 && !/[.,]/.test(m[3]) && value < 100) continue;                                   // bare small counts
      found.push({ at, end: m.index + m[0].length, raw: (m[1] && sign < 0 ? "−" : "") + [m[2], m[3]].filter(Boolean).join(" ") + (m[4] ? (/^(%|x)$/i.test(m[4]) ? m[4] : ` ${m[4]}`) : ""), value: value * sign, decimals, unit: unit || "", currency: cur || "" });
    }
    // where a sentence compares periods ("Rp 15.0 tn in Q3 25 against Rp 13.9 tn in Q2 25"), each figure takes the period
    // written next to it, and a comparative with no words of its own takes the metric of the figure before it
    const marks = periods.size > 1 ? [...sentence.matchAll(new RegExp(PERIOD.source, PERIOD.flags.includes("g") ? PERIOD.flags : `${PERIOD.flags}g`))].map((x) => ({ at: x.index, p: normPeriod(x[0]) })) : [];
    const own = (f, i) => { if (!marks.length) return [...periods]; const lo = i ? found[i - 1].end : 0, hi = found[i + 1] ? found[i + 1].at : masked.length;
      const next = marks.find((x) => x.at >= f.end && x.at < hi), prior = marks.filter((x) => x.at >= lo && x.at < f.at);
      return next ? [next.p] : prior.length === 1 ? [prior[0].p] : [...periods]; };
    found.forEach((f, i) => {
      const before = wordsOf(masked.slice(i ? found[i - 1].end : 0, f.at)), after = wordsOf(masked.slice(f.end, found[i + 1] ? found[i + 1].at : masked.length));
      let label = before.slice(-5); const prev = out.length && i ? out[out.length - 1] : null;
      if (!label.length && marks.length && prev && prev.unit === f.unit && prev.currency === f.currency) label = prev.label.slice();
      else if (label.length < 2) label = label.concat(after.slice(0, 4 - label.length));
      out.push({ ...base, raw: f.raw, value: f.value, decimals: f.decimals, unit: f.unit, currency: f.currency, label: [...new Set(label)], periods: own(f, i), context: sentence.trim().slice(0, 160) });
    });
  }
  return out;
}

// Every figure in the deck: text, table cells (labelled by their row and column heads) and chart data.
export function collectFacts(deck, lang) {
  const facts = [];
  for (const s of deck.slides) for (const sh of s.shapes) {
    const base = { slide: s.index, shapeId: sh.id };
    if (sh.kind === "table" && sh.rows) {
      const head = sh.rows[0] || [];
      sh.rows.forEach((row, r) => row.forEach((cell, c) => { if (!r || !c || !cell) return; const f = factsInText(cell, lang, { ...base, where: "table", cell: [r, c] }, { all: true })[0]; if (!f || f.context.replace(/[^\p{L}]/gu, "").length > 14) return;
        const hd = `${row[0]} ${head[c] || ""}`; f.label = [...new Set(wordsOf(`${hd} ${head[0] || ""}`.replace(PERIOD, " ")))]; f.periods = [...periodsOf(hd)]; if (!f.unit && /%/.test(head[c] || "")) f.unit = "%"; f.context = `${row[0]} · ${head[c] || ""}: ${cell}`; facts.push(f); }));
    } else if (sh.kind === "chart" && sh.chart) {
      for (const ser of sh.chart.series) ser.values.forEach((v, i) => { if (!Number.isFinite(v)) return; const raw = ser.raw[i], hd = `${ser.name} ${ser.categories[i] || ""}`; const pct = ser.percent && Math.abs(v) <= 1.5;
        facts.push({ ...base, where: "chart", raw: pct ? `${Math.round(v * 1000) / 10}%` : String(Math.round(v * 100) / 100), value: pct ? v * 100 : v, decimals: Math.min(2, (String(pct ? Math.round(v * 1000) / 10 : raw).split(".")[1] || "").length), unit: ser.percent ? "%" : "", currency: "", label: [...new Set(wordsOf(`${hd} ${sh.chart.title || ""}`.replace(PERIOD, " ")))], periods: [...periodsOf(hd)], context: `${sh.chart.title || "Chart"} · ${ser.name} · ${ser.categories[i] || ""}`, chart: true }); });
    } else if (sh.kind === "text" && sh.role !== "slidenum" && sh.role !== "date") {
      for (const p of sh.paras) if (p.text.trim() && !p.runs.some((r) => r.field)) facts.push(...factsInText(p.text, lang, { ...base, where: sh.isTitle ? "title" : sh.role === "footer" ? "footer" : "body" }));
    }
  }
  return facts;
}

const jaccard = (a, b) => { const A = new Set(a), n = b.filter((x) => A.has(x)).length; return { common: n, score: n / (A.size + new Set(b).size - n || 1) }; };
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Groups figures that describe the same thing (same words, same period, same unit) and reports groups whose values differ.
export function metricGroups(facts) {
  const parent = facts.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < facts.length; i++) for (let j = i + 1; j < facts.length; j++) {
    const a = facts[i], b = facts[j]; if (a.shapeId === b.shapeId && !(a.cell || b.cell)) continue; const loose = (f) => !f.unit && (f.where === "chart" || f.where === "table");   // units of chart and table values often live in a header
    const data = (f) => f.where === "chart" || f.where === "table";
    if ((a.unit !== b.unit && ((!loose(a) && !loose(b)) || (data(a) && data(b)))) || (a.currency && b.currency && a.currency !== b.currency)) continue;
    if (!a.label.length || !b.label.length || !sameSet(a.periods, b.periods)) continue;
    const j2 = jaccard(a.label, b.label); // one shared word is enough only between two sentences; a series or row name alone ("Consumer", "Total") recurs across unrelated exhibits
    if ((j2.common >= 2 && j2.score >= 0.75) || (j2.score === 1 && a.periods.length && !data(a) && !data(b))) parent[find(i)] = find(j);
  }
  const groups = new Map(); facts.forEach((f, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(f); });
  return [...groups.values()].filter((g) => g.length > 1).map((g) => { const distinct = []; for (const f of g) if (!distinct.some((d) => sameValue(d, f))) distinct.push(f); const exact = new Set(g.map((f) => `${f.value}`)).size;
    const words = g[0].label.filter((w) => g.every((f) => f.label.includes(w))), keys = words.length ? words : g[0].label;
    // show the metric as the deck writes it ("EBITDA margin"), not as the matching key ("ebitda margin")
    const src = g.map((f) => f.context).join(" \n "), shown = keys.map((w) => { const m = new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\p{L}]{0,2}(?![\\p{L}])`, "iu").exec(src); return m ? m[0] : w; });
    return { facts: g, label: shown.join(" "), key: keys.join(" "), periods: g[0].periods, unit: g[0].unit, status: distinct.length > 1 ? "mismatch" : exact > 1 ? "precision" : "match", distinct }; });
}

const TOTAL = /^(grand\s+)?(sub\s?-?total|total|jumlah|sum)\b/i;
const cellNumber = (cell, lang) => { if (!cell || /[\p{L}]{4,}/u.test(cell.replace(/(?:Rp|IDR|USD|bn|tn|mn|juta|miliar|triliun)/gi, ""))) return null; const neg = /^\s*\(.*\)\s*$/.test(cell); const f = factsInText(cell.replace(/[()]/g, ""), lang, {}, { all: true })[0]; return f ? { ...f, value: neg ? -Math.abs(f.value) : f.value } : null; };

// Totals in tables and charts, shares that should make 100%, and growth rates stated next to their own figures.
export function arithmeticChecks(deck, lang) {
  const out = [];
  for (const s of deck.slides) for (const sh of s.shapes) {
    if (sh.kind === "table" && sh.rows && sh.rows.length > 2) {
      const grid = sh.rows.map((r) => r.map((c) => cellNumber(c, lang))), cols = Math.max(...sh.rows.map((r) => r.length));
      // total rows: the rows since the previous total must add up
      let start = 1;
      sh.rows.forEach((row, r) => { if (r && TOTAL.test((row[0] || "").trim())) { for (let c = 1; c < cols; c++) { const parts = []; for (let k = start; k < r; k++) if (grid[k][c]) parts.push(grid[k][c]); const tot = grid[r][c]; if (!tot || parts.length < 2) continue; const sum = parts.reduce((a, p) => a + p.value, 0), d = Math.max(tot.decimals, ...parts.map((p) => p.decimals)), tol = 0.5 * 10 ** -Math.min(tot.decimals, ...parts.map((p) => p.decimals)) * Math.sqrt(parts.length) + 1e-9;
          if (Math.abs(sum - tot.value) > tol) out.push({ code: "total-row", slide: s.index, shapeId: sh.id, title: `"${row[0].trim()}" does not equal the sum of its rows`, detail: `Column "${(sh.rows[0][c] || `column ${c + 1}`).trim()}": rows add up to ${round(sum, d)}, the table shows ${tot.raw}.`, severity: "high" }); } start = r + 1; } });
      // a total column
      const head = sh.rows[0] || [], tc = head.findIndex((h, i) => i && TOTAL.test((h || "").trim()));
      if (tc > 1) sh.rows.forEach((row, r) => { if (!r || !grid[r][tc]) return; const parts = []; for (let c = 1; c < tc; c++) if (grid[r][c]) parts.push(grid[r][c]); if (parts.length < 2) return; const sum = parts.reduce((a, p) => a + p.value, 0), tot = grid[r][tc], tol = 0.5 * 10 ** -Math.min(tot.decimals, ...parts.map((p) => p.decimals)) * Math.sqrt(parts.length) + 1e-9;
        if (Math.abs(sum - tot.value) > tol) out.push({ code: "total-col", slide: s.index, shapeId: sh.id, title: `Row "${(row[0] || "").trim()}" does not add up to its total`, detail: `Cells add up to ${round(sum, Math.max(...parts.map((p) => p.decimals)))}, the total column shows ${tot.raw}.`, severity: "high" }); });
      // a column of shares
      for (let c = 1; c < cols; c++) { const cells = []; for (let r = 1; r < sh.rows.length; r++) if (!TOTAL.test((sh.rows[r][0] || "").trim()) && grid[r][c]) cells.push(grid[r][c]); if (cells.length >= 3 && cells.every((f) => f.unit === "%" && f.value >= 0)) shareCheck(cells, s, sh, `column "${(head[c] || "").trim()}"`, out); }
    }
    if (sh.kind === "chart" && sh.chart) {
      const ch = sh.chart;
      if (/pie|doughnut/i.test(ch.type) && ch.series[0]) { const v = ch.series[0].values.filter(Number.isFinite), sum = v.reduce((a, b) => a + b, 0); const asPct = v.every((x) => x >= 0 && x <= 100) && sum > 90 && sum < 110; if (asPct && Math.abs(sum - 100) > 0.6) out.push({ code: "shares", slide: s.index, shapeId: sh.id, title: `Pie chart shares add up to ${round(sum, 1)}%`, detail: `The slices are ${v.map((x) => round(x, 1)).join(", ")}. Readers will add them up.`, severity: "medium" }); }
      for (const ser of ch.series) { const ti = ser.categories.findIndex((c) => TOTAL.test((c || "").trim())); if (ti < 0 || /waterfall/i.test(ch.type)) continue; const parts = ser.values.filter((_, i) => i !== ti && Number.isFinite(ser.values[i])); if (parts.length < 2) continue; const sum = parts.reduce((a, b) => a + b, 0), tot = ser.values[ti]; if (Math.abs(sum - tot) > Math.max(0.51, Math.abs(tot) * 0.004)) out.push({ code: "chart-total", slide: s.index, shapeId: sh.id, title: `Chart "Total" does not equal the sum of its bars`, detail: `Series "${ser.name || "values"}": bars add up to ${round(sum, 2)}, the total bar is ${round(tot, 2)}.`, severity: "high" }); }
    }
    if (sh.kind === "text") {
      // a list of shares in one text box
      const pct = sh.paras.flatMap((p) => factsInText(p.text, lang, {})).filter((f) => f.unit === "%" && f.value > 0 && f.value < 100);
      if (pct.length >= 3 && pct.length <= 8 && sh.paras.filter((p) => p.text.trim()).length >= 3) shareCheck(pct, s, sh, "this list", out, "low");
      // "grew 12% from 50 to 58"
      for (const p of sh.paras) { const t = p.text, m = /(?:from|dari)\s+((?:Rp\.?|USD|US\$|\$|IDR)?\s?[\d.,]+)\s?[\p{L}]{0,10}\s+(?:to|menjadi|ke)\s+((?:Rp\.?|USD|US\$|\$|IDR)?\s?[\d.,]+)/iu.exec(t); if (!m) continue;
        const a = parseNumber(m[1].replace(/[^\d.,]/g, "").replace(/[.,]$/, ""), lang), b = parseNumber(m[2].replace(/[^\d.,]/g, "").replace(/[.,]$/, ""), lang), pc = factsInText(t, lang, {}).find((f) => f.unit === "%"); if (!pc || !a.value || !Number.isFinite(b.value)) continue;
        const real = (b.value - a.value) / Math.abs(a.value) * 100, stated = Math.abs(pc.value); if (Math.abs(Math.abs(real) - stated) > Math.max(1, stated * 0.06) + 0.5 * 10 ** -pc.decimals) out.push({ code: "growth", slide: s.index, shapeId: sh.id, title: `The stated ${pc.raw} does not follow from the figures next to it`, detail: `From ${m[1].trim()} to ${m[2].trim()} is a change of ${round(real, 1)}%. Text: "${t.trim().slice(0, 140)}"`, severity: "high" }); }
    }
  }
  return out;
}
function shareCheck(cells, s, sh, where, out, severity = "medium") { const sum = cells.reduce((a, f) => a + f.value, 0), tol = 0.5 * 10 ** -Math.min(...cells.map((f) => f.decimals)) * Math.sqrt(cells.length) + 0.11; if (sum > 95 && sum < 105 && Math.abs(sum - 100) > tol) out.push({ code: "shares", slide: s.index, shapeId: sh.id, title: `Shares add up to ${round(sum, 1)}%, not 100%`, detail: `The percentages in ${where} are ${cells.map((f) => f.raw).join(", ")}. If this is rounding, say so in a note; otherwise one figure is off.`, severity }); }
const round = (v, d) => { const k = 10 ** Math.min(4, Math.max(0, d)); return String(Math.round(v * k) / k); };

// A figure in the title should be visible in the exhibit below it.
export function headlineChecks(deck, facts) {
  const out = [];
  for (const s of deck.slides) {
    const mine = facts.filter((f) => f.slide === s.index), heads = mine.filter((f) => f.where === "title"), rest = mine.filter((f) => f.where !== "title" && f.where !== "footer");
    const exhibit = s.shapes.some((x) => (x.kind === "chart" && x.chart) || x.kind === "table"); if (!heads.length || (!exhibit && rest.length < 4)) continue;
    for (const h of heads) {
      const same = rest.filter((f) => f.unit === h.unit || !f.unit || !h.unit); if (same.length < 2) continue;
      if (same.some((f) => sameValue(f, h) || Math.abs(f.value - h.value) <= 0.5 * 10 ** -h.decimals + 1e-9)) continue;
      if (deck.kind === "pdf" && !exhibit) continue;
      const near = same.slice().sort((a, b) => Math.abs(a.value - h.value) - Math.abs(b.value - h.value))[0];
      out.push({ code: "headline", slide: s.index, shapeId: s.title ? s.title.shapeId : h.shapeId, title: `The title says ${h.raw}, but that figure is not on the slide`, detail: `The closest figure in the exhibit is ${near.raw} (${near.context.slice(0, 80)}). A reader checks the headline number against the chart first.`, severity: "high" });
    }
  }
  return out;
}
