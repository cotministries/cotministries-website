// Serves an uploaded picture (public: used on blog pages and inside newsletter emails).
import { bdb } from '../../../server/blog.js';

export async function onRequestGet({ params, env }) {
  const id = String(params.id || '').replace(/\.\w+$/, '');
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response('Not found', { status: 404 });
  let row;
  try { row = await (await bdb(env)).prepare('SELECT type, data FROM images WHERE id = ?').bind(id).first(); } catch (e) { return new Response('Not available', { status: 503 }); }
  if (!row) return new Response('Not found', { status: 404 });
  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
  return new Response(body, { headers: { 'content-type': row.type || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
}
