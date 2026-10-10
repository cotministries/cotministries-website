// Editors only. GET = schedule settings + upcoming appointments, PUT = save settings (live right away, no publishing needed).
import { json, editor } from '../../server/util.js';
import { getSchedule, saveSchedule, adb, nowIn } from '../../server/schedule.js';

export async function onRequest({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  if (request.method === 'PUT' || request.method === 'POST') {
    let body; try { body = await request.json(); } catch (e) { return json(400, { error: 'Bad data.' }); }
    try { return json(200, { ok: true, settings: await saveSchedule(env, body) }); } catch (e) { return json(424, { error: 'Could not save: ' + e.message }); }
  }
  if (request.method !== 'GET') return json(405, { error: 'Use GET or PUT.' });
  const s = await getSchedule(env);
  const now = nowIn(s.tz);
  let appts = [];
  try {
    const DB = await adb(env);
    const r = await DB.prepare("SELECT a.id, a.message_id, a.date, a.start, a.end, a.status, m.data FROM appointments a LEFT JOIN messages m ON m.id = a.message_id WHERE a.date >= ? AND a.status IN ('confirmed','requested') ORDER BY a.date, a.start LIMIT 300").bind(now.date).all();
    appts = (r.results || []).map((a) => { const d = JSON.parse(a.data || '{}'); return { id: a.id, messageId: a.message_id, date: a.date, start: a.start, end: a.end, status: a.status, name: d.name || '', services: d.services || '', location: d.location || '' }; });
  } catch (e) {}
  return json(200, { settings: s, now, appointments: appts });
}
