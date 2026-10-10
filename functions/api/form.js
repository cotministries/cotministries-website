// Every form on the website posts here (replaces Netlify Forms).
// Saves the entry in the Messages inbox (D1) and emails the right brand's address (Resend).
import { saveMessage, esc, json } from '../../server/util.js';
import { savePhotos } from '../../server/photos.js';
import { brandFor, sender, send } from '../../server/brands.js';
import { getSchedule, busyTimes, nowIn, slotProblem, adb } from '../../server/schedule.js';
import { check } from '../../server/spam.js';

const FORMS = ['booking', 'wedding', 'prayer', 'speaking', 'contact', 'newsletter', 'rsvp', 'detox'];
// Forms that can be paid right away by card (Stripe): the browser gets { pay } back and opens /api/checkout.
const PAYABLE = { detox: 'detox', booking: 'session' };
// Wedding inquiry: every one of these must be filled in (the page also marks them required).
const WEDDING_REQUIRED = ['name', 'email', 'phone', 'wedding_date', 'start_time', 'venue_name', 'venue_location', 'bridal_party_size', 'makeup_services', 'hair_services', 'budget', 'heard_about'];
const LABEL = { detox: 'Monthly Spiritual Detox registration', booking: '1:1 session request', wedding: 'wedding inquiry', prayer: 'prayer request', speaking: 'speaking invitation', contact: 'message', newsletter: 'email sign-up', rsvp: 'RSVP' };
const SKIP = ['form-name', 'company', '_e', '_spam'];
const fmt = (m) => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };

export async function onRequestPost({ request, env, waitUntil }) {
  // The booking steps and the "Message Niki" chat send with fetch (header x-ajax: 1) and get JSON back.
  const ajax = request.headers.get('x-ajax') === '1';
  const back = (path, error) => ajax
    ? json(error ? 409 : 200, error ? { error } : { ok: true, redirect: path })
    : Response.redirect(new URL(error ? path + (path.includes('?') ? '&' : '?') + 'taken=' + encodeURIComponent(error) + '#booking' : path, request.url).toString(), 303);
  let fd;
  try { fd = await request.formData(); } catch (e) { return back('/thanks/'); }
  const form = String(fd.get('form-name') || '');
  if (!FORMS.includes(form)) return new Response('Unknown form', { status: 400 });
  if (fd.get('company')) return back('/thanks/'); // spam bot filled the hidden field

  const d = {};
  for (const [k, v] of fd.entries()) {
    if (SKIP.includes(k) || typeof v !== 'string') continue;
    const val = v.trim().slice(0, 5000);
    if (!val) continue;
    d[k] = d[k] ? d[k] + ', ' + val : val; // checkboxes with the same name
  }
  if (!d.name && (d.first_name || d.last_name)) d.name = [d.first_name, d.last_name].filter(Boolean).join(' ');
  // "How did you hear about us?" -> Other: <what they typed>
  if (d.heard_about_other) { if (/^other/i.test(d.heard_about || '')) d.heard_about = 'Other: ' + d.heard_about_other; delete d.heard_about_other; }
  if (Object.keys(d).length > 40) return new Response('Too many fields', { status: 400 });
  // Spam protection (server/spam.js): bots are dropped quietly, sales messages go to the Spam folder without an email.
  try {
    const v = await check(env, request, form, d, fd.get('_e'));
    if (v.drop) { console.log('form dropped:', form, v.drop); return back('/thanks/'); }
    if (v.spam) d._spam = v.spam;
  } catch (e) { console.log('spam check failed', e.message); }
  if (form === 'wedding') {
    const missing = WEDDING_REQUIRED.filter((k) => d[k] == null || d[k] === '');
    if (missing.length) return ajax ? json(400, { error: 'Please fill in: ' + missing.join(', ').replace(/_/g, ' ') }) : new Response('Please go back and fill in: ' + missing.join(', ').replace(/_/g, ' '), { status: 400 });
  }

  // Inspiration photos (booking): resized in the browser, max 6, max 3 MB each.
  const photos = fd.getAll('photos').filter((f) => f && typeof f !== 'string' && /^image\//.test(f.type) && f.size > 0 && f.size <= 3e6).slice(0, 6);
  if (photos.length) d.photos = photos.length + ' inspiration photo' + (photos.length > 1 ? 's' : '') + ' (see Messages inbox or the attachments)';

  // Booking with a chosen time: check it is still free, then hold it.
  let slot = null;
  if (form === 'booking' && d.slot_date) {
    slot = { date: d.slot_date, start: Math.round(Number(d.slot_start)), len: Math.round(Number(d.slot_minutes)) };
    const s = await getSchedule(env);
    const now = nowIn(s.tz);
    const problem = slotProblem(s, await busyTimes(env, s, now.date), now, slot.date, slot.start, slot.len);
    if (problem) return back('/one-on-one/', problem);
    const [y, m, dd] = slot.date.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    d.appointment = `${day}, ${fmt(slot.start)} – ${fmt(slot.start + slot.len)}`;
  }
  for (const k of ['slot_date', 'slot_start', 'slot_minutes']) delete d[k];

  let saved = null;
  try { saved = await saveMessage(env, form, d); } catch (e) { console.log('save failed', e.message); }
  let files = [];
  if (photos.length && saved) { try { files = await savePhotos(env, saved.id, photos); } catch (e) { console.log('photo save failed', e.message); } }
  if (slot && saved) {
    try {
      const DB = await adb(env);
      await DB.prepare('INSERT INTO appointments (id, message_id, date, start, end, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), saved.id, slot.date, slot.start, slot.start + slot.len, 'requested', new Date().toISOString()).run();
    } catch (e) { console.log('appointment save failed', e.message); }
  }

  const snd = sender(env, brandFor(form, d), form);
  if (snd.notify && !d._spam) {
    const rows = Object.entries(d).filter(([k]) => k !== 'message')
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#7a5547;vertical-align:top">${esc(k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()))}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('');
    const what = LABEL[form] || form;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#2b0e04;max-width:600px">
<p>New <b>${esc(what)}</b> on the website${d.name ? ` from <b>${esc(d.name)}</b>` : ''}.</p><table style="border-collapse:collapse">${rows}</table>
${d.message ? `<p style="white-space:pre-wrap;background:#faf5f0;border-left:3px solid #9b1313;padding:12px 14px">${esc(d.message)}</p>` : ''}
<p style="color:#7a5547;font-size:13px">Reply to this email to answer ${esc(d.name || 'them')} directly, or reply from the Messages inbox on the website (/admin).</p></div>`;
    waitUntil(send(Object.assign({}, snd, { replyTo: d.email || snd.replyTo }), { to: [snd.notify], attachments: files.length ? files.map((f) => ({ filename: f.name, content: f.b64 })) : undefined, subject: `New ${what}${d.name ? ' from ' + d.name : ''} · ${snd.brand.name}`, html })
      .then((r) => { if (!r.ok) console.log('notify failed', r.error); }));
  }
  // Paying: by card → the browser opens Stripe; another way → the page with how to send the money.
  const pay = String(d.payment || '');
  if (PAYABLE[form] && pay) {
    if (/card/i.test(pay)) { if (ajax) return json(200, { ok: true, pay: { kind: PAYABLE[form], ref: saved ? saved.id : '', name: d.name || '', email: d.email || '' } }); }
    else return back('/pay/?for=' + PAYABLE[form] + '&m=' + encodeURIComponent(pay));
  }
  return back('/thanks/');
}
