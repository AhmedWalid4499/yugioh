/* Built-in bot opponent (free, offline).
   Plan each turn like a player would:
   1. Field Spell and useful Spells (draw, search, removal, Fusion).
   2. Extenders: Special Summon monsters from the hand when their condition is met.
   3. The best Normal/Tribute Summon (searchers first), using "when summoned" effects.
   4. Synchro / Xyz / Link Summons from its field when that makes a stronger board.
   5. Flip Summon useful face-down monsters.
   6. Battle: clear blockers with the weakest attacker that still wins, then attack directly;
      go for lethal; never make losing attacks.
   7. Set Traps/Quick-Plays, move outclassed monsters to Defense, discard to 6.
   On your turn it chains hand traps (e.g. Ash Blossom vs searches, Imperm/Veiler vs
   monster effects), counter traps, Trap Hole-style traps vs your summons and
   Mirror Force-style traps vs your attacks. It respects once-per-turn effects. */
(function (App) {
  'use strict';

  const E = () => App.Effects;
  const M = () => App.Materials;
  const noWindow = () => Promise.resolve({});

  const roleMemo = {};
  function roles(c) {
    if (!roleMemo[c.id]) roleMemo[c.id] = App.insights.analyse(c.data).roleKeys;
    return roleMemo[c.id];
  }
  const has = (c, role) => roles(c).indexOf(role) !== -1;
  const text = (c) => String(c.data.desc || '');

  function value(duel, c) {
    if (duel.kind(c) !== 'monster') return 800;
    const bonus = (has(c, 'starter') || has(c, 'searcher') ? 600 : 0) + (has(c, 'extender') ? 200 : 0) + (has(c, 'negate') ? 500 : 0) + (has(c, 'boss') ? 400 : 0);
    return Math.max(duel.atk(c), duel.def(c)) + (Number(c.data.level) || Number(c.data.linkval) * 2 || 0) * 30 + bonus;
  }

  function oppThreat(duel, p) {
    const mons = duel.monsters(duel.opp(p));
    if (!mons.length) return 0;
    return Math.max.apply(null, mons.map((m) => (m.card.faceUp ? (m.card.pos === 'atk' ? duel.atk(m.card) : duel.def(m.card)) : 1500)));
  }

  /* Should the bot use this plan now? */
  function worthIt(duel, p, c, pl) {
    if (!pl) return false;
    if (pl.fusion) return pl.fusion.length > 0;
    if (pl.choose) return pl.choose.pool.length > 0 && E().autoChoose(duel, p, pl).length > 0;
    if (!pl.ops.length) return false;
    if (pl.ops.every((op) => op.op === 'destroy' || op.op === 'banish')) {
      const o = duel.opp(p);
      const theirs = pl.ops.filter((op) => { const l = duel.find(op.card); return l && l.player === o; }).length;
      return theirs > pl.ops.length - theirs;
    }
    if (pl.ops.some((op) => op.op === 'gain_lp')) return duel.players[p].lp < duel.format.lp;
    return true;
  }

  const win = (ui) => (ui && ui.responseWindow ? ui.responseWindow : noWindow);
  const flips = (ui, duel) => (ui && ui.processFlips ? ui.processFlips() : resolveFlips(duel));

  /* Runs a plan for card c, letting the other player respond first. */
  async function resolveWithResponse(duel, p, c, pf, ui, opts) {
    const o = opts || {};
    duel.markUsed(p, c);
    const resp = await win(ui)({ type: 'activate', player: p, card: c, kind: duel.kind(c), plan: pf, onField: !!o.onField });
    if (resp && resp.negated) {
      duel.say(c.name + '\'s effect is negated' + (resp.by ? ' by ' + resp.by : '') + '.');
      if (o.spellTrap) duel.finishActivation(c.uid);
      duel.changed();
      return false;
    }
    E().run(duel, p, pf, E().autoChoose(duel, p, pf));
    if (pf.discard) discardWorst(duel, p, pf.discard);
    if (o.spellTrap) duel.finishActivation(c.uid);
    await ui.pause();
    return true;
  }

  function discardWorst(duel, p, n) {
    for (let i = 0; i < n; i++) {
      const worst = duel.players[p].hand.slice().sort((a, b) => value(duel, a) - value(duel, b))[0];
      if (worst) duel.sendTo(worst.uid, 'gy', 'discarded');
    }
  }

  async function discardDown(duel, p, ui) {
    const pl = duel.players[p];
    while (pl.hand.length > 6) {
      const worst = pl.hand.slice().sort((a, b) => value(duel, a) - value(duel, b))[0];
      duel.sendTo(worst.uid, 'gy', 'hand size limit');
      await ui.pause(200);
    }
  }

  /* After the bot summons: your response window, then its "when summoned" effects. */
  async function afterSummon(duel, p, c, ui, how) {
    await win(ui)({ type: 'summon', player: p, card: c, uid: c.uid });
    const loc = duel.find(c.uid);
    if (!loc || (loc.zone !== 'mz' && loc.zone !== 'emz') || !c.faceUp) return;
    const t = text(c).toLowerCase();
    const trig = how === 'normal' ? /if this card is normal (or special )?summoned|when this card is normal summoned/ : /if this card is (normal or )?special summoned|if this card is summoned/;
    if (!trig.test(t) || duel.usedThisTurn(p, c)) return;
    const pf = E().plan(duel, p, c, { summoned: true });
    if (worthIt(duel, p, c, pf)) {
      duel.say(c.name + '\'s effect activates.', p);
      await resolveWithResponse(duel, p, c, pf, ui, { onField: true });
    }
  }

  async function useSpells(duel, p, ui) {
    let acted = true;
    let guard = 0;
    while (acted && guard++ < 10 && duel.winner == null) {
      acted = false;
      const pl = duel.players[p];
      const field = pl.hand.find((c) => duel.kind(c) === 'spell' && /Field/.test(c.data.race || ''));
      if (field && !pl.field) {
        const r = duel.activateSpellTrap(p, field.uid);
        if (r.ok) {
          const pf = E().plan(duel, p, field);
          if (worthIt(duel, p, field, pf)) await resolveWithResponse(duel, p, field, pf, ui, { spellTrap: true });
          else { duel.markUsed(p, field); duel.finishActivation(field.uid); }
          acted = true;
          await ui.pause();
          continue;
        }
      }
      for (const c of pl.hand.slice()) {
        if (duel.kind(c) !== 'spell' || /Field|Continuous|Equip/.test(c.data.race || '') || duel.usedThisTurn(p, c)) continue;
        const pf = E().plan(duel, p, c);
        if (!worthIt(duel, p, c, pf)) continue;
        if (duel.freeSt(p) === -1) break;
        const r = duel.activateSpellTrap(p, c.uid);
        if (!r.ok) continue;
        await ui.pause();
        await resolveWithResponse(duel, p, c, pf, ui, { spellTrap: true });
        acted = true;
        break;
      }
    }
  }

  /* "You can Special Summon this card from your hand" with a condition we can check. */
  function canSelfSummon(duel, p, c) {
    const t = text(c);
    const m = /([^.]*?)you can special summon this card(?: \(from your hand\)| from your hand)/i.exec(t);
    if (!m || duel.usedThisTurn(p, c) || duel.freeMz(p) === -1) return false;
    const before = m[1].toLowerCase();
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 80).toLowerCase();
    if (/(discard|tribute|banish|send|reveal|pay|shuffle)/.test(before + ' ' + after.split('.')[0]) && /;/.test(before + after.split('.')[0])) return false;
    const o = duel.opp(p);
    const mine = duel.monsters(p).map((x) => x.card);
    if (/if you control no monsters/.test(before) && mine.length) return false;
    if (/only your opponent controls/.test(before) && (mine.length || !duel.monsters(o).length)) return false;
    if (/your opponent controls (a|more) monsters?/.test(before) && !duel.monsters(o).length) return false;
    if (/if your opponent controls more monsters than you/.test(before) && duel.monsters(o).length <= mine.length) return false;
    const named = /if you control a(?:n)? "([^"]+)"/.exec(before);
    if (named && !mine.some((x) => x.name.indexOf(named[1]) !== -1 || x.data.archetype === named[1])) return false;
    if (/if you control a tuner/.test(before) && !mine.some((x) => /tuner/i.test(x.data.type))) return false;
    if (/during your opponent's turn|if your opponent|when your opponent/.test(before) && !/controls/.test(before)) return false;
    return true;
  }

  async function extenders(duel, p, ui) {
    for (const c of duel.players[p].hand.slice()) {
      if (duel.winner != null) return;
      if (duel.kind(c) !== 'monster' || duel.isExtra(c) || !canSelfSummon(duel, p, c)) continue;
      duel.markUsed(p, c);
      const r = duel.specialSummon(p, c.uid, duel.atk(c) >= duel.def(c) ? 'atk' : 'def', { how: 'its own effect' });
      if (!r.ok) continue;
      await ui.pause();
      await afterSummon(duel, p, c, ui, 'special');
    }
  }

  async function normalSummon(duel, p, ui) {
    const pl = duel.players[p];
    if (pl.normalSummoned) return;
    const mine = duel.monsters(p).map((m) => m.card).sort((a, b) => value(duel, a) - value(duel, b));
    let candidates = pl.hand.filter((c) => duel.kind(c) === 'monster' && !duel.isExtra(c) && !/cannot be normal summoned/i.test(text(c)));
    const notTraps = candidates.filter((c) => !has(c, 'handtrap'));
    if (notTraps.length) candidates = notTraps;
    let best = null;
    candidates.forEach((c) => {
      const need = duel.tributesNeeded(c);
      if (need > mine.length) return;
      const tributes = mine.slice(0, need);
      const lost = tributes.reduce((s, t) => s + value(duel, t), 0);
      if (need && value(duel, c) <= Math.max.apply(null, tributes.map((t) => value(duel, t))) + 300) return;
      const gain = value(duel, c) - lost * 0.9 + (/if this card is normal (or special )?summoned/i.test(text(c)) ? 500 : 0);
      if (!best || gain > best.gain) best = { card: c, tributes: tributes, gain: gain };
    });
    if (!best || (duel.freeMz(p) === -1 && !best.tributes.length)) return;
    const threat = oppThreat(duel, p);
    const c = best.card;
    const wantsEffect = /if this card is normal (or special )?summoned/i.test(text(c)) && (has(c, 'searcher') || has(c, 'extender') || has(c, 'draw'));
    const attack = wantsEffect || (duel.atk(c) >= threat && duel.atk(c) >= 1000) || (duel.atk(c) >= duel.def(c) && duel.atk(c) > threat);
    const r = duel.normalSummon(p, c.uid, attack ? 'atk' : 'set', best.tributes.map((t) => t.uid));
    if (!r.ok) return;
    await ui.pause();
    if (attack) await afterSummon(duel, p, c, ui, 'normal');
  }

  function* subsets(arr, maxSize) {
    const n = arr.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      const pick = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) pick.push(arr[i]);
      if (pick.length <= maxSize) yield pick;
    }
  }

  /* The strongest Synchro/Xyz/Link Summon its face-up monsters can make. */
  function bestExtraSummon(duel, p) {
    const field = duel.monsters(p).map((m) => m.card).filter((c) => c.faceUp);
    if (!field.length) return null;
    const extras = duel.players[p].extra.filter((x) => /synchro|xyz|link/i.test(x.data.type || ''));
    let best = null;
    for (const x of extras) {
      if (/link/i.test(x.data.type) && duel.freeEmz() === -1 && duel.freeMz(p) === -1 && field.length < 2) continue;
      for (const mats of subsets(field, 5)) {
        const chk = M().check(x, mats);
        if (!chk.ok || chk.unchecked) continue;
        const lost = mats.reduce((s, m) => s + value(duel, m), 0);
        const gain = value(duel, x) * 1.2 - lost * 0.6;
        const strongest = Math.max.apply(null, mats.map((m) => value(duel, m)));
        if (value(duel, x) <= strongest + 200) continue;
        if (!best || gain > best.gain) best = { card: x, mats: mats, gain: gain };
      }
    }
    return best;
  }

  async function extraSummons(duel, p, ui) {
    for (let i = 0; i < 3 && duel.winner == null; i++) {
      const best = bestExtraSummon(duel, p);
      if (!best) return;
      const kind = M().summonKind(best.card);
      const r = duel.specialSummon(p, best.card.uid, 'atk', { materials: best.mats.map((m) => m.uid), how: kind });
      if (!r.ok) return;
      await ui.pause();
      await afterSummon(duel, p, best.card, ui, 'special');
    }
  }

  async function flipSummons(duel, p, ui) {
    const threat = oppThreat(duel, p);
    for (const m of duel.monsters(p)) {
      const c = m.card;
      if (c.faceUp || c.summonTurn === duel.turn || c.posChanged) continue;
      if (duel.atk(c) > threat || /FLIP:/i.test(text(c))) {
        const r = duel.changePosition(p, c.uid);
        if (r.ok) { await ui.pause(); await flips(ui, duel); await win(ui)({ type: 'summon', player: p, card: c, uid: c.uid }); }
      }
    }
  }

  async function setBackrow(duel, p, ui) {
    const pl = duel.players[p];
    for (const c of pl.hand.slice()) {
      if (duel.freeSt(p) === -1) break;
      const k = duel.kind(c);
      if (k === 'trap' || (k === 'spell' && /Quick-Play/.test(c.data.race || ''))) {
        const r = duel.setSpellTrap(p, c.uid);
        if (r.ok) await ui.pause(250);
      }
    }
  }

  async function defensivePositions(duel, p, ui) {
    const o = duel.opp(p);
    const theirBest = Math.max(0, ...duel.monsters(o).filter((m) => m.card.faceUp && m.card.pos === 'atk').map((m) => duel.atk(m.card)));
    for (const m of duel.monsters(p)) {
      const c = m.card;
      if (!c.faceUp || c.pos !== 'atk' || c.summonTurn === duel.turn || c.attacked || c.posChanged || /link/i.test(c.data.type)) continue;
      if (theirBest > duel.atk(c) && duel.def(c) > duel.atk(c)) {
        const r = duel.changePosition(p, c.uid);
        if (r.ok) await ui.pause(250);
      }
    }
  }

  const beats = (duel, a, t) => (!t.faceUp ? duel.atk(a) >= 2000 : t.pos === 'atk' ? duel.atk(a) > duel.atk(t) : duel.atk(a) > duel.def(t));

  async function attack(duel, p, a, target, ui) {
    const r = duel.declareAttack(p, a.uid, target ? target.uid : null);
    if (!r.ok) return false;
    await ui.pause();
    await ui.defenderWindow(duel.pendingAttack);
    if (duel.pendingAttack) duel.resolveAttack();
    await flips(ui, duel);
    await ui.pause();
    return true;
  }

  async function battle(duel, p, ui) {
    const o = duel.opp(p);
    for (let guard = 0; guard < 12 && duel.winner == null && duel.phase === 'battle'; guard++) {
      const attackers = duel.monsters(p).map((m) => m.card).filter((c) => c.faceUp && c.pos === 'atk' && !c.attacked && !/cannot attack/i.test(text(c).split('\n')[0]));
      if (!attackers.length) return;
      const blockers = duel.monsters(o).map((m) => m.card);
      if (!blockers.length) {
        const a = attackers.sort((x, y) => duel.atk(y) - duel.atk(x))[0];
        await attack(duel, p, a, null, ui);
        continue;
      }
      // Lethal: if we can clear every blocker and the rest hits for the opponent's LP, go all in.
      // Otherwise take the most valuable blocker we can beat, using the weakest attacker that beats it.
      let pick = null;
      blockers.slice().sort((x, y) => value(duel, y) - value(duel, x)).some((t) => {
        const able = attackers.filter((a) => beats(duel, a, t)).sort((x, y) => duel.atk(x) - duel.atk(y));
        if (able.length) { pick = { a: able[0], t: t }; return true; }
        return false;
      });
      if (!pick) return;
      await attack(duel, p, pick.a, pick.t, ui);
    }
  }

  async function takeTurn(duel, p, ui) {
    await ui.pause();
    if (duel.winner != null) return;
    await useSpells(duel, p, ui);
    await extenders(duel, p, ui);
    await normalSummon(duel, p, ui);
    await extenders(duel, p, ui);
    await useSpells(duel, p, ui);
    await extraSummons(duel, p, ui);
    await flipSummons(duel, p, ui);
    if (duel.winner != null) return;
    if (duel.canEnterBattle()) {
      duel.nextPhase();
      await battle(duel, p, ui);
      if (duel.winner != null) return;
      duel.nextPhase(); // Main Phase 2
      await extraSummons(duel, p, ui);
    }
    await setBackrow(duel, p, ui);
    await defensivePositions(duel, p, ui);
    await discardDown(duel, p, ui);
    if (duel.winner == null) duel.endTurn();
  }

  /* ---------- responses on the opponent's turn ---------- */

  function settableReady(duel, p) {
    return duel.spellsTraps(p).map((x) => x.card).filter((c) => !c.faceUp && c.setTurn != null && c.setTurn < duel.turn &&
      (duel.kind(c) === 'trap' || /Quick-Play/.test(c.data.race || '')));
  }

  function handResponders(duel, p) {
    return duel.players[p].hand.filter((c) => (duel.kind(c) === 'monster' && has(c, 'handtrap')) ||
      (duel.kind(c) === 'trap' && /activate this card from your hand/i.test(text(c)) && (!/if you control no cards/i.test(text(c)) || (!duel.monsters(p).length && !duel.spellsTraps(p).length))));
  }

  async function useResponse(duel, p, c, pf) {
    const loc = duel.find(c.uid);
    if (!loc) return false;
    if (duel.kind(c) === 'monster') {
      duel.sendTo(c.uid, 'gy', false);
      duel.say(duel.pname(p) + ' activates ' + c.name + ' from the hand!', p);
      duel.fx('activate', { uid: c.uid, player: p, kind: 'monster' });
    } else {
      const r = duel.activateSpellTrap(p, c.uid);
      if (!r.ok) return false;
    }
    duel.markUsed(p, c);
    E().run(duel, p, pf, E().autoChoose(duel, p, pf));
    if (duel.kind(c) !== 'monster') duel.finishActivation(c.uid);
    return true;
  }

  /* Your activation: should the bot chain a negation? Returns { negated, by }. */
  async function respondToActivation(duel, p, ev) {
    if (!ev || ev.player === p || duel.winner != null) return {};
    const important = ev.plan ? (ev.plan.choose || ev.plan.fusion || (ev.plan.ops && ev.plan.ops.length)) : true;
    if (!important) return {};
    for (const c of handResponders(duel, p).concat(settableReady(duel, p))) {
      if (duel.usedThisTurn(p, c)) continue;
      const pf = E().plan(duel, p, c, { activation: ev });
      if (!pf || !pf.negateActivation) continue;
      if (await useResponse(duel, p, c, pf)) return { negated: true, by: c.name };
    }
    return {};
  }

  /* Your summon: Trap Hole / Bottomless / Torrential style responses. */
  async function respondToSummon(duel, p, ev) {
    if (!ev || ev.player === p || duel.winner != null) return {};
    const target = duel.find(ev.uid);
    if (!target) return {};
    const worth = value(duel, target.card) >= 1800 || duel.isExtra(target.card);
    if (!worth) return {};
    for (const c of settableReady(duel, p)) {
      const pf = E().plan(duel, p, c, { summon: ev.uid });
      if (!pf || !pf.ops.length) continue;
      if (pf.ops.length > 1) { // board wipes: only if it hurts them more than us
        const o = duel.opp(p);
        const theirs = pf.ops.filter((op) => { const l = duel.find(op.card); return l && l.player === o; }).length;
        if (theirs <= pf.ops.length - theirs) continue;
      }
      if (await useResponse(duel, p, c, pf)) return { responded: true, by: c.name };
    }
    return {};
  }

  /* Your attack: Mirror Force / Sakuretsu / Negate Attack style responses. */
  function respondToAttack(duel, p) {
    const pa = duel.pendingAttack;
    if (!pa) return false;
    const attacker = duel.find(pa.attacker);
    if (!attacker) return false;
    for (const c of settableReady(duel, p)) {
      const pf = E().plan(duel, p, c, { attack: pa });
      if (!pf || (!pf.ops.length && !pf.negateAttack)) continue;
      const important = duel.atk(attacker.card) >= 1500 || !pa.target || duel.atk(attacker.card) >= duel.players[p].lp;
      if (!important) continue;
      const r = duel.activateSpellTrap(p, c.uid);
      if (!r.ok) continue;
      E().run(duel, p, pf);
      duel.finishActivation(c.uid);
      return true;
    }
    return false;
  }

  /* Resolves queued FLIP effects for the bot's monsters (and nothing else). */
  async function resolveFlips(duel) {
    const rest = [];
    while (duel.pendingFlips.length) {
      const uid = duel.pendingFlips.shift();
      const loc = duel.find(uid);
      if (!loc) continue;
      const owner = loc.card.controller != null ? loc.card.controller : loc.card.owner;
      const pf = E().plan(duel, owner, loc.card, { flip: true, summoned: true });
      if (pf && worthIt(duel, owner, loc.card, pf)) {
        duel.say(loc.card.name + '\'s FLIP effect activates.', owner);
        E().run(duel, owner, pf, E().autoChoose(duel, owner, pf));
      } else rest.push(uid);
    }
  }

  App.Bot = {
    takeTurn, respondToAttack, respondToActivation, respondToSummon, discardDown, resolveFlips,
    _internals: { canSelfSummon, bestExtraSummon, value }
  };
})(window.App);
