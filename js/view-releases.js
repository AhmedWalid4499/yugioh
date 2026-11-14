/* New Releases: every TCG product with release dates, a personal watchlist,
   recently released cards, and a page for each set. */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const C = App.C;
  const esc = U.esc;
  const WATCH_KEY = 'dv-watchlist';

  const watch = {
    list: () => U.store.get(WATCH_KEY, []),
    has: (name) => watch.list().indexOf(name) !== -1,
    toggle(name) {
      const l = watch.list();
      const i = l.indexOf(name);
      if (i === -1) l.push(name); else l.splice(i, 1);
      U.store.set(WATCH_KEY, l);
      return i === -1;
    }
  };

  function category(set) {
    const n = set.set_name || '';
    if (/structure deck|starter deck|deck:|preconstructed|deck build pack|egyptian god deck|saga of blue-eyes|speed duel gx|speed duel starter/i.test(n)) return 'Decks';
    if (/tin|box|collection|mega pack|bundle|chest|mat|legendary|anniversary|hidden arsenal|battles of legend|the infinite forbidden/i.test(n)) return 'Tins & Collections';
    if (/promo|prize|tournament|participation|championship|sneak peek|special edition|judge|ots|power pack|premiere|movie|game|magazine|jump/i.test(n)) return 'Promos';
    return 'Booster Sets';
  }

  const CATS = ['All', 'Booster Sets', 'Decks', 'Tins & Collections', 'Promos'];

  let state = U.store.get('dv-releases-ui', { tab: 'recent', cat: 'All', q: '' });

  function saveState() { U.store.set('dv-releases-ui', state); }

  function setRow(set, today) {
    const d = U.parseDate(set.tcg_date);
    const diff = d ? U.daysBetween(today, d) : null;
    const when = diff == null ? 'Date TBA'
      : diff > 0 ? 'in ' + U.plural(diff, 'day')
      : diff === 0 ? 'today'
      : diff > -60 ? U.plural(-diff, 'day') + ' ago' : '';
    const starred = watch.has(set.set_name);
    return '<div class="set-row">' +
      '<a class="set-link" href="#/set/' + encodeURIComponent(set.set_name) + '">' +
        '<span class="set-thumb">' + (set.set_image ? '<img loading="lazy" src="' + esc(set.set_image) + '" alt="">' : '<span>' + esc((set.set_code || '?').slice(0, 4)) + '</span>') + '</span>' +
        '<span class="set-main">' +
          '<span class="set-name">' + esc(set.set_name) + '</span>' +
          '<span class="set-meta"><span class="tag">' + esc(category(set)) + '</span> ' + esc(set.set_code || '') + ' · ' + U.plural(Number(set.num_of_cards) || 0, 'card') + '</span>' +
        '</span>' +
        '<span class="set-date"><strong>' + esc(U.formatDate(set.tcg_date)) + '</strong>' + (when ? '<span class="muted">' + esc(when) + '</span>' : '') + '</span>' +
      '</a>' +
      '<button type="button" class="star' + (starred ? ' on' : '') + '" data-watch="' + esc(set.set_name) + '" aria-pressed="' + starred + '" title="' + (starred ? 'Remove from watchlist' : 'Add to watchlist') + '">' + (starred ? '★' : '☆') + '</button>' +
    '</div>';
  }

  async function releasesPage(view) {
    view.innerHTML = '<section class="page">' +
      '<div class="page-head"><h1>New Releases</h1><p class="muted">Track upcoming and recent TCG products. Star a set to add it to your watchlist.</p></div>' +
      '<div class="tabs" role="tablist">' +
        [['upcoming', 'Upcoming'], ['recent', 'Last 90 days'], ['cards', 'New cards'], ['watch', 'My watchlist'], ['all', 'All sets']].map((t) =>
          '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (state.tab === t[0]) + '">' + t[1] + '</button>').join('') +
      '</div>' +
      '<div class="filter-row" id="rel-filters">' +
        '<input type="search" id="rel-q" placeholder="Filter by name or code…" value="' + esc(state.q) + '" aria-label="Filter sets">' +
        CATS.map((c) => '<button type="button" class="pill' + (state.cat === c ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('') +
      '</div>' +
      '<div id="rel-body">' + C.loading('Loading sets…') + '</div>' +
    '</section>';

    const body = U.$('#rel-body', view);
    let sets = [];

    function render() {
      U.$$('[data-tab]', view).forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === state.tab)));
      U.$$('[data-cat]', view).forEach((b) => b.classList.toggle('on', b.getAttribute('data-cat') === state.cat));
      U.$('#rel-filters', view).hidden = state.tab === 'cards';
      if (state.tab === 'cards') { renderNewCards(body); return; }

      const today = U.today();
      const q = state.q.toLowerCase();
      let list = sets.filter((s) => {
        if (state.cat !== 'All' && category(s) !== state.cat) return false;
        if (q && (s.set_name + ' ' + (s.set_code || '')).toLowerCase().indexOf(q) === -1) return false;
        const d = U.parseDate(s.tcg_date);
        if (state.tab === 'upcoming') return d && d > today;
        if (state.tab === 'recent') return d && d <= today && U.daysBetween(d, today) <= 90;
        if (state.tab === 'watch') return watch.has(s.set_name);
        return true;
      });
      list.sort((a, b) => (state.tab === 'upcoming' ? 1 : -1) * String(a.tcg_date || '').localeCompare(String(b.tcg_date || '')));
      const total = list.length;
      list = list.slice(0, 300);

      const emptyMsg = state.tab === 'upcoming' ? 'No upcoming sets with announced dates yet — check back soon.'
        : state.tab === 'watch' ? 'Your watchlist is empty. Star (☆) any set to follow it here.'
        : 'No sets match these filters.';
      body.innerHTML = total
        ? '<p class="muted small">' + U.plural(total, 'set') + (total > list.length ? ' · showing the first ' + list.length : '') + '</p><div class="set-list">' + list.map((s) => setRow(s, today)).join('') + '</div>'
        : C.empty(emptyMsg);
    }

    view.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { state.tab = tab.getAttribute('data-tab'); saveState(); render(); return; }
      const cat = e.target.closest('[data-cat]');
      if (cat) { state.cat = cat.getAttribute('data-cat'); saveState(); render(); return; }
      const star = e.target.closest('[data-watch]');
      if (star) {
        const on = watch.toggle(star.getAttribute('data-watch'));
        U.toast(on ? 'Added to your watchlist.' : 'Removed from your watchlist.');
        render();
      }
    });
    U.$('#rel-q', view).addEventListener('input', U.debounce((e) => { state.q = e.target.value.trim(); saveState(); render(); }, 200));

    if (state.tab === 'cards') render();
    try {
      sets = await api.getSets();
      if (state.tab !== 'cards') render();
    } catch (e) {
      if (state.tab !== 'cards') body.innerHTML = C.error(e);
    }
  }

  async function renderNewCards(body) {
    body.innerHTML = C.loading('Finding recently released cards…');
    const today = U.today();
    const start = new Date(today); start.setDate(start.getDate() - 60);
    const end = new Date(today); end.setDate(end.getDate() + 120);
    try {
      const cards = await api.getCardsReleasedBetween(U.isoDate(start), U.isoDate(end));
      App.decks.rememberMany(cards.slice(0, 200));
      body.innerHTML = cards.length
        ? '<p class="muted small">' + U.plural(cards.length, 'card') + ' with a TCG release date between ' + U.formatDate(start) + ' and ' + U.formatDate(end) + '.</p>' +
          '<div class="grid">' + cards.slice(0, 200).map((c) => C.cardTile(c)).join('') + '</div>'
        : C.empty('No cards with a TCG release date in the last 60 days.');
    } catch (e) {
      body.innerHTML = C.error(e);
    }
  }

  async function setPage(view, name) {
    view.innerHTML = '<section class="page"><div class="page-head"><a class="back" href="#/releases">← New Releases</a><h1>' + esc(name) + '</h1><div id="set-meta" class="muted"></div></div><div id="set-body">' + C.loading('Loading cards in this set…') + '</div></section>';
    const body = U.$('#set-body', view);
    const metaBox = U.$('#set-meta', view);

    api.getSets().then((sets) => {
      const s = sets.find((x) => x.set_name === name);
      if (!s) return;
      const starred = watch.has(name);
      metaBox.innerHTML = esc(category(s)) + ' · ' + esc(s.set_code || '') + ' · ' + esc(U.formatDate(s.tcg_date)) + ' · ' + U.plural(Number(s.num_of_cards) || 0, 'card') +
        ' <button type="button" class="btn btn-small" id="set-star">' + (starred ? '★ Watching' : '☆ Watch this set') + '</button>';
      U.$('#set-star', metaBox).addEventListener('click', (e) => {
        const on = watch.toggle(name);
        e.target.textContent = on ? '★ Watching' : '☆ Watch this set';
      });
    }).catch(() => {});

    try {
      const cards = await api.getSetCards(name);
      App.decks.rememberMany(cards);
      if (!cards.length) { body.innerHTML = C.empty('No card list for this set yet. Card lists usually appear once the set is revealed.'); return; }

      const rarityIn = (c) => {
        const r = (c.card_sets || []).filter((s) => s.set_name === name).map((s) => s.set_rarity);
        return Array.from(new Set(r)).join(' / ');
      };
      const codeIn = (c) => ((c.card_sets || []).find((s) => s.set_name === name) || {}).set_code || '';
      cards.sort((a, b) => codeIn(a).localeCompare(codeIn(b), undefined, { numeric: true }));

      const arch = {};
      cards.forEach((c) => { if (c.archetype) arch[c.archetype] = (arch[c.archetype] || 0) + 1; });
      const archList = Object.keys(arch).sort((a, b) => arch[b] - arch[a]);
      const isDeck = /structure deck|starter deck|deck:/i.test(name);

      body.innerHTML =
        '<div class="panel">' +
          (archList.length ? '<p><strong>Archetypes in this set:</strong> ' + archList.slice(0, 12).map((a) => '<a href="#/archetype/' + encodeURIComponent(a) + '">' + esc(a) + '</a> (' + arch[a] + ')').join(', ') + '</p>' : '<p>Mostly generic cards — no single archetype dominates.</p>') +
          '<div class="row">' +
            '<button type="button" class="btn' + (isDeck ? ' btn-primary' : '') + '" id="set-to-deck">Create a deck from this set\'s card list</button>' +
          '</div>' +
          (isDeck ? '<p class="muted small">Pre-built decks usually include multiple copies of some cards; the card list only shows each card once, so adjust copies after importing.</p>' : '') +
        '</div>' +
        '<div class="grid">' + cards.map((c) => C.cardTile(c, [codeIn(c), rarityIn(c)].filter(Boolean).join(' · '))).join('') + '</div>';

      U.$('#set-to-deck', body).addEventListener('click', () => {
        const parts = { main: [], extra: [], side: [] };
        cards.forEach((c) => {
          const k = api.kind(c);
          if (k === 'skill' || k === 'token' || api.copyLimit(c) === 0) return;
          const z = api.isExtraDeck(c) ? 'extra' : 'main';
          if (parts[z].length < App.decks.ZONE_MAX[z]) parts[z].push(c.id);
        });
        const deck = App.decks.create(name, parts);
        U.toast('Deck created from ' + name + '.');
        location.hash = '#/deck/' + deck.id;
      });
    } catch (e) {
      body.innerHTML = C.error(e);
    }
  }

  App.views = App.views || {};
  App.views.releases = releasesPage;
  App.views.set = setPage;
})(window.App);
