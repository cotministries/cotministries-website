// Shared shop helpers for the payment functions. Prices always come from the site's own content files,
// never from the browser, so nobody can change a price in their cart.
import settings from '../content/settings.json';
import books from '../content/data/books.json';
import events from '../content/data/events.json';
import services from '../content/data/services.json';
import R from '../lib/render.js';
const { slug, num } = R;

const shown = (x) => x && x.show !== false;
const bookById = (id) => (books.items || []).filter(shown).find((b) => slug(b.title) === id);
const eventById = (id) => (events.items || []).filter(shown).find((e) => slug(e.title + '-' + e.date) === id);
const today = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); // Florida-ish "today"

// Turns cart lines into checked line items. Throws a readable error for anything invalid.
function resolveCart(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Your cart is empty.');
  if (items.length > 30) throw new Error('Too many items in one order.');
  return items.map((it) => {
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    if (it.kind === 'book') {
      const b = bookById(it.id); const f = b && (b.formats || []).filter((x) => num(x.price) != null)[it.idx];
      if (!f) throw new Error('A book in your cart is no longer available. Please remove it and try again.');
      return { kind: 'book', id: it.id, idx: it.idx, qty, name: `${b.title} – ${f.name}`, price: num(f.price), physical: !f.digital, digital: !!f.digital, file: f.file || '' };
    }
    if (it.kind === 'ticket') {
      const e = eventById(it.id); const t = e && (e.tickets || []).filter((x) => x.name && num(x.price) != null)[it.idx];
      if (!t || e.free) throw new Error('A ticket in your cart is no longer available. Please remove it and try again.');
      if (String(e.date) < today()) throw new Error(`${e.title} has already taken place.`);
      return { kind: 'ticket', id: it.id, idx: it.idx, qty, name: `${e.title} – ${t.name} ticket (${e.date})`, price: num(t.price), event: e };
    }
    if (it.kind === 'gift') {
      const amount = Math.round(Number(it.amount) * 100) / 100;
      if (!(amount >= 1 && amount <= 10000)) throw new Error('Please choose a gift between $1 and $10,000.');
      return { kind: 'gift', qty, amount, name: `Ministry gift${it.designation ? ' – ' + String(it.designation).slice(0, 80) : ''}`, price: amount, designation: String(it.designation || '').slice(0, 80) };
    }
    throw new Error('Unknown item in cart.');
  });
}
// Compact cart summary stored on the Stripe session so the webhook can rebuild the order.
const encodeLines = (lines) => lines.map((l) => (l.kind === 'book' ? `b:${l.id}:${l.idx}:${l.qty}` : l.kind === 'ticket' ? `t:${l.id}:${l.idx}:${l.qty}` : `g:${l.amount}:${l.qty}:${l.designation.replace(/[|:]/g, ' ')}`)).join('|');
function decodeLines(str) {
  return String(str || '').split('|').filter(Boolean).map((p) => {
    const a = p.split(':');
    if (a[0] === 'g') return { kind: 'gift', amount: +a[1], qty: +a[2], designation: a.slice(3).join(':') };
    return { kind: a[0] === 'b' ? 'book' : 'ticket', id: a[1], idx: +a[2], qty: +a[3] };
  });
}
// Things people pay for right after a form: the Monthly Spiritual Detox (price in Settings → Payments) and the 1:1 session (price in 1:1 sessions).
function payItem(kind) {
  const P = settings.payment || {};
  if (kind === 'detox') { const price = num(P.detoxPrice); return price > 0 ? { name: P.detoxName || 'Monthly Spiritual Detox registration', price, back: '/monthly-spiritual-detox/' } : null; }
  if (kind === 'session') { const s = (services.items || []).filter(shown).find((x) => num(x.price) > 0); return s ? { name: s.name, price: num(s.price), back: '/one-on-one/' } : null; }
  return null;
}
export { payItem, settings, books, events, resolveCart, encodeLines, decodeLines, bookById, eventById, num, slug };
