// Creates a Stripe Checkout page for the cart (books, ebooks, event tickets, one-time gifts) or a monthly gift.
// Env vars: STRIPE_SECRET_KEY (secret).
import * as shop from '../../server/shop.js';
import { json } from '../../server/util.js';

function form(obj, prefix, out) {
  out = out || [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
  }
  return out.join('&');
}
const cents = (n) => Math.round(Number(n) * 100);
const TERMS_VERSION = '2026-10';

export async function onRequestPost({ request, env }) {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return json(503, { error: 'Online checkout is being set up. Please contact us to order for now.' });
  let body; try { body = await request.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const origin = new URL(request.url).origin;
  const S = shop.settings;
  let params;
  try {
    if (body.pay) {
      // Monthly Spiritual Detox registration or 1:1 session: the price comes from the site's own files, never from the browser.
      const it = shop.payItem(body.pay.kind);
      if (!it) throw new Error('This payment is not available right now. Please choose another way to pay.');
      const email = String(body.pay.email || '').trim().slice(0, 200), ref = String(body.pay.ref || '').slice(0, 80), who = String(body.pay.name || '').slice(0, 120);
      params = {
        mode: 'payment', success_url: `${origin}/order-thanks/?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}${it.back}`,
        line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: cents(it.price), product_data: { name: it.name.slice(0, 250) } } } },
        metadata: { kind: 'pay', item: body.pay.kind, item_name: it.name.slice(0, 200), ref, who }, payment_intent_data: { metadata: { kind: 'pay', item: body.pay.kind, ref } },
      };
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) params.customer_email = email;
    } else if (body.monthly) {
      const amount = Math.round(Number(body.monthly.amount) * 100) / 100;
      if (!(amount >= 1 && amount <= 10000)) throw new Error('Please choose a monthly gift between $1 and $10,000.');
      const des = String(body.monthly.designation || '').slice(0, 80);
      params = {
        mode: 'subscription', success_url: `${origin}/give-thanks/?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/ministry/#give`,
        line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: cents(amount), recurring: { interval: 'month' }, product_data: { name: `Monthly partner gift${des ? ' – ' + des : ''}` } } } },
        metadata: { kind: 'monthly', designation: des, amount: String(amount) }, subscription_data: { metadata: { designation: des } },
      };
    } else {
      const lines = shop.resolveCart(body.items);
      const physical = lines.some((l) => l.physical);
      const digital = lines.some((l) => l.digital);
      // Ebooks: the buyer must agree that digital products are delivered instantly and sales are final (evidence for chargebacks).
      if (digital && body.agreeDigital !== true) throw new Error('Please tick the box to agree to the ebook terms before checkout.');
      const pickup = physical && body.delivery === 'pickup';
      const enc = shop.encodeLines(lines);
      const meta = { kind: 'cart', delivery: physical ? (pickup ? 'pickup' : 'ship') : 'digital' };
      if (digital) { meta.terms_accepted = new Date().toISOString(); meta.terms_ip = request.headers.get('cf-connecting-ip') || ''; meta.terms_version = TERMS_VERSION; }
      for (let i = 0; i * 480 < enc.length && i < 20; i++) meta['items' + (i || '')] = enc.slice(i * 480, (i + 1) * 480);
      params = {
        mode: 'payment', success_url: `${origin}/${lines.every((l) => l.kind === 'gift') ? 'give-thanks' : 'order-thanks'}/?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/books/`,
        allow_promotion_codes: 'true', phone_number_collection: { enabled: physical ? 'true' : 'false' },
        line_items: Object.fromEntries(lines.map((l, i) => [i, { quantity: l.qty, price_data: { currency: 'usd', unit_amount: cents(l.price), product_data: { name: l.name.slice(0, 250) } } }])),
        metadata: meta, payment_intent_data: { metadata: { delivery: meta.delivery } },
      };
      if (physical && !pickup) {
        params.shipping_address_collection = { allowed_countries: { 0: 'US' } };
        params.shipping_options = { 0: { shipping_rate_data: { type: 'fixed_amount', display_name: 'Shipping', fixed_amount: { amount: cents(shop.num(S.shippingFee) || 0), currency: 'usd' } } } };
      }
      if (pickup) params.custom_text = { submit: { message: `${S.pickupLabel || 'Pickup'}: we'll email you to arrange pickup.` } };
      if (digital) {
        // Stripe's own "I agree" checkbox (works once a Terms of Service link is set in Stripe → Settings → Public details)
        params.consent_collection = { terms_of_service: 'required' };
        params.custom_text = Object.assign(params.custom_text || {}, { terms_of_service_acceptance: { message: `I agree to the [ebook terms](${origin}/terms/): ebooks are digital downloads delivered right after payment, and all ebook sales are final.` } });
        params.payment_intent_data.description = 'Includes digital ebook(s) delivered by download – see ' + origin + '/terms/';
      }
    }
  } catch (e) { return json(400, { error: e.message }); }

  const create = (p) => fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(p) });
  let r = await create(params);
  let d = await r.json().catch(() => ({}));
  // No Terms of Service link set in Stripe yet: checkout still works, the agreement from the website's checkbox is kept in the order.
  if (!r.ok && params.consent_collection && /terms|consent/i.test((d.error && d.error.message) || '')) {
    delete params.consent_collection;
    const tos = params.custom_text.terms_of_service_acceptance; delete params.custom_text.terms_of_service_acceptance;
    params.custom_text.submit = { message: (params.custom_text.submit ? params.custom_text.submit.message + ' ' : '') + `By paying you agree to the ebook terms (${origin.replace(/^https?:\/\//, '')}/terms/): ebooks are digital downloads delivered right after payment, and all ebook sales are final.` };
    void tos;
    r = await create(params); d = await r.json().catch(() => ({}));
  }
  if (!r.ok) return json(424, { error: 'Checkout could not start: ' + ((d.error && d.error.message) || 'Stripe ' + r.status) });
  return json(200, { url: d.url });
}
