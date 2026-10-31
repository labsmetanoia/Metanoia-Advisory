# Metanoia Advisory — Website Blueprint

*Strategy, architecture, design, functional and technical specification for the corporate website. Version 1.0, 24 October 2026. Prepared from the Integrated Consulting Group feasibility study, the business plan and website framework, the Website Strategy & Design Roadmap, the Build Prompt for the IT Team, and the Indonesia Market-Entry feasibility study (v2).*

---

## 1. How to read this document

This blueprint does two things. It translates the business documents into a website specification, and it records what has already been built in this repository against that specification. Every statement is tagged where it matters:

- **Fact** — stated in the source documents or verifiable (regulation, published data).
- **Recommendation** — my proposal; adopt, adapt or reject.
- **Assumption** — something I had to decide to proceed; needs your confirmation (collected in section 13).

The site in this repository is a complete, working implementation of the blueprint: 23 static pages per language plus three CMS-style collections, bilingual, accessible, fast, deployable to any static host. What it does not contain is anything that would need to be invented: no client names, testimonials, outcome figures, portraits or credentials. Those slots exist, are validated by the build, and are filled only when real, permissioned material exists.

---

## 2. Assessment of the source documents: gaps and inconsistencies

The five documents are consistent on positioning, audience, tone, design direction and most of the architecture. Six points needed resolving before building.

| # | Issue | What the documents say | Resolution in this build | Status |
| --- | --- | --- | --- | --- |
| 1 | **Two practices or three?** | All five documents fix **two** practices, with market entry inside Strategy & Investment Advisory. The build prompt lists it under "decisions already made (do not reopen)". Your brief names **three**: Market-Entry Consulting as its own area | Built to your brief: **three practice hubs**. This maps cleanly onto the three "situations" already in the IA (entering → Market Entry; raising → Advisory; reporting → Presentation), so the home-page router becomes stronger, not weaker. Navigation grows from six to seven items, which fits at 1280 px. Collapsing back to two hubs would take one afternoon: delete one hub entry and re-parent four service files | **Decision needed (D1)** |
| 2 | **Platform** | Webflow (preferred) or Framer; "no custom back end"; the firm must publish content without the IT team | Built as a **static site on Eleventy**: plain HTML/CSS, 12 KB of JavaScript, no framework, no back end, hosted on any static CDN. This meets the performance, accessibility, SEO and bilingual requirements more precisely than a no-code tool and costs nothing to host. The trade-off is editor experience: content is JSON files in Git, not a visual CMS. Section 10 gives three ways to close that gap, including using this build as the exact reference for a Webflow rebuild | **Decision needed (D2)** |
| 3 | **Brand name** | The documents use "[Group]"; the brand-name decision is listed for week 0. The repository is named Metanoia-Advisory | Used **Metanoia Advisory** as the working name throughout (wordmark, metadata, legal pages). It reads as advisory, not creative, which the brand principles require. Changing it is a one-line edit in `site.config.json` plus the wordmark component | **Assumption (A1)** |
| 4 | **Phase 1 interim one-pager vs full site** | The roadmap wants a one-page site live in week 1–2 and the full site by week 10 (or month 6 in the business plan) | Both are the same codebase. `npm run build:phase1` renders Home as the interim one-pager (hero, three practices, founder card, contact, legal) and hides Work and Insights; `npm run build` renders the full site. Nothing is thrown away between phases | Built |
| 5 | **Proof without a track record** | "Nothing goes live that is not backed by a real engagement, person or artefact"; yet the templates need cases, people and before/after pairs to be designed and reviewed | Collections support a `draft` flag. Preview builds include drafts, label them *Illustrative* or *Draft* on every surface, and exclude them from search engines; production builds exclude them entirely and **fail** if placeholder text remains. The two illustrative cases, the draft founder profile and the three draft insights exist only to let you review the templates | Built |
| 6 | **Pricing on the site** | "No published rate card"; an optional "engagements from" floor on hubs is "a test, not a commitment" | No prices anywhere. The "engagements from" line exists behind a switch (`engagementsFromLine`), off by default, with the figures from the feasibility studies ready if you turn it on | **Decision needed (D5)** |

Smaller inconsistencies, resolved without needing a decision: the roadmap's template count (eleven) versus the build prompt's (thirteen), built as thirteen; the roadmap's type scale (Display 44/52) versus the build prompt's (52/58), built to the build prompt; the outcome numeral size (44–56 vs 56–72), built to 56–72 with 44 on mobile; the second-order fact in the hero artefact (a draft headline claimed Singapore's FDI exceeded Hong Kong and China combined, which the data does not support; corrected to "45% of the top four source countries combined", which it does).

---

## 3. What is established, what is recommended, what is assumed

**Established facts used on the site** (each with its source line where it appears):

- Indonesia realised Rp900.9 trillion of FDI in 2025, 46.6% of Rp1,931.2 trillion total realisation (BKPM via Jawa Pos, 16 Jan 2026).
- FDI by source, Jan–Sep 2025: Singapore USD 12.6 bn, Hong Kong 7.3 bn, China 5.4 bn, Malaysia 2.7 bn (BKPM via Bisnis, 17 Oct 2025).
- BKPM Regulation 5/2025 cut PT PMA minimum paid-up capital from Rp10 bn to Rp2.5 bn, in force October 2025 (ASEAN Briefing).
- US tariff on Indonesian goods set at 19%; Indonesia–EU CEPA concluded 23 September 2025.
- PSPK 1/2 effective 1 January 2027; SEOJK 16/2021 and POJK 51/2017 govern annual and sustainability reporting.
- The firm's structure: one brand, Jakarta, PT PMDN (KBLI 70209 primary), founder-led, bootstrapped, pre-launch; the design practice lead not yet identified; no engagements closed.

**Recommendations I have made** (adopt, adapt or reject): the three-hub architecture (if you confirm three practices); the Journal creative route as default (section 8.1); a static build instead of Webflow (section 10); the five process-step names; the engagement-ladder wording; the CTA labels; all copy in both languages; the GA4 event schema; the consent model; and the content-validation rules.

**Assumptions requiring confirmation** are listed in section 13.

**Deliberately not done:** no testimonials, client names or logos; no outcome figures presented as real; no partner biographies beyond what the documents state about the founder's background (investment, commercial partnerships, property); no named ecosystem partners (categories only); no office address beyond "Jakarta, Indonesia"; no email, phone or calendar link (configuration slots, hidden until filled).

---

## 4. Positioning and messaging

### 4.1 Brand narrative (one paragraph)

A decision in corporate Indonesia is made twice: once in the analysis and once in the room where it is presented. Most advisors own the first and hand off the second; most design studios own the second and never see the first. Metanoia Advisory owns both, and stays accountable through implementation. Three practices, one bench, one quality gate, one confidentiality regime: the partner who builds the case presents it to the board; the designer who builds the equity story produces the quarterly deck. The numbers in the model are the numbers in the room.

### 4.2 Key lines (both languages are on the site)

| Element | English | Bahasa Indonesia |
| --- | --- | --- |
| Positioning line (hero, 12 words) | We build the case, win the room, and *stay until it is done*. | Kami menyusun kajian, memenangkan ruang, dan *mendampingi hingga tuntas*. |
| Supporting sentence | Market-entry consulting, strategy and investment advisory, and presentation design for leadership teams making high-stakes decisions in Indonesia. One senior team, so the numbers in the model are the numbers in the room. | Konsultansi masuk pasar, advisory strategi dan investasi, serta desain presentasi untuk tim kepemimpinan yang mengambil keputusan berisiko tinggi di Indonesia. |
| Primary CTA | Talk to a partner | Bicara dengan partner |
| Closing band | Start with a 45-minute working session with a partner. | Mulai dengan sesi kerja 45 menit bersama partner kami. |
| Deck-review CTA | Request a review of your last public-expose deck | Minta tinjauan dek public expose terakhir Anda |
| Three situations | Entering or expanding in Indonesia · Raising, investing or restructuring · Reporting to the market | Memasuki atau memperluas bisnis di Indonesia · Menggalang dana, berinvestasi, atau merestrukturisasi · Melapor kepada pasar |

### 4.3 Practice promises

| Practice | Hero line | Differentiator stated on the hub |
| --- | --- | --- |
| Market-Entry Consulting | Enter Indonesia on a decision your board can defend. | From "should we?" to first local revenue; partner and site chosen on diligence; a senior local presence until your team is in place |
| Strategy & Investment Advisory | Decision-grade analysis for the decisions that carry the most money. | Feasibility studies, models and business cases built by the people who will present them |
| Presentation Design & Corporate Communications | Investor materials that say what the numbers mean. | One chart and storytelling standard, reconciled to your model, inside the disclosure rules (POJK, SEOJK, IDX, PSPK) |

### 4.4 Tone rules enforced in the copy

Senior, specific, calm. No superlatives, no exclamation marks, no agency vocabulary ("unlimited revisions", "24/7", "every industry", "free"), no consultancy abstractions ("synergies", "holistic"). Regulatory terms stay in official form in both languages. The word "free" does not appear; the working session is framed as senior time.

### 4.5 How the three practices read as one firm

- Home leads with one promise and routes by **situation**, not by practice.
- The "One firm, three practices" section shows the three doors side by side with identical structure.
- Every service page links to the most relevant service **in another practice**; every case lists the practices involved.
- One process strip (frame the decision → build the evidence → make the case → win the room → stay through delivery), re-worded per practice but structurally identical.
- One engagement ladder on About (working session → project → implementation), one confidentiality statement, one footer statement.

---

## 5. Audiences and the three journeys the site must complete

| Journey | Entry | Path on the site | Exit | Built behaviour |
| --- | --- | --- | --- | --- |
| Referred CFO (priority 1) | Introducer's link with UTM → Home or a case | Situation card → hub → service or case → partner face | Calendar booking | Primary CTA in header, hero and closing band on every page; Contact `#book` lists partners with calendar buttons; UTM captured into forms; booking reachable in two clicks from any page |
| Foreign entrant / fund partner (priority 1) | LinkedIn or chamber → Market-Entry hub (EN) | Service → case → entry note | Download + booking | English written for Singapore and European readers; "Download the Indonesia entry note" appears on the hub automatically once the flagship PDF exists |
| Head of IR / corporate secretary (priority 2) | LinkedIn → Presentation hub (ID) | Before/after → service → deck-review offer | Review request | Before/after slider on the hub; four-field deck-review form on Contact `#deck-review`, linked from the hub hero and every Presentation service |

Secondary audiences (referral partners, candidates, analysts) are served by About, People, the credentials PDF link and Insights.

---

## 6. Sitemap and URL structure

Two parallel trees with translated slugs. Bahasa Indonesia is the default for Indonesian browsers; the root `/` negotiates language (server redirect rule for Netlify/Cloudflare, with a client-side fallback and a visible chooser for no-JS). Every page carries `hreflang` id-ID / en / x-default and a language switch that preserves the page.

| Level | Page | EN path | ID path | Template | Source |
| --- | --- | --- | --- | --- | --- |
| 0 | Home | `/en/` | `/id/` | T1 | static |
| 1 | About and people | `/en/about/` | `/id/tentang/` | T2 | static + People |
| 2 | Person | `/en/people/{slug}/` | `/id/tim/{slug}/` | T3 | People |
| 1 | Market-Entry Consulting | `/en/market-entry/` | `/id/masuk-pasar/` | T4 | static |
| 2 | 4 services | `/en/market-entry/{slug}/` | `/id/masuk-pasar/{slug}/` | T5 | Services |
| 1 | Strategy & Investment Advisory | `/en/advisory/` | `/id/strategi-investasi/` | T4 | static |
| 2 | 4 services | `/en/advisory/{slug}/` | `/id/strategi-investasi/{slug}/` | T5 | Services |
| 1 | Presentation & Corporate Communications | `/en/presentation/` | `/id/presentasi/` | T4 | static |
| 2 | 3 services | `/en/presentation/{slug}/` | `/id/presentasi/{slug}/` | T5 | Services |
| 1 | Work | `/en/work/` | `/id/karya/` | T6 | Cases |
| 2 | Case | `/en/work/{slug}/` | `/id/karya/{slug}/` | T7 | Cases |
| 1 | Insights | `/en/insights/` | `/id/wawasan/` | T8 | Insights |
| 2 | Note / flagship | `/en/insights/{slug}/` | `/id/wawasan/{slug}/` | T9 / T10 | Insights |
| 1 | Contact | `/en/contact/` | `/id/kontak/` | T11 | static |
| — | Privacy · Terms · Conflicts | `/en/legal/{slug}/` | `/id/legal/{slug}/` | T12 | static |
| — | 404 | `/en/404.html`, `/404.html` | `/id/404.html` | T13 | static |

**Services (11):** Market assessment and entry strategy · Partner, distributor and site search · Localisation and go-to-market · Market representation and implementation · Feasibility studies and financial modelling · Business cases and investment analysis · Strategic planning and strategy refresh · Investment-grade documentation and capital-raise readiness · Investor and results decks · Equity story, strategy and board decks · Annual and sustainability reports.

**At launch:** 23 static pages per language (46), plus one page per person, case and insight in each language. Every page is within two clicks of Home.

---

## 7. Page-by-page content structure

Section order is fixed; copy limits are enforced in the content model.

**T1 Home.** Hero (positioning line, supporting sentence, primary and secondary CTA, one artefact: a deck page in the firm's chart standard) → three situation cards → three practice doors (name, three bullets, practice lead, link) → featured case band on tint (situation, what we built, outcome numeral with source, artefact) → people row (2–4) → flagship piece + newsletter → closing CTA. Phase 1 variant: hero, three practices, partner card(s), footer.

**T2 About.** Hero statement → one firm, three practices (≤ 250 words) → how we work (senior through implementation; the numbers match; confidential by design) → engagement ladder (working session 45 min → project 4–10 weeks fixed fee → implementation 6+ months retainer) → partners then associates → partner ecosystem (categories until agreements and permissions exist) → credentials PDF (ungated; hidden until the file exists).

**T3 Person.** Portrait 4:5 (initials tile until the portrait exists) · name · role · practices · 60-word track record · three representative engagements · languages · calendar and email buttons · LinkedIn · previous/next · schema.org Person.

**T4 Practice hub.** Hero (situation kicker, who it is for, promise, primary CTA, secondary: deck review or entry note) → service blocks with four labelled rows → five-step process strip → proof (Market Entry: sourced chart; Advisory: board-pack page; Presentation: before/after slider) → two featured cases → practice lead card → closing CTA. Optional "Engagements from" line.

**T5 Service.** Breadcrumb · title · promise · CTAs → who it is for (3) / what you get (list) / how long and what happens next → optional week-by-week strip → optional artefact with caption → related case → related service in another practice → closing CTA · schema.org Service.

**T6 Work.** Filters (practice, situation, sector) as toggle buttons, URL-reflected, no reload → card grid (3:2 artefact, sector tag, outcome title, one line, hover "Read case") → empty states in the firm's voice.

**T7 Case.** Breadcrumb · outcome title · meta row (sector, situation, practices, year, client only with permission) → situation (two sentences) → the decision at stake → what we built with 2–4 artefacts → outcome band (numeral, caption, source note) → practices and people involved → "Similar situation?" CTA with the situation pre-selected on Contact → next case · schema.org Article.

**T8 Insights.** Featured flagship (cover chart, summary, download or outline) → notes list (title, author chip, reading time, date) → newsletter.

**T9 Article / T10 Flagship.** Breadcrumb · kicker · title · summary · author chip · date · reading time · (flagship: three findings + download or "forthcoming") · optional chart · body with styled headings, tables that stack on mobile · sources · related services · share (LinkedIn, email, copy link) · newsletter.

**T11 Contact.** Hero → book a working session (partner cards with calendar and email) → four-field form (name, company, work email, situation; message optional; consent) → deck-review form (name, company, email, deck link; consent) → office and confidentiality statement. Honeypot, client-side rate limit, inline validation in words, success state with calendar link, no CAPTCHA.

**T12 Legal.** Privacy (UU 27/2022 and GDPR), Terms, Conflicts and confidentiality statement; each with last-updated date and a counsel-review notice until approved. **T13 404.** One line, three links, language-aware.

---

## 8. Design specification

### 8.1 Creative routes

Both routes are implemented as token sets and can be switched at build time (`SITE_ROUTE`) or live in preview builds.

| | Route 1 — The Journal (**recommended default**) | Route 2 — The Boardroom |
| --- | --- | --- |
| Headline face | Fraunces (variable, with italics) | Inter Tight (variable) |
| Text face | Inter | Inter |
| Paper / ink / accent | #FAF8F4 / #14161A / Prussian blue #1F3A5F | #F7F8FA / #101418 / deep teal #0E5B5B |
| Signature | Italic emphasis in the hero, serif outcome numerals, hairlines | Accent-coloured emphasis, tabular numerals, visible rule motif |
| Why recommend | It is the most visibly different from both reference sites (one is bold geometric sans, the other page-builder sans) and from Indonesian agency sites generally. The serif signals judgement and editorial restraint. | Cleaner for data-heavy pages; closer to Massoni in register, so the distinctiveness test is harder to pass |

The G2 decision stands: show both to three target users and choose.

### 8.2 Tokens, type, spacing (as built)

- Greys derived from ink: 66 / 30 / 10% (the brief said 60%; 66% is needed to keep ≥ 4.5:1 contrast on the tint bands). Tint = accent at 7%. Status colours for charts only; caution darkened to #7A6128 for AA on small text.
- Type scale per the build prompt: Display 52/58 (36/42 mobile), H1 40/48, H2 30/38, H3 22/30, body 17/28 (16/26), small 14/22, outcome numeral 64 (44 mobile). Max measure 68 characters. Two families, self-hosted, Latin + Latin Extended subsets, `font-display: swap`, preloaded. Payload: 115 KB regular (Journal) or 93 KB (Boardroom); italics add 81 KB only when used.
- 8 px spacing scale; 12 columns, 24 px gutters, 1200 px max, 16 px side gutters on mobile; breakpoints 1280 / 1024 / 768 / 390; 8 px radius on buttons and cards, 4 px on tags and inputs, 0 on images (hairline instead); section rhythm 96 px desktop / 64 px mobile.
- Motion: fade-up 200 ms / 8 px once; hover and underline transitions; nothing else. Disabled under `prefers-reduced-motion`.

### 8.3 Components built

Header (72 → 56 px on scroll, practice hover menus with child services and a featured case, text language toggle, persistent primary button, full-screen mobile menu with focus trap and pinned CTA) · primary and secondary buttons · situation card · practice door · service block · five-step process strip (vertical on mobile) · engagement ladder · case card · person card (initials fallback) · outcome figure · chart wrapper (title, source line) · before/after slider (range input: keyboard, touch, reduced-motion safe) · filters · forms with inline validation · newsletter field · contact card · statement block · notice (draft/illustrative) · consent banner · footer (four columns, statement, partner names, language switch).

### 8.4 Imagery and charts

Every image on the site is an artefact, a face or a chart. Built-in charts are inline SVG with the finding in the title, one accent, grey context, labelled values and a source line, in both languages: FDI by source country; PT PMA capital threshold; FDI share of total investment; indicative issuer calendar. The before/after pair and the board-pack page are **synthetic** and labelled as such on every surface. Portrait slots render an initials tile until real photographs exist (one photographer, one session, 4:5, mid-grey background). The wordmark is the name set in the headline face; a monogram SVG favicon and PNG fallbacks are generated from the tokens, as are the 1200×630 Open Graph images per template type.

---

## 9. Functional requirements (as built)

| Area | Behaviour |
| --- | --- |
| Bilingual | Two trees, translated slugs, `hreflang`, switch preserves the page, preference persisted (strictly necessary storage), root negotiates by browser language with a server rule and a visible chooser; `lang` attributes per page and per inline switch |
| Content model | Collections People, Cases, Insights, Services; every text field `{en, id}`; an item publishes only when all required fields are complete in both languages; character limits enforced (title ≤ 90, summary ≤ 120, meta ≤ 155, promise ≤ 180); outcome figure requires a source note; client name renders only when `permission` is true; `draft` keeps items out of production; production build fails on placeholder text |
| Navigation | Seven items + CTA + toggle; practice menus on hover/focus; breadcrumbs with BreadcrumbList on service, case, article and legal pages; every service cross-links to another practice; every case links to its services and a situation-preselected contact |
| Conversion | One solid-accent button per screen ("Talk to a partner"); CTA within one viewport of the end of every page; calendar links per partner or firm-wide; forms ≤ 4 fields + consent; success states carry the calendar link |
| Forms | Posted client-side to the HubSpot Forms API (portal and form GUIDs in config) with UTM parameters, page language and consent text; honeypot; client-side rate limit; inline errors in words; bilingual labels; hidden until HubSpot is configured |
| Work filters | Practice, situation, sector; URL query reflected; empty state with "clear filters" and a contact link |
| Consent | Bottom banner, two equal actions plus granular settings (analytics, marketing), stored choice, reopenable from the footer; GA4 and LinkedIn Insight Tag load only after the matching consent; nothing third-party loads before consent |
| Analytics | GA4 events: `cta_click {location}`, `form_submit {type}`, `download {asset}`, `language_switch {to}`, `outbound_calendar`, `newsletter_signup`, `case_view {slug}`; UTM convention per the brief captured into HubSpot hidden fields |
| Downloads | Credentials PDF ungated (hidden until the file exists); flagship reports direct in phase 2, with a `gated` toggle reserved for phase 3 |
| Phases | `SITE_PHASE=1` renders the interim one-pager from the same tokens and content |

---

## 10. Technical architecture and measured results

**Stack.** Eleventy 3 static site; Nunjucks templates; content as JSON; one CSS file (36 KB), one script (12.7 KB, no dependencies); inline SVG; self-hosted variable fonts. Output is plain HTML in `_site/`, deployable to Netlify, Cloudflare Pages, Vercel or any CDN; `netlify.toml`, `_headers` (HSTS, CSP, nosniff, referrer policy, frame denial, immutable asset caching) and `_redirects` (language negotiation, legacy 301 map) are included.

**Measured on this build.**

| Check | Result |
| --- | --- |
| Pages | 61 (preview) / 49 (production, drafts excluded); 23 static pages per language |
| Internal links | 2,995 checked, 0 broken |
| Bilingual parity | 100%: every `/id/` page has an `/en/` alternate and vice versa, one `h1` per page |
| Accessibility (axe-core, WCAG 2.1 A/AA + best practice) | 0 critical or serious issues on 15 representative templates; remaining notes are "heading-order" moderates where a card grid follows a kicker |
| Page weight (Home, EN, Journal) | HTML 23 KB; CSS + JS 52 KB; fonts 115 KB (Latin); no raster images; total under 200 KB against a 1.5 MB budget |
| Scripts before consent | None third-party |
| Structured data | Organization/ProfessionalService, Person, Service, Article, BreadcrumbList, ContactPage, AboutPage |
| SEO | Unique title and description per page and language; canonical; `hreflang`; OG and Twitter cards; sitemap with alternates; robots; translated slugs |

Core Web Vitals are not measured in this environment; with no render-blocking third-party code, preloaded subset fonts and sub-200 KB pages, LCP under 2.0 s on 4G is expected, and must be confirmed on staging from a Jakarta or Singapore node (PageSpeed Insights, WebPageTest).

**Editing without the IT team: three options (D2).**

1. **Keep this build; add a Git-based CMS** (Decap CMS or Pages CMS): a visual editor over the same JSON files, hosted free, with the bilingual validation still enforced at build. One or two days of configuration. *Recommended if cost and performance matter most.*
2. **Keep this build; edit JSON directly** in GitHub's web editor with the README as the guide. Zero cost; acceptable for a founder-run firm publishing one item a month.
3. **Rebuild in Webflow** using this site as the pixel-exact reference, design tokens and content model. Buys the editor the brief describes at USD 30–50/month plus the localisation add-on and the 4–6 developer days the roadmap budgeted.

**Security and privacy.** HTTPS only with HSTS; no server-side code, so no injection surface; form data stored in HubSpot only; privacy policy lists processors; consent compliant in structure with UU 27/2022 and GDPR (counsel review required); 2FA and account ownership are operational items in the launch checklist.

---

## 11. Inputs required from the firm (what the build cannot supply)

| Input | Where it goes | Needed for |
| --- | --- | --- |
| Confirmed brand name, legal entity name, domain | `site.config.json`, wordmark | Launch |
| Email, calendar URL, LinkedIn page, office address | `site.config.json` | Phase 1 |
| HubSpot portal ID and three form GUIDs; GA4 ID; LinkedIn partner ID | `site.config.json` | Phase 1 (forms, measurement) |
| Founder biography: track record ≤ 60 words, three representative engagements, portrait, calendar link | `content/people/reza.json` (currently draft) | Phase 1 |
| Design practice lead profile (when appointed) | new file in `content/people/` | Phase 2 |
| Three real case studies with permissions on file, outcome figures with source notes, 2–4 anonymised artefacts each (≥ 1600 px) | `content/cases/` (replace the two illustrative drafts) | Phase 2 |
| Two real before/after pairs | `content/pages/hubs.json` → presentation.proof | Phase 2 |
| Flagship PDFs (entry note; investor-communication study) | `content/insights/` + `src/assets/downloads/` | Phase 2/3 |
| Credentials PDF (8 pages, bilingual) | `src/assets/downloads/` | Phase 1 |
| Native Bahasa review of all copy | `content/`, `src/_data/ui.json` | Phase 1 |
| Counsel review of privacy, terms, conflicts statement | `content/pages/legal.json` | Launch |
| Named ecosystem partners with permission | `content/pages/about.json` | When signed |

---

## 12. Implementation priorities and launch plan

**Phase 1 — interim site (weeks 1–2).** Confirm D1–D3; fill `site.config.json`; complete the founder profile; commission portraits; connect HubSpot, calendar, GA4 and Search Console; native Bahasa review; deploy `npm run build:phase1` to the domain; submit the sitemap. *Everything else is already built.*

**Phase 2 — full site (by week 10 / month 6).** Replace illustrative drafts with three real cases and two before/after pairs; publish the first note and the flagship outline; add the design practice lead; counsel-approved legal pages; staging review against the 90-second test with two users; usability test with five participants (two IR, two foreign-entrant, one introducer); Core Web Vitals confirmed from Jakarta; deploy `npm run build`.

**Phase 3 — months 4–6 (separate scope).** Switch the `gated` toggle on flagship reports (adds a four-field form before download, already specified); newsletter archive; public-expose scorecard tool; partner page; corridor pages under Market Entry (Singapore, EU, GCC) when a named lead exists.

**Launch checklist (from the brief, mapped to this build).** Content: every page both languages (enforced); claims traced (source lines on every chart and outcome); no placeholder text (enforced in production build); legal reviewed. Technical: redirects from the interim URLs (`_redirects`); 404; HSTS; canonical; sitemap and robots; structured data validated with Google's Rich Results test; forms tested end to end to HubSpot; test booking; GA4 DebugView; consent blocks tags; staging `noindex`. Quality: LCP < 2.0 s and CLS < 0.1 on 4G; Lighthouse ≥ 90/95/95/100; axe zero critical/serious (met); keyboard and screen-reader pass (NVDA + Chrome, VoiceOver + Safari) documented; cross-browser matrix. Ownership: firm is admin on hosting, registrar, DNS, HubSpot, GA4, Search Console, email tool; 2FA on everywhere; repository ownership transferred.

**Post-launch.** Weekly checks in weeks 10–14; monthly: conversion by entry page and language, add one case or note; quarterly: claims audit, performance re-test, two-user mini usability check.

---

## 13. Decisions required

| # | Decision | Options | My recommendation | By |
| --- | --- | --- | --- | --- |
| D1 | Three practices (your brief) or two (all source documents) | Keep three hubs as built; or fold Market Entry back into Advisory | Three, as built: it matches your brief, the three situations and the market-entry study's own ambitions. Confirm that the business plan and credentials deck are updated to match | Week 0 |
| D2 | Platform | Keep this static build (+ Git CMS); or rebuild in Webflow from this reference | Keep this build and add Decap/Pages CMS when publishing frequency justifies it | Week 1 |
| D3 | Brand name "Metanoia Advisory" | Confirm, or supply the final name and domain | Confirm; it reads as advisory | Week 0 |
| D4 | Creative route | Journal or Boardroom (both built) | Journal; test both with three users at G2 | Week 3 |
| D5 | "Engagements from" line on hubs | On (USD 20k / USD 30k / Rp20m per month, from the studies) or off | Off at launch; test after the first five proposals | Week 5 |
| D6 | Calendar and email tools | HubSpot Meetings or Cal.com; Beehiiv or Mailchimp | HubSpot Meetings (one system) and Beehiiv | Week 3 / 6 |
| D7 | Singapore entity details | Show at launch or add later | Add later; the slot exists | Week 4 |
| D8 | Founder's public name and pronouns for biography copy | — | Supply; copy currently avoids pronouns | Week 1 |

**Assumptions to confirm (A).** A1 brand name; A2 "Advisory" kept as an English loanword in the Indonesian practice name (common in Jakarta professional services; a native reviewer may prefer "Penasihat"); A3 Indonesian slugs (`tentang`, `tim`, `masuk-pasar`, `strategi-investasi`, `presentasi`, `karya`, `wawasan`, `kontak`); A4 the five process-step names; A5 the retention periods in the privacy policy (five years; 14 months analytics); A6 the founder's background sentence (investment, commercial partnerships, property) taken from the feasibility study.

---

## 14. Status

| Item | Status |
| --- | --- |
| Strategy, IA, messaging, design system, 13 templates, 23 pages × 2 languages, 11 services, 3 collections with validation, charts, forms, consent, analytics hooks, SEO, structured data, security headers, OG images, favicons, phase-1 and phase-2 builds, QA scripts | Built and passing |
| Real people, cases, insights, artefacts, portraits, credentials PDF | Slots built; content to be supplied (drafts labelled and excluded from production) |
| Integrations | Code complete; IDs to be supplied in `site.config.json` |
| Core Web Vitals from Jakarta; screen-reader pass; usability test; counsel review; native Bahasa review | To be run on staging |
| Phase 3 (gating, scorecard tool, partner page, corridor pages) | Specified, not built |

---

## 15. Revision 1.1 — design and content refinement (24 October 2026)

Implemented from the founder's nine-point refinement brief. Where a point departs from the original build prompt, the departure is recorded here so the two documents stay reconcilable.

| # | Brief point | What changed | Departure from the original brief, if any |
| --- | --- | --- | --- |
| 1 | New colour palette | Tokens replaced across the whole site: paper `#FAF8F4`, sand `#EEE7DA` (bands, tint), gold `#EAB200` (buttons, bars, rules, chart accent), dark gold `#C09200` (hover), black `#000000` (ink). The second creative route and the live route toggle were removed; one palette now applies everywhere, including Open Graph images and favicons | Ink is pure black (the brief said never `#000`). Gold on cream is 1.9:1, so **gold never carries small text**: buttons use black text on gold, links are black with a gold underline. The focus ring is black for the same reason |
| 2 | Hero redesigned after the Aimo reference | Utility strip (location, email, LinkedIn, language) above a floating pill navigation; centred headline, sub-heading and supporting copy; five fanned artefact cards; a curved sand band carrying the flagship statement. Subtle grid lines and paper grain on a radial gold tint | The reference uses a purple gradient, AI-generated faces and heavy drop shadows. The build takes its **structure** and renders it with the firm's own artefacts; shadows appear only on the hero cards; the grain and tint are the only "mood" elements on the site |
| 3 | Presentation Design & Corporate Communications as the flagship | Practice order is now Presentation → Market Entry & Localization → Strategy & Investment in navigation, home, hubs and footer. Home opens with the supplied headline, sub-heading and supporting copy, then the flagship statement, the eleven-service portfolio, the AI-powered band, complementary services, the working approach, and only then the two advisory practices | The original architecture routed by situation; the three situation cards are folded into the two advisory doors and the flagship band ("reporting to the market") |
| 4 | AI-powered presentation design | New service page and a dark band on Home and the Presentation hub: "Professional presentations, ready in hours." Three steps (brief → draft → review and deliver), three guardrails (your template, no consumer AI tools, not for market disclosure) and an "express brief" call to action | The original brief banned "AI-powered, ready in hours" as agency vocabulary. It is now a deliberate offer, framed with a senior review on every page. **Assumption A7:** same-working-day delivery for decks up to about 20 pages from a brief received in the morning, Jakarta time; confirm before launch |
| 5 | Expanded Presentation portfolio | Eleven service pages on one template, with an icon set and a tile grid on Home and the hub: Board & executive decks · Consulting presentations · Sales proposals · Company newsletters · Corporate presentation templates · Investor pitch decks · Earnings call presentations & investor reports · Educational materials · Marketing presentations · Annual and sustainability reports · AI-powered presentation design | Two earlier pages were renamed and re-cut (equity story → board & executive decks; investor and results decks → earnings call presentations & investor reports). Annual and sustainability reports were kept from the business plan |
| 6 | Complementary services | Section on Home and the Presentation hub with the supplied introduction and four services (Social Media Strategy & Management; Corporate Branding; Business Plan Development; Event Brochures & Marketing Collateral), presented as cards without their own pages so they do not compete with the core navigation | The integration study listed media relations and video among services the firm "does not do"; social-media management is new scope. **Decision D9:** confirm delivery capacity (in-house or partner) before the first proposal |
| 7 | Working approach | New section on Home and About: "What you see" (client team ↔ senior engagement lead) and "What works in the background" (engagement manager → strategy and content, design, reconciliation and QA, translation and regulatory review), followed by the five stages from engagement and requirements to final delivery | None |
| 8 | Rename | "Market-Entry Consulting" is now "Indonesia Market Entry & Localization Strategy" in practice names, headings, metadata, footer and URLs (`/en/indonesia-market-entry/`, `/id/masuk-pasar-indonesia/`). The navigation label is the shorter "Market Entry & Localization" so the pill fits at 1280 px | Navigation label is abbreviated; everywhere else uses the full name |
| 9 | Institutional identity | The founder profile was deleted; people sections, partner cards, author chips and footer names disappear automatically because the People collection is empty. Contact offers a firm-wide booking button and email; insights are bylined "Metanoia Advisory"; About replaces the team grid with the working-approach section. Credibility rests on the method, the standard, the artefacts and the conflicts statement | The original brief's "partner faces" principle is suspended for launch. Re-introducing the team is a matter of adding files to `content/people/` |

**Measured after the revision.** 75 pages in preview (61 in production); 4,251 internal links checked, none broken; bilingual parity 100%; axe-core zero critical or serious issues on the 14 templates tested. Page weight on Home rises slightly with the five inline artefacts and remains well under 300 KB.

**Updated decisions list.** D1–D8 stand (D4, creative route, is now closed: one palette). New: **D9** complementary-services delivery capacity; **A7** the express turnaround commitment; **A8** the headline "Global Perspective. Proven Expertise." and its Indonesian rendering "Perspektif Global. Keahlian Teruji." (a native reviewer may prefer "Keahlian yang Terbukti").

---

## 16. Revision 1.2 — homepage design refinement and motion (24 October 2026)

Implemented from the founder's nine-point design-refinement feedback, with the supplied mock-ups as references.

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Hero motion | Headline, sub-heading, copy and buttons rise in a staggered sequence on load; the five artefact cards fan out from a stack with a 0.5–0.7 s stagger, then carry a slow light sheen; cards lift on hover; the curved band rises after the cards. All motion is CSS, disabled under `prefers-reduced-motion`, and the page is complete at rest without JavaScript | Purposeful and short: one orchestrated load sequence, no parallax or scroll-jacking |
| 2 | Remove "Jakarta · Presentation Design and Advisory" | The hero kicker is gone. The location was also removed from the utility strip and the footer line; the office address remains on Contact only | Scope read as "location and descriptor" per the heading |
| 3 | "Services We Offer" | Renamed in both languages on Home and the hub. Section head now pairs the title with three value pillars (Strategy-led, Institutional quality, Fast and reliable). Tiles are numbered 01–11 with icon, title, line, arrow button and a diagonal cut panel on the right; the AI tile is dark and spans two columns. Tiles reveal with a stagger on scroll and lift on hover, with the cut panel sliding | The reference's photographs are replaced by the firm's own artefacts inside the cut panel; the panel accepts a photograph later |
| 4 | AI-powered band | Headline with the gold word, three numbered steps with icons, "What stays the same" list with icon discs and the express-brief button on the right, and a floating three-card artefact stack in place of the laptop photograph; the gold glow drifts slowly | Matches the reference's composition without imagery |
| 5 | Complementary services | Left intro with gold word ("further."), right 2 × 2 cards with icon, title, text, arrow button and diagonal cut panel | — |
| 6 | How we work with you | Rebuilt as a dark band after the Storyfiner "Our unique approach" layout: "What you see" (your team ↔ engagement lead) and "What works in the background" (engagement manager → four teams) with connector nodes, a dashed divider and icons in every box, followed by the five stages. Applied on Home and About | — |
| 7 | Advisory practices | Two large cards with gold kicker, title, intro, three icon-disc bullets, gold button and a dark-gold diagonal panel carrying the tagline ("Local insights. Real opportunities." / "Clear analysis. Stronger decisions.") and an artefact | Taglines are new copy; confirm |
| 8 | Illustrative case section | Removed from Home. Cases remain on Work and the hubs (preview only) | — |
| 9 | Closing call to action | Headline with "45-minute" in gold, three mini-pillars (Focused discussion, Partner-level perspective, No proposal required), gold button, and a diagonal gold panel on the right carrying a working-session agenda artefact. The band is shared by every page | The reference's office photograph is replaced by the agenda artefact |

**Colour note.** Gold display words use `--gold-text #9A7200` on paper (≥ 4:1) rather than the palette's `#C09200`, which fails contrast even at display sizes; on the dark bands the palette gold `#EAB200` is used as supplied.

**Measured after the revision.** 75 pages (preview), no broken links, bilingual parity 100%, axe-core zero critical or serious issues on the tested templates.

---

## 17. Revision 1.3 — video hero, live slides and photography (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Video background and animated slides | The uploaded 10-second clip is transcoded to two silent H.264 files (1280 px, 1.1 MB; 854 px, 0.4 MB) with a WebP poster. The browser loads the video only on screens 768 px and wider, when reduced motion is off and data-saver is off; otherwise the poster shows. A paper-coloured veil keeps the headline and copy at full contrast. After the load sequence the five artefact cards cycle through the fan positions every 4.2 seconds with a 1.2-second easing, and the centre card floats | Page weight on Home with video is about 1.6 MB on desktop; the mobile build stays under 600 KB |
| 2 | Uploaded images mapped to sections | Eleven service tiles, four complementary cards and the intro visual, the two advisory cards, the AI tile and band, and the closing call to action now carry the matching uploaded image as WebP (82 quality). Originals are kept in `assets-src/photos/` | The tile crops are small (about 255 × 150 px) and will look soft on high-density screens; higher-resolution versions of the same images would help. **Three uploads were not used:** the "AI-powered · Ready in hours" pictures 1–3 are other companies' published materials (an stc/MAGNiTT report cover and two pages from Grab's 2023 ESG report). Presenting them as the firm's work would misrepresent authorship and infringe copyright; they are set aside in `assets-src/excluded-third-party/` |
| 3 | How we work with you | Photo boxes for "Your team", "Metanoia engagement lead" and "Engagement manager", photo strips on the four background teams, and five stage cards with photographs, all cut from the supplied reference composite; section intros added as in the reference | The crops come from a 1536 × 1024 composite, so they are low resolution; replace with the originals when available |

**Licensing note.** The Jakarta skyline and LRT photographs supplied for the advisory cards are used as directed; their licences are the firm's responsibility to confirm before launch.

---

## 18. Revision 1.4 — visual defects and "How we work" (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Slides obscured; video position | The hero's content layer now sits above the curved band, so the five cycling slides render in front of everything; the band gained headroom so the slides never cover its kicker. The video frame is shifted up by 18% (10% on phones) so the landmarks in the lower part of the footage show behind the slides; the readability veil fades towards the bottom | No scaling is applied to the video, so the uncovered strip at the bottom sits under the sand band |
| 2 | Blurry images | Every source under 700 px wide is re-exported at 2× with Lanczos resampling and an unsharp mask, so the browser scales from a cleaner image. Phones show tile photos as a top band instead of a cropped diagonal | The uploads are still small (about 255 × 150 px); the only full fix is higher-resolution originals |
| 3 | AI-section images | The three "v2" uploads replace the artefact stack in the AI-powered band, in the order supplied, as floating cards with cover fit | They remain third-party published materials (an stc/MAGNiTT report cover and Grab ESG report pages). The firm must hold the right to display them, or credit the owners, before launch |
| 4 | How we work | Rebuilt on the reference: photo cards with an icon badge overlapping the photograph for "Your team", the engagement lead (gold outline and glow) and the engagement manager; a gold spine with connector ticks and dots linking the manager to four photo strips; icon bullets; five stage cards with photographs. Motion: cards rise in sequence, the spine draws top to bottom and the ticks and strips follow, the arrow between client and lead nudges, cards lift on hover; all disabled under reduced motion | — |
| 5 | Text visibility | Text columns in every cut-panel card now stop at 56% of the card and sit above the gold stripe; long words wrap; advisory bullets no longer run under the panel. The navigation collapses into the menu below 1200 px, which removes a 190 px overflow on 1024 px tablets. An automated check now measures elements wider than the viewport at 1440, 1024 and 390 px | Zero overflow on all three widths; axe-core zero critical or serious on 14 templates |

---

## 19. Revision 1.5 — navigation, language selector and hero assets (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Top utility bar | Removed from every page. The email, LinkedIn and language links it carried are already in the footer; the header is now a single pill with the wordmark, navigation, language selector and the "Talk to a partner" button | The `.topbar` styles are retired, not deleted, so the bar can be restored if a later phase needs it |
| 2 | Flag-based language selector | A new `lang-select` component: a pill button showing the current flag (Indonesia or United Kingdom) and code (ID / EN) that opens a two-row list of flag, code and language name, with the current language ticked. The alternate row links to the same page in the other language, so the switch is a real page change, not a cosmetic toggle. It appears in the desktop header, at the top of the mobile menu and in the footer; keyboard-reachable, closes on Escape or an outside click, and announced as "Language: EN" to screen readers | The United Kingdom flag stands for English as in the reference; a US or generic icon can be swapped in without touching the markup |
| 3 | Hero slides | The five "Hero section - pic 1–5" uploads replace the generated slides, in the order supplied (1200 px WebP, 16:9 cards). They keep the same fan layout and 4.2-second rotation | Originals kept in `assets-src/photos/` |
| 4 | Hero background | The "Metanoia Advisory - Hero Section Background" upload replaces the video as a static image (1672 px and 960 px WebP with `srcset`), anchored to the bottom so the skyline sits behind the slide fan, with a paper-coloured veil over the top half so the headline keeps its contrast. First-paint cost drops from 1.1 MB of video to 180 KB of image | The transcoded video files and loader remain in the repo should the firm want to return to a motion background |
| 5 | "Services We Offer" image quality | The supplied tile photographs are 254–355 px wide. Rather than stretching them to fill the panel (which is what made them soft), each is now rendered as a tilted card at or below its native width inside the diagonal panel; the complementary cards and the AI tile use the same treatment. Phones keep the full-width top band | This is as sharp as these sources allow. For crisp rendering on high-density screens the firm should supply originals of at least 800 px on the long side; the pipeline will pick them up without code changes |
| 6 | Cross-device testing | Fixed three defects found in testing: the mobile menu collapsed to the header height on all phones and tablets (the header's blur made it the containing block for the fixed menu; the blur now lives on a pseudo-element); the "How we work" band rendered as two cramped columns on phones because a tablet rule overrode the phone rule; and the strips' entry animation caused a 2 px horizontal scroll on phones | Tested at 1440, 1024, 768 and 390 px in both languages |

**Measured after the revision.** 75 pages (preview), no broken links, bilingual parity 100%, axe-core zero critical, serious, moderate or minor issues on the fourteen tested templates, no horizontal overflow at any tested width.

---

## 20. Revision 1.6 — header fit, hero background, tile layout, dark closing band (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1a | Header alignment | The pill's content (wordmark, seven links, selector, button) needed about 1,290 px but the pill was capped at 1,200 px, so the button overflowed on every desktop. The header may now span up to 1,320 px, the desktop navigation is set tighter (14 px gaps, 14.5 px links, a 40 px button) and the full navigation collapses into the menu below 1,280 px instead of 1,200 px. Measured in both languages at 1,600 / 1,440 / 1,366 / 1,280 px: the button ends inside the pill in every case | Indonesian labels are about 25 px wider than English, so the fit is checked in both |
| 1b | Circular flags | The two flag glyphs are now drawn inside a 20 px circle with a hairline ring, in the header pill, the dropdown, the mobile menu and the footer | Same inline SVG, no image requests |
| 2 | Hero background missing | The site build was correct; the preview export left the responsive `srcset` attribute with absolute paths, so the hosted preview could not find the image. The exporter now rewrites `srcset` as it does `src`, and the background renders on the preview link. Positioning, bottom anchoring and the contrast veil are unchanged | Verified at 1,440 / 1,024 / 390 px |
| 3 | "Services We Offer" layout | The tilted-card treatment from 1.5 is removed; the cards are back to the 1.4 layout with the photograph filling the diagonal panel edge to edge. To make that layout sharp from 254–355 px sources, every tile and complementary photo is now upscaled 4× with Real-ESRGAN (a learned super-resolution model) and delivered at 1,000 px (tiles) and 720 px (complementary), so the browser scales down rather than up | Upscaled images reconstruct detail plausibly rather than exactly; for product photographs the firm should still prefer true high-resolution originals when it has them |
| 4 | Dark closing call to action | The band is now near-black with the gold rule, white headline with "45-minute" in gold, muted supporting copy, three pillars with gold-ringed icons and hairline dividers, and a wide gold button with the arrow set to the right. The photograph fills the right half behind a gold diagonal with a soft gold glow fading into the dark. On phones the photograph becomes a band above the copy and the button spans the width | Contrast: white and gold on near-black exceed 10:1; the muted copy exceeds 7:1 |

**Measured after the revision.** 75 pages (preview), no broken links, bilingual parity 100%, axe-core zero issues of any severity on the fourteen tested templates, no horizontal overflow at 1,600 / 1,440 / 1,366 / 1,280 / 1,024 / 390 px.

---

## 21. Revision 1.7 — header button, hero landmarks, dark-band icons (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Header navigation and button | The header button now reads "Contact Us" / "Hubungi Kami" (new `cta.contact` string; the hero and closing-band buttons keep "Talk to a partner"). The Indonesian label had still been 7 px too wide for the pill in revision 1.6; the shorter label leaves 13 px of clearance in both languages at 1,600 / 1,440 / 1,366 / 1,280 px, the button no longer shrinks, and the pill clips anything that would ever overflow it. The same label is used in the mobile menu | — |
| 2 | Hero landmarks | The hero stage is much taller than the background's aspect ratio, so cover-fitting stretched the image to the full stage and pushed the skyline beneath the slides and the next section. The background now occupies only the upper 820 px of the stage (800 / 740 / 700 px on smaller screens), anchored to the bottom, so the Eiffel Tower, Mount Fuji, Marina Bay Sands and the Statue of Liberty sit between the buttons and the slide fan. The veil is heavier over the headline and copy, fades out over the landmarks and returns to paper at the image's foot; the hero copy carries a soft paper halo so it stays legible where a landmark rises behind it | Verified at 1,440 / 1,024 / 390 px in both languages |
| 3 | "How we work" icons | The badge and strip icons were drawn in black on the near-black circles (the icon component's default colour won over the circle's), so only each glyph's single gold accent path was visible, which read as broken or blurred icons. All line work in that band is now gold with the accent path in paper, the stroke is heavier (2.25 units) so 26–28 px renders crisp, and the badges and strip icons are a size larger | Same vector icon set as the rest of the site; no raster assets |

**Measured after the revision.** 75 pages (preview), no broken links, bilingual parity 100%, axe-core zero issues of any severity on the fourteen tested templates, header button inside its pill in both languages at every desktop width tested.

---

## 22. Revision 1.8 — Strategic Storytelling, practice-page heroes, four-service cards, Work retired (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Terminology | "Presentation Design & Corporate Communications" is now "Strategic Storytelling & Corporate Communications" in the practice name (header, footer, Home flagship section, page titles, structured data), the navigation label is "Strategic Storytelling", and the AI express tile and summary open with "Strategic Storytelling & Corporate Communications, ready in hours". References to "the Presentation practice" in service copy now read "the Strategic Storytelling practice" | Indonesian keeps "Strategic Storytelling" as a proper name ("Strategic Storytelling & Komunikasi Korporat"), as the firm does with "Advisory"; a translated form such as "Penceritaan Strategis" can be substituted in `site.js` and `ui.json` if preferred |
| 2 | Page rename and URLs | The hub moves from `/en/presentation/` and `/id/presentasi/` to `/en/strategic-storytelling/` and `/id/storytelling-strategis/`; its eleven service pages move with it. Permanent redirects for the old hub and every old service path are in `_redirects` | Internal links come from the route table, so nothing else needed editing |
| 3, 4, 7 | Practice-page heroes | All three practice pages open with a full-bleed photograph under a dark veil, the practice name as a gold kicker over a gold rule, a large paper headline, the lede and two buttons (gold primary, paper outline secondary), after the supplied reference. Strategic Storytelling gets new hero copy that draws the line against conventional presentation design: "Strategy first. Then the deck." with a lede on building the argument before the layout | Hero photographs: the boardroom at dusk (Storytelling), the Jakarta skyline (Market Entry) and the two advisers at the window (Strategy & Investment), each upscaled with Real-ESRGAN for full-width use |
| 5, 8 | Four-services sections | Rebuilt as four numbered photo cards after the references: photograph with a gold numeral, gold icon disc and title, four labelled rows (who it is for, what you get, how long, what happens next) each with a gold line icon, and an outline button carrying the service name. The eight photographs were cut from the supplied references, their baked-in numerals painted out, and upscaled 4× to 1,200 px. The section head carries the gold rule, the title with gold emphasis and the intro behind a hairline | Two columns on tablets, one on phones |
| 6 | Market Entry sections | "What a market assessment page looks like" and "Related cases" are removed; the services section flows straight into the five-step process | Strategy & Investment keeps its "What the board receives" chart section, which was not in scope |
| 9 | Work page | The Work page, the two illustrative case studies, their navigation and footer links, the "Related cases" and "Related work" blocks on practice and service pages, and the 404 page's Work button are removed. `/en/work/*` and `/id/karya/*` redirect permanently to the language home. The footer column is now "Insights and resources" | The illustrative case content is deleted from the repository; the case-study template can be rebuilt from the blueprint when the firm has reference engagements to publish |

**Measured after the revision.** 69 pages (preview), no broken links, bilingual parity 100%, axe-core zero issues of any severity on the twelve tested templates, header button inside its pill in both languages at 1,600 / 1,440 / 1,366 / 1,280 px.

---

## 23. Revision 1.9 — refined header, "Talk to Our Team", About page (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Header navigation | The pill loses its grey border for a soft lift and a faint gold hairline along its base; the wordmark is larger with "ADVISORY" letter-spaced in dark gold; links sit in a quieter ink and gain a gold underline that draws from the left on hover and stays on the active page; a hairline separates the links from the language selector, which now sits on a tinted pill; the button is a rounded pill with a sliding arrow that inverts to black-and-gold on hover. On phones and tablets the menu links are numbered in dark gold with a gold dot on the active page, and the Menu and Contact buttons are rounded. Measured in both languages at 1,600 / 1,440 / 1,366 / 1,280 px: the button clears the pill everywhere | Applied through the shared header component, so every page carries it |
| 2 | Call-to-action wording | "Talk to a partner" is now "Talk to Our Team" ("Bicara dengan Tim Kami") in the shared string used by the hero, practice-page heroes, service pages, the closing band and the contact page | The closing band's headline, "Start with a 45-minute working session with a partner", describes the session rather than naming the button and is unchanged |
| 3 | About page | Rebuilt after the reference, in the site's palette and type: a hero with the kicker, the headline with its second clause in gold and the skyline photograph fading in from the right; "One firm, one standard, three practices" with the mountain photograph under the title, the three practice paragraphs behind a gold rule and three numbered practice cards linking to the practice pages; "How we work" as three pillars with gold icon discs and a photograph each; the engagement ladder as three numbered steps on a gold line with tinted icon discs and the ridge photograph fading in below; the partner ecosystem as five cards (two by two plus one wide) with gold icon discs and photographs fading in from the right; and a credentials band with the gold rule, kicker, title and download button. The dark "How we work with you" diagram, which repeats the Home section, is no longer on About | All twelve photographs were cut from the three references and upscaled 4× with Real-ESRGAN (skyline 1,400 px, pillar photographs 1,200 px, ecosystem cards 800 px, ridge 2,400 px). The references still named "Presentation Design"; the page uses "Strategic Storytelling" throughout |

**Measured after the revision.** 69 pages (preview), no broken links, bilingual parity 100%, axe-core zero issues of any severity on the twelve tested templates, no horizontal overflow at 1,440 / 1,024 / 390 px.

---

## 24. Revision 2.0 — dropdown navigation, Indonesia band, hero photograph, footer (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Dropdown navigation | Each practice link opens a panel the width of the header pill, after the SKHA reference: a gold accent line, the practice name with an "All services" link, the service list (two columns for the eleven storytelling services) with a gold marker on the active item, a description column that follows the pointer or keyboard focus with a "Learn more" link, and a third column that shows up to two insights for that practice with dates and "Read more", or, when none is published, the practice tagline, situation line and "Talk to Our Team". The panel opens on hover and on keyboard focus, closes on Escape, and the links show a chevron from 1,366 px (the 1,280 px header has no room for it). On phones and tablets each practice gets a round chevron button that expands the service list inside the menu | Panels are rendered in the HTML, so the links work without JavaScript; the hover and keyboard behaviour are CSS, with a few lines of script for the description swap and the accordion |
| 2 | Indonesia band on Home | New section between "Advisory practices" and the flagship note: the supplied heading (with "Succeed in Indonesia" in gold) and subheading verbatim, three proof points drawn from the practice's services, "Explore the practice" and "Talk to Our Team" buttons, and the Jakarta skyline photograph in a framed card with a gold outline on a paper-to-sand gradient | Indonesian copy supplied alongside |
| 3 | Strategy & Investment hero | The uploaded 7,360 px photograph (night skyline with light trails) replaces the previous hero image, delivered at 2,560 and 1,600 px with `srcset`, focal point set on the towers, under the existing dark veil so the headline and copy keep their contrast | Original kept in `assets-src/photos/`; the earlier hero file is removed |
| 4 | Footer | Rebuilt over the Golden Indonesian Archipelago panorama (2,048 and 1,280 px WebP, bottom-anchored) under a paper veil that is near-opaque at the top and clears over the islands: a brand row with the large wordmark, the tagline, the office line and a "Talk to Our Team" button; four columns with gold letter-spaced headings; the independence statement on a frosted panel; and the legal strip with the language selector. Phones stack the brand row and columns | The Metanoia Labs footer reference named in the brief was not attached and no public Metanoia Labs site could be found, so the composition follows the brief's description; it can be aligned to the reference once supplied |

**Measured after the revision.** 69 pages (preview), no broken links, bilingual parity 100%, axe-core zero issues of any severity on the twelve tested templates, header button inside its pill in both languages at 1,600 / 1,440 / 1,366 / 1,280 px, no horizontal overflow at 1,440 or 390 px.

---

## 25. Revision 2.1 — footer, text clearance, imagery and copy (24 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Footer | Gold rule above a larger wordmark, the tagline set larger with tighter letter-spacing, column headings with a short gold hairline, roomier links with a gold underline that draws in on hover, the independence statement on a gold-edged frosted panel, and the legal strip on a frosted bar. The placeholder email line is removed; the footer carries no contact address until the firm's real one is set in `site.config.json` (the contact page still uses the configured address) | — |
| 2 | Text visibility | Root cause: on the diagonal-panel cards the copy column ran to 56% of the card while the gold stripe's foot sat at about 50%, so the lowest lines of longer paragraphs ran under the stripe (the "Earnings call", "Annual and sustainability reports" and "Business Plan Development" cards in the screenshots). Body copy now stops at 48%, the stripe's foot moves right to about 54%, and titles, which sit where the stripe is further right, may run to 58% so words no longer break mid-word. Verified with a geometry check that measures every text line against the stripe's edge at that line's height on every card of Home and the Strategic Storytelling page at 1,440 / 1,280 / 1,024 / 700 / 390 px, in both languages: no overlap, no mid-word breaks | The check is a Playwright script run during QA, not shipped code |
| 3 | "How we work" images | The twelve photographs (three people, four background-team strips, five stage cards) are upscaled 4× with Real-ESRGAN and delivered at roughly twice their rendered size, so they are sharp on high-density screens | Rendered sizes unchanged |
| 4 | AI tagline | "Professional presentations, ready in hours." is now "Professional Strategic Storytelling, Delivered in Hours." in the AI band title, the express tile line and the service promise | Indonesian: "Strategic Storytelling Profesional, Siap dalam Hitungan Jam." |
| 5 | Before and after | The slider now shows the uploaded Before (two paragraphs beside a field photograph) and After ("From Equipment to Intelligence") images, at 1,600 and 1,000 px, with descriptive alt text and a caption. The section copy describes the pair and marks it as an illustrative example built on public information about John Deere | Earlier synthetic chart pair retained in the repo as components but no longer used |
| 6 | "What the board receives" | The uploaded LNG demand-nodes page replaces the synthetic slide, at 1,600 and 1,000 px, with alt text and a caption; the copy marks it as illustrative and drawing on a published industry scenario | This section lives on the Strategy & Investment page, where the brief's "What the board receives" heading appears |
| 7 | "Jakarta" on About | Removed from the story ("Metanoia Advisory is an advisory firm for leadership teams…") and the page description ("…is an advisory firm with strategic storytelling…"); the footer's "Jakarta, Indonesia" line, which also appeared on About, is removed with the email line | The contact page, privacy notice and the express service's "Jakarta time" line are outside the About page and unchanged |

**Measured after the revision.** 69 pages (preview), no broken links, bilingual parity 100%, axe-core zero issues of any severity on the twelve tested templates, no copy under a gold stripe on any card at any tested width.

---

## 26. Revision 2.2 — service pages, footer legal strip (31 October 2026)

| # | Feedback point | What changed | Note |
| --- | --- | --- | --- |
| 1 | Footer legal strip | The independence statement and the copyright line now share one frosted bar at the foot of the footer: the statement left behind a gold hairline at 13 px, the copyright and the language selector right, on a single row that stacks on phones | Replaces the two separate frosted blocks of revision 2.1 |
| 2–5 | Service pages | The service template is rebuilt for all nineteen service pages, after the four references: a hero with the breadcrumb, a gold rule, the title with its tail in gold (per-service word count), the promise and two buttons, and a photograph fading in from the right; four numbered facts (who it is for, what you get, how long, what happens next) with tinted icon discs, gold bullets and, where supplied, a photograph under the first two; the artefact band (the investor calendar on Earnings calls) as a framed white card beside the title with a skyline fading in below the copy; and the "Related in the other practice" block as a tinted band with the related service's photograph fading in from the right. The four referenced pages carry the photographs cut from their references (eleven images, baked-in reference text painted out or trimmed, upscaled 4× to 1,600 / 1,400 / 1,000 px). Other service pages use their existing tile photograph in the hero and the related service's photograph in the band | Heroes crop from the right on tablets and move above the copy on phones; the facts stack in one column below 900 px |

**Measured after the revision.** 70 pages (preview), no broken links, bilingual parity 100%, axe-core zero issues of any severity on the twelve tested templates, no horizontal overflow on the four referenced pages at 1,440 / 390 px.

---

## 27. Revision 2.3 — service sections re-aligned to the references (31 October 2026)

| Section | Change | Note |
| --- | --- | --- |
| Hero | Two true columns: the copy sits on the page grid at the left, the photograph fills the right half of the viewport to its edge with a short fade at its inner edge. Both buttons share one row at desktop widths. The gold emphasis follows each reference word for word (Board & *executive decks*; Sales *proposals*; Corporate *presentation* templates; Earnings call presentations *& investor reports*), set per service in `heroTitle`. The boardroom reference's tagline, "One story. Many audiences. Greater alignment.", is restored as live gold italic text over the photograph with a short gold rule | The emphasis fallback for services without `heroTitle` stays the last word |
| Four facts | Each column opens with its number and a long gold hairline on one baseline, then a large tinted disc with the icon beside a 28 px heading, gold-dot lists, and the photograph at the foot of the first two columns; thin vertical dividers separate the columns; the third column stacks "How long" and "What happens next", each with its own numbered rule | The 2.2 border-top treatment is removed |
| The year, planned | The white card sits beside the title at the reference proportions, the chart inside with no inner frame, the caption on a tinted pill with a bar-chart icon; the skyline photograph sits under the copy at the foot of the left column, fading in from above | — |
| Related in the other practice | Sand band; kicker with the gold rule beneath it; title, practice line, promise and a bold link with a gold arrow; the photograph fills the right half to the viewport edge with a short inner fade | — |

Verified at 1,440 / 1,280 / 1,024 / 390 px on the four referenced pages: copy aligned to the page grid at every width, buttons on one row from 1,100 px, no horizontal overflow; links, parity and accessibility checks pass.
