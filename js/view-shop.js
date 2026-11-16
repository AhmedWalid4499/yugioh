/* Card Shop: spend Duel Points (DP) on booster packs from real sets, open
   them with an animation, and keep the cards in your binder (collection). */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const D = App.decks;
  const esc = U.esc;
  const COLL = 'dv-collection';
  const PRICE = 200;
  const PER_PACK = 9;

  /* Classic and GX-era boosters, plus the newest sets (added at runtime). */
  const CLASSICS = [
    'Legend of Blue Eyes White Dragon', 'Metal Raiders', 'Pharaoh\'s Servant', 'Invasion of Chaos', 'Dark Crisis',
    'Cybernetic Revolution', 'Elemental Energy', 'Shadow of Infinity', 'Enemy of Justice', 'Power of the Duelist',
    'Strike of Neos', 'Light of Destruction'
  ];

  const RARITY = [
    ['secret', /secret|ultimate|ghost|starlight|collector|platinum|prismatic|quarter century/i, 'Secret Rare'],
    ['ultra', /ultra/i, 'Ultra Rare'],
    ['super', /super/i, 'Super Rare'],
    ['rare', /rare/i, 'Rare'],
    ['common', /.*/, 'Common']
  ];
  const tier = (r) => (RARITY.find((x) => x[1].test(r || '')) || RARITY[4])[0];
  const tierLabel = (t) => (RARITY.find((x) => x[0] === t) || RARITY[4])[2];
  const ORDER = ['common', 'rare', 'super', 'ultra', 'secret'];

  function collection() { return U.store.get(COLL, {}); }
  function addToCollection(cards) {
    const c = collection();
    const isNew = [];
    cards.forEach((x) => {
      const cur = c[x.card.id] || { n: 0, r: 'common' };
      if (!cur.n) isNew.push(x.card.id);
      cur.n += 1;
      if (ORDER.indexOf(x.tier) > ORDER.indexOf(cur.r)) cur.r = x.tier;
      cur.t = Date.now();
      c[x.card.id] = cur;
    });
    U.store.set(COLL, c);
    return isNew;
  }

  function removeFromCollection(id) {
    const c = collection();
    if (!c[id]) return false;
    c[id].n -= 1;
    if (c[id].n <= 0) delete c[id];
    U.store.set(COLL, c);
    return true;
  }

  /* The cards of a set, grouped by rarity in that set. */
  async function setPool(setName) {
    const cards = await api.getSetCards(setName);
    D.rememberMany(cards);
    const pool = { common: [], rare: [], super: [], ultra: [], secret: [] };
    cards.forEach((c) => {
      const entries = (c.card_sets || []).filter((x) => x.set_name === setName);
      const tiers = entries.length ? entries.map((x) => tier(x.set_rarity)) : ['common'];
      tiers.forEach((t) => pool[t].push(c));
    });
    return pool;
  }

  const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  /* 7 commons, 1 rare, and a foil slot that can be Super, Ultra or Secret. */
  function rollPack(pool) {
    const any = [].concat(pool.common, pool.rare, pool.super, pool.ultra, pool.secret);
    const take = (t) => {
      let k = ORDER.indexOf(t);
      while (k >= 0 && !pool[ORDER[k]].length) k--;
      if (k < 0) { k = ORDER.indexOf(t); while (k < ORDER.length && !pool[ORDER[k]].length) k++; }
      const bucket = pool[ORDER[k]] || any;
      return { card: pickFrom(bucket.length ? bucket : any), tier: ORDER[k] || 'common' };
    };
    const out = [];
    for (let i = 0; i < PER_PACK - 2; i++) out.push(take('common'));
    out.push(take('rare'));
    const r = Math.random();
    out.push(take(r < 1 / 24 ? 'secret' : r < 1 / 8 ? 'ultra' : r < 1 / 4 ? 'super' : 'rare'));
    return out;
  }

  /* ---------- the pack opening ---------- */

  function openPack(setName, cover, cards) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'pack-open';
      el.innerHTML = '<div class="po-stage">' +
        '<div class="po-pack"><div class="pk-top"></div><div class="pk-body" style="' + (cover ? 'background-image:url(\'' + esc(cover) + '\')' : '') + '"><span class="pk-name">' + esc(setName) + '</span></div><div class="pk-shine"></div></div>' +
        '<p class="po-hint">Click the pack to tear it open</p>' +
        '<div class="po-cards" hidden>' + cards.map((x, i) => '<button type="button" class="po-card tier-' + x.tier + '" data-i="' + i + '" style="--i:' + i + '">' +
          '<span class="po-inner"><span class="po-back"></span><span class="po-front"><img src="' + esc(api.image(x.card, 'small')) + '" alt=""><span class="po-rar">' + esc(tierLabel(x.tier)) + '</span></span></span></button>').join('') + '</div>' +
        '<div class="po-actions" hidden><button type="button" class="btn" id="po-all">Reveal all</button><button type="button" class="btn btn-primary" id="po-done" hidden>Add to my binder</button></div>' +
        '</div>';
      document.body.appendChild(el);
      App.sound.play('whoosh');
      const pack = el.querySelector('.po-pack');
      let revealed = 0;
      const reveal = (btn) => {
        if (btn.classList.contains('flipped')) return;
        btn.classList.add('flipped');
        const t = cards[Number(btn.getAttribute('data-i'))].tier;
        App.sound.play(t === 'common' ? 'click' : 'menu-ok');
        if (t === 'ultra' || t === 'secret') { App.sound.play('vs'); btn.classList.add('big-hit'); }
        revealed++;
        if (revealed === cards.length) { el.querySelector('#po-done').hidden = false; el.querySelector('#po-all').hidden = true; }
      };
      pack.addEventListener('click', () => {
        if (pack.classList.contains('torn')) return;
        pack.classList.add('shaking');
        App.sound.play('click');
        setTimeout(() => {
          pack.classList.add('torn');
          App.sound.play('whoosh');
          setTimeout(() => {
            pack.remove();
            el.querySelector('.po-hint').textContent = 'Click each card to flip it';
            el.querySelector('.po-cards').hidden = false;
            el.querySelector('.po-actions').hidden = false;
          }, 550);
        }, 450);
      });
      el.addEventListener('click', (e) => {
        const c = e.target.closest('.po-card');
        if (c) reveal(c);
        if (e.target.closest('#po-all')) {
          el.querySelectorAll('.po-card').forEach((b, i) => setTimeout(() => reveal(b), i * 140));
        }
        if (e.target.closest('#po-done')) {
          el.classList.add('leaving');
          setTimeout(() => { el.remove(); resolve(); }, 350);
        }
      });
    });
  }

  /* ---------- page ---------- */

  async function packList() {
    let sets = [];
    try { sets = await api.getSets(); } catch (e) { sets = []; }
    const byName = new Map(sets.map((x) => [x.set_name, x]));
    const now = new Date().toISOString().slice(0, 10);
    const newest = sets.filter((x) => x.tcg_date && x.tcg_date <= now && Number(x.num_of_cards) >= 60 && Number(x.num_of_cards) <= 140 &&
      !/deck|tin|collection|promo|pack|special|mega|legendary|duelist|reprint|anniversary|box|bundle|structure|starter|tournament|championship|gold|premium|battles of legend|ghosts|rarity/i.test(x.set_name))
      .sort((a, b) => (a.tcg_date < b.tcg_date ? 1 : -1)).slice(0, 4);
    const classics = CLASSICS.map((n) => byName.get(n) || { set_name: n });
    return { newest: newest, classics: classics };
  }

  function packTile(x) {
    return '<button type="button" class="pack-tile" data-set="' + esc(x.set_name) + '">' +
      '<span class="pt-art"' + (x.set_image ? ' style="background-image:url(\'' + esc(x.set_image) + '\')"' : '') + '></span>' +
      '<span class="pt-name">' + esc(x.set_name) + '</span>' +
      '<span class="pt-meta">' + (x.tcg_date ? esc(x.tcg_date.slice(0, 4)) + ' · ' : '') + PRICE + ' DP</span></button>';
  }

  function binderHtml() {
    const c = collection();
    const ids = Object.keys(c).sort((a, b) => (c[b].t || 0) - (c[a].t || 0));
    if (!ids.length) return '<div class="panel empty-hero"><h2>Your binder is empty</h2><p>Buy a booster pack to start your collection.</p></div>';
    const total = ids.reduce((n, id) => n + c[id].n, 0);
    return '<p class="muted">' + ids.length + ' different cards · ' + total + ' in total</p><div class="binder">' + ids.map((id) => {
      const card = D.cached(id);
      return '<button type="button" class="binder-card tier-' + c[id].r + '" data-card-id="' + esc(id) + '" title="' + esc(card ? card.name : id) + '">' +
        (card ? '<img loading="lazy" src="' + esc(api.image(card, 'small')) + '" alt="">' : '<span class="cardback"></span>') +
        '<span class="bc-n">×' + c[id].n + '</span></button>';
    }).join('') + '</div>';
  }

  function page(view, params) {
    const tab = params && params.get('tab') === 'binder' ? 'binder' : 'packs';
    view.innerHTML = '<section class="page shop-page">' +
      '<div class="page-head row-between"><div><h1>Card Shop</h1><p class="muted">Win duels to earn Duel Points (DP), then spend them on booster packs. Each pack has ' + PER_PACK + ' cards from the real set, including at least one Rare.</p></div>' +
        '<div class="dp-wallet"><span>Your DP</span><strong id="shop-dp">' + App.profile.dp().toLocaleString('en-US') + '</strong></div></div>' +
      '<div class="tabs"><a href="#/shop" class="tab' + (tab === 'packs' ? ' active' : '') + '">Booster packs</a><a href="#/shop?tab=binder" class="tab' + (tab === 'binder' ? ' active' : '') + '">My binder</a></div>' +
      '<div id="shop-body">' + (tab === 'binder' ? binderHtml() : '<p class="muted">Loading packs…</p>') + '</div></section>';
    if (tab === 'binder') return;
    const body = U.$('#shop-body', view);
    packList().then((l) => {
      body.innerHTML = (l.newest.length ? '<h2 class="section-title">New releases</h2><div class="pack-grid">' + l.newest.map(packTile).join('') + '</div>' : '') +
        '<h2 class="section-title">Classic boosters</h2><div class="pack-grid">' + l.classics.map(packTile).join('') + '</div>' +
        '<p class="muted small">Win: +500 DP (+300 the first time you beat a rival). Loss: +100 DP. Cards in your binder are for collecting; your decks can use any card.</p>';
    });
    view.addEventListener('click', async (e) => {
      const t = e.target.closest('.pack-tile');
      if (!t || t.disabled) return;
      const name = t.getAttribute('data-set');
      if (App.profile.dp() < PRICE) { App.sound.play('invalid'); U.toast('You need ' + PRICE + ' DP. Win a duel to earn more!'); return; }
      t.disabled = true;
      try {
        const pool = await setPool(name).catch(() => null);
        if (!pool || !ORDER.some((k) => pool[k].length)) throw new Error('this set\'s card list isn\'t available right now (are you offline?)');
        const cards = rollPack(pool);
        if (!App.profile.spend(PRICE)) throw new Error('Not enough DP.');
        const cover = (cards.find((x) => x.tier !== 'common') || cards[0]).card;
        await openPack(name, api.image(cover, 'cropped'), cards);
        const fresh = addToCollection(cards);
        U.toast('Added ' + cards.length + ' cards to your binder' + (fresh.length ? ' (' + fresh.length + ' new!)' : '') + '.');
        const dp = document.getElementById('shop-dp');
        if (dp) dp.textContent = App.profile.dp().toLocaleString('en-US');
      } catch (err) {
        U.toast('Couldn\'t open that pack: ' + err.message);
      } finally { t.disabled = false; }
    });
  }

  App.shop = { rollPack: rollPack, tier: tier, collection: collection, addToCollection: addToCollection, removeFromCollection: removeFromCollection, PRICE: PRICE };
  App.views = App.views || {};
  App.views.shop = page;
})(window.App);
