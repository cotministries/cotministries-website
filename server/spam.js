// Spam protection for the website forms (functions/api/form.js) and the Spam folder in Messages.
// 1. Bot checks: too fast, sent from another website, too many in an hour  -> dropped quietly (the sender still sees "Thank you").
// 2. Sales/spam score for contact, speaking and prayer messages            -> saved with "_spam" (Spam folder), no email to Niki.
//    Bookings, wedding inquiries, RSVPs and orders are never put in Spam.
// Niki's "Spam" / "Not spam" buttons in Messages teach it which senders to block or always let through (D1 kv: spam_block, spam_allow).
import { db } from './util.js';

export const SCORED_FORMS = ['contact', 'speaking', 'prayer'];
const OUR_HOSTS = /(^|\.)(cotministries\.com|pages\.dev|localhost|127\.0\.0\.1)$/i;
const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|gmx|web|mail|zoho|yandex|comcast|att|sbcglobal|verizon|bellsouth|cox|charter)\./i;
const MIN_MS = 3000;                 // a real person needs at least 3 seconds to fill in a form
const PER_HOUR_DEVICE = 6, PER_HOUR_EMAIL = 4;

// [pattern, points]. 4 points or more = Spam folder.
const SIGNS = [
  [/\bseo\b|search engine optimi[sz]/i, 3], [/back-?links?/i, 3], [/organic (traffic|growth|reach)/i, 3],
  [/(search|google|serp) (rank|ranking|position)s?|rank(ing)? (higher|on google|#?1)|first page (of|on) google|page one of google/i, 3],
  [/\b(crypto|bitcoin|forex|casino|betting|cbd|viagra|cialis|loan offer|business (loan|funding)|merchant cash)\b/i, 4],
  [/guest post|link (building|exchange|insertion)|sponsored (post|article)/i, 3],
  [/(web(site)?|app|mobile app|software) (design|redesign|development|developer)s?\b|wordpress (expert|developer)|shopify (expert|store)/i, 2],
  [/digital marketing|marketing (agency|services|strategy|strategies)|lead generation|more (leads|customers|clients|sales)|social media (management|marketing|growth)/i, 2],
  [/\b(your|ur) (website|site|business|company|online presence|google (business|profile|listing))\b/i, 1],
  [/i (found|came across|visited|checked) your (website|site|business|page|profile)|found your business online/i, 2],
  [/(increase|boost|improve|grow|skyrocket|double) your (traffic|rankings?|sales|revenue|visibility|followers|leads|business)/i, 2],
  [/virtual assistant|outsourc|white[- ]label|offshore|freelancer|fiverr|upwork/i, 2],
  [/ai (chat ?bot|agent|automation|receptionist|voice)|chatbot|automation (tool|service)s?/i, 2],
  [/free (audit|analysis|report|consultation|trial|quote)|no obligation|limited (time|offer)|special (offer|discount|price)/i, 2],
  [/(send|share) (me|us) your (target |main )?(keywords|budget|requirements)|target keywords|reply (with|"?yes)|let me know if (you are|you're) interested|are you (interested|open to)/i, 2],
  [/\bproposal\b|\bpricing (plan|list|package)s?\b|\bportfolio\b|case stud(y|ies)/i, 1],
  [/unsubscribe|opt[- ]out|to stop (receiving|these)/i, 2],
  [/(video editing|logo design|graphic design|ugc|influencer|content writ(ing|er)|copywrit(ing|er)|bookkeeping|accounting services|merchant services)/i, 2],
];
const COMPANY_NAME = /\b(seo|ai|digital|marketing|media|agency|tech|solutions|rank|growth|leads?|web|studio|labs|consult(ing|ant)|services|global|ltd|llc|inc)\b/i;
const COMPANY_DOMAIN = /(seo|digital|marketing|rank|growth|leads?|web|tech|agency|solutions|media|consult|traffic|boost|outreach)/i;

const domainOf = (email) => String(email || '').toLowerCase().split('@')[1] || '';

/** Score a message. Returns { score, reasons[] }. */
export function spamScore(d, extra) {
  const text = [d.message, d.topic, d.organization, d.event, d.subject].filter(Boolean).join('\n');
  const reasons = [];
  let score = 0;
  const add = (n, why) => { score += n; reasons.push(why); };
  for (const [re, n] of SIGNS) { const m = text.match(re); if (m) add(n, '“' + m[0].trim().slice(0, 40) + '”'); }
  // "Hello https://sowedintears.com/," – the website address used as a greeting (copy-paste sending programs)
  if (/^\s*(hello|hi|hey|dear|greetings|good (morning|afternoon|day))?[\s,]*(https?:\/\/|www\.)\S+/i.test(String(d.message || ''))) add(4, 'website address used as greeting');
  else if (/^\s*(hello|hi|hey|dear)\s+(team|there|sir|madam|owner|business owner|website owner|admin)\b/i.test(String(d.message || ''))) add(1, 'generic greeting');
  const links = (text.match(/https?:\/\/|www\./gi) || []).length;
  if (links >= 3) add(3, links + ' links'); else if (links >= 1) add(1, 'contains a link');
  if (COMPANY_NAME.test(String(d.name || ''))) add(2, 'company-style name');
  const dom = domainOf(d.email);
  if (dom && !FREE_MAIL.test(dom) && COMPANY_DOMAIN.test(dom)) add(2, 'sales-style email domain');
  if (extra && extra.noTimer) add(1, 'sent without the page script');
  if (extra && extra.noOrigin) add(1, 'no website origin');
  return { score, reasons };
}

/* ---------- block / allow lists (Niki's Spam / Not spam buttons) ---------- */
async function getList(DB, k) { try { const r = await DB.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v || '[]') : []; } catch (e) { return []; } }
async function putList(DB, k, arr) { await DB.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, JSON.stringify(arr.slice(-2000))).run(); }
const keysFor = (email) => { const e = String(email || '').trim().toLowerCase(); const dom = domainOf(e); return { e, dom: dom && !FREE_MAIL.test(dom) ? '@' + dom : '' }; };

/** Spam button: block this sender (and their company domain, never gmail/yahoo/…). Not spam: let them through from now on. */
export async function learn(env, email, isSpam) {
  const { e, dom } = keysFor(email);
  if (!e) return;
  const DB = await db(env);
  let block = await getList(DB, 'spam_block'), allow = await getList(DB, 'spam_allow');
  if (isSpam) {
    block = block.filter((x) => x !== e && x !== dom).concat([e], dom ? [dom] : []);
    allow = allow.filter((x) => x !== e);
  } else {
    block = block.filter((x) => x !== e && x !== dom);
    if (!allow.includes(e)) allow.push(e);
  }
  await putList(DB, 'spam_block', block); await putList(DB, 'spam_allow', allow);
}

/* ---------- bot checks ---------- */
let hitsReady = false;
async function hitsDb(env) {
  const DB = await db(env);
  if (!hitsReady) {
    await DB.batch([
      DB.prepare('CREATE TABLE IF NOT EXISTS form_hits (k TEXT NOT NULL, at INTEGER NOT NULL)'),
      DB.prepare('CREATE INDEX IF NOT EXISTS form_hits_k ON form_hits (k, at)'),
    ]);
    hitsReady = true;
  }
  return DB;
}
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join(''); }

/**
 * Decide what happens to a form entry.
 * Returns { drop: 'reason' } (thrown away quietly), or { spam: 'reasons' | '' } (saved; spam goes to the Spam folder without an email).
 */
export async function check(env, request, form, d, elapsed) {
  // 1a. sent from another website (a browser always says where a form comes from)
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  let host = '';
  try { host = origin ? new URL(origin).hostname : ''; } catch (e) { host = 'bad'; }
  if (host && !OUR_HOSTS.test(host)) return { drop: 'sent from ' + host };
  // 1b. filled in faster than a person can type (only checked when the page script measured it)
  const ms = elapsed === '' || elapsed == null ? null : Number(elapsed);
  if (ms != null && Number.isFinite(ms) && ms < MIN_MS) return { drop: 'filled in after ' + Math.round(ms) + ' ms' };
  // 1c. too many in one hour from the same device or the same email address
  try {
    const DB = await hitsDb(env), now = Date.now(), hour = now - 3600e3;
    const dev = 'd:' + await sha((request.headers.get('cf-connecting-ip') || '') + '|' + (request.headers.get('user-agent') || ''));
    const em = d.email ? 'e:' + await sha(String(d.email).trim().toLowerCase()) : '';
    const count = async (k) => ((await DB.prepare('SELECT COUNT(*) AS n FROM form_hits WHERE k = ? AND at > ?').bind(k, hour).first()) || {}).n || 0;
    if (await count(dev) >= PER_HOUR_DEVICE) return { drop: 'too many from one device' };
    if (em && await count(em) >= PER_HOUR_EMAIL) return { drop: 'too many from one email' };
    const ins = [DB.prepare('INSERT INTO form_hits (k, at) VALUES (?, ?)').bind(dev, now)];
    if (em) ins.push(DB.prepare('INSERT INTO form_hits (k, at) VALUES (?, ?)').bind(em, now));
    if (Math.random() < 0.05) ins.push(DB.prepare('DELETE FROM form_hits WHERE at < ?').bind(now - 86400e3));
    await DB.batch(ins);
  } catch (e) { console.log('rate check', e.message); }

  // 2. Spam folder (only contact, speaking, prayer)
  if (!SCORED_FORMS.includes(form)) return { spam: '' };
  const DB = await db(env);
  const { e, dom } = keysFor(d.email);
  if (e && (await getList(DB, 'spam_allow')).includes(e)) return { spam: '' };
  const block = await getList(DB, 'spam_block');
  if (e && (block.includes(e) || (dom && block.includes(dom)))) return { spam: 'sender marked as spam before' };
  const s = spamScore(d, { noTimer: ms == null, noOrigin: !host });
  return { spam: s.score >= 4 ? s.reasons.join(', ') : '' };
}

/** Spam older than 30 days is removed (called when Messages is opened). */
export async function cleanOldSpam(env) {
  try {
    const DB = await db(env);
    await DB.prepare("DELETE FROM messages WHERE json_extract(data, '$._spam') IS NOT NULL AND created_at < ?").bind(new Date(Date.now() - 30 * 86400e3).toISOString()).run();
  } catch (e) { console.log('spam cleanup', e.message); }
}
