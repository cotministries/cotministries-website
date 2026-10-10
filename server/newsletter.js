// Newsletter: subscribers live in the same D1 database as the Messages inbox (binding "DB").
// Sign-ups come from /api/subscribe, letters go out from /admin/newsletter.html through /api/newsletter (Resend),
// and every letter carries a personal one-click unsubscribe link (/api/unsubscribe?t=...).
// Letters are built from blocks (text, pictures, scripture, buttons…) like blog posts; blog posts can be sent as letters too.
import { db, esc } from './util.js';
import { sender, addr } from './brands.js';
import settings from '../content/settings.json';

let ready = false;
export async function ndb(env) {
  const DB = await db(env);
  if (!ready) {
    await DB.batch([
      DB.prepare(`CREATE TABLE IF NOT EXISTS subscribers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, first_name TEXT, last_name TEXT,
        interests TEXT, source TEXT, status TEXT NOT NULL DEFAULT 'active', token TEXT NOT NULL, created_at TEXT NOT NULL, unsub_at TEXT)`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS newsletter_sends (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, by_user TEXT, subject TEXT,
        audience TEXT, sender TEXT, sent INTEGER, failed INTEGER, error TEXT)`),
    ]);
    ready = true;
  }
  return DB;
}

export const cleanEmail = (e) => String(e || '').trim().toLowerCase().slice(0, 200);
export const validEmail = (e) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e);
const token = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
export const splitInterests = (v) => String(v || '').split('|').map((x) => x.trim()).filter(Boolean);
export const BRANDS = ['ministry', 'beauty', 'main'];

// Add someone, or bring back / update someone who is already on the list.
export async function addSubscriber(env, { email, first, last, interests, source }) {
  const DB = await ndb(env);
  const now = new Date().toISOString();
  const old = await DB.prepare('SELECT * FROM subscribers WHERE email = ?').bind(email).first();
  const ints = (interests || []).map((x) => String(x).replace(/\|/g, ' ').trim().slice(0, 60)).filter(Boolean).slice(0, 10);
  if (old) {
    const merged = [...new Set(splitInterests(old.interests).concat(ints))];
    await DB.prepare('UPDATE subscribers SET first_name = ?, last_name = ?, interests = ?, status = ?, unsub_at = NULL WHERE id = ?')
      .bind(first || old.first_name || '', last || old.last_name || '', merged.join('|'), 'active', old.id).run();
    return { id: old.id, again: true };
  }
  const id = crypto.randomUUID();
  await DB.prepare('INSERT INTO subscribers (id, email, first_name, last_name, interests, source, status, token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, email, first || '', last || '', ints.join('|'), String(source || '').slice(0, 200), 'active', token(), now).run();
  return { id, again: false };
}

// Letters go out from newsletter@<brand's domain> (or Settings → Brands → "Newsletter sends from"); replies go to the brand's normal address.
// Resend: that domain must be verified in the Resend account of the key used (MINISTRY_RESEND_API_KEY for sowedintears.com, else RESEND_API_KEY).
export function nlSender(env, id) {
  const s = sender(env, id, 'newsletter');
  const own = addr(s.replyTo || s.from);
  const dom = own.split('@')[1] || '';
  const set = ((settings.brands || {})[id] || {}).newsletterEmail;
  const nl = addr(set) || (dom ? 'newsletter@' + dom : own);
  return Object.assign({}, s, { from: `${String(s.brand.name).replace(/["<>]/g, '')} <${nl}>`, replyTo: own });
}
export function senders(env) {
  const seen = new Set();
  return BRANDS.map((id) => { const s = nlSender(env, id); return { id, name: s.brand.name, from: s.from, replyTo: s.replyTo, ready: !!s.key }; })
    .filter((s) => s.from && !seen.has(s.from) && seen.add(s.from));
}

/* ---------- blocks -> email-safe HTML (tables + inline styles; pictures need full web addresses) ---------- */
const C = { ink: '#14254a', muted: '#5a6680', ruby: '#0F2A5E', blush: '#f5efe2', gold: '#c9a23a', line: '#e6dcc4' };
const abs = (u, origin) => { u = String(u || '').trim(); if (/^https?:\/\//i.test(u)) return u; if (u.startsWith('/')) return origin + u; return ''; };
const firstOf = (s) => (s && s.first_name) || 'friend';
export const personal = (text, s) => String(text || '').replace(/\{\s*first\s*name\s*\}/gi, firstOf(s));
const inl = (t, origin) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
  .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (m, a, u) => `<a href="${abs(u, origin)}" style="color:${C.ruby}">${a}</a>`)
  .replace(/(^|[\s(>])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, `$1<a href="$2" style="color:${C.ruby}">$2</a>`);
const P = 'margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:' + C.ink;
// Links to Niki's own sites get "?utm_source=newsletter", so the Visitors page can show how many came from a letter.
export const tagLinks = (html) => html.replace(/href="(https?:\/\/(?:www\.)?(?:cotministries|cityoftestimonies)\.com[^"#]*)(#[^"]*)?"/g,
  (m, u, h) => (/utm_source=/.test(u) ? m : `href="${u}${u.includes('?') ? '&amp;' : '?'}utm_source=newsletter${h || ''}"`));
// text size chosen with A− / A+ in the block editor (b.fs, e.g. 1.3)
const F = (b, html) => { const v = Number(b && b.fs); return html && v >= 0.5 && v <= 2.5 && v !== 1 ? `<span style="font-size:${v}em">${html}</span>` : html; };
export function emailBlocks(blocks, origin, sub) {
  const W = 536; // inner width of the 600px letter
  let fl = false; // a picture with text beside it is open: only text may flow next to it
  const CLR = '<div style="clear:both;line-height:0;font-size:0">&nbsp;</div>';
  return (blocks || []).map((b) => {
    let pre = '';
    if (fl && b.type !== 'text') { pre = CLR; fl = false; }
    if (b.type === 'image' && b.src && (b.wrap === 'left' || b.wrap === 'right')) fl = true;
    return pre + oneBlock(b);
  }).join('') + CLR;
  function oneBlock(b) {
    switch (b.type) {
      case 'heading': return b.text ? `<h2 style="margin:8px 0 12px;font-family:'Bodoni Moda',Didot,Georgia,serif;font-weight:500;font-size:22px;line-height:1.25;color:${C.ink}">${F(b, esc(b.text))}</h2>` : '';
      case 'text': return b.text ? String(personal(b.text, sub)).trim().split(/\n\s*\n/).map((p) => `<p style="${P}">${F(b, inl(p, origin))}</p>`).join('') : '';
      case 'image': {
        const src = abs(b.src, origin); if (!src) return '';
        const cap = b.caption ? `<div style="font-family:Arial,sans-serif;font-size:13px;font-style:italic;color:${C.muted};text-align:center;padding-top:6px">${esc(b.caption)}</div>` : '';
        const link = abs(b.url, origin);
        const pic = (w) => { const i = `<img src="${esc(src)}" width="${w}" alt="${esc(b.alt || '')}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;border-radius:4px">`; return b.link && link ? `<a href="${esc(link)}">${i}</a>` : i; };
        if (b.wrap === 'left' || b.wrap === 'right') {
          // picture beside the text: a half-width table aligned left/right, the following text flows next to it
          const half = Math.round(W * 0.46);
          return `<table role="presentation" cellpadding="0" cellspacing="0" width="${half}" align="${b.wrap}" style="margin:4px ${b.wrap === 'left' ? '18px' : '0'} 10px ${b.wrap === 'right' ? '18px' : '0'}"><tr><td>${pic(half)}${cap}</td></tr></table>`;
        }
        const w = b.size === 'small' ? Math.round(W * 0.46) : b.size === 'medium' ? Math.round(W * 0.72) : W;
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td align="center">${pic(w)}${cap}</td></tr></table>`;
      }
      case 'pair': {
        const a = abs(b.a, origin), c = abs(b.b, origin); if (!a && !c) return '';
        const w = Math.floor((W - 10) / 2);
        const cell = (s, alt) => `<td width="${w}" valign="top">${s ? `<img src="${esc(s)}" width="${w}" alt="${esc(alt || '')}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;border-radius:4px">` : ''}</td>`;
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>${cell(a, b.altA)}<td width="10"></td>${cell(c, b.altB)}</tr>${b.caption ? `<tr><td colspan="3" style="font-family:Arial,sans-serif;font-size:13px;font-style:italic;color:${C.muted};text-align:center;padding-top:6px">${esc(b.caption)}</td></tr>` : ''}</table>`;
      }
      case 'quote': return b.text ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="background:${C.blush};border-left:3px solid ${C.gold};padding:16px 20px;font-family:'Bodoni Moda',Georgia,serif;font-style:italic;font-size:19px;line-height:1.45;color:${C.ink}">${F(b, esc(b.text))}${b.cite ? `<div style="margin-top:8px;font-family:Arial,sans-serif;font-style:normal;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.muted}">${esc(b.cite)}</div>` : ''}</td></tr></table>` : '';
      case 'button': case 'video': {
        const u = abs(b.url, origin); if (!u) return '';
        const label = b.type === 'video' ? '▶ ' + (b.label || 'Watch the video') : (b.label || 'Learn more') + ' →';
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px"><tr><td align="center"><a href="${esc(u)}" style="display:inline-block;background:${C.ruby};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;border-radius:3px">${F(b, esc(label))}</a></td></tr></table>`;
      }
      case 'divider': return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td align="center" style="color:${C.gold};font-size:18px;letter-spacing:10px">&#9670;&#9670;&#9670;</td></tr></table>`;
      default: return '';
    }
  }
}
export function blocksText(blocks, origin, sub) {
  return (blocks || []).map((b) => {
    if (b.type === 'heading') return String(b.text || '').toUpperCase();
    if (b.type === 'text') return personal(b.text, sub).replace(/\*\*(.+?)\*\*/g, '$1');
    if (b.type === 'quote') return b.text ? `"${b.text}"${b.cite ? ' – ' + b.cite : ''}` : '';
    if (b.type === 'button' || b.type === 'video') return b.url ? `${b.label || 'Link'}: ${abs(b.url, origin)}` : '';
    if (b.type === 'image' && b.caption) return `[Picture: ${b.caption}]`;
    if (b.type === 'divider') return '* * *';
    return '';
  }).filter(Boolean).join('\n\n');
}
// Old letters (plain text) still work: turn the text into blocks.
export const textToBlocks = (body) => [{ type: 'text', text: String(body || '') }];

export function letterHtml({ subject, content, siteName, siteUrl, unsubUrl, header, preheader }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:${C.blush};padding:24px 10px">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#faf5f0;border:2px solid ${C.gold}">
<tr><td style="padding:28px 32px 6px;font-family:'Alex Brush','Snell Roundhand',cursive;font-size:34px;line-height:1.1;color:${C.ruby}">${esc(header || 'Letters from City Of Testimonies')}</td></tr>
<tr><td style="padding:0 32px 8px;font-family:'Bodoni Moda',Didot,Georgia,serif;font-size:24px;line-height:1.25;color:${C.ink}">${esc(subject)}</td></tr>
<tr><td style="padding:12px 32px 8px">${content}</td></tr>
<tr><td style="padding:14px 32px 24px;border-top:1px solid ${C.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${C.muted}">
You're receiving this because you joined ${esc(siteName)}'s email list at <a href="${esc(siteUrl)}" style="color:${C.muted}">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a>.<br>
<a href="${esc(unsubUrl)}" style="color:${C.ruby}">Unsubscribe</a> at any time with one click.</td></tr>
</table></td></tr></table></body></html>`;
}

/* ---------- sending ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// opts: { brandId, subject, blocks, audience, origin, by, test, testTo, testName, preheader }
export async function sendLetter(env, opts) {
  const brandId = BRANDS.includes(opts.brandId) ? opts.brandId : 'ministry';
  const snd = nlSender(env, brandId);
  if (!snd.key || !snd.from) return { ok: false, status: 424, error: 'Email sending is not set up yet (Resend key missing in Cloudflare).' };
  const { subject, blocks, origin } = opts;
  const siteName = ((settings.logoTop ? settings.logoTop + ' ' : '') + (settings.name || '')).trim() || snd.brand.name;
  const mail = (s, to) => {
    const unsubUrl = `${origin}/api/unsubscribe?t=${s.token}`;
    return { from: snd.from, reply_to: snd.replyTo || undefined, to: [to], subject,
      html: letterHtml({ subject, content: tagLinks(emailBlocks(blocks, origin, s)), siteName, siteUrl: origin, unsubUrl, preheader: opts.preheader }),
      text: `${subject}\n\n${blocksText(blocks, origin, s)}\n\n---\nYou're receiving this because you joined ${siteName}'s email list.\nUnsubscribe: ${unsubUrl}\n`,
      headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
  };
  const post = async (path, payload) => {
    let r;
    try { r = await fetch('https://api.resend.com' + path, { method: 'POST', headers: { Authorization: 'Bearer ' + snd.key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
    catch (e) { return { ok: false, error: 'could not reach Resend (' + e.message + ')' }; }
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: (d.message || d.error || 'Resend ' + r.status) + ' (from ' + snd.from + ')' };
  };
  if (opts.test) {
    const to = cleanEmail(opts.testTo);
    if (!validEmail(to)) return { ok: false, status: 400, error: 'Enter the email address the test should go to.' };
    const r = await post('/emails', mail({ first_name: opts.testName || '', token: 'test-link-does-nothing' }, to));
    return r.ok ? { ok: true, sent: 1, to } : { ok: false, status: 424, error: 'Test was not sent: ' + r.error };
  }
  const DB = await ndb(env);
  const audience = String(opts.audience || 'All');
  const rows = ((await DB.prepare("SELECT * FROM subscribers WHERE status = 'active'").all()).results || [])
    .filter((s) => audience === 'All' || splitInterests(s.interests).includes(audience));
  if (!rows.length) return { ok: false, status: 400, error: 'Nobody on the list matches who you chose to send to.' };
  let sent = 0, error = '';
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const r = await post('/emails/batch', chunk.map((s) => mail(s, s.email)));
    if (r.ok) sent += chunk.length; else { error = r.error; if (!sent) break; }
    if (i + 100 < rows.length) await sleep(600);
  }
  const failed = rows.length - sent;
  await DB.prepare('INSERT INTO newsletter_sends (id, created_at, by_user, subject, audience, sender, sent, failed, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), new Date().toISOString(), opts.by || '', subject, audience, addr(snd.from), sent, failed, error).run();
  if (!sent) return { ok: false, status: 424, error: 'The letter was not sent: ' + error };
  return { ok: true, sent, failed, error };
}
