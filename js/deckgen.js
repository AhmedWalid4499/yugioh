/* Auto deck builder: type an archetype (e.g. "Lunalight") and get a ready
   deck for the chosen format. It scores every card of the archetype by the
   job it does (starter, searcher, extender, boss…), decides copies, then adds
   generic staples and Extra Deck options. Every pick comes with a reason. */
(function (App) {
  'use strict';

  const api = App.api;
  const F = App.formats;

  /* Generic cards per format: [name, copies, why]. Banlist limits are applied on top. */
  const STAPLES = {
    modern: [
      ['Ash Blossom & Joyous Spring', 3, 'Hand trap: stops searches, summons from the Deck and milling'],
      ['Infinite Impermanence', 3, 'Trap you can use from your hand to negate a monster'],
      ['Called by the Grave', 1, 'Answers GY effects and opposing hand traps'],
      ['Effect Veiler', 2, 'Hand trap: negates a monster during your opponent\'s Main Phase'],
      ['Triple Tactics Talent', 1, 'Punishes your opponent for using hand traps on you'],
      ['Forbidden Droplet', 2, 'Board breaker that negates several cards at once'],
      ['Nibiru, the Primal Being', 1, 'Stops long combos after 5 summons'],
      ['Droll & Lock Bird', 1, 'Hand trap against search-heavy decks'],
      ['Dark Ruler No More', 1, 'Board breaker: negates every monster your opponent controls'],
      ['Harpie\'s Feather Duster', 1, 'Clears your opponent\'s Spells and Traps']
    ],
    goat: [
      ['Pot of Greed', 1, 'Pure card advantage'],
      ['Graceful Charity', 1, 'Draws and fills the GY'],
      ['Delinquent Duo', 1, 'Strips two cards from your opponent\'s hand'],
      ['Heavy Storm', 1, 'Clears Spells and Traps'],
      ['Mystical Space Typhoon', 1, 'Quick Spell/Trap removal'],
      ['Snatch Steal', 1, 'Steals your opponent\'s best monster'],
      ['Premature Burial', 1, 'Revives your best monster'],
      ['Book of Moon', 1, 'Versatile quick-play: flips a monster face-down'],
      ['Scapegoat', 2, 'Defence and fusion material for Thousand-Eyes Restrict'],
      ['Metamorphosis', 1, 'Turns a token into Thousand-Eyes Restrict'],
      ['Nobleman of Crossout', 1, 'Removes a face-down monster'],
      ['Smashing Ground', 1, 'Destroys the highest-DEF monster'],
      ['Sangan', 1, 'Searches when it leaves the field'],
      ['Witch of the Black Forest', 1, 'Searches a defensive monster'],
      ['Breaker the Magical Warrior', 1, 'Destroys a Spell/Trap when summoned'],
      ['Tribe-Infecting Virus', 1, 'Repeatable monster removal'],
      ['The Exiled Force', 1, 'Destroys any monster'],
      ['Black Luster Soldier - Envoy of the Beginning', 1, 'Format-defining boss monster'],
      ['Chaos Sorcerer', 1, 'Banishes a face-up monster'],
      ['Airknight Parshath', 1, 'Piercing attacker that draws'],
      ['Torrential Tribute', 1, 'Board wipe on summon'],
      ['Mirror Force', 1, 'Destroys every attacking-position monster'],
      ['Call of the Haunted', 1, 'Revives a monster'],
      ['Ring of Destruction', 1, 'Removal plus damage'],
      ['Sakuretsu Armor', 2, 'Destroys an attacker']
    ],
    speed: [
      ['Mystical Space Typhoon', 1, 'Spell/Trap removal'],
      ['Monster Reborn', 1, 'Revives your best monster'],
      ['Mirror Force', 1, 'Punishes attacks'],
      ['Pot of Greed', 1, 'Card advantage']
    ]
  };

  const EXTRA_STAPLES = {
    modern: [
      ['S:P Little Knight', 'link', 'Generic Link-2 that banishes a threat'],
      ['I:P Masquerena', 'link', 'Generic Link-2 that can Link Summon on your opponent\'s turn'],
      ['Knightmare Unicorn', 'link', 'Generic Link-3 that spins a card back to the Deck'],
      ['Underworld Goddess of the Closed World', 'link', 'Board breaker that uses your opponent\'s monsters as material'],
      ['Accesscode Talker', 'link', 'Generic finisher with repeatable destruction'],
      ['Baronne de Fleur', 'synchro', 'Level 10 Synchro with a negate'],
      ['Divine Arsenal AA-ZEUS - Sky Thunder', 'xyz', 'Rank 12 that wipes the field (made from any Xyz)']
    ],
    goat: [
      ['Thousand-Eyes Restrict', 'fusion', 'Made with Scapegoat + Metamorphosis; steals monsters'],
      ['Gatling Dragon', 'fusion', 'Metamorphosis target with removal'],
      ['Dark Balter the Terrible', 'fusion', 'Metamorphosis target that negates'],
      ['Ryu Senshi', 'fusion', 'Metamorphosis target that negates traps']
    ],
    speed: []
  };

  function stapleSet(key) { return key === 'goat' ? 'goat' : key === 'speed' ? 'speed' : 'modern'; }

  function score(card, info, pool) {
    const r = info.roleKeys;
    let s = 1;
    if (r.indexOf('starter') !== -1) s += 6;
    if (r.indexOf('searcher') !== -1) s += 4;
    if (r.indexOf('extender') !== -1) s += 3;
    if (r.indexOf('negate') !== -1) s += 2;
    if (r.indexOf('removal') !== -1) s += 2;
    if (r.indexOf('recursion') !== -1) s += 1;
    if (r.indexOf('draw') !== -1) s += 1;
    if (r.indexOf('mill') !== -1) s += 1;
    if (r.indexOf('protection') !== -1) s += 1;
    if (r.indexOf('boss') !== -1) s += 2;
    const desc = String(card.desc || '');
    const kind = api.kind(card);
    if (kind === 'spell' && /Field/.test(card.race || '')) s += 3;
    if (kind === 'spell' && /fusion summon/i.test(desc) && pool.some((c) => /Fusion/i.test(c.type))) s += 4;
    if (kind === 'spell' && /ritual summon/i.test(desc) && pool.some((c) => /Ritual/i.test(c.type) && api.kind(c) === 'monster')) s += 4;
    if (card.archetype && desc.indexOf('"' + card.archetype) !== -1) s += 1;
    if (r.indexOf('vanilla') !== -1) s -= 1;
    if (kind === 'monster' && !api.isExtraDeck(card) && Number(card.level) >= 7 && !/special summon this card/i.test(desc)) s -= 2;
    return s;
  }

  function reasonFor(info, card) {
    const labels = info.roles.map((r) => r.label).filter((l) => l !== 'Tuner' || /Tuner/.test(card.type));
    if (/Field/.test(card.race || '') && api.kind(card) === 'spell') labels.unshift('Field Spell');
    if (/fusion summon/i.test(card.desc || '') && api.kind(card) === 'spell') labels.unshift('Fusion enabler');
    return labels.length ? labels.slice(0, 3).join(' · ') : 'Archetype support';
  }

  function matchArchetype(input, list) {
    const q = String(input || '').trim().toLowerCase();
    if (!q) return null;
    return list.find((a) => a.toLowerCase() === q) ||
      list.find((a) => a.toLowerCase().startsWith(q)) ||
      list.find((a) => a.toLowerCase().indexOf(q) !== -1) || null;
  }

  /* opts: { format: 'tcg'|'ocg'|'speed'|'goat', staples: true|false } */
  async function build(input, opts) {
    const o = Object.assign({ format: 'tcg', staples: true }, opts || {});
    const fmt = F.get(o.format);
    let archetypes = [];
    try { archetypes = await api.getArchetypes(); } catch (e) { /* offline list */ }
    const name = matchArchetype(input, archetypes) || String(input || '').trim();
    if (!name) throw new Error('Type an archetype name, for example "Lunalight".');

    const needMisc = fmt.key === 'goat' || fmt.key === 'speed';
    let cards = await api.getArchetypeCards(name, { misc: needMisc });
    if (!cards.length) {
      const res = await api.searchCards({ q: name }, 0, 60);
      cards = res.cards;
    }
    if (!cards.length) throw new Error('No cards found for "' + input + '". Try the exact archetype name.');
    App.decks.rememberMany(cards);

    const pool = cards.filter((c) => ['skill', 'token'].indexOf(api.kind(c)) === -1 && F.copyLimit(c, fmt.key) > 0);
    const skipped = cards.length - pool.length;
    const scored = pool.map((c) => {
      const info = App.insights.analyse(c);
      return { card: c, info: info, score: score(c, info, pool) };
    }).sort((a, b) => b.score - a.score || String(a.card.name).localeCompare(b.card.name));

    const target = fmt.main[0];
    const stapleSlots = o.staples ? (fmt.key === 'goat' ? 14 : fmt.key === 'speed' ? 3 : 10) : 0;
    const picks = [];
    const add = (card, copies, zone, reason, generic) => {
      const limit = F.copyLimit(card, fmt.key);
      const n = Math.min(copies, limit);
      if (n <= 0) return 0;
      const existing = picks.find((p) => p.card.id === card.id);
      if (existing) { const extra = Math.min(n, limit - existing.copies); existing.copies += extra; return extra; }
      picks.push({ card: card, copies: n, zone: zone, reason: reason, generic: !!generic });
      return n;
    };
    const count = (zone) => picks.filter((p) => p.zone === zone).reduce((n, p) => n + p.copies, 0);

    // 1. The archetype engine.
    const mains = scored.filter((x) => !api.isExtraDeck(x.card));
    const engineTarget = target - stapleSlots;
    for (const x of mains) {
      if (count('main') >= engineTarget) break;
      const want = x.score >= 8 ? 3 : x.score >= 5 ? 2 : 1;
      add(x.card, Math.min(want, engineTarget - count('main')), 'main', reasonFor(x.info, x.card));
    }

    // 2. Generic staples for the format.
    const notes = [];
    if (o.staples || count('main') < target) {
      const list = STAPLES[stapleSet(fmt.key)];
      try {
        const found = await api.getCardsByNames(list.map((s) => s[0]), { misc: needMisc });
        App.decks.rememberMany(Object.keys(found).map((k) => found[k]));
        for (const [n, copies, why] of list) {
          if (count('main') >= target) break;
          const card = found[api.normName(n)];
          if (!card) continue;
          add(card, Math.min(copies, target - count('main')), 'main', why, true);
        }
      } catch (e) {
        notes.push('Generic staples could not be loaded (' + e.message + ').');
      }
    }

    // 3. Still short? Add more copies of the best archetype cards.
    for (const x of mains) {
      if (count('main') >= target) break;
      add(x.card, target - count('main'), 'main', reasonFor(x.info, x.card));
    }
    if (count('main') < target) notes.push('Only ' + count('main') + ' cards could be found for the Main Deck — add ' + (target - count('main')) + ' more by hand.');

    // 4. Extra Deck: archetype monsters first, then generic options.
    const extras = scored.filter((x) => api.isExtraDeck(x.card));
    for (const x of extras) {
      if (count('extra') >= fmt.extra) break;
      add(x.card, x.score >= 8 && fmt.extra - count('extra') > 3 ? 2 : 1, 'extra', reasonFor(x.info, x.card) || 'Archetype Extra Deck monster');
    }
    const hasTuner = pool.some((c) => /Tuner/.test(c.type));
    const level4s = pool.filter((c) => Number(c.level) === 4 && !api.isExtraDeck(c)).length;
    const extraList = EXTRA_STAPLES[stapleSet(fmt.key)].filter(([, kind]) =>
      (kind !== 'synchro' || hasTuner) && (kind !== 'xyz' || level4s >= 3 || extras.some((x) => /XYZ/i.test(x.card.type))) &&
      (kind !== 'fusion' || fmt.key === 'goat'));
    if (count('extra') < fmt.extra && extraList.length) {
      try {
        const found = await api.getCardsByNames(extraList.map((s) => s[0]), { misc: needMisc });
        App.decks.rememberMany(Object.keys(found).map((k) => found[k]));
        for (const [n, , why] of extraList) {
          if (count('extra') >= fmt.extra) break;
          const card = found[api.normName(n)];
          if (card) add(card, 1, 'extra', why, true);
        }
      } catch (e) { /* optional */ }
    }

    const ids = (zone) => {
      const out = [];
      picks.filter((p) => p.zone === zone).forEach((p) => { for (let i = 0; i < p.copies; i++) out.push(p.card.id); });
      return out;
    };
    const starters = picks.filter((p) => !p.generic && /Starter/.test(p.reason)).map((p) => p.card.name);
    const bosses = picks.filter((p) => /Boss/.test(p.reason)).map((p) => p.card.name);
    if (skipped) notes.push(skipped + ' archetype card' + (skipped === 1 ? ' was' : 's were') + ' left out because ' + (skipped === 1 ? 'it isn\'t' : 'they aren\'t') + ' allowed in ' + fmt.label + '.');

    return {
      archetype: name,
      format: fmt.key,
      name: name + ' (auto-built)',
      main: ids('main'),
      extra: ids('extra'),
      side: [],
      picks: picks,
      starters: starters,
      bosses: bosses,
      notes: notes
    };
  }

  App.deckgen = { build: build, matchArchetype: matchArchetype, STAPLES: STAPLES };
})(window.App);
