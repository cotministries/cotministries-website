// Numbers for the studio's Visitors page (/admin/#visitors), logged-in editors only.
import { json, editor } from '../../server/util.js';
import { stats } from '../../server/visits.js';

export async function onRequestGet({ request, env }) {
  if (!(await editor(request, env))) return json(401, { error: 'Please log in.' });
  const u = new URL(request.url);
  try {
    return json(200, await stats(env, { site: u.searchParams.get('site') || 'all', range: +u.searchParams.get('range') || 30 }));
  } catch (e) { return json(500, { error: e.message }); }
}
