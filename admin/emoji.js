// Emoji picker + text size control for the studio, blog, newsletter and messages pages.
// Emojis are normal text characters (Unicode) – no outside service; each phone shows its own emoji style.
// StudioEmoji.open(button, input)  → picker under the button, inserts at the cursor and fires "input"
// StudioEmoji.tools(attrs, size)   → HTML for "😊 Emoji" + "A− size A+" (size optional)
// StudioEmoji.step(size, ±1) / label(size) / SIZES
(function () {
  if (window.StudioEmoji) return;
  var css = '' +
    '.emj-b{display:inline-flex;align-items:center;gap:5px;border:1px solid #e6d3c8;background:#fff;border-radius:999px;padding:3px 10px;font:inherit;font-size:.74rem;line-height:1.4;cursor:pointer;color:#2b0e04;letter-spacing:0;text-transform:none;font-weight:400;white-space:nowrap;justify-self:start;align-self:start;width:auto;max-width:max-content;flex:none}' +
    '.emj-b:hover,.emj-b[aria-expanded="true"]{border-color:#c9a24a;background:#fbf1dc}' +
    '.emj-tools{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto}' +
    '.emj-sz{display:inline-flex;align-items:center;border:1px solid #e6d3c8;border-radius:999px;background:#fff;overflow:hidden}' +
    '.emj-sz button{border:0;background:none;padding:3px 9px;cursor:pointer;font-family:"Bodoni Moda",Georgia,serif;color:#2b0e04;line-height:1.3;font-size:.85rem;letter-spacing:0;text-transform:none}' +
    '.emj-sz button:last-child{font-size:1.02rem}.emj-sz button:hover{background:#f4e7df}.emj-sz button:disabled{opacity:.3;cursor:default;background:none}' +
    '.emj-sz span{font-size:.68rem;min-width:70px;text-align:center;color:#7a5547;border-left:1px solid #e6d3c8;border-right:1px solid #e6d3c8;padding:4px 4px;white-space:nowrap}' +
    '.emj-sz span.chg{color:#9b1313;font-weight:600}' +
    '.emj-pick{position:absolute;z-index:9999;width:328px;max-width:calc(100vw - 16px);background:#fff;border:1px solid #e6d3c8;border-radius:12px;box-shadow:0 20px 40px -18px rgba(43,14,4,.45);padding:10px;font-family:Jost,system-ui,sans-serif;color:#2b0e04}' +
    '.emj-pick input{width:100%;box-sizing:border-box;border:1px solid #e6d3c8;border-radius:6px;padding:8px 10px;font:inherit;font-size:.85rem;background:#fff;color:inherit}' +
    '.emj-pick input:focus{outline:none;border-color:#9b1313}' +
    '.emj-cats{display:flex;gap:2px;margin:8px 0 6px;border-bottom:1px solid #e6d3c8;padding-bottom:6px}' +
    '.emj-cats button{border:0;background:none;font-size:1.1rem;padding:4px 6px;border-radius:6px;cursor:pointer;opacity:.6}' +
    '.emj-cats button[aria-pressed="true"]{background:#f4e7df;opacity:1}' +
    '.emj-cn{font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:#7a5547;margin:4px 2px}' +
    '.emj-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;max-height:190px;overflow:auto}' +
    '.emj-grid button{border:0;background:none;font-size:1.3rem;padding:4px 0;border-radius:6px;cursor:pointer;line-height:1.2}' +
    '.emj-grid button:hover,.emj-grid button:focus-visible{background:#f4e7df;outline:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var SIZES = [[0.8, 'Smaller'], [0.9, 'A bit smaller'], [1, 'Normal'], [1.15, 'A bit bigger'], [1.3, 'Bigger'], [1.5, 'Much bigger'], [1.75, 'Huge']];
  function idx(v) { v = Number(v) || 1; var best = 2, d = 9; SIZES.forEach(function (s, i) { var x = Math.abs(s[0] - v); if (x < d) { d = x; best = i; } }); return best; }
  function step(v, dir) { var i = Math.max(0, Math.min(SIZES.length - 1, idx(v) + dir)); return SIZES[i][0]; }
  function label(v) { return SIZES[idx(v)][1]; }

  var E = {
    '⭐ Favorites': '🙏 ❤️ ✨ 💕 🕊️ 🔥 🌸 💍 💄 🎉 😊 🥰 🙌 ✝️ 📖 👑',
    '🙏 Faith': '🙏 ✝️ 🕊️ 📖 ⛪ 🙌 👑 🔥 💒 🌅 🕯️ 💧 🌾 🌱 🛐 ☀️ 🌈 ⭐ 🤲 😇',
    '❤️ Love': '❤️ 💕 💖 💗 💓 💞 💝 🤍 🤎 💛 🧡 💜 🥰 😍 😘 🫶 💐 🌹',
    '💄 Beauty': '💄 💋 💅 💍 👰 👰🏾 👰🏽 🤵 💇‍♀️ 💆‍♀️ 👗 👠 👑 💎 🪞 🧴 ✨ 🌟 📸',
    '🎉 Celebrate': '🎉 🥳 🎊 🎁 🎂 🍾 🥂 🎈 🎀 🏆 🎶 🎵 💃 🕺 📅 ⏰ 📣',
    '🌸 Nature': '🌸 🌺 🌷 🌻 🌼 🌹 🍃 🌿 🌱 🌳 🌾 🌊 🌙 ⭐ ☀️ 🌈 🦋 🕊️',
    '😊 Smileys': '😊 😀 😁 😂 🥹 😇 🥰 😍 🤗 😌 😢 😭 🙂 😉 🤩 😎 🥺 👍 👏 🙌 👋 💪 🤝',
    '➡️ Signs': '➡️ ⬇️ 👉 👇 ✅ ☑️ ✔️ ❗ ❓ ⚠️ 📍 📞 📧 💬 🗓️ 🕘 🛍️ 🎁 💳 🏠 🚗 ✈️'
  };
  var CAT = Object.keys(E);
  var WORDS = { heart: '❤️ 💕 💖 💗 🤍 💛 🧡 💜 🥰 😍 🫶', love: '❤️ 💕 🥰 😍 💖', pray: '🙏 🤲 🛐 ✝️ ⛪ 🕊️ 😇', hands: '🙏 🙌 👏 🤲 🫶', church: '⛪ ✝️ 💒', ring: '💍 💎 👰 💒', wedding: '💍 👰 👰🏾 🤵 💒 🥂', flower: '🌸 🌺 🌷 🌻 🌼 🌹 💐', fire: '🔥', star: '⭐ 🌟 ✨', sparkle: '✨ 🌟', cross: '✝️ ⛪', dove: '🕊️', bible: '📖', book: '📖', makeup: '💄 💋 💅 🪞', bride: '👰 👰🏾 👰🏽 💍 💒', party: '🎉 🥳 🎊 🎈', birthday: '🎂 🎉 🎁 🎈', smile: '😊 😀 😁 🙂 🥰', happy: '😊 😁 🥳 🤩', cry: '😢 😭 🥹', sad: '😢 😭 🥺', laugh: '😂 😁', crown: '👑', sun: '☀️ 🌅', camera: '📸', gift: '🎁', money: '💳 🛍️', shop: '🛍️', phone: '📞', mail: '📧', email: '📧', calendar: '🗓️ 📅', time: '🕘 ⏰', home: '🏠', car: '🚗', plane: '✈️', check: '✅ ✔️ ☑️', arrow: '➡️ ⬇️ 👉 👇', point: '👉 👇', water: '💧 🌊', plant: '🌱 🌿 🍃 🌾', music: '🎶 🎵', dance: '💃 🕺', thanks: '🙏 🤍 💐', strong: '💪', angel: '😇', butterfly: '🦋', moon: '🌙', rainbow: '🌈', candle: '🕯️' };

  var open = null;
  function close() { if (!open) return; open.el.remove(); open.btn.setAttribute('aria-expanded', 'false'); var b = open.btn; open = null; return b; }
  document.addEventListener('mousedown', function (e) { if (open && !open.el.contains(e.target) && e.target !== open.btn && !open.btn.contains(e.target)) close(); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') { var b = close(); if (b) b.focus(); } });

  // remember the cursor of the box before the picker steals focus
  var caret = new WeakMap();
  document.addEventListener('focusout', function (e) { var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.selectionStart != null) caret.set(t, [t.selectionStart, t.selectionEnd]); }, true);

  function insert(input, ch) {
    var c = caret.get(input), v = input.value, s = c ? c[0] : v.length, t = c ? c[1] : s;
    if (s > 0 && /[\w.,!?:;)'"]/.test(v.charAt(s - 1))) ch = ' ' + ch; // "season 💕" instead of "season💕"
    input.value = v.slice(0, s) + ch + v.slice(t);
    var p = s + ch.length; caret.set(input, [p, p]);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function openPicker(btn, input) {
    if (open && open.btn === btn) { close(); return; }
    close();
    var el = document.createElement('div'); el.className = 'emj-pick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Choose an emoji');
    el.innerHTML = '<input type="search" placeholder="Search: heart, pray, ring, flower…" aria-label="Search emojis"><div class="emj-cats">' +
      CAT.map(function (c, i) { return '<button type="button" data-c="' + i + '" title="' + c.slice(c.indexOf(' ') + 1) + '" aria-pressed="' + (i === 0) + '">' + c.split(' ')[0] + '</button>'; }).join('') +
      '</div><div class="emj-cn"></div><div class="emj-grid"></div>';
    document.body.appendChild(el);
    var r = btn.getBoundingClientRect(), w = Math.min(328, innerWidth - 16);
    el.style.left = Math.max(8, Math.min(r.left + scrollX, scrollX + innerWidth - w - 8)) + 'px';
    var below = r.bottom + 330 < innerHeight || r.top < 340;
    el.style.top = (below ? r.bottom + scrollY + 6 : r.top + scrollY - 6 - 300) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    open = { el: el, btn: btn };
    function show(i, list) {
      el.querySelector('.emj-cn').textContent = list ? 'Results' : CAT[i].slice(CAT[i].indexOf(' ') + 1);
      [].forEach.call(el.querySelectorAll('.emj-cats button'), function (x, j) { x.setAttribute('aria-pressed', !list && j === i); });
      el.querySelector('.emj-grid').innerHTML = (list || E[CAT[i]].split(' ')).map(function (x) { return '<button type="button">' + x + '</button>'; }).join('');
    }
    show(0);
    el.querySelector('.emj-cats').onclick = function (e) { var c = e.target.closest('[data-c]'); if (c) show(+c.dataset.c); };
    el.querySelector('input').oninput = function () {
      var q = this.value.trim().toLowerCase(); if (!q) return show(0);
      var out = [];
      Object.keys(WORDS).forEach(function (w) { if (w.indexOf(q) === 0 || (q.length > 3 && q.indexOf(w) === 0)) WORDS[w].split(' ').forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
      show(0, out.length ? out : null); if (!out.length) el.querySelector('.emj-cn').textContent = 'Nothing found – pick from the tabs';
    };
    el.querySelector('.emj-grid').onclick = function (e) { var g = e.target.closest('button'); if (!g) return; insert(input, g.textContent); };
    setTimeout(function () { el.querySelector('input').focus(); }, 0);
  }

  function tools(attrs, size) {
    attrs = attrs || '';
    return '<span class="emj-tools"><button type="button" class="emj-b" data-emj ' + attrs + ' aria-expanded="false" title="Add an emoji">😊 Emoji</button>' +
      (size === undefined ? '' : '<span class="emj-sz" title="Text size"><button type="button" data-szd="-1" ' + attrs + ' aria-label="Smaller text"' + (idx(size) === 0 ? ' disabled' : '') + '>A−</button><span' + (idx(size) === 2 ? '' : ' class="chg"') + '>' + label(size) + '</span><button type="button" data-szd="1" ' + attrs + ' aria-label="Bigger text"' + (idx(size) === SIZES.length - 1 ? ' disabled' : '') + '>A+</button></span>') + '</span>';
  }
  // refresh one size control after a change, without redrawing the form
  function paint(wrap, size) {
    if (!wrap) return; var b = wrap.querySelectorAll('button'), s = wrap.querySelector('span'), i = idx(size);
    b[0].disabled = i === 0; b[1].disabled = i === SIZES.length - 1; s.textContent = label(size); s.className = i === 2 ? '' : 'chg';
  }
  // plain emoji button next to any input: StudioEmoji.attach(input)
  function attach(input, where) {
    if (!input || input._emj) return; input._emj = 1;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'emj-b'; b.textContent = '😊 Emoji'; b.title = 'Add an emoji'; b.setAttribute('aria-expanded', 'false');
    b.onclick = function () { openPicker(b, input); };
    if (where) where.appendChild(b); else input.insertAdjacentElement('afterend', b);
    return b;
  }
  window.StudioEmoji = { open: openPicker, close: close, tools: tools, paint: paint, attach: attach, step: step, label: label, SIZES: SIZES, insert: insert };
})();
