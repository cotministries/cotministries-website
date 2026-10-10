// Picture upload for the blog and newsletter editors (logged-in editors only).
// The browser shrinks pictures first (max 1600 px). Stored in D1 (table images) and served from /api/image/<id>.
import { json, editor } from '../../../server/util.js';
import { bdb } from '../../../server/blog.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export async function onRequestPost({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  let fd;
  try { fd = await request.formData(); } catch (e) { return json(400, { error: 'No picture received.' }); }
  const f = fd.get('file');
  if (!f || typeof f === 'string') return json(400, { error: 'No picture received.' });
  if (!TYPES.includes(f.type)) return json(400, { error: 'Please use a JPG, PNG, WebP or GIF picture.' });
  if (f.size > 1.8e6) return json(413, { error: 'That picture is too large (max 1.8 MB after shrinking). Try a smaller one.' });
  const ab = await f.arrayBuffer();
  const id = crypto.randomUUID().replace(/-/g, '');
  const w = Math.round(Number(fd.get('w')) || 0), h = Math.round(Number(fd.get('h')) || 0);
  const DB = await bdb(env);
  const ins = (blob) => DB.prepare('INSERT INTO images (id, type, size, w, h, data, by_user, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, f.type, ab.byteLength, w, h, blob, user.email || user.login, new Date().toISOString()).run();
  try { await ins(ab); } catch (e) { await ins(new Uint8Array(ab)); }
  return json(200, { ok: true, id, url: '/api/image/' + id, w, h });
}
