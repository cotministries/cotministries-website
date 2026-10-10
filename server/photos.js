// Inspiration photos sent with a booking. Stored in D1 (table uploads) – the browser shrinks them to ~200–400 KB first.
import { db } from './util.js';

const ready = new WeakSet();
export async function pdb(env) {
  const DB = await db(env);
  if (!ready.has(DB)) {
    await DB.prepare('CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, name TEXT, type TEXT, size INTEGER, data BLOB NOT NULL, created_at TEXT NOT NULL)').run();
    ready.add(DB);
  }
  return DB;
}
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

export async function savePhotos(env, messageId, files) {
  const DB = await pdb(env), out = [];
  for (const f of files) {
    const ab = await f.arrayBuffer(), u8 = new Uint8Array(ab);
    const id = crypto.randomUUID(), name = String(f.name || 'photo.jpg').replace(/[^\w.\- ]+/g, '').slice(0, 80) || 'photo.jpg';
    const ins = (blob) => DB.prepare('INSERT INTO uploads (id, message_id, name, type, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, messageId, name, f.type || 'image/jpeg', u8.length, blob, new Date().toISOString()).run();
    try { await ins(ab); } catch (e) { await ins(u8); } // D1 stores an ArrayBuffer as BLOB
    out.push({ id, name, b64: b64(u8) });
  }
  return out;
}
export async function photoList(env) {
  try { const r = await (await pdb(env)).prepare('SELECT id, message_id, name FROM uploads ORDER BY created_at').all(); return r.results || []; } catch (e) { return []; }
}
export async function deletePhotos(env, messageId) {
  try { await (await pdb(env)).prepare('DELETE FROM uploads WHERE message_id = ?').bind(messageId).run(); } catch (e) {}
}
