/* Reusable UI pieces: card tiles, the card detail modal, filter options. */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const esc = U.esc;
  const C = {};

  C.MONSTER_TYPES = ['Effect Monster', 'Normal Monster', 'Tuner Monster', 'Flip Effect Monster', 'Ritual Effect Monster', 'Ritual Monster',
    'Pendulum Effect Monster', 'Pendulum Normal Monster', 'Spirit Monster', 'Gemini Monster', 'Union Effect Monster', 'Toon Monster'];
  C.EXTRA_TYPES = ['Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster', 'Pendulum Effect Fusion Monster',
    'Synchro Pendulum Effect Monster', 'XYZ Pendulum Effect Monster', 'Synchro Tuner Monster'];
  C.RACES = ['Aqua', 'Beast', 'Beast-Warrior', 'Creator-God', 'Cyberse', 'Dinosaur', 'Divine-Beast', 'Dragon', 'Fairy', 'Fiend', 'Fish',
    'Illusion', 'Insect', 'Machine', 'Plant', 'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior',
    'Winged Beast', 'Wyrm', 'Zombie'];
  C.SPELL_RACES = ['Normal', 'Quick-Play', 'Continuous', 'Equip', 'Field', 'Ritual'];
  C.TRAP_RACES = ['Normal', 'Continuous', 'Counter'];
  C.ATTRIBUTES = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];

  C.options = function (list, selected, blankLabel) {
    return (blankLabel != null ? '<option value="">' + esc(blankLabel) + '</option>' : '') +
      list.map((v) => '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  };

  C.banBadge = function (card) {
    const ban = card && card.banlist_info && card.banlist_info.ban_tcg;
    if (!ban) return '';
    const cls = ban === 'Banned' || ban === 'Forbidden' ? 'ban-0' : ban === 'Limited' ? 'ban-1' : 'ban-2';
    const label = ban === 'Banned' || ban === 'Forbidden' ? '0' : ban === 'Limited' ? '1' : '2';
    return '<span class="ban-badge ' + cls + '" title="TCG: ' + esc(ban) + '">' + label + '</span>';
  };

  /* A clickable card in a results grid. */
  C.cardTile = function (card, extra) {
    const img = api.image(card, 'small');
    return '<button type="button" class="card-tile frame-' + esc(card.frameType || api.kind(card)) + '" data-card-id="' + esc(card.id) + '" title="' + esc(card.name) + '">' +
      '<span class="card-img">' + (img ? '<img loading="lazy" src="' + esc(img) + '" alt="">' : '') + C.banBadge(card) + '</span>' +
      '<span class="card-name">' + esc(card.name) + '</span>' +
      '<span class="card-sub">' + esc(extra != null ? extra : api.typeLine(card)) + '</span>' +
      '</button>';
  };

  C.loading = (msg) => '<div class="state"><span class="spinner" aria-hidden="true"></span>' + esc(msg || 'Loading…') + '</div>';
  C.error = (err) => '<div class="state state-error">⚠ ' + esc(err && err.message ? err.message : err) + '</div>';
  C.empty = (msg) => '<div class="state">' + esc(msg) + '</div>';

  function formatDesc(desc) {
    return esc(desc || '').replace(/([^\n])●/g, '$1\n●').replace(/\n/g, '<br>');
  }

  /* ---------- Card detail modal ---------- */

  const modal = () => document.getElementById('modal');

  C.closeModal = function () {
    const m = modal();
    const cb = C._onClose;
    C._onClose = null;
    m.hidden = true;
    document.body.classList.remove('modal-open');
    if (C._lastFocus && C._lastFocus.focus) C._lastFocus.focus();
    if (cb) cb();
  };

  C.openModal = function (html) {
    const m = modal();
    C._onClose = null;
    C._lastFocus = document.activeElement;
    document.getElementById('modal-body').innerHTML = html;
    m.hidden = false;
    document.body.classList.add('modal-open');
    const panel = m.querySelector('.modal-panel');
    panel.scrollTop = 0;
    panel.focus({ preventScroll: true });
  };

  C.openCard = async function (id) {
    C.openModal(C.loading('Loading card…'));
    let card;
    try {
      card = await api.getCard(id);
    } catch (e) {
      const fallback = App.decks.cached(id);
      if (!fallback) { document.getElementById('modal-body').innerHTML = C.error(e); return; }
      card = fallback;
    }
    App.decks.remember(card);
    document.getElementById('modal-body').innerHTML = renderCardDetail(card);
    wireCardDetail(card);
  };

  function renderCardDetail(card) {
    const info = App.insights.analyse(card);
    const misc = (card.misc_info && card.misc_info[0]) || {};
    const sets = card.card_sets || [];
    const decks = App.decks.all();
    const active = App.decks.getActive();

    const roleChips = info.roles.length
      ? info.roles.map((r) => '<span class="chip role-' + r.key + '" title="' + esc(r.desc) + '">' + esc(r.label) + '</span>').join('')
      : '<span class="muted">No specific role detected — read the effect below.</span>';

    const archetypeLink = card.archetype
      ? '<a href="#/archetype/' + encodeURIComponent(card.archetype) + '" data-close-nav>' + esc(card.archetype) + '</a>'
      : (info.generic ? '<span>None — a generic card</span>' : '<span class="muted">None</span>');

    const mentions = info.mentions.length
      ? '<div class="kv"><span>Mentions</span><span>' + info.mentions.slice(0, 8).map((n) =>
        '<a href="#/search?q=' + encodeURIComponent(n) + '" data-close-nav>' + esc(n) + '</a>').join(', ') + '</span></div>'
      : '';

    const descHtml = info.pendulum
      ? '<h4>Pendulum Effect</h4><p class="card-text">' + formatDesc(info.pendulum.pendulum) + '</p>' +
        '<h4>Monster Effect</h4><p class="card-text">' + formatDesc(info.pendulum.monster) + '</p>'
      : '<p class="card-text">' + formatDesc(card.desc) + '</p>';

    const setRows = sets.slice(0, 40).map((s) =>
      '<tr><td><a href="#/set/' + encodeURIComponent(s.set_name) + '" data-close-nav>' + esc(s.set_name) + '</a></td><td>' + esc(s.set_code) + '</td><td>' + esc(s.set_rarity) + '</td></tr>').join('');

    const deckOptions = decks.map((d) => '<option value="' + esc(d.id) + '"' + (d.id === active ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('');
    const limit = api.copyLimit(card);
    const addBlock = api.kind(card) === 'skill' || api.kind(card) === 'token'
      ? ''
      : '<div class="add-to-deck">' +
        (decks.length
          ? '<label>Add to deck <select id="detail-deck">' + deckOptions + '</select></label>' +
            '<button type="button" class="btn btn-primary" data-add="auto"' + (limit === 0 ? ' disabled' : '') + '>+ ' + (api.isExtraDeck(card) ? 'Extra' : 'Main') + '</button>' +
            '<button type="button" class="btn" data-add="side"' + (limit === 0 ? ' disabled' : '') + '>+ Side</button>'
          : '<button type="button" class="btn btn-primary" data-new-deck>Start a deck with this card</button>') +
        '<span class="muted" id="detail-count"></span>' +
        '</div>';

    return '<div class="detail">' +
      '<div class="detail-art">' +
        '<img src="' + esc(api.image(card, 'large')) + '" alt="' + esc(card.name) + '">' +
        '<a class="muted small" href="https://ygoprodeck.com/card/?search=' + encodeURIComponent(card.id) + '" target="_blank" rel="noopener">View on YGOPRODeck ↗</a>' +
      '</div>' +
      '<div class="detail-info">' +
        '<h2 id="modal-title">' + esc(card.name) + ' ' + C.banBadge(card) + '</h2>' +
        '<div class="type-line">' + esc(api.typeLine(card)) + '</div>' +
        (api.statLine(card) ? '<div class="stat-line">' + esc(api.statLine(card)) + '</div>' : '') +
        (info.requirement ? '<div class="requirement"><strong>Summon:</strong> ' + esc(info.requirement) + '</div>' : '') +
        descHtml +
        addBlock +
        '<section class="panel insight">' +
          '<h3>How to use it</h3>' +
          '<div class="chips">' + roleChips + '</div>' +
          '<ul class="tips">' + info.tips.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
          '<p class="muted small">Roles and tips are worked out automatically from the card text — use them as a starting point.</p>' +
        '</section>' +
        '<section class="panel">' +
          '<h3>Which deck it belongs to</h3>' +
          '<div class="kv"><span>Archetype</span><span>' + archetypeLink + '</span></div>' +
          mentions +
          (info.printedIn.length ? '<div class="kv"><span>Pre-built decks</span><span>' + info.printedIn.map((s) => '<a href="#/set/' + encodeURIComponent(s) + '" data-close-nav>' + esc(s) + '</a>').join(', ') + '</span></div>' : '') +
          '<div class="kv"><span>TCG release</span><span>' + esc(misc.tcg_date ? U.formatDate(misc.tcg_date) : 'Not released in TCG yet / unknown') + '</span></div>' +
          (misc.ocg_date ? '<div class="kv"><span>OCG release</span><span>' + esc(U.formatDate(misc.ocg_date)) + '</span></div>' : '') +
          (misc.formats ? '<div class="kv"><span>Formats</span><span>' + esc(misc.formats.join(', ')) + '</span></div>' : '') +
          (card.archetype ? '<div id="related" class="related">' + C.loading('Finding other ' + card.archetype + ' cards…') + '</div>' : '') +
        '</section>' +
        (setRows ? '<details class="panel"><summary>Printed in ' + U.plural(sets.length, 'set') + '</summary><table class="table"><thead><tr><th>Set</th><th>Code</th><th>Rarity</th></tr></thead><tbody>' + setRows + '</tbody></table></details>' : '') +
      '</div>' +
    '</div>';
  }

  function updateCount(card) {
    const sel = document.getElementById('detail-deck');
    const out = document.getElementById('detail-count');
    if (!sel || !out) return;
    const deck = App.decks.get(sel.value);
    if (!deck) return;
    const n = App.decks.countOf(deck, card.id);
    out.textContent = n ? n + ' in this deck' : '';
  }

  function wireCardDetail(card) {
    const body = document.getElementById('modal-body');
    updateCount(card);
    const sel = document.getElementById('detail-deck');
    if (sel) sel.addEventListener('change', () => { App.decks.setActive(sel.value); updateCount(card); });

    U.$$('[data-add]', body).forEach((btn) => btn.addEventListener('click', () => {
      const deck = App.decks.get(sel.value);
      if (!deck) return;
      const res = App.decks.addCard(deck, card, btn.getAttribute('data-add'));
      U.toast(res.message);
      updateCount(card);
      App.emit('deck-changed', deck.id);
    }));

    const nd = U.$('[data-new-deck]', body);
    if (nd) nd.addEventListener('click', () => {
      const deck = App.decks.create(card.archetype ? card.archetype + ' Deck' : 'My Deck');
      App.decks.addCard(deck, card, 'auto');
      C.closeModal();
      location.hash = '#/deck/' + deck.id;
    });

    U.$$('[data-close-nav]', body).forEach((a) => a.addEventListener('click', () => C.closeModal()));

    if (card.archetype) {
      api.getArchetypeCards(card.archetype).then((cards) => {
        const box = document.getElementById('related');
        if (!box) return;
        const others = cards.filter((c) => c.id !== card.id);
        App.decks.rememberMany(others.slice(0, 60));
        box.innerHTML = '<h4>Other ' + esc(card.archetype) + ' cards (' + others.length + ')</h4>' +
          '<div class="mini-grid">' + others.slice(0, 12).map((c) => C.cardTile(c)).join('') + '</div>' +
          (others.length > 12 ? '<a class="btn btn-small" href="#/archetype/' + encodeURIComponent(card.archetype) + '" data-close-nav>See all ' + others.length + '</a>' : '');
        U.$$('[data-close-nav]', box).forEach((a) => a.addEventListener('click', () => C.closeModal()));
      }).catch(() => {
        const box = document.getElementById('related');
        if (box) box.innerHTML = '';
      });
    }
  }

  App.C = C;
})(window.App);
