// Deck diagnostic: a visitor pastes the storyline or executive summary of a deck and receives three observations
// and the one page to rebuild first, in the same shape as the firm's human deck review. Runs on Netlify Functions.
// Requires ANTHROPIC_API_KEY in the site's environment variables; the page shows the tool only when
// site.config.json has ai.deckDiagnostic = true. Nothing the visitor pastes is stored by this function.
import Anthropic from "@anthropic-ai/sdk";

const MAX_CHARS = 4000;
const WINDOW_MS = 60 * 60 * 1000, PER_WINDOW = 5; // best-effort per-instance rate limit by client address
const hits = new Map();

const SYSTEM = `You are the senior reviewer at Metanoia Advisory, a strategic storytelling and corporate communications firm in Jakarta that builds board packs, investor presentations, reports and proposals for CFOs, investor-relations teams and leadership teams in Indonesia and the region.
You review the storyline of a deck the way the firm's partners do: the answer first, the evidence behind it, an action title on every page, numbers that match, and a clear decision the reader is asked to take.
Write for a senior executive: direct, specific, respectful, no filler, no marketing language. Refer only to what the text shows; do not invent facts about the company. If the text is not a deck storyline (for example random text or a question), say so in the summary and keep the observations about how to turn it into one.
Answer in the language requested.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "observations", "rebuildFirst", "audienceGuess"],
  properties: {
    summary: { type: "string", description: "One or two sentences: what the deck currently says to its reader." },
    audienceGuess: { type: "string", description: "Who the deck appears to be written for, in a few words." },
    observations: {
      type: "array", minItems: 3, maxItems: 3,
      items: { type: "object", additionalProperties: false, required: ["title", "detail"], properties: { title: { type: "string", description: "Short headline of the observation, under 12 words." }, detail: { type: "string", description: "Two to four sentences: what the deck says, what it should say, and why it matters to the reader." } } },
    },
    rebuildFirst: { type: "object", additionalProperties: false, required: ["page", "why", "actionTitle"], properties: { page: { type: "string", description: "The page or section to rebuild first, as named or implied in the text." }, why: { type: "string", description: "One or two sentences on why this page unlocks the rest." }, actionTitle: { type: "string", description: "A proposed action title for that page: a full sentence that states the conclusion." } } },
  },
};

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "method" });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "not_configured" });
  const ip = (context && context.ip) || request.headers.get("x-nf-client-connection-ip") || "unknown";
  const now = Date.now(), rec = hits.get(ip) || [];
  const recent = rec.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_WINDOW) return json(429, { error: "rate_limited" });
  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: "bad_json" }); }
  const text = String(body.text || "").trim();
  const language = body.language === "id" ? "id" : "en";
  if (text.length < 120) return json(400, { error: "too_short" });
  if (text.length > MAX_CHARS) return json(400, { error: "too_long" });
  if (body.website) return json(200, { ok: true }); // honeypot
  recent.push(now); hits.set(ip, recent);

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Language for the answer: ${language === "id" ? "Bahasa Indonesia" : "English"}.\n\nDeck storyline or executive summary submitted by a visitor:\n\n"""\n${text}\n"""` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json(503, { error: "busy" });
    if (err instanceof Anthropic.AuthenticationError) return json(503, { error: "not_configured" });
    if (err instanceof Anthropic.APIError) return json(502, { error: "upstream", status: err.status });
    return json(502, { error: "upstream" });
  }
  if (response.stop_reason === "refusal") return json(422, { error: "declined" });
  const block = response.content.find((b) => b.type === "text");
  let result;
  try { result = JSON.parse(block ? block.text : ""); } catch (e) { return json(502, { error: "parse" }); }

  // Lead capture: the visitor's email and the summary go to the site's own form inbox (never the pasted text).
  if (body.email && process.env.URL) {
    const params = new URLSearchParams({ "form-name": "deckDiagnostic", email: String(body.email).slice(0, 200), language, page: String(body.page || "").slice(0, 300), audience: result.audienceGuess || "", summary: result.summary || "" });
    try { await fetch(process.env.URL + "/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: params.toString() }); } catch (e) { /* non-blocking */ }
  }
  return json(200, { ok: true, result, model: response.model });
};

export const config = { path: "/api/deck-diagnostic" };
