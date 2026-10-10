// Used by the "Thank you for your order" page: returns the buyer's personal ebook download links right away.
// GET /api/order?session_id=cs_...  (the Stripe order number from the thank-you page address)
import { json } from '../../server/util.js';
import { orderStatus, ebooksInOrder, linkFor, LINK_DAYS } from '../../server/ebooks.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sid = String(url.searchParams.get('session_id') || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) return json(400, { error: 'Unknown order.' });
  const st = await orderStatus(env, sid);
  if (!st.ok) return json(200, { ebooks: [], status: st.why });
  const s = st.session;
  if (Date.now() / 1000 > s.created + LINK_DAYS * 86400) return json(200, { ebooks: [], status: 'expired' });
  const ebooks = [];
  for (const b of ebooksInOrder(s.metadata)) ebooks.push({ title: b.title, format: b.format, url: b.ref ? await linkFor(env, url.origin, sid, b.id, b.idx, s.created) : '' });
  return json(200, { ebooks, email: (s.customer_details || {}).email || '' });
}
