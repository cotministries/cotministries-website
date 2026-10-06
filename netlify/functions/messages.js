// Messages inbox for logged-in editors (Netlify Identity).
// Needs env var NETLIFY_API_TOKEN (a Netlify personal access token, marked secret).
const API = 'https://api.netlify.com/api/v1';
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: 'Please log in.' });
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) return json(500, { error: 'NETLIFY_API_TOKEN is not set in Netlify environment variables.' });
  const site = process.env.SITE_ID || (event.headers.host || '').split(':')[0];
  const call = async (path, method) => {
    const r = await fetch(API + path, { method: method || 'GET', headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok && r.status !== 204) throw new Error('Netlify API ' + r.status);
    return r.status === 204 ? null : r.json();
  };
  try {
    const list = await call(`/sites/${encodeURIComponent(site)}/submissions?per_page=100`);
    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id || !list.some((s) => s.id === id)) return json(404, { error: 'Message not found.' });
      await call(`/submissions/${encodeURIComponent(id)}`, 'DELETE');
      return json(200, { ok: true });
    }
    return json(200, list.map((s) => ({
      id: s.id, form: s.form_name, date: s.created_at,
      name: s.data && s.data.name, email: s.data && s.data.email, message: s.data && s.data.message,
    })));
  } catch (e) {
    return json(502, { error: e.message });
  }
};
