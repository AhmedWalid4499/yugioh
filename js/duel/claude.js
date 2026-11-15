/* Claude AI opponent. Uses your own Anthropic API key (stored only on this
   device) to read the board and card texts and choose plays. Claude answers
   by calling a "take_actions" tool; the engine checks and applies each action.
   If a request fails, that turn is played by the built-in bot instead. */
(function (App) {
  'use strict';

  const U = App.U;
  const KEY = 'dv-claude';
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  const MODELS = [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — strongest play (roughly $1–2 per duel)' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — strong, about half the cost (roughly 50¢–$1 per duel)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest and cheapest (roughly 5¢ per duel)' }
  ];

  const settings = {
    get() { return Object.assign({ apiKey: '', model: 'claude-opus-5-5', effort: '' }, U.store.get(KEY, {})); },
    set(v) { U.store.set(KEY, Object.assign(settings.get(), v)); },
    hasKey() { return !!settings.get().apiKey; }
  };

  const OP_SCHEMA = {
    type: 'object',
    description: 'One effect step. Use the uids from the game state.',
    properties: {
      op: {
        type: 'string',
        enum: ['draw', 'damage', 'gain_lp', 'destroy', 'banish', 'to_hand', 'to_gy', 'discard', 'to_deck', 'to_deck_top',
          'special_summon', 'search', 'send_from_deck', 'change_position', 'flip_face_down', 'modify_atk', 'take_control', 'shuffle_deck', 'negate_attack']
      },
      card: { type: 'string', description: 'uid of the card the step affects (any zone, either player)' },
      name: { type: 'string', description: 'card name, for search / send_from_deck (from your deck_card_names)' },
      count: { type: 'integer' },
      amount: { type: 'integer' },
      player: { type: 'string', enum: ['self', 'opponent'] },
      position: { type: 'string', enum: ['attack', 'defense'] },
      until_end_of_turn: { type: 'boolean' }
    },
    required: ['op']
  };

  const TOOL = {
    name: 'take_actions',
    description: 'Perform your moves for the current step of the duel, in order. Always call this exactly once per request.',
    input_schema: {
      type: 'object',
      properties: {
        comment: { type: 'string', description: 'One short, friendly sentence to your opponent about your plan (shown in the duel log).' },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['normal_summon', 'set_monster', 'special_summon', 'activate', 'set_spell_trap', 'change_position', 'attack', 'pass']
              },
              card: { type: 'string', description: 'uid of the card you use (for attack: your attacking monster)' },
              target: { type: 'string', description: 'attack only: uid of the opponent monster to attack, or "direct"' },
              tributes: { type: 'array', items: { type: 'string' }, description: 'normal_summon/set_monster: uids of monsters you tribute' },
              materials: { type: 'array', items: { type: 'string' }, description: 'special_summon from the Extra Deck: uids of the materials (they go to the GY; Xyz materials are attached)' },
              position: { type: 'string', enum: ['attack', 'defense'] },
              ops: { type: 'array', items: OP_SCHEMA, description: 'activate / effect special summons: the effect\'s results AND costs, as steps the engine applies' }
            },
            required: ['type']
          }
        }
      },
      required: ['actions']
    }
  };

  const SYSTEM = [
    'You are the opponent in a Yu-Gi-Oh! practice duel inside the Duel Vault app. Play your own deck to win, using real Yu-Gi-Oh! rules and each card\'s exact text.',
    '',
    'How this works:',
    '- Each request gives you the current game state as JSON and tells you which step you are in (Main Phase 1, Battle Phase, Main Phase 2, or responding to an attack).',
    '- Answer by calling the take_actions tool exactly once, with your actions in order. Use only uids that appear in the state.',
    '- The engine enforces the core rules: one Normal Summon/Set per turn, Tributes (1 for Level 5-6, 2 for Level 7+), free zones, Traps cannot be activated the turn they are Set, Normal Spells only in your Main Phase, battle and damage calculation, LP.',
    '- Card effects are NOT automated. When you activate a card ("activate"), list in ops every result and cost of its effect, e.g. Pot of Greed -> [{"op":"draw","count":2}]; a search -> [{"op":"search","name":"<exact card name from deck_card_names>"}]; a discard cost -> [{"op":"discard","card":"<uid>"}]; destroying a target -> [{"op":"destroy","card":"<uid>"}].',
    '- Monster effects: use "activate" with the monster\'s uid and its ops (it stays on the field unless an op moves it). Extra Deck summons: "special_summon" with the Extra Deck monster\'s uid and its materials. Effect summons from hand/GY/deck: an "activate" whose ops contain {"op":"special_summon","card":"<uid>"}.',
    '- Respect once-per-turn limits, costs, summoning conditions and the format\'s rules. Do not invent cards or information you cannot see; face-down cards and the opponent\'s hand are hidden from you.',
    '- In the Battle Phase, only return "attack" actions (target a uid, or "direct" if the opponent controls no monsters), followed by any set_spell_trap / activate actions you want for Main Phase 2.',
    '- When responding to an attack, either "activate" a face-down Trap / Quick-Play Spell or a hand trap (include {"op":"negate_attack"} if it negates the attack) or return [{"type":"pass"}].',
    '- Keep "comment" to one short sentence. Be a good sport.'
  ].join('\n');

  let persona = null;
  function setPersona(text) { persona = text || null; }

  async function call(instruction, state) {
    const s = settings.get();
    if (!s.apiKey) throw new Error('Add your Anthropic API key in the duel settings to use the Claude opponent.');
    const body = {
      model: s.model,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }].concat(persona ? [{ type: 'text', text: persona }] : []),
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: instruction + '\n\nCall take_actions now.\n\nGame state:\n' + JSON.stringify(state) }]
    };
    if (s.effort) body.output_config = { effort: s.effort };
    const headers = {
      'content-type': 'application/json',
      'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    // If a request is declined, let the API retry it on a fallback model automatically.
    if (s.model !== 'claude-haiku-5-5') {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }
    let res;
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error('Could not reach the Claude API. Check your internet connection.');
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json && json.error && json.error.message ? json.error.message : 'HTTP ' + res.status;
      if (res.status === 401) throw new Error('Your Anthropic API key was rejected. Check it in the duel settings.');
      if (res.status === 429) throw new Error('The Claude API is rate-limiting this key. Try again in a minute.');
      throw new Error('Claude API error: ' + msg);
    }
    if (json.stop_reason === 'refusal') throw new Error('Claude declined this request.');
    const blocks = json.content || [];
    const tool = blocks.find((b) => b.type === 'tool_use' && b.name === 'take_actions');
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    const input = tool && tool.input && typeof tool.input === 'object' ? tool.input : { actions: [] };
    if (!Array.isArray(input.actions)) input.actions = [];
    if (!input.comment && text) input.comment = text.slice(0, 240);
    return input;
  }

  /* Applies Claude's actions; returns the list of problems (shown in the log). */
  async function apply(duel, p, input, ui, step) {
    const E = App.Effects;
    if (input.comment) { duel.say('💬 ' + input.comment, p); duel.changed(); }
    const problems = [];
    const note = (a, r) => { if (r && r.ok === false) problems.push((a.type || '?') + ': ' + r.message); };
    for (const a of input.actions.slice(0, 25)) {
      if (duel.winner != null) break;
      if (!a || typeof a !== 'object') continue;
      const pos = a.position === 'defense' ? 'def' : 'atk';
      let r = null;
      if (a.type === 'pass') break;
      if (a.type === 'attack') {
        if (step !== 'battle') { problems.push('attack outside the Battle Phase was ignored'); continue; }
        r = duel.declareAttack(p, a.card, a.target && a.target !== 'direct' ? a.target : null);
        note(a, r);
        if (r.ok) {
          await ui.pause();
          await ui.defenderWindow(duel.pendingAttack);
          if (duel.pendingAttack) duel.resolveAttack();
        }
        await ui.pause();
        continue;
      }
      if (step === 'battle' && a.type !== 'attack' && duel.phase === 'battle') duel.nextPhase(); // later actions happen in Main Phase 2
      if (a.type === 'normal_summon' || a.type === 'set_monster') r = duel.normalSummon(p, a.card, a.type === 'set_monster' ? 'set' : 'atk', a.tributes || []);
      else if (a.type === 'set_spell_trap') r = duel.setSpellTrap(p, a.card);
      else if (a.type === 'change_position') r = duel.changePosition(p, a.card);
      else if (a.type === 'special_summon') r = duel.specialSummon(p, a.card, pos, { materials: a.materials || [], how: 'summoned from the Extra Deck' });
      else if (a.type === 'activate') {
        const loc = duel.find(a.card);
        if (!loc) { problems.push('activate: unknown card ' + a.card); continue; }
        const k = duel.kind(loc.card);
        if (k === 'spell' || k === 'trap') {
          r = duel.activateSpellTrap(p, a.card);
          note(a, r);
          if (!r.ok) continue;
        } else {
          duel.say(duel.pname(p) + ' activates the effect of ' + loc.card.name + '.', p);
        }
        const ops = Array.isArray(a.ops) ? a.ops : [];
        if (!ops.length && (k === 'spell' || k === 'trap')) {
          const pf = E.plan(duel, p, loc.card, duel.pendingAttack ? { attack: duel.pendingAttack } : null);
          if (pf) E.run(duel, p, pf, E.autoChoose(duel, p, pf));
        }
        for (const op of ops.slice(0, 20)) {
          if (op && op.op === 'negate_attack') { duel.negateAttack(); continue; }
          note({ type: 'op ' + (op && op.op) }, duel.applyOp(p, op));
        }
        if (k === 'spell' || k === 'trap') duel.finishActivation(a.card);
        r = { ok: true };
      }
      note(a, r);
      await ui.pause();
    }
    if (problems.length) { duel.say('(Claude\'s moves the rules didn\'t allow: ' + problems.slice(0, 4).join('; ') + ')', p); duel.changed(); }
    return problems;
  }

  async function takeTurn(duel, p, ui) {
    await ui.pause();
    try {
      ui.status('Claude is thinking about Main Phase 1…');
      const main = await call('It is your turn ' + duel.turn + '. Step: Main Phase 1. Make your summons, activations and sets. Attacks come in the next step.', duel.snapshot(p));
      await apply(duel, p, main, ui, 'main1');
      if (duel.winner != null) return;
      if (duel.canEnterBattle()) {
        duel.nextPhase();
        const canAttack = duel.monsters(p).some((m) => m.card.faceUp && m.card.pos === 'atk');
        if (canAttack) {
          ui.status('Claude is planning attacks…');
          const bp = await call('Step: Battle Phase. Declare your attacks in order (attack actions), then any Main Phase 2 sets/activations.', duel.snapshot(p));
          await apply(duel, p, bp, ui, 'battle');
        }
        if (duel.winner != null) return;
        if (duel.phase === 'battle') duel.nextPhase();
      }
      await App.Bot.discardDown(duel, p, ui);
      ui.status('');
      if (duel.winner == null) duel.endTurn();
    } catch (e) {
      ui.status('');
      duel.say('⚠ ' + e.message + ' The built-in bot plays this turn.', p);
      duel.changed();
      ui.error(e.message);
      // Finish the turn with the bot from wherever we are.
      if (duel.winner == null) {
        if (duel.phase === 'main1' || duel.phase === 'main2') await App.Bot.takeTurn(duel, p, ui);
        else { if (duel.phase === 'battle') duel.nextPhase(); await App.Bot.discardDown(duel, p, ui); duel.endTurn(); }
      }
    }
  }

  /* When you attack: lets Claude respond with a Set card or hand trap. */
  async function respondToAttack(duel, p, ui) {
    const pa = duel.pendingAttack;
    if (!pa) return false;
    const canRespond = duel.spellsTraps(p).some((x) => !x.card.faceUp) ||
      duel.players[p].hand.some((c) => /quick effect|declares an attack|activate this card from your hand/i.test(c.data.desc || ''));
    if (!canRespond) return false;
    try {
      ui.status('Claude is deciding whether to respond…');
      const attacker = duel.find(pa.attacker);
      const target = pa.target ? duel.find(pa.target) : null;
      const input = await call('Your opponent\'s ' + (attacker ? attacker.card.name + ' (' + duel.atk(attacker.card) + ' ATK, uid ' + pa.attacker + ')' : 'monster') +
        ' attacks ' + (target ? 'your ' + target.card.name + ' (uid ' + pa.target + ')' : 'you directly') + '. Respond with an activation or pass.', duel.snapshot(p));
      const before = duel.pendingAttack;
      await apply(duel, p, input, ui, 'response');
      ui.status('');
      return duel.pendingAttack !== before || input.actions.some((a) => a.type === 'activate');
    } catch (e) {
      ui.status('');
      ui.error(e.message);
      return App.Bot.respondToAttack(duel, p);
    }
  }

  App.ClaudeOpponent = { settings: settings, MODELS: MODELS, takeTurn: takeTurn, respondToAttack: respondToAttack, call: call, apply: apply, setPersona: setPersona };
})(window.App);
