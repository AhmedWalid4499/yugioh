/* Deck storage, validation and YDK import/export. Decks live in this
   browser's localStorage; export to .ydk to back them up or move them. */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const DECKS_KEY = 'dv-decks';
  const CARDS_KEY = 'dv-card-cache';
  const ACTIVE_KEY = 'dv-active-deck';

  /* Compact copy of each card used in a deck, so decks render without refetching. */
  let cardCache = U.store.get(CARDS_KEY, {});

  function slim(card) {
    return {
      id: card.id,
      name: card.name,
      type: card.type,
      frameType: card.frameType,
      race: card.race,
      attribute: card.attribute,
      archetype: card.archetype,
      level: card.level,
      atk: card.atk,
      def: card.def,
      scale: card.scale,
      linkval: card.linkval,
      linkmarkers: card.linkmarkers,
      desc: card.desc,
      typeline: card.typeline,
      banlist_info: card.banlist_info,
      misc_info: card.misc_info && card.misc_info[0] && card.misc_info[0].formats ? [{ formats: card.misc_info[0].formats }] : undefined,
      card_images: (card.card_images || []).slice(0, 1).map((i) => ({
        id: i.id, image_url: i.image_url, image_url_small: i.image_url_small
      }))
    };
  }

  function remember(card) {
    if (!card || card.id == null) return;
    cardCache[card.id] = slim(card);
    U.store.set(CARDS_KEY, cardCache);
  }

  function rememberMany(cards) {
    cards.forEach((c) => { if (c && c.id != null) cardCache[c.id] = slim(c); });
    U.store.set(CARDS_KEY, cardCache);
  }

  function cached(id) {
    return cardCache[id] || null;
  }

  function all() {
    return U.store.get(DECKS_KEY, []);
  }

  function saveAll(list) {
    if (!U.store.set(DECKS_KEY, list)) U.toast('Could not save — browser storage is full or blocked.');
  }

  function get(id) {
    return all().find((d) => d.id === id) || null;
  }

  function save(deck) {
    const list = all();
    deck.updated = Date.now();
    const i = list.findIndex((d) => d.id === deck.id);
    if (i === -1) list.unshift(deck); else list[i] = deck;
    saveAll(list);
    return deck;
  }

  function create(name, parts, format) {
    const deck = {
      id: U.uid(),
      name: name || 'New Deck',
      format: format || U.store.get('dv-default-format', 'tcg'),
      notes: '',
      created: Date.now(),
      updated: Date.now(),
      main: (parts && parts.main) || [],
      extra: (parts && parts.extra) || [],
      side: (parts && parts.side) || []
    };
    save(deck);
    setActive(deck.id);
    return deck;
  }

  function remove(id) {
    saveAll(all().filter((d) => d.id !== id));
    if (getActive() === id) U.store.remove(ACTIVE_KEY);
  }

  function duplicate(id) {
    const src = get(id);
    if (!src) return null;
    return create(src.name + ' (copy)', { main: src.main.slice(), extra: src.extra.slice(), side: src.side.slice() }, src.format);
  }

  function setActive(id) { U.store.set(ACTIVE_KEY, id); }
  function getActive() {
    const id = U.store.get(ACTIVE_KEY, null);
    return id && get(id) ? id : null;
  }

  function countOf(deck, id) {
    id = Number(id);
    return ['main', 'extra', 'side'].reduce((n, z) => n + deck[z].filter((x) => Number(x) === id).length, 0);
  }

  const ZONE_MAX = { main: 60, extra: 15, side: 15 };

  function fmt(deck) { return App.formats.get(deck && deck.format); }
  function zoneMax(deck, z) {
    const f = fmt(deck);
    return z === 'main' ? f.main[1] : z === 'extra' ? f.extra : f.side;
  }

  /* Adds a card. zone 'auto' sends Extra Deck monsters to the Extra Deck.
     Returns { ok, zone, message }. */
  function addCard(deck, card, zone) {
    remember(card);
    let z = zone || 'auto';
    if (z === 'auto' || z === 'main') z = api.isExtraDeck(card) ? 'extra' : 'main';
    if (zone === 'side') z = 'side';
    const f = fmt(deck);
    const limit = api.copyLimit(card, f.key);
    const have = countOf(deck, card.id);
    if (limit === 0) {
      return { ok: false, message: card.name + (App.formats.cardAllowed(card, f.key) ? ' is Forbidden in ' : ' is not allowed in ') + f.label + '.' };
    }
    if (have >= limit) return { ok: false, message: 'You already have the maximum ' + limit + ' cop' + (limit === 1 ? 'y' : 'ies') + ' of ' + card.name + '.' };
    if (deck[z].length >= zoneMax(deck, z)) return { ok: false, message: 'Your ' + zoneName(z) + ' is full (' + zoneMax(deck, z) + ').' };
    deck[z].push(card.id);
    save(deck);
    return { ok: true, zone: z, message: 'Added ' + card.name + ' to ' + zoneName(z) + '.' };
  }

  function removeCard(deck, id, zone) {
    const i = deck[zone].findIndex((x) => Number(x) === Number(id));
    if (i !== -1) {
      deck[zone].splice(i, 1);
      save(deck);
    }
  }

  function moveCard(deck, id, from, to) {
    const card = cached(id);
    if (to !== 'side' && card) to = api.isExtraDeck(card) ? 'extra' : 'main';
    if (deck[to].length >= zoneMax(deck, to)) return { ok: false, message: 'Your ' + zoneName(to) + ' is full.' };
    const i = deck[from].findIndex((x) => Number(x) === Number(id));
    if (i === -1) return { ok: false };
    deck[from].splice(i, 1);
    deck[to].push(Number(id));
    save(deck);
    return { ok: true };
  }

  function zoneName(z) {
    return z === 'main' ? 'Main Deck' : z === 'extra' ? 'Extra Deck' : 'Side Deck';
  }

  /* Legality check against the deck's format (TCG Advanced by default). */
  function validate(deck) {
    const problems = [];
    const f = fmt(deck);
    if (deck.main.length < f.main[0]) problems.push('Main Deck needs at least ' + f.main[0] + ' cards (has ' + deck.main.length + ').');
    if (deck.main.length > f.main[1]) problems.push('Main Deck can have at most ' + f.main[1] + ' cards in ' + f.label + '.');
    if (deck.extra.length > f.extra) problems.push('Extra Deck can have at most ' + f.extra + ' cards in ' + f.label + '.');
    if (deck.side.length > f.side) problems.push('Side Deck can have at most ' + f.side + ' cards in ' + f.label + '.');
    const seen = {};
    ['main', 'extra', 'side'].forEach((z) => deck[z].forEach((id) => { seen[id] = (seen[id] || 0) + 1; }));
    Object.keys(seen).forEach((id) => {
      const card = cached(id);
      if (!card) return;
      const limit = api.copyLimit(card, f.key);
      if (limit === 0 && !App.formats.cardAllowed(card, f.key)) {
        problems.push(card.name + ' is not allowed in ' + f.label + '.');
      } else if (seen[id] > limit) {
        problems.push(card.name + ': ' + seen[id] + ' copies, but the ' + f.label + ' banlist allows ' + limit + '.');
      }
      if (deck.main.some((x) => Number(x) === Number(id)) && api.isExtraDeck(card)) {
        problems.push(card.name + ' is an Extra Deck monster and cannot be in the Main Deck.');
      }
    });
    return problems;
  }

  /* ---- YDK format (used by YGOPRODeck, EDOPro, Dueling Book, etc.) ---- */

  function toYdk(deck) {
    return ['#created by Duel Vault', '#main']
      .concat(deck.main.map(String), ['#extra'], deck.extra.map(String), ['!side'], deck.side.map(String))
      .join('\n') + '\n';
  }

  function parseYdk(textIn) {
    const out = { main: [], extra: [], side: [] };
    let zone = 'main';
    String(textIn || '').split(/\r?\n/).forEach((line) => {
      const l = line.trim();
      if (!l) return;
      if (/^#main/i.test(l)) { zone = 'main'; return; }
      if (/^#extra/i.test(l)) { zone = 'extra'; return; }
      if (/^!side/i.test(l)) { zone = 'side'; return; }
      if (l[0] === '#' || l[0] === '!') return;
      const m = /^(\d{3,10})/.exec(l);
      if (m) out[zone].push(Number(m[1]));
    });
    return out;
  }

  /* Creates a deck from YDK text, fetching card details for unknown ids. */
  async function importYdk(name, ydkText) {
    const parts = parseYdk(ydkText);
    const ids = parts.main.concat(parts.extra, parts.side);
    if (!ids.length) throw new Error('No card ids found. A .ydk file has lines like "#main" followed by card numbers.');
    const missing = ids.filter((id) => !cached(id));
    let unknown = [];
    if (missing.length) {
      const cards = await api.getCardsByIds(missing);
      rememberMany(cards);
      // Alternate artworks have their own ids; map them to the card they belong to.
      cards.forEach((c) => (c.card_images || []).forEach((img) => {
        if (img.id !== c.id) cardCache[img.id] = cardCache[c.id];
      }));
      U.store.set(CARDS_KEY, cardCache);
      unknown = Array.from(new Set(missing.filter((id) => !cached(id))));
    }
    const fix = (list) => list.filter((id) => cached(id)).map((id) => cached(id).id);
    const deck = create(name, { main: fix(parts.main), extra: fix(parts.extra), side: fix(parts.side) });
    return { deck: deck, unknown: unknown };
  }

  App.decks = {
    all, get, save, create, remove, duplicate, setActive, getActive,
    addCard, removeCard, moveCard, countOf, validate, toYdk, parseYdk, importYdk,
    remember, rememberMany, cached, zoneName, ZONE_MAX, zoneMax
  };
})(window.App);
