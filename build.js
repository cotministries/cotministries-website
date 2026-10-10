// Dependency-free build: content/*.json -> dist/   (run: node build.js, or DEMO=1 node build.js). Hosted on Cloudflare Pages: build command `node build.js`, output `dist`
const fs = require('fs'), path = require('path');
// New file names for site.js / styles.css on every publish, so browsers never mix a new page with an old script.
const V = (process.env.CF_PAGES_COMMIT_SHA || Date.now().toString(36)).slice(0, 10);
const withV = (html) => html.replace('href="/styles.css"', `href="/styles.css?v=${V}"`).replace('src="/site.js"', `src="/site.js?v=${V}"`);
const R = require('./lib/render.js');
const cmsConfig = require('./lib/cms-config.js');
const root = __dirname, out = path.join(root, 'dist');
const demo = process.env.DEMO === '1';
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const readOpt = (p, d) => { try { return read(p); } catch (e) { return d; } };
const copyDir = (src, dst) => { fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) { const s = path.join(src, f), d = path.join(dst, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } };

fs.rmSync(out, { recursive: true, force: true });
copyDir(path.join(root, 'static'), out);
copyDir(path.join(root, 'admin'), path.join(out, 'admin'));
fs.copyFileSync(path.join(root, 'lib/render.js'), path.join(out, 'admin/render.js'));
// editor page: load its scripts and the preview styles fresh after every publish
{ const ai = path.join(out, 'admin/cms.html'); fs.writeFileSync(ai, fs.readFileSync(ai, 'utf8').replace(/src="\/admin\/(repo-files|site-settings|render)\.js"/g, (m, n) => `src="/admin/${n}.js?v=${V}"`).replace("registerPreviewStyle('/styles.css')", `registerPreviewStyle('/styles.css?v=${V}')`)); }

const site = read('content/settings.json');
const data = {
  books: readOpt('content/data/books.json', { items: [] }).items || [],
  events: readOpt('content/data/events.json', { items: [] }).items || [],
  services: readOpt('content/data/services.json', { categories: [], items: [] }),
  testimonies: readOpt('content/data/testimonies.json', { items: [] }).items || [],
  packages: readOpt('content/data/packages.json', { items: [] }).items || [],
};
const baseUrl = (process.env.SITE_URL || 'https://cotministries.com').replace(/\/$/, '');
const files = fs.readdirSync(path.join(root, 'content/pages')).filter((f) => f.endsWith('.json'));
const repoPages = {}, urls = [];
const writePage = (page) => {
  const dir = page.slug === 'index' ? out : path.join(out, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, page.slug === '404' ? '../404.html' : 'index.html'), withV(R.renderPage(page, site, data)));
};
for (const f of files) {
  const page = read('content/pages/' + f);
  if (page.hidden) continue;
  page.slug = page.slug || f.replace(/\.json$/, '');
  writePage(page);
  repoPages[f] = { content: JSON.stringify(page, null, 2) };
  urls.push(page.slug === 'index' ? '/' : `/${page.slug}/`);
  console.log('built page', page.slug);
}
const simple = (slug, title, heading, body, buttons) => ({ title, slug, sections: [{ type: 'text', heading, body, align: 'center', buttons }] });
writePage(simple('thanks', 'Thank you', site.thanksHeading || 'Thank you!', site.thanksMessage || "Your message was sent. You'll hear back soon.", [{ label: 'Back to home', url: '/' }]));
writePage(simple('order-thanks', 'Order complete', site.orderThanksHeading || 'Thank you for your order!', site.orderThanksMessage || 'A receipt is on its way to your email.', [{ label: 'Back to home', url: '/' }, { label: 'Keep shopping', url: '/books/' }]));
writePage(simple('give-thanks', 'Thank you for your gift', site.giveThanksHeading || 'Thank you for your gift!', site.giveThanksMessage || 'Your generosity helps carry this ministry forward. A receipt for your gift is on its way to your email. May God bless you abundantly.', [{ label: 'Back to home', url: '/' }, { label: 'Back to Ministry', url: '/ministry/' }]));
fs.mkdirSync(path.join(out, '404'), { recursive: true });
fs.writeFileSync(path.join(out, '404.html'), withV(R.renderPage(simple('404', 'Page not found', 'Page not found', "Sorry, that page doesn't exist.", [{ label: 'Go to home page', url: '/' }]), site, data)));
fs.rmSync(path.join(out, '404'), { recursive: true, force: true });

// admin pages: load the shared block editor fresh after every publish
for (const f of ['index.html', 'blog.html', 'newsletter.html', 'messages.html', 'schedule.html', 'sign.html']) { const ap = path.join(out, 'admin', f); if (fs.existsSync(ap)) fs.writeFileSync(ap, fs.readFileSync(ap, 'utf8').replace(/(src|href)="\/admin\/(blocks|studio|brand|emoji|site-settings|render|qr)\.(js|css)"/g, (m, a, n, x) => `${a}="/admin/${n}.${x}?v=${V}"`)); }
// Blog: a page shell in the site's look; functions/blog/[[path]].js puts each list/post into it (see server/blog-pages.js)
fs.writeFileSync(path.join(out, 'blog-shell.html'), withV(R.renderPage({ title: '%%TITLE%%', slug: 'blog', description: '%%DESC%%', image: '%%IMG%%', sections: [{ type: 'blogSlot' }] }, site, data)));
urls.push('/blog/');
// Cloudflare Pages: what is live (used by the "Put website live" button) + which paths run Functions
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ sha: process.env.CF_PAGES_COMMIT_SHA || '', branch: process.env.CF_PAGES_BRANCH || '', at: new Date().toISOString() }));
fs.writeFileSync(path.join(out, '_routes.json'), JSON.stringify({ version: 1, include: ['/', '/home', '/home/', '/admin', '/admin/*', '/api/*', '/blog', '/blog/*'], exclude: [] }));

// SEO
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${baseUrl}${u}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nDisallow: /admin/\nSitemap: ${baseUrl}/sitemap.xml\nSitemap: ${baseUrl}/blog/sitemap.xml\n`);
// Editor config + data for the live preview (YAML accepts JSON)
fs.writeFileSync(path.join(out, 'admin/config.yml'), JSON.stringify(cmsConfig({ demo, services: (data.services.items || []).map((x) => x.name).filter(Boolean) }), null, 1));
fs.writeFileSync(path.join(out, 'admin/site-settings.js'), 'window.siteSettings=' + JSON.stringify(site) + ';window.siteData=' + JSON.stringify(data) + ';');
fs.writeFileSync(path.join(out, 'admin/repo-files.js'), demo
  ? 'window.repoFiles=' + JSON.stringify({ content: { 'settings.json': { content: JSON.stringify(site, null, 2) }, pages: repoPages,
      data: Object.fromEntries(['books', 'events', 'services', 'testimonies', 'packages'].filter((k) => fs.existsSync(path.join(root, 'content/data', k + '.json'))).map((k) => [k + '.json', { content: fs.readFileSync(path.join(root, 'content/data', k + '.json'), 'utf8') }])) } }) + ';'
  : '');
console.log(demo ? 'DEMO build (editor changes are not saved)' : 'Production build (editor login: GitHub)');
