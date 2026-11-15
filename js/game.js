/* Game feel: your duelist profile (name and win record), the title screen
   and the "VS" splash shown before a duel. */
(function (App) {
  'use strict';

  const U = App.U;
  const esc = U.esc;
  const KEY = 'dv-profile';

  const RANKS = [[0, 'Rookie Duelist'], [3, 'Duelist'], [10, 'Expert Duelist'], [25, 'Duel Master'], [50, 'Legendary Duelist']];

  function load() { return Object.assign({ name: '', wins: 0, losses: 0, vs: {} }, U.store.get(KEY, {})); }
  function save(p) { U.store.set(KEY, p); }

  App.profile = {
    get: load,
    name: () => load().name.trim(),
    setName(name) { const p = load(); p.name = String(name || '').trim().slice(0, 24); save(p); return p.name; },
    /* Counts a finished duel. charId may be null for non-character opponents. */
    record(charId, won) {
      const p = load();
      if (won) p.wins++; else p.losses++;
      if (charId) {
        const r = p.vs[charId] || { w: 0, l: 0 };
        if (won) r.w++; else r.l++;
        p.vs[charId] = r;
      }
      save(p);
    },
    vs: (charId) => load().vs[charId] || { w: 0, l: 0 },
    rank(wins) {
      const w = wins == null ? load().wins : wins;
      return RANKS.filter((r) => w >= r[0]).pop()[1];
    },
    /* Wins needed for the next rank, or null at the top. */
    nextRank() {
      const w = load().wins;
      const next = RANKS.find((r) => r[0] > w);
      return next ? { wins: next[0] - w, title: next[1] } : null;
    }
  };

  /* ---------- title screen ---------- */

  function circleSvg() {
    // An original "summoning circle": rings, ticks and a star, drawn in SVG.
    let ticks = '';
    for (let i = 0; i < 48; i++) {
      const a = i * 7.5 * Math.PI / 180;
      const r1 = 188, r2 = i % 4 === 0 ? 172 : 180;
      ticks += '<line x1="' + (200 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (200 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (200 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (200 + r2 * Math.sin(a)).toFixed(1) + '"/>';
    }
    const star = [0, 1, 2, 3, 4].map((i) => { const a = (i * 144 - 90) * Math.PI / 180; return (200 + 120 * Math.cos(a)).toFixed(1) + ',' + (200 + 120 * Math.sin(a)).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 400 400" aria-hidden="true"><g class="ring-a"><circle cx="200" cy="200" r="190"/><circle cx="200" cy="200" r="168"/>' + ticks + '</g>' +
      '<g class="ring-b"><circle cx="200" cy="200" r="128"/><polygon points="' + star + '"/></g><g class="ring-c"><circle cx="200" cy="200" r="70"/><circle cx="200" cy="200" r="54"/></g></svg>';
  }

  /* Shows the title screen over the app; resolves when the player presses start. */
  function titleScreen() {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'title-screen';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Duel Vault title screen');
      el.tabIndex = -1;
      let sparks = '';
      for (let i = 0; i < 26; i++) sparks += '<i style="--x:' + (Math.random() * 100).toFixed(1) + '%;--d:' + (4 + Math.random() * 6).toFixed(1) + 's;--delay:-' + (Math.random() * 8).toFixed(1) + 's;--s:' + (2 + Math.random() * 3).toFixed(1) + 'px"></i>';
      el.innerHTML = '<div class="ts-bg"></div><div class="ts-sparks">' + sparks + '</div><div class="ts-circle">' + circleSvg() + '</div>' +
        '<div class="ts-cards" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>' +
        '<div class="ts-center"><div class="ts-kicker">A Yu-Gi-Oh! companion</div><h1 class="ts-logo">Duel Vault</h1>' +
        '<button type="button" class="ts-start">Press Start</button>' +
        '<div class="ts-hint">Click, or press Enter</div></div>' +
        '<div class="ts-foot">v' + esc(App.VERSION || '') + ' · Fan-made · Not affiliated with Konami</div>';
      document.body.appendChild(el);
      document.body.classList.add('title-open');
      el.focus();
      let done = false;
      const go = (e) => {
        if (done) return;
        if (e && e.type === 'keydown' && ['Enter', ' ', 'Escape'].indexOf(e.key) === -1) return;
        if (e && e.preventDefault) e.preventDefault();
        done = true;
        try { sessionStorage.setItem('dv-title-done', '1'); } catch (err) { /* ignore */ }
        App.sound.play('menu-ok');
        App.sound.play('whoosh');
        el.classList.add('leaving');
        document.removeEventListener('keydown', go);
        setTimeout(() => { el.remove(); document.body.classList.remove('title-open'); resolve(); }, 650);
      };
      el.addEventListener('click', go);
      document.addEventListener('keydown', go);
    });
  }

  function titleSeen() { try { return sessionStorage.getItem('dv-title-done') === '1'; } catch (e) { return true; } }

  /* ---------- VS splash ---------- */

  /* left/right: { avatar (html), name, sub }. Returns { ready(), fail() }: ready() plays "DUEL!" and resolves when done. */
  function vsSplash(left, right, fast) {
    const el = document.createElement('div');
    el.className = 'vs-splash' + (fast ? ' fast' : '');
    el.innerHTML = '<div class="vs-side vs-left">' + left.avatar + '<div class="vs-name">' + esc(left.name) + '</div><div class="vs-sub">' + esc(left.sub) + '</div></div>' +
      '<div class="vs-mid"><div class="vs-word">VS</div><div class="vs-status">Shuffling decks…</div></div>' +
      '<div class="vs-side vs-right">' + right.avatar + '<div class="vs-name">' + esc(right.name) + '</div><div class="vs-sub">' + esc(right.sub) + '</div></div>';
    document.body.appendChild(el);
    App.characters.paintArt(el);
    if (!fast) { App.sound.play('whoosh'); setTimeout(() => App.sound.play('vs'), 380); }
    const shownAt = Date.now();
    return {
      ready() {
        const wait = fast ? 0 : Math.max(0, 1300 - (Date.now() - shownAt));
        return new Promise((resolve) => setTimeout(() => {
          el.querySelector('.vs-status').textContent = 'Duel!';
          el.classList.add('go');
          if (!fast) App.sound.play('menu-ok');
          setTimeout(() => { resolve(); el.classList.add('leaving'); setTimeout(() => el.remove(), 400); }, fast ? 0 : 700);
        }, wait));
      },
      fail() { el.remove(); }
    };
  }

  App.game = { titleScreen: titleScreen, titleSeen: titleSeen, vsSplash: vsSplash };
})(window.App);
