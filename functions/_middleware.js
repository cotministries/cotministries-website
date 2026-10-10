// Runs only for the paths listed in dist/_routes.json (/, /home, /admin, /api/*), so normal pages stay static and free.
// - www.cotministries.com goes to cotministries.com
// - the editor (/admin) always opens on the main domain, where the email-code login (Cloudflare Access) protects it
const PRIMARY = 'cotministries.com';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const p = url.pathname;

  if (/^\/admin(\/|$)/.test(p) && host !== PRIMARY && host !== 'localhost' && host !== '127.0.0.1') {
    return Response.redirect(`https://${PRIMARY}${p}${url.search}`, 302);
  }
  if (host === 'www.' + PRIMARY) return Response.redirect(`https://${PRIMARY}${p}${url.search}`, 301);
  if (p.startsWith('/api/')) {
    // Any unexpected crash in an /api function comes back as a readable message instead of a bare error page.
    try { return await next(); } catch (e) {
      console.log('API error', p, e && e.stack || e);
      return new Response(JSON.stringify({ error: 'Server error: ' + (e && e.message || e) }), { status: 500, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
  }
  return next();
}
