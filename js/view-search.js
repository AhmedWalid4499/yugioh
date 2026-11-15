/* Card Search and Archetype pages. */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const C = App.C;
  const esc = U.esc;

  const PAGE = 30;

  function readFilters(form) {
    const f = {};
    new FormData(form).forEach((v, k) => { if (v) f[k] = String(v).trim(); });
    return f;
  }

  function filtersToQuery(f) {
    const qs = new URLSearchParams();
    Object.keys(f).forEach((k) => { if (f[k]) qs.set(k, f[k]); });
    const s = qs.toString();
    return s ? '?' + s : '';
  }

  function raceOptions(type, selected) {
    if (type === 'Spell Card') return C.options(C.SPELL_RACES, selected, 'Any spell type');
    if (type === 'Trap Card') return C.options(C.TRAP_RACES, selected, 'Any trap type');
    return C.options(C.RACES, selected, 'Any monster type');
  }

  function filterForm(f, compact) {
    const isST = f.type === 'Spell Card' || f.type === 'Trap Card';
    return '<form class="filters' + (compact ? ' compact' : '') + '" autocomplete="off">' +
      '<div class="search-row">' +
        '<input class="search-input" type="search" name="q" placeholder="Search card names… e.g. Ash Blossom, Dark Magician" value="' + esc(f.q || '') + '" aria-label="Card name">' +
        '<button class="btn btn-primary" type="submit">Search</button>' +
      '</div>' +
      '<div class="filter-row">' +
        '<select name="type" aria-label="Card type">' +
          '<option value="">All card types</option>' +
          '<option value="Spell Card"' + (f.type === 'Spell Card' ? ' selected' : '') + '>Spell</option>' +
          '<option value="Trap Card"' + (f.type === 'Trap Card' ? ' selected' : '') + '>Trap</option>' +
          '<optgroup label="Main Deck monsters">' + C.options(C.MONSTER_TYPES, f.type) + '</optgroup>' +
          '<optgroup label="Extra Deck monsters">' + C.options(C.EXTRA_TYPES, f.type) + '</optgroup>' +
        '</select>' +
        '<select name="race" aria-label="Sub-type">' + raceOptions(f.type, f.race) + '</select>' +
        '<select name="attribute" aria-label="Attribute"' + (isST ? ' disabled' : '') + '>' + C.options(C.ATTRIBUTES, f.attribute, 'Any attribute') + '</select>' +
        '<select name="level" aria-label="Level or Rank"' + (isST ? ' disabled' : '') + '>' + C.options(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'], f.level, 'Any level/rank') + '</select>' +
        '<input name="archetype" list="archetype-list" placeholder="Archetype (e.g. Snake-Eye)" value="' + esc(f.archetype || '') + '" aria-label="Archetype">' +
        '<select name="banlist" aria-label="Banlist">' +
          '<option value="">Any banlist status</option>' +
          '<option value="tcg"' + (f.banlist === 'tcg' ? ' selected' : '') + '>On the TCG banlist</option>' +
        '</select>' +
        '<select name="sort" aria-label="Sort">' +
          C.options(['name', 'new', 'atk', 'def', 'level'], f.sort, 'Sort: best match').replace('>new<', '>newest<') +
        '</select>' +
        '<button class="btn btn-ghost" type="reset">Clear</button>' +
      '</div>' +
      '<datalist id="archetype-list"></datalist>' +
    '</form>';
  }

  function fillArchetypes(root) {
    api.getArchetypes().then((list) => {
      const dl = U.$('#archetype-list', root);
      if (dl) dl.innerHTML = list.map((a) => '<option value="' + esc(a) + '">').join('');
    }).catch(() => {});
  }

  /* A self-contained search widget (used on the Search page and inside the deck builder). */
  function mountSearch(root, opts) {
    const options = opts || {};
    let filters = options.filters || {};
    let offset = 0;
    let token = 0;
    let loaded = [];

    root.innerHTML = filterForm(filters, options.compact) +
      '<div class="result-meta muted" aria-live="polite"></div>' +
      '<div class="grid' + (options.compact ? ' grid-compact' : '') + '"></div>' +
      '<div class="more"></div>';

    const form = U.$('form', root);
    const grid = U.$('.grid', root);
    const meta = U.$('.result-meta', root);
    const more = U.$('.more', root);
    fillArchetypes(root);

    async function run(reset) {
      const my = ++token;
      if (reset) { offset = 0; loaded = []; grid.innerHTML = ''; }
      more.innerHTML = C.loading('Searching…');
      try {
        const res = await api.searchCards(filters, offset, PAGE);
        if (my !== token) return;
        loaded = loaded.concat(res.cards);
        App.decks.rememberMany(res.cards);
        grid.insertAdjacentHTML('beforeend', res.cards.map((c) => options.tile ? options.tile(c) : C.cardTile(c)).join(''));
        const anyFilter = Object.keys(filters).some((k) => k !== 'sort' && filters[k]);
        meta.textContent = res.total
          ? (anyFilter ? res.total.toLocaleString() + ' cards found' : 'Newest cards in the database') + (loaded.length < res.total ? ' · showing ' + loaded.length : '')
          : '';
        if (!res.total) more.innerHTML = C.empty('No cards match. Try fewer filters or a shorter name.');
        else if (res.nextOffset != null && loaded.length < res.total) {
          offset = res.nextOffset;
          more.innerHTML = '<button type="button" class="btn">Load more</button>';
          U.$('button', more).addEventListener('click', () => run(false));
        } else more.innerHTML = '';
      } catch (e) {
        if (my !== token) return;
        more.innerHTML = C.error(e);
      }
    }

    function apply() {
      filters = readFilters(form);
      if (options.onChange) options.onChange(filters);
      run(true);
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
    form.addEventListener('reset', () => setTimeout(() => {
      U.$('[name=race]', form).innerHTML = raceOptions('', '');
      U.$$('[name=attribute],[name=level]', form).forEach((s) => { s.disabled = false; });
      apply();
    }, 0));
    form.addEventListener('change', (e) => {
      if (e.target.name === 'type') {
        const t = e.target.value;
        U.$('[name=race]', form).innerHTML = raceOptions(t, '');
        const st = t === 'Spell Card' || t === 'Trap Card';
        U.$$('[name=attribute],[name=level]', form).forEach((s) => { s.disabled = st; if (st) s.value = ''; });
      }
      if (e.target.name !== 'q' && e.target.name !== 'archetype') apply();
    });
    const live = U.debounce(() => { const q = U.$('[name=q]', form).value.trim(); if (q.length === 0 || q.length >= 3) apply(); }, 450);
    U.$('[name=q]', form).addEventListener('input', live);
    U.$('[name=archetype]', form).addEventListener('change', apply);

    run(true);
    return { refresh: () => run(true) };
  }

  /* ---------- Pages ---------- */

  function searchPage(view, params) {
    const filters = {};
    params.forEach((v, k) => { filters[k] = v; });
    view.innerHTML = '<section class="page">' +
      '<div class="page-head"><h1>Card Search</h1><p class="muted">Search every card, then open one to read its effect, see which deck it belongs to and how to use it.</p></div>' +
      '<div id="search-root"></div></section>';
    mountSearch(U.$('#search-root', view), {
      filters: filters,
      onChange: (f) => history.replaceState(null, '', '#/search' + filtersToQuery(f))
    });
  }

  const ROLE_ORDER = ['starter', 'searcher', 'extender', 'handtrap', 'negate', 'removal', 'recursion', 'mill', 'draw', 'protection', 'floodgate', 'boss', 'tuner', 'burn', 'vanilla'];

  async function archetypePage(view, name) {
    view.innerHTML = '<section class="page"><div class="page-head"><a class="back" href="#/search">← Card Search</a><h1>' + esc(name) + '</h1></div><div id="arch-body">' + C.loading('Loading archetype…') + '</div></section>';
    const body = U.$('#arch-body', view);
    try {
      const cards = await api.getArchetypeCards(name);
      App.decks.rememberMany(cards);
      if (!cards.length) { body.innerHTML = C.empty('No cards found for this archetype.'); return; }
      const groups = { monster: [], extra: [], spell: [], trap: [] };
      cards.forEach((c) => {
        const k = api.isExtraDeck(c) ? 'extra' : api.kind(c);
        (groups[k] || groups.monster).push(c);
      });
      const counts = App.insights.summarise(cards);
      const chips = ROLE_ORDER.filter((k) => counts[k]).map((k) =>
        '<span class="chip role-' + k + '" title="' + esc(App.insights.ROLES[k].desc) + '">' + esc(App.insights.ROLES[k].label) + ' × ' + counts[k] + '</span>').join('');
      const starters = cards.filter((c) => App.insights.analyse(c).roleKeys.indexOf('starter') !== -1);

      const section = (title, list) => list.length
        ? '<h2 class="section-title">' + esc(title) + ' <span class="muted">(' + list.length + ')</span></h2><div class="grid">' + list.map((c) => C.cardTile(c)).join('') + '</div>'
        : '';

      body.innerHTML =
        '<div class="panel">' +
          '<p>' + U.plural(cards.length, 'card') + ' in this archetype: ' + groups.monster.length + ' Main Deck monsters, ' + groups.extra.length + ' Extra Deck monsters, ' + groups.spell.length + ' Spells, ' + groups.trap.length + ' Traps.</p>' +
          '<div class="chips">' + chips + '</div>' +
          (starters.length ? '<p class="small">Likely starters: ' + starters.slice(0, 8).map((c) => '<a href="#" data-card-id="' + c.id + '">' + esc(c.name) + '</a>').join(', ') + '. Build around these and run as many as the banlist allows.</p>' : '') +
          '<div class="row"><a class="btn btn-primary" href="#/build?a=' + encodeURIComponent(name) + '">⚡ Auto-build a ' + esc(name) + ' deck</a><button type="button" class="btn" id="arch-new-deck">Start an empty "' + esc(name) + '" deck</button></div>' +
        '</div>' +
        section('Main Deck monsters', groups.monster) +
        section('Extra Deck monsters', groups.extra) +
        section('Spells', groups.spell) +
        section('Traps', groups.trap);

      U.$('#arch-new-deck', body).addEventListener('click', () => {
        const deck = App.decks.create(name + ' Deck');
        location.hash = '#/deck/' + deck.id + '?archetype=' + encodeURIComponent(name);
      });
    } catch (e) {
      body.innerHTML = C.error(e);
    }
  }

  App.views = App.views || {};
  App.views.search = searchPage;
  App.views.archetype = archetypePage;
  App.mountSearch = mountSearch;
})(window.App);
