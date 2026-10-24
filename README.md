# Metanoia Advisory — corporate website

Bilingual (Bahasa Indonesia / English) corporate website for Metanoia Advisory, a Jakarta firm with Strategic Storytelling & Corporate Communications as its core practice, supported by Indonesia Market Entry & Localization Strategy and Strategy & Investment Advisory.

The strategy, sitemap, page-by-page content structure, design specification, functional and technical requirements, open decisions and launch plan are in **[docs/website-blueprint.md](docs/website-blueprint.md)**. Read that first.

## What this repository contains

| Path | What it is |
| --- | --- |
| `docs/website-blueprint.md` | The website blueprint: gap assessment, sitemap, messaging, design, functional and technical spec, priorities, decisions needed |
| `src/` | Eleventy source: layouts, components, inline SVG charts, CSS design system, client script |
| `content/` | All copy and CMS-style collections as JSON, every text field in both languages |
| `site.config.json` | Firm-owned configuration (domain, email, calendar, HubSpot, GA4). Empty values hide the related element |
| `scripts/` | QA: link check, bilingual parity, axe accessibility, screenshots, Open Graph image generation |
| `lib/routes.js` | The single source of truth for URL structure and translated slugs |

## Commands

```bash
npm install
npm start               # dev server with live reload (production content only)
npm run build           # production build to _site/ (drafts excluded, placeholders forbidden)
npm run build:preview   # preview build: includes draft/illustrative content and example.com placeholders
npm run build:phase1    # interim one-page launch site (Home without Work/Insights sections)
npm test                # preview build + link check + bilingual parity check
npm run test:a11y       # axe-core pass on representative templates (needs Playwright)
npm run screenshots     # desktop and mobile screenshots of key templates into ./screenshots
npm run export:preview  # relative-URL export of the preview build for hosting under a sub-path
node scripts/og-images.mjs   # regenerate Open Graph images and favicons from the design tokens
```

The design tokens (paper #FAF8F4, sand #EEE7DA, gold #EAB200, dark gold #C09200, black) live at the top of `src/assets/css/main.css`.

## Content model

Each collection lives in `content/<collection>/*.json`. Every text field is an object `{ "en": "...", "id": "..." }`. An item is **published only when every required field is complete in both languages**; the build fails otherwise. Set `"draft": true` to keep an item out of production builds while it is prepared (preview builds include drafts and label them).

| Collection | Required fields (summary) | Limits enforced |
| --- | --- | --- |
| `services` | key, practice, slug, title, promise, who (3), get, duration, next, metaDescription; Presentation services also carry `icon` and `tileLine` | promise ≤ 180, metaDescription ≤ 155 |
| `people` | key, slug, name, role, practices, seniority, summary, trackRecord, engagements (3), languages, email | summary ≤ 120 |
| `cases` | key, slug, title, sector, situation, practices, year, situationText, decision, built, outcomeLine, outcome (figure + source note), artefacts, relatedServices, metaDescription | title ≤ 90; outcome needs a source note |
| `insights` | key, slug, type, title, date, authors, readingTime, summary, body, metaDescription | metaDescription ≤ 155 |

Page copy lives in `content/pages/*.json`; UI strings (navigation, buttons, form labels, errors) in `src/_data/ui.json`.

## Deployment

Any static host works. `netlify.toml`, `src/root/_headers` (security headers, caching) and `src/root/_redirects` (root language negotiation, legacy redirects) are included and are read as-is by Netlify and Cloudflare Pages. Set `domain` in `site.config.json` so canonical, hreflang and sitemap URLs are absolute.

Before launch, complete every value in `site.config.json`, replace the draft people/cases/insights with real, permissioned content, and run `npm run build && node scripts/check-links.mjs && node scripts/check-parity.mjs`.
