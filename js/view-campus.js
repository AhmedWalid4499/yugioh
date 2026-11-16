/* Academy Campus: walk around the island, meet the duelists, talk, give gifts,
   chat (with Claude), make friends and choose a partner. */
(function (App) {
  'use strict';

  const U = App.U;
  const esc = U.esc;
  const B = () => App.bonds;
  const CH = () => App.characters;

  const heartsHtml = (id) => {
    const h = B().hearts(id);
    const pts = B().get(id).pts;
    const into = h >= 5 ? 100 : Math.round(((pts % B().PER_HEART) / B().PER_HEART) * 100);
    return '<span class="hearts" title="' + h + ' of 5 hearts">' + '❤'.repeat(h) + '<span class="off">' + '♡'.repeat(5 - h) + '</span></span>' +
      (h < 5 ? '<span class="heart-bar"><span style="width:' + into + '%"></span></span>' : '<span class="heart-max">Best friends</span>');
  };

  /* ---------- the meeting scene (visual-novel style) ---------- */

  function meet(id, place) {
    const c = CH().get(id);
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'vn';
    el.style.setProperty('--hue', (place && place.hue) || '#8fb8ff');
    el.style.setProperty('--ring', c.color);
    el.innerHTML = '<div class="vn-bg"></div>' +
      '<button type="button" class="vn-close" aria-label="Leave">✕</button>' +
      '<div class="vn-portrait">' + CH().avatar(id, 'huge') + '<div class="vn-who"><strong>' + esc(c.name) + '</strong><span class="vn-hearts">' + heartsHtml(id) + '</span>' +
        (B().partner() === id ? '<span class="partner-tag">★ Your partner</span>' : '') + '</div></div>' +
      '<div class="vn-box"><div class="vn-name">' + esc(c.short) + '</div><div class="vn-text"></div><div class="vn-extra"></div><div class="vn-choices"></div></div>';
    document.body.appendChild(el);
    document.body.classList.add('vn-open');
    CH().paintArt(el);
    CH().loadAces();
    App.sound.play('whoosh');

    const text = el.querySelector('.vn-text');
    const extra = el.querySelector('.vn-extra');
    const choicesBox = el.querySelector('.vn-choices');
    let closed = false;
    let skipType = false;
    const close = () => {
      if (closed) return;
      closed = true;
      el.classList.add('leaving');
      document.body.classList.remove('vn-open');
      setTimeout(() => el.remove(), 300);
      if (location.hash.indexOf('#/campus') === 0) App.router();
    };
    el.querySelector('.vn-close').addEventListener('click', close);
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    el.querySelector('.vn-box').addEventListener('click', (e) => { if (!e.target.closest('button, input, textarea')) skipType = true; });

    async function say(line, who) {
      el.querySelector('.vn-name').textContent = who || c.short;
      el.classList.toggle('you-talk', !!who);
      skipType = false;
      text.textContent = '';
      for (let i = 1; i <= line.length && !closed; i++) {
        if (skipType) { text.textContent = line; break; }
        text.textContent = line.slice(0, i);
        if (i % 4 === 0) App.sound.play('menu-move');
        await new Promise((r) => setTimeout(r, 18));
      }
    }
    function choose(list) {
      return new Promise((resolve) => {
        choicesBox.innerHTML = list.map((x, i) => '<button type="button" class="vn-choice' + (x.off ? ' off' : '') + '" data-i="' + i + '"' + (x.title ? ' title="' + esc(x.title) + '"' : '') + '>' + esc(x.label) + '</button>').join('');
        const h = (e) => {
          const b = e.target.closest('.vn-choice');
          if (!b) return;
          const x = list[Number(b.getAttribute('data-i'))];
          if (x.off) { App.sound.play('invalid'); U.toast(x.title || 'Not available.'); return; }
          choicesBox.removeEventListener('click', h);
          choicesBox.innerHTML = '';
          App.sound.play('menu-ok');
          resolve(x.key);
        };
        choicesBox.addEventListener('click', h);
        el.querySelector('.vn-close').addEventListener('click', () => resolve('leave'), { once: true });
      });
    }
    function refreshHearts() {
      el.querySelector('.vn-hearts').innerHTML = heartsHtml(id);
      const tag = el.querySelector('.partner-tag');
      if (B().partner() === id && !tag) el.querySelector('.vn-who').insertAdjacentHTML('beforeend', '<span class="partner-tag">★ Your partner</span>');
    }
    async function gain(n) {
      const r = await B().add(id, n);
      refreshHearts();
      const hearts = el.querySelector('.vn-hearts');
      hearts.classList.remove('pulse'); void hearts.offsetWidth; hearts.classList.add('pulse');
      if (n > 0) floatText('+' + n + ' ❤');
      for (const rw of r.rewards) {
        App.sound.play('vs');
        await say(c.short + ' likes you more! (' + rw.level + ' ❤) You received ' + rw.text + '.', '♪');
        await choose([{ key: 'ok', label: 'Yay!' }]);
      }
    }
    function floatText(t) {
      const f = document.createElement('div');
      f.className = 'vn-float';
      f.textContent = t;
      el.querySelector('.vn-portrait').appendChild(f);
      setTimeout(() => f.remove(), 1300);
    }

    async function talk() {
      if (B().talkedToday(id)) { await say(B().alreadyLine()); return; }
      const tp = B().topic(id);
      await say(tp.text);
      const k = await choose(tp.choices);
      if (k === 'leave') return;
      const a = B().answer(id, k);
      B().markTalked(id);
      await say(a.text);
      await gain(a.pts);
    }

    async function gift() {
      if (B().giftedToday(id)) { await say('You already gave me something today. Thank you, though!'); return; }
      const coll = App.shop.collection();
      const ids = Object.keys(coll).filter((x) => coll[x].n > 0);
      if (!ids.length) { await say('You don\'t have any cards to give yet. Buy some packs at the Card Shop!', '♪'); return; }
      await say('Which card will you give?', 'You');
      const card = await new Promise((resolve) => {
        extra.innerHTML = '<div class="vn-gifts">' + ids.slice(0, 80).map((cid) => { const cd = App.decks.cached(cid); return cd ? '<button type="button" class="vn-gift" data-id="' + esc(cid) + '" title="' + esc(cd.name) + '"><img src="' + esc(App.api.image(cd, 'small')) + '" alt="">' + (coll[cid].n > 1 ? '<span>×' + coll[cid].n + '</span>' : '') + '</button>' : ''; }).join('') + '</div>';
        choicesBox.innerHTML = '<button type="button" class="vn-choice" data-cancel>Never mind</button>';
        const h = (e) => {
          const g = e.target.closest('.vn-gift');
          if (g) { cleanup(); resolve(App.decks.cached(g.getAttribute('data-id'))); }
          if (e.target.closest('[data-cancel]')) { cleanup(); resolve(null); }
        };
        const cleanup = () => { el.removeEventListener('click', h); extra.innerHTML = ''; choicesBox.innerHTML = ''; };
        el.addEventListener('click', h);
      });
      if (!card) return;
      App.shop.removeFromCollection(card.id);
      B().markGifted(id);
      const taste = B().giftTaste(id, card);
      await say(B().giftLine(taste));
      await gain(B().giftPts(taste));
    }

    async function deck() {
      await say(c.style + ' These are my signature cards:');
      extra.innerHTML = '<div class="vn-sig">' + c.signature.map((n) => '<span class="sig-name">' + esc(n) + '</span>').join('') + '</div>';
      try {
        const found = await App.api.getCardsByNames(c.signature);
        App.decks.rememberMany(Object.keys(found).map((k) => found[k]));
        extra.innerHTML = '<div class="vn-gifts">' + c.signature.map((n) => { const cd = found[App.api.normName(n)]; return cd ? '<button type="button" class="vn-gift" data-card-id="' + cd.id + '" title="' + esc(cd.name) + '"><img src="' + esc(App.api.image(cd, 'small')) + '" alt=""></button>' : ''; }).join('') + '</div>';
      } catch (e) { /* names stay */ }
      const k = await choose([{ key: 'build', label: '⚡ Build this deck' }, { key: 'back', label: 'Thanks!' }]);
      extra.innerHTML = '';
      if (k === 'build') { close(); location.hash = '#/build?char=' + id; }
    }

    async function chat() {
      const hasKey = App.ClaudeOpponent.settings.hasKey();
      extra.innerHTML = '<div class="vn-chat"><div class="vn-log"></div>' +
        (hasKey ? '' : '<p class="small">Free chat uses Claude with your own Anthropic API key (paid per use, stored only on this device).</p><label class="vn-key">API key <input type="password" placeholder="sk-ant-…" autocomplete="off"></label>') +
        '<form class="vn-send"><input type="text" maxlength="400" placeholder="Say something to ' + esc(c.short) + '…" aria-label="Message"><button class="btn btn-primary" type="submit">Send</button></form></div>';
      choicesBox.innerHTML = '<button type="button" class="vn-choice" data-done>Done chatting</button>';
      const log = extra.querySelector('.vn-log');
      const show = () => {
        log.innerHTML = B().chatLog(id).map((m) => '<div class="msg ' + (m.role === 'user' ? 'me' : 'them') + '">' + esc(m.content) + '</div>').join('');
        log.scrollTop = log.scrollHeight;
      };
      show();
      text.textContent = 'Go ahead, I\'m listening.';
      const form = extra.querySelector('.vn-send');
      form.querySelector('input').focus();
      await new Promise((resolve) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const input = form.querySelector('input');
          const msg = input.value.trim();
          if (!msg) return;
          const keyBox = extra.querySelector('.vn-key input');
          if (keyBox && keyBox.value.trim()) App.ClaudeOpponent.settings.set({ apiKey: keyBox.value.trim() });
          if (!App.ClaudeOpponent.settings.hasKey()) { U.toast('Paste your Anthropic API key first.'); return; }
          input.value = '';
          const got = B().pushChat(id, 'user', msg);
          show();
          log.insertAdjacentHTML('beforeend', '<div class="msg them typing">…</div>');
          log.scrollTop = log.scrollHeight;
          try {
            const reply = await App.ClaudeOpponent.chat(B().chatSystem(id), B().chatLog(id).map((m) => ({ role: m.role, content: m.content })));
            B().pushChat(id, 'assistant', reply || '…');
            show();
            text.textContent = reply;
            if (got) await gain(got);
          } catch (err) {
            show();
            log.insertAdjacentHTML('beforeend', '<div class="msg sys">' + esc(err.message) + '</div>');
          }
        });
        choicesBox.querySelector('[data-done]').addEventListener('click', resolve, { once: true });
        el.querySelector('.vn-close').addEventListener('click', resolve, { once: true });
      });
      extra.innerHTML = '';
      choicesBox.innerHTML = '';
    }

    (async () => {
      await say(B().greet(id));
      while (!closed) {
        const h = B().hearts(id);
        const isPartner = B().partner() === id;
        const k = await choose([
          { key: 'talk', label: '💬 Talk', off: B().talkedToday(id), title: 'You already talked today. Come back tomorrow!' },
          { key: 'gift', label: '🎁 Give a gift', off: B().giftedToday(id), title: 'One gift a day.' },
          { key: 'duel', label: '⚔ Duel' },
          { key: 'deck', label: '🃏 Your deck' },
          { key: 'chat', label: '✦ Chat freely' },
          isPartner ? { key: 'unpartner', label: '★ Partner (end)' } : { key: 'partner', label: '★ Be my partner', off: h < 3, title: 'Reach 3 hearts first.' },
          { key: 'leave', label: 'See you!' }
        ]);
        if (closed || k === 'leave') { if (!closed) { await say(pick(['See you around!', 'Later!', 'Bye for now.'])); setTimeout(close, 700); } return; }
        if (k === 'talk') await talk();
        if (k === 'gift') await gift();
        if (k === 'deck') await deck();
        if (k === 'chat') await chat();
        if (k === 'duel') { await say(App.characters.line(id, 'intro')); close(); location.hash = '#/duel?vs=' + id; return; }
        if (k === 'partner') {
          B().setPartner(id);
          refreshHearts();
          App.sound.play('vs');
          await say('Partners? ...Yeah. Let\'s do this together!');
        }
        if (k === 'unpartner') { B().setPartner(null); el.querySelector('.partner-tag').remove(); await say('Oh... okay. We\'re still friends, right?'); }
      }
    })();
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- pages ---------- */

  function page(view, params) {
    const at = params && params.get('at');
    const where = B().whereabouts();
    const partner = B().partner();
    CH().loadAces();
    if (at && where[at]) return scene(view, B().places.find((p) => p.id === at), where[at]);
    view.innerHTML = '<section class="page campus-page">' +
      '<div class="page-head row-between"><div><h1>Academy Campus</h1><p class="muted">' + esc(B().slotName()) + ' on the island. Visit a place to meet the duelists hanging out there — talk, give gifts and duel to raise your friendship ❤. Who is where changes in the morning, afternoon and evening.</p></div>' +
        (partner ? '<button type="button" class="partner-card" data-meet="' + partner + '" style="--ring:' + CH().get(partner).color + '">' + CH().avatar(partner, 'big') + '<span><small>Your partner</small><strong>' + esc(CH().get(partner).short) + '</strong>' + heartsHtml(partner) + '</span></button>' : '') + '</div>' +
      '<div class="campus-map">' + B().places.map((pl) => '<a class="place" href="#/campus?at=' + pl.id + '" style="--hue:' + pl.hue + '">' +
        '<span class="pl-icon" aria-hidden="true">' + pl.icon + '</span><span class="pl-name">' + esc(pl.name) + '</span><span class="pl-blurb">' + esc(pl.blurb) + '</span>' +
        '<span class="pl-people">' + where[pl.id].map((id) => CH().avatar(id)).join('') + '</span>' +
        '<span class="pl-count">' + where[pl.id].length + ' here</span></a>').join('') + '</div>' +
      '<h2 class="section-title">Friends</h2><div class="friends">' + CH().list().filter((c) => B().get(c.id).pts > 0).sort((a, b) => B().get(b.id).pts - B().get(a.id).pts).map((c) =>
        '<button type="button" class="friend" data-meet="' + c.id + '">' + CH().avatar(c.id) + '<span><strong>' + esc(c.short) + '</strong>' + heartsHtml(c.id) + '</span></button>').join('') +
        (CH().list().some((c) => B().get(c.id).pts > 0) ? '' : '<p class="muted">You haven\'t made friends yet. Visit a place and say hello!</p>') + '</div>' +
      '</section>';
    CH().paintArt(view);
    view.addEventListener('click', (e) => { const m = e.target.closest('[data-meet]'); if (m) meet(m.getAttribute('data-meet'), B().places.find((p) => p.id === 'dorms')); });
  }

  function scene(view, place, ids) {
    view.innerHTML = '<section class="page campus-scene" style="--hue:' + place.hue + '">' +
      '<a class="back" href="#/campus">← Campus map</a>' +
      '<div class="scene-head"><span class="pl-icon">' + place.icon + '</span><div><h1>' + esc(place.name) + '</h1><p class="muted">' + esc(place.blurb) + ' · ' + esc(B().slotName()) + '</p></div></div>' +
      '<div class="scene-stage">' + (ids.length ? ids.map((id, i) => {
        const c = CH().get(id);
        return '<button type="button" class="npc" data-meet="' + id + '" style="--ring:' + c.color + ';--i:' + i + '">' + CH().avatar(id, 'huge') +
          '<span class="npc-name">' + esc(c.short) + '</span>' + heartsHtml(id) + (B().partner() === id ? '<span class="partner-tag">★ Partner</span>' : '') + '<span class="npc-hint">Talk</span></button>';
      }).join('') : '<p class="muted">Nobody is here right now. Try another place!</p>') + '</div></section>';
    CH().paintArt(view);
    view.addEventListener('click', (e) => { const m = e.target.closest('[data-meet]'); if (m) meet(m.getAttribute('data-meet'), place); });
  }

  App.campus = { meet: meet };
  App.views = App.views || {};
  App.views.campus = page;
})(window.App);
