// Blog page rendering, shared by functions/blog/[[path]].js (public pages) and /api/blog (preview in /admin).
// Pages sit inside the site's normal header/footer: dist/blog-shell.html (made by build.js) with <!--BLOG--> replaced.
import { esc } from './util.js';
import { bdb, rowToPost, LIVE_SQL, BLOG, CATS, AUTHOR, blocksHtml, readMinutes, fmtDate, slugify } from './blog.js';
import settings from '../content/settings.json';

const CANON = 'https://cotministries.com';
const html = (body, status, nocache) => new Response(body, { status: status || 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': nocache ? 'no-store' : 'public, max-age=60' } });
const qs = (o) => { const p = Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== 1 && v !== 'All'); return p.length ? '?' + p.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&') : ''; };

export async function shell(env, url) {
  try { const r = await env.ASSETS.fetch(new URL('/blog-shell.html', url)); if (r.ok) return await r.text(); } catch (e) {}
  return '<!doctype html><html><head><title>%%TITLE%%</title></head><body><!--BLOG--></body></html>';
}
function page(sh, { title, desc, image, canonical, noindex, body, jsonld }) {
  let h = sh.split('%%TITLE%%').join(esc(title)).split('%%DESC%%').join(esc(desc || ''));
  h = h.split('%%IMG%%').join(esc(image || ''));
  const head = `<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="${jsonld ? 'article' : 'website'}"><meta name="twitter:card" content="summary_large_image">`
    + (noindex ? '<meta name="robots" content="noindex">' : '') + (jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : '')
    + `<link rel="alternate" type="application/rss+xml" title="${esc(BLOG.script || 'Blog')}" href="/blog/rss.xml">`;
  return h.replace('</head>', head + '</head>').replace('<!--BLOG-->', body);
}
const absImg = (u, origin) => (!u ? '' : /^https?:/.test(u) ? u : origin + u);

function card(p) {
  return `<a class="bl-card" href="/blog/${esc(p.slug)}/"><span class="bl-cv"${p.cover ? ` style="background-image:url('${esc(p.cover)}')"` : ''}></span><span class="bl-tx">
<span class="bl-meta"><span class="bl-cat">${esc(p.cat)}</span><span>${esc(fmtDate(p.publishAt))}</span><span>${readMinutes(p)} min read</span></span>
<span class="bl-t">${esc(p.title)}</span>${p.excerpt ? `<span class="bl-ex">${esc(p.excerpt)}</span>` : ''}</span></a>`;
}
const subscribe = (settings.blog || {}).showSubscribe === false ? '' : `<section class="bl-sub"><div class="wrap"><div><p class="script">${esc((settings.blog || {}).subscribeScript || 'Letters from City Of Testimonies')}</p><h2>${esc((settings.blog || {}).subscribeTitle || 'Get new posts in your inbox')}</h2></div>
<div><form class="sub-form nl-quick" method="POST" action="/api/subscribe" novalidate><p hidden><label>Leave empty <input name="company"></label></p><input type="hidden" name="page" value="/blog/"><input type="email" name="email" required placeholder="Enter your email address" aria-label="Email address"><button type="submit">Subscribe</button></form><p class="nl-quick-msg" role="status" hidden></p></div></div></section>`;

async function livePosts(DB) {
  const r = await DB.prepare(`SELECT * FROM posts WHERE ${LIVE_SQL} ORDER BY publish_at DESC LIMIT 1000`).bind(new Date().toISOString()).all();
  return (r.results || []).map(rowToPost);
}

export async function listPage(env, url, sh) {
  const DB = await bdb(env);
  const all = await livePosts(DB);
  const cat = url.searchParams.get('cat') || 'All', tag = url.searchParams.get('tag') || '', q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const pg = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
  const per = Math.min(30, Math.max(3, Number(BLOG.perPage) || 9));
  const ql = q.toLowerCase();
  let list = all.filter((p) => (cat === 'All' || p.cat === cat) && (!tag || p.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase()))
    && (!ql || (p.title + ' ' + p.excerpt + ' ' + p.tags.join(' ') + ' ' + p.blocks.map((b) => b.text || '').join(' ')).toLowerCase().includes(ql)));
  const plain = cat === 'All' && !tag && !q && pg === 1;
  const feat = plain ? (all.find((p) => p.featured) || all[0]) : null;
  if (feat) list = list.filter((p) => p !== feat);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const shown = list.slice((pg - 1) * per, pg * per);
  const used = new Set(all.map((p) => p.cat));
  const cats = ['All'].concat(CATS.filter((c) => used.has(c)), [...used].filter((c) => c && !CATS.includes(c)));
  const heading = tag ? `Posts tagged “${tag}”` : q ? `Search: “${q}”` : '';
  const body = `<section class="bl-hero"><div class="wrap"><p class="script">${esc(BLOG.script)}</p><h1>${esc(BLOG.title)}</h1>${BLOG.intro ? `<p class="lead">${esc(BLOG.intro)}</p>` : ''}</div></section>
<div class="wrap bl-wrap">
${feat ? `<a class="bl-feat" href="/blog/${esc(feat.slug)}/"><span class="bl-cv"${feat.cover ? ` style="background-image:url('${esc(feat.cover)}')"` : ''}></span><span class="bl-tx"><span class="caps-sub bl-gold">Featured</span>
<span class="bl-meta"><span class="bl-cat">${esc(feat.cat)}</span><span>${esc(fmtDate(feat.publishAt))}</span><span>${readMinutes(feat)} min read</span></span><span class="bl-t">${esc(feat.title)}</span>${feat.excerpt ? `<span class="bl-ex">${esc(feat.excerpt)}</span>` : ''}<span class="btn">Read the post <span class="arr">&rarr;</span></span></span></a>` : ''}
<div class="bl-bar"><nav class="bl-cats" aria-label="Topics">${cats.map((c) => `<a href="/blog/${qs({ cat: c })}"${c === cat && !tag ? ' aria-current="true"' : ''}>${esc(c)}</a>`).join('')}</nav>
<form class="bl-search" method="GET" action="/blog/" role="search"><input type="search" name="q" value="${esc(q)}" placeholder="Search posts" aria-label="Search posts">${cat !== 'All' ? `<input type="hidden" name="cat" value="${esc(cat)}">` : ''}<button type="submit" aria-label="Search">&#8981;</button></form></div>
${heading ? `<p class="bl-heading">${esc(heading)} · <a href="/blog/">show all posts</a></p>` : ''}
${shown.length ? `<div class="bl-grid">${shown.map(card).join('')}</div>` : `<p class="bl-empty">${all.length ? 'No posts match. Try another topic or search word.' : 'The first posts are coming soon.'}</p>`}
${pages > 1 ? `<nav class="bl-pages" aria-label="More posts">${pg > 1 ? `<a class="btn btn-line btn-sm" href="/blog/${qs({ cat, tag, q, page: pg - 1 })}">&larr; Newer</a>` : '<span></span>'}<span>Page ${pg} of ${pages}</span>${pg < pages ? `<a class="btn btn-line btn-sm" href="/blog/${qs({ cat, tag, q, page: pg + 1 })}">Older &rarr;</a>` : '<span></span>'}</nav>` : ''}
</div>${subscribe}`;
  const canonical = CANON + '/blog/' + qs({ cat, tag, page: pg });
  return html(page(sh, { title: (cat !== 'All' ? cat + ' · ' : '') + (BLOG.script || 'Blog'), desc: BLOG.intro || settings.description, image: absImg(settings.shareImage, CANON), canonical, noindex: !!q, body }));
}

// opts: { waitUntil, post } – post: render this (unsaved) post as a preview for the editor
export async function postPage(env, url, sh, slug, opts) {
  opts = opts || {};
  const DB = await bdb(env);
  const p = opts.post || rowToPost(await DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(slug).first());
  const now = Date.now();
  const live = p && p.status === 'pub' && p.publishAt && new Date(p.publishAt).getTime() <= now;
  const preview = !!opts.post;
  if (!p || (!live && !preview)) return notFound(sh);
  if (live && !preview && opts.waitUntil) opts.waitUntil(DB.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').bind(p.id).run().catch(() => {}));
  const all = await livePosts(DB);
  const i = all.findIndex((x) => x.id === p.id);
  if (preview) { const k = all.findIndex((x) => x.id === p.id); if (k >= 0) all[k] = p; }
  const newer = i > 0 ? all[i - 1] : null, older = i >= 0 ? all[i + 1] : null;
  const rel = all.filter((x) => x.id !== p.id).map((x) => ({ x, s: (x.cat === p.cat ? 2 : 0) + x.tags.filter((t) => p.tags.includes(t)).length })).sort((a, b) => b.s - a.s).slice(0, 3).map((o) => o.x);
  const cms = p.comments ? ((await DB.prepare('SELECT name, text, created_at FROM post_comments WHERE post_id = ? AND approved = 1 ORDER BY created_at').bind(p.id).all()).results || []) : [];
  const link = CANON + '/blog/' + p.slug + '/';
  const enc = encodeURIComponent;
  const photo = BLOG.authorPhoto ? `<img src="${esc(BLOG.authorPhoto)}" alt="">` : `<span>${esc((AUTHOR.replace(/^prophetess\s+/i, '') || 'N').charAt(0))}</span>`;
  const body = `<article class="bp" data-slug="${esc(p.slug)}">
<div class="bp-top wrap"><a class="bp-back" href="/blog/">&larr; All posts</a>${preview ? `<p class="bp-preview">Preview · ${p.status === 'draft' ? 'Draft, not public yet' : 'Scheduled for ' + esc(fmtDate(p.publishAt))}</p>` : ''}
<p class="bl-meta"><a class="bl-cat" href="/blog/?cat=${enc(p.cat)}">${esc(p.cat)}</a><span>${esc(fmtDate(p.publishAt || p.updated))}</span><span>${readMinutes(p)} min read</span></p>
<h1>${esc(p.title)}</h1>${p.excerpt ? `<p class="bp-lead">${esc(p.excerpt)}</p>` : ''}<p class="bp-by"><span class="bp-av">${photo}</span>By ${esc(p.author || AUTHOR)}</p></div>
${p.cover ? `<div class="bp-cover wrap"><img src="${esc(p.cover)}" alt="${esc(p.coverAlt || '')}"></div>` : ''}
<div class="bp-body wrap">${blocksHtml(p.blocks)}
${p.tags.length ? `<p class="bp-tags">${p.tags.map((t) => `<a href="/blog/?tag=${enc(t)}">#${esc(t)}</a>`).join('')}</p>` : ''}
<div class="bp-react"><button class="bp-amen" type="button" data-amen aria-pressed="false">&#128591; Amen <b>${p.amens}</b></button>
<div class="bp-share"><button class="btn btn-line btn-sm" type="button" data-copy="${esc(link)}">Copy link</button><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${enc(link)}">Facebook</a><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(p.title + ' ' + link)}">WhatsApp</a><a class="btn btn-line btn-sm" href="mailto:?subject=${enc(p.title)}&amp;body=${enc(link)}">Email a friend</a></div></div>
<div class="bp-author"><span class="bp-av big">${photo}</span><div><b>${esc(p.author || AUTHOR)}</b>${BLOG.authorBio ? `<p>${esc(BLOG.authorBio)}</p>` : ''}</div></div>
${p.comments ? `<section class="bp-comments" id="comments"><h2>Comments (${cms.length})</h2>${cms.map((c) => `<div class="bp-cm"><b>${esc(c.name)}</b><small>${esc(fmtDate(c.created_at))}</small><p>${esc(c.text).replace(/\n/g, '<br>')}</p></div>`).join('')}
<form class="bp-cmform" data-cmform novalidate><p hidden><label>Leave empty <input name="company"></label></p><div class="row"><label>Name<input name="name" required maxlength="80" autocomplete="name"></label><label>Email (not shown)<input name="email" type="email" required maxlength="200" autocomplete="email"></label></div>
<label>Comment or prayer<textarea name="text" rows="4" required maxlength="3000"></textarea></label><p class="bp-err" role="alert" hidden></p><button class="btn" type="submit">Post comment</button><small>Comments appear after they are approved.</small></form></section>` : ''}
${rel.length ? `<section class="bp-rel"><h2>You might also like</h2><div class="bl-grid">${rel.map(card).join('')}</div></section>` : ''}
<nav class="bp-pn" aria-label="More posts">${older ? `<a href="/blog/${esc(older.slug)}/"><small>&larr; Older</small>${esc(older.title)}</a>` : '<span></span>'}${newer ? `<a class="r" href="/blog/${esc(newer.slug)}/"><small>Newer &rarr;</small>${esc(newer.title)}</a>` : '<span></span>'}</nav>
</div></article>${subscribe}`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.seoDesc || p.excerpt, image: p.cover ? [absImg(p.cover, CANON)] : undefined,
    datePublished: p.publishAt || undefined, dateModified: p.updated, author: { '@type': 'Person', name: p.author || AUTHOR }, mainEntityOfPage: link };
  return html(page(sh, { title: p.seoTitle || p.title, desc: p.seoDesc || p.excerpt || settings.description, image: absImg(p.cover || settings.shareImage, CANON), canonical: link, noindex: preview, body, jsonld }), 200, preview);
}
export function notFound(sh) {
  return html(page(sh, { title: 'Post not found', desc: '', canonical: CANON + '/blog/', noindex: true,
    body: '<section class="bl-hero"><div class="wrap"><p class="script">Oops</p><h1>That post isn\'t here</h1><p class="lead">It may have moved or is not published yet.</p><p style="margin-top:22px"><a class="btn" href="/blog/">See all posts <span class="arr">&rarr;</span></a></p></div></section>' }), 404);
}

export async function sitemap(env) {
  const all = await livePosts(await bdb(env));
  const x = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${CANON}/blog/</loc></url>${all.map((p) => `<url><loc>${CANON}/blog/${esc(p.slug)}/</loc><lastmod>${esc((p.updated || '').slice(0, 10))}</lastmod></url>`).join('')}</urlset>`;
  return new Response(x, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
export async function rss(env) {
  const all = (await livePosts(await bdb(env))).slice(0, 30);
  const x = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc((BLOG.script || 'Blog') + ' · ' + (settings.name || ''))}</title><link>${CANON}/blog/</link><description>${esc(BLOG.intro || '')}</description>${all.map((p) => `<item><title>${esc(p.title)}</title><link>${CANON}/blog/${esc(p.slug)}/</link><guid>${CANON}/blog/${esc(p.slug)}/</guid><pubDate>${new Date(p.publishAt).toUTCString()}</pubDate><category>${esc(p.cat)}</category><description>${esc(p.excerpt)}</description></item>`).join('')}</channel></rss>`;
  return new Response(x, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
