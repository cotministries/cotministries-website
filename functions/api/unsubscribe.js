// One-click unsubscribe. Every newsletter links here with the person's own token (/api/unsubscribe?t=...).
// GET shows a confirmation page; POST is the "one-click" request mail apps like Gmail send (List-Unsubscribe-Post).
import { esc } from '../../server/util.js';
import { ndb } from '../../server/newsletter.js';
import settings from '../../content/settings.json';

async function unsub(env, t) {
  if (!/^[a-f0-9]{20,64}$/.test(t || '')) return null;
  const DB = await ndb(env);
  const row = await DB.prepare('SELECT id, email, status FROM subscribers WHERE token = ?').bind(t).first();
  if (!row) return null;
  if (row.status !== 'unsubscribed') await DB.prepare("UPDATE subscribers SET status = 'unsubscribed', unsub_at = ? WHERE id = ?").bind(new Date().toISOString(), row.id).run();
  return row;
}

const page = (title, text) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Bodoni+Moda:opsz@6..96&family=Jost:wght@400;500&display=swap">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4e7df;color:#2b0e04;font-family:Jost,system-ui,sans-serif;padding:24px}
.box{max-width:480px;background:#faf5f0;border:2px solid #c9a24a;outline:1px solid #e9cf8a;outline-offset:5px;padding:36px 32px;text-align:center}
.s{font-family:"Alex Brush",cursive;color:#9b1313;font-size:2.4rem;line-height:1;margin:0}h1{font-family:"Bodoni Moda",Georgia,serif;font-weight:400;font-size:1.6rem;margin:10px 0 12px}
p{color:#7a5547;line-height:1.6;margin:0 0 20px}a{display:inline-block;background:#9b1313;color:#fff;text-decoration:none;padding:12px 24px;letter-spacing:.14em;text-transform:uppercase;font-size:.75rem}</style></head>
<body><div class="box"><p class="s">${esc(settings.name || '')}</p><h1>${esc(title)}</h1><p>${esc(text)}</p><a href="/">Visit the website</a></div></body></html>`,
{ headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  let row = null;
  try { row = await unsub(env, new URL(request.url).searchParams.get('t')); } catch (e) { console.log('unsubscribe failed', e.message); }
  return row
    ? page("You're unsubscribed", `${row.email} won't receive any more newsletters. If this was a mistake, you can sign up again on the website anytime.`)
    : page('Link not recognized', 'This unsubscribe link is not valid anymore. If you still get emails you do not want, just reply to one and ask to be removed.');
}

export async function onRequestPost({ request, env }) {
  try { await unsub(env, new URL(request.url).searchParams.get('t')); } catch (e) { console.log('unsubscribe failed', e.message); }
  return new Response('Unsubscribed', { status: 200 });
}
