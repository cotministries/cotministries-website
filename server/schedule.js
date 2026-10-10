// Booking schedule: opening hours, days off, slot rules (stored in D1 kv 'schedule', edited in /admin/schedule.html)
// and appointments (D1 table, one row per booking request; confirmed/requested rows block their time).
import { db } from './util.js';

export const DEFAULTS = {
  tz: 'America/New_York',
  // 0 = Sunday … 6 = Saturday. null = closed.
  week: { 0: null, 1: null, 2: { from: '09:00', to: '19:00' }, 3: { from: '09:00', to: '19:00' }, 4: { from: '09:00', to: '19:00' }, 5: { from: '09:00', to: '19:00' }, 6: { from: '08:00', to: '17:00' } },
  daysOff: [],     // ['2026-12-25', …]
  extraDays: [],   // [{ date, from, to }] open on a day that is normally closed (or different hours)
  blocks: [],      // [{ date, from, to, note }] time Niki is busy (booked elsewhere, personal)
  step: 30,        // a new start time every … minutes
  buffer: 15,      // minutes kept free between two clients
  maxDays: 90,     // how far ahead people can book
  minNotice: 24,   // hours of notice needed
  holdRequests: true, // a new request holds its time until it is declined
  defaultMinutes: 60, // length used when a service has no time set
  note: '',        // short message shown above the calendar
};

const ensured = new WeakSet();
export async function adb(env) {
  const DB = await db(env);
  if (!ensured.has(DB)) {
    await DB.prepare('CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, message_id TEXT, date TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)').run();
    ensured.add(DB);
  }
  return DB;
}

export const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const range = (r) => (r && toMin(r.from) != null && toMin(r.to) != null && toMin(r.to) > toMin(r.from) ? { from: r.from, to: r.to } : null);

// Cleans whatever the admin page sends into a safe settings object.
export function clean(input) {
  const s = Object.assign({}, DEFAULTS, input || {});
  const week = {};
  for (let i = 0; i < 7; i++) week[i] = range((s.week || {})[i]);
  const dates = (a) => [...new Set((Array.isArray(a) ? a : []).filter(isDate))].sort();
  return {
    tz: typeof s.tz === 'string' && s.tz.length < 60 ? s.tz : DEFAULTS.tz,
    week,
    daysOff: dates(s.daysOff).slice(-500),
    extraDays: (Array.isArray(s.extraDays) ? s.extraDays : []).filter((x) => x && isDate(x.date) && range(x)).map((x) => ({ date: x.date, from: x.from, to: x.to })).sort((a, b) => a.date.localeCompare(b.date)).slice(-300),
    blocks: (Array.isArray(s.blocks) ? s.blocks : []).filter((x) => x && isDate(x.date) && range(x)).map((x) => ({ date: x.date, from: x.from, to: x.to, note: String(x.note || '').slice(0, 80) })).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from)).slice(-500),
    step: clampInt(s.step, 5, 240, 30),
    buffer: clampInt(s.buffer, 0, 240, 15),
    maxDays: clampInt(s.maxDays, 1, 730, 90),
    minNotice: clampInt(s.minNotice, 0, 24 * 60, 24),
    holdRequests: s.holdRequests !== false,
    defaultMinutes: clampInt(s.defaultMinutes, 15, 720, 60),
    note: String(s.note || '').slice(0, 300),
  };
}

export async function getSchedule(env) {
  try {
    const DB = await db(env);
    const r = await DB.prepare('SELECT v FROM kv WHERE k = ?').bind('schedule').first();
    return clean(r ? JSON.parse(r.v) : {});
  } catch (e) { return clean({}); }
}
export async function saveSchedule(env, s) {
  const c = clean(s);
  const DB = await db(env);
  await DB.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind('schedule', JSON.stringify(c)).run();
  return c;
}

// "Now" as wall-clock date + minutes in the studio's time zone.
export function nowIn(tz) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;

// Opening hours for one date: { from, to } in minutes, or null when closed.
export function hoursOn(s, date) {
  if (s.daysOff.includes(date)) return null;
  const extra = s.extraDays.find((x) => x.date === date);
  const r = extra || s.week[new Date(dayNum(date) * 864e5).getUTCDay()];
  return r ? { from: toMin(r.from), to: toMin(r.to) } : null;
}

// Busy times (blocks + held appointments) from today on, as [{ date, start, end }].
export async function busyTimes(env, s, fromDate, exceptId) {
  const out = s.blocks.filter((b) => b.date >= fromDate).map((b) => ({ date: b.date, start: toMin(b.from), end: toMin(b.to) }));
  try {
    const DB = await adb(env);
    const st = s.holdRequests ? ['confirmed', 'requested'] : ['confirmed'];
    const r = await DB.prepare(`SELECT id, date, start, end FROM appointments WHERE date >= ? AND status IN (${st.map(() => '?').join(',')})`).bind(fromDate, ...st).all();
    for (const a of r.results || []) if (a.id !== exceptId) out.push({ date: a.date, start: a.start, end: a.end });
  } catch (e) {}
  return out;
}

// Why a slot can't be booked (or '' if it's fine).
export function slotProblem(s, busy, now, date, start, len) {
  if (!isDate(date) || !Number.isFinite(start) || !Number.isFinite(len) || len <= 0) return 'Please choose a date and time.';
  const h = hoursOn(s, date);
  if (!h || start < h.from || start + len > h.to) return 'That time is outside opening hours.';
  const days = dayNum(date) - dayNum(now.date);
  if (days > s.maxDays) return 'That date is too far ahead.';
  if (days * 1440 + start - now.min < s.minNotice * 60) return 'That time is too soon.';
  const b = s.buffer;
  if (busy.some((x) => x.date === date && start < x.end + b && start + len + b > x.start)) return 'Sorry, that time was just taken. Please choose another time.';
  return '';
}
