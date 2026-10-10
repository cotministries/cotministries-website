// Personal ebook download: /api/ebook/<token>
// GET shows a small page with a Download button (so email virus scanners that open links don't count as downloads);
// the button (POST) checks the order with Stripe again, records the download and sends the file.
// Editors can test an uploaded file: GET /api/ebook/<file id> with their login.
import settings from '../../../content/settings.json';
import { editor } from '../../../server/util.js';
import { readToken, formatOf, orderStatus, fileInfo, fileStream, downloads, logDownload, MAX_DOWNLOADS } from '../../../server/ebooks.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const contact = ((settings.brands || {}).main || {}).email || (settings.contact || {}).email || '';
const help = contact ? ` Questions? Email <a href="mailto:${esc(contact)}">${esc(contact)}</a> and we'll help.` : ' Questions? Reply to your order email and we\'ll help.';

function page(status, title, html) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · ${esc(settings.name || 'Download')}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf6f1;color:#2b0e04;font:16px/1.6 Georgia,'Times New Roman',serif;padding:24px;box-sizing:border-box}
.card{max-width:460px;width:100%;background:#fff;border:1px solid #ead9cc;border-radius:14px;padding:34px 28px;text-align:center;box-shadow:0 10px 30px rgba(43,14,4,.06)}
h1{font-size:1.55rem;margin:0 0 10px;font-weight:600}p{margin:0 0 14px}small{color:#7a5a4a;display:block;font:13px/1.5 Arial,sans-serif;margin-top:16px}
a{color:#8a3b12}button{font:600 15px Arial,sans-serif;letter-spacing:.04em;background:#2b0e04;color:#fff;border:0;border-radius:999px;padding:14px 30px;cursor:pointer;margin-top:6px}
button:hover{background:#4a1c0b}.book{font-style:italic}
</style></head><body><main class="card">${html}</main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' } });
}
const sorry = (status, title, text) => page(status, title, `<h1>${esc(title)}</h1><p>${text}${help}</p>`);
const fileName = (title, info) => (String(title || 'ebook').replace(/[^\w .&'-]+/g, '').trim() || 'ebook') + (info.type === 'application/epub+zip' ? '.epub' : '.pdf');
const sendFile = (env, info, title, extra) => new Response(fileStream(env, info), { headers: Object.assign({
  'content-type': info.type || 'application/pdf', 'content-length': String(info.size),
  'content-disposition': `attachment; filename="${fileName(title, info)}"`, 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff' }, extra || {}) });

async function check(env, token) {
  const t = await readToken(env, token);
  if (!t) return { res: sorry(404, 'Link not valid', "This download link isn't valid. Please use the link from your order email exactly as it is.") };
  if (Date.now() / 1000 > t.e) return { res: sorry(410, 'This link has expired', 'Download links work for 30 days after purchase.') };
  const fmt = formatOf(t.b, t.i);
  if (!fmt) return { res: sorry(404, 'Ebook not available', 'This ebook is no longer listed on the website.') };
  return { t, fmt };
}

export async function onRequestGet({ request, env, params }) {
  const token = String(params.token || '');
  // editor test download of an uploaded file
  if (/^[a-f0-9]{32}$/.test(token)) {
    if (!(await editor(request, env))) return new Response('Please log in to the editor.', { status: 401 });
    const info = await fileInfo(env, token);
    return info ? sendFile(env, info, info.name.replace(/\.\w+$/, '')) : new Response('File not found', { status: 404 });
  }
  const c = await check(env, token);
  if (c.res) return c.res;
  return page(200, 'Your ebook', `<h1>Your ebook is ready</h1><p class="book">${esc(c.fmt.title)}${c.fmt.format && c.fmt.format !== 'Ebook' ? ' – ' + esc(c.fmt.format) : ''}</p>
<form method="post"><button type="submit">Download</button></form>
<small>This link is personal to your order, works for 30 days and up to ${MAX_DOWNLOADS} downloads. Please don't share it.${help.replace('Questions?', '<br>Questions?')}</small>`);
}

export async function onRequestPost({ request, env, params }) {
  const c = await check(env, String(params.token || ''));
  if (c.res) return c.res;
  const { t, fmt } = c;
  if (!fmt.ref) return sorry(202, 'Almost ready', "Your ebook file is being prepared. We'll email it to you shortly – no need to do anything.");
  const st = await orderStatus(env, t.s);
  if (!st.ok) {
    if (st.why === 'refunded') return sorry(403, 'Order refunded', 'This order was refunded, so the download is no longer available.');
    if (st.why === 'disputed') return sorry(403, 'Download paused', 'A payment dispute was opened for this order with the card company, so downloads are paused.');
    if (st.why === 'unpaid') return sorry(402, 'Payment not finished yet', "Your payment hasn't gone through yet. Please try again in a few minutes.");
    if (st.why === 'unknown') return sorry(404, 'Order not found', "We couldn't find this order.");
    return sorry(503, 'Please try again shortly', 'Downloads are briefly unavailable.');
  }
  let done;
  try { done = (await downloads(env, t.s)).filter((d) => d.book === t.b + ':' + t.i).length; } catch (e) { return sorry(503, 'Please try again shortly', 'Downloads are briefly unavailable.'); }
  if (done >= MAX_DOWNLOADS) return sorry(429, 'Download limit reached', `This link has been used ${MAX_DOWNLOADS} times.`);
  const info = await fileInfo(env, fmt.ref.id);
  if (!info) return sorry(202, 'Almost ready', "Your ebook file is being prepared. We'll email it to you shortly – no need to do anything.");
  const email = (st.session.customer_details || {}).email || '';
  await logDownload(env, request, t.s, t.b + ':' + t.i, email);
  return sendFile(env, info, fmt.title);
}
