// Numbers and lists for the studio's Home page (/admin/), logged-in editors only.
// Everything is optional: if a part isn't set up yet (no database table, no posts…), that part comes back empty.
import { json, editor, db, repoOf } from '../../server/util.js';
import { adb, getSchedule, nowIn } from '../../server/schedule.js';

const safe = async (f, d) => { try { return await f(); } catch (e) { return d; } };
const FORM = { booking: 'Booking', wedding: 'Wedding inquiry', prayer: 'Prayer request', speaking: 'Speaking invitation', contact: 'Message', newsletter: 'Sign-up', rsvp: 'RSVP', orders: 'Order' };

export async function onRequestGet({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  const out = { user: { name: user.name, email: user.email }, repo: repoOf(env), messages: [], appointments: [], comments: { waiting: 0, post: '' }, scheduled: [], subscribers: { total: 0, month: 0 }, today: '' };
  const DB = await safe(() => db(env), null);
  if (!DB) return json(200, out);

  // latest messages (unread is remembered per device in the browser, like in Messages)
  const msgs = await safe(async () => (await DB.prepare("SELECT id, form, created_at, data FROM messages WHERE json_extract(data, '$._spam') IS NULL ORDER BY created_at DESC LIMIT 60").all()).results || [], []);
  const byId = {};
  out.messages = msgs.map((m) => { const d = JSON.parse(m.data || '{}'); byId[m.id] = d; return { id: m.id, name: d.name || d.email || 'Someone', what: FORM[m.form] || m.form, date: m.created_at, detail: d.wedding_date || d.services || d.service || d.items || d.topic || '' }; });

  // appointments from today on
  const sched = await safe(() => getSchedule(env), null);
  const now = sched ? nowIn(sched.tz) : { date: new Date().toISOString().slice(0, 10) };
  out.today = now.date;
  out.appointments = await safe(async () => {
    const r = (await (await adb(env)).prepare("SELECT id, message_id, date, start, end, status FROM appointments WHERE date >= ? AND status != 'declined' ORDER BY date, start LIMIT 40").bind(now.date).all()).results || [];
    const need = r.filter((a) => a.message_id && !byId[a.message_id]).map((a) => a.message_id);
    for (const id of need.slice(0, 20)) { const m = await DB.prepare('SELECT data FROM messages WHERE id = ?').bind(id).first(); if (m) byId[id] = JSON.parse(m.data || '{}'); }
    return r.map((a) => { const d = byId[a.message_id] || {}; return { id: a.id, messageId: a.message_id, date: a.date, start: a.start, end: a.end, status: a.status, name: d.name || (a.message_id ? 'Booking' : 'Blocked time'), what: d.services || d.service || d.package || '' }; });
  }, []);

  // blog: comments waiting + next scheduled posts
  out.comments = await safe(async () => {
    const r = await DB.prepare('SELECT c.post_id, p.title, COUNT(*) n FROM post_comments c JOIN posts p ON p.id = c.post_id WHERE c.approved = 0 GROUP BY c.post_id ORDER BY n DESC').all();
    const rows = r.results || [];
    return { waiting: rows.reduce((n, x) => n + x.n, 0), post: rows[0] ? rows[0].title : '' };
  }, out.comments);
  out.scheduled = await safe(async () => ((await DB.prepare("SELECT title, publish_at, nl_send FROM posts WHERE status = 'pub' AND publish_at > ? ORDER BY publish_at LIMIT 3").bind(new Date().toISOString()).all()).results || [])
    .map((p) => ({ title: p.title, at: p.publish_at, letter: !!p.nl_send })), []);

  // newsletter
  out.subscribers = await safe(async () => {
    const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
    const t = await DB.prepare("SELECT COUNT(*) n FROM subscribers WHERE status = 'active'").first();
    const m = await DB.prepare("SELECT COUNT(*) n FROM subscribers WHERE status = 'active' AND created_at >= ?").bind(month.toISOString()).first();
    return { total: t ? t.n : 0, month: m ? m.n : 0 };
  }, out.subscribers);
  return json(200, out);
}
