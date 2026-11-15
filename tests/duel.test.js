/* Unit tests for formats, the auto deck builder, the duel engine, the effect
   reader, the bot and the Claude opponent's request/response handling.
   Loads the real browser scripts into Node. Run: node tests/duel.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] == null ? null : this._d[k]; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
['js/util.js', 'js/formats.js', 'js/api.js', 'js/insights.js', 'js/decks.js', 'js/deckgen.js', 'js/duel/engine.js', 'js/duel/effects.js', 'js/duel/bot.js', 'js/duel/claude.js']
  .forEach((f) => vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }));
const App = global.App;
const { cards } = require('./fixtures');
const byName = (n) => cards.find((c) => c.name === n);

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.log('  ✗ ' + msg); }
}

const noUi = { pause: () => Promise.resolve(), defenderWindow: () => Promise.resolve(), status: () => {}, error: () => {} };

function newDuel(myCards, oppCards, opts) {
  const o = opts || {};
  const spec = (list, name) => ({ name: name + ' deck', playerName: name, main: list.filter((c) => !App.api.isExtraDeck(c)), extra: list.filter((c) => App.api.isExtraDeck(c)) });
  const filler = Array(20).fill(byName('Gemini Elf'));
  const d = new App.Duel.Duel({ format: o.format || 'tcg', first: o.first || 0, decks: [spec(myCards.concat(filler), 'You'), spec(oppCards.concat(filler), 'Bot')] });
  return d;
}

/* Put specific cards in a player's hand (moves them from the deck, or creates them). */
function giveHand(d, p, names) {
  const pl = d.players[p];
  pl.deck = pl.deck.concat(pl.hand); pl.hand = [];
  names.forEach((n) => {
    let i = pl.deck.findIndex((c) => c.name === n);
    if (i === -1) { pl.deck.push(Object.assign({}, pl.deck[0], { uid: 'x' + Math.random(), name: n, id: byName(n).id, data: byName(n) })); i = pl.deck.length - 1; }
    pl.hand.push(pl.deck.splice(i, 1)[0]);
  });
}

(async () => {
  console.log('Formats');
  const F = App.formats;
  const pog = byName('Pot of Greed');
  check(F.copyLimit(pog, 'tcg') === 0 && F.copyLimit(pog, 'goat') === 1, 'Pot of Greed: Forbidden in TCG, Limited in Goat');
  check(F.copyLimit(byName('Accesscode Talker'), 'goat') === 0 && F.copyLimit(byName('Accesscode Talker'), 'tcg') === 3, 'Link monsters are not allowed in Goat format');
  check(!F.cardAllowed(byName('Ash Blossom & Joyous Spring'), 'speed'), 'cards whose format list lacks Speed Duel are not allowed there');
  const speedPool = cards.filter((c) => !App.api.isExtraDeck(c) && c.id !== pog.id && !c.misc_info).slice(0, 7).map((c) => c.id);
  const speedDeck = { format: 'speed', main: speedPool.concat(speedPool, speedPool).slice(0, 20), extra: [], side: [] };
  App.decks.rememberMany(cards);
  check(App.decks.validate(speedDeck).length === 0, 'a 20-card deck is legal in Speed Duel');
  check(App.decks.validate(Object.assign({}, speedDeck, { format: 'tcg' })).some((p) => /at least 40/.test(p)), 'the same deck is too small for TCG');

  console.log('Auto-build');
  const realApi = Object.assign({}, App.api);
  App.api.getArchetypes = async () => ['Lunalight', 'Snake-Eye'];
  App.api.getArchetypeCards = async (n) => cards.filter((c) => c.archetype === n);
  App.api.getCardsByNames = async (names) => { const out = {}; names.forEach((n) => { const c = cards.find((x) => x.name === n); if (c) out[App.api.normName(n)] = c; }); return out; };
  App.api.searchCards = async () => ({ cards: [], total: 0 });
  const built = await App.deckgen.build('lunalight', { format: 'tcg', staples: true });
  check(built.archetype === 'Lunalight', '"lunalight" is matched to the Lunalight archetype');
  check(built.main.filter((id) => id === byName('Lunalight Yellow Marten').id).length === 3, 'the starter (Yellow Marten) gets 3 copies');
  check(built.picks.some((p) => p.card.name === 'Ash Blossom & Joyous Spring' && p.generic), 'generic hand traps are added as staples');
  check(built.extra.indexOf(byName('Lunalight Cat Dancer').id) !== -1, 'the archetype Fusion monster goes to the Extra Deck');
  check(!built.main.includes(pog.id), 'Forbidden cards are never added');
  check(built.main.length <= 40 && built.notes.some((n) => /Only \d+ cards/.test(n)) === (built.main.length < 40), 'deck is capped at 40 and warns when the card pool is too small');
  const goat = await App.deckgen.build('Lunalight', { format: 'goat', staples: false });
  check(!goat.extra.includes(byName('Accesscode Talker').id), 'Goat build skips Link monsters');
  Object.assign(App.api, realApi);

  console.log('Turn structure');
  let d = newDuel([], []);
  check(d.players[0].hand.length === 5 && d.players[1].hand.length === 5, 'both players open with 5 cards');
  check(d.turn === 1 && d.phase === 'main1' && d.players[0].deck.length === 15, 'first player skips the first draw (TCG)');
  const g = newDuel([], [], { format: 'goat' });
  check(g.players[0].hand.length === 6, 'in Goat format the first player draws');
  const sp = newDuel([], [], { format: 'speed' });
  check(sp.players[0].hand.length === 4 && sp.players[0].lp === 4000 && sp.players[0].mz.length === 3, 'Speed Duel: 4-card hand, 4000 LP, 3 zones');
  check(!d.canEnterBattle(), 'no Battle Phase on the first turn');

  console.log('Summoning');
  giveHand(d, 0, ['Gemini Elf', 'Summoned Skull', 'Dark Magician', 'Gemini Elf']);
  const elf = d.players[0].hand[0];
  check(d.normalSummon(0, elf.uid, 'atk').ok, 'Normal Summon a Level 4');
  check(!d.normalSummon(0, d.players[0].hand[2].uid, 'atk').ok, 'only one Normal Summon per turn');
  check(!d.normalSummon(1, d.players[1].hand[0].uid, 'atk').ok, 'cannot summon on the opponent\'s turn');
  d.players[0].normalSummoned = false;
  const skull = d.players[0].hand.find((c) => c.name === 'Summoned Skull');
  check(!d.normalSummon(0, skull.uid, 'atk', []).ok, 'Level 6 needs a Tribute');
  check(d.normalSummon(0, skull.uid, 'atk', [elf.uid]).ok && d.players[0].gy.some((c) => c.uid === elf.uid), 'Tribute Summon sends the Tribute to the GY');
  d.players[0].normalSummoned = false;
  const dm = d.players[0].hand.find((c) => c.name === 'Dark Magician');
  check(!d.normalSummon(0, dm.uid, 'atk', [skull.uid]).ok, 'Level 7 needs 2 Tributes');
  check(!d.changePosition(0, skull.uid).ok, 'cannot change position the turn it was summoned');

  console.log('Spells, Traps and effects');
  d = newDuel([byName('Lunalight Cat Dancer')], []);
  giveHand(d, 0, ['Mirror Force', 'Pot of Greed', 'Raigeki', 'Monster Reborn', 'Lunalight Fusion', 'Lunalight Black Sheep', 'Lunalight Purple Butterfly']);
  const mf = d.players[0].hand.find((c) => c.name === 'Mirror Force');
  check(d.setSpellTrap(0, mf.uid).ok, 'Set a Trap');
  check(!d.activateSpellTrap(0, mf.uid).ok, 'a Trap cannot be activated the turn it is Set');
  const pot = d.players[0].hand.find((c) => c.name === 'Pot of Greed');
  const handBefore = d.players[0].hand.length;
  const r = d.activateSpellTrap(0, pot.uid);
  const pf = App.Effects.plan(d, 0, r.card);
  App.Effects.run(d, 0, pf);
  d.finishActivation(pot.uid);
  check(pf.summary === 'Draw 2' && d.players[0].hand.length === handBefore - 1 + 2 && d.players[0].gy.some((c) => c.name === 'Pot of Greed'), 'Pot of Greed draws 2 and goes to the GY');
  const fus = d.players[0].hand.find((c) => c.name === 'Lunalight Fusion');
  d.activateSpellTrap(0, fus.uid);
  const fp = App.Effects.plan(d, 0, fus);
  check(fp.fusion && fp.fusion[0].fusion.name === 'Lunalight Cat Dancer', 'Lunalight Fusion finds Cat Dancer with 2 Lunalight monsters in hand');
  App.Effects.run(d, 0, fp);
  d.finishActivation(fus.uid);
  check(d.monsters(0).some((m) => m.card.name === 'Lunalight Cat Dancer') && d.players[0].gy.filter((c) => /Lunalight/.test(c.name)).length === 3, 'Fusion Summon: materials and the spell go to the GY');

  // Opponent's turn: Raigeki and a search.
  d.endTurn();
  check(d.active === 1 && d.turn === 2 && d.players[1].hand.length === 6, 'turn passes and the next player draws');
  giveHand(d, 1, ['Gemini Elf', 'Lunalight Yellow Marten', 'Raigeki']);
  const rai = d.players[1].hand.find((c) => c.name === 'Raigeki');
  d.activateSpellTrap(1, rai.uid);
  App.Effects.run(d, 1, App.Effects.plan(d, 1, rai));
  d.finishActivation(rai.uid);
  check(d.monsters(0).length === 0, 'Raigeki destroys all of the opponent\'s monsters');
  const marten = d.players[1].hand.find((c) => c.name === 'Lunalight Yellow Marten');
  d.normalSummon(1, marten.uid, 'atk');
  const sp1 = App.Effects.plan(d, 1, marten, { summoned: true });
  check(sp1 && sp1.choose && sp1.choose.pool.every((u) => /Lunalight/.test(d.find(u).card.name)), 'Yellow Marten\'s search only offers Lunalight monsters');

  console.log('Battle');
  d.nextPhase();
  check(d.phase === 'battle', 'enter the Battle Phase on turn 2');
  const atkMarten = d.declareAttack(1, marten.uid, null);
  check(atkMarten.ok, 'direct attack when the opponent has no monsters');
  // Mirror Force response from the defender.
  const mfPlan = App.Effects.plan(d, 0, mf, { attack: d.pendingAttack });
  check(d.activateSpellTrap(0, mf.uid).ok, 'the Set Trap can be activated on the opponent\'s turn');
  App.Effects.run(d, 0, mfPlan);
  d.finishActivation(mf.uid);
  d.resolveAttack();
  check(!d.find(marten.uid) || d.find(marten.uid).zone === 'gy', 'Mirror Force destroys the attacker');
  check(d.players[0].lp === 8000, 'no damage after the attacker is destroyed');

  d = newDuel([], []);
  d.endTurn(); d.endTurn();
  giveHand(d, 0, ['Summoned Skull', 'Gemini Elf']);
  giveHand(d, 1, ['Gemini Elf']);
  // Put a Gemini Elf on each side.
  const myElf = d.players[0].hand.find((c) => c.name === 'Gemini Elf');
  d.normalSummon(0, myElf.uid, 'atk');
  d.players[1].mz[0] = Object.assign(d.players[1].hand.pop(), { controller: 1, pos: 'atk', faceUp: true, summonTurn: 0 });
  d.nextPhase();
  const oppElf = d.players[1].mz[0];
  d.declareAttack(0, myElf.uid, oppElf.uid); d.resolveAttack();
  check(!d.find(myElf.uid) || d.find(myElf.uid).zone === 'gy', 'equal ATK: both monsters are destroyed');
  check(d.players[0].lp === 8000 && d.players[1].lp === 8000, 'equal ATK: no damage');
  d.players[0].lp = 1000;
  d.changeLp(0, -1000, 'test');
  check(d.winner === 1, 'a player at 0 LP loses');

  console.log('Bot');
  d = newDuel([], [], { first: 1 });
  giveHand(d, 1, ['Summoned Skull', 'Gemini Elf', 'Mirror Force']);
  await App.Bot.takeTurn(d, 1, noUi);
  check(d.active === 0 && d.monsters(1).some((m) => m.card.name === 'Gemini Elf') && d.spellsTraps(1).length === 1, 'bot (turn 1): summons its best monster, sets its Trap and ends the turn');
  d.endTurn();
  await App.Bot.takeTurn(d, 1, noUi);
  check(d.players[0].lp < 8000, 'bot attacks directly when your field is empty (LP ' + d.players[0].lp + ')');

  console.log('Claude opponent');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const state = JSON.parse(calls[calls.length - 1].body.messages[0].content.split('Game state:\n')[1]);
    const monster = state.you.hand.find((c) => c.atk != null && c.level <= 4);
    const isBattle = /Battle Phase/.test(calls[calls.length - 1].body.messages[0].content);
    const actions = isBattle
      ? state.you.field.monsters.map((m) => ({ type: 'attack', card: m.uid, target: state.opponent.field.monsters.length ? state.opponent.field.monsters[0].uid : 'direct' }))
      : (monster ? [{ type: 'normal_summon', card: monster.uid, position: 'attack' }] : []);
    return { ok: true, status: 200, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', id: 't1', name: 'take_actions', input: { comment: 'Here I go!', actions: actions } }] }) };
  };
  App.ClaudeOpponent.settings.set({ apiKey: 'test-key', model: 'claude-opus-5-5', effort: '' });
  d = newDuel([], [], { first: 0 });
  d.endTurn();
  giveHand(d, 1, ['Gemini Elf']);
  await App.ClaudeOpponent.takeTurn(d, 1, noUi);
  const first = calls[0];
  check(first.url === 'https://api.anthropic.com/v1/messages', 'calls the Messages API');
  check(first.init.headers['x-api-key'] === 'test-key' && first.init.headers['anthropic-dangerous-direct-browser-access'] === 'true' && first.init.headers['anthropic-version'], 'sends the key and browser-access headers');
  check(first.body.model === 'claude-opus-5-5' && first.body.tool_choice.type === 'auto' && first.body.tools[0].name === 'take_actions', 'uses Claude Opus 5.5 with the take_actions tool (auto tool choice)');
  check(first.body.fallbacks === 'default' && first.init.headers['anthropic-beta'] === 'server-side-fallback-2026-07-01', 'opts into server-side refusal fallbacks');
  check(d.monsters(1).some((m) => m.card.name === 'Gemini Elf') && d.players[0].lp === 8000 - 1900, 'Claude\'s actions are applied: summon, then a direct attack (LP ' + d.players[0].lp + ')');
  check(d.log.some((l) => /💬 Here I go!/.test(l.text)) && d.active === 0, 'Claude\'s comment is logged and the turn ends');

  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
  d.endTurn();
  await App.ClaudeOpponent.takeTurn(d, 1, noUi);
  check(d.log.some((l) => /API key was rejected/.test(l.text)) && d.active === 0, 'a bad key falls back to the built-in bot for that turn');
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'refusal', content: [] }) });
  let err = null;
  try { await App.ClaudeOpponent.call('x', {}); } catch (e) { err = e; }
  check(err && /declined/.test(err.message), 'a refusal is reported instead of crashing');
  App.ClaudeOpponent.settings.set({ model: 'claude-haiku-5-5' });
  global.fetch = async (url, init) => { calls.push({ body: JSON.parse(init.body), init }); return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'pass' }] }) }; };
  await App.ClaudeOpponent.call('x', {});
  const last = calls[calls.length - 1];
  check(last.body.model === 'claude-haiku-5-5' && last.body.fallbacks === undefined && !last.init.headers['anthropic-beta'], 'Haiku requests skip the fallback option');

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll duel checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
