// Deck Auditor — this quarter's deck against last quarter's. Last quarter's deck reported figures for periods that
// this quarter's deck shows again as comparatives (Q2 25 in a Q3 25 deck, FY24 in both). If such a figure has changed
// and the deck does not say it was restated, an analyst comparing the two decks finds it before the company explains it.
import { collectFacts, metricGroups, sameValue } from "./numbers.js";

// words that tell the reader a figure was restated on purpose
export const DISCLOSED = /\b(restated|re-stated|revised|reclassified|re-presented|disajikan kembali|direklasifikasi|direvisi|penyajian kembali)\b/i;

// → [{ label, periods, before: [facts from last quarter], after: [facts from this quarter] }]
export function restatedFigures(prevDeck, deck, lang) {
  const keep = (f) => f.where !== "footer";
  const before = collectFacts(prevDeck, lang).filter(keep).map((f) => ({ ...f, shapeId: `prev:${f.shapeId}`, prev: true }));
  const after = collectFacts(deck, lang).filter(keep);
  const slideText = new Map(deck.slides.map((s) => [s.index, s.text || ""])), out = [];
  for (const g of metricGroups([...before, ...after])) {
    if (!g.periods.length) continue;   // a figure without a period (headcount, a target) may simply be up to date
    const a = g.facts.filter((f) => f.prev), b = g.facts.filter((f) => !f.prev); if (!a.length || !b.length) continue;
    if (b.some((f) => a.some((x) => sameValue(x, f)))) continue;   // one of this quarter's mentions still agrees: the within-deck check reports the rest
    if (b.some((f) => DISCLOSED.test(f.context) || DISCLOSED.test(slideText.get(f.slide) || ""))) continue;
    out.push({ label: g.label, periods: g.periods, before: a, after: b });
  }
  return out;
}

export function restatedFindings(list) {
  return list.map((r) => { const was = [...new Set(r.before.map((f) => f.raw))], now = [...new Set(r.after.map((f) => f.raw))];
    return { code: "restated", severity: "high", slides: [...new Set(r.after.map((f) => f.slide))], refs: r.after.map((f) => ({ slide: f.slide, shapeId: f.shapeId })),
      title: `"${r.label}" (${r.periods.join(", ")}) was ${was.join(" and ")} last quarter and is ${now.join(" and ")} now`,
      detail: [...r.before.map((f) => `Last quarter, slide ${f.slide}: ${f.raw} — ${f.context}`), ...r.after.map((f) => `This deck, slide ${f.slide}: ${f.raw} — ${f.context}`)].join("\n") }; });
}

// counts of automatic findings, for the quarter-on-quarter table in the client report
export const severityCounts = (findings) => ({ high: findings.filter((f) => f.severity === "high").length, medium: findings.filter((f) => f.severity === "medium").length, low: findings.filter((f) => f.severity === "low").length });
