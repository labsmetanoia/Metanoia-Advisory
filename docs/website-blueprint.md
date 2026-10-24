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
