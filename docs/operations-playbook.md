# Operations playbook

How the website works day to day: where enquiries land, how to change content, how a deploy happens, what to switch on, and how to recover. Written for the owner, not for a developer.

## 1. Where enquiries land

Every form on the site (contact, deck review, newsletter, credentials download, and the deck-diagnostic lead when enabled) posts to the host's form service. The provider is chosen in `site.config.json` under `forms.provider`:

| Provider | When to use | Where submissions appear | Set-up |
| --- | --- | --- | --- |
| `netlify` (current) | Hosting on Netlify | Netlify dashboard → Forms. Each form has its own inbox and CSV export | Nothing to configure. Turn on email notifications under Forms → Notifications. Spam is filtered by the honeypot and Netlify's Akismet |
| `web3forms` | Hosting on Cloudflare Pages (chosen automatically there) | Emailed to the address the access key was created with | Create an access key at web3forms.com; set it as `WEB3FORMS_KEY` in the host's environment variables or in `forms.web3forms.accessKey` |
| `formspree` | Hosting anywhere else | formspree.io inbox, emailed to you | Create a form per type at formspree.io and paste the IDs into `forms.formspree` |
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

## 7. Hosting on Cloudflare Pages (free) with Web3Forms

The site builds unchanged on Cloudflare Pages. A build there is detected automatically (Cloudflare sets `CF_PAGES`): forms switch from Netlify Forms to Web3Forms, and the two redirect rules written in Netlify-only syntax are dropped, so the root page redirects by browser language instead. Netlify keeps working from the same repository, which allows a move with no downtime.

1. **Web3Forms.** At web3forms.com, create an access key with the email address where enquiries should arrive. The key is public by design; it only names the inbox.
2. **Cloudflare.** Create a free account. Workers & Pages → Create → Pages → Connect to Git → choose `labsmetanoia/Metanoia-Advisory`. Build command `npm run build`, build output directory `_site`. Under Environment variables add `WEB3FORMS_KEY` with the access key. Save and deploy. Node 22 is taken from the `.node-version` file.
3. **Check** the `…pages.dev` address: pages, both languages, the root redirect, and one test enquiry from the contact form (it should arrive by email).
4. **Domain.** In the Pages project, Custom domains → add `www.metanoiaadvisors.com`. Where the domain's DNS is managed, point the `www` CNAME record at the `…pages.dev` address. For the bare domain, either move the nameservers to Cloudflare (free; required to serve the bare domain from Pages) or set a forward to `www` at the registrar.
5. **Netlify.** Once the domain serves from Cloudflare, stop builds on the Netlify project (Project configuration → Build & deploy → Stop builds) and leave it as a fallback for a month.

What differs from Netlify: the deck-review form takes a link instead of a file (Web3Forms' free plan has no uploads); all four forms arrive in one inbox, with the form's name in the subject; without JavaScript a visitor lands on Web3Forms' own confirmation page; the optional AI functions in `netlify/functions` do not run (they are switched off). To skip builds for pushes that only touch `tools/` or `docs/`, set Build watch paths in the Pages project's build settings. Without a key the forms are replaced by the email link and the build prints a warning.

## 8. Quarterly checklist

- Regenerate and commit the credentials PDFs if services or process changed.
- Review the FAQ answers against any change in fees, timings or process.
- Export the form inboxes to CSV and archive them.
- Check Search Console for crawl errors and the sitemap status.
- Review the Netlify credit usage; batch content changes into fewer deploys if it runs tight.

## 9. Magic Layers, Deck Auditor and Chart Builder (local tools for deck work)

`tools/magic-layers/` holds a desktop tool that turns flattened slides, PDFs and picture decks into editable layers and exports an editable PowerPoint. It runs on your own computer and is not part of the website: start it with `start.bat` (Windows), `start.command` (macOS) or `./start.sh` (Linux). Instructions, limits and the optional AI assist are in `tools/magic-layers/README.md`. Changes to it do not trigger a website build.

The same app has a second tab, **Deck Auditor**: open a finished deck before it goes to a client and it lists figures that disagree, totals that do not add up, titles that are labels, draft markers, stray fonts and stretched pictures, and it compares the deck with its previous version to produce a change log. Make it the last step before every delivery; the report it saves can go in the engagement file.

The third tab, **Chart Builder**, makes the charts: paste a range from Excel, choose the chart type, write the action title and source line, and export a slide with a native PowerPoint chart in the house style. It warns when the figure in the title is not in the data.

Before a deck with numbers goes out, open the Deck Auditor's **Sources** tab and load the client's Excel model (or the report the deck must agree with). Figures that differ from the source are listed with the cell they should match.

The Auditor's **Fix…** button repairs the mechanical findings (stray fonts, title size and position, stretched pictures, empty placeholders) and saves a corrected copy next to the original, which is left unchanged. Check the corrected slides in PowerPoint before sending.

### Delivering a Deck Audit

The offer page is at `/en/strategic-storytelling/deck-audit/` (Indonesian: `/id/storytelling-strategis/audit-dek/`). Requests arrive like any other form, with the subject ending in `deckAudit`.

1. Reply with the fee and a start date. To publish the fee on the page, fill `offers.deckAudit.price` in `site.config.json` (both languages); leave it empty to quote case by case.
2. Open the deck in the Deck Auditor. If the client sent a model or source document, add it under **Sources**.
3. Go through every finding. Set aside the ones that are not issues. Open a finding and write a note where your judgement adds something.
4. **Report → Client report…**: the report language (English or Bahasa Indonesia), who it is for, your overall view, the page you would rebuild first and why. Write your notes in the same language. Save, open the file, print to PDF (A4).
5. Send the PDF and hold the readout. Keep the tool's AI assist off for client files, because the page tells clients their deck is not uploaded to an outside AI service.

The sample reports on the site (`src/root/downloads/deck-audit-sample-en.pdf` and `-id.pdf`) come from the tool's own sample deck. To refresh it after the report design changes, open the sample deck, add the sample model as the source, write the notes, and save the client report with the client named as an invented company.

### The free deck check (lead tool)

Address: `/en/strategic-storytelling/deck-check/` (Indonesian: `/id/storytelling-strategis/cek-dek/`). A visitor drops a deck and sees the counts and the first three findings; the deck never leaves their browser. It uses the same rules as the Deck Auditor, so a rule fixed in the tool is fixed on the site at the next deploy.

It is published as a preview: the address works, but nothing links to it and search engines are told not to index it. Before making it public, drop five or more real decks on it and read the three findings each time. If they are right, set `tools.deckCheck` to `"live"` in `site.config.json`; the Deck Audit page and the footer then link to it. Set it to `"off"` to remove the page.

If a finding is wrong on a real deck, note the slide and the wording and pass it on: the fix goes into `tools/magic-layers/app/js/audit/` and reaches both the tool and the site.

### Writing a proposal

Open the tool suite and choose **Proposals**. Pick the offer, the language (bilingual for Indonesian clients), fill in the client, the subject and the fee, and read the list above the preview until only warnings you accept remain. **Print / PDF** for the client; **Word** when counsel or the client wants to mark it up. Each proposal keeps its reference (MA/P/year/month/number) and can be reopened from **Recent proposals** on the same computer.

Before the first one goes out, have counsel review the standard terms: save any proposal as Word and send it with the questions listed in the tool's README (Proposals → Before the first proposal goes out). Put the final wording into `tools/magic-layers/app/js/proposals/terms.js` in both languages and tick **The standard terms have been reviewed by our counsel** in Settings; until then every document is marked as a draft.

