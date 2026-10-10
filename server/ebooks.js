// Ebooks: private storage, personal download links, download records (evidence against chargebacks).
//
// - The PDF is uploaded in the editor (Shop & lists → Books → Ebook file) and stored in the D1 database ("DB"),
//   split into parts of 1.8 MB. It is never a public file. books.json only keeps a reference: "ebook:<id>/<file name>".
// - After a paid order, each ebook gets a personal link /api/ebook/<token>. The token is signed (HMAC) with
//   DOWNLOAD_SECRET (optional) or STRIPE_WEBHOOK_SECRET, belongs to one Stripe order and one book, and expires LINK_DAYS after purchase.
// - Before a file is sent, Stripe is asked again: still paid? not refunded? no chargeback? Then the download is recorded
//   (time, email, internet address, country, device) in ebook_downloads.
import { db } from './util.js';
import * as shop from './shop.js';

export const LINK_DAYS = 30;
export const MAX_DOWNLOADS = 10; // per book per order
export const PART = 1800000;
export const MAX_SIZE = 40e6;

let ready = false;
export async function edb(env) {
  const DB = await db(env);
  if (!ready) {
    await DB.batch([
      DB.prepare('CREATE TABLE IF NOT EXISTS ebook_files (id TEXT PRIMARY KEY, name TEXT, type TEXT, size INTEGER, parts INTEGER, by_user TEXT, created_at TEXT NOT NULL)'),
      DB.prepare('CREATE TABLE IF NOT EXISTS ebook_parts (file_id TEXT NOT NULL, n INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (file_id, n))'),
      DB.prepare('CREATE TABLE IF NOT EXISTS ebook_orders (session_id TEXT PRIMARY KEY, payment_intent TEXT, email TEXT, name TEXT, total TEXT, items TEXT, terms_at TEXT, terms_ip TEXT, created_at TEXT NOT NULL)'),
      DB.prepare('CREATE TABLE IF NOT EXISTS ebook_downloads (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, book TEXT, email TEXT, ip TEXT, country TEXT, ua TEXT, at TEXT NOT NULL)'),
      DB.prepare('CREATE INDEX IF NOT EXISTS ebook_downloads_session ON ebook_downloads (session_id)'),
      DB.prepare('CREATE INDEX IF NOT EXISTS ebook_orders_pi ON ebook_orders (payment_intent)'),
    ]);
    ready = true;
  }
  return DB;
}

/* ---------- file reference in books.json ---------- */
export const fileRef = (v) => { const m = String(v || '').match(/^ebook:([a-f0-9]{32})(?:\/(.*))?$/); return m ? { id: m[1], name: m[2] || '' } : null; };

/* ---------- signed links ---------- */
const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const secretOf = (env) => env.DOWNLOAD_SECRET || env.STRIPE_WEBHOOK_SECRET || '';
async function hmac(env, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode('ebook-links:' + secretOf(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)))).slice(0, 32);
}
// one link per order + book format. `created` = Stripe session.created (seconds)
export async function makeToken(env, sessionId, bookId, idx, created) {
  if (!secretOf(env)) throw new Error('Download links need STRIPE_WEBHOOK_SECRET (or DOWNLOAD_SECRET).');
  const body = b64u(enc.encode(JSON.stringify({ s: sessionId, b: bookId, i: idx, e: Number(created) + LINK_DAYS * 86400 })));
  return body + '.' + (await hmac(env, body));
}
export async function readToken(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !secretOf(env)) return null;
  const want = await hmac(env, body);
  if (want.length !== sig.length || [...want].reduce((a, c, i) => a | (c.charCodeAt(0) ^ sig.charCodeAt(i)), 0) !== 0) return null;
  try { const t = JSON.parse(new TextDecoder().decode(fromB64u(body))); return t && t.s && t.b ? t : null; } catch (e) { return null; }
}
export const linkFor = async (env, origin, sessionId, bookId, idx, created) => origin + '/api/ebook/' + (await makeToken(env, sessionId, bookId, idx, created));

/* ---------- which ebooks an order contains ---------- */
export function ebooksInOrder(meta) {
  meta = meta || {};
  const encd = Object.keys(meta).filter((k) => /^items\d*$/.test(k)).sort((a, b) => (parseInt(a.slice(5), 10) || 0) - (parseInt(b.slice(5), 10) || 0)).map((k) => meta[k]).join('');
  const out = [];
  for (const l of shop.decodeLines(encd)) {
    if (l.kind !== 'book') continue;
    const b = shop.bookById(l.id); const f = b && (b.formats || []).filter((x) => shop.num(x.price) != null)[l.idx];
    if (b && f && f.digital) out.push({ id: l.id, idx: l.idx, title: b.title, format: f.name, file: f.file || '', ref: fileRef(f.file) });
  }
  return out;
}
export function formatOf(bookId, idx) {
  const b = shop.bookById(bookId); const f = b && (b.formats || []).filter((x) => shop.num(x.price) != null)[idx];
  return b && f && f.digital ? { title: b.title, format: f.name, file: f.file || '', ref: fileRef(f.file) } : null;
}

/* ---------- Stripe: is this order still paid, not refunded, no chargeback? ---------- */
export async function orderStatus(env, sessionId) {
  if (!env.STRIPE_SECRET_KEY) return { ok: false, why: 'setup' };
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId) + '?expand[]=payment_intent.latest_charge', { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
  if (r.status === 404) return { ok: false, why: 'unknown' };
  if (!r.ok) return { ok: false, why: 'stripe' };
  const s = await r.json();
  if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return { ok: false, why: 'unpaid', session: s };
  const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
  const ch = pi && pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  if (ch && ch.disputed) return { ok: false, why: 'disputed', session: s };
  if (ch && (ch.refunded || ch.amount_refunded >= ch.amount)) return { ok: false, why: 'refunded', session: s };
  return { ok: true, session: s };
}

/* ---------- reading a stored file part by part ---------- */
export async function fileInfo(env, id) {
  return (await edb(env)).prepare('SELECT id, name, type, size, parts FROM ebook_files WHERE id = ?').bind(id).first();
}
export function fileStream(env, info) {
  let n = 0;
  return new ReadableStream({
    async pull(ctrl) {
      if (n >= info.parts) { ctrl.close(); return; }
      const row = await (await edb(env)).prepare('SELECT data FROM ebook_parts WHERE file_id = ? AND n = ?').bind(info.id, n).first();
      n++;
      if (!row) { ctrl.error(new Error('missing part')); return; }
      ctrl.enqueue(row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : new Uint8Array(row.data));
    },
  });
}

/* ---------- records ---------- */
export async function saveOrder(env, o) {
  await (await edb(env)).prepare('INSERT OR REPLACE INTO ebook_orders (session_id, payment_intent, email, name, total, items, terms_at, terms_ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(o.session_id, o.payment_intent || '', o.email || '', o.name || '', o.total || '', JSON.stringify(o.items || []), o.terms_at || '', o.terms_ip || '', o.created_at || new Date().toISOString()).run();
}
export async function downloads(env, sessionId) {
  const r = await (await edb(env)).prepare('SELECT * FROM ebook_downloads WHERE session_id = ? ORDER BY at').bind(sessionId).all();
  return r.results || [];
}
export async function logDownload(env, request, sessionId, book, email) {
  const cf = request.cf || {};
  await (await edb(env)).prepare('INSERT INTO ebook_downloads (id, session_id, book, email, ip, country, ua, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), sessionId, book, email || '', request.headers.get('cf-connecting-ip') || '', [cf.city, cf.region, cf.country].filter(Boolean).join(', '),
      String(request.headers.get('user-agent') || '').slice(0, 300), new Date().toISOString()).run();
}
export const fmtTime = (iso) => iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' (Eastern)' : '';
