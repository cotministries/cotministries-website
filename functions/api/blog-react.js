// Public reactions on blog posts: { slug, kind: 'amen' | 'unamen' | 'comment', name, email, text }.
// Comments wait for approval in /admin → Blog; Niki gets an email about each new one.
import { json, esc } from '../../server/util.js';
import { bdb, LIVE_SQL } from '../../server/blog.js';
import { sender, send } from '../../server/brands.js';
import { cleanEmail, validEmail } from '../../server/newsletter.js';

export async function onRequestPost({ request, env, waitUntil }) {
  let b;
  try { b = await request.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const DB = await bdb(env);
  const p = await DB.prepare(`SELECT id, title, slug, comments_on FROM posts WHERE slug = ? AND ${LIVE_SQL}`).bind(String(b.slug || ''), new Date().toISOString()).first();
  if (!p) return json(404, { error: 'Post not found.' });
  if (b.kind === 'amen' || b.kind === 'unamen') {
    await DB.prepare(b.kind === 'amen' ? 'UPDATE posts SET amens = amens + 1 WHERE id = ?' : 'UPDATE posts SET amens = MAX(0, amens - 1) WHERE id = ?').bind(p.id).run();
    const r = await DB.prepare('SELECT amens FROM posts WHERE id = ?').bind(p.id).first();
    return json(200, { ok: true, amens: r ? r.amens : 0 });
  }
  if (b.kind !== 'comment') return json(400, { error: 'Bad request.' });
  if (!p.comments_on) return json(403, { error: 'Comments are closed for this post.' });
  if (b.company) return json(200, { ok: true }); // spam bot
  const name = String(b.name || '').trim().slice(0, 80), email = cleanEmail(b.email), text = String(b.text || '').trim().slice(0, 3000);
  if (!name || !text) return json(400, { error: 'Please write your name and a comment.' });
  if (!validEmail(email)) return json(400, { error: 'Please enter a valid email address (it is not shown).' });
  if ((text.match(/https?:\/\//g) || []).length > 2) return json(400, { error: 'Please leave out the links.' });
  await DB.prepare('INSERT INTO post_comments (id, post_id, name, email, text, approved, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .bind(crypto.randomUUID(), p.id, name, email, text, new Date().toISOString()).run();
  const snd = sender(env, 'ministry', 'blog');
  if (snd.notify) waitUntil(send(snd, { to: [snd.notify], subject: `New comment on “${p.title}”`, reply_to: email,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#2b0e04"><p><b>${esc(name)}</b> (${esc(email)}) commented on <b>${esc(p.title)}</b>:</p><p style="white-space:pre-wrap;background:#faf5f0;border-left:3px solid #c9a24a;padding:12px 14px">${esc(text)}</p><p>Approve or delete it in <a href="${new URL(request.url).origin}/admin/blog.html">/admin → Blog</a>. It is not visible until you approve it.</p></div>` }).catch(() => {}));
  return json(200, { ok: true });
}
