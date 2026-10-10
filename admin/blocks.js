// Block editor for blog posts and newsletter letters (/admin/blog.html, /admin/newsletter.html).
// Blocks: heading, text, picture, two pictures, scripture/quote, button, video link, divider.
// Pictures are shrunk in the browser (max 1600 px) and uploaded to /api/image, so they work on the website and in emails.
(function () {
  var css = '' +
    '.be{display:grid;gap:10px}.be-blk{background:var(--panel,#fff);border:1px solid var(--line,#e7e2d8);border-radius:10px;padding:10px 12px 12px;display:grid;gap:8px}' +
    '.be-h{display:flex;align-items:center;justify-content:space-between;gap:8px}.be-t{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#76767e);font-weight:700}' +
    '.be-ctl{display:flex;gap:2px}.be-ib{border:0;background:transparent;width:30px;height:30px;border-radius:7px;cursor:pointer;color:var(--muted,#76767e);font-size:.95rem}.be-ib:hover{background:var(--soft,#faf8f4);color:var(--text,#1d1d1f)}.be-ib:disabled{opacity:.3;cursor:default;background:transparent}.be-ib.del:hover{color:#c8372d}' +
    '.be input[type=text],.be input:not([type]),.be textarea{border:1px solid var(--line,#e7e2d8);background:var(--soft,#faf8f4);border-radius:8px;padding:9px 11px;font:inherit;font-size:.95rem;width:100%;color:inherit;min-width:0}.be textarea{resize:vertical;line-height:1.55}' +
    '.be-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.be-img{display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:start}' +
    '.be-th{width:100%;aspect-ratio:4/3;border-radius:8px;background:var(--soft,#faf8f4) center/cover no-repeat;border:1px dashed var(--line,#e7e2d8);display:grid;place-items:center;color:var(--muted,#76767e);font-size:.75rem;text-align:center;padding:6px}.be-th.has{border-style:solid;color:transparent}' +
    '.be-drop{border:1px dashed #d4a437;background:var(--soft,#faf8f4);border-radius:8px;padding:10px;text-align:center;font-size:.85rem;color:var(--muted,#76767e)}.be-drop.over{background:#fbf1dc}' +
    '.be-up{display:inline-block;border:1px solid var(--line,#e7e2d8);background:var(--panel,#fff);border-radius:8px;padding:6px 12px;font-weight:600;font-size:.85rem;cursor:pointer;color:var(--text,#1d1d1f);position:relative}.be-up input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}' +
    '.be-opts{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;font-size:.82rem;color:var(--muted,#76767e)}.be-seg{display:inline-flex;border:1px solid var(--line,#e7e2d8);border-radius:7px;overflow:hidden}.be-seg button{border:0;background:var(--panel,#fff);padding:5px 10px;font-size:.8rem;cursor:pointer;color:var(--muted,#76767e)}.be-seg button+button{border-left:1px solid var(--line,#e7e2d8)}.be-seg button[aria-pressed=true]{background:#16161a;color:#fff}' +
    '.be-add{display:flex;flex-wrap:wrap;gap:6px;padding:10px;border:1px dashed var(--line,#e7e2d8);border-radius:10px}.be-add span{width:100%;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#76767e)}.be-add button{border:1px solid var(--line,#e7e2d8);background:var(--panel,#fff);color:inherit;border-radius:999px;padding:5px 12px;font-size:.85rem;cursor:pointer}.be-add button:hover{border-color:#d4a437}' +
    '.be-busy{font-size:.82rem;color:#7a5a00}.be-chk{display:inline-flex;gap:6px;align-items:center;cursor:pointer}' +
    '@media (max-width:560px){.be-row2,.be-img{grid-template-columns:1fr}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var TYPES = { heading: 'Heading', text: 'Text', image: 'Picture', pair: 'Two pictures', quote: 'Scripture / quote', button: 'Button', video: 'Video link', divider: 'Divider' };
  function token() { try { var u = JSON.parse(localStorage.getItem('decap-cms-user') || 'null'); return u && u.token; } catch (e) { return null; } }

  function shrink(file) {
    return new Promise(function (ok, no) {
      if (!file || !/^image\//.test(file.type)) return no(new Error('Please choose a picture (JPG, PNG or WebP).'));
      if (file.type === 'image/gif' && file.size < 1.5e6) return ok({ blob: file, w: 0, h: 0 });
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          var x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(function (b) { b ? ok({ blob: b, w: c.width, h: c.height }) : no(new Error('That picture could not be prepared.')); }, 'image/jpeg', 0.85);
        };
        im.onerror = function () { no(new Error('That picture could not be opened. Try a JPG or PNG.')); };
        im.src = fr.result;
      };
      fr.onerror = function () { no(new Error('That picture could not be read.')); };
      fr.readAsDataURL(file);
    });
  }
  // upload a picture -> Promise of its web address (/api/image/<id>)
  function upload(file) {
    return shrink(file).then(function (p) {
      var fd = new FormData(); fd.append('file', p.blob, 'picture.jpg'); fd.append('w', p.w); fd.append('h', p.h);
      return fetch('/api/image', { method: 'POST', headers: { Authorization: 'Bearer ' + (token() || '') }, body: fd });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Upload failed (' + r.status + ').'); return d.url; });
    });
  }
  function newBlock(t) {
    var b = { id: uid(), type: t };
    if (t === 'heading') b.text = ''; if (t === 'text') b.text = '';
    if (t === 'image') { b.src = ''; b.size = 'full'; b.wrap = 'none'; b.caption = ''; b.alt = ''; }
    if (t === 'pair') { b.a = ''; b.b = ''; b.caption = ''; }
    if (t === 'quote') { b.text = ''; b.cite = ''; }
    if (t === 'button') { b.label = ''; b.url = ''; }
    if (t === 'video') { b.label = 'Watch the video'; b.url = ''; }
    return b;
  }

  // state = { blocks: [...] }; onChange(structural) is called after every edit; toast(msg) shows a message
  function BlockEditor(host, state, onChange, toast) {
    toast = toast || function (m) { alert(m); };
    state.blocks = state.blocks || [];
    state.blocks.forEach(function (b) { if (!b.id) b.id = uid(); });
    var busy = {};
    var find = function (id) { return state.blocks.filter(function (b) { return b.id === id; })[0]; };
    var up = function (id, key, label) { return '<label class="be-up">' + label + '<input type="file" accept="image/*" data-up="' + id + '" data-key="' + key + '"></label>'; };
    function draw() {
      var n = state.blocks.length;
      host.innerHTML = '<div class="be">' + state.blocks.map(function (b, i) {
        var h = '<div class="be-h"><span class="be-t">' + TYPES[b.type] + '</span><span class="be-ctl"><button class="be-ib" type="button" title="Move up" data-mv="-1" data-id="' + b.id + '"' + (i ? '' : ' disabled') + '>&uarr;</button><button class="be-ib" type="button" title="Move down" data-mv="1" data-id="' + b.id + '"' + (i < n - 1 ? '' : ' disabled') + '>&darr;</button><button class="be-ib" type="button" title="Duplicate" data-dup="' + b.id + '">&#10697;</button><button class="be-ib del" type="button" title="Remove this block" data-del="' + b.id + '">&#10005;</button></span></div>';
        var tk = { heading: 'text', text: 'text', quote: 'text', button: 'label', video: 'label' }[b.type];
        if (tk && window.StudioEmoji) h = h.replace('</span><span class="be-ctl">', '</span>' + window.StudioEmoji.tools('data-bid="' + b.id + '" data-bk="' + tk + '"', b.fs || 1) + '<span class="be-ctl">');
        var f = '';
        var inp = function (k, ph, lbl) { return '<input data-id="' + b.id + '" data-k="' + k + '" value="' + esc(b[k]) + '" placeholder="' + esc(ph) + '" aria-label="' + esc(lbl || ph) + '">'; };
        if (b.type === 'heading') f = inp('text', 'Heading', 'Heading');
        if (b.type === 'text') f = '<textarea rows="5" data-id="' + b.id + '" data-k="text" aria-label="Text" placeholder="Write here. Empty line = new paragraph. **word** = bold. [text](link) = link.">' + esc(b.text) + '</textarea>';
        if (b.type === 'image') {
          var bz = busy[b.id + 'src'];
          f = '<div class="be-img"><div class="be-th' + (b.src ? ' has' : '') + '" style="' + (b.src ? "background-image:url('" + esc(b.src) + "')" : '') + '">' + (bz ? 'Uploading…' : b.src ? '' : 'No picture yet') + '</div><div style="display:grid;gap:8px;min-width:0">' +
            '<div class="be-drop" data-drop="' + b.id + '" data-key="src">' + (bz ? '<span class="be-busy">Uploading picture…</span>' : 'Drag a photo here, or ' + up(b.id, 'src', b.src ? 'Change picture' : 'Upload from computer')) + '</div>' +
            inp('caption', 'Caption under the picture (optional)') + inp('alt', 'Describe the picture (for screen readers & Google)') +
            '<div class="be-opts"><span>Size</span><span class="be-seg">' + ['small', 'medium', 'full'].map(function (s) { return '<button type="button" data-set="' + b.id + '" data-k="size" data-v="' + s + '" aria-pressed="' + (b.size === s && (b.wrap || 'none') === 'none') + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>'; }).join('') + '</span>' +
            '<span>Text beside it</span><span class="be-seg">' + [['none', 'Off'], ['left', 'Picture left'], ['right', 'Picture right']].map(function (s) { return '<button type="button" data-set="' + b.id + '" data-k="wrap" data-v="' + s[0] + '" aria-pressed="' + ((b.wrap || 'none') === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</span>' +
            '<label class="be-chk"><input type="checkbox" data-id="' + b.id + '" data-k="link"' + (b.link ? ' checked' : '') + '>Picture opens a link</label></div>' +
            (b.link ? inp('url', 'Link for the picture, e.g. /book/ or https://…') : '') + '</div></div>';
        }
        if (b.type === 'pair') f = '<div class="be-row2">' + ['a', 'b'].map(function (k) { var bz = busy[b.id + k]; return '<div style="display:grid;gap:6px;min-width:0"><div class="be-th' + (b[k] ? ' has' : '') + '" style="' + (b[k] ? "background-image:url('" + esc(b[k]) + "')" : '') + '">' + (bz ? 'Uploading…' : b[k] ? '' : (k === 'a' ? 'Left' : 'Right') + ' picture') + '</div><div class="be-drop" data-drop="' + b.id + '" data-key="' + k + '">' + up(b.id, k, b[k] ? 'Change' : 'Upload') + '</div></div>'; }).join('') + '</div>' + inp('caption', 'Caption (optional)');
        if (b.type === 'quote') f = '<textarea rows="2" data-id="' + b.id + '" data-k="text" placeholder="Those who sow in tears shall reap in joy." aria-label="Scripture or quote">' + esc(b.text) + '</textarea>' + inp('cite', 'Reference, e.g. Psalm 126:5');
        if (b.type === 'button') f = '<div class="be-row2">' + inp('label', 'Button text, e.g. Book your appointment') + inp('url', 'Link, e.g. /book/ or https://…') + '</div>';
        if (b.type === 'video') f = '<div class="be-row2">' + inp('label', 'Text, e.g. Watch Sunday\'s message') + inp('url', 'YouTube / Facebook / Instagram link') + '</div>';
        if (b.type === 'divider') f = '<span style="font-size:.85rem;color:var(--muted,#76767e)">A small gold line between parts.</span>';
        return '<div class="be-blk" data-blk="' + b.id + '">' + h + f + '</div>';
      }).join('') + '<div class="be-add"><span>Add a block</span>' + Object.keys(TYPES).map(function (t) { return '<button type="button" data-add="' + t + '">+ ' + TYPES[t] + '</button>'; }).join('') + '</div></div>';
    }
    function put(b, key, file) {
      busy[b.id + key] = 1; draw();
      upload(file).then(function (u) { b[key] = u; toast('Picture added'); }).catch(function (e) { toast(e.message); })
        .then(function () { delete busy[b.id + key]; draw(); onChange(true); });
    }
    host.addEventListener('input', function (e) { var t = e.target; if (!t.dataset.id || !t.dataset.k || t.type === 'checkbox') return; var b = find(t.dataset.id); if (!b) return; b[t.dataset.k] = t.value; onChange(false); });
    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.up) { var b = find(t.dataset.up); if (b && t.files[0]) put(b, t.dataset.key, t.files[0]); return; }
      if (t.type === 'checkbox' && t.dataset.id) { var c = find(t.dataset.id); c[t.dataset.k] = t.checked; draw(); onChange(true); }
    });
    host.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t || !host.contains(t)) return;
      if (t.hasAttribute('data-emj')) { var ei = host.querySelector('[data-id="' + t.dataset.bid + '"][data-k="' + t.dataset.bk + '"]'); if (ei) window.StudioEmoji.open(t, ei); return; }
      if (t.dataset.szd) { var zb = find(t.dataset.bid); if (!zb) return; var nv = window.StudioEmoji.step(zb.fs || 1, +t.dataset.szd); if (nv === 1) delete zb.fs; else zb.fs = nv; window.StudioEmoji.paint(t.closest('.emj-sz'), nv); onChange(false); return; }
      if (t.dataset.add) { var nb = newBlock(t.dataset.add); state.blocks.push(nb); draw(); onChange(true); var el = host.querySelector('[data-blk="' + nb.id + '"]'); if (el) { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); var fi = el.querySelector('textarea,input:not([type=file]):not([type=checkbox])'); if (fi) fi.focus(); } return; }
      if (t.dataset.mv) { var i = state.blocks.indexOf(find(t.dataset.id)), x = state.blocks.splice(i, 1)[0]; state.blocks.splice(i + Number(t.dataset.mv), 0, x); draw(); onChange(true); return; }
      if (t.dataset.dup) { var o = find(t.dataset.dup), cp = JSON.parse(JSON.stringify(o)); cp.id = uid(); state.blocks.splice(state.blocks.indexOf(o) + 1, 0, cp); draw(); onChange(true); return; }
      if (t.dataset.del) { var d = find(t.dataset.del); var empty = !(d.text || d.src || d.a || d.b || d.url || d.caption); state.blocks.splice(state.blocks.indexOf(d), 1); draw(); onChange(true); if (!empty) toast('Block removed'); return; }
      if (t.dataset.set) { var s = find(t.dataset.set); if (t.dataset.k === 'size') { s.size = t.dataset.v; s.wrap = 'none'; } else s.wrap = t.dataset.v; draw(); onChange(true); }
    });
    host.addEventListener('dragover', function (e) { var d = e.target.closest('[data-drop]'); if (!d) return; e.preventDefault(); d.classList.add('over'); });
    host.addEventListener('dragleave', function (e) { var d = e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
    host.addEventListener('drop', function (e) { var d = e.target.closest('[data-drop]'); if (!d) return; e.preventDefault(); d.classList.remove('over'); var f = e.dataTransfer.files[0]; if (f) put(find(d.dataset.drop), d.dataset.key, f); });
    draw();
    return { redraw: draw, upload: upload };
  }

  // Preview HTML for a letter (close to what the email looks like)
  function letterPreview(blocks, firstName) {
    var inl = function (t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="#" style="color:#0f2a5e">$1</a>').replace(/\n/g, '<br>'); };
    var pic = function (src, w) { return '<img src="' + esc(src) + '" style="display:block;width:100%;max-width:' + w + 'px;height:auto;border-radius:4px;margin:0 auto" alt="">'; };
    var fl = false;
    return (blocks || []).map(function (b) {
      var pre = '';
      if (fl && b.type !== 'text') { pre = '<div style="clear:both"></div>'; fl = false; }
      return pre + one(b);
    }).join('') + '<div style="clear:both"></div>';
    function one(b) { return fz(one0(b), b); }
    function fz(html, b) {
      var v = Number(b.fs); if (!html || !(v >= 0.5 && v <= 2.5) || v === 1 || !/^(heading|text|quote|button|video)$/.test(b.type)) return html;
      var sp = '<span style="font-size:' + v + 'em">';
      if (b.type === 'text') return html.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/g, '$1' + sp + '$2</span>$3');
      if (b.type === 'heading') return html.replace(/(<h2[^>]*>)([\s\S]*?)(<\/h2>)/, '$1' + sp + '$2</span>$3');
      if (b.type === 'quote') return html.replace(/(<div style="margin:0 0 16px;background[^>]*>)([\s\S]*?)(<div style="margin-top:8px|<\/div>$)/, '$1' + sp + '$2</span>$3');
      return html.replace(/(<span style="display:inline-block[^>]*>)([\s\S]*?)(<\/span>)/, '$1' + sp + '$2</span>$3');
    }
    function one0(b) {
      if (b.type === 'image' && b.src && (b.wrap === 'left' || b.wrap === 'right')) { fl = true; return '<div style="float:' + b.wrap + ';width:46%;margin:4px ' + (b.wrap === 'left' ? '18px' : '0') + ' 10px ' + (b.wrap === 'right' ? '18px' : '0') + '">' + pic(b.src, 246) + (b.caption ? '<div style="font-size:13px;font-style:italic;color:#5a6680;text-align:center;padding-top:6px">' + esc(b.caption) + '</div>' : '') + '</div>'; }
      if (b.type === 'heading') return b.text ? '<h2 style="margin:8px 0 12px;font-family:\'Bodoni Moda\',Georgia,serif;font-weight:500;font-size:22px">' + esc(b.text) + '</h2>' : '';
      if (b.type === 'text') return b.text ? String(b.text).replace(/\{\s*first\s*name\s*\}/gi, firstName || 'Tasha').trim().split(/\n\s*\n/).map(function (p) { return '<p style="margin:0 0 16px">' + inl(p) + '</p>'; }).join('') : '';
      if (b.type === 'image') { if (!b.src) return ''; var w = b.wrap === 'left' || b.wrap === 'right' ? 246 : b.size === 'small' ? 246 : b.size === 'medium' ? 386 : 536; var al = b.wrap === 'left' ? 'left' : b.wrap === 'right' ? 'right' : 'center'; return '<div style="margin:0 0 16px;text-align:' + al + '"><div style="display:inline-block;width:100%;max-width:' + w + 'px">' + pic(b.src, w) + (b.caption ? '<div style="font-size:13px;font-style:italic;color:#5a6680;text-align:center;padding-top:6px">' + esc(b.caption) + '</div>' : '') + '</div></div>'; }
      if (b.type === 'pair') return (b.a || b.b) ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px">' + [b.a, b.b].map(function (s) { return s ? pic(s, 263) : '<div></div>'; }).join('') + '</div>' + (b.caption ? '<div style="font-size:13px;font-style:italic;color:#5a6680;text-align:center;margin:-8px 0 16px">' + esc(b.caption) + '</div>' : '') : '';
      if (b.type === 'quote') return b.text ? '<div style="margin:0 0 16px;background:#f3ecdc;border-left:3px solid #c9a23a;padding:16px 20px;font-family:\'Bodoni Moda\',Georgia,serif;font-style:italic;font-size:19px;line-height:1.45">' + esc(b.text) + (b.cite ? '<div style="margin-top:8px;font-family:Arial,sans-serif;font-style:normal;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a6680">' + esc(b.cite) + '</div>' : '') + '</div>' : '';
      if (b.type === 'button' || b.type === 'video') return b.url ? '<div style="text-align:center;margin:6px 0 20px"><span style="display:inline-block;background:#0f2a5e;color:#fff;font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;border-radius:3px">' + (b.type === 'video' ? '&#9654; ' + esc(b.label || 'Watch the video') : esc(b.label || 'Learn more') + ' &rarr;') + '</span></div>' : '';
      if (b.type === 'divider') return '<div style="text-align:center;color:#c9a23a;letter-spacing:10px;margin:4px 0 20px">&#9670;&#9670;&#9670;</div>';
      return '';
    }
  }
  function letterFrame(subject, blocks, host) {
    return '<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Bodoni+Moda:opsz@6..96&display=swap"></head><body style="margin:0;background:#f3ecdc;padding:20px 10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#0f2a5e">' +
      '<div style="max-width:600px;margin:0 auto;background:#fbf8f1;border:2px solid #c9a23a"><div style="padding:26px 32px 6px;font-family:\'Alex Brush\',cursive;font-size:34px;color:#0f2a5e">Letters from City Of Testimonies</div>' +
      '<div style="padding:0 32px 8px;font-family:\'Bodoni Moda\',Georgia,serif;font-size:24px;line-height:1.25">' + esc(subject || 'Your subject') + '</div><div style="padding:12px 32px 8px">' + (letterPreview(blocks) || '<p style="color:#5a6680">Your letter appears here.</p>') + '</div>' +
      '<div style="padding:14px 32px 22px;border-top:1px solid #e6dcc4;font-size:12px;line-height:1.6;color:#5a6680">You\'re receiving this because you joined the email list at ' + esc(host || location.hostname) + '.<br><span style="color:#0f2a5e;text-decoration:underline">Unsubscribe</span> at any time with one click.</div></div></body></html>';
  }
  window.BlockEditor = BlockEditor;
  window.BlockEditor.newBlock = newBlock;
  window.BlockEditor.upload = upload;
  window.BlockEditor.letterFrame = letterFrame;
})();
