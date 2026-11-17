# Operations playbook

How the website works day to day: where enquiries land, how to change content, how a deploy happens, what to switch on, and how to recover. Written for the owner, not for a developer.

## 1. Where enquiries land

Every form on the site (contact, deck review, newsletter, credentials download, and the deck-diagnostic lead when enabled) posts to the host's form service. The provider is chosen in `site.config.json` under `forms.provider`:

| Provider | When to use | Where submissions appear | Set-up |
| --- | --- | --- | --- |
| `netlify` (current) | Hosting on Netlify | Netlify dashboard → Forms. Each form has its own inbox and CSV export | Nothing to configure. Turn on email notifications under Forms → Notifications. Spam is filtered by the honeypot and Netlify's Akismet |
| `formspree` | Hosting anywhere else (GitHub Pages, Cloudflare) | formspree.io inbox, emailed to you | Create a form per type at formspree.io and paste the IDs into `forms.formspree` |
| `hubspot` | A HubSpot CRM is in place | HubSpot contacts and form submissions | Fill the `hubspot` block (portal ID and the three form GUIDs) |

Every submission carries, besides the visitor's fields, the page it came from, the referrer, the UTM campaign values, the site language, and the service the visitor was reading (`topic`) when they came from a service page. The thank-you pages are `/en/contact/thank-you/` and `/id/kontak/terima-kasih/`; they are excluded from search engines.

File uploads on the deck-review form are accepted up to 10 MB (PDF, PowerPoint, Keynote) on the Netlify provider.

## 2. Lead triage with AI (optional)

`netlify/functions/submission-created.mjs` runs automatically on every submission once the site has these environment variables (Netlify → Site configuration → Environment variables):

- `ANTHROPIC_API_KEY`: classifies the enquiry (practice, likely service, urgency, fit, flags such as "listed company: run the conflict check") and drafts a first reply in the enquirer's language.
- `LEADS_WEBHOOK_URL`: a Slack or Microsoft Teams incoming-webhook URL; the brief is posted there.
- `RESEND_API_KEY`, `LEADS_EMAIL`, optionally `LEADS_FROM`: the brief is emailed through resend.com (free tier covers a firm's volume).

Without the key the function forwards the raw submission; without a webhook or email it does nothing, and Netlify's own notifications still work. The brief never includes attached files.

## 3. The instant deck diagnostic (optional)

A visitor pastes a deck's storyline (up to 4,000 characters) on the Contact page and receives three observations and the page to rebuild first, in the shape of the firm's human review. To switch it on:

1. Add `ANTHROPIC_API_KEY` in the host's environment variables.
2. Set `ai.deckDiagnostic` to `true` in `site.config.json` and deploy.

Guard rails: 5 runs per visitor per hour, 4,000-character cap, honeypot, nothing the visitor pastes is stored, and the model is told to comment only on what the text shows. Each run costs a few cents. The visitor's email (if given) and the one-line summary land in the `deckDiagnostic` form inbox so the human review can follow.

## 4. Analytics

- **Plausible (recommended, cookieless):** register the domain at plausible.io and put it in `analytics.plausibleDomain`. No consent banner is needed for it. Custom events are sent for every call-to-action click, form submission, finder use, credentials download and diagnostic run, so the Plausible dashboard shows which pages and campaigns produce enquiries.
- **Google Analytics 4:** put the measurement ID in `ga4MeasurementId`. It loads only after the visitor accepts analytics in the consent banner. The same events are sent.
- **Campaign links:** add `?utm_source=linkedin&utm_campaign=…` to links you share; the values are stored for the session and attached to any form the visitor submits.

## 5. Changing content

All copy lives in JSON under `content/`: pages in `content/pages/*.json`, services in `content/services/*.json`, shared labels in `src/_data/ui.json`. Each text has `en` and `id` keys; fields ending in `M` are the shorter phone versions and are optional. The FAQ sets live in `content/pages/faq.json`; the service finder's questions and tags in `content/pages/finder.json`.

Edit on GitHub (the pencil icon on a file, then "Commit changes" to `main`) or ask Claude. Every push to `main` runs the checks in GitHub Actions (build, links, bilingual parity, HTML validity) and, when the host has build credits, deploys.

The credentials PDFs (`src/root/downloads/`) are generated from the same content with `node scripts/credentials-pdf.mjs` on a machine with Playwright; regenerate them after a content change and commit the two files.

## 6. Deploys, credits and rollback

- Netlify builds every push to `main`. The build stamp is at `/version.txt` on the live site; compare it with the latest commit on GitHub to confirm a deploy landed.
- Netlify's free plan has monthly credits; when they run out, deploys are skipped until the cycle resets or credits are added (Team settings → Billing). After that, open the newest skipped deploy and press "Retry deploy".
- GitHub Actions keeps the built site of every push as an artifact for seven days (Actions → the run → "site"), so a build can be inspected or uploaded by hand if ever needed.
- Rollback: Netlify → Deploys → pick an earlier Published deploy → "Publish deploy". Or in git: `git revert <commit>` and push.

## 7. Moving host (if ever needed)

The site is static; GitHub Pages or Cloudflare Pages host it for free. Change `forms.provider` to `formspree`, point the domain's DNS records to the new host, and keep the `_redirects` language negotiation if the host supports it (Cloudflare Pages does). The AI functions are Netlify-specific; on Cloudflare they would move to Pages Functions.

## 8. Quarterly checklist

- Regenerate and commit the credentials PDFs if services or process changed.
- Review the FAQ answers against any change in fees, timings or process.
- Export the form inboxes to CSV and archive them.
- Check Search Console for crawl errors and the sitemap status.
- Review the Netlify credit usage; batch content changes into fewer deploys if it runs tight.

## 9. Magic Layers and Deck Auditor (local tools for deck work)

`tools/magic-layers/` holds a desktop tool that turns flattened slides, PDFs and picture decks into editable layers and exports an editable PowerPoint. It runs on your own computer and is not part of the website: start it with `start.bat` (Windows), `start.command` (macOS) or `./start.sh` (Linux). Instructions, limits and the optional AI assist are in `tools/magic-layers/README.md`. Changes to it do not trigger a website build.

The same app has a second tab, **Deck Auditor**: open a finished deck before it goes to a client and it lists figures that disagree, totals that do not add up, titles that are labels, draft markers, stray fonts and stretched pictures, and it compares the deck with its previous version to produce a change log. Make it the last step before every delivery; the report it saves can go in the engagement file.
