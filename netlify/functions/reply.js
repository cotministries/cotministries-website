// Send a reply to a contact-form message by email (Resend), for logged-in editors only.
// Env vars: RESEND_API_KEY (secret), REPLY_FROM, REPLY_TO, NETLIFY_API_TOKEN (secret).
const API = 'https://api.netlify.com/api/v1';
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: 'Please log in.' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  const { RESEND_API_KEY, REPLY_FROM, REPLY_TO, NETLIFY_API_TOKEN } = process.env;
  if (!RESEND_API_KEY || !REPLY_FROM) return json(500, { error: 'Email sending is not set up yet (RESEND_API_KEY / REPLY_FROM missing in Netlify).' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const text = String(body.message || '').trim();
  if (!body.id || !text) return json(400, { error: 'Write a reply first.' });
  if (text.length > 10000) return json(400, { error: 'Reply is too long.' });

  // Look up the original message on the server, so the recipient can't be changed from the browser.
  const host = (event.headers.host || '').split(':')[0];
  const site = process.env.SITE_ID || host;
  const r = await fetch(`${API}/sites/${encodeURIComponent(site)}/submissions?per_page=100`, { headers: { Authorization: 'Bearer ' + NETLIFY_API_TOKEN } });
  if (!r.ok) return json(502, { error: 'Could not load the message (Netlify ' + r.status + ').' });
  const orig = (await r.json()).find((s) => s.id === body.id);
  if (!orig || !orig.data || !orig.data.email) return json(404, { error: 'Message not found.' });
  const to = orig.data.email, name = orig.data.name || '';
  const siteName = (REPLY_FROM.match(/^\s*"?([^"<]+?)"?\s*</) || [])[1] || 'us';
  const subject = body.subject || `Re: your message to ${siteName}`;
  const quoted = `On ${new Date(orig.created_at).toUTCString()}, ${name || to} wrote:\n> ` + String(orig.data.message || '').replace(/\n/g, '\n> ');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1f">${esc(text).replace(/\n/g, '<br>')}</div>
<hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><div style="font-family:Arial,sans-serif;font-size:13px;color:#777">${esc(quoted).replace(/\n/g, '<br>')}</div>`;

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REPLY_FROM, to: [to], reply_to: REPLY_TO || undefined, subject, text: text + '\n\n---\n' + quoted, html }),
  });
  const sent = await send.json().catch(() => ({}));
  if (!send.ok) return json(502, { error: 'Email was not sent: ' + (sent.message || ('Resend ' + send.status)) });

  // Save a copy so every editor sees the reply history (stored as a hidden Netlify form entry).
  try {
    await fetch(`https://${host}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'form-name': 'reply-log', message_id: body.id, to, by: user.email || '', reply: text }).toString(),
    });
  } catch (e) { /* email already sent; history is optional */ }
  return json(200, { ok: true, id: sent.id, to, date: new Date().toISOString(), by: user.email || '' });
};
