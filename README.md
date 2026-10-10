# City Of Testimonies website (cotministries.com)

Static site + Studio editor at **/admin**, hosted on **Cloudflare Pages** (build command `node build.js`, output folder `dist`).
Built on the same engine as Niki's site (firebynik / sowedintears), in the City Of Testimonies navy and gold.

## Where things live
- `content/settings.json` – name, logo, colors, fonts, menu, footer, contact, social links, chat bubble
- `content/pages/*.json` – one file per page, each a list of sections
- `content/data/` – **events**, **testimonies**, **books** (= shop items) (Studio: "Events & shop")
- `lib/render.js` – sections → HTML (also the Studio preview) · `lib/cms-config.js` – Studio fields
- `static/site.js` – chat bubble, back-to-top arrow, testimony slider, cart, giving, forms · `static/styles.css` (COT look is at the end)
- `functions/` – Cloudflare Pages Functions (forms, Messages inbox, replies, Stripe checkout, blog, newsletter, visitors, Studio login and saving)
- `server/` – shared code for the functions

## Sections made for this site
Home banner (`cotHero`), three icon boxes (`features`), text + framed picture (`mandate`), photo cards (`carry`),
scripture band (`verse`), testimony slider (`testiSlider`), picture + promo (`promo`), event cards (`gatherings`),
blue world-map band (`sow`), page title band (`pageHead`), questions (`faq`), check list (`checklist`), centered buttons (`buttonRow`).
Niki's sections still work too: prayer request + invitation forms (`ministryForms`), giving (`give`), events with RSVP (`events`),
shop (`bookShop`), newsletter, contact, blog.

## Publishing
- **Save** in /admin only saves to GitHub. **🚀 Put website live** publishes everything saved.
- A commit whose message contains `[live]` also publishes (GitHub Action `.github/workflows/publish-live.yml`).

## Cloudflare settings (Pages project → Settings)
Same as Niki's site. **Bindings:** D1 database, variable name `DB`.
**Variables and secrets:** `ACCESS_TEAM`, `ACCESS_AUD` (email-code login for /admin), `GITHUB_TOKEN` (repo Contents read/write),
`GITHUB_REPO` = `cotministries/cotministries-website`, `DEPLOY_HOOK_URL` (also as a GitHub Actions secret), `RESEND_API_KEY` + `REPLY_FROM`
(form emails), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (giving and shop; webhook URL `https://cotministries.com/api/stripe-webhook`).
Fill in the email addresses in Studio → Settings → "Brands & email" and "Contact details".
