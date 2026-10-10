// Shared helpers for the Cloudflare Pages Functions in /functions.
export const REPO_DEFAULT = 'cotministries/cotministries-website';
export const repoOf = (env) => env.GITHUB_REPO || REPO_DEFAULT;

export const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- GitHub (editors log in to /admin with GitHub; the same token unlocks the inbox + go-live) ---------- */
export const gh = (token, path, opts) => fetch('https://api.github.com' + path, Object.assign({}, opts, {
  headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'website-admin' }, (opts && opts.headers) || {}),
}));

/* ---------- Cloudflare Access (email-code login for /admin) ---------- */
// Env: ACCESS_TEAM (e.g. "sowedintears" or "sowedintears.cloudflareaccess.com"), ACCESS_AUD (Application Audience tag).
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
let certs = null, certsUntil = 0;
export let accessWhy = '';
async function accessUser(request, env) {
  accessWhy = '';
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) { accessWhy = 'ACCESS_TEAM / ACCESS_AUD not set'; return null; }
  const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const jwt = request.headers.get('cf-access-jwt-assertion') || (cookie && cookie[1]);
  if (!jwt) { accessWhy = 'no Access login cookie on this request'; return null; }
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64url(h)));
    const pay = JSON.parse(new TextDecoder().decode(b64url(p)));
    const team = env.ACCESS_TEAM.includes('.') ? env.ACCESS_TEAM : env.ACCESS_TEAM + '.cloudflareaccess.com';
    if (pay.iss !== 'https://' + team) { accessWhy = 'wrong team: ' + pay.iss; return null; }
    if (!(Array.isArray(pay.aud) ? pay.aud : [pay.aud]).includes(env.ACCESS_AUD)) { accessWhy = 'wrong AUD'; return null; }
    if (!pay.exp || pay.exp * 1000 < Date.now() || !pay.email) { accessWhy = 'login expired or no email'; return null; }
    if (!certs || certsUntil < Date.now()) {
      const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
      certs = (await r.json()).keys || []; certsUntil = Date.now() + 3600e3;
    }
    const jwk = certs.find((k) => k.kid === head.kid);
    if (!jwk) { accessWhy = 'signing key not found'; return null; }
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(h + '.' + p));
    if (!ok) { accessWhy = 'bad signature'; return null; }
    const email = String(pay.email).toLowerCase();
    const name = (nameFor(env, email)) || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { login: email, name, email, token: env.GITHUB_TOKEN || '', access: true };
  } catch (e) { accessWhy = 'error: ' + e.message; return null; }
}
// Optional env EDITOR_NAMES: "niki@firebynik.com=Niki, someone@gmail.com=Mom" (names shown in history and replies)
function nameFor(env, email) {
  for (const part of String(env.EDITOR_NAMES || '').split(',')) {
    const [e, n] = part.split('=').map((x) => (x || '').trim());
    if (e && n && e.toLowerCase() === email) return n;
  }
  return '';
}

const cache = new Map(); // token -> { user, until }
// Returns { login, name, email, token } for someone allowed to edit the website, or null.
// 1) logged in through Cloudflare Access (email code), or 2) a GitHub token with write access to the repo.
export async function editor(request, env) {
  const acc = await accessUser(request, env);
  if (acc) return acc;
  const m = (request.headers.get('authorization') || '').match(/^(?:Bearer|token)\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (token === 'cf-access') return null;
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const [ur, rr] = await Promise.all([gh(token, '/user'), gh(token, '/repos/' + repoOf(env))]);
  if (!ur.ok || !rr.ok) return null;
  const u = await ur.json(), repo = await rr.json();
  if (!repo.permissions || !repo.permissions.push) return null;
  const user = { login: u.login, name: u.name || u.login, email: u.email || u.login, token };
  cache.set(token, { user, until: Date.now() + 5 * 60e3 });
  return user;
}

/* ---------- Messages storage (Cloudflare D1 database, bound as "DB") ---------- */
let ready = false;
export async function db(env) {
  if (!env.DB) throw new Error('The messages database is not connected yet (add a D1 binding named DB in Cloudflare → Pages project → Settings → Bindings).');
  if (!ready) {
    await env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, form TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS replies (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, created_at TEXT NOT NULL, by_user TEXT, to_email TEXT, text TEXT)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)'),
    ]);
    ready = true;
  }
  return env.DB;
}
export const newId = () => crypto.randomUUID();
export async function saveMessage(env, form, data) {
  const DB = await db(env);
  const id = newId(), at = new Date().toISOString();
  await DB.prepare('INSERT INTO messages (id, form, created_at, data) VALUES (?, ?, ?, ?)').bind(id, form, at, JSON.stringify(data)).run();
  return { id, form, created_at: at, data };
}
export async function getMessage(env, id) {
  const DB = await db(env);
  const row = await DB.prepare('SELECT * FROM messages WHERE id = ?').bind(String(id || '')).first();
  return row ? { id: row.id, form: row.form, created_at: row.created_at, data: JSON.parse(row.data || '{}') } : null;
}

/* ---------- Decap CMS login popup reply (used by /api/auth and /api/callback) ---------- */
export const loginPage = (status, content) => new Response(`<!doctype html><html><body><p>${status === 'success' ? 'Logged in. This window closes by itself.' : 'Login failed. You can close this window and try again.'}</p><script>
(function () {
  var msg = 'authorization:github:${status}:' + ${JSON.stringify(JSON.stringify(content))};
  function receive(e) { window.opener.postMessage(msg, e.origin); window.removeEventListener('message', receive, false); setTimeout(function () { window.close(); }, 500); }
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'Set-Cookie': 'gh_state=; Path=/api; Max-Age=0' } });
