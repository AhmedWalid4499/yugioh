/* Effect reader.

   A card's text is split into its separate effects, the way the rules read
   it. Each effect has
     cond   - when/where it can be used (text before ":"),
     pre    - costs and targets (text before ";"),
     action - what it does (text after ";", or after ":"),
   plus its type (activation of a Spell/Trap, ignition, quick, trigger, FLIP,
   continuous, or a summoning procedure), the zones it works from, the event
   that triggers it, and its once-per-turn limit.

   Only the effect you activate is resolved, never another sentence of the
   card. Costs are paid first. Whatever the reader doesn't understand is left
   for you to do with the card menus (the dialog says exactly which part). */
(function (App) {
  'use strict';

  const api = App.api;
  const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1, an: 1 };
  const num = (s) => (/^\d+$/.test(s) ? Number(s) : NUM[String(s).toLowerCase()] || 1);
  const RACES = ['Spellcaster', 'Dragon', 'Zombie', 'Warrior', 'Beast-Warrior', 'Beast', 'Winged Beast', 'Fiend', 'Fairy', 'Insect', 'Dinosaur', 'Reptile', 'Fish', 'Sea Serpent', 'Aqua', 'Pyro', 'Thunder', 'Rock', 'Plant', 'Machine', 'Psychic', 'Divine-Beast', 'Wyrm', 'Cyberse', 'Illusion'];

  /* ---------- reading the text ---------- */

  /* Index of ch outside "quoted card names", or -1. */
  function idxOut(s, ch) {
    let q = false;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '"') q = !q;
      else if (!q && s[i] === ch) return i;
    }
    return -1;
  }

  /* Sentences, never splitting inside "quoted names" (e.g. "A.I. Love Fusion"). */
  function sentences(text) {
    const split = (respectQuotes) => {
      const out = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' && respectQuotes) q = !q;
        if (ch === '\n') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
        if (!q && ch === '.' && (i + 1 >= text.length || /\s/.test(text[i + 1]))) { out.push(cur.trim()); cur = ''; }
      }
      if (cur.trim()) out.push(cur.trim());
      return { out: out, balanced: !q };
    };
    const r = split(true);
    return r.balanced ? r.out : split(false).out;
  }

  /* The part of the text that holds this card's effects. */
  function body(card) {
    const d = card.data || card;
    let desc = String(d.desc || '').replace(/\r/g, '');
    const type = String(d.type || '');
    if (/normal/i.test(type) && !/effect|pendulum/i.test(type) && api.kind(d) === 'monster') return { main: '', pendulum: '' };
    let pendulum = '';
    const pm = /\[\s*Pendulum Effect\s*\]([\s\S]*?)(?:-{5,}|\[\s*(?:Monster Effect|Flavor Text)\s*\])/i.exec(desc);
    if (pm) {
      pendulum = pm[1].trim();
      const mm = /\[\s*Monster Effect\s*\]([\s\S]*)$/i.exec(desc);
      desc = mm ? mm[1].trim() : '';
    }
    // Extra Deck monsters: the first line lists the materials.
    if (/fusion|synchro|xyz|link/i.test(type)) {
      const nl = desc.indexOf('\n');
      const first = nl === -1 ? desc : desc.slice(0, nl);
      if (idxOut(first, ':') === -1 && idxOut(first, ';') === -1 && /\+|monsters?|tuner/i.test(first) && first.length < 200) desc = nl === -1 ? '' : desc.slice(nl + 1);
    }
    return { main: desc.trim(), pendulum: pendulum };
  }

  const CONTINUE = /^(then|also,?|if you do|after that|afterwards|otherwise|in addition|however|for the rest of this turn|that |those |the |its |it |this effect|until the end|●)/i;
  const STARTER = /^(you can|if |when |during |once per turn|each time|while |at the (start|end)|flip:|\(quick effect\)|cannot be|this card |monsters |all |your |neither|gains? |unaffected|must |each player|both players)/i;

  const memo = {};

  /* The card's effects, in order. */
  function effectsOf(card) {
    const d = card.data || card;
    const key = d.id || d.name;
    if (memo[key]) return memo[key];
    const kind = api.kind(d);
    const race = String(d.race || '');
    const parts = body(card);
    const effs = [];
    const rules = { each: false, hard: false, activate1: false, ssOnce: false };
    let lastIdx = -1;
    let bulletsAreEffects = false;

    sentences(parts.main).forEach((s) => {
      const l = s.toLowerCase();
      if (/^you can only (use|activate|special summon|control)\b/.test(l)) {
        if (/the following effects|each of the following/.test(l)) bulletsAreEffects = true;
        if (/each (monster |pendulum )?effect of|each of (the|these|the preceding|the above) effects/.test(l)) rules.each = true;
        else if (/only use 1 "[^"]+" effect per turn|only use 1 effect of|only use 1 of the (following|preceding) effects/.test(l)) rules.hard = true;
        else if (/(1st|first) effect/.test(l)) rules.first = true;
        else if (/(2nd|second) effect/.test(l)) rules.second = true;
        else if (/(3rd|third) effect/.test(l)) rules.third = true;
        else if (/only activate 1 "[^"]+" per turn/.test(l)) rules.activate1 = true;
        else if (/only special summon "[^"]+"[^.]*once per turn/.test(l)) rules.ssOnce = true;
        else if (/(use|activate) this effect of/.test(l) && lastIdx !== -1) effs[lastIdx].opt = 'effect';
        return;
      }
      if (/^(you cannot|you must)/.test(l) && effs.length) { effs[effs.length - 1].notes.push(s); return; }
      if (/^●/.test(s)) {
        const inner = s.replace(/^●\s*/, '');
        if (bulletsAreEffects || /^(if|when|during|you can|once per turn|each time|\(quick effect\))/i.test(inner)) { effs.push({ index: effs.length, text: inner, notes: [] }); lastIdx = effs.length - 1; }
        else if (effs.length) effs[effs.length - 1].text += ' ' + s;
        return;
      }
      const newEffect = !effs.length || (!CONTINUE.test(s) && (idxOut(s, ':') !== -1 || idxOut(s, ';') !== -1 || STARTER.test(s)));
      if (newEffect) {
        effs.push({ index: effs.length, text: s, notes: [] });
        lastIdx = effs.length - 1;
      } else effs[effs.length - 1].text += ' ' + s;
    });

    effs.forEach((e) => { classify(e, kind, race); splitModes(e, kind, race); });

    // Which effect is the Spell/Trap's activation?
    if (kind === 'spell' || kind === 'trap') {
      const lingers = /Continuous|Field|Equip/.test(race);
      const act = effs.find((e) => /when this card is activated/i.test(e.cond)) ||
        (!lingers ? effs.find((e) => e.locs.indexOf('field') !== -1 && e.type !== 'procedure') : null);
      if (act) { act.when = act.event; act.type = 'activation'; act.event = null; }
      effs.forEach((e) => { if (e.type === 'plain') e.type = 'continuous'; });
    } else effs.forEach((e) => { if (e.type === 'plain') e.type = 'continuous'; });

    // Once-per-turn limits.
    const activated = effs.filter((e) => ['activation', 'ignition', 'quick', 'trigger', 'flip'].indexOf(e.type) !== -1);
    activated.forEach((e, i) => {
      if (rules.hard) e.opt = 'card';
      else if (rules.each || (rules.first && i === 0) || (rules.second && i === 1) || (rules.third && i === 2)) e.opt = 'effect';
      else if (rules.activate1 && e.type === 'activation') e.opt = 'card';
      else if (/^once per turn|once per turn[,:]/i.test(e.cond) && !e.opt) e.opt = 'copy';
    });
    if (rules.ssOnce) effs.filter((e) => e.type === 'procedure').forEach((e) => { e.opt = 'card'; });

    // Pendulum Effects work from the Pendulum Zone, which this duel doesn't have: list them, but never auto-use them.
    sentences(parts.pendulum).forEach((s) => {
      if (/^you can only/i.test(s)) return;
      const e = { index: effs.length, text: s, notes: [] };
      classify(e, kind, race);
      e.locs = ['pzone'];
      e.pendulum = true;
      effs.push(e);
    });

    memo[key] = effs;
    return effs;
  }

  /* "Activate 1 of these effects. ● … ● …": each option becomes a mode you choose from. */
  function splitModes(e, kind, race) {
    if (e.text.indexOf('●') === -1 || !/(activate|apply|use) 1 of (these|the following) effects|choose 1 of (these|the following)|1 of the following effects/i.test(e.text)) return;
    let t = e.text.replace(/^flip:\s*/i, '');
    const colon = idxOut(t, ':');
    if (colon !== -1 && colon < t.indexOf('●')) t = t.slice(colon + 1);
    const first = t.indexOf('●');
    const head = t.slice(0, first);
    const intro = /[^.;●]*(activate|apply|use|choose) 1 of (these|the following)( effects)?[^.;●]*[.;]?/i;
    const semi = idxOut(head, ';');
    const shared = semi !== -1 ? head.slice(0, semi).replace(intro, '').trim() : '';
    e.pre = shared;
    e.modes = t.slice(first).split('●').map((x) => x.trim()).filter(Boolean).map((part) => {
      const m = { index: e.index, text: part, notes: [] };
      classify(m, kind, race);
      m.cond = e.cond;
      m.pre = [shared, m.pre].filter(Boolean).join(', ');
      m.type = e.type;
      m.locs = e.locs;
      m.event = e.event;
      m.mode = true;
      return m;
    });
  }

  function classify(e, kind, race) {
    const text = e.text;
    let t = text;
    e.type = 'activated';
    if (/^flip:/i.test(t)) { e.type = 'flip'; t = t.replace(/^flip:\s*/i, ''); }
    const colon = idxOut(t, ':');
    const semi = idxOut(t, ';');
    let cond = '';
    let pre = '';
    let action = t;
    if (colon !== -1 && (semi === -1 || colon < semi)) {
      cond = t.slice(0, colon);
      const rest = t.slice(colon + 1);
      const s2 = idxOut(rest, ';');
      if (s2 !== -1) { pre = rest.slice(0, s2); action = rest.slice(s2 + 1); } else action = rest;
    } else if (semi !== -1) { pre = t.slice(0, semi); action = t.slice(semi + 1); }
    e.cond = cond.trim();
    e.pre = pre.trim();
    e.action = action.trim();
    e.quick = /\(quick effect\)/i.test(text);
    const lc = (e.cond + ' ' + e.pre).toLowerCase();
    const l = text.toLowerCase();

    if (e.type !== 'flip' && colon === -1 && semi === -1) {
      if (/(you can|, you can) special summon this card|special summon this card \(from your (hand|gy|graveyard)/.test(l) && !/^if this card is (normal |special )?summoned/.test(l)) e.type = 'procedure';
      else if (kind !== 'monster') e.type = 'plain';
      else e.type = 'continuous';
    }

    // The event that triggers it.
    const c = e.cond.toLowerCase();
    let ev = null;
    if (/normal or special summoned|normal and\/or special summoned/.test(c)) ev = ['normal', 'special'];
    else if (/this card is (normal|flip) summoned|this card is normal or flip summoned/.test(c)) ev = ['normal'];
    else if (/this card is special summoned/.test(c)) ev = ['special'];
    else if (/this card is summoned/.test(c)) ev = ['normal', 'special'];
    else if (/this card is (sent|destroyed and sent|destroyed by battle and sent) (from the [a-z ]+ )?to the (gy|graveyard)/.test(c)) ev = ['to-gy'];
    else if (/this card is destroyed/.test(c)) ev = ['destroyed'];
    else if (/this card is banished/.test(c)) ev = ['banished'];
    else if (/declares an attack|an attack is declared/.test(c)) ev = ['attack'];
    else if (/monsters? (would be|is|are) (normal |special |flip |tribute )*summoned|your opponent (would )?(normal |special |flip )*summons?|a player (would )?(normal |special )*summons?/.test(c)) ev = /(card|effect|spell|trap)[^:]*(is|are) activated/.test(c) ? ['summon', 'activation'] : ['summon'];
    else if (/(card|effect|spell|trap|monster effect)[^:]*(is|are) activated|activates? (a |an |the )?(card|spell|trap|monster effect|effect)/.test(c)) ev = ['activation'];
    else if (/(end|standby|draw|battle) phase|at the (start|end) of/.test(c) && !/main phase/.test(c)) ev = ['phase'];
    else if (/^(if|when|each time) /.test(c) && !/^if (you control|you have|your opponent controls|only your opponent|this card is in your|neither player|this card was|you do not control|all monsters you control)/.test(c)) ev = ['other'];
    e.event = ev;
    if (e.type === 'activated') e.type = ev ? 'trigger' : e.quick ? 'quick' : 'ignition';
    if (e.type === 'trigger' && e.quick) e.type = 'quick';
    // A trigger that responds to the opponent ("when your opponent activates…") works like a quick effect.
    if ((e.type === 'trigger' || e.type === 'quick') && ev && (ev[0] === 'activation' || ev[0] === 'summon' || ev[0] === 'attack')) e.respond = true;

    // Where it works from.
    const all = lc + ' ' + e.action.toLowerCase();
    let locs = [];
    if ((/\(from your hand or (gy|graveyard)\)|from your hand or (gy|graveyard)/.test(all) && /this card/.test(all)) || /this card is in your hand or (gy|graveyard)/.test(lc)) locs = ['hand', 'gy'];
    else if (/discard this card|reveal this card|send this card from your hand|this card is in your hand|banish this card from your hand|\(from your hand\)|special summon this card from your hand|this card in your hand/.test(lc) ||
      (/special summon this card \(from your hand\)|special summon this card from your hand/.test(all))) locs = ['hand'];
    else if (/this card is in your (gy|graveyard)|banish this card from your (gy|graveyard)|this card in your (gy|graveyard)|shuffle this card from your (gy|graveyard)|\(from your (gy|graveyard)\)|special summon this card from your (gy|graveyard)/.test(all)) locs = ['gy'];
    else if (/this card is banished|this card is in your banishment/.test(c)) locs = ['banished'];
    else if (ev && (ev[0] === 'to-gy' || ev[0] === 'destroyed')) locs = ['gy'];
    else if (ev && ev[0] === 'banished') locs = ['banished'];
    else locs = ['field'];
    if (e.type === 'procedure' && locs[0] === 'field') locs = ['hand'];
    e.locs = locs;
    e.opt = null;
  }

  /* ---------- matching cards named in an effect ---------- */

  function matcher(phrase, self) {
    const p = String(phrase || '');
    const pl = p.toLowerCase();
    const mention = /(?:that mentions|that lists|which mentions) "([^"]+)"/i.exec(p);
    const pNoMention = mention ? p.replace(mention[0], '') : p;
    const except = (p.match(/except "([^"]+)"/gi) || []).map((x) => x.slice(8, -1).toLowerCase());
    const pClean = pNoMention.replace(/,?\s*except "[^"]+"/gi, '');
    const quoted = [];
    const re = /"([^"]+)"(\s+(?:monsters?|cards?|spells?|traps?|spell\/traps?|quick-play|normal|continuous|field|xyz|synchro|fusion|link|ritual|tuner|pendulum|effect))?/gi;
    let m;
    while ((m = re.exec(pClean))) quoted.push({ name: m[1].toLowerCase(), arch: !!m[2] });
    const lvl = /level (\d+) or (lower|higher|less|more)/i.exec(pl) || /level (\d+)\b/i.exec(pl);
    const rank = /rank (\d+) or (lower|higher)/i.exec(pl);
    const attr = /\b(DARK|LIGHT|EARTH|WATER|FIRE|WIND|DIVINE)\b/.exec(p);
    const atk = /(\d+) or (less|lower|more|higher) atk|atk (\d+) or (less|lower|more|higher)/i.exec(pl);
    const def = /(\d+) or (less|lower|more|higher) def/i.exec(pl);
    const race = RACES.find((r) => new RegExp('\\b' + r.replace('-', '\\-') + '(-type)?\\b(?!")', 'i').test(pClean.replace(/"[^"]*"/g, '')));
    const st = /spell\/trap|spell or trap/i.test(pl);
    const want = {
      monster: /monster/i.test(pClean.replace(/"[^"]*"/g, '')),
      spell: /spell/i.test(pl) && !st,
      trap: /trap/i.test(pl) && !st,
      st: st,
      tuner: /\btuner\b/i.test(pClean.replace(/"[^"]*"/g, '')) && !/non-tuner/i.test(pl),
      normal: /normal monster/i.test(pl),
      effectMon: /effect monster/i.test(pl),
      ritual: /ritual (monster|spell)/i.test(pl),
      fusion: /fusion monster/i.test(pl),
      synchro: /synchro monster/i.test(pl),
      xyz: /xyz monster/i.test(pl),
      link: /link monster/i.test(pl),
      pendulum: /pendulum monster/i.test(pl),
      quickplay: /quick-play spell/i.test(pl),
      field: /field spell/i.test(pl),
      continuous: /continuous (spell|trap)/i.test(pl),
      counter: /counter trap/i.test(pl)
    };
    return (c) => {
      const d = c.data;
      const name = c.name.toLowerCase();
      const type = String(d.type || '');
      const kind = api.kind(d);
      if (self && c.name === self.name && /except "/.test(pl) && except.indexOf(name) !== -1) return false;
      if (except.indexOf(name) !== -1) return false;
      if (quoted.length) {
        const ok = quoted.some((q) => (q.arch ? name.indexOf(q.name) !== -1 || String(d.archetype || '').toLowerCase() === q.name : name === q.name || (name.indexOf(q.name) !== -1 && String(d.archetype || '').toLowerCase() === q.name)));
        if (!ok) return false;
      }
      if (mention && String(d.desc || '').indexOf('"' + mention[1] + '"') === -1 && c.name !== mention[1]) return false;
      if (want.monster && kind !== 'monster') return false;
      if (want.spell && kind !== 'spell') return false;
      if (want.trap && kind !== 'trap') return false;
      if (want.st && kind !== 'spell' && kind !== 'trap') return false;
      if (want.tuner && !/tuner/i.test(type)) return false;
      if (want.normal && !/normal monster/i.test(type)) return false;
      if (want.effectMon && !/effect/i.test(type)) return false;
      if (want.ritual && !/ritual/i.test(type + ' ' + d.race)) return false;
      if (want.fusion && !/fusion/i.test(type)) return false;
      if (want.synchro && !/synchro/i.test(type)) return false;
      if (want.xyz && !/xyz/i.test(type)) return false;
      if (want.link && !/link/i.test(type)) return false;
      if (want.pendulum && !/pendulum/i.test(type)) return false;
      if (want.quickplay && !/quick-play/i.test(d.race || '')) return false;
      if (want.field && !/field/i.test(d.race || '')) return false;
      if (want.continuous && !/continuous/i.test(d.race || '')) return false;
      if (want.counter && !/counter/i.test(d.race || '')) return false;
      if (lvl && kind === 'monster') {
        const L = Number(d.level) || 0;
        const n = Number(lvl[1]);
        if (/lower|less/i.test(lvl[2] || '') ? L > n : /higher|more/i.test(lvl[2] || '') ? L < n : L !== n) return false;
      }
      if (rank && kind === 'monster') { const R = Number(d.level) || 0; if (/lower/i.test(rank[2]) ? R > Number(rank[1]) : R < Number(rank[1])) return false; }
      if (attr && kind === 'monster' && d.attribute !== attr[1]) return false;
      if (race && kind === 'monster' && d.race !== race) return false;
      if (atk && kind === 'monster') { const n = Number(atk[1] || atk[3]); const dir = atk[2] || atk[4]; const v = Number(d.atk) || 0; if (/less|lower/i.test(dir) ? v > n : v < n) return false; }
      if (def && kind === 'monster') { const n = Number(def[1]); const v = Number(d.def) || 0; if (/less|lower/i.test(def[2]) ? v > n : v < n) return false; }
      return true;
    };
  }

  /* ---------- where cards are ---------- */

  function zoneCards(duel, who, zone) {
    const pl = duel.players[who];
    if (zone === 'hand') return pl.hand.slice();
    if (zone === 'deck') return pl.deck.slice();
    if (zone === 'gy') return pl.gy.slice();
    if (zone === 'banished') return pl.banished.slice();
    if (zone === 'extra') return pl.extra.slice();
    if (zone === 'monsters') return duel.monsters(who).map((x) => x.card);
    if (zone === 'st') return duel.spellsTraps(who).map((x) => x.card);
    if (zone === 'field') return duel.monsters(who).map((x) => x.card).concat(duel.spellsTraps(who).map((x) => x.card));
    return [];
  }

  /* Reads "1 face-up monster your opponent controls", "1 "Lunalight" monster in your GY"… */
  function readSpec(duel, p, phrase, self) {
    const ph = String(phrase || '');
    const l = ph.toLowerCase();
    const o = duel.opp(p);
    const cm = /^(?:up to )?(\d+|one|two|three|a|an)\b/i.exec(ph.trim());
    const count = cm ? num(cm[1]) : 1;
    const upTo = /^up to/i.test(ph.trim());
    let what = 'card';
    const plain = l.replace(/"[^"]*"/g, '');
    if (/spell\/trap|spell or trap/.test(plain)) what = 'st';
    else if (/monster/.test(plain)) what = 'monster';
    else if (/\bspells?\b/.test(plain)) what = 'st';
    else if (/\btraps?\b/.test(plain)) what = 'st';
    let pool = [];
    const fieldOf = (who) => (what === 'monster' ? zoneCards(duel, who, 'monsters') : what === 'st' ? zoneCards(duel, who, 'st') : zoneCards(duel, who, 'field'));
    if (/in (either|each) (player's )?(gy|graveyard)|in a (gy|graveyard)/.test(l)) pool = zoneCards(duel, p, 'gy').concat(zoneCards(duel, o, 'gy'));
    else if (/in your opponent's (gy|graveyard)/.test(l)) pool = zoneCards(duel, o, 'gy');
    else if (/in your (gy|graveyard)/.test(l)) pool = zoneCards(duel, p, 'gy');
    else if (/your opponent's banished|banished (by|from) your opponent/.test(l)) pool = zoneCards(duel, o, 'banished');
    else if (/banished/.test(l)) pool = zoneCards(duel, p, 'banished').concat(/your banished/.test(l) ? [] : zoneCards(duel, o, 'banished'));
    else if (/your opponent controls|on your opponent's (side of the )?field|in your opponent's/.test(l)) pool = fieldOf(o);
    else if (/you control|on your (side of the )?field/.test(l)) pool = fieldOf(p);
    else if (/on the field/.test(l)) pool = fieldOf(o).concat(fieldOf(p));
    else if (/in your hand/.test(l)) pool = zoneCards(duel, p, 'hand');
    else return null;
    if (/face-up/.test(l)) pool = pool.filter((c) => c.faceUp);
    if (/face-down/.test(l)) pool = pool.filter((c) => !c.faceUp);
    if (/attack position/.test(l)) pool = pool.filter((c) => c.pos === 'atk');
    if (/defense position/.test(l)) pool = pool.filter((c) => c.pos === 'def');
    if (/other than this card|except this card|other monster|another/.test(l) && self) pool = pool.filter((c) => c.uid !== self.uid);
    if (what === 'monster') pool = pool.filter((c) => duel.kind(c) === 'monster');
    const filterPhrase = ph.replace(/(your opponent controls|you control|on the field|in (either|your|your opponent's|each) (player's )?(gy|graveyard)|in your hand)/gi, '');
    const match = matcher(filterPhrase, self);
    pool = pool.filter((c) => (!c.faceUp && !/in .*(gy|graveyard)|banished|hand/.test(l)) ? !/"/.test(filterPhrase) && !/level|atk|def|attribute|\b(dark|light|earth|water|fire|wind)\b/i.test(filterPhrase) : match(c));
    return { pool: pool, count: count, upTo: upTo };
  }

  /* ---------- costs ---------- */

  function readCosts(e) {
    const pre = e.pre.toLowerCase();
    const costs = [];
    if (!pre) return costs;
    let m;
    if (/discard this card|send this card from your hand to the (gy|graveyard)/.test(pre)) costs.push({ type: 'self', to: 'gy', from: 'hand', label: 'Send this card from your hand to the GY' });
    else if (/send this card (from the field |from your field )?to the (gy|graveyard)|tribute this card/.test(pre)) costs.push({ type: 'self', to: 'gy', from: 'field', label: (/tribute/.test(pre) ? 'Tribute' : 'Send') + ' this card' });
    if (/banish this card from your (gy|graveyard)/.test(pre)) costs.push({ type: 'self', to: 'banished', from: 'gy', label: 'Banish this card from your GY' });
    else if (/banish this card from your hand/.test(pre)) costs.push({ type: 'self', to: 'banished', from: 'hand', label: 'Banish this card from your hand' });
    if ((m = /discard (\d+|one|two|a|an) ([^,;]*?)(?=,|;|$| to )/.exec(pre)) && !/discard this card/.test(m[0])) costs.push({ type: 'choose', from: 'hand', to: 'gy', count: num(m[1]), phrase: e.pre.substr(m.index + 8 + m[1].length + 1, m[2].length), label: 'Discard ' + num(m[1]) });
    if ((m = /send (\d+|one|two) ([^,;]*?) from your hand to the (gy|graveyard)/.exec(pre))) costs.push({ type: 'choose', from: 'hand', to: 'gy', count: num(m[1]), phrase: m[2], label: 'Send ' + num(m[1]) + ' from your hand to the GY' });
    if ((m = /tribute (\d+|one|two|a|an) ([^,;]*?)(?=,|;|$)/.exec(pre)) && !/tribute this card/.test(m[0])) costs.push({ type: 'choose', from: 'monsters', to: 'gy', count: num(m[1]), phrase: m[2], label: 'Tribute ' + num(m[1]) });
    if ((m = /banish (\d+|one|two|three) ([^,;]*?) from your (gy|graveyard)/.exec(pre)) && !/banish this card/.test(m[0])) costs.push({ type: 'choose', from: 'gy', to: 'banished', count: num(m[1]), phrase: m[2], label: 'Banish ' + num(m[1]) + ' from your GY' });
    if ((m = /banish (\d+|one|two|three) ([^,;]*?) from your hand/.exec(pre)) && !/banish this card/.test(m[0])) costs.push({ type: 'choose', from: 'hand', to: 'banished', count: num(m[1]), phrase: m[2], label: 'Banish ' + num(m[1]) + ' from your hand' });
    if ((m = /pay (\d+) (lp|life points)/.exec(pre))) costs.push({ type: 'lp', amount: Number(m[1]), label: 'Pay ' + m[1] + ' LP' });
    if (/pay half your (lp|life points)/.test(pre)) costs.push({ type: 'lp', half: true, amount: 0, label: 'Pay half your LP' });
    if ((m = /detach (\d+|one|two|1) (xyz )?materials? from (this card|it)/.exec(pre))) costs.push({ type: 'detach', count: num(m[1]), label: 'Detach ' + num(m[1]) + ' material' + (num(m[1]) > 1 ? 's' : '') });
    if ((m = /(send|banish) the top (\d+) cards? of your deck|(send|banish) (\d+) cards? from the top of your deck/.exec(pre))) costs.push({ type: 'decktop', count: Number(m[2] || m[4]), to: /banish/.test(m[0]) ? 'banished' : 'gy', label: (/banish/.test(m[0]) ? 'Banish' : 'Send') + ' the top ' + (m[2] || m[4]) + ' cards of your Deck' });
    if ((m = /send (\d+|one|a) ([^,;]*?) you control to the (gy|graveyard)/.exec(pre))) costs.push({ type: 'choose', from: 'field', to: 'gy', count: num(m[1]), phrase: m[2], label: 'Send ' + num(m[1]) + ' card you control to the GY' });
    return costs;
  }

  function costPool(duel, p, card, cost) {
    const match = matcher(cost.phrase || '', card);
    return zoneCards(duel, p, cost.from).filter((c) => c.uid !== card.uid && match(c));
  }

  /* Can this player pay the costs? Returns '' or the reason why not. */
  function costProblem(duel, p, card, costs) {
    const loc = duel.find(card.uid);
    for (const c of costs || []) {
      if (c.type === 'self') {
        const z = loc && loc.zone;
        const ok = c.from === 'hand' ? z === 'hand' : c.from === 'gy' ? z === 'gy' : z === 'mz' || z === 'emz' || z === 'st' || z === 'field';
        if (!ok) return 'This card must be in your ' + (c.from === 'hand' ? 'hand' : c.from === 'gy' ? 'GY' : 'field') + ' to pay the cost.';
      }
      if (c.type === 'choose' && costPool(duel, p, card, c).length < c.count) return 'You don\'t have enough cards to ' + c.label.toLowerCase() + '.';
      if (c.type === 'lp' && !c.half && duel.players[p].lp <= c.amount) return 'You need more than ' + c.amount + ' LP.';
      if (c.type === 'detach' && (!card.materials || card.materials.length < c.count)) return 'This card needs ' + c.count + ' material' + (c.count > 1 ? 's' : '') + ' attached.';
      if (c.type === 'decktop' && duel.players[p].deck.length < c.count) return 'Your Deck has fewer than ' + c.count + ' cards.';
    }
    return '';
  }

  /* Bot's choice of cards to pay with: the least valuable ones. */
  function autoCost(duel, p, card, costs) {
    const val = (c) => (duel.kind(c) === 'monster' ? Math.max(duel.atk(c), duel.def(c)) : 900);
    return (costs || []).map((c) => (c.type === 'choose' ? costPool(duel, p, card, c).sort((a, b) => val(a) - val(b)).slice(0, c.count).map((x) => x.uid) : null));
  }

  /* Pays the costs. picks[i] = uids chosen for cost i (missing: automatic). */
  function payCost(duel, p, card, costs, picks) {
    const auto = autoCost(duel, p, card, costs);
    (costs || []).forEach((c, i) => {
      if (c.type === 'self') {
        const loc = duel.find(card.uid);
        if (loc && (c.to === 'gy' ? loc.zone !== 'gy' : loc.zone !== 'banished')) duel.sendTo(card.uid, c.to, 'cost');
      } else if (c.type === 'choose') {
        ((picks && picks[i]) || auto[i] || []).slice(0, c.count).forEach((u) => duel.sendTo(u, c.to, 'cost'));
      } else if (c.type === 'lp') duel.changeLp(p, -(c.half ? Math.floor(duel.players[p].lp / 2) : c.amount), 'cost');
      else if (c.type === 'detach') {
        const mats = card.materials.splice(0, c.count);
        mats.forEach((m) => duel.players[m.owner].gy.push(m));
        duel.say(card.name + ' detaches ' + mats.length + ' material' + (mats.length > 1 ? 's' : '') + '.', p);
      } else if (c.type === 'decktop') {
        for (let k = 0; k < c.count; k++) { const top = duel.players[p].deck[0]; if (top) duel.sendTo(top.uid, c.to, false); }
        duel.say(duel.pname(p) + ' ' + duel.v(p, 'sends', 'send') + ' the top ' + c.count + ' cards of the Deck ' + (c.to === 'banished' ? 'away (banished)' : 'to the GY') + '.', p);
      }
    });
    duel.changed();
  }

  /* ---------- conditions ---------- */

  /* '' when the condition holds (or we can't tell), else the reason. */
  function condProblem(duel, p, card, e) {
    const c = e.cond.toLowerCase();
    const o = duel.opp(p);
    const mine = duel.monsters(p).map((x) => x.card);
    const theirs = duel.monsters(o).map((x) => x.card);
    if (/(^|if |and |, |while )you control no monsters/.test(c) && mine.filter((x) => x.uid !== card.uid).length) return 'You must control no monsters.';
    if (/(^|if |and |, )your opponent controls no monsters/.test(c) && theirs.length) return 'Your opponent must control no monsters.';
    if (/(^|if |and |, )you control no (spells|traps|spell\/trap|cards in your spell)/.test(c) && duel.spellsTraps(p).length) return 'You must control no Spells/Traps.';
    if ((/your lp are (\d+) or less/.exec(c) || [])[1] && duel.players[p].lp > Number(/your lp are (\d+) or less/.exec(c)[1])) return 'Your LP must be ' + /your lp are (\d+) or less/.exec(c)[1] + ' or less.';
    if (/if only your opponent controls a monster|if your opponent controls a monster and you control no monsters/.test(c) && (mine.filter((x) => x.uid !== card.uid).length || !theirs.length)) return 'Only your opponent may control monsters.';
    if (/if your opponent controls (a|more) monsters?/.test(c) && !theirs.length) return 'Your opponent must control a monster.';
    if (/if your opponent controls more monsters than you/.test(c) && theirs.length <= mine.length) return 'Your opponent must control more monsters than you.';
    if (/if you control no cards/.test(c) && (mine.length || duel.spellsTraps(p).length)) return 'You must control no cards.';
    if (/if you control no face-up cards/.test(c) && (mine.concat(duel.spellsTraps(p).map((x) => x.card)).some((x) => x.faceUp && x.uid !== card.uid))) return 'You must control no face-up cards.';
    const named = /if you control an? (face-up )?("[^"]+"[^,:]*?)(?:,|:|$)/.exec(c);
    if (named) {
      const m = matcher(named[2], card);
      if (!mine.concat(duel.spellsTraps(p).map((x) => x.card)).some((x) => x.uid !== card.uid && m(x))) return 'You need to control ' + named[2].replace(/"/g, '"') + '.';
    }
    if (/during your main phase/.test(c) && !(duel.active === p && duel.isMain())) return 'Only during your Main Phase.';
    if (/during your opponent's (turn|main phase|battle phase)/.test(c) && duel.active === p) return 'Only during your opponent\'s turn.';
    if (/during your opponent's main phase/.test(c) && !duel.isMain()) return 'Only during your opponent\'s Main Phase.';
    if (/during the battle phase/.test(c) && duel.phase !== 'battle') return 'Only during the Battle Phase.';
    return '';
  }

  /* ---------- once per turn ---------- */

  function optKey(p, card, e) {
    if (!e || !e.opt) return null;
    if (e.opt === 'card') return p + ':' + card.name;
    if (e.opt === 'copy') return p + ':' + card.uid + '#' + e.index;
    return p + ':' + card.name + '#' + e.index;
  }
  function used(duel, p, card, e) { const k = optKey(p, card, e); return !!(k && duel.used && duel.used[k]); }
  function markUsed(duel, p, card, e) { const k = optKey(p, card, e); if (k) { duel.used = duel.used || {}; duel.used[k] = true; } }

  /* ---------- what can be activated now ---------- */

  function zoneOf(loc) {
    if (!loc) return null;
    if (loc.zone === 'mz' || loc.zone === 'emz' || loc.zone === 'st' || loc.zone === 'field') return 'field';
    return loc.zone;
  }

  /* Every activatable effect of the card, each with { ok, why }.
     opts: { event: 'normal'|'special'|'flip'|..., respond: bool (a response window) } */
  function options(duel, p, card, opts) {
    const o = opts || {};
    const loc = duel.find(card.uid);
    const here = zoneOf(loc);
    const kind = duel.kind(card);
    return effectsOf(card).filter((e) => ['ignition', 'quick', 'trigger', 'flip', 'activation'].indexOf(e.type) !== -1 && !e.pendulum).map((e) => {
      let why = '';
      if (e.type === 'activation') why = 'Activate the card itself to use this.';
      else if (e.locs.indexOf(here) === -1) why = 'Works from your ' + e.locs.map((z) => ({ field: 'field', hand: 'hand', gy: 'GY', banished: 'banished cards' }[z] || z)).join(' or ') + '.';
      else if (here === 'field' && !card.faceUp) why = 'The card must be face-up.';
      else if (e.type === 'flip' && o.event !== 'flip') why = 'A FLIP effect: it activates when this card is flipped face-up.';
      else if (e.type === 'trigger' && e.event && ['normal', 'special'].some((x) => e.event.indexOf(x) !== -1) && e.event.indexOf(o.event) === -1) why = 'Only right after this card is ' + e.event.map((x) => (x === 'normal' ? 'Normal' : 'Special')).join(' or ') + ' Summoned.';
      else if (e.type === 'trigger' && e.event && e.event[0] !== 'other' && e.event[0] !== 'phase' && !e.respond && !(e.event.indexOf(o.event) !== -1)) why = 'Only when: ' + e.cond.replace(/^\(quick effect\):?\s*/i, '') + '.';
      else if (e.respond && !o.respond && !o.force) why = 'Only in response: ' + e.cond.replace(/^\(quick effect\):?\s*/i, '') + '.';
      else if (e.type === 'ignition' && !(duel.active === p && duel.isMain())) why = 'Only in your Main Phase.';
      else if (kind === 'monster' && card.effectsNegated) why = 'This monster\'s effects are negated.';
      if (!why && used(duel, p, card, e)) why = 'Already used this turn (once per turn).';
      if (!why) why = condProblem(duel, p, card, e);
      if (!why) why = costProblem(duel, p, card, readCosts(e));
      return { effect: e, ok: !why, why: why };
    });
  }

  /* Can this Spell/Trap be activated now? '' or the reason. ctx: { attack, activation, summon } when responding. */
  function activationProblem(duel, p, card, ctx) {
    const e = effectsOf(card).find((x) => x.type === 'activation');
    if (!e) return '';
    const c = ctx || {};
    const w = e.when || [];
    const inWindow = (c.attack && w.indexOf('attack') !== -1) || (c.summon && w.indexOf('summon') !== -1) || (c.activation && w.indexOf('activation') !== -1);
    if (!inWindow && w.indexOf('attack') !== -1) return 'Only when your opponent\'s monster declares an attack.';
    if (!inWindow && w.indexOf('summon') !== -1) return 'Only when a monster is summoned.';
    if (!inWindow && w.indexOf('activation') !== -1) return 'Only in response to a card or effect being activated.';
    if (used(duel, p, card, e)) return 'You can only activate 1 ' + card.name + ' per turn.';
    return condProblem(duel, p, card, e) || costProblem(duel, p, card, readCosts(e));
  }

  /* The summoning procedure ("You can Special Summon this card (from your hand) by …"), if any. */
  function procedure(duel, p, card) {
    const e = effectsOf(card).find((x) => x.type === 'procedure');
    if (!e) return null;
    const loc = duel.find(card.uid);
    const here = zoneOf(loc);
    let why = '';
    if (e.locs.indexOf(here) === -1) why = 'This card must be in your ' + e.locs.join(' or ') + '.';
    else if (duel.freeMz(p) === -1) why = 'Your Monster Zones are full.';
    else if (used(duel, p, card, e)) why = 'Already Special Summoned this way this turn.';
    const t = e.text.toLowerCase();
    const before = t.split(/you can special summon this card/)[0];
    if (!why) why = condProblem(duel, p, card, { cond: before });
    // "by discarding 1 card", "by Tributing 1 …", "by banishing 1 … from your GY", "by sending …"
    const costs = [];
    let m;
    if ((m = /by discarding (\d+|one|a) ([^.,]*)/.exec(t))) costs.push({ type: 'choose', from: 'hand', to: 'gy', count: num(m[1]), phrase: m[2], label: 'Discard ' + num(m[1]) });
    if ((m = /by tributing (\d+|one|a) ([^.,]*)/.exec(t))) costs.push({ type: 'choose', from: 'monsters', to: 'gy', count: num(m[1]), phrase: m[2], label: 'Tribute ' + num(m[1]) });
    if ((m = /by banishing (\d+|one|a) ([^.,]*?) from your (gy|graveyard)/.exec(t))) costs.push({ type: 'choose', from: 'gy', to: 'banished', count: num(m[1]), phrase: m[2], label: 'Banish ' + num(m[1]) + ' from your GY' });
    if ((m = /by sending (\d+|one|a) ([^.,]*?) (?:you control |from your hand )?to the (gy|graveyard)/.exec(t))) costs.push({ type: 'choose', from: /from your hand/.test(m[0]) ? 'hand' : 'field', to: 'gy', count: num(m[1]), phrase: m[2], label: 'Send ' + num(m[1]) + ' to the GY' });
    if (!why) why = costProblem(duel, p, card, costs);
    const unknown = /by (paying|revealing|shuffling|returning|removing)/.test(t) && !costs.length;
    return { effect: e, ok: !why, why: why, costs: costs, unknown: unknown, defense: /in defense position/.test(t) };
  }

  /* ---------- turning the effect's action into steps ---------- */

  const s1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);

  function zoneWords(l) {
    const zones = [];
    if (/hand/.test(l)) zones.push('hand');
    if (/deck/.test(l) && !/extra deck/.test(l)) zones.push('deck');
    if (/extra deck/.test(l)) zones.push('extra');
    if (/gy|graveyard/.test(l)) zones.push('gy');
    if (/banished/.test(l)) zones.push('banished');
    return zones;
  }

  /* Reads the action. Returns { steps, summary, manual } where each step is
     { ops:[...] } (runs as is) or { choose:{ pool, count, min, op, label, fromDeck, position } }
     or { fusion:[options], fromDeck } or { discard: n }. */
  function readAction(duel, p, card, e) {
    const o = duel.opp(p);
    const steps = [];
    const done = [];
    const action = e.action;
    const al = action.toLowerCase();
    const target = /target (up to )?((?:\d+|one|two|three|a|an) [^;]*)/i.exec(e.pre) || /target (up to )?((?:\d+|one|two|three|a|an) [^;.]*?)(?:[;.]|, and|$)/i.exec(e.action);
    let tspec = null;
    if (target) tspec = readSpec(duel, p, (target[1] || '') + target[2], card);
    let m;

    // Clauses, so we know which parts we understood.
    const clauses = action.split(/(?<=\.)\s+|,?\s*then,?\s+|;\s*|\.\s*also,?\s*|,?\s*and if (?:you|it) do(?:es)?,\s*|,?\s*also,\s*/i).map((x) => x.trim()).filter(Boolean);
    const understood = new Array(clauses.length).fill(false);
    const mark = (re) => { clauses.forEach((cl, i) => { if (re.test(cl.toLowerCase())) understood[i] = true; }); };

    // Fusion Summon (Polymerization-style).
    if (/fusion summon/.test(al) && /extra deck/.test(al)) {
      const fromDeck = /from your deck/.test(al);
      const sources = duel.players[p].hand.filter((x) => x.uid !== card.uid && duel.kind(x) === 'monster')
        .concat(duel.monsters(p).map((x) => x.card))
        .concat(fromDeck ? duel.players[p].deck.filter((x) => duel.kind(x) === 'monster') : []);
      steps.push({ fusion: fusionOptions(duel, p, sources), fromDeck: fromDeck });
      done.push('Fusion Summon');
      understood.fill(true);
    }

    if (!steps.length && (m = /\bdraw (\d+|one|two|three) cards?/.exec(al))) {
      steps.push({ ops: [{ op: 'draw', count: num(m[1]) }] });
      done.push('Draw ' + num(m[1]));
      mark(/\bdraw \S+ cards?/);
    }

    // Destroy everything of a kind.
    const allOf = (re, who, kindF, label) => {
      if (!re.test(al)) return false;
      const cards = [].concat(who.indexOf(o) !== -1 ? zoneCards(duel, o, kindF) : [], who.indexOf(p) !== -1 ? zoneCards(duel, p, kindF) : []).filter((x) => x.uid !== card.uid);
      const pos = /attack position/.test(al) ? cards.filter((x) => x.pos === 'atk') : /face-up/.test(al) ? cards.filter((x) => x.faceUp) : cards;
      const op = /banish all/.test(al) ? 'banish' : /return all/.test(al) ? 'to_hand' : 'destroy';
      steps.push({ ops: pos.map((x) => ({ op: op, card: x.uid, reason: card.name })) });
      done.push(label.replace('Destroy', op === 'banish' ? 'Banish' : op === 'to_hand' ? 'Return' : 'Destroy'));
      mark(re);
      return true;
    };
    if (!steps.length) {
      allOf(/(destroy|banish|return) all (face-up )?(attack position )?monsters (your opponent controls|on your opponent's field)|(destroy|banish|return) all (of )?your opponent's (face-up )?(attack position )?monsters/, [o], 'monsters', 'Destroy all your opponent\'s monsters') ||
      allOf(/(destroy|banish|return) all (face-up )?(attack position )?monsters on the field/, [o, p], 'monsters', 'Destroy all monsters on the field') ||
      allOf(/(destroy|banish|return) all (spells? and traps?|spell and trap cards|spell\/trap cards?) (your opponent controls|on your opponent's field)/, [o], 'st', 'Destroy all your opponent\'s Spells and Traps') ||
      allOf(/(destroy|banish|return) all (spells? and traps?|spell and trap cards|spell\/trap cards?) on the field/, [o, p], 'st', 'Destroy all Spells and Traps on the field') ||
      allOf(/(destroy|banish|return) all cards (your opponent controls|on your opponent's field)/, [o], 'field', 'Destroy all cards your opponent controls') ||
      allOf(/(destroy|banish|return) all (other )?cards on the field/, [o, p], 'field', 'Destroy all cards on the field');
    }

    // Targeted actions.
    if (!steps.length && tspec) {
      const verbs = [
        [/(destroy|destroying) (it|them|that target|those targets|that card|that monster|those cards|those monsters)/, 'destroy', 'Destroy'],
        [/banish (it|them|that target|those targets|that card|that monster)/, 'banish', 'Banish'],
        [/return (it|them|that target|that card|that monster)[^.]*hand|add (it|them) to (your|the owner's|its owner's) hand/, 'to_hand', 'Add/return to the hand'],
        [/shuffle (it|them|that target)[^.]*deck/, 'to_deck', 'Shuffle into the Deck'],
        [/take control of (it|that target|that monster)/, 'take_control', 'Take control of'],
        [/special summon (it|them|that target|that monster)/, 'special_summon', 'Special Summon'],
        [/change (it|that target|its battle position|that monster)[^.]*position/, 'change_position', 'Change the battle position of'],
        [/send (it|them|that target) to the (gy|graveyard)/, 'to_gy', 'Send to the GY']
      ];
      const v = verbs.find((x) => x[0].test(al));
      if (v) {
        steps.push({ choose: { pool: tspec.pool.map((x) => x.uid), count: tspec.count, min: tspec.upTo ? 1 : tspec.count, op: v[1], label: 'Choose ' + tspec.count + ' target' + (tspec.count > 1 ? 's' : ''), position: /defense position/.test(al) ? 'def' : 'atk', target: true } });
        done.push(v[2] + ' ' + tspec.count + ' target' + (tspec.count > 1 ? 's' : ''));
        mark(v[0]);
      } else if ((m = /(it|that monster|that target) (gains|loses) (\d+) atk/.exec(al)) || (m = /(gains|loses) (\d+) atk/.exec(al))) {
        const amt = Number(m[3] || m[2]) * (/loses/.test(m[0]) ? -1 : 1);
        steps.push({ choose: { pool: tspec.pool.map((x) => x.uid), count: 1, min: 1, op: 'modify_atk', amount: amt, label: 'Choose the monster', target: true } });
        done.push((amt > 0 ? 'Give ' : 'Take ') + Math.abs(amt) + ' ATK');
        mark(/(gains|loses) \d+ atk/);
      } else if (/negate (its|their|the) effects|negate the effects of (that|the targeted)/.test(al)) {
        steps.push({ choose: { pool: tspec.pool.map((x) => x.uid), count: tspec.count, min: 1, op: 'negate_effects', label: 'Choose the monster to negate', target: true } });
        done.push('Negate the effects of 1 target');
        mark(/negate (its|their|the) effects|negate the effects/);
      }
    }

    // Searches and other moves from the Deck / GY.
    if (!steps.length && (m = /add (up to )?(\d+|one|two|a) ([^.;]{1,160}?) from your ([a-z ,]+?) to your hand/i.exec(action))) {
      const zones = zoneWords(m[4].toLowerCase());
      const match = matcher(m[3], card);
      const pool = [].concat.apply([], zones.map((z) => zoneCards(duel, p, z))).filter((x) => x.uid !== card.uid && match(x));
      const seen = new Set();
      const unique = zones.length === 1 && zones[0] === 'deck' ? pool.filter((x) => (seen.has(x.name) ? false : seen.add(x.name))) : pool;
      steps.push({ choose: { pool: unique.map((x) => x.uid), count: num(m[2]), min: m[1] ? 1 : num(m[2]), op: 'to_hand', label: 'Choose a card to add to your hand', fromDeck: zones.indexOf('deck') !== -1 } });
      done.push('Add ' + num(m[2]) + ' ' + m[3].replace(/\s+/g, ' ') + ' from your ' + m[4] + ' to your hand');
      mark(/add .* to your hand/);
    }
    if (!steps.length && /special summon this card/.test(al)) {
      steps.push({ ops: [{ op: 'special_summon', card: card.uid, position: /defense position/.test(al) ? 'def' : 'atk', reason: 'its own effect' }] });
      done.push('Special Summon this card');
      mark(/special summon this card/);
    }
    if (!steps.length && (m = /special summon (up to )?(\d+|one|two|a) ([^.;]{1,160}?) from your ([a-z ,]+?)(?: in (attack|defense) position)?(?=[.,;]|$| in | but | and | to )/i.exec(action))) {
      const zones = zoneWords(m[4].toLowerCase());
      const match = matcher(m[3], card);
      const pool = [].concat.apply([], zones.map((z) => zoneCards(duel, p, z))).filter((x) => x.uid !== card.uid && duel.kind(x) === 'monster' && match(x));
      steps.push({ choose: { pool: pool.map((x) => x.uid), count: num(m[2]), min: m[1] ? 1 : num(m[2]), op: 'special_summon', label: 'Choose a monster to Special Summon', fromDeck: zones.indexOf('deck') !== -1, position: /defense position/i.test(action) ? 'def' : 'atk' } });
      done.push('Special Summon ' + num(m[2]) + ' ' + m[3].replace(/\s+/g, ' ') + ' from your ' + m[4]);
      mark(/special summon .* from your/);
    }
    if (!steps.length && (m = /send (\d+|one|two|a) ([^.;]{1,140}?) from your deck to the (gy|graveyard)/i.exec(action))) {
      const match = matcher(m[2], card);
      const seen = new Set();
      const pool = zoneCards(duel, p, 'deck').filter((x) => match(x) && (seen.has(x.name) ? false : seen.add(x.name)));
      steps.push({ choose: { pool: pool.map((x) => x.uid), count: num(m[1]), min: num(m[1]), op: 'to_gy', label: 'Choose a card to send to the GY', fromDeck: true } });
      done.push('Send ' + num(m[1]) + ' ' + m[2] + ' from your Deck to the GY');
      mark(/send .* from your deck to the (gy|graveyard)/);
    }
    if (!steps.length && (m = /set (\d+|one|a) ([^.;]{1,140}?) (?:directly )?from your (deck|gy|graveyard|hand)/i.exec(action))) {
      const match = matcher(m[2], card);
      const pool = zoneCards(duel, p, zoneWords(m[3].toLowerCase())[0] || 'deck').filter((x) => (duel.kind(x) === 'spell' || duel.kind(x) === 'trap') && match(x));
      steps.push({ choose: { pool: pool.map((x) => x.uid), count: 1, min: 1, op: 'set_st', label: 'Choose a card to Set', fromDeck: /deck/i.test(m[3]) } });
      done.push('Set ' + m[2] + ' from your ' + m[3]);
      mark(/\bset .* from your/);
    }
    if (!steps.length && (m = /(destroy|banish) (up to )?(\d+|one|two|a) ([^.;]*?(?:your opponent controls|on the field|in your opponent's (?:gy|graveyard)|in your (?:gy|graveyard)))/i.exec(action))) {
      const spec = readSpec(duel, p, (m[2] || '') + m[3] + ' ' + m[4], card);
      if (spec) {
        const op = m[1].toLowerCase() === 'banish' ? 'banish' : 'destroy';
        steps.push({ choose: { pool: spec.pool.map((x) => x.uid), count: spec.count, min: m[2] ? 1 : spec.count, op: op, label: 'Choose ' + spec.count + ' to ' + op } });
        done.push(s1(op) + ' ' + spec.count);
        mark(/(destroy|banish) (up to )?\S+ /);
      }
    }

    // Damage, LP and ATK changes (can follow another step).
    if ((m = /inflict (\d+) damage to your opponent/.exec(al))) { steps.push({ ops: [{ op: 'damage', amount: Number(m[1]), player: 'opponent', reason: card.name }] }); done.push('Inflict ' + m[1] + ' damage'); mark(/inflict \d+ damage to your opponent/); }
    if ((m = /inflict (\d+) damage to (both players|each player)/.exec(al))) { steps.push({ ops: [{ op: 'damage', amount: Number(m[1]), player: 'opponent', reason: card.name }, { op: 'damage', amount: Number(m[1]), player: 'self', reason: card.name }] }); done.push('Inflict ' + m[1] + ' damage to both players'); mark(/inflict \d+ damage to (both|each)/); }
    if ((m = /(?:^|[.,]\s*|you )gain (\d+) (lp|life points)/.exec(al))) { steps.push({ ops: [{ op: 'gain_lp', amount: Number(m[1]), reason: card.name }] }); done.push('Gain ' + m[1] + ' LP'); mark(/gain \d+ (lp|life points)/); }
    if (!steps.length && (m = /this card gains (\d+) atk/.exec(al)) && duel.find(card.uid) && zoneOf(duel.find(card.uid)) === 'field') {
      steps.push({ ops: [{ op: 'modify_atk', card: card.uid, amount: Number(m[1]), until_end_of_turn: /until the end of this turn|until the end of the turn/.test(al) }] });
      done.push('This card gains ' + m[1] + ' ATK'); mark(/this card gains \d+ atk/);
    }
    if ((m = /then,? discard (\d+|one|two|a) cards?|, then discard (\d+|one|two|a) cards?/.exec(al)) && steps.length) { steps.push({ discard: num(m[1] || m[2]) }); done.push('then discard ' + num(m[1] || m[2])); mark(/discard \S+ cards?/); }
    // Restrictions only limit what you do next; they need no action now.
    mark(/^\((this card is|this is|this card's name|this effect)|^(for the rest of this turn|you cannot|you can only|it cannot|this card cannot|that monster cannot|it is unaffected|its effects are negated|but (negate|it cannot|it has its effects negated)|but its effects are negated|if you do|if this card|that monster's effects are negated|the monster special summoned by this effect)/);

    const left = clauses.filter((cl, i) => !understood[i]).join(' ');
    return { steps: steps, summary: done.join(', then ').replace(/, then then/g, ', then'), manual: steps.length ? left : action };
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

  /* ---------- plans ---------- */

  /* Builds the plan for one effect. */
  function planFor(duel, p, card, e) {
    if (e.modes && e.modes.length) {
      const modes = e.modes.map((m) => { const pm = planFor(duel, p, card, m); pm.effect = e; pm.cost = readCosts(e); pm.modeText = m.text; return pm; });
      return { effect: e, modes: modes, summary: 'Choose 1 of ' + modes.length + ' effects', steps: [], ops: [], cost: readCosts(e), manual: '', understood: modes.some((m) => m.understood), notes: e.notes };
    }
    const r = readAction(duel, p, card, e);
    const costs = readCosts(e);
    const pl = {
      effect: e,
      summary: r.summary || 'Resolve by hand',
      steps: r.steps,
      manual: r.manual,
      cost: costs,
      ops: [],
      notes: e.notes
    };
    // Compatibility fields used by the bot and older callers.
    const firstChoose = r.steps.find((s) => s.choose);
    if (firstChoose) pl.choose = firstChoose.choose;
    const fus = r.steps.find((s) => s.fusion);
    if (fus) { pl.fusion = fus.fusion; pl.fromDeck = fus.fromDeck; }
    const disc = r.steps.find((s) => s.discard);
    if (disc) pl.discard = disc.discard;
    r.steps.filter((s) => s.ops).forEach((s) => { pl.ops = pl.ops.concat(s.ops); });
    pl.understood = r.steps.length > 0;
    return pl;
  }

  /* Plan for a card in a situation. ctx:
       { effect: index }                    a specific effect
       { summoned: 'normal'|'special'|true } its "if this card is … Summoned" effect
       { flip: true }                       its FLIP effect
       { attack: pendingAttack }            battle traps
       { activation: event }                negations (Ash Blossom, counter traps, Veiler…)
       { summon: uid }                      Trap Hole-style responses
       (none)                               a Spell/Trap's activation, or a monster's first usable effect
     Returns null when there's nothing to resolve. */
  function plan(duel, p, card, ctx) {
    const c = typeof card === 'string' ? duel.find(card).card : card;
    const context = ctx || {};
    const effs = effectsOf(c);
    const kind = duel.kind(c);
    const o = duel.opp(p);

    if (context.effect != null) { const e = effs[context.effect]; return e ? planFor(duel, p, c, e) : null; }

    // Battle traps (Mirror Force, Sakuretsu Armor, Negate Attack, Magic Cylinder…)
    if (context.attack) {
      const pa = context.attack;
      const e = effs.find((x) => (x.event || x.when || []).indexOf('attack') !== -1 && !x.pendulum) || (kind === 'trap' && /declares an attack/i.test(String(c.data.desc || '')) ? effs.find((x) => x.type === 'activation') : null);
      if (!e) return null;
      const t = e.text.toLowerCase();
      const base = { effect: e, cost: readCosts(e), steps: [], manual: '' };
      if (/destroy all (your opponent's )?attack position monsters|destroy all attack position monsters your opponent controls/.test(t)) {
        const pool = duel.monsters(o).filter((x) => x.card.faceUp && x.card.pos === 'atk').map((x) => x.card.uid);
        const ops = pool.map((u) => ({ op: 'destroy', card: u, reason: c.name }));
        return Object.assign(base, { summary: 'Destroy all of your opponent\'s Attack Position monsters', ops: ops, steps: [{ ops: ops }] });
      }
      if (/negate the attack/.test(t)) {
        const ops = [];
        if (/inflict damage to your opponent equal to its atk/.test(t)) ops.push({ op: 'damage', amount: duel.atk(duel.find(pa.attacker).card), player: 'opponent', reason: c.name });
        return Object.assign(base, { summary: 'Negate the attack' + (ops.length ? ' and inflict damage equal to its ATK' : ''), ops: ops, steps: [{ ops: ops }], negateAttack: true });
      }
      if (/target the attacking monster; destroy|destroy (the|that) attacking monster|destroy that target|destroy it/.test(t)) {
        const ops = [{ op: 'destroy', card: pa.attacker, reason: c.name }];
        return Object.assign(base, { summary: 'Destroy the attacking monster', ops: ops, steps: [{ ops: ops }] });
      }
      return null;
    }

    // Responses to an activation (chain): hand traps and counter traps.
    if (context.activation) {
      const ev = context.activation;
      const evText = String((ev.plan && ev.plan.effect && ev.plan.effect.text) || (ev.card && ev.card.data && ev.card.data.desc) || '').toLowerCase();
      const evSteps = (ev.plan && ev.plan.steps) || [];
      const fromDeck = evSteps.some((s) => (s.choose && s.choose.fromDeck) || (s.fusion && s.fromDeck)) || (ev.plan && ev.plan.choose && ev.plan.choose.fromDeck) ||
        /(add|special summon|send)[^.]{0,80}from (your|the) deck/.test(evText);
      for (const e of effs) {
        if (e.pendulum || ['quick', 'trigger', 'activation'].indexOf(e.type) === -1) continue;
        const t = e.text.toLowerCase();
        const base = { effect: e, cost: readCosts(e), steps: [], ops: [], manual: '' };
        if (/includes any of these effects/.test(t) && /negate that effect/.test(t)) {
          if (fromDeck) return Object.assign(base, { summary: 'Negate that effect', negateActivation: true });
          continue;
        }
        if (/negate the activation/.test(t) && (kind === 'trap' || e.quick)) {
          if (/spell card|trap card|spell\/trap/.test(t) && ev.kind === 'monster' && !/monster effect|card or effect/.test(t)) continue;
          if (/monster effect/.test(t) && !/spell|trap|card or effect/.test(t) && ev.kind !== 'monster') continue;
          const destroy = /and if you do, destroy (it|that card)|negate the activation, and if you do, destroy/.test(t);
          const ops = destroy ? [{ op: 'destroy', card: ev.card.uid, reason: c.name }] : [];
          return Object.assign(base, { summary: 'Negate the activation' + (destroy ? ' and destroy it' : ''), ops: ops, steps: [{ ops: ops }], negateActivation: true });
        }
        if (/negate (its|that monster's|the) effects|negate the effects of/.test(t) && ev.kind === 'monster' && ev.onField) {
          return Object.assign(base, { summary: 'Negate ' + ev.card.name + '\'s effects', negateActivation: true });
        }
      }
      return null;
    }

    // Responses to a summon (Bottomless Trap Hole, Torrential Tribute…).
    if (context.summon) {
      const e = effs.find((x) => (x.event || x.when || []).indexOf('summon') !== -1 && !x.pendulum);
      if (!e) return null;
      const t = e.text.toLowerCase();
      const target = duel.find(context.summon);
      const base = { effect: e, cost: readCosts(e), steps: [], manual: '' };
      if (/destroy all monsters on the field/.test(t)) {
        const ops = duel.monsters(0).concat(duel.monsters(1)).map((x) => ({ op: 'destroy', card: x.card.uid, reason: c.name }));
        return Object.assign(base, { summary: 'Destroy all monsters on the field', ops: ops, steps: [{ ops: ops }] });
      }
      if (target && /(destroy|banish)[^.]{0,60}(that|those|the summoned) monsters?|destroy (it|that target)|banish (it|that target)|(destroy|banish) (it|them)/.test(t)) {
        const need = /(\d+) or more atk/.exec(t);
        if (need && duel.atk(target.card) < Number(need[1])) return null;
        const op = /banish/.test(t) ? 'banish' : 'destroy';
        const ops = [{ op: op, card: target.card.uid, reason: c.name }];
        return Object.assign(base, { summary: (op === 'banish' ? 'Banish ' : 'Destroy ') + target.card.name, ops: ops, steps: [{ ops: ops }] });
      }
      if (target && /negate the summon/.test(t)) {
        const ops = [{ op: 'destroy', card: target.card.uid, reason: c.name }];
        return Object.assign(base, { summary: 'Negate the summon of ' + target.card.name + ' and destroy it', ops: ops, steps: [{ ops: ops }] });
      }
      return null;
    }

    if (context.flip) {
      const e = effs.find((x) => x.type === 'flip');
      return e ? planFor(duel, p, c, e) : null;
    }

    if (context.summoned) {
      const how = context.summoned === true ? null : context.summoned;
      const e = effs.find((x) => x.type === 'trigger' && x.event && (how ? x.event.indexOf(how) !== -1 : (x.event.indexOf('normal') !== -1 || x.event.indexOf('special') !== -1)));
      return e ? planFor(duel, p, c, e) : null;
    }

    if (kind === 'spell' || kind === 'trap') {
      const e = effs.find((x) => x.type === 'activation');
      return e ? planFor(duel, p, c, e) : null;
    }

    const first = options(duel, p, c).find((x) => x.ok);
    return first ? planFor(duel, p, c, first.effect) : null;
  }

  /* ---------- running a plan ---------- */

  function applyChoice(duel, p, ch, uid) {
    const loc = duel.find(uid);
    if (!loc) return;
    if (ch.op === 'to_hand' && loc.zone === 'deck') {
      duel.sendTo(uid, 'hand', false);
      duel.say(duel.pname(p) + ' ' + duel.v(p, 'adds', 'add') + ' ' + loc.card.name + ' from the Deck to the hand.', p);
    } else if (ch.op === 'to_gy' && loc.zone === 'deck') duel.sendTo(uid, 'gy', 'sent from the Deck');
    else if (ch.op === 'modify_atk') duel.applyOp(p, { op: 'modify_atk', card: uid, amount: ch.amount, until_end_of_turn: true });
    else duel.applyOp(p, { op: ch.op, card: uid, position: ch.position, reason: 'effect' });
  }

  /* Runs a plan. chosen: uids for the first "choose" step, or an array of arrays (one per choose step).
     Steps without a choice are picked automatically (the bot). */
  function run(duel, p, planObj, chosen, fusionPick) {
    const pl = planObj;
    const steps = pl.steps || [{ ops: pl.ops || [] }].concat(pl.choose ? [{ choose: pl.choose }] : []).concat(pl.fusion ? [{ fusion: pl.fusion }] : []);
    const perStep = Array.isArray(chosen) && Array.isArray(chosen[0]) ? chosen : [chosen];
    let k = 0;
    let shuffled = false;
    steps.forEach((s) => {
      if (duel.winner != null) return;
      if (s.ops) s.ops.forEach((op) => duel.applyOp(p, op));
      if (s.choose) {
        let picks = perStep[k++];
        if (!picks) picks = autoChoose(duel, p, { choose: s.choose });
        picks.slice(0, s.choose.count).forEach((uid) => {
          if (duel.find(uid) && duel.find(uid).zone === 'deck') shuffled = true;
          applyChoice(duel, p, s.choose, uid);
        });
      }
      if (s.fusion && s.fusion.length) {
        const f = fusionPick || s.fusion[0];
        duel.specialSummon(p, f.fusion.uid, 'atk', { materials: f.materials.map((x) => x.uid), how: 'Fusion Summon' });
      }
    });
    if (shuffled) duel.applyOp(p, { op: 'shuffle_deck' });
    if (pl.negateAttack) duel.negateAttack();
    duel.changed();
  }

  /* Bot's choice for a "choose" step: the best target. */
  function autoChoose(duel, p, pl) {
    const ch = pl.choose;
    if (!ch || !ch.pool.length) return [];
    const cards = ch.pool.map((u) => duel.find(u)).filter(Boolean).map((x) => x.card);
    const val = (c) => (duel.kind(c) === 'monster' ? Math.max(duel.atk(c), duel.def(c) * 0.8) + (Number(c.data.level) || 0) * 50 : 900);
    const mine = (c) => (c.controller != null ? c.controller : c.owner) === p;
    let sorted;
    if (['destroy', 'banish', 'take_control', 'negate_effects', 'change_position'].indexOf(ch.op) !== -1 || (ch.op === 'to_hand' && ch.target)) {
      sorted = cards.filter((c) => !mine(c)).sort((a, b) => val(b) - val(a));
      if (!sorted.length) sorted = [];
    } else if (ch.op === 'modify_atk') {
      sorted = cards.filter((c) => (ch.amount > 0 ? mine(c) : !mine(c))).sort((a, b) => val(b) - val(a));
    } else if (ch.fromDeck) {
      // Prefer monsters we can summon right away, then anything.
      sorted = cards.sort((a, b) => (duel.kind(b) === 'monster' ? 1 : 0) - (duel.kind(a) === 'monster' ? 1 : 0) || val(b) - val(a));
    } else sorted = cards.sort((a, b) => val(b) - val(a));
    return sorted.slice(0, ch.count).map((c) => c.uid);
  }

  App.Effects = {
    effectsOf: effectsOf,
    options: options,
    procedure: procedure,
    activationProblem: activationProblem,
    plan: plan,
    planFor: planFor,
    run: run,
    autoChoose: autoChoose,
    fusionOptions: fusionOptions,
    readCosts: readCosts,
    costProblem: costProblem,
    costPool: costPool,
    payCost: payCost,
    autoCost: autoCost,
    used: used,
    markUsed: markUsed,
    matcher: matcher
  };
})(window.App);
