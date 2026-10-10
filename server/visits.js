// Visitor counting for the studio's Visitors page – no cookies, no names, no IP addresses stored.
// Each page view sends a tiny note (static/site.js → /api/hit). A visitor is a daily anonymous code made from
// a random salt of the day + IP + browser; old salts are deleted, so codes can't be turned back into anyone.
// Country/city come from Cloudflare. Rows older than ~13 months are removed by themselves.
import { db } from './util.js';
import { getSchedule } from './schedule.js';

let ready = null;
export async function vdb(env) {
  const DB = await db(env);
  if (!ready) ready = DB.batch([
    DB.prepare('CREATE TABLE IF NOT EXISTS visits (pv TEXT PRIMARY KEY, ts INTEGER NOT NULL, seen INTEGER, day TEXT NOT NULL, hour INTEGER, dow INTEGER, site TEXT, vid TEXT, path TEXT, title TEXT, src TEXT, refhost TEXT, country TEXT, city TEXT, device TEXT, dur INTEGER DEFAULT 0)'),
    DB.prepare('CREATE INDEX IF NOT EXISTS visits_day ON visits(day, site)'),
    DB.prepare('CREATE INDEX IF NOT EXISTS visits_ts ON visits(ts)'),
    DB.prepare('CREATE TABLE IF NOT EXISTS visit_salt (day TEXT PRIMARY KEY, salt TEXT NOT NULL)'),
  ]).catch((e) => { ready = null; throw e; });
  await ready;
  return DB;
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|preview|python|curl|wget|httpclient|java\/|go-http|axios|node-fetch|scrapy|semrush|ahrefs/i;
export const siteOf = (host) => 'sit';

// local date/hour/weekday in Niki's time zone (the one set in Schedule)
let TZ = null;
async function tzOf(env) { if (!TZ) { const s = await getSchedule(env).catch(() => null); TZ = (s && s.tz) || 'America/New_York'; } return TZ; }
export function localParts(tz, t = Date.now()) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(t))) p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}

const SRC = [
  [/^(mail|webmail|email)\.|outlook\.(live|office)|gmx\.|(^|\.)web\.de$|proton\.me$/, 'Email'],
  [/(^|\.)google\./, 'Google'],
  [/bing\.|duckduckgo|yahoo\.|ecosia|yandex|baidu|startpage|search\.brave/, 'Other search engines'],
  [/instagram|^ig$/, 'Instagram'],
  [/facebook|(^|\.)fb\.(com|me)$|^fb$|messenger/, 'Facebook'],
  [/tiktok/, 'TikTok'],
  [/youtube|youtu\.be/, 'YouTube'],
  [/pinterest|pin\.it/, 'Pinterest'],
  [/(^|\.)t\.co$|twitter|(^|\.)x\.com$/, 'X / Twitter'],
  [/linkedin|lnkd\.in/, 'LinkedIn'],
  [/whatsapp|wa\.me/, 'WhatsApp'],
  [/chatgpt|openai|perplexity|claude\.ai|copilot|gemini/, 'AI assistants'],
];
export function sourceOf(ref, utm, host) {
  utm = String(utm || '').toLowerCase().trim().slice(0, 40);
  if (/^(newsletter|letter|email-list)$/.test(utm)) return { src: 'Your newsletter', refhost: '' };
  let rh = '';
  try { rh = ref ? new URL(ref).hostname.toLowerCase().replace(/^www\./, '') : ''; } catch (e) {}
  const own = host.replace(/^www\./, '');
  if (rh && rh === own) return { src: 'internal', refhost: '' };
  if (utm) { for (const [re, n] of SRC) if (re.test(utm)) return { src: n, refhost: rh }; }
  if (!rh) return { src: utm ? utm.replace(/^./, (c) => c.toUpperCase()) : 'Typed in / bookmark', refhost: '' };
  if (/(^|\.)cotministries\.com$/.test(rh)) return { src: 'Your other website', refhost: rh };
  for (const [re, n] of SRC) if (re.test(rh)) return { src: n, refhost: rh };
  return { src: 'Other websites', refhost: rh };
}
const deviceOf = (ua) => (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua) ? 'Tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'Phone' : 'Computer');

const SALT = {};
async function saltFor(DB, day) {
  if (SALT[day]) return SALT[day];
  const fresh = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await DB.prepare('INSERT OR IGNORE INTO visit_salt (day, salt) VALUES (?, ?)').bind(day, fresh).run();
  const r = await DB.prepare('SELECT salt FROM visit_salt WHERE day = ?').bind(day).first();
  return (SALT[day] = r.salt);
}
async function hash(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function recordHit(env, request, d) {
  const url = new URL(request.url), host = url.hostname.toLowerCase();
  const ua = request.headers.get('user-agent') || '';
  if (!ua || BOT.test(ua) || /\.pages\.dev$/.test(host)) return;
  if (/CF_Authorization=/.test(request.headers.get('cookie') || '')) return; // Niki / editors logged in to the studio
  const cf = request.cf || {};
  if (cf.botManagement && cf.botManagement.verifiedBot) return;
  const pv = String(d.pv || '');
  if (!/^[a-z0-9]{6,16}$/.test(pv)) return;
  let path = String(d.p || '/').split(/[?#]/)[0].slice(0, 200) || '/';
  if (/^\/(admin|api)(\/|$)/.test(path)) return;
  const DB = await vdb(env);
  const now = Date.now(), lp = localParts(await tzOf(env), now);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  const vid = await hash((await saltFor(DB, lp.day)) + '|' + ip + '|' + ua);
  const { src, refhost } = sourceOf(d.r, d.u, host);
  await DB.prepare('INSERT OR IGNORE INTO visits (pv, ts, seen, day, hour, dow, site, vid, path, title, src, refhost, country, city, device) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(pv, now, now, lp.day, lp.hour, lp.dow, siteOf(host), vid, path, String(d.t || '').slice(0, 120), src, refhost.slice(0, 100),
      String(cf.country || '').slice(0, 2).toUpperCase(), String(cf.city || '').slice(0, 60), deviceOf(ua)).run();
  if (Math.random() < 0.01) {
    const old = localParts(await tzOf(env), now - 2 * 864e5).day;
    await DB.batch([
      DB.prepare('DELETE FROM visits WHERE ts < ?').bind(now - 400 * 864e5),
      DB.prepare('DELETE FROM visit_salt WHERE day < ?').bind(old),
    ]);
  }
}

export async function recordLeave(env, d) {
  const pv = String(d.pv || ''), s = Math.max(0, Math.min(3600, Math.round(+d.s || 0)));
  if (!/^[a-z0-9]{6,16}$/.test(pv)) return;
  const DB = await vdb(env), now = Date.now();
  await DB.prepare('UPDATE visits SET dur = MAX(COALESCE(dur, 0), ?), seen = ? WHERE pv = ? AND ts > ?').bind(s, now, pv, now - 6 * 3600e3).run();
}

/* ---------- numbers for the Visitors page ---------- */
const addDays = (day, n) => { const t = new Date(day + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export async function stats(env, { site, range }) {
  const DB = await vdb(env), tz = await tzOf(env), today = localParts(tz).day;
  const n = [1, 7, 30, 365].includes(range) ? range : 30;
  const from = addDays(today, -(n - 1)), pfrom = addDays(today, -(2 * n - 1)), pto = addDays(today, -n);
  const sw = site === 'fbn' || site === 'sit' ? ' AND site = ?' : '';
  const sb = sw ? [site] : [];
  const W = ' WHERE day >= ? AND day <= ?' + sw, B = [from, today, ...sb];
  const q = (sql, b = B) => DB.prepare(sql).bind(...b).all().then((r) => r.results || []);
  const one = (sql, b = B) => DB.prepare(sql).bind(...b).first();
  const VIS = 'COUNT(DISTINCT day || vid)';
  const [tot, prev, cdays, countries, cities, sources, pages, devices, hours, dows, now] = await Promise.all([
    one(`SELECT ${VIS} v, COUNT(*) n, SUM(MIN(COALESCE(dur,0), 1800)) d FROM visits${W}`),
    one(`SELECT ${VIS} v, COUNT(*) n FROM visits${W}`, [pfrom, pto, ...sb]),
    q(`SELECT day, COUNT(DISTINCT vid) v, COUNT(*) n FROM visits WHERE day >= ? AND day <= ?${sw} GROUP BY day`, [n === 1 ? addDays(today, -13) : from, today, ...sb]),
    q(`SELECT country c, ${VIS} v FROM visits${W} GROUP BY country ORDER BY v DESC LIMIT 8`),
    q(`SELECT city, country c, ${VIS} v FROM visits${W} AND city != '' GROUP BY city, country ORDER BY v DESC LIMIT 6`),
    q(`SELECT src, ${VIS} v FROM visits${W} AND src != 'internal' GROUP BY src ORDER BY v DESC LIMIT 7`),
    q(`SELECT site, path, MAX(title) t, COUNT(*) n FROM visits${W} GROUP BY site, path ORDER BY n DESC LIMIT 8`),
    q(`SELECT device d, ${VIS} v FROM visits${W} GROUP BY device ORDER BY v DESC`),
    q(`SELECT hour h, COUNT(*) n FROM visits${W} GROUP BY hour`),
    q(`SELECT dow, COUNT(*) n FROM visits${W} GROUP BY dow`),
    one(`SELECT COUNT(DISTINCT vid) v FROM visits WHERE COALESCE(seen, ts) > ?${sw}`, [Date.now() - 5 * 60e3, ...sb]),
  ]);
  // every day in the chart, also the quiet ones
  const byDay = Object.fromEntries(cdays.map((r) => [r.day, r]));
  const start = n === 1 ? addDays(today, -13) : from, series = [];
  for (let d = start; d <= today; d = addDays(d, 1)) series.push({ day: d, v: byDay[d] ? byDay[d].v : 0, n: byDay[d] ? byDay[d].n : 0 });
  return {
    today, from, range: n, site: sw ? site : 'all', tz,
    visitors: tot ? tot.v : 0, views: tot ? tot.n : 0, seconds: tot && tot.d ? tot.d : 0,
    prev: { visitors: prev ? prev.v : 0, views: prev ? prev.n : 0 },
    now: now ? now.v : 0, series, countries, cities, sources, pages, devices, hours, dows,
  };
}
