// Proposal kit — the brief code. The website's brief form turns the client's answers into one line of text
// ("MAB1-….") that arrives in the enquiry email; pasting it into Proposals starts a proposal with the client's details,
// the subject and the situation filled in. The same file is copied into the website at build, so the two cannot drift.
// The code is the brief itself, encoded so it survives email clients; it is not encrypted.

const PREFIX = "MAB1-";
export const BRIEF_OFFERS = { deckAudit: "deckAudit", deckAuditQuarterly: "deckAuditQuarterly", deckProject: "deckProject", pitch: "deckProject", retainer: "retainer", templateSystem: "templateSystem", report: "report", other: "custom" };
const FIELDS = { l: "lang", o: "offer", c: "company", n: "name", r: "role", e: "email", d: "subject", a: "audience", q: "decision", k: "message", s: "sources", t: "deadline", g: "languages", i: "indonesian", m: "mnpi", x: "notes" };

const toB64url = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const fromB64url = (t) => { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4)); return Uint8Array.from(s, (ch) => ch.charCodeAt(0)); };

// brief: { lang, offer, company, name, role, email, subject, audience, decision, message, sources, deadline, languages, indonesian, mnpi, notes }
export function encodeBrief(brief) {
  const o = { v: 1 }; for (const [k, long] of Object.entries(FIELDS)) { const v = brief[long]; if (typeof v === "boolean") { if (v) o[k] = 1; } else if (v != null && String(v).trim()) o[k] = String(v).trim().slice(0, 1500); }
  return `${PREFIX}${toB64url(new TextEncoder().encode(JSON.stringify(o)))}.`;   // the full stop ends the code: it never occurs inside it
}
// Finds the code in pasted text (an email may wrap it over several lines or add spaces) and reads it back.
export function decodeBrief(text) {
  const t = String(text || ""), at = t.indexOf(PREFIX); if (at < 0) throw new Error("No brief code found. It starts with MAB1-.");
  const end = t.indexOf(".", at); if (end < 0) throw new Error("The brief code is incomplete. Copy the whole code, up to and including the full stop at its end.");
  const body = t.slice(at + PREFIX.length, end).replace(/[\s>]/g, "");   // line breaks and quote marks an email client added
  if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error("The brief code has been changed. Copy it again from the email.");
  let o; try { o = JSON.parse(new TextDecoder().decode(fromB64url(body))); } catch (e) { throw new Error("The brief code is incomplete. Copy the whole code, up to and including the full stop at its end."); }
  if (!o || o.v !== 1) throw new Error("This brief code comes from a newer version of the website. Update the tool.");
  const out = { indonesian: false, mnpi: false }; for (const [k, long] of Object.entries(FIELDS)) { const v = o[k]; out[long] = long === "indonesian" || long === "mnpi" ? Boolean(v) : typeof v === "string" ? v.slice(0, 1500) : ""; }
  out.lang = out.lang === "id" ? "id" : "en"; out.languages = ["id", "en", "bi"].includes(out.languages) ? out.languages : "bi";
  out.offer = Object.prototype.hasOwnProperty.call(BRIEF_OFFERS, out.offer) ? out.offer : "other";
  return out;
}

const LBL = { en: { audience: "Audience", decision: "The decision it must support", message: "Key message", sources: "Where the figures come from", deadline: "Deadline", notes: "Notes" },
  id: { audience: "Audiens", decision: "Keputusan yang harus didukung", message: "Pesan utama", sources: "Sumber angka", deadline: "Tenggat", notes: "Catatan" } };
const fmtDate = (iso, lang) => { const d = /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Date(`${iso}T00:00:00`) : null; return d && !isNaN(d) ? d.toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : iso; };

// A new proposal from a brief. newProposal and settings come from the Proposals tool (doc.js), so this file stays small
// enough for the website to carry.
export function proposalFromBrief(b, newProposal, settings) {
  const p = newProposal(BRIEF_OFFERS[b.offer] || "custom", settings), l = b.lang, L = LBL[l];
  p.mode = b.languages; Object.assign(p.client, { company: b.company, contact: [b.name, b.role].filter(Boolean).join(", "), email: b.email, indonesian: b.indonesian });
  p.subject[l] = b.subject;
  p.situation[l] = [["audience", b.audience], ["decision", b.decision], ["message", b.message], ["sources", b.sources], ["deadline", fmtDate(b.deadline, l)], ["notes", b.notes]].filter(([, v]) => v).map(([k, v]) => `${L[k]}: ${v}`).join("\n\n");
  p.flags = { mnpi: b.mnpi, fromBrief: true };
  return p;
}
