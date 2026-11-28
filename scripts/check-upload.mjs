// The deck upload function (functions/api/upload.js), run in Node against an in-memory bucket: what it stores, and
// everything it refuses. The full flow in Cloudflare's runtime is described in docs/operations-playbook.md.
import { readFileSync } from "node:fs";
const { onRequestPost, onRequest, kindOf } = await import("../functions/api/upload.js");
let failed = 0; const check = (name, ok, detail = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`); if (!ok) failed++; };
const T = "tools/magic-layers/", pptx = readFileSync(T + "app/sample/audit-sample.pptx"), pdf = readFileSync(T + "test/samples/credentials.pdf"), xlsx = readFileSync(T + "app/sample/audit-sample-model.xlsx");
const store = new Map(), DECKS = { put: async (k, v, o) => { store.set(k, { size: v.length, o }); } }, site = "https://www.metanoiaadvisors.com";
const call = async (body, env, h = {}) => { const r = await onRequestPost({ request: new Request(`${site}/api/upload`, { method: "POST", body, headers: { origin: site, "content-length": String(body.length), ...h } }), env }); return { status: r.status, j: await r.json() }; };
console.log("Deck upload");
check("file type is read from the bytes, not the name", kindOf(pptx) === "pptx" && kindOf(pdf) === "pdf" && kindOf(xlsx) === null && kindOf(new TextEncoder().encode("PK\u0003\u0004 not a deck")) === null);
const a = await call(pptx, { DECKS }, { "x-file-name": encodeURIComponent("FY25 Board – update.pptx"), "x-form": "deckAudit" }), key = [...store.keys()][0];
check("a PowerPoint is stored under a dated, random name with its reference", a.status === 200 && /^UP-\d{8}-[0-9a-f]{10}$/.test(a.j.ref) && key === `decks/${key.slice(6, 16)}/${a.j.ref}-FY25-Board-update.pptx` && store.get(key).o.customMetadata.form === "deckAudit", JSON.stringify([a, key]));
const refused = [await call(xlsx, { DECKS }, { "x-file-name": "model.pptx" }), await call(pdf, { DECKS }, { origin: "https://elsewhere.example" }), await call(pdf, { DECKS, UPLOAD_MAX_MB: "0.1" }), await call(pdf, {}), await call(pdf, { DECKS, TURNSTILE_SECRET: "x" })];
check("refused: another file type, another site, too large, no bucket, no bot check", refused.map((r) => `${r.status}:${r.j.error}`).join() === "415:type,403:origin,413:too_large,503:not_configured,403:verification" && store.size === 1, refused.map((r) => `${r.status}:${r.j.error}`).join());
check("only POST is answered", onRequest().status === 405);
console.log(failed ? `\nFAILED: ${failed}` : "\nUpload function OK."); process.exit(failed ? 1 : 0);
