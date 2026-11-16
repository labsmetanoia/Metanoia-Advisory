// Optional AI assist: Claude reads the slide and returns every line of text and the main objects, with boxes.
// The app uses this to correct OCR misreadings, to recover text the local pass missed and to name layers.
// Active only when ANTHROPIC_API_KEY is set (environment or a .env file next to server.mjs). The slide image is
// sent to the Anthropic API for this request; nothing is sent when the key is absent or AI assist is not used.
import Anthropic from "@anthropic-ai/sdk";

const box = { x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" } };
const schema = {
  type: "object", additionalProperties: false, required: ["lines", "objects", "note"],
  properties: {
    lines: { type: "array", description: "Every visual line of text on the slide, top to bottom.", items: { type: "object", additionalProperties: false, required: ["text", "x0", "y0", "x1", "y1", "role"], properties: { text: { type: "string", description: "The line exactly as written, including punctuation and capitalisation. One entry per visual line; do not join wrapped lines." }, ...box, role: { type: "string", enum: ["title", "subtitle", "body", "label", "footnote", "logo"] } } } },
    objects: { type: "array", description: "Distinct non-text objects: charts, photographs, icons, logos, diagrams, cards.", items: { type: "object", additionalProperties: false, required: ["name", "x0", "y0", "x1", "y1"], properties: { name: { type: "string", description: "Two to four words, e.g. 'Bar chart', 'Port photograph', 'Company logo'." }, ...box } } },
    note: { type: "string", description: "One sentence on anything a designer should know: an unusual font, text inside a picture, a logo that should stay a picture." },
  },
};
const SYSTEM = `You help a presentation-design team convert flattened slides into editable layers. You are given one slide image. Transcribe it precisely.
Coordinates are integers from 0 to 1000, relative to the image width (x) and height (y), with the origin at the top-left. Boxes must be tight around the ink.
Report text exactly as it appears: do not correct spelling, do not translate, keep numbers, units and punctuation as written. Text may be in English or Indonesian.
Lettering that is part of a logo gets role "logo". Ignore text that is part of a photograph's scene (signs, labels on objects) unless it is clearly overlaid by the designer.`;

export async function assist(body) {
  const image = String(body.image || "");
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(image);
  if (!m) return { status: 400, body: { error: "bad_image" } };
  if (m[2].length > 7_000_000) return { status: 400, body: { error: "too_large" } };
  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
        { type: "text", text: "Transcribe this slide: every line of text with its box and role, and the main non-text objects." },
      ] }],
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
