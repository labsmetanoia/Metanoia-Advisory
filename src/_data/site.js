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
const hubspotReady = Boolean(cfg.hubspot.portalId && cfg.hubspot.contactFormGuid);
const formsCfg = cfg.forms || {};
let formsProvider = formsCfg.provider || (hubspotReady ? "hubspot" : "netlify");
if (formsProvider === "hubspot" && !hubspotReady) formsProvider = "netlify";
if (formsProvider === "formspree" && !(formsCfg.formspree && formsCfg.formspree.contact)) { warn.push("forms.formspree.contact"); formsProvider = "none"; }
// Web3Forms: the access key is public by design (it only names the inbox), so it may sit in site.config.json or in the
// host's WEB3FORMS_KEY variable. Netlify Forms exists only on Netlify: a build on Cloudflare Pages (CF_PAGES is set
// there) uses Web3Forms instead, so the same repository serves working forms on either host during a move.
const web3Key = (process.env.WEB3FORMS_KEY || (formsCfg.web3forms && formsCfg.web3forms.accessKey) || "").trim();
const onCloudflare = Boolean(process.env.CF_PAGES);
if (formsProvider === "netlify" && onCloudflare) formsProvider = "web3forms";
if (formsProvider === "web3forms" && !web3Key) { warn.push("forms.web3forms.accessKey (or WEB3FORMS_KEY)"); formsProvider = "none"; }
if (!cfg.ga4MeasurementId) warn.push("ga4MeasurementId");
if (!cfg.linkedinPartnerId) warn.push("linkedinPartnerId");

if (warn.length) {
  console.warn(`[site.config.json] unconfigured: ${warn.join(", ")}${PREVIEW ? " (preview placeholders in use)" : " (related elements hidden)"}`);
}

export default {
  ...cfg,
  phase,
  preview: PREVIEW,
  forms: { provider: formsProvider, formspree: (formsCfg.formspree || {}), web3forms: { accessKey: web3Key } },
  analytics: cfg.analytics || {},
  ai: cfg.ai || {},
  tools: { ...(cfg.tools || {}), deckCheck: process.env.DECK_CHECK || (cfg.tools && cfg.tools.deckCheck) || "off" },
  baseUrl: cfg.domain ? cfg.domain.replace(/\/$/, "") : "",
  buildDate: new Date().toISOString(),
  practiceNames: {
    marketEntry: { en: "Indonesia Market Entry & Localization Strategy", id: "Strategi Masuk Pasar & Lokalisasi Indonesia" },
    advisory: { en: "Strategy & Investment Advisory", id: "Advisory Strategi & Investasi" },
    presentation: { en: "Strategic Storytelling & Corporate Communications", id: "Strategic Storytelling & Komunikasi Korporat" },
  },
};
