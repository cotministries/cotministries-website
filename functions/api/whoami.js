// Diagnostic: shows whether this browser is logged in to the editor (no secrets shown).
import { json, editor, accessWhy } from '../../server/util.js';

export async function onRequestGet({ request, env }) {
  const user = await editor(request, env);
  const cookies = (request.headers.get('cookie') || '').split(/;\s*/).map((c) => c.split('=')[0]).filter(Boolean);
  return json(200, {
    loggedIn: !!user, via: user ? (user.access ? 'email code' : 'github') : null, email: user ? user.email : null,
    accessProblem: user ? null : accessWhy, cookiesSeen: cookies,
    setup: { ACCESS_TEAM: !!env.ACCESS_TEAM, ACCESS_AUD: !!env.ACCESS_AUD, GITHUB_TOKEN: !!env.GITHUB_TOKEN, DB: !!env.DB },
  });
}
