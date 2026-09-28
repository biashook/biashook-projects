(function (root) {
  'use strict';
  const ITER = 600000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  function b64(buf) { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function deriveKey(password, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(obj, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, ITER);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function decrypt(payload, password) {
    if (!payload || payload.v !== 1 || !Number.isInteger(payload.iter) || payload.iter < 100000 || payload.iter > 5000000) throw new Error('bad payload');
    const key = await deriveKey(password, unb64(payload.salt), payload.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.ct));
    return JSON.parse(dec.decode(pt));
  }
  const api = { encrypt, decrypt, ITER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BTCrypto = api;
})(this);
