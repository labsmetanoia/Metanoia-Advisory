// Lead triage: Netlify runs this function for every form submission on the site (the file name is the trigger).
// It classifies the enquiry with Claude and sends a one-paragraph brief to the owner, so each lead arrives with
// the practice, the likely service, urgency and a suggested first reply. Everything is optional and key-gated:
//   ANTHROPIC_API_KEY   classification (without it the brief is the raw submission)
//   LEADS_WEBHOOK_URL   Slack or Microsoft Teams incoming webhook that receives the brief
//   RESEND_API_KEY + LEADS_EMAIL (+ LEADS_FROM)   email delivery of the brief through resend.com
// Netlify's own form notifications keep working regardless of this function.
import Anthropic from "@anthropic-ai/sdk";

const schema = {
  type: "object", additionalProperties: false,
  required: ["practice", "likelyService", "urgency", "fit", "summary", "suggestedReply", "flags"],
  properties: {
    practice: { type: "string", enum: ["strategic-storytelling", "market-entry", "strategy-investment", "unclear"] },
    likelyService: { type: "string", description: "The closest service in plain words, or 'unclear'." },
    urgency: { type: "string", enum: ["this-week", "this-month", "exploratory", "unclear"] },
    fit: { type: "string", enum: ["strong", "possible", "weak", "spam"] },
    summary: { type: "string", description: "Two sentences for the partner: who they are, what they need, by when." },
    suggestedReply: { type: "string", description: "A short first reply in the enquirer's language, in the firm's voice: direct, no sales language, proposes the 45-minute working session." },
    flags: { type: "array", items: { type: "string" }, description: "Anything the partner should check before replying: conflict check, listed company, regulated disclosure, vendor pitch, recruitment, spam." },
  },
};

const SYSTEM = `You triage inbound enquiries for Metanoia Advisory, a Jakarta advisory firm with three practices: Strategic Storytelling & Corporate Communications (board and investor decks, annual and sustainability reports, proposals, templates, newsletters, an AI-assisted express deck service), Indonesia Market Entry & Localization Strategy (market assessment, partner and site search, localisation and go-to-market, market representation) and Strategy & Investment Advisory (feasibility studies and financial models, business cases, strategic planning, investment-grade documentation).
The firm replies to enquiries in the language they were written in, starts every engagement with a 45-minute working session, charges fixed fees and retainers only, does not practise law, tax or audit, and runs a conflict check before work that touches a listed company's market-facing materials.
Be accurate and brief. Mark vendor pitches, recruitment approaches and nonsense as spam or weak fit.`;

async function classify(fields) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Form submission (JSON):\n${JSON.stringify(fields, null, 1)}` }],
  });
  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b) => b.type === "text");
  try { return JSON.parse(block ? block.text : ""); } catch (e) { return null; }
}

function brief(formName, fields, triage) {
  const lines = [`New ${formName} enquiry`];
  for (const k of ["name", "company", "email", "situation", "topic", "message", "deck_link", "language", "page", "utm_source", "utm_campaign"]) if (fields[k]) lines.push(`${k}: ${fields[k]}`);
  if (triage) {
    lines.push("", `Triage: ${triage.practice} · ${triage.likelyService} · urgency ${triage.urgency} · fit ${triage.fit}`, triage.summary);
    if (triage.flags && triage.flags.length) lines.push(`Check before replying: ${triage.flags.join("; ")}`);
    lines.push("", "Suggested first reply:", triage.suggestedReply);
  }
  return lines.join("\n");
}

export default async (request) => {
  let payload;
  try { payload = (await request.json()).payload; } catch (e) { return new Response("bad payload", { status: 400 }); }
  const fields = payload.data || {}, formName = payload.form_name || "form";
  delete fields.website; delete fields["form-name"];
  let triage = null;
  try { triage = await classify({ form: formName, ...fields }); } catch (e) { triage = null; }
  const text = brief(formName, fields, triage);
  const tasks = [];
  if (process.env.LEADS_WEBHOOK_URL) tasks.push(fetch(process.env.LEADS_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }));
  if (process.env.RESEND_API_KEY && process.env.LEADS_EMAIL) tasks.push(fetch("https://api.resend.com/emails", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` }, body: JSON.stringify({ from: process.env.LEADS_FROM || "Metanoia website <onboarding@resend.dev>", to: [process.env.LEADS_EMAIL], reply_to: fields.email || undefined, subject: `[Lead] ${formName}: ${fields.name || fields.email || "new"}${triage ? ` · ${triage.practice} · ${triage.fit}` : ""}`, text }) }));
  await Promise.allSettled(tasks);
  return new Response(JSON.stringify({ ok: true, triaged: Boolean(triage), delivered: tasks.length }), { status: 200, headers: { "content-type": "application/json" } });
};
