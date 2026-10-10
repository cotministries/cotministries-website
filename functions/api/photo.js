// Editors only: GET /api/photo?id= -> one inspiration photo from a booking request.
import { json, editor } from '../../server/util.js';
import { pdb } from '../../server/photos.js';

export async function onRequestGet({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  const id = new URL(request.url).searchParams.get('id') || '';
  const r = await (await pdb(env)).prepare('SELECT name, type, data FROM uploads WHERE id = ?').bind(id).first();
  if (!r) return json(404, { error: 'Photo not found.' });
  const body = r.data instanceof ArrayBuffer || ArrayBuffer.isView(r.data) ? r.data : new Uint8Array(r.data);
  return new Response(body, { headers: { 'content-type': /^image\//.test(r.type) ? r.type : 'application/octet-stream', 'content-disposition': `inline; filename="${r.name}"`, 'cache-control': 'private, max-age=86400' } });
}
