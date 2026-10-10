// Creates a Square payment link for the appointment deposit (used by the "Add deposit link" button in Messages).
// Bridal packages: 50% of the package price (price taken from content/data/packages.json, not from the message).
// Everything else: the deposit amount from Settings (depositAmount, $50).
// Env vars: SQUARE_ACCESS_TOKEN (secret), SQUARE_LOCATION_ID, optional SQUARE_ENV=sandbox.
import { json, editor, getMessage } from '../../server/util.js';
import * as shop from '../../server/shop.js';
import packages from '../../content/data/packages.json';

export async function onRequestPost({ request, env }) {
  const user = await editor(request, env);
  if (!user) return json(401, { error: 'Please log in.' });
  const { SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENV } = env;
  if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) return json(503, { error: 'Square is not connected yet (SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID missing in Cloudflare).' });
  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const deposit = shop.num(shop.settings.depositAmount) || 50;

  // Look up the booking on the server, so the email and services can't be changed from the browser.
  let sub;
  try { sub = await getMessage(env, body.id); } catch (e) { return json(500, { error: e.message }); }
  if (!sub) return json(404, { error: 'Booking not found.' });
  const d = sub.data, services = String(d.services || 'Appointment').slice(0, 150);

  // Booked as a bridal package? The booking stores it as "The Bride ($375.00)".
  const pkgName = String(d.package || '').replace(/\s*\(\$[\d.,]+\)\s*$/, '').trim().toLowerCase();
  const pkg = pkgName && (packages.items || []).find((p) => String(p.title || '').trim().toLowerCase() === pkgName);
  const pkgPrice = pkg ? shop.num(pkg.price) : null;
  const isPkg = pkgPrice != null && pkgPrice > 0;
  const amount = isPkg ? Math.round(pkgPrice * 50) / 100 : deposit;
  const what = isPkg ? `50% deposit – ${pkg.title}` : `Deposit – ${services}`;

  const base = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
  const sq = await fetch(base + '/v2/online-checkout/payment-links', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SQUARE_ACCESS_TOKEN, 'Content-Type': 'application/json', 'Square-Version': '2025-01-23' },
    body: JSON.stringify({
      idempotency_key: `dep-${sub.id}-${Date.now()}`,
      quick_pay: { name: what.slice(0, 255), price_money: { amount: Math.round(amount * 100), currency: 'USD' }, location_id: SQUARE_LOCATION_ID },
      description: `Appointment deposit for ${d.name || ''} (${d.preferred_date || ''})`.slice(0, 4000),
      pre_populated_data: d.email ? { buyer_email: d.email } : undefined,
    }),
  });
  const out = await sq.json().catch(() => ({}));
  if (!sq.ok || !out.payment_link) return json(424, { error: 'Square: ' + ((out.errors && out.errors[0] && out.errors[0].detail) || sq.status) });
  const url = out.payment_link.url;
  const amt = amount % 1 ? amount.toFixed(2) : String(amount);
  return json(200, { url, amount, text: isPkg
    ? `To lock in your wedding date, please pay the 50% deposit for the ${pkg.title} package ($${amt}) here:\n${url}\n\nThe remaining 50% is paid on or before the wedding day.`
    : `To lock in your appointment, please pay the $${amt} deposit here:\n${url}\n\nThe remaining balance is paid on the day of your appointment.` });
}
