/* Card "insights": reads a card's effect text and works out what job it does
   in a deck (starter, extender, hand trap, removal…), which strategy it
   belongs to, and practical tips for using it. This is rule-based text
   analysis — a strong hint, not gospel — so the UI always shows the real
   card text next to it. */
(function (App) {
  'use strict';

  const api = App.api;

  const ROLES = {
    handtrap: { label: 'Hand Trap', desc: 'Used from your hand during your opponent\'s turn to disrupt their plays. Fits almost any main deck.' },
    starter: { label: 'Starter', desc: 'Can begin your combo on its own by searching or summoning from the Deck.' },
    searcher: { label: 'Searcher', desc: 'Adds cards from your Deck to your hand — improves consistency.' },
    extender: { label: 'Extender', desc: 'Special Summons itself or others, letting you keep going after your first play is stopped.' },
    negate: { label: 'Negation', desc: 'Stops an opponent\'s card or effect.' },
    removal: { label: 'Removal', desc: 'Gets rid of your opponent\'s cards (destroy, banish, bounce or shuffle).' },
    draw: { label: 'Draw Power', desc: 'Draws extra cards.' },
    recursion: { label: 'Recursion', desc: 'Re-uses cards from the GY or banishment.' },
    mill: { label: 'GY Setup', desc: 'Sends cards from your Deck to the GY to fuel GY effects.' },
    floodgate: { label: 'Floodgate', desc: 'Restricts what players can do while it stays on the field.' },
    protection: { label: 'Protection', desc: 'Keeps your cards safe from destruction, targeting or effects.' },
    boss: { label: 'Boss Monster', desc: 'A finisher or end-board monster you aim to summon.' },
    burn: { label: 'Burn', desc: 'Inflicts effect damage directly to Life Points.' },
    tuner: { label: 'Tuner', desc: 'Needed as material for Synchro Summons.' },
    vanilla: { label: 'Normal Monster', desc: 'No effect; usually supported by specific cards or archetypes.' }
  };

  function text(card) {
    return String((card && card.desc) || '').replace(/\r/g, '');
  }

  /* Effect text of a Pendulum card is split into a pendulum part and a monster part. */
  function splitPendulum(desc) {
    const m = /\[\s*Pendulum Effect\s*\]([\s\S]*?)(?:-{5,}|\n)\s*\[\s*(?:Monster Effect|Flavor Text)\s*\]([\s\S]*)/i.exec(desc);
    if (!m) return null;
    return { pendulum: m[1].trim(), monster: m[2].trim() };
  }

  function quotedNames(desc, ownName) {
    const found = new Set();
    const re = /"([^"]{2,60})"/g;
    let m;
    while ((m = re.exec(desc))) {
      const name = m[1].trim();
      if (name && name !== ownName) found.add(name);
    }
    return Array.from(found);
  }

  /* First line of an Extra Deck / Ritual monster usually lists its materials. */
  function summonRequirement(card, desc) {
    if (!api.isExtraDeck(card)) return null;
    const first = desc.split('\n')[0].trim();
    if (first && first.length < 220 && /(\+|monster|Tuner|material|Level|"[^"]+")/i.test(first) && !/^You can|^If|^When|^Once per turn/i.test(first)) {
      return first;
    }
    return null;
  }

  function analyse(card) {
    const desc = text(card);
    const pend = splitPendulum(desc);
    const body = pend ? pend.monster + '\n' + pend.pendulum : desc;
    const t = body.toLowerCase();
    const type = String(card.type || '');
    const kind = api.kind(card);
    const roles = new Set();

    // --- Role detection ---
    const fromHand = /(discard this card|send this card from your hand|reveal this card in your hand|banish this card from your hand|special summon this card from your hand)/i.test(body);
    const oppTurn = /(quick effect|during your opponent's|your opponent (activates|normal|special|adds|sends)|when (a|your opponent|an opponent)|if your opponent)/i.test(body);
    if (kind === 'monster' && fromHand && oppTurn && !/during your main phase: you can (discard|send) this card/i.test(body)) roles.add('handtrap');
    if (kind === 'trap' && /(if you control no cards|you can activate this card from your hand)/i.test(body)) roles.add('handtrap');

    const searches = /add (?:1|one|2|two|up to \d)?[^.]{0,120}?from your deck to your hand/i.test(body) ||
      /add[^.]{0,80}from your deck[^.]{0,40}to your hand/i.test(body);
    if (searches) roles.add('searcher');

    const summonsFromDeck = /special summon[^.]{0,120}?from your deck/i.test(body);
    if (!api.isExtraDeck(card) && !roles.has('handtrap') && (searches || summonsFromDeck) && kind !== 'trap') roles.add('starter');

    const selfSummon = /special summon this card(?! from your extra deck)[^.]{0,40}(from your (hand|gy|graveyard))?/i.test(body) ||
      /you can special summon this card/i.test(body);
    if (kind === 'monster' && !api.isExtraDeck(card) && (selfSummon || /special summon (?:1|one|up to \d)[^.]{0,80}from your (hand|gy)/i.test(body))) roles.add('extender');

    if (/\bnegate\b/i.test(body)) roles.add('negate');

    if (/(destroy|banish|return|shuffle|send|tribute|take control)[^.]{0,100}(your opponent controls|your opponent's|opponent's field|on the field|cards? on your opponent's)/i.test(body) ||
        /(destroy|banish) (all|that|it|that target|those)/i.test(body) && !/destroy this card/i.test(body)) {
      roles.add('removal');
    }

    if (/\bdraw (?:1|2|3|one|two|three|a|cards?|until)\b/i.test(body)) roles.add('draw');
    if (/(from your (gy|graveyard)|banished (cards?|monsters?)?[^.]{0,40}(to your hand|special summon))[^.]{0,60}(to your hand|special summon|set)/i.test(body) ||
        /(add|special summon|set)[^.]{0,80}from your (gy|graveyard)/i.test(body)) roles.add('recursion');
    if (/send[^.]{0,80}from your deck to the (gy|graveyard)/i.test(body)) roles.add('mill');
    if (/(neither player can|your opponent cannot|players cannot|monsters your opponent controls cannot|cannot (special summon|activate))/i.test(body) && kind !== 'monster' || /neither player can/i.test(body)) roles.add('floodgate');
    if (/(cannot be destroyed|cannot be targeted|unaffected by)/i.test(body)) roles.add('protection');
    if (/inflict[^.]{0,40}damage to your opponent/i.test(body) && !/battle damage/i.test(body)) roles.add('burn');
    if (/Tuner/.test(type)) roles.add('tuner');
    if (/Normal Monster/i.test(type) && !/Pendulum/i.test(type)) roles.add('vanilla');

    const atk = Number(card.atk) || 0;
    if (kind === 'monster' && (api.isExtraDeck(card) || atk >= 2800) && (roles.has('negate') || roles.has('removal') || roles.has('protection') || atk >= 3000)) roles.add('boss');

    // --- Strategy / archetype fit ---
    const mentions = quotedNames(desc, card.name);
    const archetypeMentions = mentions.filter((n) => !/^[A-Z][\w\s'-]*\s(Token)$/.test(n));
    const generic = !card.archetype && archetypeMentions.length === 0 &&
      !/(Fusion Spell|Ritual Spell)/i.test(body);

    // --- Tips ---
    const tips = [];
    const sets = (card.card_sets || []).map((s) => s.set_name);
    const structureDecks = Array.from(new Set(sets.filter((s) => /structure deck|starter deck|deck build pack|speed duel/i.test(s))));

    if (roles.has('handtrap')) tips.push('Hand traps are "generic": they go in the Main Deck of nearly any strategy. Most players run 2–3 copies of the best ones and side the rest in against specific decks.');
    if (roles.has('starter')) tips.push('Starters make your deck consistent — run 3 copies if the banlist allows, and count it when checking your opening-hand odds in the deck builder.');
    else if (roles.has('searcher')) tips.push('Searchers effectively count as extra copies of whatever they can fetch. Prioritise them over cards that only do one thing.');
    if (roles.has('extender')) tips.push('Extenders shine as your second play: keep one in hand so you can keep going if a hand trap stops your starter.');
    if (roles.has('negate') && kind === 'monster' && !roles.has('handtrap')) tips.push('A monster negate is best summoned on your turn as part of your end board, so it can stop your opponent\'s key play.');
    if (roles.has('negate') && kind === 'trap') tips.push('Set it on your turn and hold it until your opponent commits a key card — timing matters more than speed.');
    if (roles.has('removal') && !roles.has('negate')) tips.push('Removal is your "board breaker": keep it for your opponent\'s strongest monster or continuous card, not the first thing they play.');
    if (roles.has('floodgate')) tips.push('Floodgates can lock out whole decks — check that the restriction doesn\'t hurt your own strategy before including it.');
    if (roles.has('mill')) tips.push('GY setup cards work best in decks with effects that trigger when sent to the GY or that summon from the GY.');
    if (roles.has('draw')) tips.push('Read the cost carefully: many draw cards restrict your Extra Deck or Special Summons for the turn.');
    if (roles.has('tuner')) tips.push('Tuners let you Synchro Summon: add the Tuner\'s level to a non-Tuner\'s level to see which Synchro monsters you can make.');
    if (roles.has('vanilla')) tips.push('Normal Monsters are easy to search and revive with Normal-Monster support cards; check its archetype for dedicated support.');

    if (/once per turn/i.test(body) && /you can only (use|activate)/i.test(body) && !roles.has('handtrap') && !roles.has('starter')) {
      tips.push('Hard once per turn (OPT): extra copies won\'t give extra uses in the same turn — 1–2 copies may be enough unless it\'s a starter.');
    }
    if (/\(quick effect\)/i.test(body)) tips.push('It has a Quick Effect, so it can respond during either player\'s turn.');
    if (/you cannot special summon[^.]{0,80}except/i.test(body)) tips.push('Using it locks your Special Summons for the turn — sequence it after your other summons, or only in a deck that fits the restriction.');
    if (/Field/.test(card.race || '') && kind === 'spell') tips.push('Field Spells are often the engine of an archetype — consider extra copies or ways to search it.');
    if (/Ritual/i.test(type) && kind === 'monster') tips.push('Needs a Ritual Spell to summon. Pair it with the Ritual Spell named in its archetype and Tribute fodder.');
    if (/Pendulum/i.test(type)) tips.push('As a Pendulum monster it can be placed in a Pendulum Zone (Scale ' + (card.scale != null ? card.scale : '?') + ') and returns face-up to your Extra Deck when it would go to the GY.');
    if (/Link/i.test(type)) tips.push('Its Link Arrows (' + ((card.linkmarkers || []).join(', ') || 'see card') + ') decide where your other Extra Deck monsters can be summoned — plan your board around them.');
    if (/XYZ/i.test(type)) tips.push('Overlay two or more monsters of the same Level (Rank ' + card.level + ') to summon it. Its effects usually cost detaching materials, so each material is one use.');
    if (/Synchro/i.test(type)) tips.push('Synchro Summon it with 1 Tuner + non-Tuners whose Levels add up to ' + card.level + '.');
    if (/Fusion/i.test(type)) tips.push(/(must first be special summoned|cannot be fusion summoned|by (sending|banishing|shuffling)|contact)/i.test(body)
      ? 'This Fusion is summoned by its own method (no Fusion Spell needed) — read the summon condition carefully.'
      : 'Needs a Fusion Spell (e.g. "Polymerization" or your archetype\'s fusion card) plus the listed materials.');

    if (generic && kind !== 'skill' && kind !== 'token') tips.push('No archetype requirements in its text — it can be splashed into most decks that meet its conditions.');
    else if (card.archetype) tips.push('Built for the "' + card.archetype + '" strategy. It works best alongside other ' + card.archetype + ' cards — open the archetype to see the full pool.');
    if (structureDecks.length) tips.push('Printed in ' + structureDecks.slice(0, 2).join(' and ') + (structureDecks.length > 2 ? ' and more' : '') + ' — an easy, cheap way to get copies.');

    const limit = api.copyLimit(card);
    if (limit === 0) tips.unshift('Forbidden on the current TCG banlist — it cannot be used in tournament decks.');
    else if (limit < 3) tips.unshift('Limited to ' + limit + ' cop' + (limit === 1 ? 'y' : 'ies') + ' on the current TCG banlist.');

    return {
      roles: Array.from(roles).map((k) => ({ key: k, label: ROLES[k].label, desc: ROLES[k].desc })),
      roleKeys: Array.from(roles),
      tips: tips,
      mentions: archetypeMentions,
      generic: generic,
      requirement: summonRequirement(card, desc),
      pendulum: pend,
      printedIn: structureDecks
    };
  }

  /* Archetype-level summary for the archetype page and deck builder. */
  function summarise(cards) {
    const counts = {};
    cards.forEach((c) => analyse(c).roleKeys.forEach((k) => { counts[k] = (counts[k] || 0) + 1; }));
    return counts;
  }

  App.insights = { analyse: analyse, summarise: summarise, ROLES: ROLES };
})(window.App);
