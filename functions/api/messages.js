// Messages inbox for logged-in editors. GET = list, DELETE ?id= = remove one message (and its replies).
import { json, editor, db } from '../../server/util.js';
import { brandFor, brand } from '../../server/brands.js';
import { adb } from '../../server/schedule.js';
import { photoList, deletePhotos } from '../../server/photos.js';
import { learn, cleanOldSpam } from '../../server/spam.js';

const HIDE = ['name', 'email', 'message', 'company', 'form-name', '_spam'];

export async function onRequest({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  let DB;
  try { DB = await db(env); } catch (e) { return json(500, { error: e.message }); }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json(404, { error: 'Message not found.' });
    const r = await DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
    await DB.prepare('DELETE FROM replies WHERE message_id = ?').bind(id).run();
    try { await (await adb(env)).prepare('DELETE FROM appointments WHERE message_id = ?').bind(id).run(); } catch (e) {}
    await deletePhotos(env, id);
    return r.meta && r.meta.changes ? json(200, { ok: true }) : json(404, { error: 'Message not found.' });
  }
  // POST ?id=…&spam=1 (Spam button) or &spam=0 (Not spam): moves the message and remembers the sender
  if (request.method === 'POST') {
    const u = new URL(request.url), id = u.searchParams.get('id'), isSpam = u.searchParams.get('spam') === '1';
    const row = id && await DB.prepare('SELECT data FROM messages WHERE id = ?').bind(id).first();
    if (!row) return json(404, { error: 'Message not found.' });
    const d = JSON.parse(row.data || '{}');
    if (isSpam) d._spam = 'marked as spam by ' + (user.name || user.email || 'you'); else delete d._spam;
    await DB.prepare('UPDATE messages SET data = ? WHERE id = ?').bind(JSON.stringify(d), id).run();
    try { await learn(env, d.email, isSpam); } catch (e) { console.log('spam learn', e.message); }
    return json(200, { ok: true, spam: d._spam || '' });
  }
  if (request.method !== 'GET') return json(405, { error: 'Use GET, POST or DELETE.' });
  await cleanOldSpam(env);

  const [msgs, reps] = await Promise.all([
    DB.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 300').all(),
    DB.prepare('SELECT * FROM replies ORDER BY created_at ASC').all(),
  ]);
  const appt = {};
  try { const r = await (await adb(env)).prepare('SELECT message_id, date, start, end, status FROM appointments WHERE message_id IS NOT NULL').all(); for (const a of r.results || []) appt[a.message_id] = { date: a.date, start: a.start, end: a.end, status: a.status }; } catch (e) {}
  const pics = {};
  for (const p of await photoList(env)) (pics[p.message_id] = pics[p.message_id] || []).push({ id: p.id, name: p.name });
  const byMsg = {};
  for (const r of reps.results || []) (byMsg[r.message_id] = byMsg[r.message_id] || []).push({ date: r.created_at, by: r.by_user, text: r.text });
  return json(200, (msgs.results || []).map((s) => {
    const d = JSON.parse(s.data || '{}');
    const b = brandFor(s.form, d);
    return {
      id: s.id, form: s.form, date: s.created_at, brand: { id: b, name: brand(env, b).name },
      name: d.name, email: d.email, message: d.message, spam: d._spam || '',
      fields: Object.entries(d).filter(([k, v]) => v && !HIDE.includes(k)).map(([k, v]) => ({ label: k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value: String(v) })),
      replies: byMsg[s.id] || [],
      appointment: appt[s.id] || null,
      photos: pics[s.id] || [],
    };
  }));
}
