// Public: booking calendar rules + busy times, so /book/ can show free days and times.
import { json } from '../../server/util.js';
import { getSchedule, busyTimes, nowIn } from '../../server/schedule.js';

export async function onRequestGet({ env }) {
  const s = await getSchedule(env);
  const now = nowIn(s.tz);
  const busy = await busyTimes(env, s, now.date);
  const { blocks, holdRequests, ...pub } = s;
  return new Response(JSON.stringify(Object.assign(pub, { now, busy })), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
