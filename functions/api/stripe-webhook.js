// Stripe calls this after a payment. It emails the buyer (ebook links, tickets), emails Niki, and adds the order to the Messages inbox.
// Env vars: STRIPE_WEBHOOK_SECRET (secret) + Resend keys (see server/brands.js). Optional ORDER_EMAIL.
// Stripe webhook URL: https://sowedintears.com/api/stripe-webhook
// Events: checkout.session.completed, checkout.session.async_payment_succeeded, charge.dispute.created (chargeback evidence email)
import * as shop from '../../server/shop.js';
import * as eb from '../../server/ebooks.js';
import { brandFor, sender, send } from '../../server/brands.js';
import { saveMessage } from '../../server/util.js';
const ok = (msg) => new Response(msg || 'ok', { status: 200 });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (c) => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');

async function verify(payload, header, secret) {
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const sigs = String(header || '').split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!parts.t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return false;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${parts.t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === expected.length && [...s].reduce((a, c, i) => a | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}
const wrap = (inner) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#2b0e04;max-width:560px">${inner}</div>`;

export async function onRequestPost({ request, env }) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response('Webhook secret not set', { status: 503 });
  const payload = await request.text();
  if (!(await verify(payload, request.headers.get('stripe-signature'), secret))) return new Response('Bad signature', { status: 400 });
  const evt = JSON.parse(payload);
  if (evt.type === 'charge.dispute.created') return dispute(evt.data.object, request, env);
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(evt.type)) return ok('ignored');
  const s = evt.data.object;
  if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return ok('not paid yet');

  const origin = new URL(request.url).origin;
  const S = shop.settings;
  const cust = s.customer_details || {};
  const ship = s.shipping_details || (s.collected_information && s.collected_information.shipping_details) || null;
  const addr = ship && ship.address ? [ship.name, ship.address.line1, ship.address.line2, `${ship.address.city || ''}, ${ship.address.state || ''} ${ship.address.postal_code || ''}`].filter(Boolean).join(', ') : '';
  const meta = s.metadata || {};
  let rows = [], ebooks = [], tickets = [];
  if (meta.kind === 'pay') {
    rows.push(`${meta.item_name || 'Payment'}${meta.who ? ' – for ' + meta.who : ''} (paid by card)`);
  } else if (meta.kind === 'monthly') {
    rows.push(`Monthly partner gift${meta.designation ? ' – ' + meta.designation : ''}: ${money(s.amount_total)} / month`);
  } else {
    const enc = Object.keys(meta).filter((k) => /^items\d*$/.test(k)).sort((a, b) => (parseInt(a.slice(5), 10) || 0) - (parseInt(b.slice(5), 10) || 0)).map((k) => meta[k]).join('');
    for (const l of shop.decodeLines(enc)) {
      if (l.kind === 'book') {
        const b = shop.bookById(l.id); const f = b && (b.formats || []).filter((x) => shop.num(x.price) != null)[l.idx];
        if (!b || !f) { rows.push(`${l.qty} × (book no longer listed: ${l.id})`); continue; }
        rows.push(`${l.qty} × ${b.title} – ${f.name}`);
        if (f.digital) {
          // private file → personal, expiring link; an old-style public link still works; no file yet → Niki is told to send it
          let url = '';
          if (eb.fileRef(f.file)) { try { url = await eb.linkFor(env, origin, s.id, l.id, l.idx, s.created); } catch (e) { console.log('ebook link', e.message); } }
          else if (f.file) url = /^https?:/.test(f.file) ? f.file : origin + f.file;
          ebooks.push({ title: b.title, id: l.id, idx: l.idx, url });
        }
      } else if (l.kind === 'ticket') {
        const e = shop.eventById(l.id); const t = e && (e.tickets || []).filter((x) => x.name && shop.num(x.price) != null)[l.idx];
        rows.push(`${l.qty} × ${e ? e.title : l.id} – ${t ? t.name : 'ticket'}`);
        if (e) tickets.push({ e, t, qty: l.qty });
      } else rows.push(`${l.qty} × Ministry gift ($${l.amount})${l.designation ? ' – ' + l.designation : ''}`);
    }
  }
  const delivery = meta.kind === 'pay' ? 'Paid online' + (meta.ref ? ' · form ' + meta.ref : '') : meta.delivery === 'pickup' ? (S.pickupLabel || 'Pickup') : meta.delivery === 'ship' ? 'Ship to customer' : meta.kind === 'monthly' ? 'Monthly gift' : 'Digital';
  const total = money(s.amount_total || 0);
  const snd = sender(env, brandFor('orders', { items: rows.join('; ') }), 'orders');

  // 1) Buyer
  const list = `<ul>${rows.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
  const btn = (u, t) => `<a href="${esc(u)}" style="display:inline-block;background:#2b0e04;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:bold;margin:4px 0">Download ${esc(t)}</a>`;
  const ebookHtml = ebooks.length ? `<h3 style="margin:22px 0 6px">Your ebook${ebooks.length > 1 ? 's' : ''}</h3>${ebooks.map((x) => `<p style="margin:6px 0">${x.url ? btn(x.url, x.title) : `<b>${esc(x.title)}</b>: your download link will follow by email shortly.`}</p>`).join('')}<p style="font-size:13px;color:#7a5a4a">Your download link is personal to your order, works for ${eb.LINK_DAYS} days and up to ${eb.MAX_DOWNLOADS} downloads – please don't share it. As agreed at checkout, ebooks are digital products and all ebook sales are final (<a href="${origin}/terms/" style="color:#7a5a4a">ebook terms</a>). Trouble downloading? Just reply to this email.</p>` : '';
  const ticketHtml = tickets.length ? `<h3 style="margin:22px 0 6px">Your tickets</h3><ul>${tickets.map((x) => `<li>${x.qty} × ${esc(x.t ? x.t.name : 'ticket')} – <b>${esc(x.e.title)}</b><br>${esc(x.e.date)}${x.e.time ? ' · ' + esc(x.e.time) : ''}${x.e.place ? ' · ' + esc(x.e.place) : ''}<br>Show this email at check-in. Name on the order: ${esc(cust.name || '')}</li>`).join('')}</ul>` : '';
  const pickupHtml = meta.delivery === 'pickup' ? `<p>You chose <b>${esc(S.pickupLabel || 'pickup')}</b>. We'll email you to arrange a time.</p>` : meta.delivery === 'ship' ? '<p>Your paperback(s) will ship within a few business days.</p>' : '';
  if (cust.email) await send(snd, { to: [cust.email], subject: `Your order from ${snd.brand.name}`, html: wrap(`<p>Hi ${esc((cust.name || '').split(' ')[0] || 'there')},</p><p>Thank you for your ${meta.kind === 'monthly' ? 'monthly partnership' : 'order'}! Here's what you got (total ${total}):</p>${list}${ebookHtml}${ticketHtml}${pickupHtml}<p>God bless you,<br>${esc(snd.brand.name)}</p>`) });

  // 2) Niki
  const owner = env.ORDER_EMAIL || snd.notify;
  const missing = ebooks.filter((x) => !x.url).map((x) => x.title);
  const terms = meta.terms_accepted ? `\nEbook terms agreed: ${eb.fmtTime(meta.terms_accepted)}${meta.terms_ip ? ' from ' + meta.terms_ip : ''}${s.consent && s.consent.terms_of_service === 'accepted' ? ' (also on the Stripe page)' : ''}` : '';
  const summary = `${rows.join('\n')}\n\nTotal: ${total}\nDelivery: ${delivery}${addr ? '\nShip to: ' + addr : ''}${cust.phone ? '\nPhone: ' + cust.phone : ''}${terms}${missing.length ? '\n\n⚠ No ebook file uploaded yet for: ' + missing.join(', ') + '. Please email the PDF to the customer (or upload it in the editor: Shop & lists → Books).' : ''}`;
  if (owner) await send(Object.assign({}, snd, { replyTo: cust.email || snd.replyTo }), { to: [owner], subject: `🛍 New order: ${total} from ${cust.name || cust.email || 'a customer'}`, html: wrap(`<p><b>New ${meta.kind === 'monthly' ? 'monthly gift' : 'order'}</b> on your website.</p><pre style="font-family:inherit;white-space:pre-wrap">${esc(summary)}</pre><p>Customer: ${esc(cust.name || '')} · ${esc(cust.email || '')}</p><p>See all payments in your Stripe dashboard.</p>`) });

  // 3) Ebook order record (used for download checks and chargeback evidence)
  if (ebooks.length) {
    try { await eb.saveOrder(env, { session_id: s.id, payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent && s.payment_intent.id) || '', email: cust.email, name: cust.name, total, items: rows, terms_at: meta.terms_accepted || '', terms_ip: meta.terms_ip || '', created_at: new Date((s.created || Date.now() / 1000) * 1000).toISOString() }); }
    catch (e) { console.log('ebook order not saved', e.message); }
  }

  // 4) Messages inbox
  try { await saveMessage(env, 'orders', { name: cust.name || '', email: cust.email || '', order_id: s.id, total, items: rows.join('; '), delivery, address: addr, message: summary }); } catch (e) { console.log('order not saved', e.message); }
  return ok();
}

// A chargeback was opened: pause downloads (checked live with Stripe) and email Niki the evidence to upload in Stripe.
async function dispute(d, request, env) {
  const pi = typeof d.payment_intent === 'string' ? d.payment_intent : (d.payment_intent && d.payment_intent.id) || '';
  let order = null, dls = [];
  try {
    const DB = await eb.edb(env);
    order = pi ? await DB.prepare('SELECT * FROM ebook_orders WHERE payment_intent = ?').bind(pi).first() : null;
    if (order) dls = await eb.downloads(env, order.session_id);
  } catch (e) { console.log('dispute lookup', e.message); }
  const origin = new URL(request.url).origin;
  const snd = sender(env, 'main', 'orders');
  const owner = env.ORDER_EMAIL || snd.notify;
  const due = d.evidence_details && d.evidence_details.due_by ? eb.fmtTime(new Date(d.evidence_details.due_by * 1000).toISOString()) : '';
  const reason = String(d.reason || 'general').replace(/_/g, ' ');
  const items = order ? JSON.parse(order.items || '[]') : [];
  const bookTitle = (k) => { const [id, i] = String(k || '').split(':'); const f = eb.formatOf(id, +i); return f ? f.title : id; };
  const lines = order ? [
    `Order: ${items.join('; ')} – ${order.total}`,
    `Customer: ${order.name || ''} <${order.email || ''}>`,
    `Ordered: ${eb.fmtTime(order.created_at)}`,
    order.terms_at ? `Agreed at checkout (checkbox) that ebooks are digital, delivered instantly and all sales are final: ${eb.fmtTime(order.terms_at)}${order.terms_ip ? ', internet address ' + order.terms_ip : ''}` : 'Terms agreement: not recorded for this order',
    `Ebook terms page: ${origin}/terms/`,
    '',
    dls.length ? `Downloads (${dls.length}):` : 'Downloads: none recorded',
    ...dls.map((x) => `• ${eb.fmtTime(x.at)} – ${bookTitle(x.book)} – ${x.email || ''} – internet address ${x.ip || '?'}${x.country ? ' (' + x.country + ')' : ''} – ${x.ua || ''}`),
  ] : ['This payment is not an ebook order on the website (or it was made before ebook records started).'];
  const text = lines.join('\n');
  if (owner) await send(snd, { to: [owner], subject: `⚠ Chargeback opened: ${money(d.amount || 0)}${order ? ' – ' + (order.name || order.email) : ''}`, html: wrap(`<p><b>A customer opened a chargeback</b> (reason: ${esc(reason)}). Ebook downloads for this order are paused automatically.</p>
<p><b>What to do:</b> open the dispute in your Stripe dashboard (Payments → Disputes), choose <i>Counter dispute</i>, and paste or upload the evidence below${due ? `. <b>Deadline: ${esc(due)}</b>` : ''}. For ebooks, the most useful categories are <i>Proof of delivery / usage</i> and <i>Refund policy</i>.</p>
<pre style="font-family:inherit;white-space:pre-wrap;background:#fbf6f1;padding:12px;border-radius:8px">${esc(text)}</pre>`) });
  try { await saveMessage(env, 'orders', { name: order ? order.name : '', email: order ? order.email : '', order_id: d.id, total: money(d.amount || 0), items: 'CHARGEBACK – ' + reason, message: text }); } catch (e) { console.log('dispute not saved', e.message); }
  return ok();
}
