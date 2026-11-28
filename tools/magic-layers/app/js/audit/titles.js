// Deck Auditor — a deck read from its titles alone, the way a senior reader pages through it first. Used by the
// website's headline checker (titles pasted as text) with the same rules the Deck Auditor applies to a whole deck.
import { classifyTitle, SUMMARY_RE, ASK_RE } from "./checks.js";
import { detectLanguage } from "./numbers.js";

const ID_VERBS = /\b(adalah|akan|telah|sudah|dapat|harus|perlu|naik|turun|tumbuh|tetap|menjadi|memiliki|menunjukkan|mendorong|memberikan|menghasilkan|mencapai|menurun|meningkat|merupakan|membukukan|menekan)\b/i;

// text: one title per line. Blank lines, slide numbers ("3.", "03 –") and bullets at the start are ignored.
export function reviewTitles(text) {
  const raw = String(text || "").split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-–—•*·]|\(?\d{1,3}[.)]?(?:\s*[-–—:|]\s*)?)\s+/, "").replace(/\s+/g, " ").trim()).filter((l) => l.length >= 2).slice(0, 120);
  const deckLang = detectLanguage(raw.join("\n")).lang, seen = new Map();
  const items = raw.map((t, i) => {
    const d = detectLanguage(t), silent = d.id === d.en, lang = d.id > d.en ? "id" : d.en > d.id ? "en" : deckLang;   // one title rarely carries enough words to tell its language; the deck decides when it is silent
    let c = classifyTitle(t, lang);
    // a silent line in the other language: accept its reading only on an unmistakable verb (an English "dividend" must not pass as an Indonesian di- verb)
    if (silent && c.kind !== "action") { const other = lang === "en" ? "id" : "en"; if (other === "en" || ID_VERBS.test(t)) { const c2 = classifyTitle(t, other); if (c2.kind === "action") c = c2; } }
    const key = t.toLowerCase().replace(/\s*\(?(cont(inued|'d|\.)?|lanjutan|\d+\/\d+)\)?$/i, "");
    const repeatOf = seen.has(key) ? seen.get(key) : null; if (repeatOf == null) seen.set(key, i + 1);
    // the first line is usually the deck's own title, which the Deck Auditor does not judge either
    const kind = i === 0 && c.kind !== "action" && c.kind !== "exempt" && c.words <= 8 ? "cover" : c.kind;
    return { n: i + 1, text: t, kind, words: c.words, long: c.words > 24, repeatOf };
  });
  const judged = items.filter((x) => x.kind !== "exempt" && x.kind !== "cover"), actions = judged.filter((x) => x.kind === "action");
  const long = items.length >= 8;
  return { lang: deckLang, items, judged: judged.length, actions: actions.length, share: judged.length ? Math.round((actions.length / judged.length) * 100) : 0,
    summary: long ? items.slice(0, 4).some((x) => SUMMARY_RE.test(x.text)) : null, ask: long ? items.some((x) => ASK_RE.test(x.text)) : null,
    storyline: actions.map((x) => x.text) };
}
