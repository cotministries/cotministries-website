/* Site behaviour: cart + checkout, book shop, service picker, booking estimate, events, giving, dropdowns. */
(function () {
  'use strict';
  var D = window.SITE_DATA || { books: [], events: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  // Spam protection: every website form tells the server how long the page was open (forms sent within 3 seconds are from bots)
  (function () {
    var t0 = Date.now();
    function stamp() { $$('form[action="/api/form"]').forEach(function (f) { var i = f.querySelector('input[name="_e"]'); if (!i) { i = document.createElement('input'); i.type = 'hidden'; i.name = '_e'; f.appendChild(i); } i.value = Date.now() - t0; }); }
    stamp(); setInterval(stamp, 1000); document.addEventListener('submit', stamp, true); document.addEventListener('click', stamp, true);
  })();
  var money = function (n) { return '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, ''); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('nw-' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('nw-' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var tt;
  function toast(m) { var t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2600); }
  var fmtMin = function (m) { var h = Math.floor(m / 60), r = m % 60; return (h ? h + ' hr' + (h > 1 ? 's' : '') : '') + (h && r ? ' ' : '') + (r ? r + ' min' : ''); };

  /* ---------- firebynik.com opens Beauty, so its Home links point to /home/ (same home page) ---------- */
  if (/(^|\.)firebynik\.com$/i.test(location.hostname)) {
    $$('a[href="/"], a[href^="/#"]').forEach(function (a) { a.setAttribute('href', '/home/' + a.getAttribute('href').slice(1)); });
  }

  /* ---------- "How did you hear about us?": picking Other shows a required text box ---------- */
  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('select[name=heard_about]')) return;
    var box = e.target.parentNode.querySelector('.heard-other') || (e.target.form && e.target.form.querySelector('.heard-other'));
    if (!box) return;
    var other = /^other/i.test(e.target.value);
    box.hidden = !other; box.required = other;
    if (other) box.focus(); else box.value = '';
  });

  /* ---------- links inside forms, the cart and pop-ups open in a new tab, so a booking or order in progress is not lost ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !a.closest('form, #drawer, #modal')) return;
    var h = a.getAttribute('href') || '';
    if (!h || h.charAt(0) === '#' || /^(mailto|tel|sms|javascript):/i.test(h) || a.hasAttribute('download')) return;
    a.target = '_blank'; a.rel = 'noopener';
  }, true);

  /* ---------- "Message Niki" chat bubble + back-to-top arrow ---------- */
  var chat = $('#chat');
  if (chat) (function () {
    var win = $('#chatWin'), form = $('#chatForm'), openB = $('#chatOpen');
    var beautyPage = /^\/(beauty|book|bridal|services|gallery|policies)/.test(location.pathname) || /(^|\.)firebynik\.com$/i.test(location.hostname);
    var tp = $('#chatTopic');
    if (tp && beautyPage) $$('option', tp).some(function (o) { if (/beauty/i.test(o.value)) { tp.value = o.value; return true; } return false; });
    function open() {
      win.hidden = false; openB.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { chat.classList.add('open'); document.body.classList.add('chat-open'); });
      setTimeout(function () { var f = $('input[name=name]', form); if (f && !form.hidden && window.innerWidth > 600) f.focus(); }, 320);
    }
    function close() {
      chat.classList.remove('open'); document.body.classList.remove('chat-open'); openB.setAttribute('aria-expanded', 'false');
      setTimeout(function () { if (!chat.classList.contains('open')) win.hidden = true; }, 330);
      openB.focus();
    }
    openB.addEventListener('click', open);
    $('#chatClose').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && chat.classList.contains('open')) close(); });
    $('#chatAgain').addEventListener('click', function () { form.reset(); form.hidden = false; $('#chatDone').hidden = true; $$('.heard-other', form).forEach(function (x) { x.hidden = true; x.required = false; }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#chatErr'); err.hidden = true;
      var els = $$('input,select,textarea', form);
      for (var i = 0; i < els.length; i++) if (!els[i].checkValidity()) { els[i].reportValidity(); return; }
      $('#chatPage').value = location.href;
      var b = $('.chat-send', form), old = b.innerHTML; b.disabled = true; b.textContent = 'Sending…';
      fetch('/api/form', { method: 'POST', body: new FormData(form), headers: { 'x-ajax': '1' } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); }); })
        .then(function () { form.hidden = true; $('#chatDone').hidden = false; })
        .catch(function (x) { err.textContent = x.message || 'Could not send. Please try again.'; err.hidden = false; })
        .then(function () { b.disabled = false; b.innerHTML = old; });
    });
  })();
  else document.body.classList.add('no-chat');
  var toTop = $('#toTop');
  if (toTop) {
    var onScroll = function () { toTop.classList.toggle('on', window.pageYOffset > 500); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  if ($('#bookForm')) document.body.classList.add('has-bkbar');

  /* ---------- menu ---------- */
  var burger = $('#burger');
  if (burger) burger.addEventListener('click', function () { var n = $('#nav'); n.classList.toggle('open'); burger.setAttribute('aria-expanded', String(n.classList.contains('open'))); });

  /* ---------- cart ---------- */
  var cart = store.get('cart', []);
  // drop items whose book/event no longer exists
  cart = cart.filter(function (c) {
    if (c.kind === 'book') return D.books.some(function (b) { return b.id === c.id && b.formats[c.idx]; });
    if (c.kind === 'ticket') return D.events.some(function (e) { return e.id === c.id && e.tickets[c.idx]; });
    return true;
  });
  var delivery = store.get('delivery', 'ship');
  function saveCart() { store.set('cart', cart); renderCart(); }
  function addItem(it) {
    var f = cart.filter(function (c) { return c.key === it.key; })[0];
    if (f) f.qty += it.qty || 1; else { it.qty = it.qty || 1; cart.push(it); }
    saveCart(); toast('Added: ' + it.name);
    var c = $('#cartCount'); if (c && c.animate) c.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 300 });
  }
  var agreed = false;
  function hasDigital() { return cart.some(function (c) { return c.kind === 'book' && !c.ship; }); }
  function totals() {
    var sub = cart.reduce(function (a, c) { return a + c.price * c.qty; }, 0);
    var needsShip = cart.some(function (c) { return c.ship; });
    var ship = needsShip && delivery === 'ship' ? (D.shippingFee || 0) : 0;
    return { sub: sub, ship: ship, needsShip: needsShip, total: sub + ship, count: cart.reduce(function (a, c) { return a + c.qty; }, 0) };
  }
  function renderCart() {
    var T = totals(), cc = $('#cartCount');
    if (cc) { cc.textContent = T.count; cc.setAttribute('data-n', T.count); }
    var items = $('#cItems'), foot = $('#cFoot'); if (!items) return;
    items.innerHTML = cart.length ? cart.map(function (c, i) {
      return '<div class="c-item"><div class="c-thumb cv-' + esc(c.cls || 'espresso') + '">' + esc(c.thumb || '') + '</div><div><b>' + esc(c.name) + '</b><small>' + esc(c.detail || '') + '</small><div class="qty"><button type="button" data-q="' + i + '" data-d="-1" aria-label="Fewer">&minus;</button><span>' + c.qty + '</span><button type="button" data-q="' + i + '" data-d="1" aria-label="More">+</button></div></div><div class="pr">' + money(c.price * c.qty) + '<button type="button" class="rm" data-rm="' + i + '">Remove</button></div></div>';
    }).join('') : '<div class="c-empty"><span class="script">Your cart is empty</span>Books, event tickets and ministry gifts land here.<br><br><a class="btn btn-sm" href="/books/">Shop books</a></div>';
    foot.innerHTML = cart.length ? (T.needsShip ? '<label class="c-del">Delivery<select id="cDelivery"><option value="ship"' + (delivery === 'ship' ? ' selected' : '') + '>Ship to me (+' + money(D.shippingFee || 0) + ')</option><option value="pickup"' + (delivery === 'pickup' ? ' selected' : '') + '>' + esc(D.pickupLabel) + '</option></select></label>' : '') +
      '<div class="c-line"><span>Subtotal</span><span>' + money(T.sub) + '</span></div>' + (T.needsShip ? '<div class="c-line"><span>Shipping</span><span>' + (T.ship ? money(T.ship) : 'Free') + '</span></div>' : '') +
      '<div class="c-line total"><span>Total</span><span>' + money(T.total) + '</span></div><p class="note">Secure checkout by Stripe. Promo codes can be entered on the payment page.' + (D.checkoutNote ? ' ' + esc(D.checkoutNote) : '') + '</p>' +
      (hasDigital() ? '<label class="c-agree"><input type="checkbox" id="cAgree"' + (agreed ? ' checked' : '') + '> <span>I understand ebooks are digital downloads delivered right after payment, and all ebook sales are final. <a href="/terms/" target="_blank" rel="noopener">Ebook terms</a></span></label>' : '') +
      '<button class="btn" type="button" id="checkoutBtn">Checkout <span class="arr">&rarr;</span></button>' : '';
  }
  function openCart() { $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); }
  function closeAll() { var d = $('#drawer'); if (d) d.classList.remove('on'); var s = $('#scrim'); if (s) s.classList.remove('on'); var m = $('#modal'); if (m) m.classList.remove('on'); }
  if ($('#cartBtn')) $('#cartBtn').addEventListener('click', openCart);
  if ($('#cartClose')) $('#cartClose').addEventListener('click', closeAll);
  if ($('#scrim')) $('#scrim').addEventListener('click', closeAll);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('change', function (e) { if (e.target.id === 'cAgree') { agreed = e.target.checked; e.target.closest('.c-agree').classList.remove('need'); } if (e.target.id === 'cDelivery') { delivery = e.target.value; store.set('delivery', delivery); renderCart(); } });

  function goCheckout(payload, button) {
    if (button) { button.disabled = true; button.dataset.label = button.innerHTML; button.textContent = 'Opening secure checkout…'; }
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.url) { location.href = res.d.url; return; }
        throw new Error(res.d.error || 'Checkout is not available right now.');
      })
      .catch(function (err) { toast(err.message || 'Checkout is not available right now.'); if (button) { button.disabled = false; button.innerHTML = button.dataset.label; } });
  }
  document.addEventListener('click', function (e) {
    var q = e.target.closest('[data-q]');
    if (q) { var c = cart[+q.dataset.q]; c.qty += +q.dataset.d; if (c.qty < 1) cart.splice(+q.dataset.q, 1); saveCart(); return; }
    var rm = e.target.closest('[data-rm]');
    if (rm) { cart.splice(+rm.dataset.rm, 1); saveCart(); return; }
    if (e.target.closest('#checkoutBtn')) {
      if (hasDigital() && !agreed) { var ag = $('.c-agree'); if (ag) { ag.classList.add('need'); $('#cAgree').focus(); } toast('Please tick the box to agree to the ebook terms.'); return; }
      goCheckout({ delivery: delivery, agreeDigital: hasDigital() ? agreed : undefined, items: cart.map(function (c) { return { kind: c.kind, id: c.id, idx: c.idx, qty: c.qty, amount: c.amount, designation: c.designation }; }) }, e.target.closest('#checkoutBtn'));
    }
  });

  /* ---------- order thank-you page: show the ebook downloads right away ---------- */
  (function () {
    if (!/^\/order-thanks\/?$/.test(location.pathname)) return;
    var sid = new URLSearchParams(location.search).get('session_id'); if (!sid) return;
    var host = $('main .prose') || $('main'); if (!host) return;
    var box = document.createElement('div'); box.className = 'ebook-dl'; box.setAttribute('aria-live', 'polite'); host.appendChild(box);
    var tries = 0;
    (function load() {
      fetch('/api/order?session_id=' + encodeURIComponent(sid)).then(function (r) { return r.json(); }).then(function (d) {
        if (d.status === 'unpaid' && tries++ < 6) { box.innerHTML = '<p>Confirming your payment…</p>'; setTimeout(load, 2500); return; }
        var list = (d.ebooks || []);
        if (!list.length) { box.remove(); return; }
        box.innerHTML = '<h3>Your ebook' + (list.length > 1 ? 's' : '') + '</h3>' + list.map(function (b) {
          return b.url ? '<a class="btn" href="' + esc(b.url) + '">Download ' + esc(b.title) + ' <span class="arr">&rarr;</span></a>' : '<p><b>' + esc(b.title) + '</b>: your download link will follow by email shortly.</p>';
        }).join('') + '<p class="note">We also emailed ' + (list.length > 1 ? 'these links' : 'this link') + (d.email ? ' to ' + esc(d.email) : '') + '. Your link is personal, works for 30 days and up to 10 downloads.</p>';
      }).catch(function () { box.remove(); });
    })();
  })();

  /* ---------- books ---------- */
  var bookById = function (id) { return D.books.filter(function (b) { return b.id === id; })[0]; };
  function bookItem(b, i, qty) {
    var f = b.formats[i];
    return { key: 'b-' + b.id + '-' + i, kind: 'book', id: b.id, idx: i, name: b.title, detail: f.name, price: f.price, qty: qty || 1, ship: !f.digital, cls: b.coverStyle, thumb: b.title };
  }
  function coverHTML(b) {
    var front = b.cover ? '<img src="' + esc(b.cover) + '" alt="">' : '<svg aria-hidden="true"><use href="#i-crown"/></svg><div><div class="ct">' + esc(b.title) + '</div><div class="cs">' + esc(b.subtitle) + '</div></div><div class="ca">' + esc(b.author || 'City Of Testimonies') + '</div>';
    var back = b.realCover ? '<img src="' + esc(b.realCover) + '" alt="Cover of ' + esc(b.title) + '">' : '<div class="ph"><small>Real cover</small><b>' + esc(b.title) + '</b><small>Add the cover photo in the editor</small></div>';
    return '<div class="cover-wrap"><div class="flip"><div class="cover front cv-' + esc(b.coverStyle) + (b.cover ? ' has-img' : '') + '">' + (b.badge ? '<span class="badge">' + esc(b.badge) + '</span>' : '') + front + '</div><div class="cover back">' + back + '</div></div></div>';
  }
  function openBook(id) {
    var b = bookById(id); if (!b) return;
    $('#mBox').innerHTML = '<button class="x" type="button" id="mClose" aria-label="Close">&times;</button>' + coverHTML(b) + '<div><span class="caps-sub" style="color:var(--muted)">' + esc(b.category) + '</span><h2>' + esc(b.title) + '</h2><p>' + esc(b.description) + '</p>' +
      (b.formats.length ? '<div class="fmt">' + b.formats.map(function (f, i) { return '<label><span><input type="radio" name="mfmt" value="' + i + '"' + (i ? '' : ' checked') + '> ' + esc(f.name) + '</span><b>' + money(f.price) + '</b></label>'; }).join('') + '</div><div class="controls"><div class="qty"><button type="button" id="mMinus" aria-label="Fewer">&minus;</button><span id="mQty">1</span><button type="button" id="mPlus" aria-label="More">+</button></div><button class="btn" type="button" id="mAdd">Add to cart</button></div>' : '<p class="note">Coming soon.</p>') +
      '<p class="note" style="margin-top:14px">Paperbacks ship within a few business days, or pick up free. Ebooks are emailed right after purchase.</p></div>';
    $('#modal').classList.add('on'); $('#scrim').classList.add('on');
    var q = 1;
    if ($('#mMinus')) { $('#mMinus').onclick = function () { q = Math.max(1, q - 1); $('#mQty').textContent = q; }; $('#mPlus').onclick = function () { q++; $('#mQty').textContent = q; }; $('#mAdd').onclick = function () { addItem(bookItem(b, +$('input[name=mfmt]:checked').value, q)); closeAll(); }; }
    $('#mClose').onclick = closeAll;
  }
  if ($('#modal')) $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeAll(); });
  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) { var b = bookById(add.dataset.add); var sel = add.parentElement.querySelector('select'); if (b) addItem(bookItem(b, sel ? +sel.value : 0)); return; }
    var op = e.target.closest('[data-open]');
    if (op) { openBook(op.dataset.open); }
  });
  document.addEventListener('keydown', function (e) { var op = e.target.closest && e.target.closest('[data-open]'); if (op && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openBook(op.dataset.open); } });

  // shop filters / sort / layout
  var shop = $('#bookList');
  if (shop && $('#bookCats')) {
    var cards = $$('.book', shop), bcat = 'All';
    var applyShop = function () {
      var sort = $('#bookSort').value;
      var vis = cards.filter(function (c) {
        var b = bookById(c.querySelector('[data-open]') && c.querySelector('[data-open]').dataset.open) || {};
        var ok = bcat === 'All' || c.dataset.cat === bcat || (bcat === 'Ebook' && (b.formats || []).some(function (f) { return f.digital; }));
        c.hidden = !ok; return ok;
      });
      var sorted = cards.slice();
      if (sort === 'lo') sorted.sort(function (a, b) { return a.dataset.price - b.dataset.price; });
      if (sort === 'hi') sorted.sort(function (a, b) { return b.dataset.price - a.dataset.price; });
      if (sort === 'az') sorted.sort(function (a, b) { return a.dataset.title.localeCompare(b.dataset.title); });
      sorted.forEach(function (c) { shop.appendChild(c); });
      return vis;
    };
    $('#bookCats').addEventListener('click', function (e) { var c = e.target.closest('[data-bc]'); if (!c) return; bcat = c.dataset.bc; $$('#bookCats .chip').forEach(function (x) { x.classList.toggle('on', x === c); }); applyShop(); });
    $('#bookSort').addEventListener('change', applyShop);
    var setBL = function (v) { document.body.classList.toggle('books-list', v === 'list'); $$('#bookLayout button').forEach(function (x) { x.classList.toggle('on', x.dataset.l === v); }); store.set('bookLayout', v); };
    $('#bookLayout').addEventListener('click', function (e) { var b = e.target.closest('[data-l]'); if (b) setBL(b.dataset.l); });
    setBL(store.get('bookLayout', 'grid'));
    var hashCat = (location.hash.match(/^#cat-(\w+)/) || [])[1];
    if (hashCat) { var chip = $('#bookCats [data-bc="' + hashCat + '"]'); if (chip) chip.click(); }
  }

  /* ---------- wedding inquiry: remember which package the quote is for (?package=...) ---------- */
  if ($('#wi-package')) (function () {
    var m = /[?&]package=([^&#]*)/.exec(location.search), name = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')).slice(0, 120) : '';
    if (!name) return;
    $('#wi-package').value = name;
    var n = $('#wi-pkgnote'); n.textContent = 'Inquiry for: ' + name; n.hidden = false;
  })();

  /* ---------- services ---------- */
  var picked = store.get('picked', []);
  var svcData = {};
  (D.services || []).forEach(function (s) { svcData[s.name] = s; });
  picked = picked.filter(function (n) { return svcData[n]; });
  // A chosen bridal package: its services stay pre-selected and its price replaces their separate prices.
  // It is dropped as soon as one of its services is removed.
  function pkgNow() { var k = store.get('pkg', null); return k && k.services && k.services.length && k.services.every(function (n) { return picked.indexOf(n) > -1; }) ? k : null; }
  function est() {
    var sel = picked.map(function (n) { return svcData[n]; }).filter(Boolean), pk = pkgNow();
    var priced = pk && pk.price != null ? sel.filter(function (s) { return pk.services.indexOf(s.name) < 0; }) : sel;
    return { sel: sel, pkg: pk, sum: (pk && pk.price != null ? pk.price : 0) + priced.reduce(function (a, s) { return a + (s.price || 0); }, 0), quote: priced.some(function (s) { return s.price == null; }), min: pk && pk.min ? pk.min + priced.filter(function (s) { return pk.services.indexOf(s.name) < 0; }).reduce(function (a, s) { return a + s.min; }, 0) : sel.reduce(function (a, s) { return a + s.min; }, 0) };
  }
  function savePicked() { store.set('picked', picked); if (!pkgNow()) store.set('pkg', null); paintServices(); renderBooking(); }
  function paintServices() {
    $$('#svcList .svc').forEach(function (el) { var on = picked.indexOf(el.dataset.svc) > -1; el.classList.toggle('sel', on); el.setAttribute('aria-checked', String(on)); });
    var bar = $('#pickBar'); if (!bar) return;
    var E = est(); bar.hidden = !E.sel.length;
    $('#pickCount').textContent = E.sel.length + ' service' + (E.sel.length === 1 ? '' : 's') + ' selected';
    $('#pickEst').textContent = E.sel.length ? 'Estimated ' + money(E.sum) + (E.quote ? ' + quote' : '') + (E.min ? ' · about ' + fmtMin(E.min) : '') : '';
  }
  function toggleSvc(n) { var i = picked.indexOf(n); if (i > -1) picked.splice(i, 1); else picked.push(n); savePicked(); }
  document.addEventListener('click', function (e) {
    var sv = e.target.closest('#svcList [data-svc]'); if (sv) { toggleSvc(sv.dataset.svc); return; }
    var sc = e.target.closest('[data-sc]');
    if (sc) { $$('#svcCats .chip').forEach(function (x) { x.classList.toggle('on', x === sc); }); $$('#svcList .svc').forEach(function (el) { el.hidden = !(sc.dataset.sc === 'All' || el.dataset.cat === sc.dataset.sc); }); return; }
    var un = e.target.closest('[data-unpick]'); if (un) { picked = picked.filter(function (n) { return n !== un.dataset.unpick; }); savePicked(); return; }
    if (e.target.closest('[data-pkgclear]')) { var old = store.get('pkg', null); store.set('pkg', null); if (old && old.services) picked = picked.filter(function (n) { return old.services.indexOf(n) < 0; }); savePicked(); return; }
    var pk = e.target.closest('[data-pkg]');
    if (pk) { // choosing a package starts the booking with exactly its services
      var allNames = pk.dataset.pkg.split(pk.dataset.pkg.indexOf('|') > -1 ? '|' : ',').map(function (s) { return s.trim(); }).filter(Boolean);
      var names = allNames.filter(function (n) { return svcData[n]; });
      picked = names.slice(); store.set('picked', picked); store.set('addons', []);
      store.set('pkg', names.length ? { title: pk.dataset.pkgTitle || 'Package', price: pk.dataset.pkgPrice === '' || pk.dataset.pkgPrice == null ? null : +pk.dataset.pkgPrice, services: names, all: allNames, min: +pk.dataset.pkgMin || 0 } : null);
    }
  });
  document.addEventListener('keydown', function (e) { var sv = e.target.closest && e.target.closest('#svcList [data-svc]'); if (sv && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSvc(sv.dataset.svc); } });
  if ($('#pickClear')) $('#pickClear').addEventListener('click', function () { picked = []; savePicked(); });
  if ($('#svcLayout')) {
    var setSL = function (v) { document.body.classList.toggle('svc-menu', v === 'menu'); $$('#svcLayout button').forEach(function (x) { x.classList.toggle('on', x.dataset.l === v); }); };
    $('#svcLayout').addEventListener('click', function (e) { var b = e.target.closest('[data-l]'); if (b) { setSL(b.dataset.l); store.set('svcLayout', b.dataset.l); } });
    setSL(store.get('svcLayout', ($('#services') && $('#services').dataset.defaultView) || 'cards'));
  }

  /* ---------- booking: services → date & time → where → details → review ---------- */
  var bookForm = $('#bookForm');
  var renderBooking = function () {};
  if (bookForm && $('#bkSteps')) (function () {
    var F = bookForm, A = null, part = null, step = 0, cat = null, month = null, date = null, time = null, alertMsg = '';
    var deposit = +F.dataset.deposit || 0;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var dn = function (d) { return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5; };
    var ds = function (n) { var x = new Date(n * 864e5); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); };
    var toMin = function (t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
    var fmtT = function (m) { var h = Math.floor(m / 60) % 24; return ((h + 11) % 12 + 1) + ':' + pad(m % 60) + ' ' + (h < 12 ? 'AM' : 'PM'); };
    var fmtD = function (d, long) { return new Date(dn(d) * 864e5).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: long ? 'long' : 'short', month: long ? 'long' : 'short', day: 'numeric' }); };
    var localToday = function () { var x = new Date(); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
    var nowD = function () { return A && A.now ? A.now : { date: localToday(), min: 0 }; };
    // ----- add-ons (extras offered for the picked services) -----
    var ADD = D.addons || [], addons = store.get('addons', []);
    var addAvail = function () { return ADD.filter(function (a) { return !a.for.length || picked.some(function (n) { return a.for.indexOf(n) > -1 || (svcData[n] && a.for.indexOf(svcData[n].cat) > -1); }); }); };
    var addSel = function () { return addAvail().filter(function (a) { return addons.indexOf(a.name) > -1; }); };
    var addMin = function () { return addSel().reduce(function (x, a) { return x + a.min; }, 0); };
    var len = function () { return (est().min + addMin()) || (A && A.defaultMinutes) || 60; };
    var loc = function () { return $('input[name=location]:checked', F); };
    var fees = function () { var l = loc(), r = $('#bk-rush'); return { travel: l ? +l.dataset.fee || 0 : 0, rush: r && r.checked ? +r.dataset.fee || 0 : 0 }; };

    // ----- availability -----
    function hoursOn(d) {
      if (!A || A.error) return null;
      if ((A.daysOff || []).indexOf(d) > -1) return null;
      var ex = (A.extraDays || []).filter(function (x) { return x.date === d; })[0];
      var r = ex || (A.week || {})[new Date(dn(d) * 864e5).getUTCDay()];
      return r ? { from: toMin(r.from), to: toMin(r.to) } : null;
    }
    function inRange(d) { var n = nowD(), k = dn(d) - dn(n.date); return k >= 0 && k <= A.maxDays; }
    function slots(d) {
      var h = hoursOn(d); if (!h || !inRange(d)) return [];
      var L = len(), out = [], n = nowD(), k = dn(d) - dn(n.date), b = A.buffer || 0;
      var busy = (A.busy || []).filter(function (x) { return x.date === d; });
      for (var t = h.from; t + L <= h.to; t += A.step || 30) {
        if (k * 1440 + t - n.min < (A.minNotice || 0) * 60) continue;
        if (busy.some(function (x) { return t < x.end + b && t + L + b > x.start; })) continue;
        out.push(t);
      }
      return out;
    }
    // services longer than any opening day: pick a day only, Niki plans the times
    function longJob() {
      if (!A || A.error) return false;
      var w = A.week || {}, max = 0;
      for (var i = 0; i < 7; i++) if (w[i]) max = Math.max(max, toMin(w[i].to) - toMin(w[i].from));
      (A.extraDays || []).forEach(function (x) { max = Math.max(max, toMin(x.to) - toMin(x.from)); });
      return len() > max;
    }
    function dayOk(d) { if (!inRange(d)) return false; if (longJob()) { var h = hoursOn(d); return !!h && dn(d) > dn(nowD().date); } return slots(d).length > 0; }
    function load(cb) {
      fetch('/api/availability', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { A = j; }, function () { A = { error: true }; }).then(cb);
    }

    // ----- validity -----
    function panel(i) { return $('[data-panel="' + i + '"]', F); }
    function fieldsOk(i, report) {
      var els = $$('input,select,textarea', panel(i));
      for (var k = 0; k < els.length; k++) if (!els[k].disabled && !els[k].checkValidity()) { if (report) { els[k].reportValidity(); } return false; }
      return true;
    }
    function ok(i, report) {
      if (i === 0) { if (!picked.length) { if (report) say('Please choose at least one service.'); return false; } return true; }
      if (i === 1) {
        if (A && A.error) { var fd = $('#bkFallDate'); if (!fd || !fd.value) { if (report) say('Please choose a date.'); return false; } return true; }
        if (!date || (time == null && !longJob())) { if (report) say(date ? 'Please choose a time.' : 'Please choose a day.'); return false; }
        return true;
      }
      if (i === 2 || i === 3) return fieldsOk(i, report);
      return true;
    }
    function say(m) { var a = $('#bkAlert'); a.textContent = m; a.hidden = !m; }

    // ----- inspiration photos: shrunk in the browser (max 1600 px JPEG) so they upload fast -----
    var photos = [], MAXP = 6;
    function shrink(file) {
      return new Promise(function (res) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
          var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          c.toBlob(function (b) { res(b ? { blob: b, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' } : null); }, 'image/jpeg', 0.82);
        };
        img.onerror = function () { URL.revokeObjectURL(url); res(file.size <= 3e6 && /^image\/(jpe?g|png|webp|gif)$/.test(file.type) ? { blob: file, name: file.name } : null); };
        img.src = url;
      });
    }
    function drawPhotos() {
      var box = $('#bkThumbs'); if (!box) return;
      box.innerHTML = photos.map(function (p, i) { return '<span class="bk-thumb"><img src="' + p.url + '" alt="Inspiration photo ' + (i + 1) + '"><button type="button" data-rmphoto="' + i + '" aria-label="Remove photo ' + (i + 1) + '">&times;</button></span>'; }).join('');
      var d = $('#bkDrop'); if (d) d.hidden = photos.length >= MAXP;
    }
    if ($('#bkPhotos')) $('#bkPhotos').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name); });
      var room = MAXP - photos.length, skipped = 0;
      if (files.length > room) { skipped = files.length - room; files = files.slice(0, room); }
      e.target.value = '';
      Promise.all(files.map(shrink)).then(function (out) {
        out.forEach(function (o) { if (o) photos.push({ blob: o.blob, name: o.name, url: URL.createObjectURL(o.blob) }); else skipped++; });
        drawPhotos(); say(skipped ? skipped + ' photo' + (skipped > 1 ? 's' : '') + ' could not be added (max ' + MAXP + ', JPG or PNG).' : '');
      });
    });

    // ----- drawing -----
    function drawServices() {
      var box = $('#bkAddons'), av = addAvail();
      box.hidden = !av.length || !picked.length;
      box.innerHTML = av.length ? '<div class="bk-addhd"><b>Add-ons</b><small>Optional extras for ' + esc(picked.join(' + ')) + '</small></div><div class="bk-addlist">' + av.map(function (a) {
        var on = addons.indexOf(a.name) > -1;
        return '<button type="button" class="bk-add' + (on ? ' sel' : '') + '" data-bkadd="' + esc(a.name) + '" aria-pressed="' + on + '"><span class="box" aria-hidden="true"></span><span class="n">' + esc(a.name) + (a.desc ? '<small>' + esc(a.desc) + '</small>' : '') + '</span><b>' + (a.price == null ? 'Quote' : '+' + money(a.price)) + '</b></button>';
      }).join('') + '</div>' : '';
      var cats = (D.serviceCats || []).filter(function (c) { return (D.services || []).some(function (s) { return !s.po && !s.pkg && s.cat === c; }); }).concat(['All']);
      // start on the first category (Hair), or on the category of a service that came pre-selected; "All" sits at the end
      if (!cat || cats.indexOf(cat) < 0) { var p0 = (D.services || []).filter(function (s) { return picked.indexOf(s.name) > -1; })[0]; cat = p0 && cats.indexOf(p0.cat) > -1 ? p0.cat : cats[0]; }
      $('#bkCats').innerHTML = cats.length > 2 ? cats.map(function (c) { return '<button type="button" class="chip' + (c === cat ? ' on' : '') + '" data-bkcat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') : '';
      // chosen package (from the Beauty page): shown on top with its services, which are also listed first
      var pk = pkgNow(), pb = $('#bkPkg');
      if (!pb && $('#bkAddons')) { pb = document.createElement('div'); pb.id = 'bkPkg'; pb.className = 'bk-pkg'; $('#bkAddons').parentNode.insertBefore(pb, $('#bkAddons')); }
      if (pb) {
        pb.hidden = !pk;
        pb.innerHTML = pk ? '<p class="bk-pkg-pay" role="note"><b>Please note:</b> All things Bridal when it comes to packages must pay 50% up front.</p><div class="bk-pkg-box"><div class="bk-pkg-hd"><span><small>Your package</small><b>' + esc(pk.title) + '</b></span><span class="bk-pkg-amt">' + (pk.price == null ? 'Quote' : money(pk.price)) + '</span></div><ul>' +
          (function () { var one = pk.services.length === 1 && svcData[pk.services[0]] && svcData[pk.services[0]].pkg ? svcData[pk.services[0]] : null;
            if (one) return (one.features || []).map(function (f) { return '<li><span class="tick" aria-hidden="true"></span>' + esc(f) + '</li>'; }).join('') + '<li class="bk-pkg-time"><span>Appointment time</span><small>' + fmtMin(one.min) + '</small></li>';
            return (pk.all && pk.all.length ? pk.all : pk.services).map(function (n) { var s = svcData[n] || {}; return '<li><span class="tick" aria-hidden="true"></span>' + esc(n) + (s.min && !pk.min ? '<small>' + fmtMin(s.min) + '</small>' : '') + '</li>'; }).join('') + (pk.min ? '<li class="bk-pkg-time"><span>Appointment time</span><small>' + fmtMin(pk.min) + '</small></li>' : ''); })() +
          '</ul><p class="note bk-pkg-note">Add-ons below are optional. To choose other services, remove the package.</p><button type="button" class="bk-pkg-x" data-pkgclear>Remove package</button></div>' : '';
      }
      // with a package chosen only its add-ons can be added; the other services come back after "Remove package"
      $('#bkCats').hidden = !!pk; $('#bkSvcs').hidden = !!pk;
      var list = (D.services || []).filter(function (s) { return !s.pkg && !s.po && (cat === 'All' || s.cat === cat); });
      list = list.filter(function (s) { return picked.indexOf(s.name) > -1; }).concat(list.filter(function (s) { return picked.indexOf(s.name) < 0; }));
      $('#bkSvcs').innerHTML = list.map(function (s) {
        var on = picked.indexOf(s.name) > -1;
        return '<button type="button" class="bk-svc' + (on ? ' sel' : '') + '" data-bksvc="' + esc(s.name) + '" aria-pressed="' + on + '"><span class="t">' + esc(s.name) + '</span><span class="tick" aria-hidden="true"></span>' +
          (s.desc ? '<span class="d">' + esc(s.desc) + '</span>' : '') + '<span class="m"><span>' + (s.min ? fmtMin(s.min) : 'Time by quote') + '</span><b>' + (s.price == null ? 'Quote' : money(s.price)) + '</b></span></button>';
      }).join('') || '<p class="note">No services listed yet.</p>';
    }
    function drawCal() {
      var cal = $('#bkCal'), tm = $('#bkTimes'), note = $('#bkNote');
      if (!A) { cal.innerHTML = '<p class="note">Loading open days…</p>'; tm.innerHTML = ''; return; }
      if (A.error) {
        cal.innerHTML = '<label>Preferred date<input type="date" id="bkFallDate" min="' + localToday() + '"></label><label>Preferred time<input id="bkFallTime" placeholder="e.g. morning, after 2 pm"></label><p class="note">The live calendar could not load. Tell us what suits you and we will confirm a time.</p>';
        tm.innerHTML = ''; return;
      }
      note.hidden = !A.note; note.textContent = A.note || '';
      var n = nowD(), y = month.getUTCFullYear(), mo = month.getUTCMonth();
      var first = new Date(Date.UTC(y, mo, 1)).getUTCDay(), days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      var cells = '';
      for (var i = 0; i < first; i++) cells += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var key = y + '-' + pad(mo + 1) + '-' + pad(d), can = dayOk(key);
        cells += '<button type="button" class="bk-day' + (key === date ? ' sel' : '') + (key === n.date ? ' today' : '') + '" data-day="' + key + '"' + (can ? '' : ' disabled') + ' aria-label="' + fmtD(key, true) + (can ? '' : ', not available') + '"><span>' + d + '</span></button>';
      }
      var firstN = dn(y + '-' + pad(mo + 1) + '-01'), nowM = n.date.slice(0, 7), lastD = ds(dn(n.date) + A.maxDays).slice(0, 7);
      var label = new Date(firstN * 864e5).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
      cal.innerHTML = '<div class="bk-calhd"><button type="button" class="bk-nav" data-mon="-1"' + (y + '-' + pad(mo + 1) <= nowM ? ' disabled' : '') + ' aria-label="Previous month">&lsaquo;</button><b>' + label + '</b><button type="button" class="bk-nav" data-mon="1"' + (y + '-' + pad(mo + 1) >= lastD ? ' disabled' : '') + ' aria-label="Next month">&rsaquo;</button></div>' +
        '<div class="bk-grid">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) { return '<span class="dow">' + x + '</span>'; }).join('') + cells + '</div>';
      if (!date) { tm.innerHTML = '<p class="note bk-hint">Choose a day to see open times.</p>'; return; }
      if (longJob()) { tm.innerHTML = '<p class="note bk-hint">Your services take about ' + fmtMin(len()) + ', longer than one day of regular hours. Send the request for <b>' + fmtD(date, true) + '</b> and we will plan the time with you.</p>'; return; }
      var list = slots(date);
      // Times split into Morning / Afternoon / Evening so the list stays short.
      var PARTS = [['m', 'Morning', 0, 720], ['a', 'Afternoon', 720, 1020], ['e', 'Evening', 1020, 1440]];
      var groups = PARTS.map(function (p) { return { id: p[0], name: p[1], list: list.filter(function (t) { return t >= p[2] && t < p[3]; }) }; }).filter(function (g) { return g.list.length; });
      if (time != null) groups.forEach(function (g) { if (g.list.indexOf(time) > -1) part = g.id; });
      if (!groups.some(function (g) { return g.id === part; })) part = groups.length ? groups[0].id : null;
      var cur = groups.filter(function (g) { return g.id === part; })[0];
      tm.innerHTML = '<h3>Select a time <small>' + fmtD(date, true) + '</small></h3>' + (list.length ?
        (groups.length > 1 ? '<div class="bk-parts" role="tablist">' + groups.map(function (g) { return '<button type="button" role="tab" class="bk-part' + (g.id === part ? ' on' : '') + '" aria-selected="' + (g.id === part) + '" data-part="' + g.id + '">' + g.name + ' <small>' + g.list.length + '</small></button>'; }).join('') + '</div>' : '') +
        '<div class="bk-times">' + cur.list.map(function (t) { return '<button type="button" class="bk-slot' + (t === time ? ' sel' : '') + '" data-time="' + t + '">' + fmtT(t) + '</button>'; }).join('') + '</div><p class="note bk-hint">Times fit your ' + fmtMin(len()) + ' appointment.</p>' : '<p class="note bk-hint">No open times left on this day. Please choose another day.</p>');
    }
    function lines() {
      var E = est(), f = fees(), ad = addSel(), adSum = ad.reduce(function (x, a) { return x + (a.price || 0); }, 0), total = E.sum + adSum + f.travel + f.rush;
      return { E: E, f: f, total: total, ad: ad };
    }
    function drawReview() {
      var L = lines(), E = L.E, l = loc(), v = function (n) { var el = F.elements[n]; return el ? el.value.trim() : ''; };
      var when = A && A.error ? [($('#bkFallDate') || {}).value, ($('#bkFallTime') || {}).value].filter(Boolean).join(', ') : date ? fmtD(date, true) + (time != null ? ', ' + fmtT(time) + ' – ' + fmtT(time + len()) : ' (we plan the time)') : '';
      var where = l ? l.value + (l.dataset.addr === '1' ? ': ' + [v('address'), v('city'), v('zip')].filter(Boolean).join(', ') : '') : '';
      var row = function (a, b, c) { return '<div class="c-line' + (c ? ' ' + c : '') + '"><span>' + a + '</span><span>' + b + '</span></div>'; };
      var inPkg = function (s) { return E.pkg && E.pkg.price != null && E.pkg.services.indexOf(s.name) > -1; };
      $('#bkReview').innerHTML = (E.pkg ? row('<b>Package: ' + esc(E.pkg.title) + '</b>', E.pkg.price == null ? 'Quote' : '<b>' + money(E.pkg.price) + '</b>') : '') +
        E.sel.filter(function (s) { return !s.pkg; }).map(function (s) { return row((inPkg(s) ? '&nbsp;&nbsp;· ' : '') + esc(s.name), inPkg(s) ? 'Included' : s.price == null ? 'Quote' : money(s.price)); }).join('') +
        L.ad.map(function (a) { return row('+ ' + esc(a.name), a.price == null ? 'Quote' : money(a.price)); }).join('') +
        (L.f.travel ? row('Travel fee', money(L.f.travel)) : '') + (L.f.rush ? row('Emergency/squeeze-in fee', money(L.f.rush)) : '') +
        row('Estimated total', money(L.total) + (E.quote ? ' + quote' : ''), 'total') +
        row('When', esc(when)) + row('Where', esc(where)) + row('Name', esc(v('name'))) + (photos.length ? row('Inspiration photos', photos.length + ' added') : '') + row('Contact', esc([v('phone'), v('email')].filter(Boolean).join(' · '))) +
        (E.pkg && E.pkg.price != null ? row('Deposit to hold your date (50% of the package)', money(Math.round(E.pkg.price * 50) / 100)) : deposit ? row('Deposit to hold your time', money(deposit)) : '') + (F.dataset.balanceNote ? '<p class="note">' + esc(F.dataset.balanceNote) + '</p>' : '');
    }
    function chrome() {
      var L = lines(), E = L.E, mx = 0;
      while (mx < 4 && ok(mx)) mx++;
      $$('#bkSteps [data-go]').forEach(function (b, i) { b.classList.toggle('on', i === step); b.classList.toggle('bk-done', i < step); b.disabled = i > mx; if (i === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      $$('[data-panel]', F).forEach(function (p) { p.hidden = +p.dataset.panel !== step; });
      var addrNeeded = loc() && loc().dataset.addr === '1';
      $('#bkAddr').hidden = !addrNeeded;
      $$('#bkAddr input').forEach(function (i) { i.required = addrNeeded; i.disabled = !addrNeeded; });
      var tk = $('#bkTicket');
      tk.hidden = !E.sel.length;
      $('#bkT1').textContent = [E.pkg ? E.pkg.title : '', date ? fmtD(date) + (time != null ? ' · ' + fmtT(time) : '') : '', E.sel.filter(function (s) { return !s.pkg; }).map(function (s) { return s.name; }).concat(L.ad.map(function (a) { return a.name; })).join(' + ')].filter(Boolean).join(' • ');
      $('#bkT2').textContent = 'About ' + fmtMin(len()) + ' · estimate ' + money(L.total) + (E.quote ? ' + quote' : '');
      $('#bkBack').hidden = step === 0;
      var nx = $('#bkNext');
      nx.innerHTML = step === 4 ? esc(nx.dataset.submit) + ' <span class="arr">&rarr;</span>' : step === 0 ? 'Choose date &amp; time <span class="arr">&rarr;</span>' : step === 3 ? 'Review <span class="arr">&rarr;</span>' : 'Next <span class="arr">&rarr;</span>';
      // hidden fields that get sent
      F.elements['services'].value = E.sel.map(function (s) { return s.name; }).join(', ');
      if (F.elements['package']) F.elements['package'].value = E.pkg ? E.pkg.title + (E.pkg.price != null ? ' (' + money(E.pkg.price) + ')' : '') : '';
      F.elements['addons'].value = L.ad.map(function (a) { return a.name + (a.price != null ? ' (' + money(a.price) + ')' : ''); }).join(', ');
      F.elements['estimate'].value = E.sel.length ? money(L.total) + (E.quote ? '+' : '') + ' · about ' + fmtMin(len()) : '';
      var slotOk = A && !A.error && date && time != null;
      F.elements['slot_date'].value = slotOk ? date : '';
      F.elements['slot_start'].value = slotOk ? time : '';
      F.elements['slot_minutes'].value = slotOk ? len() : '';
      F.elements['preferred_date'].value = slotOk ? '' : A && A.error ? [($('#bkFallDate') || {}).value, ($('#bkFallTime') || {}).value].filter(Boolean).join(', ') : date ? fmtD(date, true) + ' (time to be planned)' : '';
    }
    function draw() { drawServices(); drawCal(); if (step === 4) drawReview(); chrome(); }
    renderBooking = function () { if (time != null && date && slots(date).indexOf(time) < 0) time = null; draw(); };
    function go(i) {
      for (var k = 0; k < i; k++) if (!ok(k, true)) { if (k !== step) { step = k; draw(); ok(k, true); } return; }
      say(''); step = i; draw();
      var top = F.getBoundingClientRect().top + window.pageYOffset - 110;
      if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' });
    }

    F.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.rmphoto) { var rp = photos.splice(+t.dataset.rmphoto, 1)[0]; if (rp) URL.revokeObjectURL(rp.url); drawPhotos(); return; }
      if (t.dataset.go) { go(+t.dataset.go); return; }
      if (t.dataset.bkcat) { cat = t.dataset.bkcat; drawServices(); return; }
      if (t.dataset.bkadd) { var ai = addons.indexOf(t.dataset.bkadd); if (ai > -1) addons.splice(ai, 1); else addons.push(t.dataset.bkadd); store.set('addons', addons); drawServices(); chrome(); return; }
      if (t.dataset.bksvc) { if (pkgNow()) return; toggleSvc(t.dataset.bksvc); say(''); return; }
      if (t.dataset.mon) { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + +t.dataset.mon, 1)); drawCal(); return; }
      if (t.dataset.part) { part = t.dataset.part; drawCal(); return; }
      if (t.dataset.day) { date = t.dataset.day; time = null; part = null; say(''); drawCal(); chrome(); var tm = $('#bkTimes'); if (tm.scrollIntoView) tm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      if (t.dataset.time) { time = +t.dataset.time; say(''); drawCal(); chrome(); return; }
      if (t.id === 'bkBack') { go(step - 1); return; }
      if (t.id === 'bkNext') {
        if (step < 4) { go(step + 1); return; }
        for (var k = 0; k < 4; k++) if (!ok(k)) { go(k); ok(k, true); return; }
        t.disabled = true; t.textContent = 'Sending…';
        // re-check the time is still free right before sending
        load(function () {
          if (date && time != null && A && !A.error && slots(date).indexOf(time) < 0) { t.disabled = false; time = null; step = 1; draw(); say('Sorry, that time was just taken. Please choose another time.'); return; }
          chrome();
          var fd = new FormData(F); fd.delete('photos');
          photos.forEach(function (p) { fd.append('photos', p.blob, p.name); });
          fetch(F.action, { method: 'POST', body: fd, headers: { 'x-ajax': '1' } })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
            .then(function (x) {
              if (x.ok) { if (x.d.pay && window.cotPay) { window.cotPay(x.d.pay, function (m) { t.disabled = false; chrome(); say(m); }); return; } location.href = x.d.redirect || '/thanks/'; return; }
              t.disabled = false; chrome();
              if (x.status === 409) { time = null; step = 1; load(function () { draw(); say(x.d.error); }); return; }
              say(x.d.error || 'Something went wrong. Please try again.');
            }, function () { t.disabled = false; chrome(); say('Could not send. Please check your internet connection and try again.'); });
        });
      }
    });
    F.addEventListener('change', function (e) { if (e.target.name === 'location' || e.target.id === 'bk-rush' || /^bkFall/.test(e.target.id)) chrome(); });
    F.addEventListener('input', function () { chrome(); });
    F.addEventListener('submit', function (e) { e.preventDefault(); var n = $('#bkNext'); if (n && !n.disabled) n.click(); });

    var q = /[?&]taken=([^&#]*)/.exec(location.search);
    if (q) { alertMsg = decodeURIComponent(q[1].replace(/\+/g, ' ')); history.replaceState(null, '', location.pathname + '#booking'); }
    step = picked.length && !addAvail().length ? 1 : 0;
    month = new Date(Date.UTC(+localToday().slice(0, 4), +localToday().slice(5, 7) - 1, 1));
    draw();
    load(function () {
      if (A && A.now) month = new Date(Date.UTC(+A.now.date.slice(0, 4), +A.now.date.slice(5, 7) - 1, 1));
      draw(); if (alertMsg) { step = picked.length ? 1 : 0; draw(); say(alertMsg); }
    });
  })();
  $$('form[name=speaking] input[type=date]').forEach(function (i) { i.min = new Date().toISOString().slice(0, 10); });
  paintServices(); renderBooking();

  /* ---------- events ---------- */
  var todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $$('.events').forEach(function (box) {
    var evs = $$('.ev', box).filter(function (ev) { var past = ev.dataset.date && ev.dataset.date < todayStr; if (past) ev.remove(); return !past; });
    $$('[data-ec]', box.parentElement).forEach(function (c) { if (c.dataset.ec !== 'All' && !evs.some(function (ev) { return ev.dataset.kind === c.dataset.ec; })) c.remove(); });
    if ($$('[data-ec]', box.parentElement).length < 3) $$('.ev-filters', box.parentElement).forEach(function (f) { f.remove(); });
    var lim = +box.dataset.limit; if (lim) evs.slice(lim).forEach(function (ev) { ev.remove(); });
    var empty = box.parentElement.querySelector('.ev-empty');
    if (!evs.length) { if (empty && empty.textContent.trim()) empty.hidden = false; else { var sec = box.closest('section'); if (sec) sec.hidden = true; } }
  });
  document.addEventListener('click', function (e) {
    var ec = e.target.closest('[data-ec]');
    if (ec) { var wrap = ec.closest('.wrap'); $$('[data-ec]', wrap).forEach(function (x) { x.classList.toggle('on', x === ec); }); $$('.ev', wrap).forEach(function (ev) { ev.hidden = !(ec.dataset.ec === 'All' || ev.dataset.kind === ec.dataset.ec); }); return; }
    var tx = e.target.closest('[data-tix]');
    if (tx) { var ev = D.events.filter(function (x) { return x.id === tx.dataset.tix; })[0]; if (!ev) return; var i = +tx.parentElement.querySelector('select').value; var t = ev.tickets[i];
      var d = new Date(ev.date + 'T12:00:00');
      addItem({ key: 't-' + ev.id + '-' + i, kind: 'ticket', id: ev.id, idx: i, name: ev.title, detail: t.name + ' ticket · ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), price: t.price, cls: 'ruby', thumb: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }); return; }
    var rv = e.target.closest('[data-rsvp]');
    if (rv) { var f = document.getElementById('rsvp-' + rv.dataset.rsvp); if (f) { f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input[name=name]').focus(); } }
  });

  /* ---------- giving ---------- */
  var give = $('#give');
  if (give) {
    var amt = +(($('#amounts .on') || {}).dataset || {}).a || 0, freq = 'once';
    var gbtn = $('#giveBtn'), gnote = $('.give-note', give);
    var label = function () { gbtn.innerHTML = (freq === 'monthly' ? 'Give monthly' : 'Add gift to cart') + ' <span class="arr">&rarr;</span>'; gnote.hidden = freq !== 'monthly'; gnote.textContent = 'Monthly gifts go straight to secure checkout and repeat every month. You can cancel anytime.'; };
    $('#amounts').addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b) return; amt = +b.dataset.a; $('#give-other').value = ''; $$('#amounts button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    if ($('#giveFreq')) $('#giveFreq').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; freq = b.dataset.f; $$('#giveFreq button').forEach(function (x) { x.classList.toggle('on', x === b); }); label(); });
    $('#give-other').addEventListener('input', function (e) { if (+e.target.value > 0) { amt = +e.target.value; $$('#amounts button').forEach(function (x) { x.classList.remove('on'); }); } });
    gbtn.addEventListener('click', function () {
      if (!(amt >= 1)) { toast('Choose an amount first'); return; }
      var des = $('#give-for') ? $('#give-for').value : '';
      if (freq === 'monthly') { goCheckout({ monthly: { amount: amt, designation: des } }, gbtn); return; }
      addItem({ key: 'g-' + amt + '-' + des, kind: 'gift', amount: amt, designation: des, name: 'Ministry gift', detail: des, price: amt, cls: 'espresso', thumb: 'Gift' });
      openCart();
    });
    label();
  }

  /* ---------- order complete ---------- */
  if (/^\/(order|give)-thanks/.test(location.pathname)) { cart = []; store.set('cart', cart); }

  renderCart();

  /* ---------- custom dropdown lists (mouse/trackpad; phones keep their own picker) ---------- */
  (function () {
    var fine = window.matchMedia && matchMedia('(pointer:fine)').matches; if (!fine) return;
    var dd = null;
    function close() { if (dd) { dd.sel.classList.remove('dd-open'); dd.list.remove(); dd = null; } }
    function setAct(i) { if (!dd) return; dd.act = i; Array.prototype.forEach.call(dd.list.children, function (li, j) { li.classList.toggle('act', j === i); }); var li = dd.list.children[i]; if (li) li.scrollIntoView({ block: 'nearest' }); }
    function choose(i) { var sel = dd.sel; close(); if (sel.selectedIndex !== i) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); sel.dispatchEvent(new Event('input', { bubbles: true })); } sel.focus(); }
    function open(sel) {
      close();
      var ul = document.createElement('ul'); ul.className = 'dd-list'; ul.setAttribute('role', 'listbox');
      Array.prototype.forEach.call(sel.options, function (o, i) { var li = document.createElement('li'); li.textContent = o.textContent; li.setAttribute('role', 'option'); if (i === sel.selectedIndex) { li.className = 'on'; li.setAttribute('aria-selected', 'true'); }
        li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); }); li.addEventListener('mouseenter', function () { setAct(i); }); ul.appendChild(li); });
      document.body.appendChild(ul);
      var r = sel.getBoundingClientRect(), h = Math.min(ul.scrollHeight, 300), below = innerHeight - r.bottom;
      ul.style.left = Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 180) - 8)) + 'px';
      ul.style.minWidth = r.width + 'px';
      var up = below < h + 12 && r.top > h + 12; if (up) ul.classList.add('up');
      ul.style.top = (up ? r.top - h - 6 : r.bottom + 6) + 'px'; sel.classList.add('dd-open');
      dd = { sel: sel, list: ul, act: sel.selectedIndex }; setAct(sel.selectedIndex);
    }
    document.addEventListener('mousedown', function (e) {
      var sel = e.target.closest && e.target.closest('select');
      if (sel && !sel.disabled && !sel.multiple) { e.preventDefault(); sel.focus(); if (dd && dd.sel === sel) close(); else open(sel); return; }
      if (dd && !e.target.closest('.dd-list')) close();
    }, true);
    document.addEventListener('keydown', function (e) {
      var sel = e.target.tagName === 'SELECT' ? e.target : null;
      if (dd) {
        var n = dd.list.children.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); setAct(Math.min(n - 1, dd.act + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(Math.max(0, dd.act - 1)); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(dd.act); }
        else if (e.key === 'Escape' || e.key === 'Tab') { e.stopPropagation(); close(); }
        return;
      }
      if (sel && (e.key === ' ' || e.key === 'Enter' || (e.altKey && e.key === 'ArrowDown'))) { e.preventDefault(); open(sel); }
    }, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', function (e) { if (dd && !(e.target && e.target.classList && e.target.classList.contains('dd-list'))) close(); }, true);
  })();

  // Long testimonies: show about half, with a Read more / Show less toggle
  (function () {
    var LINES = 7;
    function setup(p) {
      if (p.dataset.clampReady) return;
      var cs = getComputedStyle(p), lh = parseFloat(cs.lineHeight) || 26, pad = parseFloat(cs.paddingTop) || 0;
      var limit = Math.round(pad + lh * LINES);
      if (p.scrollHeight <= limit + lh * 2) return; // short enough, leave it
      p.dataset.clampReady = '1';
      p.classList.add('clamp');
      p.style.maxHeight = limit + 'px';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'read-more'; b.setAttribute('aria-expanded', 'false');
      b.innerHTML = 'Read more <span aria-hidden="true">&#9662;</span>';
      b.addEventListener('click', function () {
        var open = p.classList.toggle('open');
        p.style.maxHeight = (open ? p.scrollHeight : limit) + 'px';
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        b.innerHTML = (open ? 'Show less' : 'Read more') + ' <span aria-hidden="true">&#9662;</span>';
        if (!open) { var r = p.closest('.testi').getBoundingClientRect(); if (r.top < 0) window.scrollBy({ top: r.top - 90, behavior: 'smooth' }); }
      });
      p.insertAdjacentElement('afterend', b);
    }
    function run() { document.querySelectorAll('.testi p').forEach(setup); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else window.addEventListener('load', run);
    window.addEventListener('resize', function () { document.querySelectorAll('.testi p.clamp.open').forEach(function (p) { p.style.maxHeight = p.scrollHeight + 'px'; }); });
  })();

  // Newsletter sign-ups (gold box + Home "Join the Movement") -> /api/subscribe, answered in place.
  (function () {
    var ok = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
    function send(form) {
      var fd = new FormData(form);
      return fetch('/api/subscribe', { method: 'POST', body: fd, headers: { 'x-ajax': '1' } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
    }
    $$('.nl-form').forEach(function (form) {
      var card = form.parentNode, err = $('.nl-err', form), done = $('.nl-done', card), b = $('button[type=submit]', form);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); err.hidden = true;
        var first = form.first_name.value.trim(), last = form.last_name.value.trim(), em = form.email.value.trim();
        var fail = function (t, el) { err.textContent = t; err.hidden = false; if (el) el.focus(); };
        if (!first) return fail('Please enter your first name.', form.first_name);
        if (!last) return fail('Please enter your last name.', form.last_name);
        if (!ok(em)) return fail('Please enter a valid email address, like name@example.com.', form.email);
        var pg = $('.nl-page', form); if (pg) pg.value = location.href;
        var old = b.innerHTML; b.disabled = true; b.textContent = 'Signing you up…';
        send(form).then(function () {
          var t = $('.nl-done-text', done); t.textContent = (t.getAttribute('data-text') || '').replace(/\{\s*name\s*\}/gi, first);
          form.hidden = true; done.hidden = false;
        }).catch(function (x) { fail(x.message); }).then(function () { b.disabled = false; b.innerHTML = old; });
      });
    });
    $$('.nl-quick').forEach(function (form) {
      var msg = form.nextElementSibling;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var em = form.email.value.trim();
        var say = function (t) { if (msg) { msg.textContent = t; msg.hidden = false; } };
        if (!ok(em)) { say('Please enter a valid email address.'); form.email.focus(); return; }
        var b = $('button', form); b.disabled = true;
        send(form).then(function () { form.hidden = true; say("Thank you! You're on the list."); })
          .catch(function (x) { say(x.message); }).then(function () { b.disabled = false; });
      });
    });
  })();


  // Blog: "Latest from the blog" cards, Amen button, copy link, comments
  (function () {
    var e = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    $$('.bl-latest').forEach(function (sec) {
      var grid = $('.bl-grid', sec);
      fetch('/api/blog-latest?n=' + (sec.getAttribute('data-latest') || 3)).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.posts || !d.posts.length) { sec.hidden = true; return; }
        grid.innerHTML = d.posts.map(function (p) {
          return '<a class="bl-card" href="' + e(p.url) + '"><span class="bl-cv"' + (p.cover ? ' style="background-image:url(\'' + e(p.cover) + '\')"' : '') + '></span><span class="bl-tx"><span class="bl-meta"><span class="bl-cat">' + e(p.cat) + '</span><span>' + e(p.date) + '</span><span>' + p.min + ' min read</span></span><span class="bl-t">' + e(p.title) + '</span>' + (p.excerpt ? '<span class="bl-ex">' + e(p.excerpt) + '</span>' : '') + '</span></a>';
        }).join('');
      }).catch(function () { sec.hidden = true; });
    });
    var art = $('.bp[data-slug]');
    if (!art) return;
    var slug = art.getAttribute('data-slug');
    var react = function (body) { return fetch('/api/blog-react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ slug: slug }, body)) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); }); };
    var amen = $('[data-amen]', art), key = 'amen:' + slug, said = false;
    try { said = localStorage.getItem(key) === '1'; } catch (x) {}
    if (amen) {
      amen.setAttribute('aria-pressed', said);
      amen.addEventListener('click', function () {
        said = !said; amen.setAttribute('aria-pressed', said);
        var b = $('b', amen); b.textContent = Math.max(0, (+b.textContent || 0) + (said ? 1 : -1));
        try { localStorage.setItem(key, said ? '1' : '0'); } catch (x) {}
        react({ kind: said ? 'amen' : 'unamen' }).then(function (d) { b.textContent = d.amens; }).catch(function () {});
      });
    }
    $$('[data-copy]', art).forEach(function (b) {
      b.addEventListener('click', function () {
        var link = b.getAttribute('data-copy'), old = b.textContent;
        var done = function () { b.textContent = 'Link copied ✓'; setTimeout(function () { b.textContent = old; }, 1600); };
        if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () { prompt('Copy this link:', link); }); else prompt('Copy this link:', link);
      });
    });
    var f = $('[data-cmform]', art);
    if (f) f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = $('.bp-err', f); err.hidden = true;
      var fail = function (t) { err.textContent = t; err.hidden = false; };
      if (!f.name.value.trim()) return fail('Please write your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) return fail('Please enter a valid email address (it is not shown).');
      if (!f.text.value.trim()) return fail('Please write your comment.');
      var b = $('button[type=submit]', f); b.disabled = true;
      react({ kind: 'comment', name: f.name.value, email: f.email.value, text: f.text.value, company: f.company.value })
        .then(function () { f.innerHTML = '<p class="bp-thanks"><b>Thank you!</b> Your comment will appear here after it is approved.</p>'; })
        .catch(function (x) { fail(x.message); b.disabled = false; });
    });
  })();

  /* ---------- visitor counter (Studio → Visitors). No cookies, nothing personal; skipped on devices that opened the studio. ---------- */
  (function () {
    try {
      if (localStorage.getItem('nocount')) return;
      var pv = Math.random().toString(36).slice(2, 12), q = new URLSearchParams(location.search), shown = 0, from = Date.now();
      if (pv.length < 6) return;
      var send = function (o) {
        var b = JSON.stringify(o);
        try { if (navigator.sendBeacon && navigator.sendBeacon('/api/hit', new Blob([b], { type: 'text/plain' }))) return; } catch (e) {}
        fetch('/api/hit', { method: 'POST', body: b, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
      };
      send({ k: 'v', pv: pv, p: location.pathname, t: document.title, r: document.referrer || '', u: q.get('utm_source') || q.get('ref') || '' });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') { shown += Date.now() - from; send({ k: 'l', pv: pv, s: Math.round(shown / 1000) }); }
        else from = Date.now();
      });
    } catch (e) {}
  })();

})();

/* ---------- City Of Testimonies: testimony slider (dots + auto play) ---------- */
(function () {
  [].forEach.call(document.querySelectorAll('[data-slider]'), function (sl) {
    var slides = sl.querySelectorAll('.cot-slide'), dots = sl.parentNode.querySelectorAll('.cot-dots button'), i = 0, timer = null;
    if (slides.length < 2) return;
    var secs = Math.max(4, Number(sl.getAttribute('data-seconds')) || 8);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function go(n) {
      i = (n + slides.length) % slides.length;
      [].forEach.call(slides, function (s, k) { s.classList.toggle('on', k === i); if (k === i) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true'); });
      [].forEach.call(dots, function (d, k) { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    }
    function play() { if (reduce) return; clearInterval(timer); timer = setInterval(function () { if (document.visibilityState === 'visible') go(i + 1); }, secs * 1000); }
    [].forEach.call(dots, function (d) { d.addEventListener('click', function () { go(Number(d.getAttribute('data-go'))); play(); }); });
    sl.addEventListener('mouseenter', function () { clearInterval(timer); });
    sl.addEventListener('mouseleave', play);
    play();
  });
})();

/* ---------- City Of Testimonies: pay right after a form (Detox sign-up, 1:1 request) ---------- */
(function () {
  // Opens the secure Stripe page for a saved registration or session request. Prices are checked on the server.
  window.cotPay = function (pay, fail) {
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pay: pay }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (x.ok && x.d.url) { location.href = x.d.url; return; }
        fail((x.d.error || 'The card page could not open.') + ' Your form was saved. You can also pay another way: see the Pay page.');
      }, function () { fail('Could not reach the payment page. Your form was saved; please check your internet and try again, or pay another way.'); });
  };
  [].forEach.call(document.querySelectorAll('form[data-payform]'), function (f) {
    var err = f.querySelector('.cot-form-err'), b = f.querySelector('button[type=submit]');
    var say = function (m) { if (!err) return; err.textContent = m; err.hidden = !m; };
    f.addEventListener('submit', function (e) {
      e.preventDefault(); say('');
      if (f.reportValidity && !f.reportValidity()) return;
      if (f.elements.name) f.elements.name.value = [f.elements.first_name && f.elements.first_name.value, f.elements.last_name && f.elements.last_name.value].filter(Boolean).join(' ').trim();
      var old = b.innerHTML; b.disabled = true; b.textContent = 'Sending…';
      var back = function (m) { b.disabled = false; b.innerHTML = old; say(m); };
      fetch(f.action, { method: 'POST', body: new FormData(f), headers: { 'x-ajax': '1' } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) return back(x.d.error || 'Something went wrong. Please try again.');
          if (x.d.pay) { b.textContent = 'Opening the card page…'; return window.cotPay(x.d.pay, back); }
          location.href = x.d.redirect || '/thanks/';
        }, function () { back('Could not send. Please check your internet connection and try again.'); });
    });
  });
  // Pay page: highlight the way they chose and show what to pay for.
  var info = document.querySelector('.cot-payinfo');
  if (info) {
    var q = new URLSearchParams(location.search), m = q.get('m'), fr = q.get('for');
    [].forEach.call(info.querySelectorAll('.cot-pay'), function (c) { if (m && c.getAttribute('data-way') === m) { c.classList.add('chosen'); setTimeout(function () { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200); } });
    var amt = info.querySelector('.cot-pay-amount');
    if (amt && fr) { var a = amt.getAttribute('data-' + fr); var what = fr === 'detox' ? 'your Monthly Spiritual Detox registration' : fr === 'session' ? 'your 1:1 session with Chief Apostle' : ''; if (what) amt.innerHTML = '<b>Your form was received.</b> Please send ' + (a ? '<b>' + a + '</b> ' : 'the amount ') + 'for ' + what + (m ? ' by <b>' + m.replace(/[<>&]/g, '') + '</b>' : '') + ' and put your full name in the note.'; }
  }
})();

/* ---------- City Of Testimonies: only one 1:1 session → pick it for them ---------- */
setTimeout(function () {
  var b = document.querySelectorAll('#bkSvcs [data-bksvc]');
  if (b.length === 1 && b[0].getAttribute('aria-pressed') !== 'true' && !b[0].classList.contains('on')) b[0].click();
}, 0);
