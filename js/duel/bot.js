/* Built-in bot opponent. Free and offline: it plays by the rules the engine
   enforces and uses the effect reader for common effects. Its strategy:
   use good Spells, make the strongest summon it can (tributing when worth
   it), Fusion Summon when possible, attack only when it wins the fight,
   keep Traps set for your attacks. */
(function (App) {
  'use strict';

  const E = () => App.Effects;

  function value(duel, c) {
    if (duel.kind(c) !== 'monster') return 800;
    return Math.max(duel.atk(c), duel.def(c)) + (Number(c.data.level) || 0) * 30;
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
    if (pl.ops.every((op) => op.op === 'destroy')) {
      const o = duel.opp(p);
      const theirs = pl.ops.filter((op) => { const l = duel.find(op.card); return l && l.player === o; }).length;
      const mine = pl.ops.length - theirs;
      return theirs > mine;
    }
    if (pl.ops.some((op) => op.op === 'gain_lp')) return duel.players[p].lp < duel.format.lp;
    return true;
  }

  async function discardDown(duel, p, ui) {
    const pl = duel.players[p];
    while (pl.hand.length > 6) {
      const worst = pl.hand.slice().sort((a, b) => value(duel, a) - value(duel, b))[0];
      duel.sendTo(worst.uid, 'gy', 'hand size limit');
      await ui.pause(200);
    }
  }

  async function useSpells(duel, p, ui) {
    let acted = true;
    let guard = 0;
    while (acted && guard++ < 10 && duel.winner == null) {
      acted = false;
      const pl = duel.players[p];
      // Field Spell first if we have none.
      const field = pl.hand.find((c) => duel.kind(c) === 'spell' && /Field/.test(c.data.race || ''));
      if (field && !pl.field) {
        const r = duel.activateSpellTrap(p, field.uid);
        if (r.ok) { const pf = E().plan(duel, p, field); if (worthIt(duel, p, field, pf)) E().run(duel, p, pf, E().autoChoose(duel, p, pf)); duel.finishActivation(field.uid); acted = true; await ui.pause(); continue; }
      }
      for (const c of pl.hand.slice()) {
        if (duel.kind(c) !== 'spell' || /Field|Continuous|Equip/.test(c.data.race || '')) continue;
        const pf = E().plan(duel, p, c);
        if (!worthIt(duel, p, c, pf)) continue;
        if (duel.freeSt(p) === -1) break;
        const r = duel.activateSpellTrap(p, c.uid);
        if (!r.ok) continue;
        await ui.pause();
        E().run(duel, p, pf, E().autoChoose(duel, p, pf));
        if (pf.discard) {
          for (let i = 0; i < pf.discard; i++) {
            const worst = pl.hand.slice().sort((a, b) => value(duel, a) - value(duel, b))[0];
            if (worst) duel.sendTo(worst.uid, 'gy', 'discarded');
          }
        }
        duel.finishActivation(c.uid);
        acted = true;
        await ui.pause();
        break;
      }
    }
  }

  async function summon(duel, p, ui) {
    const pl = duel.players[p];
    if (pl.normalSummoned) return;
    const mine = duel.monsters(p).map((m) => m.card).sort((a, b) => value(duel, a) - value(duel, b));
    const candidates = pl.hand.filter((c) => duel.kind(c) === 'monster' && !duel.isExtra(c) && !/cannot be normal summoned/i.test(c.data.desc || ''));
    let best = null;
    candidates.forEach((c) => {
      const need = duel.tributesNeeded(c);
      if (need > mine.length) return;
      const tributes = mine.slice(0, need);
      const lost = tributes.reduce((s, t) => s + value(duel, t), 0);
      const gain = value(duel, c) - lost * 0.9;
      if (need && value(duel, c) <= Math.max.apply(null, tributes.map((t) => value(duel, t))) + 300) return;
      if (!best || gain > best.gain) best = { card: c, tributes: tributes, gain: gain };
    });
    if (!best) return;
    if (duel.freeMz(p) === -1 && !best.tributes.length) return;
    const threat = oppThreat(duel, p);
    const c = best.card;
    const attack = duel.atk(c) >= threat || duel.atk(c) >= duel.def(c);
    const r = duel.normalSummon(p, c.uid, attack ? 'atk' : 'set', best.tributes.map((t) => t.uid));
    if (!r.ok) return;
    await ui.pause();
    // "If this card is Normal Summoned: add/draw…" effects.
    if (attack && /if this card is normal (or special )?summoned/i.test(c.data.desc || '')) {
      const pf = E().plan(duel, p, c, { summoned: true });
      if (worthIt(duel, p, c, pf)) {
        duel.say(c.name + '\'s effect activates.', p);
        E().run(duel, p, pf, E().autoChoose(duel, p, pf));
        await ui.pause();
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

  async function battle(duel, p, ui) {
    const o = duel.opp(p);
    const attackers = duel.monsters(p).map((m) => m.card).filter((c) => c.faceUp && c.pos === 'atk' && !c.attacked)
      .sort((a, b) => duel.atk(b) - duel.atk(a));
    for (const a of attackers) {
      if (duel.winner != null || duel.phase !== 'battle') return;
      if (!duel.find(a.uid)) continue;
      const targets = duel.monsters(o).map((m) => m.card);
      const av = duel.atk(a);
      let target = null;
      if (targets.length) {
        const winnable = targets.filter((t) => {
          if (!t.faceUp) return av >= 1900;
          return t.pos === 'atk' ? av > duel.atk(t) : av > duel.def(t);
        }).sort((x, y) => value(duel, y) - value(duel, x));
        if (!winnable.length) continue;
        target = winnable[0].uid;
      }
      const r = duel.declareAttack(p, a.uid, target);
      if (!r.ok) continue;
      await ui.pause();
      await ui.defenderWindow(duel.pendingAttack);
      if (duel.pendingAttack) duel.resolveAttack();
      await ui.pause();
    }
  }

  async function takeTurn(duel, p, ui) {
    await ui.pause();
    if (duel.winner != null) return;
    await useSpells(duel, p, ui);
    await summon(duel, p, ui);
    await useSpells(duel, p, ui);
    if (duel.winner != null) return;
    if (duel.canEnterBattle()) {
      duel.nextPhase();
      await battle(duel, p, ui);
      if (duel.winner != null) return;
      duel.nextPhase(); // main 2
    }
    await setBackrow(duel, p, ui);
    await discardDown(duel, p, ui);
    if (duel.winner == null) duel.endTurn();
  }

  /* The bot defends against your attack with a Set Trap if one fits. */
  function respondToAttack(duel, p) {
    const pa = duel.pendingAttack;
    if (!pa) return false;
    const attacker = duel.find(pa.attacker);
    if (!attacker) return false;
    const sets = duel.spellsTraps(p).map((x) => x.card).filter((c) => !c.faceUp && duel.kind(c) === 'trap' && c.setTurn != null && c.setTurn < duel.turn);
    for (const c of sets) {
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

  App.Bot = { takeTurn: takeTurn, respondToAttack: respondToAttack, discardDown: discardDown };
})(window.App);
