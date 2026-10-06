// Dependency-free build: content/*.json -> dist/  (run: node build.js, or DEMO=1 node build.js)
const fs = require('fs'), path = require('path');
const R = require('./lib/render.js');
const cmsConfig = require('./lib/cms-config.js');
const root = __dirname, out = path.join(root, 'dist');
const demo = process.env.DEMO === '1';
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const copyDir = (src, dst) => { fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) { const s = path.join(src, f), d = path.join(dst, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } };

fs.rmSync(out, { recursive: true, force: true });
copyDir(path.join(root, 'static'), out);
copyDir(path.join(root, 'admin'), path.join(out, 'admin'));
fs.copyFileSync(path.join(root, 'lib/render.js'), path.join(out, 'admin/render.js'));

const site = read('content/settings.json');
const baseUrl = (process.env.URL || '').replace(/\/$/, '');
const files = fs.readdirSync(path.join(root, 'content/pages')).filter((f) => f.endsWith('.json'));
const repoPages = {}, urls = [];
for (const f of files) {
  const page = read('content/pages/' + f);
  const slug = page.slug || f.replace(/\.json$/, '');
  const dir = slug === 'index' ? out : path.join(out, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), R.renderPage(Object.assign({}, page, { slug }), site));
  repoPages[f] = { content: JSON.stringify(page, null, 2) };
  urls.push(slug === 'index' ? '/' : `/${slug}/`);
  console.log('built page', slug);
}
// 404 page
fs.writeFileSync(path.join(out, '404.html'), R.renderPage({ title: 'Page not found', slug: '404', sections: [{ type: 'text', heading: 'Page not found', body: "Sorry, that page doesn't exist.", align: 'center', buttons: [{ label: 'Go to home page', url: '/' }] }] }, site));
// Hidden form so Netlify stores reply history (used by the inbox's Send reply)
fs.writeFileSync(path.join(out, 'netlify-forms.html'), '<!doctype html><html><head><meta name="robots" content="noindex"></head><body><form name="reply-log" data-netlify="true" hidden><input name="message_id"><input name="to"><input name="by"><textarea name="reply"></textarea></form></body></html>');
// SEO
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${baseUrl}${u}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nDisallow: /admin/\nSitemap: ${baseUrl}/sitemap.xml\n`);
// Editor config + data for the live preview (YAML accepts JSON)
fs.writeFileSync(path.join(out, 'admin/config.yml'), JSON.stringify(cmsConfig({ demo }), null, 1));
fs.writeFileSync(path.join(out, 'admin/site-settings.js'), 'window.siteSettings=' + JSON.stringify(site) + ';');
fs.writeFileSync(path.join(out, 'admin/repo-files.js'), demo
  ? 'window.repoFiles=' + JSON.stringify({ content: { 'settings.json': { content: JSON.stringify(site, null, 2) }, pages: repoPages } }) + ';'
  : '');
console.log(demo ? 'DEMO build (editor changes are not saved)' : 'Production build (editor login: Netlify Identity)');
