// The newest blog posts for the "Latest from the blog" section (Home page etc.). Public, cached for a minute.
import { bdb, rowToPost, LIVE_SQL, readMinutes, fmtDate } from '../../server/blog.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const n = Math.min(6, Math.max(1, parseInt(url.searchParams.get('n'), 10) || 3));
  let posts = [];
  try {
    const rows = (await (await bdb(env)).prepare(`SELECT * FROM posts WHERE ${LIVE_SQL} ORDER BY show_home DESC, publish_at DESC LIMIT ?`).bind(new Date().toISOString(), n).all()).results || [];
    posts = rows.map(rowToPost).map((p) => ({ title: p.title, url: '/blog/' + p.slug + '/', cover: p.cover, excerpt: p.excerpt, cat: p.cat, date: fmtDate(p.publishAt), min: readMinutes(p) }));
  } catch (e) { /* database not ready: show nothing */ }
  return new Response(JSON.stringify({ posts }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } });
}
