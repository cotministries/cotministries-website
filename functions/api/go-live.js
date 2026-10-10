// "Put website live" button in /admin (logged-in editors only).
// GET  -> when the site last went live + saved changes (GitHub commits) that are not live yet
// POST -> publishes everything saved, in one deploy (Cloudflare deploy hook)
// Env vars: DEPLOY_HOOK_URL (secret; Cloudflare → Pages project → Settings → Builds → Deploy hooks). Optional GITHUB_BRANCH.
import { json, editor, gh, repoOf, db } from '../../server/util.js';

const nice = (t) => String(t || '').split('\n')[0].replace(/\s*\[live\]\s*/gi, ' ').replace(/^Update (\w+) “?"?(.+?)"?”?$/, (m, c, n) => `Updated ${n}`).replace(/^Create (\w+) “?"?(.+?)"?”?$/, (m, c, n) => `Added ${n}`).replace(/^Delete (\w+) “?"?(.+?)"?”?$/, (m, c, n) => `Deleted ${n}`).trim() || 'Change';
const BUILD_MINUTES = 15;

async function getKV(env, k) { try { const DB = await db(env); const r = await DB.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first(); return r ? r.v : null; } catch (e) { return null; } }
async function setKV(env, k, v) { try { const DB = await db(env); await DB.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v).run(); } catch (e) {} }

export async function onRequest({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });

  if (request.method === 'POST') {
    if (!env.DEPLOY_HOOK_URL) return json(500, { error: 'DEPLOY_HOOK_URL is not set in Cloudflare environment variables.' });
    const r = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
    if (!r.ok) return json(424, { error: 'Could not start publishing (deploy hook ' + r.status + ').' });
    await setKV(env, 'go-live', JSON.stringify({ at: new Date().toISOString(), by: user.name }));
    return json(200, { ok: true });
  }
  if (request.method !== 'GET') return json(405, { error: 'Use GET or POST.' });

  try {
    // version.json is written by build.js, so it always describes what is live right now.
    const vr = await env.ASSETS.fetch(new URL('/version.json?t=' + Date.now(), request.url));
    const live = vr.ok ? await vr.json().catch(() => ({})) : {};
    const liveAt = live.at || null;
    let waiting = [];
    if (live.sha) {
      const cr = await gh(user.token, `/repos/${repoOf(env)}/compare/${live.sha}...${env.GITHUB_BRANCH || 'main'}`);
      if (cr.ok) {
        const c = await cr.json();
        waiting = (c.commits || []).filter((x) => !/^Merge /.test(x.commit.message))
          .map((x) => ({ title: nice(x.commit.message), at: x.commit.author && x.commit.author.date })).reverse();
      }
    }
    const last = JSON.parse((await getKV(env, 'go-live')) || 'null');
    const since = last && (!liveAt || new Date(last.at) > new Date(liveAt)) ? (Date.now() - new Date(last.at)) / 60000 : null;
    const building = since != null && since < BUILD_MINUTES;
    const failed = since != null && since >= BUILD_MINUTES ? 'Publishing did not finish. Check the latest deployment in the Cloudflare dashboard.' : null;
    return json(200, { liveAt, waiting, building, buildingSince: building ? last.at : null, failed });
  } catch (e) {
    return json(424, { error: e.message });
  }
}
