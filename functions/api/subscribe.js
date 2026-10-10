// Newsletter sign-up (the "Newsletter sign-up" section and the Home page "Join the Movement" box post here).
// Saves the person in the subscriber list (/admin → Newsletter). No email is sent to them yet.
import { json } from '../../server/util.js';
import { addSubscriber, cleanEmail, validEmail } from '../../server/newsletter.js';

export async function onRequestPost({ request, env }) {
  const ajax = request.headers.get('x-ajax') === '1';
  const done = (status, body) => ajax ? json(status, body)
    : status === 200 ? Response.redirect(new URL('/thanks/', request.url).toString(), 303)
    : new Response(body.error + ' Please go back and try again.', { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  let fd;
  try { fd = await request.formData(); } catch (e) { return done(400, { error: 'Something went wrong.' }); }
  if (fd.get('company')) return done(200, { ok: true }); // spam bot filled the hidden field

  const email = cleanEmail(fd.get('email'));
  if (!validEmail(email)) return done(400, { error: 'Please enter a valid email address, like name@example.com.' });
  const first = String(fd.get('first_name') || '').trim().slice(0, 80);
  const last = String(fd.get('last_name') || '').trim().slice(0, 80);
  if (fd.get('need_name') && (!first || !last)) return done(400, { error: 'Please enter your first and last name.' });
  const interests = fd.getAll('interests').map(String);
  let source = String(fd.get('page') || request.headers.get('referer') || '');
  try { source = new URL(source).pathname; } catch (e) { /* keep as is */ }

  try {
    const r = await addSubscriber(env, { email, first, last, interests, source });
    return done(200, { ok: true, again: r.again });
  } catch (e) {
    console.log('subscribe failed', e.message);
    return done(500, { error: 'We could not save your sign-up right now.' });
  }
}
