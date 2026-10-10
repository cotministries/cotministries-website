// Turns content JSON into HTML. Used by build.js and by the editor's live preview (window.SiteRender).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SiteRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const money = (n) => '$' + (Math.round(Number(n) * 100) / 100).toFixed(2).replace(/\.00$/, '');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };
  const list = (v) => (Array.isArray(v) ? v : []).map((x) => (x && typeof x === 'object' && 'value' in x ? x.value : x)).filter((x) => x !== '' && x != null);
  const shown = (x) => x && x.show !== false;

  // Small markdown: paragraphs, - lists, **bold**, *italic*, [text](url). Dollar amounts can be highlighted.
  function inline(t, hl) {
    let s = esc(t);
    if (hl) s = s.replace(/\$\d[\d,]*(?:\.\d\d)?/g, (m) => `<span class="hl">${m}</span>`);
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${a}</a>`);
  }
  function md(text, hl) {
    if (!text) return '';
    return String(text).trim().split(/\n\s*\n/).map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return '<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*]\s+/, ''), hl) + '</li>').join('') + '</ul>';
      return '<p>' + lines.map((l) => inline(l, hl)).join('<br>') + '</p>';
    }).join('');
  }
  // Text sizes chosen in the studio (A− / A+ next to a text box) are kept as "_sz": { fieldName: 1.3 } beside the text.
  // Before drawing, those texts get invisible markers (one per line); afterwards the markers become <span style="font-size:1.3em">.
  // Markers that end up inside tags, <title>, <script>… are simply removed, so nothing can break.
  const SZA = '', SZB = '', SZC = '';
  const okSz = (v) => { v = Number(v); return v >= 0.5 && v <= 2.5 && v !== 1 ? v : 0; };
  function markText(t, v) {
    return String(t).split('\n').map((l) => {
      if (!l.trim()) return l;
      const m = l.match(/^(\s*(?:[-*]|\d+[.)])\s+)(.*)$/);
      return m ? m[1] + SZA + v + SZB + m[2] + SZC : SZA + v + SZB + l + SZC;
    }).join('\n');
  }
  function applySizes(o) {
    if (Array.isArray(o)) return o.map(applySizes);
    if (!o || typeof o !== 'object') return o;
    const out = {}, sz = o._sz && typeof o._sz === 'object' ? o._sz : null;
    for (const k of Object.keys(o)) {
      if (k === '_sz') continue;
      const v = o[k], n = sz ? okSz(sz[k]) : 0;
      out[k] = n && typeof v === 'string' && v.trim() ? markText(v, n) : applySizes(v);
    }
    return out;
  }
  const BLOCKEND = /^<\/(p|h[1-6]|li|ul|ol|div|td|th|blockquote|figcaption|figure|label|button|section|header|footer|nav|main|article|aside|cite|q|dd|dt)>$/i;
  function finishSizes(html) {
    if (html.indexOf(SZA) < 0 && html.indexOf(SZC) < 0) return html;
    const strip = (x) => x.replace(/[^]*|/g, '');
    html = html.replace(/<(script|style|title|textarea|option|select)\b[\s\S]*?<\/\1>/gi, strip).replace(/<[^>]*>/g, strip);
    let depth = 0;
    return html.replace(/([\d.]+)||<\/[a-z0-9]+>/gi, (m, v) => {
      if (v) { depth++; return `<span class="fz" style="font-size:${Number(v)}em">`; }
      if (m === SZC) { if (!depth) return ''; depth--; return '</span>'; }
      if (depth && BLOCKEND.test(m)) { const c = '</span>'.repeat(depth); depth = 0; return c + m; }
      return m;
    });
  }
  const icon = (name, cls) => `<svg class="${cls || 'ico'}" aria-hidden="true"><use href="#i-${esc(name || 'crown')}"/></svg>`;
  const arrow = ' <span class="arr">&rarr;</span>';
  const btn = (b, cls) => (b && b.label && b.url ? `<a class="btn ${cls || ''}" href="${esc(b.url)}"${/^https?:/.test(b.url) ? ' target="_blank" rel="noopener"' : ''}>${esc(b.label)}${arrow}</a>` : '');
  const btns = (arr, cls) => { const h = (arr || []).map((b) => btn(b, cls)).join(''); return h ? `<div class="controls">${h}</div>` : ''; };
  const secHead = (s, extra) => (s.heading || s.sub || extra ? `<div class="sec-head"><div>${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}${s.sub ? `<p class="caps-sub">${esc(s.sub)}</p>` : ''}</div>${extra || ''}</div>` : '');
  const bgClass = (bg) => ({ white: ' white', dark: ' dark', blush: ' blush', red: ' red-sec', navy: ' dark' }[bg] || '');
  const fmtMin = (m) => { m = Number(m) || 0; const h = Math.floor(m / 60), r = m % 60; return (h ? h + ' hr' + (h > 1 ? 's' : '') : '') + (h && r ? ' ' : '') + (r ? r + ' min' : ''); };
  const honeypot = '<p hidden><label>Leave empty <input name="company"></label></p>';
  const netlifyForm = (name, cls, inner, extra) => `<form class="${cls}" name="${name}" method="POST" action="/api/form"${extra || ''}><input type="hidden" name="form-name" value="${name}">${honeypot}${inner}</form>`;
  const options = (arr) => list(arr).map((o) => `<option>${esc(o)}</option>`).join('');
  // "How did you hear about us?" – required on every form. Question + options editable in Settings.
  let curSite = {};
  const HEARD = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Google search', 'Friend or family', 'Church or event', 'Other'];
  const heardOpts = () => { const o = list(curSite.heardOptions); return (o.length ? o : HEARD).map((x) => `<option>${esc(x)}</option>`).join(''); };
  const heardQ = () => curSite.heardLabel || 'How did you hear about us?';
  // Picking "Other" shows a text box (static/site.js) so they can type where they heard about us.
  const heardOther = () => `<input name="heard_about_other" class="heard-other" placeholder="Please tell us where" aria-label="Where did you hear about us?" maxlength="120" hidden>`;
  const heard = () => `<label>${esc(heardQ())}<select name="heard_about" required><option value="">Please choose…</option>${heardOpts()}</select>${heardOther()}</label>`;
  const heardCompact = () => `<select name="heard_about" required aria-label="${esc(heardQ())}"><option value="">${esc(heardQ())}</option>${heardOpts()}</select>${heardOther()}`;

  // Packages: services to pre-select. New editor field "includes" (list); older pages use a comma-separated "services" text.
  const pkgServices = (p) => { const a = Array.isArray(p.includes) ? p.includes.map((x) => String(x && x.value != null ? x.value : x).trim()) : []; return (a.length ? a : String(p.services || '').split(',')).map((x) => x.trim()).filter(Boolean); };
  // Wedding inquiry defaults (each list is editable on the page in the editor)
  const WEDDING_HEARD = ['Instagram', 'Facebook', 'YouTube', 'TikTok', 'The Knot/The Wire', 'Speaking Event', 'Other'];

  /* ---------- shared data helpers ---------- */
  // A bridal package with its own appointment length is booked as one item (not as a bundle of separate services).
  const pkgKey = (p) => 'Package: ' + String(p.title || '').trim();
  const pkgMinutes = (p) => Math.max(0, Math.round(Number(p.minutes) || 0));
  // services named in a shown package (also when hidden from customers: they can then only be booked inside that package)
  const pkgUsed = (data) => new Set(((data && data.packages) || []).filter((p) => p && p.show !== false).flatMap(pkgServices));
  function standalonePkgs(data) { return ((data && data.packages) || []).filter((p) => p && p.show !== false && p.title && pkgMinutes(p) > 0 && !pkgServices(p).length).map((p) => ({ key: pkgKey(p), title: p.title, min: pkgMinutes(p), features: list(p.features) })); }
  function bookList(data) { return (data.books || []).filter(shown).map((b) => Object.assign({ id: slug(b.title) }, b)); }
  // Font picked per text line in the editor: heading / body / script font from Settings, or any other font by name.
  const cleanFont = (n) => String(n || '').replace(/[^A-Za-z0-9 \-]/g, '').trim();
  function fontCss(l) {
    if (!l || !l.font || l.font === 'display') return '';
    if (l.font === 'body') return 'font-family:var(--sans)';
    if (l.font === 'script') return 'font-family:var(--script)';
    if (l.font === 'other' && cleanFont(l.fontName)) return `font-family:'${cleanFont(l.fontName)}',var(--display)`;
    return '';
  }
  function extraFonts(sections) {
    const out = [];
    (sections || []).forEach((sec) => (sec && sec.lines || []).forEach((l) => { const n = l && l.font === 'other' && cleanFont(l.fontName); if (n && !out.includes(n)) out.push(n); }));
    return out;
  }
  // Big banner lines: any number, each White / Red shiny / White shiny. Long words shrink so the shine always covers the whole word.
  function bigLines(s) {
    const lines = (s.lines && s.lines.length) ? s.lines : [{ text: s.line1, style: 'white' }, { text: s.line2, style: 'red' }];
    return lines.filter((l) => l && String(l.text || '').trim()).map((l) => {
      const longest = Math.max.apply(null, String(l.text).replace(/\uE000[\d.]*\uE001|\uE002/g, '').trim().split(/\s+/).map((w) => w.length));
      const scale = longest > 9 ? Math.max(0.42, 9 / longest) : 1;
      const cls = l.style === 'red' ? 'shine' : l.style === 'whiteShine' ? 'shine shine-white' : 'white';
      const css = [scale < 1 ? `font-size:${scale.toFixed(2)}em` : '', fontCss(l)].filter(Boolean).join(';');
      return `<span class="bl ${cls}${l.font === 'script' ? ' bl-script' : ''}"${css ? ` style="${esc(css)}"` : ''}>${esc(l.text)}</span>`;
    }).join(' ');
  }
  function eventList(data) { return (data.events || []).filter(shown).map((e) => Object.assign({ id: slug(e.title + '-' + e.date) }, e)).sort((a, b) => String(a.date).localeCompare(String(b.date))); }
  const minPrice = (b) => Math.min.apply(null, (b.formats || []).map((f) => num(f.price)).filter((n) => n != null).concat([Infinity]));
  function cover(b) {
    const front = b.cover ? `<img src="${esc(b.cover)}" alt="">` : `${icon('crown', '')}<div><div class="ct">${esc(b.title)}</div><div class="cs">${esc(b.subtitle || '')}</div></div><div class="ca">${esc(b.author || 'City Of Testimonies')}</div>`;
    const back = b.realCover ? `<img src="${esc(b.realCover)}" alt="Cover of ${esc(b.title)}">` : `<div class="ph"><small>Real cover</small><b>${esc(b.title)}</b><small>Add the cover photo in the editor</small></div>`;
    return `<div class="cover-wrap" data-open="${esc(b.id)}" role="button" tabindex="0" aria-label="View ${esc(b.title)}"><div class="flip"><div class="cover front cv-${esc(b.coverStyle || 'espresso')}${b.cover ? ' has-img' : ''}">${b.badge ? `<span class="badge">${esc(b.badge)}</span>` : ''}${front}</div><div class="cover back">${back}</div></div></div>`;
  }
  function bookCard(b) {
    const f = (b.formats || []).filter((x) => num(x.price) != null);
    const mp = minPrice(b);
    return `<article class="book" data-cat="${esc(b.category || 'Book')}" data-price="${mp}" data-title="${esc(b.title)}">${cover(b)}<span class="bk">${esc(b.category || 'Book')}</span><h3 class="bt">${esc(b.title)}</h3><p class="bd">${esc(b.description || '')}</p>${mp < Infinity ? `<span class="bp">${f.length > 1 ? 'from ' : ''}${money(mp)}</span>` : ''}
<div class="row">${f.length ? `<select aria-label="Format for ${esc(b.title)}">${f.map((x, i) => `<option value="${i}">${esc(x.name)} · ${money(x.price)}</option>`).join('')}</select><button class="btn btn-sm" type="button" data-add="${esc(b.id)}">Add</button>` : '<span class="note">Coming soon</span>'}</div></article>`;
  }
  function eventCard(e) {
    const d = new Date(String(e.date) + 'T12:00:00');
    const day = isNaN(d) ? '' : d.getDate(), mon = isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short' }), yr = isNaN(d) ? '' : d.getFullYear();
    const t = (e.tickets || []).filter((x) => x.name && num(x.price) != null);
    const buy = e.free || !t.length
      ? `<span class="note">Free event</span><button class="btn btn-sm" type="button" data-rsvp="${esc(e.id)}">RSVP</button>`
      : `<select aria-label="Ticket type for ${esc(e.title)}">${t.map((x, i) => `<option value="${i}">${esc(x.name)} · ${money(x.price)}</option>`).join('')}</select><button class="btn btn-sm" type="button" data-tix="${esc(e.id)}">Add tickets</button>`;
    const rsvp = e.free || !t.length ? netlifyForm('rsvp', 'rsvp-form', `<input type="hidden" name="event" value="${esc(e.title)} (${esc(e.date)})"><input name="name" required placeholder="Your name" aria-label="Your name"><input type="email" name="email" required placeholder="Email" aria-label="Email"><input type="tel" name="phone" placeholder="Phone (optional)" aria-label="Phone">${heardCompact()}<button class="btn btn-sm" type="submit">Confirm RSVP</button>`, ` id="rsvp-${esc(e.id)}" hidden`) : '';
    return `<article class="ev" id="${esc(e.id)}" data-kind="${esc(e.kind || '')}" data-date="${esc(e.date || '')}"><div class="date"><b>${day}</b><span>${mon} ${yr}</span></div><div style="min-width:0">${e.kind ? `<span class="tag">${esc(e.kind)}</span>` : ''}<h3>${esc(e.title)}</h3><p class="where">${esc([e.place, e.time].filter(Boolean).join(' · '))}</p>${e.description ? `<p class="note" style="margin-top:6px">${esc(e.description)}</p>` : ''}${rsvp}</div><div class="buy">${buy}</div></article>`;
  }


  // Ways to pay after a form (Settings → Payments): card online (Stripe) and other ways (Cash App, Zelle…)
  const CARD = 'Card (pay online now)';
  const payWays = (site) => { const P = site.payment || {}; return (P.card === false ? [] : [CARD]).concat((P.others || []).filter((o) => o && o.name).map((o) => o.name)); };
  const paySelect = (site, label) => { const w = payWays(site); return w.length ? `<label>${esc(label || 'How would you like to pay?')}<select name="payment" required>${w.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>` : ''; };

  /* ---------- blocks ---------- */
  const blocks = {
    banner(s) {
      return `<section class="hero hb"><svg class="swoosh" viewBox="0 0 1440 46" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 0h1440v8C1100 46 700 16 420 30 250 38 110 30 0 22z"/></svg>
${s.image ? `<img class="hb-img" src="${esc(s.image)}" alt="${esc(s.alt || '')}">` : '<div class="hb-img hb-empty"></div>'}
<div class="hb-copy"><div class="hero-copy">${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}<h1 class="big">${bigLines(s)}</h1><script>(function(h){if(!h)return;function f(){var w=h.clientWidth;[].forEach.call(h.querySelectorAll('.bl'),function(b){var o=b.getAttribute('data-fs');if(o==null){o=b.style.fontSize||'';b.setAttribute('data-fs',o);}b.style.fontSize=o;if(w>0&&b.scrollWidth>w+1){b.style.fontSize=(parseFloat(getComputedStyle(b).fontSize)*w/b.scrollWidth*0.97).toFixed(1)+'px';}});}f();addEventListener('resize',f);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(f);addEventListener('load',f);})(document.currentScript&&document.currentScript.previousElementSibling)</script>${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}${s.script ? `<p class="script">${esc(s.script)}</p>` : ''}${btn(s.button)}</div></div></section>`;
    },
    tiles(s) {
      return `<div class="tiles">${(s.items || []).map((t, i) => `<article class="tile${i % 2 ? ' r' : ''}">${icon(t.icon, 'wm')}${icon(t.icon)}<h3>${esc(t.title)}</h3>${t.sub ? `<p class="caps-sub">${esc(t.sub)}</p>` : ''}<p>${esc(t.text || '')}</p>${btn(t.button, 'btn-ghost btn-sm')}</article>`).join('')}</div>`;
    },
    journey(s) {
      const signup = s.showSignup !== false;
      return `<div class="journey${signup ? '' : ' solo'}"><div class="wrap"><div><h2 class="script">${esc(s.title || '')}</h2><p>${esc(s.text || '')}</p>${btn(s.button)}</div>
${signup ? `<div class="movement"><h2 class="script">${esc(s.newsletterTitle || 'Join the Movement')}</h2><p>${esc(s.newsletterText || '')}</p><form class="sub-form nl-quick" method="POST" action="/api/subscribe" novalidate>${honeypot}<input type="email" name="email" required placeholder="Enter your email address" aria-label="Email address"><button type="submit">${esc(s.newsletterButton || 'Subscribe')}</button></form><p class="nl-quick-msg" role="status" hidden></p></div>` : ''}</div></div>`;
    },
    // Where the blog page content goes (dist/blog-shell.html is filled in by the blog functions)
    blogSlot() { return '<!--BLOG-->'; },
    // "Latest from the blog": cards filled in by site.js from /api/blog-latest
    blogLatest(s) {
      return `<section class="sec${bgClass(s.bg || 'white')} bl-latest" data-latest="${Math.min(6, Math.max(1, Number(s.count) || 3))}"><div class="wrap">${secHead(s.heading || s.sub ? s : { heading: 'Latest from the blog' }, `<a class="btn btn-line btn-sm" href="/blog/">${esc(s.buttonLabel || 'All posts')} <span class="arr">&rarr;</span></a>`)}
<div class="bl-grid" aria-live="polite"></div></div></section>`;
    },
    newsletter(s) {
      // Newsletter sign-up (gold-framed card). Sign-ups land in /admin → Newsletter.
      const perks = list(s.perks);
      const ints = list(s.interests).length ? list(s.interests) : ['Ministry', 'Beauty', 'Events & new books'];
      return `<section class="nl-band${bgClass(s.bg || 'blush')}" id="${esc(s.anchor || 'newsletter')}"><div class="wrap nl-in"><div class="nl-copy">
${s.script !== '' ? `<p class="script nl-script">${esc(s.script || 'Letters from Niki')}</p>` : ''}<h2>${esc(s.heading || 'A word of encouragement in your inbox')}</h2>
${s.text ? `<div class="nl-text">${md(s.text)}</div>` : ''}${perks.length ? `<ul class="nl-perks">${perks.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</div>
<div class="nl-card"><form class="nl-form" method="POST" action="/api/subscribe" novalidate>${honeypot}<input type="hidden" name="need_name" value="1"><input type="hidden" name="page" class="nl-page">
<div class="nl-grid"><label>First name<input name="first_name" autocomplete="given-name" required></label><label>Last name<input name="last_name" autocomplete="family-name" required></label>
<label class="nl-full">Email<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label>
${s.showInterests === false ? '' : `<fieldset class="nl-full"><legend>${esc(s.interestsLabel || "I'd love to hear about")}</legend><div class="nl-chips">${ints.map((i) => `<label class="nl-chip"><input type="checkbox" name="interests" value="${esc(i)}"><span>${esc(i)}</span></label>`).join('')}</div></fieldset>`}</div>
<p class="nl-err" role="alert" hidden></p><button class="btn" type="submit">${esc(s.button || 'Subscribe')}${arrow}</button>
${s.fine !== '' ? `<p class="nl-fine">${esc(s.fine || 'One or two emails a month. Unsubscribe anytime with one click.')}</p>` : ''}</form>
<div class="nl-done" hidden><p class="script">${esc(s.doneTitle || "You're on the list")}</p><p class="nl-done-text" data-text="${esc(s.doneText || 'Thank you, {name}! Watch your inbox for letters from Niki.')}"></p></div></div></div></section>`;
    },
    featuredBooks(s, site, data) {
      const items = bookList(data).filter((b) => b.featured);
      if (!items.length) return '';
      return `<section class="sec white"><div class="wrap">${secHead(s, btn(s.button, 'btn-line btn-sm'))}<div class="books">${items.map(bookCard).join('')}</div></div></section>`;
    },
    events(s, site, data) {
      let items = eventList(data);
      if (s.limit) items = items.slice(0, Number(s.limit));
      const red = s.style === 'red';
      if (!items.length && !s.emptyText) return '';
      const kinds = [...new Set(items.map((e) => e.kind).filter(Boolean))];
      const chips = s.filters && kinds.length > 1 ? `<div class="controls ev-filters" style="margin-bottom:24px"><button class="chip on" type="button" data-ec="All">All events</button>${kinds.map((k) => `<button class="chip" type="button" data-ec="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : '';
      return `<section class="sec${red ? '' : ' dark'}"><div class="wrap">${secHead(s, btn(s.button, red ? 'btn-line btn-sm' : 'btn-ghost btn-sm'))}${chips}<div class="events ${red ? 'ev-red' : 'ev-light'}" data-limit="${esc(s.limit || '')}">${items.map(eventCard).join('')}</div><p class="note ev-empty"${items.length ? ' hidden' : ''}>${esc(s.emptyText || '')}</p></div></section>`;
    },
    testimonies(s, site, data) {
      const items = (data.testimonies || []).filter(shown).filter((t) => t.quote);
      if (!items.length) return '';
      return `<section class="sec${bgClass(s.bg)}"><div class="wrap">${secHead(s)}<div class="grid g3">${items.map((t) => `<figure class="testi" style="margin:0"><p>${esc(t.quote)}</p><b>${esc(t.name || '')}</b></figure>`).join('')}</div></div></section>`;
    },
    pageBanner(s, site) {
      const title = s.useSignature && site.signatureLight ? `<h1 class="sig-h"><img src="${esc(site.signatureLight)}" alt="${esc(s.title || site.name)}"></h1>` : (s.title ? `<h1>${esc(s.title)}</h1>` : '');
      const txt = `${s.script ? `<p class="script">${esc(s.script)}</p>` : ''}${title}${s.sub ? `<p class="caps-sub">${esc(s.sub)}</p>` : ''}${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}`;
      return `<div class="banner${s.photo ? ' has-photo' : ''}">${s.image ? `<div class="bgimg" style="background-image:url('${esc(s.image)}')"></div>` : ''}<div class="wrap">${s.photo ? `<div class="pb-text">${txt}</div><div class="pb-photo"><img src="${esc(s.photo)}" alt="${esc(s.photoAlt || '')}" fetchpriority="high"></div>` : txt}</div></div>`;
    },
    about(s, site) {
      const sigImg = s.signatureImage || site.signature;
      const name = s.useSignature && sigImg ? `<h3 class="sig-h"><img src="${esc(sigImg)}" alt="${esc(s.name || site.name)}"></h3>` : (s.name ? `<h3>${esc(s.name)}</h3>` : '');
      return `<section class="sec white block-about"><div class="wrap about-grid${s.photoSize === 'large' ? ' ph-l' : s.photoSize === 'xl' ? ' ph-xl' : ''}">${s.image ? `<div class="portrait"><img src="${esc(s.image)}" alt="${esc(s.alt || s.name || '')}"></div>` : '<div></div>'}
<div>${s.script ? `<p class="sec-script">${esc(s.script)}</p>` : ''}${name}<div class="prose">${md(s.text)}</div>${btns(s.buttons)}</div>
${(s.creds || []).length ? `<ul class="creds">${s.creds.map((c) => `<li><span class="ci">${icon(c.icon, '')}</span>${esc(c.text)}</li>`).join('')}</ul>` : ''}</div></section>`;
    },
    timeline(s) {
      return `<section class="sec${bgClass(s.bg)}"><div class="wrap">${secHead(s)}<div class="timeline">${(s.items || []).map((t) => `<div class="tl"><b>${esc(t.title)}</b><p>${esc(t.text || '')}</p></div>`).join('')}</div></div></section>`;
    },
    tagline(s) { return `<section class="sec${bgClass(s.bg || 'white')}"><div class="wrap"><p class="same-girl">${esc(s.text || '')}</p></div></section>`; },
    pillars(s) {
      return `<section class="sec${bgClass(s.bg)}" id="pillars"><div class="wrap">${secHead(s)}<div class="grid ${(s.items || []).length >= 4 ? 'g4' : (s.items || []).length === 3 ? 'g3' : 'g2'}">${(s.items || []).map((p) => `<article class="pillar">${icon(p.icon)}<h3>${esc(p.title)}</h3><p>${esc(p.text || '')}</p>${list(p.bullets).length ? `<ul>${list(p.bullets).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</div></div></section>`;
    },
    ministryForms(s) {
      const prayer = s.prayer === false ? '' : netlifyForm('prayer', 'form', `<h3>${esc(s.prayerTitle || 'Prayer Request')}</h3>${s.prayerText ? `<p class="note">${esc(s.prayerText)}</p>` : ''}
<div class="row"><label>Name<input name="name" required placeholder="First name is fine"></label><label>Email<input name="email" type="email" required></label></div>
<label>Prayer for<select name="prayer_for">${options(s.prayerCategories)}</select></label>
<label>Your request<textarea name="message" rows="4" required></textarea></label>
${heard()}
<label class="check"><input type="checkbox" name="keep_private" value="yes" checked> Keep my request private</label>
<button class="btn" type="submit">Send prayer request</button>`, ' id="prayer"');
      const speak = s.speak === false ? '' : netlifyForm('speaking', 'form', `<h3>${esc(s.speakTitle || 'Book Nikole to Speak')}</h3>${s.speakText ? `<p class="note">${esc(s.speakText)}</p>` : ''}
<div class="row"><label>Church / organization<input name="organization" required></label><label>Contact name<input name="name" required></label></div>
<div class="row"><label>Email<input name="email" type="email" required></label><label>Phone<input name="phone" type="tel" required></label></div>
<div class="row"><label>Event date<input name="event_date" type="date" required></label><label>Type of event<select name="event_type">${options(s.eventTypes)}</select></label></div>
<div class="row"><label>Expected audience<select name="audience">${options(s.audienceSizes)}</select></label><label>City &amp; venue<input name="location"></label></div>
<label>Tell us about the event<textarea name="message" rows="3"></textarea></label>
${heard()}
<button class="btn" type="submit">Send invitation</button>`, ' id="speak"');
      return `<section class="sec red-sec"><div class="wrap grid g2">${prayer}${speak}</div></section>`;
    },
    give(s) {
      const amounts = list(s.amounts).map(num).filter(Boolean);
      return `<section class="sec dark" id="give"><div class="wrap grid g2"><div>${s.script ? `<p class="sec-script" style="color:#fff">${esc(s.script)}</p>` : ''}<h2 style="color:#fff;font-size:clamp(1.9rem,3.4vw,2.7rem);margin-top:8px">${esc(s.heading || '')}</h2><div class="prose" style="margin-top:16px;max-width:34em">${md(s.text)}</div></div>
<div class="form give">${s.monthly !== false ? `<div class="seg" id="giveFreq"><button class="on" type="button" data-f="once">One-time</button><button type="button" data-f="monthly">Monthly</button></div>` : ''}
<div class="amounts" id="amounts">${amounts.map((a, i) => `<button type="button" data-a="${a}"${i === 1 || (amounts.length === 1) ? ' class="on"' : ''}>${money(a)}</button>`).join('')}</div>
<label>Other amount<input id="give-other" type="number" min="1" placeholder="$"></label>
<label>Designate to<select id="give-for">${options(s.designations)}</select></label>
<button class="btn" type="button" id="giveBtn">Add gift to cart${arrow}</button><p class="note give-note" hidden></p></div></div></section>`;
    },
    serviceMenu(s, site, data) {
      const svc = (data.services && data.services.items || []).filter(shown);
      const cats = (data.services && list(data.services.categories)) || [...new Set(svc.map((x) => x.category))];
      const usedCats = cats.filter((c) => svc.some((x) => x.category === c));
      const items = svc.map((x) => { const p = num(x.price); return `<div class="svc" data-svc="${esc(x.name)}" data-cat="${esc(x.category)}" data-price="${p == null ? '' : p}" data-min="${Number(x.minutes) || 0}" role="checkbox" tabindex="0" aria-checked="false"${usedCats.length && x.category !== usedCats[0] ? ' hidden' : ''}><span class="tick">&#10003;</span><span class="cat">${esc(x.category)}</span><h4>${esc(x.name)}</h4><p class="note">${esc(x.description || '')}</p><div class="meta"><span class="price">${p == null ? esc(x.price || 'Quote') : money(p)}</span><span class="dur">${Number(x.minutes) ? fmtMin(x.minutes) : 'By project'}</span></div></div>`; }).join('');
      return `<section class="sec" id="services" data-default-view="${esc(s.defaultView || 'cards')}"><div class="wrap">${secHead(s, '<div class="controls"><div class="seg" id="svcLayout"><button class="on" type="button" data-l="cards">Cards</button><button type="button" data-l="menu">Menu</button></div></div>')}
<div class="controls" id="svcCats" style="margin-bottom:24px">${usedCats.map((c, i) => `<button class="chip${i ? '' : ' on'}" type="button" data-sc="${esc(c)}">${esc(c)}</button>`).join('')}<button class="chip${usedCats.length ? '' : ' on'}" type="button" data-sc="All">All</button></div>
<div class="svc-cards" id="svcList">${items}</div>
<div class="pick-bar" id="pickBar" hidden><div><b id="pickCount">0 services</b><div class="note" style="color:var(--on-dark-muted)" id="pickEst"></div></div><div class="controls"><button class="btn btn-ghost btn-sm" type="button" id="pickClear">Clear</button><a class="btn btn-sm" href="${esc(s.bookUrl || '/book/')}">Request appointment${arrow}</a></div></div></div></section>`;
    },
    packages(s, site, data) {
      // "Services included" (multi-select in the editor) pre-selects those services on /book/ and shows the package price there.
      // A package without services (e.g. a quote) links to its own page, by default the wedding inquiry form.
      return `<section class="sec white packages" id="${esc(s.anchor || 'packages')}"><div class="wrap">${secHead(s)}<div class="grid g3">${((data && data.packages && data.packages.length) ? data.packages : (s.items || [])).filter((p) => p && p.show !== false).map((p) => {
        const priceNum = /^\s*\$?\d/.test(String(p.price || '')) ? num(p.price) : null;
        // a price in words (e.g. "Quote") always opens the wedding inquiry form, even when services are ticked
        const isQuote = priceNum == null && String(p.price || '').trim() !== '' && !(pkgMinutes(p) > 0);
        const names = isQuote ? [] : pkgServices(p).length ? pkgServices(p) : pkgMinutes(p) > 0 ? [pkgKey(p)] : [];
        const quoteUrl = (p.buttonUrl || '/wedding-inquiry/') + ((p.buttonUrl || '/wedding-inquiry/').includes('wedding-inquiry') ? (/\?/.test(p.buttonUrl || '') ? '&' : '?') + 'package=' + encodeURIComponent(p.title || '') : '');
        const b = names.length
          ? `<a class="btn btn-sm${p.featured ? '' : ' btn-line'}" href="/book/" data-pkg="${esc(names.join('|'))}" data-pkg-title="${esc(p.title || '')}" data-pkg-price="${priceNum == null ? '' : priceNum}"${pkgServices(p).length && pkgMinutes(p) > 0 ? ` data-pkg-min="${pkgMinutes(p)}"` : ''}>${esc(p.buttonLabel || 'Choose')}</a>`
          : `<a class="btn btn-sm${p.featured ? '' : ' btn-line'}" href="${esc(quoteUrl)}">${esc(p.buttonLabel || 'Get a quote')}</a>`;
        return `<div class="pkg${p.featured ? ' feat' : ''}">${p.label ? `<p class="caps-sub">${esc(p.label)}</p>` : ''}<h3>${esc(p.title)}</h3><div class="amt">${priceNum != null ? money(priceNum) : esc(p.price || '')}</div><ul>${list(p.features).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>${b}</div>`; }).join('')}</div></div></section>`;
    },
    weddingInquiry(s) {
      // Wedding inquiry (quotes for bridal parties). Every field is required; sent to the beauty inbox (Messages → FireByNik).
      const opt = (arr, def) => { const o = list(arr); return (o.length ? o : def).map((x) => `<option>${esc(x)}</option>`).join(''); };
      const heardW = `<label>${esc(s.heardLabel || 'How did you hear about us?')}<select name="heard_about" required><option value="">Please choose…</option>${opt(s.heardOptions, WEDDING_HEARD)}</select>${heardOther()}</label>`;
      return `<section class="sec block-wedding" id="inquiry"><div class="wrap wedding-grid"><div class="wedding-intro">${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}${s.sub ? `<p class="caps-sub">${esc(s.sub)}</p>` : ''}${s.text ? `<div class="prose">${md(s.text)}</div>` : ''}</div>
${netlifyForm('wedding', 'form wedding-form', `<h3>${esc(s.formTitle || 'Wedding inquiry')}</h3>
<input type="hidden" name="package" id="wi-package">
<p class="note wi-pkg" id="wi-pkgnote" hidden></p>
<label>Full name<input name="name" autocomplete="name" required></label>
<div class="row"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Phone<input name="phone" type="tel" autocomplete="tel" required></label></div>
<div class="row"><label>Wedding date<input name="wedding_date" type="date" required></label><label>Start time<input name="start_time" type="time" required></label></div>
<div class="row"><label>Venue name<input name="venue_name" required></label><label>Venue location<input name="venue_location" placeholder="Full address" required></label></div>
<label>How many are in the bridal party, including the bride?<input class="half" name="bridal_party_size" type="number" min="1" max="60" inputmode="numeric" required></label>
<div class="row"><label>How many makeup services are being requested?<input name="makeup_services" type="number" min="0" max="60" inputmode="numeric" required></label><label>How many hairstyling services are being requested?<input name="hair_services" type="number" min="0" max="60" inputmode="numeric" required></label></div>
<label>Budget<input name="budget" placeholder="e.g. $1,500" required></label>
${heardW}
<button class="btn" type="submit">${esc(s.submitLabel || 'Send inquiry')}${arrow}</button>${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}`)}</div></section>`;
    },
    policies(s) {
      return `<section class="sec" id="policies"><div class="wrap">${secHead(s)}<div class="grid g3">${(s.items || []).map((p) => `<div class="policy"><h3>${esc(p.title)}</h3>${md(p.text, true)}</div>`).join('')}</div></div></section>`;
    },
    giftCards(s, site) {
      const url = site.giftCardUrl || '';
      return `<section class="sec white" id="gifts"><div class="wrap">${secHead(s)}${s.text ? `<p class="note" style="margin:-14px 0 24px">${esc(s.text)}</p>` : ''}<div class="grid g3">${list(s.amounts).map(num).filter(Boolean).map((v) => `<div class="gift"><span class="script">${esc(s.cardTitle || 'Gift of Glam')}</span><span class="v">${money(v)}</span>${url ? `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Buy gift card</a>` : '<a class="btn btn-ghost btn-sm" href="/contact/">Ask about gift cards</a>'}</div>`).join('')}</div></div></section>`;
    },
    bookingForm(s, site) {
      // Step-by-step booking (services → date & time → where → details → review). Open days/times come live from /api/availability
      // (edited in /admin → Schedule); locations, fees and texts are edited here in the page.
      const locs = (s.locations || []).filter((l) => l.label);
      const needsAddr = (l) => (l.needsAddress != null ? !!l.needsAddress : /mobile|travel|come to/i.test(l.label));
      const steps = [s.stepOne || 'Session', 'Date & time', 'Where', 'Details', 'Review'];
      const fields = `<input type="hidden" name="services" id="bk-services"><input type="hidden" name="package" id="bk-package"><input type="hidden" name="estimate" id="bk-estimate"><input type="hidden" name="addons" id="bk-addons">
<input type="hidden" name="slot_date" id="bk-slot-date"><input type="hidden" name="slot_start" id="bk-slot-start"><input type="hidden" name="slot_minutes" id="bk-slot-min"><input type="hidden" name="preferred_date" id="bk-pref">
<nav class="bk-steps" id="bkSteps" aria-label="Booking steps">${steps.map((t, i) => `<button type="button" class="bk-step${i ? '' : ' on'}" data-go="${i}"${i ? ' disabled' : ''}><i>${i + 1}</i><span>${t}</span></button>`).join('')}</nav>
<p class="bk-alert" id="bkAlert" role="alert" hidden></p>
<div class="bk-panel" data-panel="0"><h3>${esc(s.title || 'Select services')}</h3><div class="bk-addons" id="bkAddons" hidden></div><div class="controls bk-cats" id="bkCats"></div><div class="bk-svcs" id="bkSvcs"><p class="note">Loading services…</p></div></div>
<div class="bk-panel" data-panel="1" hidden><h3>Select a day</h3><p class="note bk-note" id="bkNote" hidden></p><div class="bk-when"><div class="bk-cal" id="bkCal"><p class="note">Loading open days…</p></div><div class="bk-timecol" id="bkTimes"></div></div></div>
<div class="bk-panel" data-panel="2" hidden><h3>Where would you like your appointment?</h3><div class="bk-visits">${locs.map((l, i) => `<label class="bk-visit"><input type="radio" name="location" value="${esc(l.label)}" data-fee="${num(l.fee) || 0}" data-addr="${needsAddr(l) ? 1 : 0}"${i ? '' : ' checked'}><span><b>${esc(l.label)}</b><small>${num(l.fee) ? '+' + money(num(l.fee)) + ' travel' : 'No travel fee'}</small></span></label>`).join('')}</div>
<div class="bk-addr" id="bkAddr" hidden><label>Address<input name="address" autocomplete="street-address" placeholder="Street and number"></label><div class="row"><label>City<input name="city" autocomplete="address-level2"></label><label>Zip code<input name="zip" inputmode="numeric" autocomplete="postal-code"></label></div></div>
${num(s.rushFee) ? `<label class="check"><input type="checkbox" id="bk-rush" name="last_minute" value="yes" data-fee="${num(s.rushFee)}"> Emergency/Squeeze in appointments: ${money(num(s.rushFee))}</label>` : ''}</div>
<div class="bk-panel" data-panel="3" hidden><h3>Your details</h3>
<div class="row"><label>Name<input name="name" autocomplete="name" required></label><label>Phone<input name="phone" type="tel" autocomplete="tel" required></label></div>
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<label>${esc(s.notesLabel || 'Notes (hair length, inspiration, occasion)')}<textarea name="message" rows="3"></textarea></label>
${s.photos !== false ? `<div class="bk-photos"><b>Inspiration photos <small>(optional)</small></b><p>${esc(s.photoText || 'Please upload any inspiration pictures')}</p><div class="bk-thumbs" id="bkThumbs"></div><label class="bk-drop" id="bkDrop"><input type="file" id="bkPhotos" name="photos" accept="image/*" multiple><span>+ Add photos</span><small>Up to 6 pictures of the hair or makeup look you love</small></label></div>` : ''}
${heard()}
${paySelect(site, s.payLabel)}
${s.policyText ? `<label class="check"><input type="checkbox" name="agreed_to_policies" value="yes" required> <span>${inline(s.policyText).replace(/<a href="([^"]*)">/g, '<a href="$1" target="_blank" rel="noopener">')}</span></label>` : ''}</div>
<div class="bk-panel" data-panel="4" hidden><h3>Review &amp; request</h3><div class="bk-review" id="bkReview"></div>${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}</div>
<div class="bk-ticket" id="bkTicket" hidden><span>Your appointment</span><b id="bkT1"></b><small id="bkT2"></small></div>
<div class="bk-bar"><button class="btn btn-line" type="button" id="bkBack" hidden>Back</button><button class="btn" type="button" id="bkNext" data-submit="${esc(s.submitLabel || 'Request appointment')}">Next <span class="arr">&rarr;</span></button></div>`;
      return `<section class="sec" id="booking"><div class="wrap bk-wrap">${netlifyForm('booking', 'form bk', fields, ` enctype="multipart/form-data" id="bookForm" data-deposit="${num(site.depositAmount) || 0}" data-balance-note="${esc(s.balanceNote || '')}"`)}</div></section>`;
    },
    bookShop(s, site, data) {
      const items = bookList(data);
      const cats = [...new Set(items.map((b) => b.category || 'Book'))];
      const hasEbook = items.some((b) => (b.formats || []).some((f) => f.digital));
      return `<section class="sec white" id="shop"><div class="wrap"><div class="sec-head"><div class="controls" id="bookCats"><button class="chip on" type="button" data-bc="All">All</button>${cats.map((c) => `<button class="chip" type="button" data-bc="${esc(c)}">${esc(c)}s</button>`).join('')}${hasEbook && !cats.includes('Ebook') ? '<button class="chip" type="button" data-bc="Ebook">Ebooks</button>' : ''}</div>
<div class="controls"><select class="sel" id="bookSort" aria-label="Sort books"><option value="f">Featured</option><option value="lo">Price: low to high</option><option value="hi">Price: high to low</option><option value="az">Title A to Z</option></select><div class="seg" id="bookLayout"><button class="on" type="button" data-l="grid">Grid</button><button type="button" data-l="list">List</button></div></div></div>
<div class="books" id="bookList">${items.map(bookCard).join('') || `<p class="note">${esc(s.emptyText || 'New books coming soon.')}</p>`}</div></div></section>`;
    },
    contact(s, site) {
      const c = site.contact || {};
      return `<section class="sec block-contact"><div class="wrap contact-grid"><div>${s.script ? `<p class="sec-script">${esc(s.script)}</p>` : ''}<ul class="info-list">
${c.phone ? `<li><span class="ci">${icon('phone', '')}</span><a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a></li>` : ''}
${c.email ? `<li><span class="ci">${icon('mail', '')}</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ''}
${c.location ? `<li><span class="ci">${icon('pin', '')}</span>${esc(c.location)}</li>` : ''}</ul>${s.text ? `<div class="prose" style="margin-top:20px">${md(s.text)}</div>` : ''}</div>
${netlifyForm('contact', 'form', `<h3>${esc(s.formTitle || 'Send a message')}</h3>
<div class="row"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label></div>
<div class="row"><label>Phone<input name="phone" type="tel" required></label><label>Topic<select name="topic">${options(s.topics)}</select></label></div>
<label>Message<textarea name="message" rows="5" required></textarea></label>${heard()}<button class="btn" type="submit">Send message</button>`)}</div></section>`;
    },
    text(s) {
      return `<section class="sec${bgClass(s.bg)}"><div class="wrap"><div class="narrow" style="${s.align === 'center' ? 'text-align:center;margin:0 auto' : ''}">${s.heading ? `<h2 style="font-size:clamp(1.9rem,3.4vw,2.7rem);margin-bottom:14px">${esc(s.heading)}</h2>` : ''}${s.sub ? `<p class="caps-sub" style="margin-bottom:16px">${esc(s.sub)}</p>` : ''}<div class="prose">${md(s.body)}</div>${btns(s.buttons)}</div></div></section>`;
    },
    imageText(s) {
      return `<section class="sec${bgClass(s.bg)}"><div class="wrap grid g2" style="align-items:center">${s.image ? `<img src="${esc(s.image)}" alt="${esc(s.alt || '')}" style="width:100%;${s.side === 'right' ? 'order:2' : ''}">` : ''}<div>${s.heading ? `<h2 style="font-size:clamp(1.9rem,3.4vw,2.7rem);margin-bottom:14px">${esc(s.heading)}</h2>` : ''}<div class="prose">${md(s.body)}</div>${btns(s.buttons)}</div></div></section>`;
    },
    // Monthly Spiritual Detox registration (or any paid sign-up): saved in Messages, then card checkout or "how to pay"
    register(s, site) {
      const P = site.payment || {}, price = num(s.price != null && s.price !== '' ? s.price : P.detoxPrice);
      return `<section class="sec cot-register${bgClass(s.bg || 'white')}" id="${esc(s.anchor || 'register')}"><div class="wrap cot-reg-grid"><div class="cot-reg-intro">${s.eyebrow ? `<p class="cot-eyebrow">${esc(s.eyebrow)}</p>` : ''}${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}${price ? `<p class="cot-price">${money(price)}</p>` : ''}<div class="prose">${md(s.text)}</div>${btns(s.buttons)}</div>
${netlifyForm(s.form || 'detox', 'form cot-payform', `<h3>${esc(s.formTitle || 'Register')}</h3>
<div class="row"><label>First name<input name="first_name" autocomplete="given-name" required></label><label>Last name<input name="last_name" autocomplete="family-name" required></label></div>
<input type="hidden" name="name">
<div class="row"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Phone / WhatsApp<input name="phone" type="tel" autocomplete="tel" required></label></div>
<label>Country &amp; city<input name="location" autocomplete="address-level2" required placeholder="e.g. Monrovia, Liberia"></label>
<label>${esc(s.messageLabel || 'What are you believing God for? (optional)')}<textarea name="message" rows="3"></textarea></label>
${heard()}${paySelect(site)}
<p class="note cot-pay-note">${esc(s.payNote || 'Card payments open a secure Stripe page. For other ways, we show you where to send the money next.')}</p>
<p class="cot-form-err" role="alert" hidden></p>
<button class="btn" type="submit">${esc(s.button || (price ? 'Register – ' + money(price) : 'Register'))}${arrow}</button>`, ' data-payform')}</div></section>`;
    },
    // How to pay another way (the page people land on after choosing Cash App, Zelle…)
    payInfo(s, site, data) {
      const sess = ((data && data.services && data.services.items) || []).filter(shown).find((x) => num(x.price) > 0);
      const P = site.payment || {}, others = (P.others || []).filter((o) => o && o.name);
      return `<section class="sec cot-payinfo${bgClass(s.bg || 'white')}"><div class="wrap narrow-wrap">${s.heading ? `<h2 class="cot-ruled">${esc(s.heading)}</h2>` : ''}<div class="prose center narrow-c">${md(s.text)}</div>
<div class="cot-pay-list">${others.map((o) => `<div class="cot-pay" data-way="${esc(o.name)}"><h3>${esc(o.name)}</h3><div class="prose">${md(o.how || 'We will send you the details by email.')}</div></div>`).join('')}</div>
<p class="note center cot-pay-amount" data-detox="${esc(num(P.detoxPrice) ? money(num(P.detoxPrice)) : '')}" data-session="${esc(sess ? money(num(sess.price)) : '')}"></p>${btns(s.buttons)}</div></section>`;
    },
    /* ---------- City Of Testimonies blocks ---------- */
    // Big home banner: wide photo (people can be part of the picture), welcome text on the left.
    cotHero(s) {
      return `<section class="cot-hero${s.dim === false ? '' : ' dim'}"${s.image ? ` style="--hero:url('${esc(s.image)}')"` : ''}>${s.image ? `<img class="cot-hero-img" src="${esc(s.image)}" alt="${esc(s.alt || '')}" fetchpriority="high">` : ''}
<div class="wrap"><div class="cot-hero-copy">${s.script ? `<p class="cot-welcome">${esc(s.script)}</p>` : ''}${s.title ? `<h1>${esc(s.title)}</h1>` : ''}${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}${btns(s.buttons)}</div></div></section>`;
    },
    // Three white cards with a gold icon (under the banner)
    features(s) {
      const items = (s.items || []).filter((x) => x && x.title);
      return `<section class="cot-features"><div class="wrap"><div class="cot-feat-grid">${items.map((f) => { const inner = `${icon(f.icon || 'users', 'cot-ic')}<h3>${esc(f.title)}</h3>${f.text ? `<p>${esc(f.text)}</p>` : ''}`; return f.url ? `<a class="cot-feat" href="${esc(f.url)}">${inner}</a>` : `<div class="cot-feat">${inner}</div>`; }).join('')}</div></div></section>`;
    },
    // "Our mandate": small gold line, big heading, text and a gold-framed photo
    mandate(s) {
      return `<section class="sec cot-mandate${bgClass(s.bg || 'white')}"${s.anchor ? ` id="${esc(s.anchor)}"` : ''}><div class="wrap cot-mandate-grid${s.side === 'left' ? ' img-left' : ''}"><div>${s.eyebrow ? `<p class="cot-eyebrow">${esc(s.eyebrow)}</p>` : ''}${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}<div class="prose">${md(s.text)}</div>${s.link && s.link.label && s.link.url ? `<a class="cot-link" href="${esc(s.link.url)}">${esc(s.link.label)}${arrow}</a>` : ''}${btns(s.buttons)}</div>
${s.image ? `<figure class="cot-frame"><img src="${esc(s.image)}" alt="${esc(s.alt || '')}" loading="lazy"></figure>` : ''}</div></section>`;
    },
    // "What we carry": photo cards with a title and a short line
    carry(s) {
      const items = (s.items || []).filter((x) => x && x.title);
      return `<section class="sec cot-carry${bgClass(s.bg)}"><div class="wrap">${s.heading ? `<h2 class="cot-ruled">${esc(s.heading)}</h2>` : ''}<div class="cot-carry-grid">${items.map((c) => { const inner = `${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.alt || '')}" loading="lazy">` : '<span class="cot-noimg"></span>'}<div class="cot-carry-tx"><h3>${esc(c.title)}</h3>${c.text ? `<p>${esc(c.text)}</p>` : ''}</div>`; return c.url ? `<a class="cot-card" href="${esc(c.url)}">${inner}</a>` : `<div class="cot-card">${inner}</div>`; }).join('')}</div></div></section>`;
    },
    // Scripture band on a deep blue sky picture
    verse(s) {
      return `<section class="cot-verse"${s.image ? ` style="background-image:url('${esc(s.image)}')"` : ''}><div class="wrap"><blockquote><p>“${esc(s.quote || '')}”</p>${s.ref ? `<cite>— ${esc(s.ref)}</cite>` : ''}</blockquote></div></section>`;
    },
    // Testimonies one at a time with dots (from Events & shop → Testimonies)
    testiSlider(s, site, data) {
      const items = (data.testimonies || []).filter(shown).filter((t) => t.quote);
      if (!items.length) return '';
      return `<section class="sec cot-testi${bgClass(s.bg)}"${s.anchor ? ` id="${esc(s.anchor)}"` : ' id="testimonies"'}><div class="wrap">${s.heading ? `<p class="cot-eyebrow center">${esc(s.heading)}</p>` : ''}<div class="cot-slider" data-slider data-seconds="${Number(s.seconds) || 8}">
<span class="cot-q" aria-hidden="true">“</span><div class="cot-slides">${items.map((t, i) => `<figure class="cot-slide${i ? '' : ' on'}"${i ? ' aria-hidden="true"' : ''}><blockquote>${md(t.quote)}</blockquote>${t.name ? `<figcaption>— ${esc(t.name)}</figcaption>` : ''}</figure>`).join('')}</div><span class="cot-q" aria-hidden="true">”</span></div>
${items.length > 1 ? `<div class="cot-dots" role="group" aria-label="Choose a testimony">${items.map((t, i) => `<button type="button" data-go="${i}" aria-label="Testimony ${i + 1}"${i ? '' : ' aria-current="true"'}><i></i></button>`).join('')}</div>` : ''}${btns(s.buttons)}</div></section>`;
    },
    // Picture on one side, short promo on the other (e.g. Prophetic School – now enrolling)
    promo(s) {
      return `<section class="cot-promo${s.side === 'right' ? ' img-right' : ''}"${s.anchor ? ` id="${esc(s.anchor)}"` : ''}><div class="cot-promo-img">${s.image ? `<img src="${esc(s.image)}" alt="${esc(s.alt || '')}" loading="lazy">` : ''}</div><div class="cot-promo-tx">${s.eyebrow ? `<p class="cot-eyebrow">${esc(s.eyebrow)}</p>` : ''}${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}${s.text ? `<div class="prose">${md(s.text)}</div>` : ''}${btns(s.buttons)}</div></section>`;
    },
    // Upcoming gatherings as cards with a date tag and a photo (from Events & shop → Events)
    gatherings(s, site, data) {
      let items = eventList(data);
      if (s.limit) items = items.slice(0, Number(s.limit));
      if (!items.length && !s.emptyText) return '';
      const card = (e) => {
        const d = new Date(String(e.date) + 'T12:00:00');
        const mon = isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short' }).toUpperCase(), day = isNaN(d) ? '' : d.getDate();
        const link = e.link || ('/events/#' + e.id);
        return `<article class="cot-ev" data-date="${esc(e.date || '')}"><div class="cot-ev-top"><span class="cot-date"><small>${mon}</small><b>${day}</b></span>${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : '<span class="cot-ev-ph"></span>'}</div>
<div class="cot-ev-body"><h3>${esc(e.title)}</h3>${e.time ? `<p class="cot-meta">${icon('clock', 'mi')}${esc(e.time)}</p>` : ''}${e.place ? `<p class="cot-meta">${icon('pin', 'mi')}<span>${esc(e.place).replace(/\n/g, '<br>')}</span></p>` : ''}<a class="btn btn-sm btn-navy" href="${esc(link)}"${/^https?:/.test(link) ? ' target="_blank" rel="noopener"' : ''}>${esc(s.detailsLabel || 'Details')}${arrow}</a></div></article>`;
      };
      return `<section class="sec cot-gather${bgClass(s.bg || 'white')}"><div class="wrap">${s.heading ? `<h2 class="cot-ruled">${esc(s.heading)}</h2>` : ''}<div class="cot-ev-grid">${items.map(card).join('')}</div><p class="note ev-empty center"${items.length ? ' hidden' : ''}>${esc(s.emptyText || '')}</p>${btns(s.buttons)}</div></section>`;
    },
    // Dark blue giving band with the world map
    sow(s) {
      return `<section class="cot-sow"${s.image ? ` style="background-image:url('${esc(s.image)}')"` : ''}><div class="wrap"><div class="cot-sow-tx">${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}${s.text ? `<p>${esc(s.text)}</p>` : ''}${btns(s.buttons)}</div></div></section>`;
    },
    // Title band at the top of inner pages
    pageHead(s) {
      return `<section class="cot-head"${s.image ? ` style="background-image:url('${esc(s.image)}')"` : ''}><div class="wrap">${s.eyebrow ? `<p class="cot-eyebrow center light">${esc(s.eyebrow)}</p>` : ''}<h1>${esc(s.title || '')}</h1>${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}${btns(s.buttons)}</div></section>`;
    },
    // Questions and answers (tap to open)
    faq(s) {
      return `<section class="sec cot-faq${bgClass(s.bg)}"${s.anchor ? ` id="${esc(s.anchor)}"` : ''}><div class="wrap narrow-wrap">${s.heading ? `<h2 class="cot-ruled">${esc(s.heading)}</h2>` : ''}${(s.items || []).filter((q) => q && q.question).map((q) => `<details><summary>${esc(q.question)}</summary><div class="prose">${md(q.answer)}</div></details>`).join('')}</div></section>`;
    },
    // A list with gold check marks (e.g. class topics)
    checklist(s) {
      const items = list(s.items);
      return `<section class="sec cot-check${bgClass(s.bg)}"${s.anchor ? ` id="${esc(s.anchor)}"` : ''}><div class="wrap">${s.heading ? `<h2 class="cot-ruled">${esc(s.heading)}</h2>` : ''}${s.sub ? `<p class="cot-sub center">${esc(s.sub)}</p>` : ''}<ul class="cot-checks">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${btns(s.buttons)}</div></section>`;
    },
    // Several buttons in a row (e.g. WhatsApp group + register)
    buttonRow(s) {
      return `<section class="sec cot-btnrow${bgClass(s.bg)}"><div class="wrap center">${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}${s.text ? `<div class="prose narrow-c">${md(s.text, true)}</div>` : ''}${btns(s.buttons)}</div></section>`;
    },
  };

  function renderSections(sections, site, data) {
    curSite = site || {};
    return finishSizes((sections || []).filter((s) => s && !s.hidden).map((s) => { const f = blocks[s.type]; try { return f ? f(applySizes(s), site || {}, data || {}) : ''; } catch (e) { return `<!-- block ${esc(s.type)} failed: ${esc(e.message)} -->`; } }).join('\n'));
  }

  /* ---------- theme ---------- */
  const fallback = { display: 'Georgia,serif', body: 'system-ui,"Segoe UI",sans-serif', script: 'cursive' };
  function fontsHref(t, sections) {
    t = t || {}; const custom = (t.customFonts || []).map((f) => f.name);
    const fam = [];
    const add = (name, spec) => { if (name && !custom.includes(name) && !fam.some((x) => x.startsWith('family=' + name.replace(/ /g, '+') + ':') || x === 'family=' + name.replace(/ /g, '+'))) fam.push('family=' + name.replace(/ /g, '+') + (spec || '')); };
    const d = t.displayFont || 'Libre Caslon Text';
    add(d, d === 'Bodoni Moda' ? ':ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;1,6..96,400' : /^(Libre Caslon Text|Libre Baskerville|Cinzel Decorative)$/.test(d) ? ':ital,wght@0,400;0,700;1,400' : ':ital,wght@0,400;0,500;0,600;0,700;1,400');
    add(t.bodyFont || 'Mulish', ':wght@300;400;500;600;700;800');
    add(t.scriptFont || 'Libre Baskerville', ':ital,wght@0,400;0,700;1,400');
    extraFonts(sections).forEach((n) => add(n, ':wght@400;700'));
    return 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap';
  }
  function themeCss(t) {
    t = t || {};
    const ff = (n, fb) => `"${String(n).replace(/"/g, '')}",${fb}`;
    const faces = (t.customFonts || []).filter((f) => f.name && f.file).map((f) => `@font-face{font-family:"${String(f.name).replace(/"/g, '')}";src:url("${f.file}");font-display:swap}`).join('');
    const scale = Number(t.textScale) || 1, base = scale !== 1 && scale >= 0.7 && scale <= 1.6 ? `html{font-size:${Math.round(110 * scale * 10) / 10}%}` : '';
    return base + faces + `:root{--espresso:${t.dark || '#2b0e04'};--ruby:${t.primary || '#9b1313'};--cream:${t.light || '#faf5f0'};--blush:${t.blush || '#f4e7df'};--sel-cream:${t.accent || '#f8dfc2'};--ink:${t.text || '#2b0e04'};--display:${ff(t.displayFont || 'Bodoni Moda', fallback.display)};--sans:${ff(t.bodyFont || 'Jost', fallback.body)};--script:${ff(t.scriptFont || 'Alex Brush', fallback.script)}}`;
  }

  /* ---------- page shell ---------- */
  const SYMBOLS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-fb" viewBox="0 0 24 24"><path fill="currentColor" d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.3.3-.6.6-.6z"/></symbol>
<symbol id="i-ig" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></g><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor"/></symbol>
<symbol id="i-yt" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></symbol>
<symbol id="i-tt" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 3v11.5A3.5 3.5 0 1 1 10.5 11"/><path d="M14 3c.6 2.6 2.4 4.4 5 5"/></g></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></g></symbol>
<symbol id="i-bag" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></g></symbol>
<symbol id="i-crown" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 18 4.6 8l4.6 4.2L12 5l2.8 7.2L19.4 8 21 18z"/><path d="M3.5 20.5h17"/></g><g fill="currentColor"><circle cx="4.6" cy="7" r="1.1"/><circle cx="12" cy="4" r="1.1"/><circle cx="19.4" cy="7" r="1.1"/></g></symbol>
<symbol id="i-scissors" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 19M8.6 16.4 20 5"/></g></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 5h6.5A2.5 2.5 0 0 1 12 7.5V20a2 2 0 0 0-2-2H3z"/><path d="M21 5h-7a2.5 2.5 0 0 0-2.5 2.5V20a2 2 0 0 1 2-2h7z"/></g></symbol>
<symbol id="i-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></g></symbol>
<symbol id="i-heart" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></g></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></g></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 3l2 6.5L20.5 12 14 14.5 12 21l-2-6.5L3.5 12 10 9.5z"/></symbol>
<symbol id="i-flame" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 3c.6 4 6 6 6 11a6 6 0 0 1-12 0c0-2.6 1.6-4 2-6 1.8 1 2.8 2.8 2.8 2.8S12.6 7.4 12 3z"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7.5" r="3"/><path d="M6.5 20v-1.5a5.5 5.5 0 0 1 11 0V20"/><circle cx="5" cy="9.5" r="2.2"/><path d="M1.5 19v-.8a3.5 3.5 0 0 1 4.6-3.3"/><circle cx="19" cy="9.5" r="2.2"/><path d="M22.5 19v-.8a3.5 3.5 0 0 0-4.6-3.3"/></g></symbol>
<symbol id="i-bible" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 5.5c3.5-.8 6.8-.3 9.5 1.6v13c-2.7-1.9-6-2.4-9.5-1.6z"/><path d="M21.5 5.5c-3.5-.8-6.8-.3-9.5 1.6v13c2.7-1.9 6-2.4 9.5-1.6z"/></g></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></symbol>
<symbol id="i-hands" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V11M12 11c0-3-2-5-2-7M12 11c0-3 2-5 2-7"/><path d="M6 14c2 0 4 1 6 3M18 14c-2 0-4 1-6 3"/></g></symbol>
</defs></svg>`;
  const socialIcon = { facebook: 'fb', instagram: 'ig', youtube: 'yt', tiktok: 'tt', email: 'mail', x: 'x', twitter: 'x' };
  function socials(site) {
    return (site.social || []).filter((x) => x.url).map((x) => {
      const k = String(x.network || x.label || '').toLowerCase();
      const url = k === 'email' && !/^mailto:/.test(x.url) ? 'mailto:' + x.url : x.url;
      return `<a href="${esc(url)}" aria-label="${esc(x.label || x.network)}" title="${esc(x.label || x.network)}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ''}><svg><use href="#i-${socialIcon[k] || 'globe'}"/></svg></a>`;
    }).join('');
  }
  function logo(site, light) {
    const img = light ? (site.logoLight || site.logo) : site.logo;
    return `${img ? `<img class="cot-logo-img" src="${esc(img)}" alt="" width="64" height="64">` : ''}<span class="cot-logo-name">${esc(site.name || '')}</span>`;
  }
  function header(site, current) {
    const isActive = (u) => u && (u === current || (u !== '/' && current.startsWith(u)));
    const nav = (site.nav || []).map((n) => {
      const kids = (n.children || []).filter((c) => c.label && c.url);
      const active = isActive(n.url) || kids.some((c) => isActive(c.url.split('#')[0]));
      return `<li><a class="nl${active ? ' active' : ''}" href="${esc(n.url)}">${esc(n.label)}${kids.length ? ' <span class="caret">&#9662;</span>' : ''}</a>${kids.length ? `<div class="drop">${kids.map((c) => `<a href="${esc(c.url)}">${esc(c.label)}</a>`).join('')}</div>` : ''}</li>`;
    }).join('');
    const tb = site.topButton && site.topButton.label ? `<a class="btn btn-gold top-give" href="${esc(site.topButton.url)}">${esc(site.topButton.label)}</a>` : '';
    return `<header class="header cot-header"><div class="wrap"><a class="logo" href="/" aria-label="${esc(site.name)}, home">${logo(site)}</a>
<ul class="nav" id="nav">${nav}</ul><div class="head-actions">${tb}<button class="cart-btn" id="cartBtn" type="button" aria-label="Open cart"><svg><use href="#i-bag"/></svg><span class="cart-count" id="cartCount" data-n="0">0</span></button><button class="burger" id="burger" type="button" aria-label="Menu" aria-expanded="false">&#9776;</button></div></div></header>`;
  }
  // Slowly moving scripture line above the footer on every page (Settings → "Moving scripture line").
  function ticker(site) {
    const t = site.ticker || {};
    if (t.show !== true) return '';
    const text = t.text || 'Arise, shine; for thy light is come.', ref = t.ref || 'Isaiah 60:1';
    const one = `<span class="tk-t">${esc(text)}</span>${ref ? `<span class="tk-r">– ${esc(ref)}</span>` : ''}<i class="tk-d"></i>`;
    const secs = Math.min(200, Math.max(10, Number(t.seconds) || 48));
    return `<div class="ticker" role="note" aria-label="${esc(text + (ref ? ' ' + ref : ''))}"><div class="tk-track" aria-hidden="true" style="animation-duration:${secs}s">${one.repeat(8)}</div></div>`;
  }
  function footer(site) {
    const links = (site.footerLinks && site.footerLinks.length ? site.footerLinks : (site.nav || [])).filter((l) => l.label && l.url);
    const c = site.contact || {}, f = site.footer || {};
    const year = new Date().getFullYear();
    const web = (c.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const info = [
      c.location ? `<li>${icon('pin', 'fi')}<span>${esc(c.location).replace(/\n/g, '<br>')}</span></li>` : '',
      c.phone ? `<li>${icon('phone', 'fi')}<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a></li>` : '',
      c.email ? `<li>${icon('mail', 'fi')}<a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : '',
      web ? `<li>${icon('globe', 'fi')}<a href="https://${esc(web)}">${esc(web)}</a></li>` : '',
    ].join('');
    return `<footer class="cot-foot"><div class="wrap cot-foot-grid">
<div class="cot-foot-brand"><a href="/" class="cot-foot-logo">${site.logo ? `<img src="${esc(site.logoLight || site.logo)}" alt="" width="110" height="110" loading="lazy">` : ''}<span>${esc(site.name || '')}</span></a>${f.text ? `<p>${esc(f.text)}</p>` : ''}${f.verses ? `<p class="cot-foot-verse">${esc(f.verses)}</p>` : ''}</div>
<nav class="cot-foot-col" aria-label="Quick links"><h2>${esc(f.linksTitle || 'Quick Links')}</h2>${links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join('')}</nav>
<div class="cot-foot-col"><h2>${esc(f.contactTitle || 'Contact Information')}</h2><ul class="cot-foot-info">${info}</ul></div>
<div class="cot-foot-col"><h2>${esc(f.socialTitle || 'Stay Connected')}</h2><nav class="socials cot-soc" aria-label="Social media">${socials(site)}</nav>
<h2 class="cot-nl-h">${esc(f.newsletterTitle || 'Subscribe to Our Newsletter')}</h2><form class="sub-form nl-quick cot-nl" method="POST" action="/api/subscribe" novalidate>${honeypot}<input type="email" name="email" required placeholder="Enter your email address" aria-label="Email address"><button type="submit">${esc(f.newsletterButton || 'Subscribe')}</button></form><p class="nl-quick-msg" role="status" hidden></p></div></div>
<div class="wrap cot-foot-bottom"><span>&copy; ${year} ${esc(site.copyright || site.name)}. All rights reserved.</span><span>${(site.legalLinks || []).filter((l) => l.label && l.url).map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' | ')}${(site.legalLinks || []).length ? ' | ' : ''}Website by <a href="https://alexander-telegin.com/" target="_blank" rel="noopener nofollow">Alexander Telegin</a></span></div></footer>`;
  }
  const overlays = `<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-label="Cart"><header><h2>Your Cart</h2><button class="x" id="cartClose" type="button" aria-label="Close cart">&times;</button></header><div class="c-items" id="cItems"></div><div class="c-foot" id="cFoot"></div></aside>
<div class="modal" id="modal" role="dialog" aria-modal="true"><div class="box" id="mBox"></div></div><div class="toast" id="toast" role="status"></div>`;

  // "Message Niki" chat bubble (bottom right) + back-to-top arrow. Texts editable in Settings → Chat bubble.
  const CHAT_TOPICS = ['Prayer request', 'Monthly Spiritual Detox', 'Prophetic School', '1:1 session with Chief Apostle', 'Invite Chief Apostle', 'Partner & give', 'Shop & orders', 'Other'];
  function chatWidget(site) {
    curSite = site || {};
    const c = site.chat || {};
    const top = `<button class="to-top" id="toTop" type="button" aria-label="Back to top"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    if (c.off) return top;
    const label = c.label || 'Message us';
    const topics = list(c.topics).length ? list(c.topics) : CHAT_TOPICS;
    const av = c.photo ? `<img src="${esc(c.photo)}" alt="">` : `<span>${esc((label.replace(/^message\s+/i, '') || 'N').charAt(0))}</span>`;
    return `${top}<div class="chat" id="chat">
<button class="chat-bubble" id="chatOpen" type="button" aria-expanded="false" aria-controls="chatWin"><span class="chat-av">${av}<i class="chat-dot"></i></span><span class="chat-lbl">${esc(label)}</span></button>
<section class="chat-win" id="chatWin" role="dialog" aria-label="${esc(label)}" hidden>
<header class="chat-hd"><span class="chat-av">${av}<i class="chat-dot"></i></span><div><b>${esc(c.title || label)}</b><small>${esc(c.status || 'Usually replies within a day')}</small></div><button class="chat-x" id="chatClose" type="button" aria-label="Close">&times;</button></header>
<div class="chat-body"><p class="chat-bot">${esc(c.text || "Peace be with you! Send us a message here and we'll answer you by email.")}</p>
<form class="chat-form" id="chatForm" name="contact" method="POST" action="/api/form" novalidate><input type="hidden" name="form-name" value="contact">${honeypot}<input type="hidden" name="page" id="chatPage">
<div class="row"><label>Name<input name="name" autocomplete="name" required></label><label>Phone<input name="phone" type="tel" autocomplete="tel" required></label></div>
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<div class="row"><label>Topic<select name="topic" id="chatTopic">${topics.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>${heard().replace(esc(heardQ()), 'Heard about us')}</div>
<label>Message<textarea name="message" rows="2" required placeholder="Type your message…"></textarea></label>
<p class="chat-err" id="chatErr" role="alert" hidden></p>
<button class="btn chat-send" type="submit">Send message <span class="arr">&rarr;</span></button></form>
<div class="chat-done" id="chatDone" hidden><div class="chat-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><b>${esc(c.doneTitle || 'Message sent!')}</b><p>${esc(c.doneText || "Thank you. We'll answer you by email soon. God bless you.")}</p><button class="btn btn-line btn-sm" type="button" id="chatAgain">Send another message</button></div></div></section></div>`;
  }

  function clientData(site, data) {
    return {
      books: bookList(data).map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle || '', category: b.category || 'Book', coverStyle: b.coverStyle || 'espresso', cover: b.cover || '', realCover: b.realCover || '', badge: b.badge || '', description: b.description || '', author: b.author || '', featured: !!b.featured,
        formats: (b.formats || []).filter((f) => num(f.price) != null).map((f) => ({ name: f.name, price: num(f.price), digital: !!f.digital })) })),
      events: eventList(data).map((e) => ({ id: e.id, title: e.title, date: e.date, tickets: (e.tickets || []).filter((t) => t.name && num(t.price) != null).map((t) => ({ name: t.name, price: num(t.price) })) })),
      services: ((data.services && data.services.items) || []).filter((x) => x && x.name && (shown(x) || pkgUsed(data).has(x.name))).map((x) => Object.assign({ name: x.name, price: num(x.price), min: Number(x.minutes) || 0, cat: x.category || '', desc: x.description || '' }, shown(x) ? {} : { po: true })).concat(standalonePkgs(data).map((p) => ({ name: p.key, price: null, min: p.min, cat: '', desc: '', pkg: true, title: p.title, features: p.features }))),
      serviceCats: (data.services && data.services.categories) || [],
      addons: ((data.services && data.services.addons) || []).filter(shown).filter((a) => a.name).map((a) => ({ name: a.name, price: num(a.price), min: Number(a.minutes) || 0, desc: a.description || '', for: String(a.for || '').split(',').map((x) => x.trim()).filter(Boolean) })),
      shippingFee: num(site.shippingFee) || 0, pickupLabel: site.pickupLabel || 'Free pickup', checkoutNote: site.checkoutNote || '',
    };
  }

  function renderPage(page, site, data) {
    site = applySizes(site || {}); data = data || {};
    const t = site.theme || {};
    const current = page.slug === 'index' ? '/' : `/${page.slug}/`;
    const title = page.slug === 'index' ? (site.seoTitle || site.name) : `${page.title} | ${site.seoName || site.name}`;
    const desc = page.description || site.description || '';
    const ogImg = page.image || site.shareImage || '';
    return finishSizes(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ''}
${site.favicon ? `<link rel="icon" href="${esc(site.favicon)}">` : ''}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(t, page.sections)}">
<link rel="stylesheet" href="/styles.css"><style>${themeCss(t)}</style></head><body class="cot page-${esc(page.slug)}">
${SYMBOLS}${header(site, current)}<main>${renderSections(page.sections, site, data)}</main>${ticker(site)}${footer(site)}${overlays}${chatWidget(site)}
<script>window.SITE_DATA=${JSON.stringify(clientData(site, data)).replace(/</g, '\\u003c')};</script><script src="/site.js" defer></script></body></html>`);
  }

  return { renderPage, renderSections, applySizes, finishSizes, themeCss, fontsHref, slug, md, money, num, bookList, eventList, SYMBOLS };
});
