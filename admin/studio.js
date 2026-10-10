// City Of Testimonies studio (/admin/): Home dashboard, visual page editor, shop/prices/settings, "Put it live".
// Pages and settings are saved as content files in the GitHub repo (through /api/github, like the advanced editor),
// forms are built from the advanced editor's own field list (/admin/config.yml), and the preview uses the real site renderer.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var main = $('#main');
  function toast(t) { var el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 3200); }
  function token() { try { var u = JSON.parse(localStorage.getItem('decap-cms-user') || 'null'); return u && u.token; } catch (e) { return null; } }
  var LOGIN = false;
  function api(path, opts) {
    opts = opts || {};
    var h = Object.assign({ Authorization: 'Bearer ' + (token() || '') }, opts.body && typeof opts.body === 'string' ? { 'Content-Type': 'application/json' } : {}, opts.headers || {});
    return fetch(path, Object.assign({}, opts, { headers: h })).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('Please log in.'); }
      return r;
    });
  }
  function apiJson(path, opts) { return api(path, opts).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || d.message || 'Error ' + r.status); return d; }); }); }
  function showLogin() {
    if (LOGIN) return; LOGIN = true;
    main.innerHTML = '<div class="card" style="max-width:520px;margin:40px auto;display:grid;gap:12px"><h2>Please log in</h2><p class="sub">Your login has run out. Log in again, then come back here.</p><p><a class="btn go" href="/admin/cms.html">Log in</a></p></div>';
  }

  /* ---------- GitHub content files (through /api/github) ---------- */
  var CFG = null, REPO = '', BRANCH = 'main';
  var b64d = function (s) { var bin = atob(String(s).replace(/\s/g, '')); var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); };
  var b64e = function (s) { var u = new TextEncoder().encode(s), bin = ''; for (var i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };
  var ghPath = function (p) { return '/api/github/repos/' + REPO + '/contents/' + p.split('/').map(encodeURIComponent).join('/'); };
  function ghGet(p) {
    return apiJson(ghPath(p) + '?ref=' + BRANCH + '&t=' + Date.now()).then(function (d) {
      if (d.content == null && d.download_url) return fetch(d.download_url).then(function (r) { return r.text(); }).then(function (t) { return { data: JSON.parse(t), sha: d.sha }; });
      return { data: JSON.parse(b64d(d.content)), sha: d.sha };
    });
  }
  function ghList(dir) { return apiJson(ghPath(dir) + '?ref=' + BRANCH + '&t=' + Date.now()); }
  function ghPut(p, obj, sha, msg) {
    var body = { message: msg, content: b64e(JSON.stringify(obj, null, 2) + '\n'), branch: BRANCH };
    if (sha) body.sha = sha;
    return api(ghPath(p), { method: 'PUT', body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 409 || r.status === 422) throw new Error('This was changed somewhere else in the meantime. Reload the page to get the newest version, then make your change again.');
        if (!r.ok) throw new Error(d.message || d.error || 'Could not save (' + r.status + ').');
        return d.content && d.content.sha;
      });
    });
  }

  /* ---------- the site renderer for previews ---------- */
  var SITE = window.siteSettings || {}, DATA = window.siteData || {};
  function previewDoc(page, sections, opts) {
    opts = opts || {};
    var R = window.SiteRender;
    if (!R) return '<p style="padding:20px;font-family:sans-serif">Preview not available.</p>';
    var site = opts.site || SITE, data = opts.data || DATA;
    var html = R.renderPage({ title: page.title || 'Preview', slug: page.slug || 'preview', description: page.description || '', sections: [{ type: 'blogSlot' }] }, site, data);
    var body = (sections || []).map(function (s, i) {
      if (s && s.hidden) return '<div class="sx-hid" data-sx="' + i + '">Hidden section: ' + esc(typeLabel(s.type)) + ' (click to edit)</div>';
      var inner = ''; try { inner = R.renderSections([s], site, data); } catch (e) { inner = '<p style="padding:20px">This section could not be shown: ' + esc(e.message) + '</p>'; }
      return '<div class="sx' + (opts.cur === i ? ' cur' : '') + '" data-sx="' + i + '"><span class="sx-tag">' + (opts.cur === i ? 'Editing' : 'Click to edit') + '</span>' + inner + '</div>';
    }).join('');
    var extra = '<style>.sx{position:relative;outline:2px solid transparent;outline-offset:-2px;cursor:pointer;transition:outline-color .15s}.sx:hover{outline-color:rgba(201,162,74,.7)}.sx.cur{outline-color:#9b1313}.sx-tag{position:absolute;top:8px;right:8px;z-index:50;background:#c9a24a;color:#2b0e04;font:600 11px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;border-radius:999px;display:none}.sx:hover .sx-tag,.sx.cur .sx-tag{display:block}.sx.cur .sx-tag{background:#9b1313;color:#fff}.sx-hid{padding:12px 20px;font:13px system-ui,sans-serif;color:#7a5547;text-align:center;cursor:pointer;background:repeating-linear-gradient(45deg,#fdfaf7,#fdfaf7 8px,#f4e7df 8px,#f4e7df 16px)}a{pointer-events:none}</style>' +
      '<script>document.addEventListener("click",function(e){var s=e.target.closest("[data-sx]");e.preventDefault();if(s)parent.postMessage({studioSection:+s.getAttribute("data-sx")},"*")},true);<\/script>';
    html = html.replace('<!--BLOG-->', body).replace(/<script src="\/site\.js[^"]*"[^>]*><\/script>/, '').replace('</body>', extra + '</body>');
    return html;
  }
  function setFrame(iframe, html) {
    var y = 0; try { y = iframe.contentWindow.scrollY; } catch (e) {}
    iframe.onload = function () { try { iframe.contentWindow.scrollTo(0, y); } catch (e) {} };
    iframe.srcdoc = html;
  }

  /* ---------- field types from the advanced editor's config ---------- */
  var TYPES = {}, PAGEFIELDS = [];
  var ICON = { banner: '🖼️', pageBanner: '🖼️', text: '📝', imageText: '🪞', tiles: '🔲', blogLatest: '✍️', newsletter: '💌', journey: '🧭', featuredBooks: '📚', bookShop: '📚', events: '📅', testimonies: '💬', about: '👤', timeline: '⏳', tagline: '✨', pillars: '🏛️', ministryForms: '🙏', give: '🎁', serviceMenu: '💄', packages: '💍', policies: '📋', giftCards: '🎟️', bookingForm: '🗓', contact: '✉️', weddingInquiry: '💍', cotHero: '🖼️', features: '🔲', mandate: '🪞', carry: '🖼️', verse: '📖', testiSlider: '💬', promo: '📣', gatherings: '📅', sow: '🌍', pageHead: '🏷️', faq: '❓', checklist: '✅', buttonRow: '🔘', register: '📝', payInfo: '💳' };
  var typeLabel = function (t) { return (TYPES[t] && TYPES[t].label) || t; };
  var secSummary = function (s) { return s.heading || s.title || s.script || s.cardTitle || s.formTitle || s.newsletterTitle || (Array.isArray(s.words) && s.words[0] && (s.words[0].text || s.words[0].value || s.words[0])) || ''; };

  // value helpers
  function getAt(obj, path) { return path.reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function setAt(obj, path, val) { var o = obj; for (var i = 0; i < path.length - 1; i++) { if (o[path[i]] == null) o[path[i]] = typeof path[i + 1] === 'number' ? [] : {}; o = o[path[i]]; } o[path[path.length - 1]] = val; }
  var P = function (path) { return esc(JSON.stringify(path)); };
  var defOf = function (f) {
    if (f.default !== undefined) return JSON.parse(JSON.stringify(f.default));
    if (f.widget === 'list') return [];
    if (f.widget === 'object') { var o = {}; (f.fields || []).forEach(function (x) { var d = defOf(x); if (d !== undefined && d !== '') o[x.name] = d; }); return o; }
    if (f.widget === 'boolean') return undefined;
    return '';
  };
  var OPEN = {}; // which list items / groups are open (by path)
  function summaryOf(f, v) {
    if (v == null) return '';
    if (typeof v !== 'object') return String(v);
    if (f.summary) { var s = f.summary.replace(/\{\{fields\.(\w+)\}\}/g, function (m, k) { var x = v[k]; return x == null ? '' : typeof x === 'object' ? (x.label || '') : String(x); }).replace(/^[\s→·|-]+|[\s→·|-]+$/g, ''); if (s.trim()) return s; }
    var keys = ['title', 'name', 'label', 'heading', 'text', 'quote', 'question', 'value'];
    for (var i = 0; i < keys.length; i++) if (v[keys[i]] && typeof v[keys[i]] !== 'object') return String(v[keys[i]]);
    return '';
  }
  // 😊 Emoji + A−/A+ size next to text boxes. Sizes are saved beside the text as "_sz": { field: 1.3 } (the website draws them).
  var NOEMJ = /(url|link|href|^id$|email|phone|slug|icon|anchor|video|price|amount|code|key|file|image|photo|cover|color|font|date|time|^tz$|minutes|deposit|currency|embed|domain|replyto|sender|zip|^type$|layout|width|height|limit|^value$|number)/i;
  var NOSZ = /(seo|meta|^alt$|tags?$|category|options|placeholder)/i, NOSZ_NOW = false;
  function textTools(f, path) {
    var last = path[path.length - 1];
    if (NOEMJ.test(f.name || '') || !window.StudioEmoji) return '';
    var sized = !NOSZ_NOW && typeof last !== 'number' && !NOSZ.test(f.name || '');
    return window.StudioEmoji.tools('data-fp="' + P(path) + '"', sized ? 1 : undefined);
  }
  function field(f, v, path) {
    if (!f || f.widget === 'hidden') return '';
    var lb = '<span class="lb">' + esc(f.label || f.name) + '</span>', hint = f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '';
    var id = 'f' + path.join('_').replace(/[^\w]/g, '_');
    var w = f.widget || 'string';
    var tt = (w === 'string' || w === 'text' || w === 'markdown') ? textTools(f, path) : '';
    if (tt) {
      var row = '<span class="lbrow"><label class="lb" for="' + id + '">' + esc(f.label || f.name) + '</label>' + tt + '</span>';
      if (w === 'string') return '<div class="f">' + row + '<input class="inp" id="' + id + '" data-p="' + P(path) + '" data-w="string" value="' + esc(v == null ? '' : v) + '">' + hint + '</div>';
      return '<div class="f">' + row + '<textarea class="inp" id="' + id + '" rows="' + (w === 'markdown' ? 5 : 3) + '" data-p="' + P(path) + '" data-w="string">' + esc(v == null ? '' : v) + '</textarea>' + (hint || (w === 'markdown' ? '<span class="hint">**word** = bold · [text](link) = link · empty line = new paragraph</span>' : '')) + '</div>';
    }
    if (w === 'string') return '<label class="f">' + lb + '<input class="inp" id="' + id + '" data-p="' + P(path) + '" data-w="string" value="' + esc(v == null ? '' : v) + '">' + hint + '</label>';
    if (w === 'text' || w === 'markdown') return '<label class="f">' + lb + '<textarea class="inp" id="' + id + '" rows="' + (w === 'markdown' ? 5 : 3) + '" data-p="' + P(path) + '" data-w="string">' + esc(v == null ? '' : v) + '</textarea>' + (hint || (w === 'markdown' ? '<span class="hint">**word** = bold · [text](link) = link · empty line = new paragraph</span>' : '')) + '</label>';
    if (w === 'number') return '<label class="f">' + lb + '<input class="inp" id="' + id + '" type="number" step="any" data-p="' + P(path) + '" data-w="number" value="' + esc(v == null ? '' : v) + '">' + hint + '</label>';
    if (w === 'boolean') { var on = v === undefined ? f.default !== false && f.default !== undefined ? true : !!f.default : !!v; return '<div class="tog"><span>' + esc(f.label || f.name) + (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '') + '</span><span class="sw2"><input type="checkbox" id="' + id + '" data-p="' + P(path) + '" data-w="boolean"' + (on ? ' checked' : '') + ' aria-label="' + esc(f.label || f.name) + '"><span></span></span></div>'; }
    if (w === 'color') return '<div class="f">' + lb + '<span class="color"><input type="color" data-p="' + P(path) + '" data-w="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000') + '" aria-label="' + esc(f.label) + '"><input class="inp" data-p="' + P(path) + '" data-w="string" value="' + esc(v || '') + '" aria-label="' + esc(f.label) + ' code"></span>' + hint + '</div>';
    if (w === 'datetime') { var dateOnly = f.time_format === false || (f.format && !/H/.test(f.format)); var val = String(v || ''); if (!dateOnly && val && !/T/.test(val)) val = val.replace(' ', 'T'); return '<label class="f">' + lb + '<input class="inp" id="' + id + '" type="' + (dateOnly ? 'date' : 'datetime-local') + '" data-p="' + P(path) + '" data-w="string" value="' + esc(dateOnly ? val.slice(0, 10) : val.slice(0, 16)) + '">' + hint + '</label>'; }
    if (w === 'select') {
      var opts = (f.options || []).map(function (o) { return typeof o === 'object' ? o : { label: o, value: o }; });
      if (f.multiple) { var arr = Array.isArray(v) ? v : []; return '<div class="f">' + lb + '<div class="chks">' + opts.filter(function (o) { return !o.gone || arr.indexOf(o.value) > -1; }).map(function (o) { return '<label><input type="checkbox" data-p="' + P(path) + '" data-w="multi" value="' + esc(o.value) + '"' + (arr.indexOf(o.value) > -1 ? ' checked' : '') + '>' + esc(o.label) + '</label>'; }).join('') + '</div>' + hint + '</div>'; }
      var cur = v == null || v === '' ? (f.default != null ? f.default : '') : v;
      return '<label class="f">' + lb + '<select class="inp" id="' + id + '" data-p="' + P(path) + '" data-w="select">' + (opts.some(function (o) { return o.value === ''; }) ? '' : '<option value="">—</option>') + opts.map(function (o) { return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(cur) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select>' + hint + '</label>';
    }
    if (w === 'file' && f.ebook) {
      // private ebook file (see server/ebooks.js): value "ebook:<id>/<file name>"
      var m = String(v || '').match(/^ebook:([a-f0-9]{32})(?:\/(.*))?$/), pub = v && !m;
      return '<div class="f">' + lb + '<div class="ebk' + (m ? ' has' : '') + '"><span class="ebk-ic" aria-hidden="true">' + (m ? '&#10003;' : 'PDF') + '</span><span class="ebk-tx">' +
        (m ? '<b>' + esc(m[2] || 'Ebook file') + '</b><small>Stored privately · sent automatically after purchase</small>' : pub ? '<b>Public link (anyone with it can download)</b><small>' + esc(v) + ' – upload the PDF here instead to protect it</small>' : '<b>No file yet</b><small>Buyers get “your link will follow by email” and you get a reminder to send it.</small>') +
        '</span><span class="row"><label class="btn sm upl">' + (v ? 'Replace' : 'Upload PDF') + '<input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" data-ebook="' + P(path) + '"></label>' +
        (m ? '<button class="btn sm" type="button" data-ebtest="' + m[1] + '" data-ebname="' + esc(m[2] || 'ebook.pdf') + '">Test download</button>' : '') +
        (v ? '<button class="btn sm" type="button" data-act="clear" data-p="' + P(path) + '">Remove</button>' : '') + '</span></div>' + hint + '</div>';
    }
    if (w === 'image' || w === 'file') {
      var isImg = w === 'image' || /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(v || '') || /\/api\/image\//.test(v || '');
      return '<div class="f">' + lb + '<div class="img"><span class="th' + (v && isImg ? ' has' : '') + '" style="' + (v && isImg ? "background-image:url('" + esc(v) + "')" : '') + '">' + (v ? (isImg ? '' : 'File') : 'None') + '</span><span style="display:grid;gap:6px;min-width:0"><span class="row"><label class="btn sm upl">' + (v ? 'Change' : 'Upload') + '<input type="file" accept="' + (w === 'image' ? 'image/*' : '*/*') + '" data-up="' + P(path) + '"></label>' + (v ? '<button class="btn sm" type="button" data-act="clear" data-p="' + P(path) + '">Remove</button>' : '') + '</span><input class="inp" data-p="' + P(path) + '" data-w="string" value="' + esc(v || '') + '" placeholder="or paste a link" aria-label="' + esc(f.label) + ' link"></span></div>' + hint + '</div>';
    }
    if (w === 'object') {
      var k = path.join('.'), inner = (f.fields || []).map(function (x) { return field(x, v ? v[x.name] : undefined, path.concat(x.name)); }).join('');
      var open = OPEN[k] != null ? OPEN[k] : !f.collapsed;
      return '<details class="obj" data-k="' + esc(k) + '"' + (open ? ' open' : '') + '><summary>' + esc(f.label || f.name) + '</summary><div class="in">' + (f.hint ? '<span class="hint" style="color:var(--muted);font-size:.78rem">' + esc(f.hint) + '</span>' : '') + inner + '</div></details>';
    }
    if (w === 'list') {
      var list = Array.isArray(v) ? v : [];
      var items = list.map(function (item, i) {
        var ip = path.concat(i), ctl = '<button class="ib" type="button" title="Move up" data-act="up" data-p="' + P(ip) + '"' + (i ? '' : ' disabled') + '>↑</button><button class="ib" type="button" title="Move down" data-act="down" data-p="' + P(ip) + '"' + (i < list.length - 1 ? '' : ' disabled') + '>↓</button><button class="ib" type="button" title="Remove" data-act="del" data-p="' + P(ip) + '">✕</button>';
        if (f.field) {
          var sub = Object.assign({}, f.field, { label: f.field.label || 'Item' });
          if ((sub.widget || 'string') === 'string' || sub.widget === 'number') return '<div class="prim"><input class="inp" data-p="' + P(ip.concat(f.field.name ? [] : [])) + '" data-w="' + (sub.widget === 'number' ? 'number' : 'string') + '" data-item="1" value="' + esc(item && typeof item === 'object' ? item[f.field.name] : item) + '" aria-label="' + esc(sub.label) + '">' + ctl + '</div>';
          return '<div class="it"><div class="in" style="border:0;padding:10px">' + field(sub, item, ip) + '<div style="display:flex;justify-content:flex-end">' + ctl + '</div></div></div>';
        }
        var fields = f.fields || ((f.types || []).filter(function (t) { return item && t.name === item.type; })[0] || {}).fields || [];
        var ik = ip.join('.'), open = OPEN[ik] != null ? !!OPEN[ik] : !!f.open_items;
        return '<details class="it" data-k="' + esc(ik) + '"' + (open ? ' open' : '') + '><summary><span class="s">' + (esc(summaryOf(f, item)) || '<small>' + esc((f.label_singular || f.label || 'Item')) + ' ' + (i + 1) + '</small>') + '</span>' + ctl + '</summary><div class="in">' + fields.map(function (x) { return field(x, item ? item[x.name] : undefined, ip.concat(x.name)); }).join('') + '</div></details>';
      }).join('');
      return '<div class="f">' + lb + (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '') + '<div class="lst">' + (items || '<span class="hint" style="color:var(--muted);font-size:.82rem">Nothing here yet.</span>') + '<button class="add" type="button" data-act="add" data-p="' + P(path) + '">+ Add ' + esc((f.label_singular || (f.field && f.field.label) || 'one').toLowerCase()) + '</button></div></div>';
    }
    return '';
  }
  function fieldByPath(fields, path) {
    // walk the field definitions along a value path (list indexes are skipped)
    var f = { widget: 'object', fields: fields }, model = null;
    for (var i = 0; i < path.length; i++) {
      var k = path[i];
      if (typeof k === 'number') { if (f.widget === 'list') { if (f.field) f = f.field; else f = { widget: 'object', fields: f.fields || [], _types: f.types }; } continue; }
      var list = f.fields || [];
      if (f._types && model) { /* typed list item */ }
      var nf = list.filter(function (x) { return x.name === k; })[0];
      if (!nf) return null; f = nf;
    }
    return f;
  }
  // Wires a form container to a model. getFields(path) -> field def for a list path (for adding items).
  function szPath(fp) { var p = JSON.parse(fp); return { parent: p.slice(0, -1), key: p[p.length - 1] }; }
  function bindForm(box, model, defs, onChange) {
    var redraw = box._redraw;
    $$('.emj-sz', box).forEach(function (w) { var b = w.querySelector('[data-fp]'); if (!b) return; var z = szPath(b.dataset.fp), o = getAt(model, z.parent.concat('_sz')); window.StudioEmoji.paint(w, o && o[z.key]); });
    if (box._emjH) box.removeEventListener('click', box._emjH);
    box.addEventListener('click', box._emjH = function (e) {
      var eb = e.target.closest('[data-emj]');
      if (eb && box.contains(eb)) { e.preventDefault(); var inp = box.querySelector('[data-p="' + eb.dataset.fp.replace(/"/g, '\\"') + '"]') || eb.closest('.f').querySelector('.inp'); if (inp) window.StudioEmoji.open(eb, inp); return; }
      var sb = e.target.closest('[data-szd]');
      if (sb && box.contains(sb)) {
        e.preventDefault();
        var z = szPath(sb.dataset.fp), o = getAt(model, z.parent.concat('_sz'));
        var nv = window.StudioEmoji.step(o && o[z.key], +sb.dataset.szd);
        if (nv === 1) { if (o) { delete o[z.key]; if (!Object.keys(o).length) { var par = getAt(model, z.parent); if (par) delete par._sz; } } }
        else { if (!o || typeof o !== 'object') { o = {}; setAt(model, z.parent.concat('_sz'), o); } o[z.key] = nv; }
        window.StudioEmoji.paint(sb.closest('.emj-sz'), nv); onChange(false);
      }
    });
    box.oninput = function (e) {
      var t = e.target; if (!t.dataset.p) return;
      var path = JSON.parse(t.dataset.p), w = t.dataset.w, val;
      if (w === 'boolean' || w === 'multi') return;
      val = t.value;
      if (w === 'number') val = t.value === '' ? '' : Number(t.value);
      setAt(model, path, val);
      if (w === 'color') { var twin = t.parentNode.querySelector('input.inp'); if (twin) twin.value = t.value; }
      if (w === 'string' && t.parentNode.classList.contains('color')) { var c = t.parentNode.querySelector('input[type=color]'); if (c && /^#[0-9a-f]{6}$/i.test(t.value)) c.value = t.value; }
      onChange(false);
    };
    box.onchange = function (e) {
      var t = e.target;
      if (t.dataset.ebook) {
        var ep = JSON.parse(t.dataset.ebook), ef = t.files[0]; if (!ef) return;
        if (ef.size > 40e6) { toast('That file is too large (max 40 MB).'); t.value = ''; return; }
        toast('Uploading ebook… (this can take a minute)');
        var fd = new FormData(); fd.append('file', ef, ef.name);
        fetch('/api/ebook', { method: 'POST', headers: { Authorization: 'Bearer ' + (token() || 'cf-access') }, body: fd })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Upload failed (' + r.status + ').'); return d; }); })
          .then(function (d) { setAt(model, ep, d.ref); onChange(true); toast('Ebook uploaded – click Save to keep it'); })
          .catch(function (x) { toast(x.message); t.value = ''; });
        return;
      }
      if (t.dataset.up) { var up = JSON.parse(t.dataset.up), file = t.files[0]; if (!file) return; toast('Uploading…'); window.BlockEditor.upload(file).then(function (u) { setAt(model, up, u); onChange(true); toast('Picture added'); }).catch(function (x) { toast(x.message); }); return; }
      if (!t.dataset.p) return;
      var path = JSON.parse(t.dataset.p);
      if (t.dataset.w === 'boolean') { setAt(model, path, t.checked); onChange(false); }
      if (t.dataset.w === 'multi') { var vals = $$('input[data-w="multi"]', t.closest('.chks')).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); setAt(model, path, vals); onChange(false); if (!t.checked && / \(not in your services any more\)$/.test(t.parentNode.textContent)) t.parentNode.remove(); }
      if (t.dataset.w === 'select') { setAt(model, path, t.value); onChange(false); }
    };
    box.addEventListener('toggle', function (e) { var d = e.target; if (d.dataset && d.dataset.k != null) OPEN[d.dataset.k] = d.open; }, true);
    box.onclick = function (e) {
      var eb = e.target.closest('[data-ebtest]');
      if (eb && box.contains(eb)) {
        e.preventDefault(); toast('Preparing test download…');
        fetch('/api/ebook/' + eb.dataset.ebtest, { headers: { Authorization: 'Bearer ' + (token() || 'cf-access') } })
          .then(function (r) { if (!r.ok) throw new Error('Test download failed (' + r.status + '). Save first, then try again.'); return r.blob(); })
          .then(function (bl) { var a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = eb.dataset.ebname; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); })
          .catch(function (x) { toast(x.message); });
        return;
      }
      var b = e.target.closest('[data-act]'); if (!b || !box.contains(b)) return;
      e.preventDefault();
      var path = JSON.parse(b.dataset.p), act = b.dataset.act;
      if (act === 'clear') { setAt(model, path, ''); onChange(true); return; }
      if (act === 'add') {
        var f = fieldByPath(defs, path); var arr = getAt(model, path); if (!Array.isArray(arr)) { arr = []; setAt(model, path, arr); }
        var item = f && f.field ? (f.field.widget === 'object' ? defOf(f.field) : '') : f ? defOf({ widget: 'object', fields: f.fields || [] }) : {};
        arr.push(item); OPEN[path.concat(arr.length - 1).join('.')] = true; onChange(true); return;
      }
      var idx = path[path.length - 1], parent = getAt(model, path.slice(0, -1));
      if (!Array.isArray(parent)) return;
      if (act === 'del') { parent.splice(idx, 1); onChange(true); return; }
      if (act === 'up' || act === 'down') { var j = idx + (act === 'up' ? -1 : 1); var x = parent.splice(idx, 1)[0]; parent.splice(j, 0, x); onChange(true); }
    };
  }

  /* ---------- menu + live box ---------- */
  var NAV = [
    ['grp', 'Start'], ['home', '🏠', 'Home', '#home'], ['visitors', '📈', 'Visitors', '#visitors'],
    ['grp', 'Your website'], ['pages', '📄', 'Pages', '#pages'], ['blog', '✍️', 'Blog', '/admin/blog.html'], ['shop', '📅', 'Events & shop', '#shop/events'], ['services', '💲', '1:1 sessions & prices', '#services'],
    ['grp', 'People'], ['messages', '📬', 'Messages', '/admin/messages.html'], ['schedule', '🗓', 'Schedule (1:1 hours)', '/admin/schedule.html'], ['newsletter', '💌', 'Newsletter', '/admin/newsletter.html'],
    ['grp', 'Setup'], ['settings', '⚙️', 'Settings', '#settings'], ['cms', '🧰', 'Advanced editor', '/admin/cms.html']
  ];
  var DASH = null, LIVE = null, ROUTE = 'home';
  function seen() { try { return new Set(JSON.parse(localStorage.getItem('inbox-seen') || '[]')); } catch (e) { return new Set(); } }
  function unread() { if (!DASH) return 0; var s = seen(); return DASH.messages.filter(function (m) { return !s.has(m.id); }).length; }
  function drawNav() {
    var u = unread(), cw = DASH ? DASH.comments.waiting : 0;
    $('#nav').innerHTML = NAV.map(function (n) {
      if (n[0] === 'grp') return '<div class="grp">' + n[1] + '</div>';
      var b = n[0] === 'messages' ? u : n[0] === 'blog' ? cw : 0;
      return '<a href="' + n[3] + '"' + (ROUTE === n[0] ? ' aria-current="page"' : '') + '><span class="ic">' + n[1] + '</span>' + n[2] + (b ? '<span class="bdg">' + b + '</span>' : n[0] === 'cms' ? '<span class="ext">↗</span>' : '') + '</a>';
    }).join('');
  }
  function drawLive() {
    var box = $('#live');
    if (!LIVE) { box.innerHTML = '<p>Checking what is live…</p>'; return; }
    if (LIVE.error) { box.innerHTML = '<p>Could not check what is live.</p><button class="btn gold sm" type="button" data-golive>🚀 Put it live</button>'; return; }
    if (LIVE.building) { box.innerHTML = '<p><b>⏳ Putting it live…</b> This takes a few minutes. You can keep working.</p>'; return; }
    var n = (LIVE.waiting || []).length;
    box.innerHTML = n ? '<p><b>' + n + ' saved change' + (n > 1 ? 's' : '') + '</b> not on the website yet.</p><ul>' + LIVE.waiting.slice(-5).reverse().map(function (w) { return '<li>• ' + esc(w.title) + '</li>'; }).join('') + '</ul><button class="btn gold sm" type="button" data-golive>🚀 Put it live</button>'
      : '<p><b>✓ Everything is live.</b> The website shows your latest changes.</p>' + (LIVE.failed ? '<p style="color:#f6b8ad">' + esc(LIVE.failed) + '</p>' : '');
  }
  function loadLive() { return apiJson('/api/go-live').then(function (d) { LIVE = d; }).catch(function (e) { LIVE = { error: e.message }; }).then(function () { drawLive(); if (ROUTE === 'home' && DASH) home(); }); }
  function goLive(btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
    apiJson('/api/go-live', { method: 'POST' }).then(function () { toast('Putting it live… the website updates in a few minutes.'); LIVE = Object.assign({}, LIVE, { building: true }); drawLive(); setTimeout(loadLive, 60000); })
      .catch(function (e) { toast(e.message); if (btn) { btn.disabled = false; btn.textContent = '🚀 Put it live'; } });
  }

  /* ---------- Home ---------- */
  var COLORS = ['#b5487a', '#5b3a8a', '#8a5a2b', '#2f6b5a', '#9b1313', '#3d5a99'];
  var initials = function (n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''); };
  var fmtT = function (m) { var h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };
  var fmtDay = function (d, today) { if (d === today) return 'Today'; var t = new Date(today + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); if (d === t.toISOString().slice(0, 10)) return 'Tomorrow'; return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }); };
  var ago = function (iso) { var m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + ' hr ago'; var d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; };
  function home() {
    var d = DASH || { messages: [], appointments: [], comments: { waiting: 0 }, scheduled: [], subscribers: { total: 0, month: 0 }, today: '' };
    var s = seen(), nu = unread(), req = d.appointments.filter(function (a) { return a.status === 'requested'; });
    var hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    var first = String(((SITE.chat || {}).label || '').replace(/^message\s+/i, '') || (SITE.name || '').split(' ')[0] || 'there');
    var todayIso = new Date().toISOString().slice(0, 10), upcoming = ((window.siteData && window.siteData.events) || []).filter(function (e) { return e && e.show !== false && String(e.date) >= todayIso; }).sort(function (x, y) { return String(x.date).localeCompare(String(y.date)); }).slice(0, 5);
    var nWait = LIVE && LIVE.waiting ? LIVE.waiting.length : 0;
    main.innerHTML = '<div class="hello"><div class="welcome"><p class="script">' + greet + ', ' + esc(first) + '</p><h2>Here is your day at a glance</h2><p>Everything that needs you is on this page. Click any box to go straight there.</p><div class="acts"><a class="btn gold" href="#pages">✏️ Edit my website</a><a class="btn" href="/admin/blog.html">✍️ Write a post</a><a class="btn" href="/admin/newsletter.html">💌 Write a letter</a></div></div>' +
      '<div class="verse"><span>Verse for today</span><q>' + esc((SITE.ticker && SITE.ticker.text) || 'Arise, shine; for thy light is come.') + '</q><span>' + esc((SITE.ticker && SITE.ticker.ref) || 'Isaiah 60:1') + '</span></div></div>' +
      '<div class="sectitle"><h2>Needs your attention</h2><span class="caps">' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</span></div>' +
      '<div class="todo"><a href="/admin/messages.html"><span class="n' + (nu ? '' : ' calm') + '">' + nu + '</span><b>New message' + (nu === 1 ? '' : 's') + '</b><small>' + (nu ? esc(d.messages.filter(function (m) { return !s.has(m.id); }).slice(0, 3).map(function (m) { return m.what; }).join(', ')) : 'You are all caught up') + '</small></a>' +
      '<a href="#shop/events"><span class="n' + (upcoming.length ? '' : ' calm') + '">' + upcoming.length + '</span><b>Upcoming gathering' + (upcoming.length === 1 ? '' : 's') + '</b><small>' + (upcoming.length ? esc(upcoming[0].title + ' · ' + fmtDay(upcoming[0].date, todayIso)) : 'Add your next service') + '</small></a>' +
      '<a href="/admin/blog.html"><span class="n' + (d.comments.waiting ? '' : ' calm') + '">' + d.comments.waiting + '</span><b>Comment' + (d.comments.waiting === 1 ? '' : 's') + ' to approve</b><small>' + (d.comments.post ? 'On “' + esc(d.comments.post) + '”' : 'Nothing waiting') + '</small></a>' +
      '<a href="/admin/newsletter.html"><span class="n calm">+' + d.subscribers.month + '</span><b>New subscribers</b><small>' + d.subscribers.total + ' people on your list</small></a></div>' +
      '<div class="sectitle"><h2>What would you like to do?</h2></div><div class="quick">' +
      [['#pages', '✏️', 'Change text or photos', 'On any page of the website'], ['/admin/blog.html', '✍️', 'Write a blog post', 'With pictures and scripture'], ['/admin/newsletter.html', '💌', 'Send a letter', 'To your subscribers'], ['#shop/events', '📅', 'Add a gathering', 'Services, workshops and online prayer'], ['#shop/testimonies', '🙌', 'Add a testimony', 'Shows on the home page'], ['#shop/books', '👕', 'Shop items', 'Shirts and more, sizes and prices'], ['/admin/schedule.html', '🗓', 'Set 1:1 hours', 'Days and times Chief Apostle is free'], ['/admin/messages.html', '📬', 'Read messages', 'Prayer requests, invitations, gifts'], ['/admin/sign.html', '🪧', 'Print a QR sign', 'For services: giving, prayer or the newsletter']]
        .map(function (q) { return '<a href="' + q[0] + '"><span class="qi">' + q[1] + '</span><span><b>' + q[2] + '</b><small>' + q[3] + '</small></span></a>'; }).join('') + '</div>' +
      '<div class="two"><div class="card"><div class="sectitle" style="margin-top:0"><h2>Coming up</h2><a class="btn sm" href="#shop/events">Events</a></div><div class="list">' +
      (upcoming.length ? upcoming.map(function (e) { return '<a class="li" href="#shop/events"><span class="when">' + esc(fmtDay(e.date, todayIso)) + '<small>' + esc(e.time || '') + '</small></span><span><b>' + esc(e.title) + '</b><small>' + esc(e.place || '') + '</small></span></a>'; }).join('') : '<p class="empty">No gatherings coming up. <a href="#shop/events">Add one</a></p>') + '</div></div>' +
      '<div class="card"><div class="sectitle" style="margin-top:0"><h2>Latest messages</h2><a class="btn sm" href="/admin/messages.html">Inbox</a></div><div class="list">' +
      (d.messages.length ? d.messages.slice(0, 5).map(function (m, i) { return '<a class="li" href="/admin/messages.html"><span class="av" style="background:' + COLORS[i % COLORS.length] + '">' + esc(initials(m.name)) + '</span><span><b>' + esc(m.name) + '</b><small>' + esc(m.what + (m.detail ? ' · ' + m.detail : '') + ' · ' + ago(m.date)) + '</small></span>' + (s.has(m.id) ? '<span class="pill p-mute">Read</span>' : '<span class="pill p-ruby">New</span>') + '</a>'; }).join('') : '<p class="empty">No messages yet.</p>') + '</div></div></div>' +
      '<div class="two"><div class="card"><h2>Coming up on the blog</h2>' + (d.scheduled.length ? '<div class="list" style="margin-top:8px">' + d.scheduled.map(function (p) { return '<a class="li" href="/admin/blog.html"><span class="when">' + esc(new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) + '</span><span><b>' + esc(p.title) + '</b><small>Goes live by itself' + (p.letter ? ' and is emailed to subscribers' : '') + '</small></span><span class="pill p-info">Scheduled</span></a>'; }).join('') + '</div>' : '<p class="sub" style="margin-top:6px">Nothing scheduled. <a href="/admin/blog.html">Write a post</a></p>') + '</div>' +
      '<div class="card"><h2>Your website</h2><p class="sub" style="margin-top:6px">' + (LIVE && LIVE.building ? '⏳ Putting your changes live…' : nWait ? '⏳ ' + nWait + ' saved change' + (nWait > 1 ? 's are' : ' is') + ' waiting to go live.' : '✓ The website shows your latest changes.') + '</p>' + (nWait && !(LIVE && LIVE.building) ? '<p style="margin-top:12px"><button class="btn go" type="button" data-golive>🚀 Put it live now</button></p>' : '<p style="margin-top:12px"><a class="btn" href="/" target="_blank" rel="noopener">View the website ↗</a></p>') + '</div></div>';
  }

  /* ---------- Pages ---------- */
  var PAGES = null;
  function pagesView() {
    main.innerHTML = '<div class="top"><div><p class="caps">Your website</p><h1>Pages</h1><p>Pick a page to change its text, photos and sections. You see every change right away, before it goes live.</p></div></div><div class="loading">Loading your pages…</div>';
    var load = PAGES ? Promise.resolve(PAGES) : ghList('content/pages').then(function (files) {
      files = files.filter(function (f) { return /\.json$/.test(f.name); });
      return Promise.all(files.map(function (f) { return ghGet(f.path).then(function (r) { return { file: f.name, path: f.path, page: r.data }; }).catch(function () { return { file: f.name, path: f.path, page: { title: f.name } }; }); }));
    });
    load.then(function (list) {
      PAGES = list;
      var order = ['index', 'about', 'ministry', 'prophetic-school', 'monthly-spiritual-detox', 'one-on-one', 'testimonies', 'events', 'give', 'shop', 'news', 'contact'];
      list.sort(function (a, b) { var x = order.indexOf(a.page.slug || a.file.replace('.json', '')), y = order.indexOf(b.page.slug || b.file.replace('.json', '')); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || String(a.page.title).localeCompare(b.page.title); });
      main.querySelector('.loading').outerHTML = '<div class="pages">' + list.map(function (p) {
        var secs = (p.page.sections || []), on = secs.filter(function (s) { return !s.hidden; }).length, slug = p.page.slug || p.file.replace('.json', '');
        return '<a class="pg" href="#page/' + encodeURIComponent(p.file) + '"><span class="th"><i></i><i></i><i></i></span><span class="tx"><b>' + esc(p.page.title || slug) + (p.page.hidden ? ' <span class="pill p-mute">Hidden</span>' : '') + '</b><small>' + esc(slug === 'index' ? '/' : '/' + slug + '/') + ' · ' + on + ' section' + (on === 1 ? '' : 's') + '</small></span></a>';
      }).join('') + '<button class="newpg" type="button" id="newpg"><span><b style="font-weight:500;display:block;font-size:1.05rem">+ New page</b><small>Start with a banner and a text section</small></span></button></div><p class="tip" style="margin-top:16px">💡 In the editor you can click any part of the preview to edit exactly that part.</p>';
      $('#newpg').onclick = newPage;
    }).catch(function (e) { var l = main.querySelector('.loading'); if (l) l.innerHTML = '<span class="err">Could not load the pages: ' + esc(e.message) + '</span>'; });
  }
  function newPage() {
    var wrap = document.createElement('div'); wrap.className = 'modal';
    wrap.innerHTML = '<form class="card" novalidate><h2>New page</h2><label class="f"><span class="lb">Page name</span><input class="inp" id="np-t" required placeholder="e.g. Testimonies"></label><span class="sub" id="np-u"></span><p class="err" id="np-e" hidden></p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" id="np-x">Cancel</button><button class="btn go" type="submit">Create page</button></div></form>';
    document.body.appendChild(wrap);
    var t = $('#np-t', wrap), slug = function () { return t.value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); };
    t.focus(); t.oninput = function () { $('#np-u', wrap).textContent = slug() ? 'Web address: /' + slug() + '/' : ''; };
    $('#np-x', wrap).onclick = function () { wrap.remove(); };
    $('form', wrap).onsubmit = function (e) {
      e.preventDefault(); var s = slug(), err = $('#np-e', wrap);
      if (!s) { err.textContent = 'Please type a page name.'; err.hidden = false; return; }
      if ((PAGES || []).some(function (p) { return (p.page.slug || p.file.replace('.json', '')) === s; })) { err.textContent = 'A page with this web address already exists.'; err.hidden = false; return; }
      var page = { title: t.value.trim(), slug: s, description: '', sections: [{ type: 'pageBanner', script: t.value.trim(), title: t.value.trim(), text: '' }, { type: 'text', heading: '', body: 'Write your text here.' }] };
      var b = $('button[type=submit]', wrap); b.disabled = true; b.textContent = 'Creating…';
      ghPut('content/pages/' + s + '.json', page, null, 'Create page “' + page.title + '”').then(function () { wrap.remove(); PAGES = null; refreshLiveSoon(); location.hash = '#page/' + s + '.json'; toast('Page created. Add it to the menu in Settings when you are ready.'); })
        .catch(function (x) { err.textContent = x.message; err.hidden = false; b.disabled = false; b.textContent = 'Create page'; });
    };
  }

  var ED = null; // current editor state
  function pageEditor(file) {
    main.innerHTML = '<div class="loading">Opening the page…</div>';
    ghGet('content/pages/' + file).then(function (r) {
      ED = { kind: 'page', file: file, path: 'content/pages/' + file, sha: r.sha, model: r.data, orig: JSON.stringify(r.data), cur: -1, device: 'desk', adding: false };
      if (!Array.isArray(ED.model.sections)) ED.model.sections = [];
      ED.cur = ED.model.sections.length ? 0 : -1;
      drawPageEditor();
    }).catch(function (e) { main.innerHTML = '<div class="card err">Could not open the page: ' + esc(e.message) + '</div>'; });
  }
  var dirty = function () { return ED && JSON.stringify(ED.model) !== ED.orig; };
  function stateText() { var st = $('#state'); if (!st) return; var d = dirty(); st.textContent = d ? 'Unsaved changes' : 'All changes saved'; st.classList.toggle('dirty', d); $('#undo').disabled = !d; }
  function drawPageEditor() {
    var m = ED.model, secs = m.sections, slug = m.slug || ED.file.replace('.json', ''), url = slug === 'index' ? '/' : '/' + slug + '/';
    var cur = ED.cur, s = cur >= 0 ? secs[cur] : null, t = s ? TYPES[s.type] : null;
    main.innerHTML = '<div class="edtop"><div class="t"><a class="btn sm" href="#pages">← Pages</a><b>' + esc(m.title || slug) + '</b><span class="state" id="state"></span></div><div class="acts"><a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener">View live ↗</a><button class="btn sm" type="button" id="undo">Undo changes</button><button class="btn go sm" type="button" id="save">Save</button></div></div>' +
      '<div class="ed"><div><p class="caps" style="margin-bottom:8px">Sections, top to bottom</p><div class="secs" id="secs">' +
      '<div class="sec pageset" data-pick="-1" role="button" tabindex="0" aria-current="' + (cur === -1) + '"><span class="ic">⚙︎</span><span class="nm">Page settings<small>Title, Google text, hide page</small></span></div>' +
      secs.map(function (x, i) { return '<div class="sec' + (x.hidden ? ' off' : '') + '" data-pick="' + i + '" role="button" tabindex="0" aria-current="' + (cur === i) + '"><span class="ic">' + (ICON[x.type] || '▫️') + '</span><span class="nm">' + esc(typeLabel(x.type)) + '<small>' + esc(secSummary(x) || (x.hidden ? 'Hidden' : '')) + '</small></span><button class="ib" type="button" title="Move up" data-mv="-1" data-i="' + i + '"' + (i ? '' : ' disabled') + '>↑</button><button class="ib" type="button" title="Move down" data-mv="1" data-i="' + i + '"' + (i < secs.length - 1 ? '' : ' disabled') + '>↓</button><button class="ib" type="button" title="Duplicate" data-dup="' + i + '">⧉</button><button class="ib" type="button" title="Remove" data-del="' + i + '">✕</button></div>'; }).join('') + '</div>' +
      (ED.adding ? '<div class="gallery" id="gal"><input class="inp" id="galq" placeholder="Search sections…" aria-label="Search sections">' + Object.keys(TYPES).map(function (k) { return '<button type="button" data-add="' + esc(k) + '"><span>' + (ICON[k] || '▫️') + '</span>' + esc(TYPES[k].label) + '</button>'; }).join('') + '<button class="btn sm" type="button" id="galx" style="justify-self:start;margin-top:4px">Cancel</button></div>' : '<button class="addsec" type="button" id="addsec">+ Add a section</button>') + '</div>' +
      '<div class="preview"><div class="pvbar"><span class="dots"><i></i><i></i><i></i></span><a class="url" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(location.host + url) + '</a><span class="seg"><button type="button" data-dev="desk" aria-pressed="' + (ED.device === 'desk') + '">Computer</button><button type="button" data-dev="phone" aria-pressed="' + (ED.device === 'phone') + '">Phone</button></span></div><div class="frame' + (ED.device === 'phone' ? ' phone' : '') + '"><iframe id="pv" title="Preview of the page"></iframe></div></div>' +
      '<aside class="form" id="form"></aside></div>';
    var form = $('#form');
    if (cur === -1) {
      form.innerHTML = '<div class="head"><span class="ic">⚙︎</span><span><b>Page settings</b><small>For the whole page</small></span></div>' + (function () { NOSZ_NOW = true; var h = PAGEFIELDS.filter(function (f) { return f.name !== 'sections'; }).map(function (f) { return field(f, m[f.name], [f.name]); }).join(''); NOSZ_NOW = false; return h; })();
      bindForm(form, m, PAGEFIELDS, onEdit);
    } else if (s) {
      var fields = (t && t.fields) || [];
      form.innerHTML = '<div class="head"><span class="ic">' + (ICON[s.type] || '▫️') + '</span><span><b>' + esc(typeLabel(s.type)) + '</b><small>Section ' + (cur + 1) + ' of ' + secs.length + '</small></span></div>' +
        fields.filter(function (f) { return f.name !== 'type'; }).map(function (f) { return field(f, s[f.name], ['sections', cur, f.name]); }).join('') +
        '<div class="tog"><span>Show this section on the website<span class="hint">Hidden sections stay here, so you can show them again later.</span></span><span class="sw2"><input type="checkbox" id="showsec"' + (s.hidden ? '' : ' checked') + ' aria-label="Show this section"><span></span></span></div>';
      // only the current section is edited here, so the list of fields is that section type's fields
      bindForm(form, m, [{ name: 'sections', widget: 'list', fields: fields }], onEdit);
      $('#showsec').onchange = function (e) { if (e.target.checked) delete s.hidden; else s.hidden = true; onEdit(true); toast(e.target.checked ? 'Section is shown again' : 'Section hidden'); };
    } else form.innerHTML = '<p class="sub">This page has no sections yet. Click “+ Add a section”.</p>';
    stateText(); refreshPreview();
    wireEditorCommon();
    $('#secs').onclick = function (e) {
      var b = e.target.closest('button'), row = e.target.closest('[data-pick]');
      if (b && b.dataset.mv) { var i = +b.dataset.i, j = i + Number(b.dataset.mv), x = secs.splice(i, 1)[0]; secs.splice(j, 0, x); ED.cur = j; drawPageEditor(); return; }
      if (b && b.dataset.dup) { var k = +b.dataset.dup; secs.splice(k + 1, 0, JSON.parse(JSON.stringify(secs[k]))); ED.cur = k + 1; drawPageEditor(); toast('Section copied'); return; }
      if (b && b.dataset.del) { var d = +b.dataset.del, gone = secs.splice(d, 1)[0]; ED.cur = Math.min(d, secs.length - 1); drawPageEditor(); toast('Removed “' + typeLabel(gone.type) + '”. “Undo changes” brings it back.'); return; }
      if (row) { ED.cur = +row.dataset.pick; drawPageEditor(); }
    };
    $('#secs').onkeydown = function (e) { var row = e.target.closest('[data-pick]'); if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ED.cur = +row.dataset.pick; drawPageEditor(); } };
    var as = $('#addsec'); if (as) as.onclick = function () { ED.adding = true; drawPageEditor(); var q = $('#galq'); if (q) q.focus(); };
    var gx = $('#galx'); if (gx) gx.onclick = function () { ED.adding = false; drawPageEditor(); };
    var gq = $('#galq'); if (gq) gq.oninput = function () { var v = gq.value.toLowerCase(); $$('#gal [data-add]').forEach(function (b) { b.hidden = b.textContent.toLowerCase().indexOf(v) < 0; }); };
    $$('[data-add]').forEach(function (b) { b.onclick = function () { var k = b.dataset.add, sec = defOf({ widget: 'object', fields: TYPES[k].fields }); sec.type = k; var at = ED.cur >= 0 ? ED.cur + 1 : secs.length; secs.splice(at, 0, sec); ED.cur = at; ED.adding = false; drawPageEditor(); toast('Section added. Use ↑ ↓ to move it.'); }; });
  }
  function onEdit(structural) {
    if (structural) { var y = $('#form') ? $('#form').scrollTop : 0; if (ED.kind === 'page') drawPageEditor(); else drawFileEditor(); return; }
    stateText();
    // keep the section list summaries fresh
    if (ED.kind === 'page') $$('#secs [data-pick]').forEach(function (row) { var i = +row.dataset.pick; if (i < 0) return; var sm = $('.nm small', row); if (sm) sm.textContent = secSummary(ED.model.sections[i]) || ''; });
    clearTimeout(onEdit.t); onEdit.t = setTimeout(refreshPreview, 260);
  }
  function refreshPreview() {
    var f = $('#pv'); if (!f || !ED) return;
    if (ED.kind === 'page') setFrame(f, previewDoc(ED.model, ED.model.sections, { cur: ED.cur }));
    else if (ED.preview) setFrame(f, ED.preview());
  }
  function wireEditorCommon() {
    $$('[data-dev]').forEach(function (b) { b.onclick = function () { ED.device = b.dataset.dev; $$('[data-dev]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); $('.frame').classList.toggle('phone', ED.device === 'phone'); }; });
    $('#undo').onclick = function () { ED.model = JSON.parse(ED.orig); if (ED.kind === 'page') { ED.cur = Math.min(ED.cur, ED.model.sections.length - 1); drawPageEditor(); } else drawFileEditor(); toast('Changes undone'); };
    $('#save').onclick = save;
  }
  function save() {
    if (!dirty()) { toast('Nothing new to save.'); return; }
    var b = $('#save'); b.disabled = true; b.textContent = 'Saving…';
    var title = ED.kind === 'page' ? 'page “' + (ED.model.title || ED.file) + '”' : ED.label;
    ghPut(ED.path, ED.model, ED.sha, 'Update ' + title).then(function (sha) {
      ED.sha = sha; ED.orig = JSON.stringify(ED.model);
      if (ED.kind === 'page' && PAGES) PAGES.forEach(function (p) { if (p.file === ED.file) p.page = JSON.parse(ED.orig); });
      if (ED.after) ED.after(ED.model);
      stateText(); toast('Saved. Click “Put it live” when you are ready.'); refreshLiveSoon();
    }).catch(function (e) { toast(e.message); }).then(function () { b.disabled = false; b.textContent = 'Save'; });
  }
  function refreshLiveSoon() { setTimeout(loadLive, 1500); }
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data.studioSection !== 'number' || !ED || ED.kind !== 'page') return;
    ED.cur = e.data.studioSection; drawPageEditor();
    var f = $('#form .inp'); if (f) f.focus({ preventScroll: true });
    var fm = $('#form'); if (fm && window.innerWidth <= 1280) fm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('beforeunload', function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- files: books, events, services, packages, testimonies, settings ---------- */
  function fileDef(name) { var out = null; (CFG.collections || []).forEach(function (c) { (c.files || []).forEach(function (f) { if (f.name === name) out = f; }); }); return out; }
  var SHOP = [['events', 'Events', [{ type: 'gatherings', heading: 'Upcoming Gatherings' }]], ['testimonies', 'Testimonies', [{ type: 'testiSlider', heading: 'Testimonies' }]], ['books', 'Shop items', [{ type: 'bookShop' }]]];
  function fileEditor(name, opts) {
    var def = fileDef(name);
    if (!def) { main.innerHTML = '<div class="card">This part is not available.</div>'; return; }
    main.innerHTML = (opts.tabs || '') + '<div class="loading">Loading…</div>';
    // Bridal packages: load the newest services first, so a service that was just added (not yet live) can be ticked too.
    var svcFirst = name === 'packages' ? ghGet(fileDef('services').file).then(function (sv) { DATA.services = sv.data; }).catch(function () {}) : Promise.resolve();
    svcFirst.then(function () { return ghGet(def.file); }).then(function (r) {
      if (name === 'packages') pkgServiceChoices(def.fields, r.data);
      ED = { kind: 'file', name: name, path: def.file, sha: r.sha, model: r.data, orig: JSON.stringify(r.data), fields: def.fields, label: opts.label, title: opts.title, intro: opts.intro, tabs: opts.tabs || '', device: 'desk', preview: opts.preview, after: opts.after, grouped: opts.grouped };
      drawFileEditor();
    }).catch(function (e) { main.innerHTML = (opts.tabs || '') + '<div class="card err">Could not open: ' + esc(e.message) + '</div>'; });
  }
  // "Services included" checkboxes = every service in Services & prices (newest saved version),
  // plus any service a package still uses that was renamed or removed, so it is never dropped by accident.
  function pkgServiceChoices(fields, model) {
    var names = ((DATA.services && DATA.services.items) || []).map(function (x) { return x && x.name; }).filter(Boolean);
    var used = [];
    ((model && model.items) || []).forEach(function (p) { (Array.isArray(p.includes) ? p.includes : []).forEach(function (n) { if (n && names.indexOf(n) < 0 && used.indexOf(n) < 0) used.push(n); }); });
    var opts = names.map(function (n) { return { label: n, value: n }; }).concat(used.map(function (n) { return { label: n + ' (not in your services any more)', value: n, gone: true }; }));
    (function walk(list) { (list || []).forEach(function (f) { if (f.name === 'includes' && f.widget === 'select' && f.multiple && opts.length) f.options = opts; walk(f.fields); }); })(fields);
  }
  function drawFileEditor() {
    var fields = ED.fields.filter(function (f) { return f.widget !== 'hidden'; }), m = ED.model;
    var formHtml;
    NOSZ_NOW = !ED.grouped; // text sizes are drawn for pages and Settings; books/events/packages get emojis only
    if (ED.grouped) {
      var simple = fields.filter(function (f) { return ['object', 'list'].indexOf(f.widget) < 0; }), big = fields.filter(function (f) { return ['object', 'list'].indexOf(f.widget) > -1; });
      formHtml = '<div class="setgrid"><div class="card"><h2>Your details</h2>' + simple.map(function (f) { return field(f, m[f.name], [f.name]); }).join('') + '</div>' +
        big.map(function (f) { var inner = f.widget === 'object' ? (f.fields || []).map(function (x) { return field(x, m[f.name] ? m[f.name][x.name] : undefined, [f.name, x.name]); }).join('') : field(Object.assign({}, f, { label: '' }), m[f.name], [f.name]); return '<div class="card"><h2>' + esc(f.label || f.name) + '</h2>' + (f.hint ? '<p class="sub">' + esc(f.hint) + '</p>' : '') + inner + '</div>'; }).join('') + '</div>';
    } else formHtml = fields.map(function (f) { return field(f, m[f.name], [f.name]); }).join('');
    main.innerHTML = ED.tabs + '<div class="edtop"><div class="t"><b>' + esc(ED.title) + '</b><span class="state" id="state"></span></div><div class="acts"><button class="btn sm" type="button" id="undo">Undo changes</button><button class="btn go sm" type="button" id="save">Save</button></div></div>' +
      (ED.intro ? '<p class="sub" style="margin:-4px 0 14px">' + ED.intro + '</p>' : '') +
      (ED.preview ? '<div class="ed two-col"><div class="form" id="form">' + formHtml + '</div><div class="preview"><div class="pvbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">Preview</span><span class="seg"><button type="button" data-dev="desk" aria-pressed="' + (ED.device === 'desk') + '">Computer</button><button type="button" data-dev="phone" aria-pressed="' + (ED.device === 'phone') + '">Phone</button></span></div><div class="frame' + (ED.device === 'phone' ? ' phone' : '') + '"><iframe id="pv" title="Preview"></iframe></div></div></div>'
        : '<div id="form">' + formHtml + '</div>');
    NOSZ_NOW = false;
    bindForm($('#form'), m, ED.fields, onEdit);
    stateText(); wireEditorCommon(); refreshPreview();
  }
  function shopView(name) {
    var tabs = '<div class="top"><div><p class="caps">Your website</p><h1>Events &amp; shop</h1><p>Gatherings, testimonies and shop items. Changes show in the preview right away.</p></div></div><nav class="tabs">' + SHOP.map(function (s) { return '<a href="#shop/' + s[0] + '"' + (s[0] === name ? ' aria-current="page"' : '') + '>' + s[1] + '</a>'; }).join('') + '</nav>';
    var s = SHOP.filter(function (x) { return x[0] === name; })[0] || SHOP[0];
    fileEditor(s[0], { tabs: tabs, title: s[1], label: s[1].toLowerCase(), preview: function () { var data = Object.assign({}, DATA); var key = s[0] === 'books' ? 'books' : s[0]; data[key] = Array.isArray(ED.model.items) ? ED.model.items.map(function (x) { return s[0] === 'events' || s[0] === 'packages' ? Object.assign({}, x, { show: true }) : x; }) : []; return previewDoc({ title: s[1] }, s[2], { data: data }); },
      after: function (mdl) { var key = s[0]; DATA[key] = mdl.items || []; } });
  }

  /* services: quick price table + all options */
  function servicesView(tab) {
    var tabs = '<div class="top"><div><p class="caps">Your website</p><h1>1:1 sessions &amp; prices</h1><p>Change the price or length of a 1:1 session. It updates the booking page and the card payment.</p></div></div><nav class="tabs"><a href="#services"' + (tab ? '' : ' aria-current="page"') + '>Prices</a><a href="#services/all"' + (tab ? ' aria-current="page"' : '') + '>All service options</a></nav>';
    if (tab) return fileEditor('services', { tabs: tabs, title: 'All service options', label: 'services', preview: function () { return previewDoc({ title: 'Service menu' }, [{ type: 'serviceMenu', heading: 'Service Menu' }], { data: Object.assign({}, DATA, { services: ED.model }) }); }, after: function (mdl) { DATA.services = mdl; } });
    var def = fileDef('services');
    main.innerHTML = tabs + '<div class="loading">Loading…</div>';
    ghGet(def.file).then(function (r) {
      ED = { kind: 'file', name: 'services', path: def.file, sha: r.sha, model: r.data, orig: JSON.stringify(r.data), fields: def.fields, label: 'service prices', title: 'Prices', tabs: tabs };
      drawPrices();
    }).catch(function (e) { main.innerHTML = tabs + '<div class="card err">Could not open: ' + esc(e.message) + '</div>'; });
  }
  function drawPrices() {
    var m = ED.model; m.items = m.items || [];
    var cats = (m.categories || []).map(function (c) { return typeof c === 'object' ? c.value || c.name : c; }).filter(Boolean);
    var f = drawPrices.f || 'All';
    main.innerHTML = ED.tabs + '<div class="edtop"><div class="t"><b>Prices</b><span class="state" id="state"></span></div><div class="acts"><button class="btn sm" type="button" id="addsvc">+ Add a service</button><button class="btn sm" type="button" id="undo">Undo changes</button><button class="btn go sm" type="button" id="save">Save</button></div></div>' +
      '<nav class="tabs" id="cats">' + ['All'].concat(cats).map(function (c) { return '<a href="#services" data-c="' + esc(c) + '"' + (c === f ? ' aria-current="page"' : '') + '>' + esc(c) + '</a>'; }).join('') + '</nav>' +
      '<div class="tbl"><table><thead><tr><th>Service</th><th>Category</th><th>Price ($)</th><th>Minutes</th><th>On the website</th><th></th></tr></thead><tbody>' +
      m.items.map(function (s, i) { if (f !== 'All' && s.category !== f) return ''; return '<tr><td><input class="inp" data-i="' + i + '" data-k="name" value="' + esc(s.name) + '" aria-label="Service name"></td><td><select class="inp" data-i="' + i + '" data-k="category" aria-label="Category">' + cats.map(function (c) { return '<option' + (c === s.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></td><td class="num"><input class="inp" data-i="' + i + '" data-k="price" value="' + esc(s.price) + '" inputmode="decimal" aria-label="Price"></td><td class="num"><input class="inp" type="number" data-i="' + i + '" data-k="minutes" value="' + esc(s.minutes) + '" aria-label="Minutes"></td><td><span class="sw2"><input type="checkbox" data-i="' + i + '" data-k="show"' + (s.show !== false ? ' checked' : '') + ' aria-label="Show on the website"><span></span></span></td><td><button class="ib" type="button" title="Remove" data-rm="' + i + '">✕</button></td></tr>'; }).join('') +
      '</tbody></table></div><p class="sub" style="margin-top:10px">Descriptions, add-ons and categories are under “All service options”.</p>';
    var tb = $('tbody');
    tb.oninput = function (e) { var t = e.target; if (t.dataset.i == null || t.type === 'checkbox') return; var v = t.dataset.k === 'minutes' ? (t.value === '' ? '' : Number(t.value)) : t.value; m.items[+t.dataset.i][t.dataset.k] = v; stateText(); };
    tb.onchange = function (e) { var t = e.target; if (t.type === 'checkbox') { m.items[+t.dataset.i].show = t.checked; stateText(); } else if (t.tagName === 'SELECT') { m.items[+t.dataset.i].category = t.value; stateText(); } };
    tb.onclick = function (e) { var b = e.target.closest('[data-rm]'); if (!b) return; var gone = m.items.splice(+b.dataset.rm, 1)[0]; drawPrices(); toast('Removed “' + gone.name + '”. “Undo changes” brings it back.'); };
    $('#cats').onclick = function (e) { var a = e.target.closest('[data-c]'); if (!a) return; e.preventDefault(); drawPrices.f = a.dataset.c; drawPrices(); };
    $('#addsvc').onclick = function () { m.items.unshift({ category: f === 'All' ? cats[0] || '' : f, name: 'New service', price: '', minutes: 60, description: '', show: false }); drawPrices(); var i = $('tbody .inp'); if (i) { i.focus(); i.select(); } };
    stateText();
    $('#undo').onclick = function () { ED.model = JSON.parse(ED.orig); drawPrices(); toast('Changes undone'); };
    $('#save').onclick = save;
    ED.after = function (mdl) { DATA.services = mdl; };
  }

  function settingsView() {
    fileEditor('settings', { title: 'Settings', label: 'settings', grouped: true, intro: 'The things that are the same on every page: your name, menu, colors, emails and payments. Open only what you need.',
      tabs: '<div class="top"><div><p class="caps">Setup</p><h1>Settings</h1></div></div>', after: function (mdl) { SITE = mdl; window.siteSettings = mdl; } });
  }

  /* ---------- Visitors (numbers from /api/visitors; counted by site.js → /api/hit) ---------- */
  var VZ = { site: 'all', range: 30, data: null };
  var REGION = null; try { REGION = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
  function flag(c) { return /^[A-Z]{2}$/.test(c || '') && c !== 'XX' && c !== 'T1' ? String.fromCodePoint.apply(null, c.split('').map(function (x) { return 127397 + x.charCodeAt(0); })) : '🌍'; }
  function cname(c) { if (!c || c === 'XX') return 'Unknown'; if (c === 'T1') return 'Hidden (Tor)'; try { return REGION ? REGION.of(c) : c; } catch (e) { return c; } }
  var SRCIC = { 'Google': '🔎', 'Other search engines': '🔍', 'Instagram': '📸', 'Facebook': '👍', 'TikTok': '🎵', 'YouTube': '▶️', 'Pinterest': '📌', 'X / Twitter': '✖️', 'LinkedIn': '💼', 'WhatsApp': '💬', 'Email': '✉️', 'Your newsletter': '💌', 'Typed in / bookmark': '⌨️', 'Your other website': '🔁', 'Other websites': '🔗', 'AI assistants': '✨' };
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var nf = function (n) { return Number(n || 0).toLocaleString('en-US'); };
  function hr12(h) { h = (h + 24) % 24; return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); }
  function visitorsView() {
    try { localStorage.setItem('nocount', '1'); } catch (e) {}
    main.innerHTML = '<div class="vz"><div class="top"><div><p class="caps">Start</p><h1>Visitors</h1><p>Who visits your websites, where they come from and what they read. No cookies, no names – just counts.</p></div>' +
      '<span class="livenow"><i></i><b id="vzNow">–</b> on your sites right now</span></div>' +
      '<div class="filters"><div class="seg" id="vzSite" role="group" aria-label="Website">' + [['all', 'cotministries.com']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (VZ.site === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="seg" id="vzRange" role="group" aria-label="Time">' + [[1, 'Today'], [7, '7 days'], [30, '30 days'], [365, '12 months']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (VZ.range === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div id="vzBody"><div class="loading">Counting…</div></div></div>';
    $$('#vzSite button').forEach(function (b) { b.onclick = function () { VZ.site = b.dataset.v; $$('#vzSite button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); loadVz(); }; });
    $$('#vzRange button').forEach(function (b) { b.onclick = function () { VZ.range = +b.dataset.v; $$('#vzRange button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); loadVz(); }; });
    loadVz();
    clearInterval(visitorsView.t);
    visitorsView.t = setInterval(function () { if (ROUTE !== 'visitors') return clearInterval(visitorsView.t); if (document.visibilityState === 'visible') loadVz(true); }, 60000);
  }
  function loadVz(quiet) {
    return apiJson('/api/visitors?site=' + VZ.site + '&range=' + VZ.range).then(function (d) { if (ROUTE !== 'visitors') return; VZ.data = d; drawVz(); })
      .catch(function (e) { if (!quiet && $('#vzBody')) $('#vzBody').innerHTML = '<div class="card err">Could not load the numbers: ' + esc(e.message) + '</div>'; });
  }
  function chgTxt(a, b) { if (!b) return a ? 'new – nothing to compare yet' : ''; var p = Math.round((a - b) / b * 100); return '<span class="' + (p >= 0 ? 'up' : 'dn') + '">' + (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '%</span> vs. the time before'; }
  function vzBars(rows, total, unit, cls) {
    if (!rows.length) return '<p class="empty">Nothing yet.</p>';
    var top = rows[0].v || 1;
    return '<div class="bars ' + (cls || '') + '">' + rows.map(function (r) {
      var pc = total ? Math.round(r.v / total * 100) : 0;
      return '<div class="bar" title="' + esc(r.name) + ': ' + nf(r.v) + ' ' + unit + '"><div class="lb">' + (r.ic ? '<span class="fl" aria-hidden="true">' + r.ic + '</span>' : '') + '<span>' + esc(r.name) + (r.sub ? ' <small>' + esc(r.sub) + '</small>' : '') + '</span></div><div class="v">' + nf(r.v) + '<small>' + pc + '%</small></div><div class="tr"><i style="width:' + Math.max(2, r.v / top * 100) + '%"></i></div></div>';
    }).join('') + '</div>';
  }
  function drawVz() {
    var d = VZ.data, body = $('#vzBody'); if (!body || !d) return;
    $('#vzNow').textContent = d.now;
    var host = { fbn: 'cotministries.com', sit: 'cotministries.com' };
    var mins = d.visitors ? Math.round(d.seconds / d.visitors) : 0;
    var tiles = [['Visitors', nf(d.visitors), chgTxt(d.visitors, d.prev.visitors)], ['Page views', nf(d.views), chgTxt(d.views, d.prev.views)],
      ['Pages per visit', d.visitors ? (d.views / d.visitors).toFixed(1) : '0', 'how many pages people read'], ['Time on site', Math.floor(mins / 60) + 'm ' + (mins % 60) + 's', 'on average per visitor']];
    var known = d.countries.reduce(function (s, c) { return s + c.v; }, 0), ctry = d.countries.map(function (c) { return { ic: flag(c.c), name: cname(c.c), v: c.v }; });
    if (d.visitors - known > 0 && d.countries.length >= 8) ctry.push({ ic: '🌍', name: 'Other countries', v: d.visitors - known });
    var hrs = Array(24).fill(0); d.hours.forEach(function (h) { hrs[h.h] = h.n; });
    var best = 0, bi = 0; for (var i = 0; i < 24; i++) { var w = hrs[i] + hrs[(i + 1) % 24]; if (w > best) { best = w; bi = i; } }
    var dw = d.dows.slice().sort(function (a, b) { return b.n - a.n; })[0];
    var bestDay = d.series.slice().sort(function (a, b) { return b.v - a.v; })[0];
    var devs = { Phone: 0, Computer: 0, Tablet: 0 }, dt = 0; d.devices.forEach(function (x) { devs[x.d] = x.v; dt += x.v; });
    var empty = !d.views;
    body.innerHTML = (empty ? '<div class="card tip" style="margin-top:16px">No visits counted ' + (d.range === 1 ? 'today' : 'in this time') + ' yet. Counting starts as soon as this is live – visits from this device are never counted, so the studio doesn’t count you.</div>' : '') +
      '<div class="tiles">' + tiles.map(function (t) { return '<div class="tile"><div class="caps">' + t[0] + '</div><div class="num">' + t[1] + '</div><div class="chg">' + t[2] + '</div></div>'; }).join('') + '</div>' +
      '<div class="card" style="margin-top:18px"><div class="hd"><h2>Visitors per ' + (d.range === 365 ? 'week' : 'day') + '</h2><span class="caps">' + (d.range === 1 ? 'last 14 days' : '') + '</span></div><div class="chart" id="vzChart"></div></div>' +
      '<div class="three">' +
      '<div class="card"><div class="hd"><h2>Countries</h2><span class="caps">visitors</span></div>' + vzBars(ctry, d.visitors, 'visitors') + '</div>' +
      '<div class="card"><div class="hd"><h2>Where they came from</h2><span class="caps">visitors</span></div>' + vzBars(d.sources.map(function (s) { return { ic: SRCIC[s.src] || '🔗', name: s.src, v: s.v }; }), d.visitors, 'visitors', 'src') + '</div>' +
      '<div class="card"><div class="hd"><h2>Most read pages</h2><span class="caps">views</span></div>' + vzBars(d.pages.map(function (p) { return { name: (p.t || p.path).replace(/\s*[|·–-]\s*[^|·–-]*$/, '') || p.path, sub: (d.site === 'all' ? host[p.site] : '') + p.path, v: p.n }; }), d.views, 'views', 'pgs') + '</div></div>' +
      '<div class="two"><div class="card"><h2>Phone or computer</h2><div class="dev">' + [['📱', 'Phone'], ['💻', 'Computer'], ['📟', 'Tablet']].map(function (x) { return '<div><span aria-hidden="true">' + x[0] + '</span><b>' + (dt ? Math.round(devs[x[1]] / dt * 100) : 0) + '%</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
      '<h2 style="margin-top:22px">Busiest times</h2><div class="dev">' +
      [[dw ? DOW[dw.dow] : '–', 'Busiest weekday'], [best ? hr12(bi) + ' – ' + hr12(bi + 2) : '–', 'Busiest hours'], [bestDay && bestDay.v ? new Date(bestDay.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + bestDay.v : '–', 'Best day']].map(function (x) { return '<div><b class="sm">' + esc(x[0]) + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2>Cities</h2>' + vzBars(d.cities.map(function (c) { return { name: c.city + ', ' + c.c, v: c.v }; }), d.visitors, 'visitors') + '</div></div>' +
      '<p class="note">A visitor is counted once per day. Countries and cities come from Cloudflare and are approximate. Times are in ' + esc(String(d.tz).replace(/_/g, ' ')) + ' time. Nothing is stored that could tell who someone is.</p>';
    var pts = d.series, wk = d.range === 365;
    if (wk) { var w2 = []; for (var k = 0; k < pts.length; k += 7) { var g = pts.slice(k, k + 7); w2.push({ day: g[0].day, v: g.reduce(function (s, x) { return s + x.v; }, 0) }); } pts = w2; }
    if (wk) { var f0 = 0; while (f0 < pts.length - 8 && !pts[f0].v) f0++; pts = pts.slice(f0); } // start the year chart where counting began
    vzLine(pts, wk);
  }
  function vzLine(pts, wk) {
    var el = $('#vzChart'); if (!el) return;
    var W = el.clientWidth || 800, H = 240, L = 40, R = 10, T = 12, B = 26;
    var vs = pts.map(function (p) { return p.v; }), max = Math.max.apply(null, vs.concat([4]));
    var stepV = max > 400 ? 100 : max > 100 ? 50 : max > 20 ? 10 : 1, top = Math.ceil(max / stepV / 4) * stepV * 4;
    var x = function (i) { return L + (W - L - R) * (pts.length === 1 ? 0.5 : i / (pts.length - 1)); }, y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var dl = function (s, o) { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', o); };
    var g = ''; for (var k = 0; k <= 4; k++) { var v = top * k / 4; g += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + nf(v) + '</text>'; }
    var step = Math.max(1, Math.ceil(pts.length / 7)), lab = '';
    pts.forEach(function (p, i) { if (i % step === 0) lab += '<text class="ax" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + dl(p.day, { month: 'short', day: 'numeric' }) + '</text>'; });
    var dp = vs.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visitors over time">' + g + lab +
      '<path d="' + dp + ' L' + x(vs.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z" fill="#9b1313" fill-opacity=".07"/><path d="' + dp + '" fill="none" stroke="#9b1313" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<line class="xh" stroke="#7a5547" stroke-dasharray="3 3" y1="' + T + '" y2="' + y(0) + '" visibility="hidden"/><circle class="dt" r="5" fill="#9b1313" stroke="#fff" stroke-width="2" visibility="hidden"/><rect class="hit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent"/></svg><div class="tipbox" hidden></div>';
    var hit = $('.hit', el), tip = $('.tipbox', el), xh = $('.xh', el), dt = $('.dt', el);
    function show(cx) {
      var r = el.getBoundingClientRect(), px = (cx - r.left) * W / r.width, i = Math.round((px - L) / (W - L - R) * (pts.length - 1)); i = Math.max(0, Math.min(pts.length - 1, i));
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible'); dt.setAttribute('cx', x(i)); dt.setAttribute('cy', y(vs[i])); dt.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.style.left = Math.min(Math.max(x(i) * r.width / W, 80), r.width - 80) + 'px'; tip.style.top = (y(vs[i]) * r.height / H) + 'px';
      tip.innerHTML = (wk ? 'Week of ' + dl(pts[i].day, { month: 'short', day: 'numeric' }) : dl(pts[i].day, { weekday: 'short', month: 'short', day: 'numeric' })) + ' · <b>' + nf(vs[i]) + '</b> visitor' + (vs[i] === 1 ? '' : 's');
    }
    hit.addEventListener('mousemove', function (e) { show(e.clientX); });
    hit.addEventListener('touchstart', function (e) { show(e.touches[0].clientX); }, { passive: true });
    hit.addEventListener('mouseleave', function () { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); dt.setAttribute('visibility', 'hidden'); });
  }
  window.addEventListener('resize', function () { if (ROUTE === 'visitors' && VZ.data) { clearTimeout(vzLine.t); vzLine.t = setTimeout(drawVz, 150); } });

  /* ---------- routing ---------- */
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'home', parts = h.split('/');
    if (ED && dirty() && !(parts[0] === 'page' && ED.kind === 'page' && parts[1] === ED.file)) {
      if (!confirm('You have unsaved changes. Leave without saving?')) { history.replaceState(null, '', route.last || '#home'); return; }
    }
    route.last = location.hash || '#home';
    ED = null;
    ROUTE = { page: 'pages', shop: 'shop', services: 'services' }[parts[0]] || parts[0];
    drawNav(); $('#side').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
    if (parts[0] === 'home') return home();
    if (parts[0] === 'pages') return pagesView();
    if (parts[0] === 'page') return pageEditor(parts[1]);
    if (parts[0] === 'shop') return shopView(parts[1] || 'books');
    if (parts[0] === 'services') return servicesView(parts[1]);
    if (parts[0] === 'settings') return settingsView();
    if (parts[0] === 'visitors') return visitorsView();
    location.hash = '#home';
  }
  document.addEventListener('click', function (e) { var g = e.target.closest('[data-golive]'); if (g) goLive(g); });
  $('#burger').onclick = function () { var o = $('#side').classList.toggle('open'); this.setAttribute('aria-expanded', o); };

  /* ---------- start ---------- */
  if (SITE.name) { $('#b-name').textContent = SITE.name; $('#b-top').textContent = SITE.logoTop || ''; }
  drawNav();
  fetch('/admin/config.yml', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
    CFG = c; REPO = (c.backend && c.backend.repo) || ''; BRANCH = (c.backend && c.backend.branch) || 'main';
    var pages = (c.collections || []).filter(function (x) { return x.name === 'pages'; })[0];
    PAGEFIELDS = (pages && pages.fields) || [];
    var secF = PAGEFIELDS.filter(function (f) { return f.name === 'sections'; })[0];
    ((secF && secF.types) || []).forEach(function (t) { TYPES[t.name] = { label: t.label || t.name, fields: t.fields || [] }; });
    return apiJson('/api/studio').then(function (d) { DASH = d; }).catch(function (e) { if (!LOGIN) DASH = null; });
  }).then(function () {
    if (LOGIN) return;
    drawNav(); route(); loadLive();
    window.addEventListener('hashchange', route);
    setInterval(function () { if (document.visibilityState === 'visible') { loadLive(); apiJson('/api/studio').then(function (d) { DASH = d; drawNav(); if (ROUTE === 'home' && !ED) home(); }).catch(function () {}); } }, 90000);
  }).catch(function (e) { if (!LOGIN) main.innerHTML = '<div class="card err">The studio could not start: ' + esc(e.message) + '</div>'; });
})();
