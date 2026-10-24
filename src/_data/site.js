import { readFileSync } from "node:fs";
import { PREVIEW } from "../../lib/content.js";

const cfg = JSON.parse(readFileSync(new URL("../../site.config.json", import.meta.url), "utf8"));
const phase = process.env.SITE_PHASE === "1" ? 1 : 2;

// In preview builds, unconfigured integrations get example.com placeholders so every component renders.
const warn = [];
const fill = (key, placeholder) => {
  if (!cfg[key]) {
    warn.push(key);
    if (PREVIEW) cfg[key] = placeholder;
  }
};
fill("email", "partner@example.com");
fill("linkedin", "https://www.linkedin.com/company/example");
fill("calendarUrl", "https://calendar.example.com/metanoia/working-session");
fill("credentialsPdf", "/assets/downloads/metanoia-credentials.pdf");
fill("domain", "https://www.example.com");
if (!cfg.hubspot.portalId) { warn.push("hubspot.portalId"); if (PREVIEW) cfg.hubspot.portalId = "00000000"; }
if (!cfg.hubspot.contactFormGuid) { warn.push("hubspot.contactFormGuid"); if (PREVIEW) cfg.hubspot.contactFormGuid = "00000000-0000-0000-0000-000000000000"; }
if (!cfg.hubspot.deckReviewFormGuid) { warn.push("hubspot.deckReviewFormGuid"); if (PREVIEW) cfg.hubspot.deckReviewFormGuid = "00000000-0000-0000-0000-000000000001"; }
if (!cfg.hubspot.newsletterFormGuid) { warn.push("hubspot.newsletterFormGuid"); if (PREVIEW) cfg.hubspot.newsletterFormGuid = "00000000-0000-0000-0000-000000000002"; }
if (!cfg.ga4MeasurementId) warn.push("ga4MeasurementId");
if (!cfg.linkedinPartnerId) warn.push("linkedinPartnerId");

if (warn.length) {
  console.warn(`[site.config.json] unconfigured: ${warn.join(", ")}${PREVIEW ? " (preview placeholders in use)" : " (related elements hidden)"}`);
}

export default {
  ...cfg,
  phase,
  preview: PREVIEW,
  baseUrl: cfg.domain ? cfg.domain.replace(/\/$/, "") : "",
  buildDate: new Date().toISOString(),
  practiceNames: {
    marketEntry: { en: "Indonesia Market Entry & Localization Strategy", id: "Strategi Masuk Pasar & Lokalisasi Indonesia" },
    advisory: { en: "Strategy & Investment Advisory", id: "Advisory Strategi & Investasi" },
    presentation: { en: "Strategic Storytelling & Corporate Communications", id: "Strategic Storytelling & Komunikasi Korporat" },
  },
};
