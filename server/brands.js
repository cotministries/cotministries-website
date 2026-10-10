// Which brand (and which email address / Gmail) each form, reply and order belongs to.
// Addresses and names live in Settings → "Brands & email" (editable); only the Resend keys are secret env vars:
//   RESEND_API_KEY            – Resend account for firebynik.com (beauty)
//   MINISTRY_RESEND_API_KEY   – Resend account for sowedintears.com (ministry)
//   MAIN_RESEND_API_KEY       – Resend account for nikole-wilson.com (general, optional)
// If a brand has no key yet, mail is sent from the beauty address with reply-to set to the brand's address.
import settings from '../content/settings.json';

const B = settings.brands || {};
export const addr = (s) => { const m = String(s || '').match(/<([^>]+)>/); return (m ? m[1] : String(s || '')).trim(); };
const fmt = (name, email) => (email ? (name ? `${name.replace(/["<>]/g, '')} <${email}>` : email) : '');
const KEY = { beauty: 'RESEND_API_KEY', ministry: 'MINISTRY_RESEND_API_KEY', main: 'MAIN_RESEND_API_KEY' };

export const brand = (env, id) => {
  const b = B[id] || {};
  return { id, name: b.name || settings.name || 'Website', email: b.email || '', bookingEmail: b.bookingEmail || '', key: env[KEY[id]] || '' };
};

// form name + data -> brand id
export function brandFor(form, data) {
  data = data || {};
  if (form === 'booking' || form === 'wedding') return 'beauty';
  if (form === 'prayer' || form === 'speaking') return 'ministry';
  if (form === 'contact') {
    const t = String(data.topic || '').toLowerCase();
    if (/beauty|bridal|hair|makeup|film|photo/.test(t)) return 'beauty';
    if (/ministry|prayer|speak|preach|church/.test(t)) return 'ministry';
    return 'main';
  }
  if (form === 'orders') { const items = String(data.items || '').split(';').map((x) => x.trim()).filter(Boolean); return items.length && items.every((x) => /ministry gift|partner gift/i.test(x)) ? 'ministry' : 'main'; }
  return 'main'; // newsletter, rsvp, anything else
}

// Who to send from / reply to / notify for a brand (and form).
export function sender(env, id, form) {
  let b = brand(env, id);
  const beauty = brand(env, 'beauty');
  if (!b.email) b = Object.assign({}, b, { email: beauty.email || addr(env.REPLY_FROM) });
  const own = (id === 'ministry' && form === 'speaking' && b.bookingEmail) ? b.bookingEmail : b.email;
  if (b.key) return { brand: b, key: b.key, from: fmt(b.name, own), replyTo: own, notify: own };
  // another brand's Resend account covers the same domain (e.g. general + ministry both on sowedintears.com)
  const dom = (e) => String(e || '').split('@')[1] || '';
  const twin = ['ministry', 'main', 'beauty'].map((x) => brand(env, x)).find((x) => x.key && x.email && dom(x.email) === dom(own));
  if (twin) return { brand: b, key: twin.key, from: fmt(b.name, own), replyTo: own, notify: own };
  // no Resend account for this brand yet: send through the beauty account, replies still go to the brand's address
  const fbFrom = env.REPLY_FROM || fmt(beauty.name, beauty.email);
  return { brand: b, key: env.RESEND_API_KEY || '', from: fmt(b.name, addr(fbFrom)), replyTo: own, notify: own };
}

export async function send(s, msg) {
  if (!s.key || !s.from) return { ok: false, error: 'Email sending is not set up (Resend key / address missing).' };
  let r;
  try {
    r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + s.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ from: s.from, reply_to: s.replyTo || undefined }, msg)) });
  } catch (e) { return { ok: false, error: 'could not reach Resend (' + e.message + ')' }; }
  const d = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: d.id } : { ok: false, error: (d.message || d.error || 'Resend ' + r.status) + ' (from ' + s.from + ')' };
}
