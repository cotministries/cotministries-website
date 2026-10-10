// Public blog: /blog/ (list, ?cat= ?tag= ?q= ?page=), /blog/<slug>/ (one post), /blog/sitemap.xml, /blog/rss.xml
import { slugify } from '../../server/blog.js';
import { shell, listPage, postPage, sitemap, rss } from '../../server/blog-pages.js';
import { releaseDue } from '../../server/blog-mail.js';

export async function onRequestGet({ request, env, params, waitUntil }) {
  const url = new URL(request.url);
  const parts = [].concat(params.path || []).filter(Boolean);
  if (!parts.length && !url.pathname.endsWith('/')) return Response.redirect(new URL('/blog/' + url.search, url).toString(), 301);
  try {
    waitUntil(releaseDue(env, url.origin));
    if (parts[0] === 'sitemap.xml') return await sitemap(env);
    if (parts[0] === 'rss.xml') return await rss(env);
    const sh = await shell(env, url);
    if (!parts.length) return await listPage(env, url, sh);
    const slug = slugify(parts[0]);
    if (parts.length > 1 || slug !== parts[0]) return Response.redirect(new URL('/blog/' + slug + '/', url).toString(), 301);
    if (!url.pathname.endsWith('/')) return Response.redirect(new URL('/blog/' + slug + '/' + url.search, url).toString(), 301);
    return await postPage(env, url, sh, slug, { waitUntil });
  } catch (e) {
    console.log('blog error', e && e.stack || e);
    return new Response('The blog is not available right now. Please try again in a moment.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
