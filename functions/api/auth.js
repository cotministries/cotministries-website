// /admin login, step 1.
// Logged in with the email code (Cloudflare Access)? -> done right away, saving goes through /api/github with the site's own GitHub key.
// Otherwise -> log in with a GitHub account (env GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET, callback https://<domain>/api/callback).
import { editor, loginPage } from '../../server/util.js';

export async function onRequestGet({ request, env }) {
  const user = await editor(request, env);
  if (user && user.access) return loginPage('success', { token: 'cf-access', provider: 'github' });
  if (!env.GITHUB_CLIENT_ID) return new Response('Please open /admin again and log in with your email code.', { status: 401 });
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const gh = new URL('https://github.com/login/oauth/authorize');
  gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  gh.searchParams.set('redirect_uri', url.origin + '/api/callback');
  gh.searchParams.set('scope', url.searchParams.get('scope') || 'repo,user:email');
  gh.searchParams.set('state', state);
  return new Response(null, { status: 302, headers: {
    Location: gh.toString(),
    'Set-Cookie': `gh_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  } });
}
