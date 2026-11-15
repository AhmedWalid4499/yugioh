/* Duel engine: the game state and the rules it enforces automatically —
   turn and phase order, drawing, Normal/Tribute Summons, setting cards,
   Spell/Trap timing, position changes, battle and damage, LP and win
   conditions. Card effects are applied as small generic "ops" (draw,
   destroy, special summon, search, damage…) chosen by the player, the
   built-in bot's effect reader, or the Claude opponent. */
(function (App) {
  'use strict';

  const api = App.api;
  let seq = 0;

  const PHASES = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'];
  const PHASE_LABEL = { draw: 'Draw Phase', standby: 'Standby Phase', main1: 'Main Phase 1', battle: 'Battle Phase', main2: 'Main Phase 2', end: 'End Phase' };

  function instance(base, owner) {
    return {
      uid: 'c' + (++seq),
      id: base.id,
      name: base.name,
      data: base,
      owner: owner,
      faceUp: true,
      pos: 'atk',
      setTurn: null,
      summonTurn: null,
      attacked: false,
      posChanged: false,
      atkMod: 0,
      defMod: 0,
      materials: []
    };
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function Duel(opts) {
    const fmt = App.formats.get(opts.format);
    this.format = fmt;
    this.turn = 0;
    this.phase = 'draw';
    this.active = opts.first;
    this.first = opts.first;
    this.winner = null;
    this.log = [];
    this.listeners = [];
    this.pendingAttack = null;
    this.emz = new Array(fmt.extraMonsterZones).fill(null);
    this.players = [0, 1].map((p) => {
      const deckSpec = opts.decks[p];
      const pl = {
        index: p,
        name: deckSpec.playerName,
        deckName: deckSpec.name,
        lp: opts.lp || fmt.lp,
        deck: shuffle(deckSpec.main.map((c) => instance(c, p))),
        extra: deckSpec.extra.map((c) => instance(c, p)),
        hand: [],
        mz: new Array(fmt.monsterZones).fill(null),
        st: new Array(fmt.spellZones).fill(null),
        field: null,
        gy: [],
        banished: [],
        normalSummoned: false
      };
      return pl;
    });
    this.players.forEach((pl) => this.draw(pl.index, fmt.hand, true));
    this.startTurn();
  }

  const P = Duel.prototype;

  /* ---------- events & log ---------- */

  P.on = function (fn) { this.listeners.push(fn); };
  /* Effects channel for sounds and animations: fx(type, data). Types: draw, summon,
     special, set, activate, attack, destroy, damage, gain, phase, turn, win, lose, move. */
  P.onFx = function (fn) { (this.fxListeners = this.fxListeners || []).push(fn); };
  P.fx = function (type, data) { (this.fxListeners || []).forEach((fn) => { try { fn(type, data || {}); } catch (e) { console.error(e); } }); };
  P.changed = function () { this.listeners.forEach((fn) => { try { fn(this); } catch (e) { console.error(e); } }); };
  P.say = function (text, who) {
    this.log.push({ turn: this.turn, text: text, who: who == null ? null : who });
    if (this.log.length > 400) this.log.shift();
  };
  P.opp = function (p) { return 1 - p; };
  /* Verb agreement: "You draw" vs "Bot draws". */
  P.v = function (p, third, base) { return this.players[p].name === 'You' ? base : third; };
  P.pname = function (p) { return this.players[p].name; };

  /* ---------- lookups ---------- */

  P.all = function () {
    const out = [];
    this.players.forEach((pl) => {
      ['hand', 'deck', 'extra', 'gy', 'banished'].forEach((z) => pl[z].forEach((c, i) => out.push({ card: c, player: pl.index, zone: z, index: i })));
      pl.mz.forEach((c, i) => c && out.push({ card: c, player: pl.index, zone: 'mz', index: i }));
      pl.st.forEach((c, i) => c && out.push({ card: c, player: pl.index, zone: 'st', index: i }));
      if (pl.field) out.push({ card: pl.field, player: pl.index, zone: 'field', index: 0 });
    });
    this.emz.forEach((c, i) => c && out.push({ card: c, player: c.controller != null ? c.controller : c.owner, zone: 'emz', index: i }));
    return out;
  };
  P.find = function (uid) { return this.all().find((x) => x.card.uid === uid) || null; };

  /* Monsters a player controls, with where they are. */
  P.monsters = function (p) {
    const out = [];
    this.players[p].mz.forEach((c, i) => c && out.push({ card: c, zone: 'mz', index: i }));
    this.emz.forEach((c, i) => c && c.controller === p && out.push({ card: c, zone: 'emz', index: i }));
    return out;
  };
  P.spellsTraps = function (p) {
    const pl = this.players[p];
    const out = [];
    pl.st.forEach((c, i) => c && out.push({ card: c, zone: 'st', index: i }));
    if (pl.field) out.push({ card: pl.field, zone: 'field', index: 0 });
    return out;
  };
  P.freeMz = function (p) { return this.players[p].mz.findIndex((c) => !c); };
  P.freeSt = function (p) { return this.players[p].st.findIndex((c) => !c); };
  P.freeEmz = function () { return this.emz.findIndex((c) => !c); };

  P.atk = function (c) { return Math.max(0, (Number(c.data.atk) || 0) + (c.atkMod || 0)); };
  P.def = function (c) { return Math.max(0, (Number(c.data.def) || 0) + (c.defMod || 0)); };
  P.kind = function (c) { return api.kind(c.data); };
  P.isExtra = function (c) { return api.isExtraDeck(c.data); };
  P.level = function (c) { return Number(c.data.level) || 0; };

  /* ---------- moving cards (the primitive every effect uses) ---------- */

  P.remove = function (uid) {
    const loc = this.find(uid);
    if (!loc) return null;
    const pl = this.players[loc.player];
    if (loc.zone === 'mz') pl.mz[loc.index] = null;
    else if (loc.zone === 'st') pl.st[loc.index] = null;
    else if (loc.zone === 'field') pl.field = null;
    else if (loc.zone === 'emz') this.emz[loc.index] = null;
    else pl[loc.zone].splice(loc.index, 1);
    return loc;
  };

  function resetOnLeave(c) {
    c.faceUp = true;
    c.pos = 'atk';
    c.setTurn = null;
    c.summonTurn = null;
    c.attacked = false;
    c.posChanged = false;
    c.atkMod = 0;
    c.defMod = 0;
    c.controller = undefined;
  }

  /* dest: 'hand' | 'gy' | 'banished' | 'deckTop' | 'deckBottom' | 'deck' (shuffle) | 'extra' */
  P.sendTo = function (uid, dest, why) {
    const loc = this.remove(uid);
    if (!loc) return false;
    const c = loc.card;
    const onField = ['mz', 'st', 'field', 'emz'].indexOf(loc.zone) !== -1;
    // Xyz materials go to the GY when the Xyz monster leaves the field.
    if (onField && c.materials.length) {
      c.materials.forEach((m) => { resetOnLeave(m); this.players[m.owner].gy.push(m); });
      c.materials = [];
    }
    resetOnLeave(c);
    const owner = this.players[c.owner];
    let to = dest;
    if (this.isExtra(c) && ['hand', 'deck', 'deckTop', 'deckBottom'].indexOf(dest) !== -1) to = 'extra';
    if (to === 'hand') owner.hand.push(c);
    else if (to === 'gy') owner.gy.push(c);
    else if (to === 'banished') owner.banished.push(c);
    else if (to === 'extra') owner.extra.push(c);
    else if (to === 'deckTop') owner.deck.unshift(c);
    else if (to === 'deckBottom') owner.deck.push(c);
    else if (to === 'deck') { owner.deck.push(c); shuffle(owner.deck); }
    if (why !== false && (to === 'gy' || to === 'banished')) this.fx('move', { uid: uid, to: to, from: loc.zone, player: c.owner });
    const label = { hand: 'to the hand', gy: 'to the GY', banished: 'banished', extra: 'to the Extra Deck', deckTop: 'to the top of the Deck', deckBottom: 'to the bottom of the Deck', deck: 'shuffled into the Deck' }[to];
    if (why !== false) this.say(c.name + ' ' + (to === 'banished' ? 'is banished' : 'goes ' + label) + (why ? ' (' + why + ')' : '') + '.');
    return true;
  };

  P.destroy = function (uid, why) {
    const loc = this.find(uid);
    if (!loc) return false;
    this.say(loc.card.name + ' is destroyed' + (why ? ' by ' + why : '') + '.');
    this.fx('destroy', { uid: uid, player: loc.player });
    return this.sendTo(uid, 'gy', false);
  };

  /* Place a monster on the field. zone: {mz:i} or {emz:i} or null (first free). */
  P.placeMonster = function (p, uid, opts) {
    const o = opts || {};
    const loc = this.find(uid);
    if (!loc) return { ok: false, message: 'Card not found.' };
    const c = loc.card;
    let target = o.zone;
    if (!target) {
      if (this.isExtra(c) && this.emz.length && /link/i.test(c.data.type) && this.freeEmz() !== -1) target = { emz: this.freeEmz() };
      else if (this.freeMz(p) !== -1) target = { mz: this.freeMz(p) };
      else if (this.isExtra(c) && this.freeEmz() !== -1) target = { emz: this.freeEmz() };
    }
    if (!target) return { ok: false, message: 'No free Monster Zone.' };
    if (target.mz != null && this.players[p].mz[target.mz]) return { ok: false, message: 'That Monster Zone is taken.' };
    if (target.emz != null && this.emz[target.emz]) return { ok: false, message: 'That Extra Monster Zone is taken.' };
    this.remove(uid);
    if (loc.zone !== 'mz' && loc.zone !== 'emz') resetOnLeave(c);
    c.controller = p;
    c.pos = o.pos === 'def' || o.pos === 'set' ? 'def' : 'atk';
    c.faceUp = o.pos !== 'set';
    c.summonTurn = this.turn;
    if (target.mz != null) this.players[p].mz[target.mz] = c; else this.emz[target.emz] = c;
    return { ok: true, card: c };
  };

  /* ---------- turn structure ---------- */

  P.startTurn = function () {
    this.turn += 1;
    const p = this.active;
    const pl = this.players[p];
    pl.normalSummoned = false;
    this.monsters(p).forEach((m) => { m.card.attacked = false; m.card.posChanged = false; });
    this.phase = 'draw';
    this.say('— Turn ' + this.turn + ': ' + pl.name + ' —');
    this.fx('turn', { player: p, turn: this.turn, name: pl.name });
    const skipDraw = this.turn === 1 && !this.format.firstPlayerDraws;
    if (!skipDraw) this.draw(p, 1);
    if (this.winner == null) this.phase = 'main1';
    this.changed();
  };

  P.canEnterBattle = function () { return this.turn > 1; };

  P.nextPhase = function () {
    if (this.winner != null) return;
    if (this.phase === 'main1') this.phase = this.canEnterBattle() ? 'battle' : 'end';
    else if (this.phase === 'battle') this.phase = 'main2';
    else if (this.phase === 'main2') this.phase = 'end';
    else if (this.phase === 'end') { this.endTurn(); return; }
    else this.phase = 'main1';
    this.say(this.pname(this.active) + ' ' + this.v(this.active, 'enters', 'enter') + ' the ' + PHASE_LABEL[this.phase] + '.');
    this.fx('phase', { phase: this.phase, label: PHASE_LABEL[this.phase], player: this.active });
    this.changed();
  };

  /* Returns the number of cards the active player must discard first. */
  P.handOverflow = function () {
    return Math.max(0, this.players[this.active].hand.length - 6);
  };

  P.endTurn = function () {
    if (this.winner != null) return;
    this.phase = 'end';
    // Temporary ATK/DEF changes "until the end of this turn" are cleared.
    this.all().forEach((x) => { if (['mz', 'emz'].indexOf(x.zone) !== -1 && x.card.tempMod) { x.card.atkMod -= x.card.tempMod.atk; x.card.defMod -= x.card.tempMod.def; x.card.tempMod = null; } });
    this.active = this.opp(this.active);
    this.startTurn();
  };

  P.draw = function (p, n, silent) {
    const pl = this.players[p];
    let drawn = 0;
    for (let i = 0; i < (n || 1); i++) {
      if (!pl.deck.length) {
        if (!silent) this.lose(p, pl.name + ' cannot draw — their Deck is empty');
        return drawn;
      }
      pl.hand.push(pl.deck.shift());
      drawn++;
    }
    if (!silent) { this.say(pl.name + ' ' + this.v(p, 'draws', 'draw') + ' ' + (drawn === 1 ? 'a card' : drawn + ' cards') + '.', p); this.fx('draw', { player: p, count: drawn }); }
    return drawn;
  };

  P.lose = function (p, why) {
    if (this.winner != null) return;
    this.winner = this.opp(p);
    this.say('🏆 ' + this.pname(this.winner) + ' ' + this.v(this.winner, 'wins', 'win') + '! (' + why + ')');
    this.fx(this.winner === 0 ? 'win' : 'lose', { winner: this.winner });
    this.changed();
  };

  P.changeLp = function (p, delta, why) {
    const pl = this.players[p];
    const before = pl.lp;
    pl.lp = Math.max(0, pl.lp + delta);
    this.fx(delta < 0 ? 'damage' : 'gain', { player: p, amount: Math.abs(delta), from: before, to: pl.lp });
    this.say(pl.name + (delta < 0 ? ' ' + this.v(p, 'takes', 'take') + ' ' + (-delta) + ' damage' : ' ' + this.v(p, 'gains', 'gain') + ' ' + delta + ' LP') + (why ? ' (' + why + ')' : '') + '. LP: ' + pl.lp + '.', p);
    if (pl.lp <= 0) this.lose(p, pl.name + '\'s LP reached 0');
  };

  /* ---------- player actions (rules-checked) ---------- */

  function fail(message) { return { ok: false, message: message }; }

  P.isMain = function () { return this.phase === 'main1' || this.phase === 'main2'; };

  P.tributesNeeded = function (c) {
    const lvl = this.level(c);
    if (lvl >= 7) return 2;
    if (lvl >= 5) return 1;
    return 0;
  };

  /* Normal Summon (pos 'atk') or Set (pos 'set') a monster from the hand. */
  P.normalSummon = function (p, uid, pos, tributes, zone) {
    if (this.winner != null) return fail('The duel is over.');
    if (p !== this.active || !this.isMain()) return fail('You can only Normal Summon in your own Main Phase.');
    const pl = this.players[p];
    if (pl.normalSummoned) return fail('You already Normal Summoned or Set a monster this turn.');
    const c = pl.hand.find((x) => x.uid === uid);
    if (!c || this.kind(c) !== 'monster' || this.isExtra(c)) return fail('Only Main Deck monsters in your hand can be Normal Summoned.');
    if (/cannot be normal summoned/i.test(c.data.desc || '')) return fail(c.name + ' cannot be Normal Summoned or Set.');
    const need = this.tributesNeeded(c);
    const trib = (tributes || []).filter((t) => this.monsters(p).some((m) => m.card.uid === t)).slice(0, need);
    if (trib.length < need) return fail(c.name + ' needs ' + need + ' Tribute' + (need > 1 ? 's' : '') + '.');
    trib.forEach((t) => this.sendTo(t, 'gy', 'Tribute'));
    if (zone && zone.mz != null && pl.mz[zone.mz] && trib.indexOf(pl.mz[zone.mz].uid) === -1) zone = null;
    const res = this.placeMonster(p, uid, { pos: pos === 'set' ? 'set' : 'atk', zone: zone && zone.mz != null && !pl.mz[zone.mz] ? zone : null });
    if (!res.ok) return res;
    pl.normalSummoned = true;
    this.fx(pos === 'set' ? 'set' : 'summon', { uid: uid, player: p, tribute: need > 0 });
    this.say(pl.name + (pos === 'set' ? ' ' + this.v(p, 'Sets', 'Set') + ' a monster.' : (need ? ' ' + this.v(p, 'Tribute Summons', 'Tribute Summon') + ' ' : ' ' + this.v(p, 'Normal Summons', 'Normal Summon') + ' ') + c.name + ' (' + this.atk(c) + ' ATK).'), p);
    this.changed();
    return { ok: true };
  };

  /* Special Summon from anywhere (effects, Extra Deck summons). */
  P.specialSummon = function (p, uid, pos, opts) {
    const o = opts || {};
    const loc = this.find(uid);
    if (!loc) return fail('Card not found.');
    if (this.kind(loc.card) !== 'monster') return fail('Only monsters can be Special Summoned.');
    const materials = (o.materials || []).filter((m) => m !== uid && this.find(m));
    const isXyz = /xyz/i.test(loc.card.data.type);
    const mats = [];
    materials.forEach((m) => {
      if (isXyz) { const ml = this.remove(m); if (ml) { resetOnLeave(ml.card); mats.push(ml.card); } }
      else this.sendTo(m, 'gy', 'material');
    });
    const res = this.placeMonster(p, uid, { pos: pos, zone: o.zone });
    if (!res.ok) {
      mats.forEach((m) => this.players[m.owner].gy.push(m));
      return res;
    }
    if (isXyz) res.card.materials = mats;
    this.fx('special', { uid: res.card.uid, player: p, how: o.how || '', extra: this.isExtra(res.card) });
    this.say(this.pname(p) + ' ' + this.v(p, 'Special Summons', 'Special Summon') + ' ' + res.card.name + (o.how ? ' (' + o.how + ')' : '') + (pos === 'set' ? ' face-down' : '') + '.', p);
    this.changed();
    return { ok: true };
  };

  /* Set a Spell/Trap from the hand. */
  P.setSpellTrap = function (p, uid, zoneIndex) {
    if (p !== this.active || !this.isMain()) return fail('You can only Set Spells/Traps in your own Main Phase.');
    const pl = this.players[p];
    const c = pl.hand.find((x) => x.uid === uid);
    if (!c || ['spell', 'trap'].indexOf(this.kind(c)) === -1) return fail('Only Spells and Traps can be Set.');
    const isField = this.kind(c) === 'spell' && /Field/.test(c.data.race || '');
    if (isField) {
      if (pl.field) this.sendTo(pl.field.uid, 'gy', 'replaced');
      this.remove(uid);
      pl.field = c;
    } else {
      const z = zoneIndex != null && !pl.st[zoneIndex] ? zoneIndex : this.freeSt(p);
      if (z === -1) return fail('Your Spell & Trap Zones are full.');
      this.remove(uid);
      pl.st[z] = c;
    }
    c.faceUp = false;
    c.setTurn = this.turn;
    this.fx('set', { uid: uid, player: p, spellTrap: true });
    this.say(pl.name + ' ' + this.v(p, 'Sets', 'Set') + ' a card.', p);
    this.changed();
    return { ok: true };
  };

  P.stays = function (c) {
    if (this.kind(c) === 'spell') return /Continuous|Field|Equip/.test(c.data.race || '');
    if (this.kind(c) === 'trap') return /Continuous/.test(c.data.race || '') || /\bequip\b/i.test(c.data.desc || '');
    return false;
  };

  /* Activate a Spell/Trap (from hand or Set). Places it face-up and returns it;
     call finishActivation() after the effect resolves. */
  P.activateSpellTrap = function (p, uid, zoneIndex) {
    if (this.winner != null) return fail('The duel is over.');
    const loc = this.find(uid);
    if (!loc || loc.player !== p) return fail('That card is not yours.');
    const c = loc.card;
    const kind = this.kind(c);
    if (['spell', 'trap'].indexOf(kind) === -1) return fail('Not a Spell or Trap.');
    const quick = kind === 'trap' || /Quick-Play/.test(c.data.race || '');
    const myTurn = p === this.active;
    if (kind === 'spell' && !quick && !(myTurn && this.isMain())) return fail('Normal Spells can only be activated in your Main Phase.');
    if (/Quick-Play/.test(c.data.race || '') && !myTurn && loc.zone === 'hand') return fail('Quick-Play Spells can only be activated from the hand during your turn.');
    if (kind === 'trap') {
      const fromHand = loc.zone === 'hand';
      if (fromHand && !/activate this card from your hand/i.test(c.data.desc || '')) return fail('Traps must be Set first.');
      if (!fromHand && (c.setTurn == null || c.setTurn >= this.turn)) return fail('A Trap cannot be activated the turn it was Set.');
    }
    if (loc.zone === 'hand') {
      const pl = this.players[p];
      const isField = kind === 'spell' && /Field/.test(c.data.race || '');
      if (isField) {
        if (pl.field) this.sendTo(pl.field.uid, 'gy', 'replaced');
        this.remove(uid);
        pl.field = c;
      } else {
        const z = zoneIndex != null && !pl.st[zoneIndex] ? zoneIndex : this.freeSt(p);
        if (z === -1) return fail('Your Spell & Trap Zones are full.');
        this.remove(uid);
        pl.st[z] = c;
      }
    }
    c.faceUp = true;
    this.fx('activate', { uid: uid, player: p, kind: kind });
    this.say(this.pname(p) + ' ' + this.v(p, 'activates', 'activate') + ' ' + c.name + '.', p);
    this.changed();
    return { ok: true, card: c };
  };

  P.finishActivation = function (uid) {
    const loc = this.find(uid);
    if (!loc || ['st', 'field'].indexOf(loc.zone) === -1) return;
    if (!this.stays(loc.card)) this.sendTo(uid, 'gy', false);
    this.changed();
  };

  P.changePosition = function (p, uid) {
    if (p !== this.active || !this.isMain()) return fail('You can only change positions in your own Main Phase.');
    const m = this.monsters(p).find((x) => x.card.uid === uid);
    if (!m) return fail('Not your monster.');
    const c = m.card;
    if (c.summonTurn === this.turn) return fail('A monster cannot change position the turn it was summoned.');
    if (c.posChanged || c.attacked) return fail('This monster already changed position or attacked this turn.');
    if (!c.faceUp) { c.faceUp = true; c.pos = 'atk'; this.say(this.pname(p) + ' ' + this.v(p, 'Flip Summons', 'Flip Summon') + ' ' + c.name + '.', p); }
    else { c.pos = c.pos === 'atk' ? 'def' : 'atk'; this.say(c.name + ' changes to ' + (c.pos === 'atk' ? 'Attack' : 'Defense') + ' Position.', p); }
    c.posChanged = true;
    this.changed();
    return { ok: true };
  };

  /* ---------- battle ---------- */

  P.canAttack = function (p, uid) {
    if (this.winner != null) return fail('The duel is over.');
    if (p !== this.active || this.phase !== 'battle') return fail('Attacks happen in your Battle Phase.');
    const m = this.monsters(p).find((x) => x.card.uid === uid);
    if (!m) return fail('Not your monster.');
    if (!m.card.faceUp || m.card.pos !== 'atk') return fail('Only face-up Attack Position monsters can attack.');
    if (m.card.attacked) return fail(m.card.name + ' already attacked this turn.');
    if (/cannot attack/i.test(m.card.data.desc || '') && /this card cannot attack/i.test(m.card.data.desc || '')) return fail(m.card.name + ' cannot attack.');
    return { ok: true, card: m.card };
  };

  /* Declares an attack; returns a pending attack the defender may respond to. */
  P.declareAttack = function (p, uid, targetUid) {
    const chk = this.canAttack(p, uid);
    if (!chk.ok) return chk;
    const o = this.opp(p);
    const defenders = this.monsters(o);
    if (!targetUid && defenders.length) return fail('Your opponent controls monsters, so you must attack one of them.');
    if (targetUid && !defenders.some((d) => d.card.uid === targetUid)) return fail('Pick one of your opponent\'s monsters.');
    chk.card.attacked = true;
    const target = targetUid ? this.find(targetUid).card : null;
    this.pendingAttack = { attacker: uid, target: targetUid || null, player: p };
    this.fx('attack', { attacker: uid, target: targetUid || null, player: p });
    this.say(chk.card.name + ' attacks ' + (target ? (target.faceUp ? target.name : 'a face-down monster') : this.pname(o) + ' directly') + '!', p);
    this.changed();
    return { ok: true, pending: this.pendingAttack };
  };

  P.negateAttack = function () {
    if (this.pendingAttack) this.say('The attack is negated.');
    this.pendingAttack = null;
    this.changed();
  };

  /* Damage calculation for the pending attack. */
  P.resolveAttack = function () {
    const pa = this.pendingAttack;
    this.pendingAttack = null;
    if (!pa || this.winner != null) { this.changed(); return; }
    const aLoc = this.find(pa.attacker);
    if (!aLoc || ['mz', 'emz'].indexOf(aLoc.zone) === -1) { this.say('The attacking monster is no longer on the field.'); this.changed(); return; }
    const a = aLoc.card;
    const p = pa.player;
    const o = this.opp(p);
    if (!pa.target) {
      this.changeLp(o, -this.atk(a), a.name + '\'s direct attack');
      this.changed();
      return;
    }
    const tLoc = this.find(pa.target);
    if (!tLoc || ['mz', 'emz'].indexOf(tLoc.zone) === -1) { this.say('The attack target is gone, so the attack ends.'); this.changed(); return; }
    const t = tLoc.card;
    if (!t.faceUp) { t.faceUp = true; this.say(t.name + ' is flipped face-up (' + this.atk(t) + '/' + this.def(t) + ').'); }
    const av = this.atk(a);
    const pierce = /piercing|inflict piercing/i.test(a.data.desc || '');
    if (t.pos === 'atk') {
      const tv = this.atk(t);
      if (av > tv) { this.destroy(t.uid, 'battle'); this.changeLp(o, -(av - tv), 'battle'); }
      else if (av < tv) { this.destroy(a.uid, 'battle'); this.changeLp(p, -(tv - av), 'battle'); }
      else if (av > 0) { this.destroy(a.uid, 'battle'); this.destroy(t.uid, 'battle'); }
      else this.say('Both monsters have 0 ATK; nothing happens.');
    } else {
      const dv = this.def(t);
      if (av > dv) { this.destroy(t.uid, 'battle'); if (pierce) this.changeLp(o, -(av - dv), 'piercing damage'); }
      else if (av < dv) this.changeLp(p, -(dv - av), 'attacking a stronger defender');
      else this.say('Neither monster is destroyed.');
    }
    this.changed();
  };

  /* ---------- generic effect ops ---------- */

  /* Searches a player's deck by name (exact or partial) */
  P.findInDeck = function (p, query) {
    const q = String(query || '').toLowerCase();
    const deck = this.players[p].deck;
    return deck.find((c) => c.name.toLowerCase() === q) || deck.find((c) => c.name.toLowerCase().indexOf(q) !== -1) || null;
  };

  /* Applies one op. Supported:
     {op:'draw', count}, {op:'damage', amount, player:'self'|'opponent'}, {op:'gain_lp', amount},
     {op:'destroy'|'banish'|'to_hand'|'to_gy'|'to_deck'|'to_deck_top', card},
     {op:'special_summon', card, position}, {op:'search', name}, {op:'send_from_deck', name},
     {op:'change_position', card}, {op:'modify_atk', card, amount, until_end_of_turn},
     {op:'discard', card}, {op:'shuffle_deck'}, {op:'take_control', card} */
  P.applyOp = function (p, op) {
    if (!op || this.winner != null) return fail('Nothing to do.');
    const o = this.opp(p);
    const card = op.card ? this.find(op.card) : null;
    const needCard = () => card ? null : fail('Unknown card ' + op.card + '.');
    switch (op.op) {
      case 'draw': this.draw(p, Math.max(1, Math.min(5, Number(op.count) || 1))); break;
      case 'damage': this.changeLp(op.player === 'self' ? p : o, -Math.abs(Number(op.amount) || 0), op.reason || 'effect damage'); break;
      case 'gain_lp': this.changeLp(p, Math.abs(Number(op.amount) || 0), op.reason || 'effect'); break;
      case 'destroy': if (needCard()) return needCard(); this.destroy(card.card.uid, op.reason || 'an effect'); break;
      case 'banish': if (needCard()) return needCard(); this.sendTo(card.card.uid, 'banished'); break;
      case 'to_hand': if (needCard()) return needCard(); this.sendTo(card.card.uid, 'hand'); break;
      case 'discard':
      case 'to_gy': if (needCard()) return needCard(); this.sendTo(card.card.uid, 'gy'); break;
      case 'to_deck': if (needCard()) return needCard(); this.sendTo(card.card.uid, 'deck'); break;
      case 'to_deck_top': if (needCard()) return needCard(); this.sendTo(card.card.uid, 'deckTop'); break;
      case 'special_summon': {
        if (needCard()) return needCard();
        const r = this.specialSummon(p, card.card.uid, op.position === 'defense' || op.position === 'def' ? 'def' : 'atk', { how: op.reason || 'effect' });
        if (!r.ok) return r;
        break;
      }
      case 'search': {
        const c = this.findInDeck(p, op.name);
        if (!c) return fail('No "' + op.name + '" left in the Deck.');
        this.sendTo(c.uid, 'hand', false);
        this.say(this.pname(p) + ' ' + this.v(p, 'adds', 'add') + ' ' + c.name + ' from the Deck to the hand.', p);
        break;
      }
      case 'send_from_deck': {
        const c = this.findInDeck(p, op.name);
        if (!c) return fail('No "' + op.name + '" left in the Deck.');
        this.sendTo(c.uid, 'gy', 'sent from the Deck');
        break;
      }
      case 'change_position': {
        if (needCard()) return needCard();
        const c = card.card;
        if (!c.faceUp) c.faceUp = true;
        c.pos = c.pos === 'atk' ? 'def' : 'atk';
        this.say(c.name + ' is changed to ' + (c.pos === 'atk' ? 'Attack' : 'Defense') + ' Position.');
        break;
      }
      case 'flip_face_down': {
        if (needCard()) return needCard();
        card.card.faceUp = false; card.card.pos = 'def';
        this.say(card.card.name + ' is changed to face-down Defense Position.');
        break;
      }
      case 'modify_atk': {
        if (needCard()) return needCard();
        const amt = Number(op.amount) || 0;
        card.card.atkMod += amt;
        if (op.until_end_of_turn) { card.card.tempMod = card.card.tempMod || { atk: 0, def: 0 }; card.card.tempMod.atk += amt; }
        this.say(card.card.name + (amt >= 0 ? ' gains ' : ' loses ') + Math.abs(amt) + ' ATK (now ' + this.atk(card.card) + ').');
        break;
      }
      case 'take_control': {
        if (needCard()) return needCard();
        const c = card.card;
        const z = this.freeMz(p);
        if (z === -1) return fail('No free Monster Zone to take control.');
        this.remove(c.uid);
        c.controller = p;
        this.players[p].mz[z] = c;
        this.say(this.pname(p) + ' ' + this.v(p, 'takes', 'take') + ' control of ' + c.name + '.', p);
        break;
      }
      case 'shuffle_deck': shuffle(this.players[p].deck); this.say(this.pname(p) + ' ' + this.v(p, 'shuffles their', 'shuffle your') + ' Deck.', p); break;
      default: return fail('Unknown op ' + op.op + '.');
    }
    this.changed();
    return { ok: true };
  };

  /* ---------- a compact, JSON-friendly view of the game (for the Claude opponent) ---------- */

  P.cardView = function (c, hidden) {
    if (hidden) return { uid: c.uid, name: 'Face-down card', face_down: true, position: c.pos === 'atk' ? 'attack' : 'defense' };
    const d = c.data;
    const v = { uid: c.uid, name: c.name, type: d.type };
    if (this.kind(c) === 'monster') {
      v.level = d.level; v.atk = this.atk(c); v.def = /link/i.test(d.type) ? undefined : this.def(c);
      v.attribute = d.attribute; v.race = d.race;
    } else v.subtype = d.race;
    if (c.faceUp === false) v.face_down = true;
    if (c.pos) v.position = c.pos === 'atk' ? 'attack' : 'defense';
    if (c.materials && c.materials.length) v.materials = c.materials.map((m) => m.name);
    v.text = String(d.desc || '').slice(0, 700);
    return v;
  };

  P.snapshot = function (me) {
    const o = this.opp(me);
    const mine = this.players[me];
    const theirs = this.players[o];
    const field = (p, hideFaceDown) => ({
      monsters: this.monsters(p).map((m) => Object.assign({ zone: m.zone + (m.index + 1), attacked_this_turn: m.card.attacked, summoned_this_turn: m.card.summonTurn === this.turn }, this.cardView(m.card, hideFaceDown && !m.card.faceUp))),
      spells_traps: this.spellsTraps(p).map((s) => Object.assign({ zone: s.zone + (s.index + 1), set_this_turn: s.card.setTurn === this.turn }, this.cardView(s.card, hideFaceDown && !s.card.faceUp)))
    });
    return {
      format: this.format.label,
      turn: this.turn,
      phase: PHASE_LABEL[this.phase],
      your_turn: this.active === me,
      normal_summon_available: this.active === me && !mine.normalSummoned,
      free_monster_zones: mine.mz.filter((x) => !x).length,
      free_spell_trap_zones: mine.st.filter((x) => !x).length,
      you: {
        lp: mine.lp,
        hand: mine.hand.map((c) => this.cardView(c)),
        field: field(me, false),
        graveyard: mine.gy.map((c) => ({ uid: c.uid, name: c.name })),
        banished: mine.banished.map((c) => c.name),
        extra_deck: mine.extra.map((c) => ({ uid: c.uid, name: c.name, type: c.data.type, atk: c.data.atk, requirement: String(c.data.desc || '').split('\n')[0].slice(0, 160) })),
        deck_count: mine.deck.length,
        deck_card_names: Array.from(new Set(mine.deck.map((c) => c.name)))
      },
      opponent: {
        lp: theirs.lp,
        hand_count: theirs.hand.length,
        field: field(o, true),
        graveyard: theirs.gy.map((c) => ({ uid: c.uid, name: c.name })),
        banished: theirs.banished.map((c) => c.name),
        extra_deck_count: theirs.extra.length,
        deck_count: theirs.deck.length
      }
    };
  };

  App.Duel = { Duel: Duel, PHASES: PHASES, PHASE_LABEL: PHASE_LABEL };
})(window.App);
