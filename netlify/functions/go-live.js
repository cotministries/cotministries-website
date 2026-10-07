// "Put website live" button in /admin (logged-in editors only).
// GET  -> when the site last went live + saved changes that are not live yet
// POST -> publishes everything saved, in one deploy (via a build hook it creates automatically)
// Env vars: NETLIFY_API_TOKEN (secret). Optional BUILD_HOOK_URL to use your own build hook.
const API = 'https://api.netlify.com/api/v1';
const HOOK_TITLE = 'Put website live';
const BUSY = ['new', 'pending_review', 'enqueued', 'building', 'uploading', 'uploaded', 'preparing', 'prepared', 'processing', 'retrying'];
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const nice = (t) => String(t || '').replace(/\s*\[live\]\s*/gi, ' ').replace(/^Update (\w+) “?"?(.+?)"?”?$/, (m, c, n) => `Updated ${n}`).replace(/^Create (\w+) “?"?(.+?)"?”?$/, (m, c, n) => `Added ${n}`).replace(/^Delete (\w+) “?"?(.+?)"?”?$/, (m, c, n) => `Deleted ${n}`).trim() || 'Change';

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: 'Please log in.' });
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) return json(500, { error: 'NETLIFY_API_TOKEN is not set in Netlify environment variables.' });
  const site = process.env.SITE_ID || (event.headers.host || '').split(':')[0];
  const call = async (path, opts) => {
    const r = await fetch(API + path, Object.assign({ headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }, opts || {}));
    if (!r.ok) throw new Error('Netlify API ' + r.status);
    return r.status === 204 ? null : r.json();
  };
  try {
    if (event.httpMethod === 'POST') {
      let url = process.env.BUILD_HOOK_URL;
      if (!url) {
        const hooks = await call(`/sites/${site}/build_hooks`);
        let hook = hooks.find((h) => h.title === HOOK_TITLE);
        if (!hook) {
          const s = await call(`/sites/${site}`);
          hook = await call(`/sites/${site}/build_hooks`, { method: 'POST', body: JSON.stringify({ title: HOOK_TITLE, branch: (s.build_settings && s.build_settings.repo_branch) || 'main' }) });
        }
        url = hook.url;
      }
      const who = (user.user_metadata && user.user_metadata.full_name) || user.email || 'editor';
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'trigger_title=' + encodeURIComponent('Put live from /admin by ' + who), { method: 'POST', body: '{}' });
      if (!r.ok) return json(502, { error: 'Could not start publishing (build hook ' + r.status + ').' });
      return json(200, { ok: true });
    }

    const [s, deploys] = await Promise.all([call(`/sites/${site}`), call(`/sites/${site}/deploys?per_page=40`)]);
    const live = s.published_deploy || {};
    const liveAt = live.published_at || live.created_at || null;
    const prod = deploys.filter((d) => d.context === 'production');
    const building = prod.find((d) => BUSY.includes(d.state)) || null;
    const seen = new Set();
    const waiting = prod
      .filter((d) => (!liveAt || new Date(d.created_at) > new Date(liveAt)) && d.id !== live.id && d.state !== 'ready' && !BUSY.includes(d.state) && d.commit_ref)
      .filter((d) => (seen.has(d.commit_ref) ? false : seen.add(d.commit_ref)))
      .map((d) => ({ title: nice(d.title), at: d.created_at }));
    const failed = prod.find((d) => d.state === 'error' && d.error_message && !/skip|ignore|cancel/i.test(d.error_message) && (!liveAt || new Date(d.created_at) > new Date(liveAt)));
    return json(200, { liveAt, waiting, building: !!building, buildingSince: building && building.created_at, failed: failed ? failed.error_message : null });
  } catch (e) {
    return json(502, { error: e.message });
  }
};
