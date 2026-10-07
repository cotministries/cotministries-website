/* Shared renderer: used by build.js (Node) and the admin live preview (browser). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SiteRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Small markdown: paragraphs, **bold**, *italic*, [links](url), "- " lists, line breaks.
  function md(src) {
    if (!src) return '';
    const inline = (t) => esc(t)
      .replace(/(^|[\s>])(https:\/\/(?:chat\.whatsapp\.com|wa\.me)\/[\w\-\/?=&.]+)/g, (m, pre, u) => `${pre}<a class="btn btn-whatsapp" href="${u}" target="_blank" rel="noopener"><span class="wa-ico">💬</span>Join WhatsApp Group</a>`)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, (m, a, h) => `<a href="${h}"${/(chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com)/.test(h) ? ' class="btn btn-whatsapp"' : ''}${/^https?:/.test(h) ? ' target="_blank" rel="noopener"' : ''}>${a}</a>`);
    return String(src).trim().split(/\n\s*\n/).map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*] /.test(l))) {
        return '<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('') + '</ul>';
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    }).join('');
  }

  function videoEmbed(url, file) {
    if (file && !url) return `<video src="${esc(file)}" controls playsinline preload="metadata"></video>`;
    url = String(url || '').trim();
    if (!url) return '';
    let m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/)))
      return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Video" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    if ((m = url.match(/vimeo\.com\/(\d+)/)))
      return `<div class="video"><iframe src="https://player.vimeo.com/video/${m[1]}" title="Video" allowfullscreen loading="lazy"></iframe></div>`;
    if (/facebook\.com|fb\.watch/.test(url))
      return `<div class="video"><iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false" title="Video" allowfullscreen loading="lazy"></iframe></div>`;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video src="${esc(url)}" controls playsinline preload="metadata"></video>`;
    return `<p><a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener">Watch video</a></p>`;
  }

  const img = (src, alt, cls) => src ? `<img src="${esc(src)}" alt="${esc(alt || '')}"${cls ? ` class="${cls}"` : ''} loading="lazy">` : '';
  const isWa = (u) => /(chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com)/.test(String(u || ''));
  const btn = (b, style) => (b && b.label && b.url)
    ? `<a class="btn ${isWa(b.url) ? 'btn-whatsapp' : (style || 'btn-primary')}" href="${esc(b.url)}"${/^https?:/.test(b.url) ? ' target="_blank" rel="noopener"' : ''}>${isWa(b.url) ? '<span class="wa-ico">💬</span>' : ''}${esc(b.label)}</a>` : '';
  // WhatsApp buttons are always green; the first other button is gold, the rest outlined.
  const btns = (list) => {
    if (!list || !list.length) return '';
    let n = 0;
    return `<div class="btn-row">${list.map((b) => btn(b, isWa(b && b.url) ? '' : (n++ === 0 ? 'btn-primary' : 'btn-outline'))).join('')}</div>`;
  };
  const head = (s) => (s.heading ? `<h2 class="sec-title">${esc(s.heading)}</h2>` : '') +
    (s.subheading ? `<p class="sec-sub">${esc(s.subheading)}</p>` : '');
  const wrap = (s, inner, extra) =>
    `<section class="block block-${s.type} bg-${s.background || 'light'} ${extra || ''}"><div class="container">${inner}</div></section>`;


  // ---------- News & updates ----------
  const cleanFont = (n) => String(n || '').replace(/[^A-Za-z0-9 \-]/g, '').trim();
  // font choice: 'heading' | 'body' | 'other' (+ name)
  function fontCss(choice, name) {
    if (choice === 'body') return 'font-family:var(--body-font)';
    if (choice === 'heading') return 'font-family:var(--head-font)';
    if (choice === 'other' && cleanFont(name)) return `font-family:'${cleanFont(name)}',var(--body-font)`;
    return '';
  }
  function postFonts(posts) {
    const out = [];
    (posts || []).forEach((p) => [[p.titleFont, p.titleFontName], [p.textFont, p.textFontName]].forEach(([c, n]) => { const f = c === 'other' && cleanFont(n); if (f && !out.includes(f)) out.push(f); }));
    return out;
  }
  const niceDate = (d) => { if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T12:00:00'); return isNaN(x) ? esc(d) : x.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); };
  const postUrl = (p) => `/updates/${p.slug}/`;
  const styleAttr = (css) => css ? ` style="${esc(css)}"` : '';
  function postCard(p) {
    const intro = p.summary || String(p.body || '').replace(/[*_#>\[\]()]/g, '').split(/\n\s*\n/)[0].slice(0, 220);
    return `<article class="news-card">${p.image ? `<a class="news-img" href="${postUrl(p)}">${img(p.image, p.title)}</a>` : ''}<div class="news-body"><time datetime="${esc(String(p.date || '').slice(0, 10))}">${niceDate(p.date)}</time><h3${styleAttr(fontCss(p.titleFont, p.titleFontName))}><a href="${postUrl(p)}">${esc(p.title)}</a></h3>${intro ? `<p${styleAttr(fontCss(p.textFont, p.textFontName))}>${esc(intro)}${!p.summary && String(p.body || '').length > 220 ? '…' : ''}</p>` : ''}<a class="news-more" href="${postUrl(p)}">Read more →</a></div></article>`;
  }
  function renderPost(p) {
    return `<article class="block bg-white news-post"><div class="container narrow">
<a class="news-back" href="/updates/">← All news &amp; updates</a>
<time datetime="${esc(String(p.date || '').slice(0, 10))}">${niceDate(p.date)}</time>
<h1${styleAttr(fontCss(p.titleFont, p.titleFontName))}>${esc(p.title || '')}</h1>
${p.image ? `<div class="news-hero">${img(p.image, p.title)}</div>` : ''}
<div class="prose"${styleAttr(fontCss(p.textFont, p.textFontName))}>${md(p.body)}</div>
${p.video ? videoEmbed(p.video) : ''}${btns(p.buttons)}</div></article>`;
  }
  const blocks = {
    hero(s) {
      if (s.style === 'image') {
        return `<section class="block block-hero hero-image"><div class="container-wide">${img(s.image, s.heading)}</div>${
          (s.buttons && s.buttons.length) ? `<div class="container center">${btns(s.buttons)}</div>` : ''}</section>`;
      }
      return `<section class="block block-hero hero-overlay" style="background-image:url('${esc(s.image || '')}')"><div class="hero-shade"></div><div class="container hero-inner">${
        s.heading ? `<h1>${esc(s.heading)}</h1>` : ''}${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}${btns(s.buttons)}</div></section>`;
    },
    text(s) {
      return wrap(s, `<div class="narrow ${s.align === 'center' ? 'center' : ''}">${head(s)}<div class="prose">${md(s.body)}</div>${btns(s.buttons)}</div>`);
    },
    imageText(s) {
      return wrap(s, `<div class="split ${s.imageSide === 'right' ? 'split-right' : ''} ${s.imageSize === 'large' ? 'img-large' : ''}"><div class="split-img">${img(s.image, s.heading)}</div><div class="split-body">${head(s)}<div class="prose">${md(s.body)}</div>${btns(s.buttons)}</div></div>`);
    },
    cards(s) {
      const items = (s.items || []).map((c) => `<article class="card">${img(c.image, c.title)}<div class="card-body"><h3>${esc(c.title)}</h3><div class="prose">${md(c.text)}</div><div class="card-btns">${btn(c.button)}${(c.buttons || []).map((b) => btn(b, 'btn-outline')).join('')}</div></div></article>`).join('');
      return wrap(s, `${head(s)}<div class="cards cols-${Math.min((s.items || []).length || 1, 3)}">${items}</div>`);
    },
    list(s) {
      const items = (s.items || []).map((i) => `<li><span class="tick">✦</span><div><strong>${esc(i.title)}</strong>${i.text ? `<span>${esc(i.text)}</span>` : ''}</div></li>`).join('');
      return wrap(s, `<div class="narrow">${head(s)}<ul class="feature-list">${items}</ul>${btns(s.buttons)}</div>`);
    },
    products(s) {
      const items = (s.items || []).map((i) => `<article class="product">${img(i.image, i.name)}<div class="product-body"><h3>${esc(i.name)}</h3><span class="price">${esc(i.price)}</span>${i.description ? `<p>${esc(i.description)}</p>` : ''}${i.options ? `<p class="options">${esc(i.options)}</p>` : ''}${i.buyUrl ? btn({ label: i.buyLabel || 'Buy now', url: i.buyUrl }) : `<span class="soldout">${esc(i.unavailableText || 'Coming soon')}</span>`}</div></article>`).join('');
      return wrap(s, `${head(s)}<div class="products">${items}</div>${md(s.note) ? `<div class="prose note center">${md(s.note)}</div>` : ''}`);
    },
    pricing(s) {
      const items = (s.items || []).map((i) => `<div class="price-row"><div><h3>${esc(i.name)}</h3>${i.description ? `<p>${esc(i.description)}</p>` : ''}${i.duration ? `<small>${esc(i.duration)}</small>` : ''}</div><div class="price-right"><span class="price">${esc(i.price)}</span>${btn(i.button, 'btn-small')}</div></div>`).join('');
      return wrap(s, `<div class="narrow">${head(s)}<div class="price-list">${items}</div>${md(s.note) ? `<div class="prose note">${md(s.note)}</div>` : ''}</div>`);
    },
    quote(s) {
      return wrap(s, `<blockquote class="quote"><p>“${esc(s.quote)}”</p>${s.source ? `<cite>${esc(s.source)}</cite>` : ''}</blockquote>`, 'center');
    },
    testimonials(s) {
      const items = (s.items || []).map((t) => `<figure class="testimonial"><blockquote>“${esc(t.quote)}”</blockquote><figcaption>— ${esc(t.name)}</figcaption></figure>`).join('');
      return wrap(s, `${head(s)}<div class="cards cols-${Math.min((s.items || []).length || 1, 3)}">${items}</div>`);
    },
    faq(s) {
      const items = (s.items || []).map((f) => `<details><summary>${esc(f.question)}</summary><div class="prose">${md(f.answer)}</div></details>`).join('');
      return wrap(s, `<div class="narrow">${head(s)}<div class="faq">${items}</div></div>`);
    },
    gallery(s) {
      const items = (s.images || []).map((g) => `<figure>${img(g.image, g.caption)}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('');
      return wrap(s, `${head(s)}<div class="gallery">${items}</div>`);
    },
    image(s) {
      return wrap(s, `${head(s)}<div class="single-img ${s.width === 'full' ? '' : 'narrow'}">${img(s.image, s.alt || s.heading)}</div>${btns(s.buttons)}`, 'center');
    },
    video(s) {
      return wrap(s, `${head(s)}<div class="narrow">${videoEmbed(s.url, s.file)}${s.caption ? `<p class="caption">${esc(s.caption)}</p>` : ''}</div>`, 'center');
    },
    embed(s) {
      const inner = s.url
        ? `<iframe src="${esc(s.url)}" style="height:${parseInt(s.height, 10) || 700}px" loading="lazy" allowfullscreen></iframe>`
        : (s.code || '');
      return wrap(s, `${head(s)}<div class="embed ${s.width === 'full' ? '' : 'narrow'}">${inner}</div>`);
    },
    downloads(s) {
      const items = (s.files || []).map((f) => f.file ? `<a class="download" href="${esc(f.file)}" target="_blank" rel="noopener" download><span>⬇</span>${esc(f.label || 'Download')}</a>` : '').join('');
      return wrap(s, `<div class="narrow">${head(s)}${md(s.text) ? `<div class="prose">${md(s.text)}</div>` : ''}<div class="downloads">${items}</div></div>`);
    },
    cta(s) {
      return `<section class="block block-cta bg-${s.background || 'dark'}"><div class="container cta-inner"><div>${s.heading ? `<h2 class="sec-title">${esc(s.heading)}</h2>` : ''}${s.text ? `<p>${esc(s.text)}</p>` : ''}</div>${btns(s.buttons)}</div></section>`;
    },
    news(s, site) {
      let posts = (site.news || []);
      if (s.limit) posts = posts.slice(0, Number(s.limit));
      const inner = posts.length ? `<div class="news-grid">${posts.map(postCard).join('')}</div>` : `<p class="center note">${esc(s.emptyText || 'No updates yet. Check back soon!')}</p>`;
      return wrap(s, `${head(s)}${inner}${s.limit && (site.news || []).length > Number(s.limit) ? `<div class="btn-row center">${btn({ label: s.moreLabel || 'See all updates', url: '/updates/' }, 'btn-outline')}</div>` : ''}`);
    },
    contact(s, site) {
      const c = site.contact || {};
      const rows = [
        c.address && `<li><span>📍</span>${esc(c.address)}</li>`,
        c.serviceTimes && `<li><span>🕐</span>${esc(c.serviceTimes)}</li>`,
        c.phone && `<li><span>📞</span><a href="tel:${esc(c.phone.replace(/[^+\d]/g, ''))}">${esc(c.phone)}</a></li>`,
        c.email && `<li><span>✉️</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>`,
      ].filter(Boolean).join('');
      const form = s.showForm === false ? '' : `<form class="contact-form" name="contact" method="POST" data-netlify="true" netlify-honeypot="company"><input type="hidden" name="form-name" value="contact"><p hidden><input name="company"></p><label>Name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Message<textarea name="message" rows="5" required></textarea></label><button class="btn btn-primary" type="submit">Send message</button></form>`;
      return wrap(s, `${head(s)}<div class="split"><div><ul class="contact-list">${rows}</ul></div><div>${form}</div></div>`);
    },
  };

  function renderSections(sections, site) {
    return (sections || []).map((s) => {
      const fn = blocks[s.type];
      try { return fn ? fn(s, site || {}) : ''; } catch (e) { return `<!-- block ${s.type} failed: ${esc(e.message)} -->`; }
    }).join('\n');
  }

  function themeCss(t) {
    t = t || {};
    return `:root{--primary:${t.primary || '#d4a437'};--dark:${t.dark || '#111'};--light:${t.light || '#faf6ee'};--text:${t.text || '#1d1d1f'};--head-font:'${t.headingFont || 'Cinzel'}',serif;--body-font:'${t.bodyFont || 'Inter'}',sans-serif;}`;
  }

  function fontsHref(t, extra) {
    t = t || {};
    const names = [t.headingFont || 'Cinzel', t.bodyFont || 'Inter'];
    (extra || []).forEach((f) => { if (f && !names.includes(f)) names.push(f); });
    const fam = names.map((f) => 'family=' + f.replace(/ /g, '+') + ':wght@400;600;700');
    return 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap';
  }

  function renderPage(page, site) {
    site = site || {};
    const t = site.theme || {};
    const nav = (site.nav || []).map((n) => `<a href="${esc(n.url)}">${esc(n.label)}</a>`).join('');
    const social = (site.social || []).map((n) => `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.label)}</a>`).join(' · ');
    const c = site.contact || {};
    const title = page.slug === 'index' ? (site.seoTitle || site.name) : `${page.title} | ${site.name}`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(page.description || site.description || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="${fontsHref(t, postFonts(page.post ? [page.post] : (page.sections || []).some((x) => x.type === 'news') ? site.news : []))}">
<link rel="stylesheet" href="/styles.css"><style>${themeCss(t)}</style>${site.favicon || site.logo ? `<link rel="icon" href="${esc(site.favicon || site.logo)}">` : ''}
<script>if(/(invite|recovery|confirmation|email_change)_token=/.test(location.hash))location.replace('/admin/'+location.hash);</script></head><body>
<header class="site-header"><div class="container nav-bar"><a class="brand" href="/">${site.logo ? img(site.logo, site.name, 'logo') : ''}<span>${esc(site.name)}</span></a>
<input type="checkbox" id="nav-toggle" hidden><label for="nav-toggle" class="nav-burger" aria-label="Menu">☰</label><nav class="nav">${nav}</nav></div></header>
<main>${page.post ? renderPost(page.post) : renderSections(page.sections, site)}</main>
<footer class="site-footer"><div class="container footer-grid"><div><strong class="brand-foot">${esc(site.name)}</strong><p>${esc(site.tagline || '')}</p></div>
<div>${c.phone ? `<p>${esc(c.phone)}</p>` : ''}${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}${social ? `<p>${social}</p>` : ''}</div></div>
<div class="container copy">© ${new Date().getFullYear()} ${esc(site.name)}</div></footer></body></html>`;
  }

  return { renderPage, renderSections, renderPost, postFonts, themeCss, fontsHref, md };
});
