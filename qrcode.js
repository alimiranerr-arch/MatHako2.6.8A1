/* Matematik Macerası için bağımsız, çevrimdışı QR üreticisi.
 * QR Code Model 2, Version 1-L, alfanümerik veri (25 karaktere kadar).
 * Davet kodları kısa olduğundan bu kapasite yeterlidir.
 */
(function (w) {
  'use strict';
  const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const ECC = [127, 122, 154, 164, 11, 68, 117]; // Version 1-L generator coefficients (without leading 1)
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      if ((y >>> i) & 1) z ^= x;
    }
    return z;
  }
  function makeData(text) {
    text = String(text).toUpperCase();
    if (!text.length || text.length > 25 || [...text].some(c => !ALPHA.includes(c)))
      throw new Error('QR metni 1-25 karakterlik QR alfanümerik metin olmalı.');
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(2, 4); put(text.length, 9);
    for (let i = 0; i < text.length; i += 2) {
      const a = ALPHA.indexOf(text[i]);
      if (i + 1 < text.length) put(a * 45 + ALPHA.indexOf(text[i + 1]), 11);
      else put(a, 6);
    }
    for (let i = 0; i < 4 && bits.length < 152; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let p = 0; data.length < 19; p++) data.push(p % 2 ? 0x11 : 0xEC);
    const ecc = new Array(7).fill(0);
    data.forEach(byte => {
      const factor = byte ^ ecc[0];
      for (let i = 0; i < 6; i++) ecc[i] = ecc[i + 1] ^ gfMul(ECC[i], factor);
      ecc[6] = gfMul(ECC[6], factor);
    });
    return data.concat(ecc);
  }
  function matrixFor(text) {
    const n = 21, m = Array.from({ length: n }, () => Array(n).fill(null));
    const set = (x, y, v) => { if (x >= 0 && x < n && y >= 0 && y < n) m[y][x] = !!v; };
    function finder(x, y) {
      for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
        const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        set(xx, yy, inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)));
      }
    }
    finder(0, 0); finder(14, 0); finder(0, 14);
    for (let i = 8; i < 13; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    // Format information for error correction L and mask 0.
    const format = 0x77C4; // BCH(0x08) XOR 0x5412
    for (let i = 0; i <= 5; i++) set(8, i, (format >>> i) & 1);
    set(8, 7, (format >>> 6) & 1); set(8, 8, (format >>> 7) & 1); set(7, 8, (format >>> 8) & 1);
    for (let i = 9; i < 15; i++) set(14 - i, 8, (format >>> i) & 1);
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, (format >>> i) & 1);
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, (format >>> i) & 1);
    set(8, n - 8, true);
    const codewords = makeData(text), stream = [];
    codewords.forEach(b => { for (let i = 7; i >= 0; i--) stream.push((b >>> i) & 1); });
    let bit = 0, upward = true;
    for (let right = 20; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        const y = upward ? n - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          if (m[y][x] !== null) continue;
          const raw = bit < stream.length ? stream[bit++] : 0;
          set(x, y, raw ^ ((x + y) % 2 === 0)); // mask 0
        }
      }
      upward = !upward;
    }
    return m;
  }
  function QRCode(element, options) {
    if (!(this instanceof QRCode)) return new QRCode(element, options);
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (!el) throw new Error('QR hedef alanı bulunamadı.');
    const opts = typeof options === 'string' ? { text: options } : (options || {});
    const matrix = matrixFor(opts.text || '');
    const size = Number(opts.width) || 180, quiet = 4, total = 21 + quiet * 2;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${total} ${total}`); svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Düello davet QR kodu');
    const bg = document.createElementNS(ns, 'rect'); bg.setAttribute('width', total); bg.setAttribute('height', total); bg.setAttribute('fill', '#fff'); svg.appendChild(bg);
    let d = '';
    matrix.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + quiet},${y + quiet}h1v1h-1z`; }));
    const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('fill', '#000'); svg.appendChild(path);
    el.replaceChildren(svg); this._el = el;
  }
  QRCode.CorrectLevel = { L: 1 };
  QRCode.prototype.clear = function () { if (this._el) this._el.replaceChildren(); };
  w.QRCode = QRCode;
})(window);
