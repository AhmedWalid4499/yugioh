/* Small shared helpers. Everything hangs off the global `App` namespace so the
   site works by simply opening index.html — no build step, no server. */
window.App = window.App || {};

(function (App) {
  'use strict';

  const U = {};

  U.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.debounce = function (fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  /* localStorage can throw (private mode, blocked storage) — never let it break the app. */
  U.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  let toastTimer;
  U.toast = function (message) {
    const box = document.getElementById('toast');
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 2600);
  };

  U.today = function () {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  U.parseDate = function (s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  };

  U.isoDate = function (d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  U.formatDate = function (s) {
    const d = typeof s === 'string' ? U.parseDate(s) : s;
    if (!d) return 'Date TBA';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  U.daysBetween = function (a, b) {
    return Math.round((b - a) / 86400000);
  };

  /* Probability of drawing at least one of `hits` copies in a hand of `hand`
     cards from a deck of `deck` cards (hypergeometric). */
  U.probAtLeastOne = function (deck, hits, hand) {
    if (hits <= 0 || deck <= 0) return 0;
    if (hits >= deck) return 1;
    hand = Math.min(hand, deck);
    let pNone = 1;
    for (let i = 0; i < hand; i++) {
      pNone *= (deck - hits - i) / (deck - i);
      if (pNone <= 0) return 1;
    }
    return 1 - pNone;
  };

  U.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  U.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  U.plural = (n, word, many) => n + ' ' + (n === 1 ? word : (many || word + 's'));

  App.U = U;
})(window.App);
