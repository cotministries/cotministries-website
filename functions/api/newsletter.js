// Newsletter admin (logged-in editors only), used by /admin/newsletter.html.
// GET  = subscribers + who letters can be sent from + past letters
// POST = { subject, blocks (or body), audience, brand, test, testTo } -> sends through Resend (test = one copy to yourself)
// DELETE ?id= = remove a subscriber from the list completely
import { json, editor } from '../../server/util.js';
import { ndb, splitInterests, senders, sendLetter, textToBlocks } from '../../server/newsletter.js';

const DEFAULT_INTERESTS = ['Ministry', 'Beauty', 'Events & new books'];

export async function onRequest({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  let DB;
  try { DB = await ndb(env); } catch (e) { return json(500, { error: e.message }); }
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const [subs, sends] = await Promise.all([
      DB.prepare('SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 20000').all(),
      DB.prepare('SELECT * FROM newsletter_sends ORDER BY created_at DESC LIMIT 50').all(),
    ]);
    const list = (subs.results || []).map((s) => ({ id: s.id, email: s.email, first: s.first_name || '', last: s.last_name || '', interests: splitInterests(s.interests),
      source: s.source || '', date: s.created_at, status: s.status, unsubDate: s.unsub_at || '' }));
    const interests = [...new Set(DEFAULT_INTERESTS.concat(...list.map((s) => s.interests)))];
    return json(200, { subscribers: list, interests, senders: senders(env), history: sends.results || [], me: String(user.email || '').includes('@') ? user.email : '' });
  }

  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    const r = await DB.prepare('DELETE FROM subscribers WHERE id = ?').bind(String(id || '')).run();
    return r.meta && r.meta.changes ? json(200, { ok: true }) : json(404, { error: 'Subscriber not found.' });
  }

  if (request.method !== 'POST') return json(405, { error: 'Use GET, POST or DELETE.' });
  let b;
  try { b = await request.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const subject = String(b.subject || '').trim().slice(0, 200);
  const blocks = Array.isArray(b.blocks) ? b.blocks.slice(0, 200) : textToBlocks(String(b.body || '').slice(0, 50000));
  const hasContent = blocks.some((x) => (x.text && String(x.text).trim()) || x.src || x.a || x.b || x.url);
  if (!subject || !hasContent) return json(400, { error: 'Write a subject and a letter first.' });
  if (JSON.stringify(blocks).length > 200000) return json(400, { error: 'The letter is too long.' });
  const r = await sendLetter(env, { brandId: b.brand, subject, blocks, audience: b.audience, origin: url.origin, by: user.email || user.login,
    test: !!b.test, testTo: b.testTo || user.email, testName: (user.name || '').split(' ')[0] });
  return r.ok ? json(200, r) : json(r.status || 424, { error: r.error });
}
