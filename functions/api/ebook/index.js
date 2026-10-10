// Ebook upload from the editor (logged-in editors only). Stored privately in D1 (see server/ebooks.js).
// Returns { ref: "ebook:<id>/<file name>" } which the editor saves in books.json.
import { json, editor } from '../../../server/util.js';
import { edb, PART, MAX_SIZE } from '../../../server/ebooks.js';

const TYPES = { pdf: 'application/pdf', epub: 'application/epub+zip' };
export async function onRequestPost({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  let fd;
  try { fd = await request.formData(); } catch (e) { return json(400, { error: 'No file received (max 40 MB).' }); }
  const f = fd.get('file');
  if (!f || typeof f === 'string') return json(400, { error: 'No file received.' });
  const ext = (String(f.name || '').match(/\.(pdf|epub)$/i) || [])[1];
  if (!ext) return json(400, { error: 'Please upload the ebook as a PDF (or EPUB) file.' });
  if (f.size > MAX_SIZE) return json(413, { error: 'That file is too large (max 40 MB). Try saving the PDF in a smaller size.' });
  const buf = new Uint8Array(await f.arrayBuffer());
  if (ext.toLowerCase() === 'pdf' && String.fromCharCode(...buf.slice(0, 5)) !== '%PDF-') return json(400, { error: "That file doesn't look like a real PDF. Please export it again as PDF." });
  const id = crypto.randomUUID().replace(/-/g, '');
  const name = String(f.name || 'ebook.' + ext).replace(/[\\/]/g, '-').replace(/[^\w .()&'-]+/g, '').slice(0, 90) || 'ebook.' + ext;
  const parts = Math.max(1, Math.ceil(buf.length / PART));
  const DB = await edb(env);
  try {
    for (let n = 0; n < parts; n++) {
      const chunk = buf.slice(n * PART, (n + 1) * PART);
      await DB.prepare('INSERT INTO ebook_parts (file_id, n, data) VALUES (?, ?, ?)').bind(id, n, chunk.buffer).run();
    }
    await DB.prepare('INSERT INTO ebook_files (id, name, type, size, parts, by_user, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, name, TYPES[ext.toLowerCase()], buf.length, parts, user.email || user.login, new Date().toISOString()).run();
  } catch (e) {
    try { await DB.prepare('DELETE FROM ebook_parts WHERE file_id = ?').bind(id).run(); } catch (x) {}
    return json(500, { error: 'Upload could not be saved: ' + e.message });
  }
  return json(200, { ok: true, ref: `ebook:${id}/${name}`, name, size: buf.length });
}
