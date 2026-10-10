// Editors only. POST { id, status: 'confirmed' | 'declined' | 'requested', force? } – confirm or decline a booking request.
// id = appointment id or the inbox message id. Confirmed (and, if set, requested) times are blocked for everyone else.
import { json, editor } from '../../server/util.js';
import { getSchedule, busyTimes, adb } from '../../server/schedule.js';

const fmt = (m) => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };

export async function onRequestPost({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  let b; try { b = await request.json(); } catch (e) { return json(400, { error: 'Bad data.' }); }
  const status = String(b.status || '');
  if (!['confirmed', 'declined', 'requested'].includes(status)) return json(400, { error: 'Unknown status.' });
  const DB = await adb(env);
  const a = await DB.prepare('SELECT * FROM appointments WHERE id = ? OR message_id = ?').bind(String(b.id || ''), String(b.id || '')).first();
  if (!a) return json(404, { error: 'This request has no booked time.' });
  if (status === 'confirmed' && !b.force) {
    const s = await getSchedule(env);
    const s2 = Object.assign({}, s, { holdRequests: false }); // only clash with confirmed times + blocks
    const busy = (await busyTimes(env, s2, a.date, a.id)).filter((x) => x.date === a.date && a.start < x.end + s.buffer && a.end + s.buffer > x.start);
    if (busy.length) return json(409, { error: `This overlaps another confirmed time or blocked time on that day (${busy.map((x) => fmt(x.start) + '–' + fmt(x.end)).join(', ')}).`, conflict: true });
  }
  await DB.prepare('UPDATE appointments SET status = ? WHERE id = ?').bind(status, a.id).run();
  return json(200, { ok: true, status });
}
