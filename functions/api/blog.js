// Blog admin (logged-in editors only), used by /admin/blog.html.
// GET            = all posts (without their content) + comments waiting + options
// GET ?id=       = one post with its content and all its comments
// POST { action: 'save', post }            = create / update (publishing a post with "send as letter" sends it)
// POST { action: 'preview', post }         = the post page as visitors will see it, without saving (for Preview in /admin)
// POST { action: 'comment', id, approve }  = approve (true) or delete (false) a comment
// DELETE ?id=    = delete a post and its comments
import { json, editor } from '../../server/util.js';
import { bdb, rowToPost, slugify, CATS, AUTHOR, isLive } from '../../server/blog.js';
import { shell, postPage } from '../../server/blog-pages.js';
import { sendPostLetter, releaseDue } from '../../server/blog-mail.js';
import { senders, ndb, splitInterests } from '../../server/newsletter.js';

const TYPES = ['heading', 'text', 'image', 'pair', 'quote', 'button', 'divider', 'video'];
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const url = (v) => { const s = str(v, 600).trim(); return /^(https?:\/\/|\/)/i.test(s) ? s : ''; };
function cleanBlocks(arr) {
  return (Array.isArray(arr) ? arr : []).slice(0, 200).filter((b) => b && TYPES.includes(b.type)).map((b) => ({
    id: str(b.id, 20), type: b.type, text: str(b.text, 20000), caption: str(b.caption, 300), alt: str(b.alt, 300), cite: str(b.cite, 120), label: str(b.label, 80),
    src: url(b.src), a: url(b.a), b: url(b.b), url: url(b.url), size: ['small', 'medium', 'full'].includes(b.size) ? b.size : 'full',
    wrap: ['left', 'right'].includes(b.wrap) ? b.wrap : 'none', link: !!b.link,
  }));
}

export async function onRequest({ request, env, waitUntil }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  let DB;
  try { DB = await bdb(env); } catch (e) { return json(500, { error: e.message }); }
  const u = new URL(request.url), origin = u.origin;

  if (request.method === 'GET') {
    const id = u.searchParams.get('id');
    if (id) {
      const p = rowToPost(await DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first());
      if (!p) return json(404, { error: 'Post not found.' });
      const cms = (await DB.prepare('SELECT id, name, email, text, approved, created_at FROM post_comments WHERE post_id = ? ORDER BY created_at DESC').bind(id).all()).results || [];
      return json(200, { post: p, comments: cms });
    }
    waitUntil(releaseDue(env, origin));
    const rows = (await DB.prepare('SELECT * FROM posts ORDER BY COALESCE(publish_at, updated_at) DESC').all()).results || [];
    const pend = (await DB.prepare('SELECT post_id, COUNT(*) n FROM post_comments WHERE approved = 0 GROUP BY post_id').all()).results || [];
    const pm = Object.fromEntries(pend.map((r) => [r.post_id, r.n]));
    let interests = ['Ministry', 'Beauty', 'Events & new books'];
    try { const s = (await (await ndb(env)).prepare("SELECT interests FROM subscribers WHERE status = 'active'").all()).results || []; interests = [...new Set(interests.concat(...s.map((x) => splitInterests(x.interests))))]; } catch (e) {}
    const posts = rows.map(rowToPost).map((p) => { delete p.blocks; p.pending = pm[p.id] || 0; return p; });
    return json(200, { posts, categories: CATS, author: AUTHOR, senders: senders(env), interests, now: new Date().toISOString() });
  }

  if (request.method === 'DELETE') {
    const id = u.searchParams.get('id');
    const r = await DB.prepare('DELETE FROM posts WHERE id = ?').bind(String(id || '')).run();
    await DB.prepare('DELETE FROM post_comments WHERE post_id = ?').bind(String(id || '')).run();
    return r.meta && r.meta.changes ? json(200, { ok: true }) : json(404, { error: 'Post not found.' });
  }
  if (request.method !== 'POST') return json(405, { error: 'Use GET, POST or DELETE.' });
  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }

  if (body.action === 'comment') {
    const cid = String(body.id || '');
    const r = body.approve ? await DB.prepare('UPDATE post_comments SET approved = 1 WHERE id = ?').bind(cid).run() : await DB.prepare('DELETE FROM post_comments WHERE id = ?').bind(cid).run();
    return r.meta && r.meta.changes ? json(200, { ok: true }) : json(404, { error: 'Comment not found.' });
  }
  if (body.action === 'preview') {
    const q = body.post || {};
    const post = { id: str(q.id, 60) || 'preview', slug: slugify(q.slug || q.title) || 'preview', title: str(q.title, 200) || 'Untitled post', excerpt: str(q.excerpt, 400), cat: str(q.cat || CATS[0], 60),
      tags: (Array.isArray(q.tags) ? q.tags : []).map((t) => str(t, 40)).slice(0, 20), cover: url(q.cover), coverAlt: str(q.coverAlt, 300), blocks: cleanBlocks(q.blocks),
      status: q.status === 'pub' ? 'pub' : 'draft', publishAt: q.publishAt || new Date().toISOString(), comments: q.comments !== false, amens: Number(q.amens) || 0, author: str(q.author, 80), updated: new Date().toISOString() };
    const r = await postPage(env, u, await shell(env, u), post.slug, { post });
    return new Response(await r.text(), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (body.action !== 'save') return json(400, { error: 'Bad request.' });

  const p = body.post || {};
  const title = str(p.title, 200).trim();
  if (!title) return json(400, { error: 'Give the post a title first.' });
  const blocks = cleanBlocks(p.blocks);
  if (JSON.stringify(blocks).length > 400000) return json(400, { error: 'The post is too long.' });
  const now = new Date().toISOString();
  const old = p.id ? await DB.prepare('SELECT * FROM posts WHERE id = ?').bind(String(p.id)).first() : null;
  const id = old ? old.id : crypto.randomUUID();
  // web address: unique
  let base = slugify(p.slug || title) || 'post', slug = base;
  for (let n = 2; await DB.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').bind(slug, id).first(); n++) slug = base + '-' + n;
  const status = p.status === 'pub' ? 'pub' : 'draft';
  let publishAt = p.publishAt && !isNaN(new Date(p.publishAt)) ? new Date(p.publishAt).toISOString() : '';
  if (status === 'pub' && !publishAt) publishAt = now;
  const tags = (Array.isArray(p.tags) ? p.tags : []).map((t) => str(t, 40).trim().replace(/^#/, '')).filter(Boolean).slice(0, 20);
  const vals = [slug, title, str(p.excerpt, 400), str(p.cat || CATS[0], 60), JSON.stringify(tags), url(p.cover), str(p.coverAlt, 300), JSON.stringify(blocks), status, publishAt || null,
    p.featured ? 1 : 0, p.comments === false ? 0 : 1, p.home ? 1 : 0, p.nlSend ? 1 : 0, str(p.nlAudience || 'All', 60), ['ministry', 'beauty', 'main'].includes(p.nlBrand) ? p.nlBrand : 'ministry',
    str(p.seoTitle, 120), str(p.seoDesc, 300), str(p.author, 80), now];
  if (p.featured) await DB.prepare('UPDATE posts SET featured = 0 WHERE id != ?').bind(id).run();
  if (old) {
    await DB.prepare(`UPDATE posts SET slug=?, title=?, excerpt=?, cat=?, tags=?, cover=?, cover_alt=?, blocks=?, status=?, publish_at=?, featured=?, comments_on=?, show_home=?,
      nl_send=?, nl_audience=?, nl_brand=?, seo_title=?, seo_desc=?, author=?, updated_at=? WHERE id=?`).bind(...vals, id).run();
  } else {
    await DB.prepare(`INSERT INTO posts (slug, title, excerpt, cat, tags, cover, cover_alt, blocks, status, publish_at, featured, comments_on, show_home,
      nl_send, nl_audience, nl_brand, seo_title, seo_desc, author, updated_at, id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...vals, id, now).run();
  }
  const saved = rowToPost(await DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first());
  let letter = null;
  if (saved.nlSend && !saved.nlSentAt && isLive(saved)) {
    letter = await sendPostLetter(env, saved, origin, user.email || user.login);
    saved.nlSentAt = letter.ok ? now : '';
  }
  return json(200, { ok: true, post: saved, letter });
}
