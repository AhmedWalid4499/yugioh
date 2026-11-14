/* Thin client for the free YGOPRODeck API (https://ygoprodeck.com/api-guide/).
   - Results are memoised per page load.
   - The big, slow-changing lists (sets, archetypes) are cached in localStorage
     so the API is not hammered (they ask for <20 requests/second and for
     data to be cached locally). */
(function (App) {
  'use strict';

  const U = App.U;
  const BASE = 'https://db.ygoprodeck.com/api/v7/';
  const HOUR = 3600 * 1000;
  const memo = new Map();

  function buildUrl(endpoint, params) {
    const qs = new URLSearchParams();
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return BASE + endpoint + (q ? '?' + q : '');
  }

  function request(endpoint, params, opts) {
    const ttl = (opts && opts.ttl) || 0;
    const url = buildUrl(endpoint, params);
    if (memo.has(url)) return memo.get(url);

    if (ttl) {
      const cached = U.store.get('dv-cache:' + url, null);
      if (cached && Date.now() - cached.t < ttl) {
        const p = Promise.resolve(cached.d);
        memo.set(url, p);
        return p;
      }
    }

    const p = fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || (body && body.error)) {
          const msg = (body && body.error) || ('Request failed (HTTP ' + res.status + ')');
          // "No card matching your query" is just an empty result, not a failure.
          if (/no card matching/i.test(msg)) return { data: [], meta: { total_rows: 0 } };
          throw new Error(msg);
        }
        return body;
      })
      .catch((err) => {
        memo.delete(url);
        if (err instanceof TypeError) {
          throw new Error('Could not reach the card database. Check your internet connection and try again.');
        }
        throw err;
      });

    memo.set(url, p);
    if (ttl) p.then((d) => U.store.set('dv-cache:' + url, { t: Date.now(), d: d })).catch(() => {});
    return p;
  }

  const api = {};

  /* Paged card search. Returns { cards, total, nextOffset }. */
  api.searchCards = async function (filters, offset, pageSize) {
    const f = filters || {};
    const params = {
      fname: f.q,
      type: f.type,
      race: f.race,
      attribute: f.attribute,
      level: f.level,
      archetype: f.archetype,
      banlist: f.banlist,
      format: f.format,
      sort: f.sort || (f.q ? 'name' : 'new'),
      num: pageSize || 30,
      offset: offset || 0
    };
    const res = await request('cardinfo.php', params);
    const meta = res.meta || {};
    const cards = res.data || [];
    return {
      cards: cards,
      total: meta.total_rows != null ? meta.total_rows : cards.length,
      nextOffset: meta.next_page_offset != null ? meta.next_page_offset : null
    };
  };

  /* Full card record, including misc_info (release dates, formats, popularity). */
  api.getCard = async function (id) {
    const res = await request('cardinfo.php', { id: id, misc: 'yes' });
    const card = (res.data || [])[0];
    if (!card) throw new Error('Card not found.');
    return card;
  };

  /* Many cards by id (used when importing decks). Unknown ids are skipped. */
  api.getCardsByIds = async function (ids) {
    const unique = Array.from(new Set(ids.map(String))).filter(Boolean);
    const out = [];
    for (let i = 0; i < unique.length; i += 50) {
      const chunk = unique.slice(i, i + 50);
      try {
        const res = await request('cardinfo.php', { id: chunk.join(',') });
        out.push.apply(out, res.data || []);
      } catch (e) {
        // One bad id makes the whole batch fail — fall back to one by one.
        for (const id of chunk) {
          try {
            const res = await request('cardinfo.php', { id: id });
            out.push.apply(out, res.data || []);
          } catch (e2) { /* unknown id */ }
        }
      }
    }
    return out;
  };

  function normName(s) {
    return String(s || '').toLowerCase().replace(/[“”″]/g, '"').replace(/[‘’]/g, "'").replace(/[^a-z0-9]+/g, '');
  }

  /* Looks up cards by name (as typed in a spreadsheet). Returns an object
     keyed by the normalised input name. Tries exact names in batches first,
     then a fuzzy search for anything left over. */
  api.getCardsByNames = async function (names) {
    const unique = Array.from(new Set(names.map((n) => String(n).trim()).filter(Boolean)));
    const found = {};
    const want = new Set(unique.map(normName));
    const take = (card) => {
      const k = normName(card.name);
      if (want.has(k) && !found[k]) found[k] = card;
    };

    for (let i = 0; i < unique.length; i += 20) {
      const chunk = unique.slice(i, i + 20);
      try {
        const res = await request('cardinfo.php', { name: chunk.join('|') });
        (res.data || []).forEach(take);
      } catch (e) { /* fall through to one-by-one */ }
    }

    for (const n of unique) {
      const k = normName(n);
      if (found[k]) continue;
      try {
        const res = await request('cardinfo.php', { fname: n });
        const list = res.data || [];
        list.forEach(take);
        if (!found[k] && list.length) {
          // Closest match: the shortest name that contains what was typed.
          const hit = list.filter((c) => normName(c.name).indexOf(k) !== -1)
            .sort((a, b) => a.name.length - b.name.length)[0];
          if (hit) found[k] = hit;
        }
      } catch (e) { /* not found */ }
    }
    return found;
  };

  api.normName = normName;

  api.getArchetypeCards = async function (name) {
    const res = await request('cardinfo.php', { archetype: name });
    return res.data || [];
  };

  api.getSetCards = async function (setName) {
    const res = await request('cardinfo.php', { cardset: setName });
    return res.data || [];
  };

  /* Cards first released (TCG) between two YYYY-MM-DD dates, newest first. */
  api.getCardsReleasedBetween = async function (start, end) {
    const res = await request('cardinfo.php', {
      startdate: start, enddate: end, dateregion: 'tcg_date', sort: 'new'
    });
    return res.data || [];
  };

  api.getArchetypes = async function () {
    const res = await request('archetypes.php', {}, { ttl: 24 * HOUR });
    return (res || []).map((a) => a.archetype_name).filter(Boolean).sort((a, b) => a.localeCompare(b));
  };

  api.getSets = async function () {
    const res = await request('cardsets.php', {}, { ttl: 12 * HOUR });
    return res || [];
  };

  api.clearCache = function () {
    memo.clear();
    try {
      Object.keys(localStorage).filter((k) => k.indexOf('dv-cache:') === 0)
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  };

  /* ---- Card helpers shared across views ---- */

  const EXTRA_FRAMES = ['fusion', 'synchro', 'xyz', 'link', 'fusion_pendulum', 'synchro_pendulum', 'xyz_pendulum'];

  api.isExtraDeck = function (card) {
    if (!card) return false;
    if (card.frameType && EXTRA_FRAMES.indexOf(card.frameType) !== -1) return true;
    return /\b(Fusion|Synchro|XYZ|Link)\b/i.test(card.type || '');
  };

  api.kind = function (card) {
    const t = (card && card.type) || '';
    if (/Spell/i.test(t)) return 'spell';
    if (/Trap/i.test(t)) return 'trap';
    if (/Skill/i.test(t)) return 'skill';
    if (/Token/i.test(t)) return 'token';
    return 'monster';
  };

  /* Max copies allowed under the current TCG banlist. */
  api.copyLimit = function (card) {
    const ban = card && card.banlist_info && card.banlist_info.ban_tcg;
    if (ban === 'Banned' || ban === 'Forbidden') return 0;
    if (ban === 'Limited') return 1;
    if (ban === 'Semi-Limited') return 2;
    return 3;
  };

  api.image = function (card, size) {
    const img = card && card.card_images && card.card_images[0];
    if (!img) return '';
    if (size === 'large') return img.image_url;
    if (size === 'cropped') return img.image_url_cropped;
    return img.image_url_small || img.image_url;
  };

  /* "Spellcaster / Effect", "Quick-Play Spell", etc. */
  api.typeLine = function (card) {
    if (!card) return '';
    if (Array.isArray(card.typeline) && card.typeline.length) return card.typeline.join(' / ');
    const k = api.kind(card);
    if (k === 'spell' || k === 'trap') return (card.race && card.race !== 'Normal' ? card.race + ' ' : 'Normal ') + (k === 'spell' ? 'Spell' : 'Trap');
    return [card.race, card.type].filter(Boolean).join(' / ');
  };

  api.statLine = function (card) {
    if (!card || api.kind(card) !== 'monster') return '';
    const parts = [];
    if (card.attribute) parts.push(card.attribute);
    if (/Link/i.test(card.type)) parts.push('Link-' + (card.linkval || '?'));
    else if (/XYZ/i.test(card.type)) parts.push('Rank ' + card.level);
    else if (card.level != null) parts.push('Level ' + card.level);
    if (card.scale != null) parts.push('Scale ' + card.scale);
    const atk = card.atk == null ? '?' : card.atk;
    if (/Link/i.test(card.type)) parts.push('ATK ' + atk);
    else parts.push('ATK ' + atk + ' / DEF ' + (card.def == null ? '?' : card.def));
    return parts.join(' · ');
  };

  App.api = api;
})(window.App);
