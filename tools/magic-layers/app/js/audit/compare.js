// Deck Auditor — version compare. Pairs the slides of two versions of a deck (pages may have been added, removed
// or moved), then reports for each pair what changed: wording, figures, pictures and layout.
import { factsInText, sameValue } from "./numbers.js";

const tokens = (t) => (t.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.,%'’-]*/gu) || []);
function dice(a, b) { if (!a.length && !b.length) return 1; const m = new Map(); for (const x of a) m.set(x, (m.get(x) || 0) + 1); let hit = 0; for (const x of b) { const c = m.get(x); if (c) { hit++; m.set(x, c - 1); } } return (2 * hit) / (a.length + b.length || 1); }
// Lines of a slide in reading order: paragraphs, table rows, chart series.
export function slideLines(s) {
  const out = [];
  for (const sh of s.shapes.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x))) {
    if (sh.kind === "table" && sh.rows) for (const r of sh.rows) { const t = r.join(" | ").trim(); if (t.replace(/[| ]/g, "")) out.push({ text: t, shapeId: sh.id, kind: "table" }); }
    else if (sh.kind === "chart" && sh.chart) for (const ser of sh.chart.series) out.push({ text: `Chart ${ser.name || "series"}: ${ser.categories.map((c, i) => `${c} ${Math.round(ser.values[i] * 100) / 100}`).join(", ")}`, shapeId: sh.id, kind: "chart" });
    else if (sh.role !== "slidenum" && sh.role !== "date") for (const p of sh.paras) if (p.text.trim() && !p.runs.some((r) => r.field)) out.push({ text: p.text.replace(/\s+/g, " ").trim(), shapeId: sh.id, kind: sh.isTitle ? "title" : "text" });
  }
  return out;
}
function lcs(a, b, eq) { const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]); const out = []; let i = 0, j = 0; while (i < n && j < m) { if (eq(a[i], b[j])) { out.push({ op: "same", a: a[i], b: b[j] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "del", a: a[i++] }); else out.push({ op: "ins", b: b[j++] }); } while (i < n) out.push({ op: "del", a: a[i++] }); while (j < m) out.push({ op: "ins", b: b[j++] }); return out; }
export function wordDiff(a, b) { const wa = a.split(/(\s+)/).filter((x) => x.trim()), wb = b.split(/(\s+)/).filter((x) => x.trim()); return lcs(wa, wb, (x, y) => x === y).map((d) => ({ op: d.op, text: d.op === "ins" ? d.b : d.a })); }
function figureChanges(a, b, lang) { const fa = factsInText(a, lang, {}, { all: true }), fb = factsInText(b, lang, {}, { all: true }), out = []; if (fa.length === fb.length) fa.forEach((f, i) => { if (!(sameValue(f, fb[i]) && f.unit === fb[i].unit) || f.raw !== fb[i].raw) out.push({ from: f.raw, to: fb[i].raw }); }); else { const gone = fa.filter((f) => !fb.some((g) => g.raw === f.raw)), came = fb.filter((g) => !fa.some((f) => f.raw === g.raw)); gone.forEach((f, i) => out.push({ from: f.raw, to: came[i] ? came[i].raw : null })); came.slice(gone.length).forEach((g) => out.push({ from: null, to: g.raw })); } return out; }

export function compareDecks(A, B, lang = "en") {
  const ta = A.slides.map((s) => ({ s, all: tokens(s.text), title: tokens(s.title ? s.title.text : "") })), tb = B.slides.map((s) => ({ s, all: tokens(s.text), title: tokens(s.title ? s.title.text : "") }));
  const sim = (x, y) => 0.65 * dice(x.all, y.all) + 0.35 * (x.title.length || y.title.length ? dice(x.title, y.title) : dice(x.all, y.all));
  const n = ta.length, m = tb.length, S = Array.from({ length: n }, (_, i) => Float64Array.from({ length: m }, (_, j) => sim(ta[i], tb[j])));
  // global alignment: a pair is worth its similarity above 0.38, a gap costs nothing
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1], dp[i + 1][j + 1] + (S[i][j] - 0.38));
  const pairs = []; let i = 0, j = 0;
  while (i < n || j < m) { if (i < n && j < m && S[i][j] > 0.38 && Math.abs(dp[i][j] - (dp[i + 1][j + 1] + (S[i][j] - 0.38))) < 1e-9) { pairs.push({ a: ta[i].s, b: tb[j].s, sim: S[i][j] }); i++; j++; } else if (j >= m || (i < n && Math.abs(dp[i][j] - dp[i + 1][j]) < 1e-9)) pairs.push({ a: ta[i++].s, b: null }); else pairs.push({ a: null, b: tb[j++].s }); }
  // a page that left one place and appeared in another was moved
  for (const p of pairs.filter((x) => x.a && !x.b)) { const ia = A.slides.indexOf(p.a); let best = null; for (const q of pairs.filter((x) => x.b && !x.a && !x.movedFrom)) { const v = S[ia][B.slides.indexOf(q.b)]; if (v > 0.6 && (!best || v > best.v)) best = { q, v }; } if (best) { best.q.movedFrom = p.a; best.q.a = p.a; best.q.sim = best.v; p.movedTo = best.q.b; } }
  const result = [];
  for (const p of pairs) {
    if (p.movedTo) continue;
    if (!p.a) { result.push({ status: "added", b: p.b, lines: slideLines(p.b).map((l) => ({ op: "ins", text: l.text })), figures: [], notes: [] }); continue; }
    if (!p.b) { result.push({ status: "removed", a: p.a, lines: slideLines(p.a).map((l) => ({ op: "del", text: l.text })), figures: [], notes: [] }); continue; }
    const la = slideLines(p.a), lb = slideLines(p.b), norm = (l) => l.text.toLowerCase().replace(/\s+/g, " "), raw = lcs(la, lb, (x, y) => norm(x) === norm(y)), lines = [], figures = [];
    for (let k = 0; k < raw.length; k++) { const d = raw[k];
      if (d.op === "same") { lines.push({ op: "same", text: d.b.text }); continue; }
      // a deleted line followed by inserted lines: pair it with the most similar one as an edit
      if (d.op === "del") { let run = k + 1; while (run < raw.length && raw[run].op === "del") run++; let bestK = -1, bestV = 0.42; for (let q = run; q < raw.length && raw[q].op === "ins"; q++) { if (raw[q].used) continue; const v = dice(tokens(d.a.text), tokens(raw[q].b.text)); if (v > bestV) { bestV = v; bestK = q; } }
        if (bestK >= 0) { raw[bestK].used = true; lines.push({ op: "edit", from: d.a.text, to: raw[bestK].b.text, words: wordDiff(d.a.text, raw[bestK].b.text), title: d.a.kind === "title", shapeId: raw[bestK].b.shapeId }); figures.push(...figureChanges(d.a.text, raw[bestK].b.text, lang).map((f) => ({ ...f, line: raw[bestK].b.text.slice(0, 80) }))); } else lines.push({ op: "del", text: d.a.text }); }
      else if (!d.used) lines.push({ op: "ins", text: d.b.text, shapeId: d.b.shapeId });
    }
    const notes = [], pics = (s) => s.shapes.filter((x) => x.kind === "picture").map((x) => (x.image ? `${x.image.bytes}:${x.image.pxW}x${x.image.pxH}` : x.media || "")).sort();
    const pa = pics(p.a), pb = pics(p.b); if (pa.join("|") !== pb.join("|")) { const added = pb.filter((x) => !pa.includes(x)).length, gone = pa.filter((x) => !pb.includes(x)).length; notes.push(added && gone ? `${Math.max(added, gone)} picture${Math.max(added, gone) > 1 ? "s" : ""} replaced` : added ? `${added} picture${added > 1 ? "s" : ""} added` : `${gone} picture${gone > 1 ? "s" : ""} removed`); }
    let movedShapes = 0; for (const sh of p.b.shapes) { if (!sh.hasBox || !sh.text) continue; const twin = p.a.shapes.find((x) => x.text === sh.text && x.kind === sh.kind); if (twin && (Math.abs(twin.x - sh.x) > 3 || Math.abs(twin.y - sh.y) > 3 || Math.abs(twin.w - sh.w) > 3 || Math.abs(twin.h - sh.h) > 3)) movedShapes++; }
    if (movedShapes) notes.push(`${movedShapes} object${movedShapes > 1 ? "s" : ""} moved or resized`);
    const changed = lines.some((l) => l.op !== "same") || notes.length > 0;
    result.push({ status: p.movedFrom ? "moved" : changed ? "changed" : "same", a: p.a, b: p.b, lines, figures, notes, textChanged: lines.some((l) => l.op !== "same") });
  }
  const c = (s) => result.filter((r) => r.status === s).length;
  return { pairs: result, summary: { same: c("same"), changed: c("changed") + result.filter((r) => r.status === "moved" && r.textChanged).length, added: c("added"), removed: c("removed"), moved: c("moved"), figures: result.reduce((a, r) => a + r.figures.length, 0) } };
}
