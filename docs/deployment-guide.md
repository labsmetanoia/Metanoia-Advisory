# Deployment guide — Metanoia Advisory website

This guide takes the site from the GitHub repository to a live, HTTPS-secured website on the firm's own domain. It assumes no prior hosting experience. Expect about two hours of hands-on work plus DNS propagation time (minutes to a day).

The site is a **static website**: the build turns the content files into plain HTML, CSS, images and a little JavaScript. There is no server, database or admin panel to run, which keeps hosting free or close to it, fast, and secure by default.

---

## 0. What is already in place

| Item | Where | What it does |
| --- | --- | --- |
| Build command | `npm run build` (in `package.json`) | Produces the production site in the `_site` folder; placeholders are never used in production |
| Host settings | `netlify.toml` | Tells the host to run the build on Node 22 and publish `_site` |
| Security headers and caching | `src/root/_headers` | HSTS, content-security policy, no-sniff, frame denial, one-year caching of assets |
| Redirects | `src/root/_redirects` | Sends `/` to `/id/` for Indonesian browsers and `/en/` for everyone else; permanently redirects the retired `/presentation`, `/presentasi`, `/work` and `/karya` paths |
| Quality checks | `npm test`, `npm run test:a11y` | Broken links, bilingual parity, placeholder leakage, accessibility |
| Firm configuration | `site.config.json` | Domain, email, LinkedIn, calendar link, credentials PDF, HubSpot forms, GA4, LinkedIn Insight |
| Privacy and cookie consent | built in | Consent banner gates analytics; privacy, terms and conflicts pages exist in both languages |

The repository currently has a single branch, `claude/nice-ramanujan-pyeyii`, which holds the finished site. Step 2 renames it to `main`.

---

## 1. Before you deploy: fill the firm configuration

Open `site.config.json` and fill every value you have. Empty values do not break the build; they hide the element that depends on them, so a half-filled file launches a site with missing buttons.

| Key | What to enter | What it switches on |
| --- | --- | --- |
| `legalName` | The registered entity name, e.g. `PT Metanoia Advisory Indonesia` | The © line in the footer and the privacy notice |
| `domain` | The final address with scheme and no trailing slash, e.g. `https://www.metanoiaadvisory.com` | Canonical tags, hreflang links, sitemap, Open Graph URLs. **Required**; search engines index duplicates without it |
| `email` | The firm's real address, e.g. `hello@metanoiaadvisory.com` | Contact page email links |
| `linkedin` | The company page URL | LinkedIn link in the footer |
| `calendarUrl` | A booking link (Calendly, HubSpot Meetings, Google appointment page) | "Book a working session" buttons |
| `credentialsPdf` | `/assets/downloads/metanoia-credentials.pdf` once you have placed the real PDF at `src/assets/downloads/metanoia-credentials.pdf` | Credentials download links on About and in the footer |
| `hubspot.portalId` and the three form GUIDs | From HubSpot → Marketing → Forms → each form's embed code | The contact, deck-review and newsletter forms. **Without these, the forms are hidden** and the contact page shows only the email and calendar links |
| `ga4MeasurementId` | `G-XXXXXXXXXX` from Google Analytics 4 | Analytics, loaded only after the visitor consents |
| `linkedinPartnerId` | From LinkedIn Campaign Manager → Insight Tag | LinkedIn Insight, consent-gated |
| `addressJakarta` | Keep or change | Shown on the contact page and in the privacy notice |

Decide the form path now. HubSpot's free tier covers the three forms. If you would rather not use HubSpot at launch, leave the GUIDs empty; visitors will still reach you through the email and calendar links, and the forms can be enabled later with no code change.

Then run the checks locally (Node 20 or newer):

```bash
npm install
npm test            # builds preview and production, checks links, parity and placeholders
npm run test:a11y   # accessibility pass
```

Commit the configuration and the PDF:

```bash
git add site.config.json src/assets/downloads/metanoia-credentials.pdf
git commit -m "Configure firm details for launch"
git push
```

`site.config.json` is public in the built site. Never put passwords or private API keys in it. The HubSpot portal ID and form GUIDs, the GA4 ID and the LinkedIn partner ID are designed to be public.

---

## 2. Tidy the repository

1. On GitHub, open the repository → Settings → Branches (or run the commands below) and rename the working branch to `main`:
   ```bash
   git branch -m claude/nice-ramanujan-pyeyii main
   git push -u origin main
   ```
   Then set `main` as the default branch under Settings → General → Default branch, and delete the old remote branch.
2. Keep the repository **private**. The host reads it through its own GitHub integration; the public never needs the source.
3. Optional but recommended: Settings → Branches → add a protection rule on `main` that requires a pull request. Hosts build every pull request as a preview, so you can review changes before they go live.

---

## 3. Choose a host

Three services host static sites on a free or near-free plan, build directly from GitHub, provide HTTPS automatically and have edge locations in or near Indonesia.

| | Netlify (recommended) | Cloudflare Pages | Vercel |
| --- | --- | --- | --- |
| Reads `_headers` and `_redirects` as shipped | Yes, including the language-based root redirect | Yes, except the `Language=` condition; the root would always go to `/en/` unless a small Pages Function is added | No; both files would need converting to `vercel.json` |
| Deploy previews for pull requests | Yes | Yes | Yes |
| HTTPS | Automatic (Let's Encrypt), renews itself | Automatic | Automatic |
| Free plan limits | 100 GB bandwidth/month, 300 build minutes/month | Unlimited bandwidth, 500 builds/month | 100 GB bandwidth/month |
| Edge presence for Indonesian visitors | Singapore and global CDN | Jakarta and Singapore | Singapore |

This site builds in under five seconds and weighs a few megabytes, so any plan is sufficient. **Netlify** is recommended because every file in the repository works as shipped. Cloudflare Pages is the alternative if you already keep DNS at Cloudflare; the only loss is the automatic Indonesian-language root redirect, which can be restored with a five-line Pages Function on request.

The rest of this guide follows Netlify. Cloudflare Pages differs only in the DNS records in step 5.

---

## 4. Connect the repository and deploy

1. Sign up at netlify.com with the firm's email (use a shared or role address, not a personal one, so access does not depend on one person).
2. **Add new site → Import an existing project → GitHub.** Authorise Netlify for the repository only.
3. Netlify reads `netlify.toml`, so the settings are pre-filled. Confirm:
   - Branch to deploy: `main`
   - Build command: `npm run build`
   - Publish directory: `_site`
4. Click **Deploy**. The first build takes about a minute. You get a temporary address such as `https://random-name-123.netlify.app`.
5. Open it and check the home page in both languages, the contact page (forms visible if HubSpot is configured), the footer links and the credentials download. Confirm `/en/presentation/` redirects to `/en/strategic-storytelling/`.
6. Under **Site configuration → Site details**, rename the site to something recognisable, e.g. `metanoia-advisory`.

Every later push to `main` redeploys automatically. Every pull request gets its own preview URL, posted on the pull request by Netlify.

---

## 5. Connect your domain

Decide the **primary** address first. The recommendation is `www.metanoiaadvisory.com` as primary with the bare domain `metanoiaadvisory.com` redirecting to it. The `www` form works with every DNS provider and CDN; the bare domain cannot carry a CNAME record at most registrars. Whichever you choose, put exactly that in `domain` in `site.config.json`.

### 5a. Add the domain in Netlify

1. **Domain management → Add a domain.** Enter the bare domain `metanoiaadvisory.com`. Netlify adds both the bare domain and `www`.
2. Set `www.metanoiaadvisory.com` as the **primary domain**. Netlify then redirects the bare domain to it automatically.

### 5b. Point the domain at Netlify

You have two options at your registrar (the company you bought the domain from: for example Niagahoster, Rumahweb, Namecheap, GoDaddy, Cloudflare).

**Option A — keep DNS at the registrar, add two records (simplest if the domain also carries email).**

| Type | Host / Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` (the bare domain) | `75.2.60.5` | 3600 |
| CNAME | `www` | `metanoia-advisory.netlify.app` (your Netlify site name) | 3600 |

Netlify shows these exact values under Domain management → the domain → "Check DNS configuration". Use the values on that screen if they differ from the above.

Remove any existing A or CNAME records for `@` and `www` that point to a parking page or an old host. **Do not touch MX, TXT, SPF, DKIM or DMARC records**; those carry the firm's email.

**Option B — move DNS to Netlify (Netlify DNS).**

Netlify gives you four nameservers (e.g. `dns1.p01.nsone.net`). Enter them at the registrar under "Nameservers" or "Custom DNS". Before you do this, copy every existing record (especially MX and TXT for email) into Netlify DNS first, or email stops. Option B gives slightly faster edge routing and lets Netlify manage everything, but Option A is safer when email is already configured at the registrar.

### 5c. Wait for propagation

DNS changes take from a few minutes to 24 hours to be visible everywhere. Check with `https://dnschecker.org` by entering `www.metanoiaadvisory.com` and selecting CNAME. When most locations show the Netlify value, continue.

---

## 6. Enable HTTPS

1. In Netlify, **Domain management → HTTPS**. Once DNS resolves, Netlify issues a Let's Encrypt certificate automatically, usually within minutes. If it shows "Waiting on DNS verification", wait and refresh; if it stalls for more than an hour, click **Verify DNS configuration**, then **Provision certificate**.
2. Turn on **Force HTTPS**. Every `http://` request is then redirected to `https://`.
3. The site already sends a `Strict-Transport-Security` header with `preload`. Once you are sure HTTPS works on both the bare and `www` domains, you may submit the domain at `https://hstspreload.org` so browsers never attempt a plain connection. This is optional and hard to undo; skip it if unsure.
4. Certificates renew automatically. Nothing to do yearly.

---

## 7. Launch checks

Run through these on the live domain, on a laptop and a phone.

- [ ] `https://metanoiaadvisory.com` redirects to `https://www.metanoiaadvisory.com/` and then to `/en/` (or `/id/` on an Indonesian-language browser).
- [ ] Padlock shows in the browser; `https://www.ssllabs.com/ssltest/` grades the site A or A+.
- [ ] Both languages load; the flag selector switches between them on the same page.
- [ ] Header dropdowns open on hover and on keyboard focus; the phone menu opens and the practice accordions expand.
- [ ] Contact page: submit a test enquiry on each form and confirm it arrives in HubSpot and triggers the notification email; or, if forms are off, confirm the email and calendar links work.
- [ ] Cookie banner appears on first visit; after accepting, GA4's real-time report shows your visit; after declining, it does not.
- [ ] Credentials PDF downloads.
- [ ] Old addresses redirect: `/en/presentation/board-and-executive-decks/`, `/id/presentasi/`, `/en/work/`.
- [ ] `https://www.metanoiaadvisory.com/sitemap.xml` lists absolute URLs on your domain (this confirms `domain` was set).
- [ ] Headers present: open `https://securityheaders.com`, enter the domain, expect an A grade.
- [ ] Performance: run `https://pagespeed.web.dev` on the home page; expect 90+ on desktop and 80+ on mobile. The hero photographs are the main weight.

---

## 8. After launch

**Search engines.**
1. Google Search Console → Add property → Domain → verify by adding the TXT record Google gives you at the registrar (same place as the records in step 5b).
2. Submit `https://www.metanoiaadvisory.com/sitemap.xml`.
3. Repeat at Bing Webmaster Tools (it can import the Google verification).
4. Expect indexing over one to three weeks. The site's hreflang tags tell Google which page serves which language.

**Google Business Profile.** Claim the firm's profile and link it to the site; this drives local search in Jakarta.

**Email and the domain.** If the firm's email is not yet on the domain, set it up at Google Workspace or Microsoft 365 before announcing the site; the records (MX, SPF, DKIM, DMARC) go in the same DNS panel as step 5b and do not interfere with the website records.

**Monitoring.** Netlify emails you on failed builds. For uptime alerts, a free monitor such as UptimeRobot checking `https://www.metanoiaadvisory.com/en/` every five minutes is enough.

**Making changes.** Edit the content JSON files or the templates, open a pull request, review the Netlify preview link, merge. Netlify keeps every past deploy; **Deploys → pick a previous one → Publish deploy** rolls the site back in seconds if something goes wrong.

**Keeping the site healthy.** Run `npm test` and `npm run test:a11y` before merging content changes; update dependencies a couple of times a year (`npm outdated`, then `npm update`).

---

## 9. Considerations specific to Indonesia

These are flagged for the firm to confirm with counsel; the site is built to support them but does not decide them.

- **PSE registration (Kominfo/Komdigi).** Private electronic system operators that collect personal data in Indonesia may need to register as a PSE Lingkup Privat. A corporate site with enquiry forms can fall within scope. Confirm whether Metanoia Advisory must register and, if so, add the registration number to the footer or privacy notice.
- **Personal data (UU PDP 27/2022).** The privacy notice, consent banner and the HubSpot data-processing terms cover the usual obligations. Confirm the notice names the correct legal entity (`legalName`) and the contact for data requests (`email`).
- **Hosting location.** Netlify and Cloudflare serve the site from edge locations worldwide, including Singapore and (Cloudflare) Jakarta. The site stores no visitor data itself; form submissions live in HubSpot, analytics in Google. For a corporate marketing site this is standard; confirm with counsel if any client-data flows are added later.
- **Local payment for the domain and services.** Netlify and HubSpot bill in USD by card; GA4 and Search Console are free. Keep renewals on a shared firm card and calendar, not a personal one.

---

## 10. Quick reference

| Need | Where |
| --- | --- |
| Change text or copy | `content/pages/*.json`, `content/services/*.json`, `src/_data/ui.json` |
| Change firm details, integrations | `site.config.json` |
| Add a redirect | `src/root/_redirects` |
| Add an insight note | `content/insights/*.json` (set `draft: false` to publish) |
| Replace a photograph | `src/assets/img/photos/`, originals in `assets-src/photos/` |
| Roll back a bad deploy | Netlify → Deploys → earlier deploy → Publish deploy |
| Build fails | Netlify → Deploys → failed deploy → log; most failures are a content file exceeding a character limit or a missing bilingual field, and the log names the file |
