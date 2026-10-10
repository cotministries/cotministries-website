// Page-view counter for the Visitors page (sent by static/site.js). Always answers "204 No Content" quickly.
import { recordHit, recordLeave } from '../../server/visits.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.text();
    if (body.length < 2000) {
      const d = JSON.parse(body);
      if (d.k === 'l') await recordLeave(env, d); else await recordHit(env, request, d);
    }
  } catch (e) { console.log('hit', e && e.message); }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
