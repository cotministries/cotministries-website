// /admin login with GitHub, step 2: GitHub sends the editor back here; hand the token to the editor window (Decap CMS popup protocol).
import { loginPage as page } from '../../server/util.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)gh_state=([^;]+)/);
  if (!code || !state || !cookie || cookie[1] !== state) return page('error', { message: 'Login expired, please try again.' });
  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'website-admin' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: url.origin + '/api/callback' }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.access_token) return page('error', { message: d.error_description || 'GitHub did not return a token.' });
  return page('success', { token: d.access_token, provider: 'github' });
}
