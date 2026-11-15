/* Effect reader: recognises common effect wording and turns it into engine
   ops. Used by the built-in bot, and offered to you as "Auto-resolve" when
   you activate a card. Anything it doesn't recognise is resolved by hand
   with the card menus (or by the Claude opponent, which reads the text). */
(function (App) {
  'use strict';

  const api = App.api;
  const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1 };
  const num = (s) => (/^\d+$/.test(s) ? Number(s) : NUM[String(s).toLowerCase()] || 1);

  function deckMatcher(phrase) {
    const p = String(phrase || '');
    const quoted = /"([^"]+)"/.exec(p);
    const lvl = /level (\d+) or (lower|higher)/i.exec(p) || /level (\d+)/i.exec(p);
    const attr = /\b(DARK|LIGHT|EARTH|WATER|FIRE|WIND|DIVINE)\b/.exec(p);
    const wantMonster = /monster/i.test(p);
    const wantSpell = /spell/i.test(p) && !/spell\/trap|spell or trap/i.test(p);
    const wantTrap = /trap/i.test(p) && !/spell\/trap|spell or trap/i.test(p);
    const wantST = /spell\/trap|spell or trap/i.test(p);
    return (c) => {
      const d = c.data;
      const kind = api.kind(d);
      if (quoted) {
        const q = quoted[1].toLowerCase();
        if (c.name.toLowerCase().indexOf(q) === -1 && String(d.archetype || '').toLowerCase() !== q) return false;
      }
      if (wantMonster && kind !== 'monster') return false;
      if (wantSpell && kind !== 'spell') return false;
      if (wantTrap && kind !== 'trap') return false;
      if (wantST && kind !== 'spell' && kind !== 'trap') return false;
      if (lvl) {
        const L = Number(d.level) || 0;
        const n = Number(lvl[1]);
        if (/lower/i.test(lvl[0]) ? L > n : /higher/i.test(lvl[0]) ? L < n : L !== n) return false;
      }
      if (attr && d.attribute !== attr[1]) return false;
      return true;
    };
  }

  /* Fusion: which Extra Deck Fusion monster can be made from the given cards? */
  function fusionOptions(duel, p, sources) {
    const pl = duel.players[p];
    const opts = [];
    pl.extra.filter((c) => /fusion/i.test(c.data.type)).forEach((f) => {
      const req = String(f.data.desc || '').split('\n')[0];
      const used = [];
      const take = (pred) => {
        const c = sources.find((s) => used.indexOf(s) === -1 && pred(s));
        if (c) used.push(c);
        return !!c;
      };
      let ok = true;
      const names = (req.match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1));
      const countArch = /^(\d)\+?\s+"([^"]+)"\s+monsters/i.exec(req);
      if (countArch) {
        const n = Number(countArch[1]);
        for (let i = 0; i < n && ok; i++) ok = take((s) => s.name.indexOf(countArch[2]) !== -1 || s.data.archetype === countArch[2]);
      } else if (names.length && /\+/.test(req)) {
        names.forEach((n) => { if (ok) ok = take((s) => s.name === n || s.name.indexOf(n) !== -1 || s.data.archetype === n); });
        const extraGeneric = /\+\s*(\d)\+?\s+monsters?/i.exec(req) || /\+\s*1\s+([A-Z]+)\s+monster/i.exec(req);
        if (ok && extraGeneric) ok = take(() => true);
      } else if (/^(\d)\+?\s+monsters/i.test(req)) {
        const n = Number(/^(\d)/.exec(req)[1]);
        for (let i = 0; i < n && ok; i++) ok = take(() => true);
      } else ok = false;
      if (ok && used.length) opts.push({ fusion: f, materials: used });
    });
    return opts.sort((a, b) => duel.atk(b.fusion) - duel.atk(a.fusion));
  }

  /* Returns null (not understood) or
     { summary, ops:[...], choose?:{ pool:[uids], count, op, label }, after?:[ops], fusion?:[options], negateAttack?, special? } */
  function plan(duel, p, card, ctx) {
    const c = typeof card === 'string' ? duel.find(card).card : card;
    const text = String(c.data.desc || '');
    const t = text.toLowerCase();
    const o = duel.opp(p);
    const kind = duel.kind(c);
    const context = ctx || {};
    let m;

    // Battle traps (Mirror Force, Sakuretsu Armor, Negate Attack, Magic Cylinder…)
    if (context.attack && /declares an attack/.test(t)) {
      const pa = context.attack;
      if (/destroy all (your opponent's )?attack position monsters/.test(t) || /destroy all attack position monsters your opponent controls/.test(t)) {
        const pool = duel.monsters(o).filter((x) => x.card.faceUp && x.card.pos === 'atk').map((x) => x.card.uid);
        return { summary: 'Destroy all of your opponent\'s Attack Position monsters', ops: pool.map((u) => ({ op: 'destroy', card: u, reason: c.name })) };
      }
      if (/negate the attack/.test(t)) {
        const ops = [];
        const dmg = /inflict damage to your opponent equal to its atk/.test(t);
        if (dmg) ops.push({ op: 'damage', amount: duel.atk(duel.find(pa.attacker).card), player: 'opponent', reason: c.name });
        return { summary: 'Negate the attack' + (dmg ? ' and inflict damage equal to its ATK' : ''), ops: ops, negateAttack: true };
      }
      if (/target the attacking monster; destroy/.test(t) || /destroy (the|that) attacking monster/.test(t) || /destroy that target/.test(t)) {
        return { summary: 'Destroy the attacking monster', ops: [{ op: 'destroy', card: pa.attacker, reason: c.name }] };
      }
    }

    // Fusion Summon spells (Polymerization and archetype fusion spells)
    if (kind === 'spell' && /fusion summon/.test(t) && /extra deck/.test(t)) {
      const fromDeck = /from your deck/.test(t);
      const sources = duel.players[p].hand.filter((x) => x.uid !== c.uid && duel.kind(x) === 'monster')
        .concat(duel.monsters(p).map((x) => x.card))
        .concat(fromDeck ? duel.players[p].deck.filter((x) => duel.kind(x) === 'monster') : []);
      const options = fusionOptions(duel, p, sources);
      if (!options.length) return { summary: 'No Fusion Monster can be made with your cards right now', ops: [] };
      return { summary: 'Fusion Summon ' + options[0].fusion.name, ops: [], fusion: options };
    }

    // Draw
    if ((m = /(?:^|[.:;]\s*)draw (\d|one|two|three) cards?/.exec(t)) && kind !== 'monster') {
      const ops = [{ op: 'draw', count: num(m[1]) }];
      const disc = /then discard (\d|one|two) cards?/.exec(t);
      const res = { summary: 'Draw ' + num(m[1]) + (disc ? ', then discard ' + num(disc[1]) : ''), ops: ops };
      if (disc) res.discard = num(disc[1]);
      return res;
    }

    // Board wipes
    if (/destroy all monsters your opponent controls/.test(t)) {
      return { summary: 'Destroy all monsters your opponent controls', ops: duel.monsters(o).map((x) => ({ op: 'destroy', card: x.card.uid, reason: c.name })) };
    }
    if (/destroy all monsters on the field/.test(t)) {
      return { summary: 'Destroy all monsters on the field', ops: duel.monsters(o).concat(duel.monsters(p)).map((x) => ({ op: 'destroy', card: x.card.uid, reason: c.name })) };
    }
    if (/destroy all (spells? and traps?|spell and trap cards) your opponent controls/.test(t)) {
      return { summary: 'Destroy all Spells and Traps your opponent controls', ops: duel.spellsTraps(o).map((x) => ({ op: 'destroy', card: x.card.uid, reason: c.name })) };
    }
    if (/destroy all (spells? and traps?|spell and trap cards) on the field/.test(t)) {
      const all = duel.spellsTraps(o).concat(duel.spellsTraps(p)).filter((x) => x.card.uid !== c.uid);
      return { summary: 'Destroy all Spells and Traps on the field', ops: all.map((x) => ({ op: 'destroy', card: x.card.uid, reason: c.name })) };
    }

    // Targeted removal / control
    if ((m = /target 1 (face-up )?monster (your opponent controls|on the field)[^.;]*; (destroy|banish|take control of|return)/.exec(t))) {
      const anyField = m[2] === 'on the field';
      let pool = duel.monsters(o).concat(anyField ? duel.monsters(p) : []);
      if (m[1]) pool = pool.filter((x) => x.card.faceUp);
      const verb = m[3];
      const op = verb === 'destroy' ? 'destroy' : verb === 'banish' ? 'banish' : verb === 'return' ? 'to_hand' : 'take_control';
      return { summary: (op === 'take_control' ? 'Take control of' : op === 'to_hand' ? 'Return to the hand' : (op[0].toUpperCase() + op.slice(1))) + ' 1 monster', ops: [], choose: { pool: pool.map((x) => x.card.uid), count: 1, op: op, label: 'Choose a monster' } };
    }
    if ((m = /target 1 (spell\/trap|spell or trap card|card)[^.;]*(on the field|your opponent controls)[^.;]*; destroy/.exec(t))) {
      const isCard = m[1] === 'card';
      let pool = duel.spellsTraps(o).concat(m[2] === 'on the field' ? duel.spellsTraps(p).filter((x) => x.card.uid !== c.uid) : []);
      if (isCard) pool = pool.concat(duel.monsters(o));
      return { summary: 'Destroy 1 ' + (isCard ? 'card' : 'Spell/Trap'), ops: [], choose: { pool: pool.map((x) => x.card.uid), count: 1, op: 'destroy', label: 'Choose a card to destroy' } };
    }

    // Revive
    if ((m = /target 1 monster in (either gy|either player's gy|your gy|your opponent's gy|either graveyard)[^.;]*; special summon it/.exec(t))) {
      const who = m[1];
      const pool = (who.indexOf('opponent') !== -1 ? [] : duel.players[p].gy).concat(who.indexOf('your gy') === 0 ? [] : duel.players[o].gy)
        .filter((x) => duel.kind(x) === 'monster');
      return { summary: 'Special Summon 1 monster from the GY', ops: [], choose: { pool: pool.map((x) => x.uid), count: 1, op: 'special_summon', label: 'Choose a monster to revive' } };
    }

    // Search
    if ((m = /add 1 ([^.;]{1,140}?) from your deck to your hand/.exec(t)) && (kind !== 'monster' || context.summoned)) {
      const phrase = text.substr(m.index + 6, m[1].length);
      const match = deckMatcher(phrase);
      const pool = duel.players[p].deck.filter((x) => x.uid !== c.uid && match(x));
      const seen = new Set();
      const unique = pool.filter((x) => (seen.has(x.name) ? false : seen.add(x.name)));
      return { summary: 'Add 1 ' + phrase.replace(/\s+/g, ' ') + ' from your Deck to your hand', ops: [], choose: { pool: unique.map((x) => x.uid), count: 1, op: 'to_hand', label: 'Choose a card to add to your hand', fromDeck: true } };
    }

    // Burn / gain
    const ops = [];
    if ((m = /inflict (\d+) damage to your opponent/.exec(t))) ops.push({ op: 'damage', amount: Number(m[1]), player: 'opponent', reason: c.name });
    if ((m = /(?:^|[.:;]\s*)gain (\d+) (lp|life points)/.exec(t))) ops.push({ op: 'gain_lp', amount: Number(m[1]), reason: c.name });
    if (ops.length) return { summary: ops.map((x) => (x.op === 'damage' ? 'Inflict ' + x.amount + ' damage' : 'Gain ' + x.amount + ' LP')).join(' and '), ops: ops };

    return null;
  }

  /* Runs a plan. chosen: uids picked for plan.choose (bots pick automatically). */
  function run(duel, p, planObj, chosen, fusionPick) {
    const pl = planObj;
    (pl.ops || []).forEach((op) => duel.applyOp(p, op));
    if (pl.choose && chosen && chosen.length) {
      chosen.slice(0, pl.choose.count).forEach((uid) => {
        if (pl.choose.op === 'to_hand' && pl.choose.fromDeck) {
          duel.sendTo(uid, 'hand', false);
          duel.say(duel.pname(p) + ' ' + duel.v(p, 'adds', 'add') + ' ' + duel.find(uid).card.name + ' from the Deck to the hand.', p);
          duel.applyOp(p, { op: 'shuffle_deck' });
        } else duel.applyOp(p, { op: pl.choose.op, card: uid, reason: 'effect' });
      });
    }
    if (pl.fusion && pl.fusion.length) {
      const f = fusionPick || pl.fusion[0];
      duel.specialSummon(p, f.fusion.uid, 'atk', { materials: f.materials.map((x) => x.uid), how: 'Fusion Summon' });
    }
    if (pl.negateAttack) duel.negateAttack();
    duel.changed();
  }

  /* Bot's choice for a plan's "choose" step: the best target. */
  function autoChoose(duel, p, pl) {
    if (!pl.choose || !pl.choose.pool.length) return [];
    const cards = pl.choose.pool.map((u) => duel.find(u)).filter(Boolean).map((x) => x.card);
    const val = (c) => (duel.kind(c) === 'monster' ? Math.max(duel.atk(c), duel.def(c) * 0.8) + (Number(c.data.level) || 0) * 50 : 900);
    const mine = (c) => (c.controller != null ? c.controller : c.owner) === p;
    let sorted;
    if (['destroy', 'banish', 'to_hand', 'take_control'].indexOf(pl.choose.op) !== -1) {
      sorted = cards.filter((c) => !mine(c) || pl.choose.op === 'to_hand' && pl.choose.fromDeck).sort((a, b) => val(b) - val(a));
      if (!sorted.length) sorted = cards.sort((a, b) => val(b) - val(a));
    } else sorted = cards.sort((a, b) => val(b) - val(a));
    if (pl.choose.fromDeck) {
      // Prefer monsters we can summon right away, then anything.
      sorted = cards.sort((a, b) => (duel.kind(b) === 'monster' ? 1 : 0) - (duel.kind(a) === 'monster' ? 1 : 0) || val(b) - val(a));
    }
    return sorted.slice(0, pl.choose.count).map((c) => c.uid);
  }

  App.Effects = { plan: plan, run: run, autoChoose: autoChoose, fusionOptions: fusionOptions };
})(window.App);
