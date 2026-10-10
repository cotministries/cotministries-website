// Send a reply to a website message by email (Resend), for logged-in editors only.
// Sends from the brand the message belongs to (see server/brands.js).
import { json, esc, editor, db, getMessage, newId } from '../../server/util.js';
import { brandFor, sender, send } from '../../server/brands.js';
import { mailHtml, textToHtml } from '../../server/mail-layout.js';

export async function onRequestPost({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const text = String(body.message || '').trim();
  if (!body.id || !text) return json(400, { error: 'Write a reply first.' });
  if (text.length > 10000) return json(400, { error: 'Reply is too long.' });

  // Look up the original message on the server, so the recipient can't be changed from the browser.
  let orig;
  try { orig = await getMessage(env, body.id); } catch (e) { return json(500, { error: e.message }); }
  if (!orig || !orig.data.email) return json(404, { error: 'Message not found.' });
  const to = orig.data.email, name = orig.data.name || '';
  const snd = sender(env, brandFor(orig.form, orig.data), orig.form);
  const subject = `Re: your message to ${snd.brand.name}`;
  const quoted = `On ${new Date(orig.created_at).toUTCString()}, ${name || to} wrote:\n> ` + String(orig.data.message || '').replace(/\n/g, '\n> ');
  // same look as the newsletter (server/mail-layout.js)
  const html = mailHtml({ subject, origin: new URL(request.url).origin, brand: snd.brand, preheader: text.slice(0, 120), body: textToHtml(text),
    quoted: orig.data.message ? `<b>${esc(name || to)} wrote on ${esc(new Date(orig.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}:</b><br>${esc(String(orig.data.message)).replace(/\n/g, '<br>')}` : '' });

  const sent = await send(snd, { to: [to], subject, text: text + '\n\n---\n' + quoted, html });
  if (!sent.ok) return json(424, { error: 'Email was not sent: ' + sent.error });

  const at = new Date().toISOString();
  try {
    const DB = await db(env);
    await DB.prepare('INSERT INTO replies (id, message_id, created_at, by_user, to_email, text) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(), orig.id, at, user.email, to, text).run();
  } catch (e) { /* email already sent; history is optional */ }
  return json(200, { ok: true, id: sent.id, to, from: snd.from, date: at, by: user.email });
}
