// Cloudflare Pages Function: POST /api/upload — stores a deck a visitor attaches to a website form, privately, in R2.
// The browser sends the file as the request body and gets back a reference (UP-YYYYMMDD-xxxxxxxx) that travels with
// the form's email, so the firm can find the file in the bucket. Nothing is public: there is no download or listing
// route, object names are random, and the bucket's lifecycle rule deletes every file after the retention period.
//
// Bindings and settings (Cloudflare → Workers & Pages → the project → Settings):
//   DECKS              R2 bucket binding (required; without it the endpoint answers 503 and the site keeps uploads off)
//   TURNSTILE_SECRET   Turnstile secret key (optional; when set, every upload must carry a valid Turnstile token)
//   UPLOAD_MAX_MB      largest accepted file in MB (optional, default 60; Cloudflare's own request limit is 100)

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const ascii = (s) => new TextEncoder().encode(s);
function find(hay, needle, from = 0) { outer: for (let i = from; i <= hay.length - needle.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return i; } return -1; }

// What the bytes say the file is: a PDF, a PowerPoint (a zip whose directory names ppt/presentation.xml), or neither.
export function kindOf(bytes) {
  if (bytes.length > 5 && find(bytes.subarray(0, 1024), ascii("%PDF-")) >= 0) return "pdf";
  if (bytes.length > 30 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) { const tail = bytes.subarray(Math.max(0, bytes.length - 262144)); if (find(tail, ascii("ppt/presentation.xml")) >= 0) return "pptx"; }
  return null;
}
const safeName = (n) => (n || "deck").normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "deck";

export async function onRequestPost({ request, env }) {
  if (!env.DECKS) return json(503, { error: "not_configured" });
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin !== url.origin) return json(403, { error: "origin" });
  const max = (Number(env.UPLOAD_MAX_MB) || 60) * 1024 * 1024, length = Number(request.headers.get("content-length") || 0);
  if (length > max) return json(413, { error: "too_large" });
  if (env.TURNSTILE_SECRET) {
    const token = request.headers.get("x-turnstile-token") || ""; if (!token) return json(403, { error: "verification" });
    const form = new FormData(); form.append("secret", env.TURNSTILE_SECRET); form.append("response", token); const ip = request.headers.get("cf-connecting-ip"); if (ip) form.append("remoteip", ip);
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!v.success) return json(403, { error: "verification" });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return json(400, { error: "empty" });
  if (bytes.length > max) return json(413, { error: "too_large" });
  const kind = kindOf(bytes); if (!kind) return json(415, { error: "type" });
  let name = ""; try { name = decodeURIComponent(request.headers.get("x-file-name") || ""); } catch (e) { name = ""; }
  const now = new Date(), day = now.toISOString().slice(0, 10), ref = `UP-${day.replace(/-/g, "")}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const file = safeName(name).replace(/\.(pptx|pdf)$/i, "") + `.${kind}`;
  await env.DECKS.put(`decks/${day}/${ref}-${file}`, bytes, {
    httpMetadata: { contentType: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
    customMetadata: { reference: ref, originalName: name.slice(0, 200), form: (request.headers.get("x-form") || "").slice(0, 40), uploaded: now.toISOString() },
  });
  return json(200, { ok: true, ref, name: file, size: bytes.length });
}

export const onRequest = () => json(405, { error: "method" });
