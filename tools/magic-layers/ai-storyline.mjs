// Optional AI storyline review for the Deck Auditor: Claude reads the deck's titles and slide text (no images) and
// comments on the argument the way the firm's partners do. Active only when ANTHROPIC_API_KEY is set; the text of
// the deck is sent to the Anthropic API for this request and nothing is sent otherwise.
import Anthropic from "@anthropic-ai/sdk";

const schema = {
  type: "object", additionalProperties: false, required: ["summary", "audienceGuess", "observations", "rebuildFirst"],
  properties: {
    summary: { type: "string", description: "One or two sentences: what the deck currently says to its reader, judged from the titles in order." },
    audienceGuess: { type: "string", description: "Who the deck appears to be written for, in a few words." },
    observations: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "detail", "slides"], properties: { title: { type: "string", description: "Short headline of the observation, under 12 words." }, detail: { type: "string", description: "Two to four sentences: what the deck does, what it should do, and why it matters to the reader." }, slides: { type: "array", items: { type: "integer" }, description: "Slide numbers the observation concerns; empty if it concerns the whole deck." } } } },
    rebuildFirst: { type: "object", additionalProperties: false, required: ["page", "why", "actionTitle"], properties: { page: { type: "string", description: "The slide to rebuild first, by number and current title." }, why: { type: "string" }, actionTitle: { type: "string", description: "A proposed action title for that slide: a full sentence stating its conclusion, using only facts present in the deck." } } },
  },
};
const SYSTEM = `You are the senior reviewer at Metanoia Advisory, a strategic storytelling and corporate communications firm in Jakarta that builds board packs, investor presentations, reports and proposals.
You review the storyline of a deck the way the firm's partners do: the answer first, the evidence behind it, an action title on every page, a logical order (situation, finding, implication, decision), numbers that match, and a clear decision the reader is asked to take.
You are given every slide's number, title and text. Judge the argument: whether the titles alone tell the story, whether the order holds, whether pages overlap or a step is missing, whether the conclusion and the request are stated.
Write for a senior executive: direct, specific, respectful, no filler. Refer only to what the deck shows; do not invent facts or figures. Answer in the language requested.`;

export async function review(body) {
  const slides = Array.isArray(body.slides) ? body.slides.slice(0, 120) : [];
  if (slides.length < 2) return { status: 400, body: { error: "too_short" } };
  const language = body.language === "id" ? "Bahasa Indonesia" : "English";
  const deck = slides.map((s) => `--- Slide ${Number(s.n) || 0} ---\nTitle: ${String(s.title || "(none)").slice(0, 300)}\n${String(s.text || "").slice(0, 1500)}`).join("\n\n").slice(0, 120000);
  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Language for the answer: ${language}.\n\nDeck "${String(body.name || "deck").slice(0, 120)}":\n\n${deck}` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { status: 503, body: { error: "bad_key" } };
    if (err instanceof Anthropic.RateLimitError) return { status: 503, body: { error: "busy" } };
    if (err instanceof Anthropic.BadRequestError) return { status: 502, body: { error: "rejected", detail: err.message } };
    if (err instanceof Anthropic.APIError) return { status: 502, body: { error: "upstream", status: err.status } };
    return { status: 502, body: { error: "upstream" } };
  }
  if (response.stop_reason === "refusal") return { status: 422, body: { error: "declined" } };
  if (response.stop_reason === "max_tokens") return { status: 502, body: { error: "too_long" } };
  const text = response.content.find((b) => b.type === "text");
  try { return { status: 200, body: { ok: true, result: JSON.parse(text ? text.text : ""), model: response.model } }; }
  catch (e) { return { status: 502, body: { error: "parse" } }; }
}
