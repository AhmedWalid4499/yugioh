/* Game feel: your duelist profile (name and win record), the title screen
   and the "VS" splash shown before a duel. */
(function (App) {
  'use strict';

  const U = App.U;
  const esc = U.esc;
  const KEY = 'dv-profile';

  const RANKS = [[0, 'Rookie Duelist'], [3, 'Duelist'], [10, 'Expert Duelist'], [25, 'Duel Master'], [50, 'Legendary Duelist']];

  function load() { return Object.assign({ name: '', wins: 0, losses: 0, vs: {}, dp: 1000, dorm: 'red', theme: 'academy' }, U.store.get(KEY, {})); }

  /* Dorm colours: your accent colour across the app. */
  const DORMS = {
    red: { label: 'Red Dorm', color: '#d63031', ink: '#fff' },
    yellow: { label: 'Yellow Dorm', color: '#f5b700', ink: '#2a1d00' },
    blue: { label: 'Blue Dorm', color: '#1e72d8', ink: '#fff' }
  };

  /* Applies the theme (bright Academy or dark Arena) and dorm colour to the page. */
  function applyTheme() {
    const p = load();
    const b = document.body;
    if (!b || !b.classList) return;
    b.classList.toggle('theme-academy', p.theme !== 'arena');
    b.classList.toggle('theme-arena', p.theme === 'arena');
    const d = DORMS[p.dorm] || DORMS.red;
    b.style.setProperty('--dorm', d.color);
    b.style.setProperty('--dorm-ink', d.ink);
    const dp = document.getElementById('dp-badge');
    if (dp) dp.textContent = (Number(p.dp) || 0).toLocaleString('en-US') + ' DP';
  }
  function save(p) { U.store.set(KEY, p); }

  App.profile = {
    get: load,
    name: () => load().name.trim(),
    setName(name) { const p = load(); p.name = String(name || '').trim().slice(0, 24); save(p); return p.name; },
    /* Counts a finished duel and pays Duel Points. Returns { dp, firstWin }. */
    record(charId, won) {
      const p = load();
      if (won) p.wins++; else p.losses++;
      let firstWin = false;
      if (charId) {
        const r = p.vs[charId] || { w: 0, l: 0 };
        firstWin = won && !r.w;
        if (won) r.w++; else r.l++;
        p.vs[charId] = r;
      }
      const dp = won ? 500 + (firstWin ? 300 : 0) : 100;
      p.dp = (Number(p.dp) || 0) + dp;
      save(p);
      applyTheme();
      return { dp: dp, firstWin: firstWin };
    },
    dp: () => Number(load().dp) || 0,
    /* Spends DP; false when there isn't enough. */
    spend(n) { const p = load(); if ((Number(p.dp) || 0) < n) return false; p.dp -= n; save(p); applyTheme(); return true; },
    set(fields) { const p = Object.assign(load(), fields); save(p); applyTheme(); return p; },
    dorms: DORMS,
    applyTheme: applyTheme,
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

  /* ---------- VS splash, pre-duel talk, coin toss ---------- */

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* left/right: { avatar (html), name, sub }. Returns { ready(opts), fail() }.
     ready({ line, coin: { youFirst, firstName } | null }) plays the opponent's line, the coin toss
     and "DUEL!", then resolves. */
  function vsSplash(left, right, fast) {
    const el = document.createElement('div');
    el.className = 'vs-splash' + (fast ? ' fast' : '');
    el.innerHTML = '<div class="vs-side vs-left">' + left.avatar + '<div class="vs-name">' + esc(left.name) + '</div><div class="vs-sub">' + esc(left.sub) + '</div></div>' +
      '<div class="vs-mid"><div class="vs-word">VS</div><div class="vs-status">Shuffling decks…</div></div>' +
      '<div class="vs-side vs-right">' + right.avatar + '<div class="vs-name">' + esc(right.name) + '</div><div class="vs-sub">' + esc(right.sub) + '</div></div>' +
      '<div class="vs-talk" hidden></div><div class="vs-coin" hidden></div><button type="button" class="vs-skip">Skip ▸▸</button>';
    document.body.appendChild(el);
    App.characters.paintArt(el);
    let skipped = !!fast;
    el.querySelector('.vs-skip').addEventListener('click', () => { skipped = true; el.classList.add('skipping'); });
    if (!fast) { App.sound.play('whoosh'); setTimeout(() => App.sound.play('vs'), 380); }
    const shownAt = Date.now();
    const pause = (ms) => (skipped ? Promise.resolve() : wait(ms));
    return {
      async ready(opts) {
        const o = opts || {};
        if (!fast) await pause(Math.max(0, 1300 - (Date.now() - shownAt)));
        // The opponent speaks: a speech bubble with the line typed out.
        if (o.line && !skipped) {
          const talk = el.querySelector('.vs-talk');
          talk.hidden = false;
          talk.innerHTML = '<div class="bubble"><span class="who">' + esc(right.name) + '</span><span class="say"></span></div>';
          el.classList.add('talking');
          const say = talk.querySelector('.say');
          for (let i = 1; i <= o.line.length && !skipped; i++) { say.textContent = o.line.slice(0, i); if (i % 3 === 0) App.sound.play('menu-move'); await wait(22); }
          say.textContent = o.line;
          await pause(900);
          talk.hidden = true;
          el.classList.remove('talking');
        }
        // Coin toss: who goes first.
        if (o.coin && !skipped) {
          const coin = el.querySelector('.vs-coin');
          coin.hidden = false;
          coin.innerHTML = '<div class="coin ' + (o.coin.youFirst ? 'heads' : 'tails') + '"><span class="face front">★</span><span class="face back">◆</span></div><div class="coin-text"></div>';
          App.sound.play('click');
          await pause(1250);
          coin.querySelector('.coin-text').textContent = o.coin.youFirst ? 'You go first!' : o.coin.firstName + ' goes first!';
          App.sound.play('menu-ok');
          await pause(900);
          coin.hidden = true;
        }
        el.querySelector('.vs-status').textContent = 'Duel!';
        el.classList.add('go');
        if (!fast) App.sound.play('vs');
        await (fast ? Promise.resolve() : wait(650));
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 400);
      },
      fail() { el.remove(); }
    };
  }

  /* A summon cut-in: the card sweeps across the screen with its name. side: 0 (you) or 1 (opponent). */
  function cutIn(card, side, label) {
    if (!card || !card.data) return;
    document.querySelectorAll('.cut-in').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'cut-in ' + (side === 1 ? 'theirs' : 'mine');
    const img = App.api.image(card.data, 'cropped') || App.api.image(card.data, 'small');
    el.innerHTML = '<div class="ci-band"><div class="ci-art" style="background-image:url(\'' + esc(img) + '\')"></div>' +
      '<div class="ci-text"><span class="ci-label">' + esc(label || 'Summon') + '</span><span class="ci-name">' + esc(card.name) + '</span></div></div><div class="ci-flash"></div>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  App.game = { titleScreen: titleScreen, titleSeen: titleSeen, vsSplash: vsSplash, cutIn: cutIn };
  // Apply the saved theme as soon as the page has a body.
  if (document.body) applyTheme(); else if (document.addEventListener) document.addEventListener('DOMContentLoaded', applyTheme);
})(window.App);
