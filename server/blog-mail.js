// Sending a blog post to newsletter subscribers ("Also send to newsletter subscribers" in the blog editor).
// Published now -> sent when saved. Scheduled -> sent by the first blog visit (or /admin) after its time comes,
// because Cloudflare Pages has no timer of its own.
import { bdb, rowToPost, LIVE_SQL } from './blog.js';
import { sendLetter } from './newsletter.js';

export function postLetterBlocks(p, origin) {
  const url = `${origin}/blog/${p.slug}/`;
  const out = [];
  if (p.cover) out.push({ type: 'image', src: p.cover, alt: p.coverAlt || p.title, size: 'full', link: true, url });
  if (p.excerpt) out.push({ type: 'text', text: p.excerpt });
  return out.concat(p.blocks || [], [{ type: 'divider' }, { type: 'button', label: p.comments ? 'Read it on the website & comment' : 'Read it on the website', url }]);
}

export async function sendPostLetter(env, p, origin, by) {
  const DB = await bdb(env);
  // claim it first, so two visits at the same moment can't send it twice
  const claim = await DB.prepare('UPDATE posts SET nl_sent_at = ? WHERE id = ? AND nl_sent_at IS NULL').bind(new Date().toISOString(), p.id).run();
  if (!claim.meta || !claim.meta.changes) return { ok: false, error: 'already sent' };
  const r = await sendLetter(env, { brandId: p.nlBrand, subject: p.title, blocks: postLetterBlocks(p, origin), audience: p.nlAudience || 'All', origin, by: by || 'blog (scheduled)', preheader: p.excerpt });
  // email service problem -> try again next time; nobody to send to -> leave it as done
  if (!r.ok && r.status === 424) await DB.prepare('UPDATE posts SET nl_sent_at = NULL WHERE id = ?').bind(p.id).run();
  return r;
}

// Scheduled posts whose time has come and that should still go out as a letter.
export async function releaseDue(env, origin) {
  try {
    const DB = await bdb(env);
    const rows = (await DB.prepare(`SELECT * FROM posts WHERE ${LIVE_SQL} AND nl_send = 1 AND nl_sent_at IS NULL LIMIT 3`).bind(new Date().toISOString()).all()).results || [];
    for (const r of rows) { const res = await sendPostLetter(env, rowToPost(r), origin); if (!res.ok) console.log('blog letter not sent', r.slug, res.error); }
  } catch (e) { console.log('releaseDue failed', e.message); }
}
