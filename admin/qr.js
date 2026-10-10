/* Small QR code maker (byte mode, error correction "M"), no outside services.
   Based on the public QR Code standard (ISO/IEC 18004) and Project Nayuki's reference design.
   QR.svg(text, { size, dark, light, margin }) -> '<svg …>'   ·   QR.matrix(text) -> array of rows (true = dark) */
(function (root) {
  'use strict';
  var ECC = { L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28] };
  var BLOCKS = { L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49] };
  var FORMAT = { L: 1, M: 0 };

  function rawModules(v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
  function dataCodewords(v, e) { return Math.floor(rawModules(v) / 8) - ECC[e][v] * BLOCKS[e][v]; }
  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }

  // Reed-Solomon over GF(256), polynomial 0x11D
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function divisor(deg) { var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1); var root = 1;
    for (var i2 = 0; i2 < deg; i2++) { for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 0x02); } return r; }
  function remainder(data, div) { var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= mul(c, f); }); }); return r; }

  function alignPos(v) { if (v === 1) return []; var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
    var step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2; var r = [6]; for (var p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; }

  function make(text, ecl) {
    ecl = ecl || 'M';
    var bytes = utf8(String(text)), v, cap;
    for (v = 1; v <= 40; v++) { cap = dataCodewords(v, ecl) * 8; if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap) break; }
    if (v > 40) throw new Error('Text too long for a QR code');
    // data bits
    var bits = [];
    var put = function (val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    // error correction + interleaving
    var nb = BLOCKS[ecl][v], el = ECC[ecl][v], raw = Math.floor(rawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var blocks = [], div = divisor(el), k = 0;
    for (var bi = 0; bi < nb; bi++) { var dat = data.slice(k, k + shortLen - el + (bi < nShort ? 0 : 1)); k += dat.length; var ec = remainder(dat, div); if (bi < nShort) dat.push(0); blocks.push(dat.concat(ec)); }
    var words = [];
    for (var ci = 0; ci < blocks[0].length; ci++) blocks.forEach(function (bl, bj) { if (ci !== shortLen - el || bj >= nShort) words.push(bl[ci]); });

    // modules
    var size = v * 4 + 17, M = [], F = [];
    for (var y = 0; y < size; y++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    var set = function (x, y, d) { M[y][x] = !!d; F[y][x] = true; };
    for (var t = 0; t < size; t++) { set(6, t, t % 2 === 0); set(t, 6, t % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4); }
    });
    var ap = alignPos(v);
    ap.forEach(function (a, ai) { ap.forEach(function (b2, bj2) {
      if ((ai === 0 && bj2 === 0) || (ai === 0 && bj2 === ap.length - 1) || (ai === ap.length - 1 && bj2 === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(a + dx, b2 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    var format = function (mask) {
      var d = (FORMAT[ecl] << 3) | mask, r = d; for (var i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var fb = ((d << 10) | r) ^ 0x5412, bit = function (i) { return (fb >>> i) & 1; };
      for (var i1 = 0; i1 <= 5; i1++) set(8, i1, bit(i1));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (var i2 = 9; i2 < 15; i2++) set(14 - i2, 8, bit(i2));
      for (var i3 = 0; i3 < 8; i3++) set(size - 1 - i3, 8, bit(i3));
      for (var i4 = 8; i4 < 15; i4++) set(8, size - 15 + i4, bit(i4));
      set(8, size - 8, true);
    };
    format(0);
    if (v >= 7) { var r = v; for (var q = 0; q < 12; q++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); var vb = (v << 12) | r;
      for (var vi = 0; vi < 18; vi++) { var bt = (vb >>> vi) & 1, a2 = size - 11 + vi % 3, b3 = Math.floor(vi / 3); set(a2, b3, bt); set(b3, a2, bt); } }
    // place data
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var jj = 0; jj < 2; jj++) {
        var x = right - jj, up = ((right + 1) & 2) === 0, yy2 = up ? size - 1 - vert : vert;
        if (!F[yy2][x] && n < words.length * 8) { M[yy2][x] = ((words[n >>> 3] >>> (7 - (n & 7))) & 1) === 1; n++; }
      }
    }
    // choose the mask with the lowest penalty
    var masks = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }];
    var apply = function (m) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!F[y][x] && masks[m](x, y)) M[y][x] = !M[y][x]; };
    var penalty = function () {
      var p = 0, dark = 0, y, x;
      for (y = 0; y < size; y++) { var runC = 1, runR = 1; for (x = 0; x < size; x++) { if (M[y][x]) dark++;
        if (x > 0) { if (M[y][x] === M[y][x - 1]) { runR++; if (runR === 5) p += 3; else if (runR > 5) p++; } else runR = 1;
          if (M[x][y] === M[x - 1][y]) { runC++; if (runC === 5) p += 3; else if (runC > 5) p++; } else runC = 1; } } }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      var pat = function (a) { return a.join('') === '10111010000' || a.join('') === '00001011101'; };
      for (y = 0; y < size; y++) for (x = 0; x + 11 <= size; x++) { var row = [], col = []; for (var z = 0; z < 11; z++) { row.push(M[y][x + z] ? 1 : 0); col.push(M[x + z][y] ? 1 : 0); } if (pat(row)) p += 40; if (pat(col)) p += 40; }
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    };
    var best = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) { apply(mk); format(mk); var pp = penalty(); if (pp < bestP) { bestP = pp; best = mk; } apply(mk); }
    apply(best); format(best);
    return M;
  }

  function svg(text, o) {
    o = o || {}; var M = make(text, o.ecl), n = M.length, m = o.margin == null ? 4 : o.margin, t = n + m * 2, d = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (M[y][x]) d += 'M' + (x + m) + ',' + (y + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t + '"' + (o.size ? ' width="' + o.size + '" height="' + o.size + '"' : '') + ' shape-rendering="crispEdges" role="img" aria-label="' + String(o.label || 'QR code').replace(/"/g, '') + '">' +
      '<rect width="' + t + '" height="' + t + '" fill="' + (o.light || '#fff') + '"/><path d="' + d + '" fill="' + (o.dark || '#000') + '"/></svg>';
  }
  var api = { matrix: make, svg: svg };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.QR = api;
})(this);
