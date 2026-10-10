// The editor (/admin) talks to GitHub through here, so editors don't need their own GitHub account.
// Only people logged in with the email code (Cloudflare Access) or a GitHub account with write access get through.
// Env: GITHUB_TOKEN (secret) – fine-grained GitHub token for this one repo, "Contents: Read and write".
import { json, editor, repoOf } from '../../../server/util.js';

const PASS_REQ = ['accept', 'content-type', 'if-none-match', 'if-modified-since'];
const PASS_RES = ['content-type', 'link', 'etag', 'last-modified', 'x-ratelimit-remaining'];

export async function onRequest({ request, env, params }) {
  const user = await editor(request, env);
  if (!user) return json(401, { message: 'Please log in.' });
  const path = '/' + [].concat(params.path || []).join('/');
  if (path === '/user') {
    return json(200, { login: user.login, name: user.name, email: user.email, avatar_url: '' });
  }
  const repo = repoOf(env);
  if (!(path === '/repos/' + repo || path.startsWith('/repos/' + repo + '/'))) return json(403, { message: 'Not allowed.' });
  // GitHub users go straight to GitHub with their own token; email-code users use the site's key.
  const token = user.access ? env.GITHUB_TOKEN : user.token;
  if (!token) return json(500, { message: 'GITHUB_TOKEN is not set in Cloudflare environment variables.' });

  const headers = { Authorization: 'token ' + token, 'User-Agent': 'website-admin' };
  for (const h of PASS_REQ) { const v = request.headers.get(h); if (v) headers[h] = v; }
  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.text();
    // Label each saved change with the person who made it.
    if (request.method === 'POST' && /\/git\/commits$/.test(path) && user.access) {
      try { const b = JSON.parse(body); b.author = { name: user.name, email: user.email, date: new Date().toISOString() }; body = JSON.stringify(b); } catch (e) {}
    }
  }
  const r = await fetch('https://api.github.com' + path + new URL(request.url).search, { method: request.method, headers, body });
  const out = new Headers({ 'cache-control': 'no-store' });
  for (const h of PASS_RES) { const v = r.headers.get(h); if (v) out.set(h, v); }
  // Next-page links must also go through this proxy, not straight to GitHub.
  if (out.get('link')) out.set('link', out.get('link').split('https://api.github.com').join(new URL(request.url).origin + '/api/github'));
  if (path === '/repos/' + repo && r.ok && user.access) {
    // The editor checks it may save; the site's key has write access.
    const d = await r.json(); d.permissions = Object.assign({}, d.permissions, { push: true });
    return new Response(JSON.stringify(d), { status: r.status, headers: out });
  }
  return new Response(r.body, { status: r.status, headers: out });
}
