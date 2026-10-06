# Website Template (Netlify + editor)

A fast, free website with an editor at **/admin** — like Squarespace, without the monthly fee.

## How it works
- `content/settings.json` – site name, logo, colors, fonts, menu, contact info
- `content/pages/*.json` – one file per page; each page is a list of **sections (blocks)**
- `lib/render.js` – turns blocks into HTML (also powers the editor's live preview)
- `lib/cms-config.js` – the editor's forms (one entry per block)
- `static/` – CSS and uploaded images/files (`static/uploads`)
- `build.js` – `node build.js` builds the site into `dist/` (no npm packages needed)

Netlify runs `node build.js` automatically every time content changes.

## Blocks available
Banner/Hero · Text · Image + Text · Cards · Services & Prices · Checklist · Quote/Scripture ·
Testimonials · FAQ · Gallery · Single image · Video · Downloads · Embed (forms/maps) ·
Call-to-action band · Contact info + form

## Start a new client site (≈30 min)
1. On GitHub: open this repository → **Use this template** (or upload a copy) → name it e.g. `firebynik-website`.
2. In the new repo, edit `content/settings.json` (name, colors, fonts, contact) and replace the pages in `content/pages/` (keep `index.json` as the home page).
3. Netlify → **Add new project → Import an existing project → GitHub** → pick the repo. Build command `node build.js`, publish directory `dist` (already set in `netlify.toml`).
4. Netlify → Project configuration → **Identity → Enable**, set registration to **Invite only**, then **Services → Git Gateway → Enable**.
5. Identity → **Invite users** → client's email. They set a password and edit at `theirsite.com/admin`.
6. Optional: Domain management → add the client's domain.

## Demo mode
`DEMO=1 node build.js` builds a version whose editor needs no login and doesn't save (for showing clients).
