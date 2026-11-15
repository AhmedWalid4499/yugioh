/* Duel: setup screen and the duel board. */
(function (App) {
  'use strict';

  const U = App.U;
  const C = App.C;
  const D = App.decks;
  const F = App.formats;
  const api = App.api;
  const esc = U.esc;

  let session = null; // { duel, oppType, reveal, busy, status, resolving, setup }

  /* ---------- small dialog helpers (promise based) ---------- */

  function dialog(html, wire) {
    return new Promise((resolve) => {
      C.openModal('<div class="duel-dialog">' + html + '</div>');
      const body = document.getElementById('modal-body');
      const done = (v) => { C._onClose = null; C.closeModal(); resolve(v); };
      C._onClose = () => resolve(null);
      wire(body, done);
    });
  }

  function miniCard(card, opts) {
    const o = opts || {};
    const hidden = o.hidden;
    return '<button type="button" class="pick-card' + (o.selected ? ' selected' : '') + '" data-pick="' + esc(o.value) + '">' +
      (hidden ? '<span class="cardback"></span>' : '<img src="' + esc(api.image(card.data, 'small')) + '" alt="">') +
      '<span class="pick-name">' + esc(hidden ? 'Face-down card' : card.name) + '</span>' +
      (o.sub ? '<span class="pick-sub">' + esc(o.sub) + '</span>' : '') + '</button>';
  }

  /* Pick up to `count` cards (exactly `count` unless min is lower). Resolves to an array of uids or null. */
  function choose(title, cards, opts) {
    const o = Object.assign({ count: 1, min: 1, confirm: 'Confirm', note: '', extra: [] }, opts || {});
    const selected = [];
    return dialog(
      '<h2 id="modal-title">' + esc(title) + '</h2>' + (o.note ? '<p class="muted">' + esc(o.note) + '</p>' : '') +
      (cards.length ? '<div class="pick-grid">' + cards.map((c) => miniCard(c, { value: c.uid, sub: o.sub ? o.sub(c) : '' })).join('') + '</div>' : '<p class="muted">Nothing to choose from.</p>') +
      '<div class="row">' + (o.count > 1 || o.min === 0 ? '<button type="button" class="btn btn-primary" data-ok>' + esc(o.confirm) + '</button>' : '') +
      o.extra.map((b, i) => '<button type="button" class="btn" data-extra="' + i + '">' + esc(b.label) + '</button>').join('') +
      '<button type="button" class="btn btn-ghost" data-cancel>Cancel</button></div>',
      (body, done) => {
        body.addEventListener('click', (e) => {
          const pick = e.target.closest('[data-pick]');
          if (pick) {
            const uid = pick.getAttribute('data-pick');
            if (o.count === 1 && o.min !== 0) { done([uid]); return; }
            const i = selected.indexOf(uid);
            if (i === -1) { if (selected.length < o.count) selected.push(uid); } else selected.splice(i, 1);
            pick.classList.toggle('selected', selected.indexOf(uid) !== -1);
            return;
          }
          if (e.target.closest('[data-ok]')) { if (selected.length >= o.min) done(selected.slice()); else U.toast('Pick ' + o.min + '.'); return; }
          const ex = e.target.closest('[data-extra]');
          if (ex) { done(o.extra[Number(ex.getAttribute('data-extra'))].value); return; }
          if (e.target.closest('[data-cancel]')) done(null);
        });
      });
  }

  function ask(title, text, buttons) {
    return dialog('<h2 id="modal-title">' + esc(title) + '</h2>' + (text ? '<div class="card-text">' + text + '</div>' : '') +
      '<div class="row">' + buttons.map((b, i) => '<button type="button" class="btn' + (b.primary ? ' btn-primary' : '') + '" data-b="' + i + '"' + (b.disabled ? ' disabled' : '') + '>' + esc(b.label) + '</button>').join('') + '</div>',
      (body, done) => body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-b]');
        if (b) done(buttons[Number(b.getAttribute('data-b'))].value);
      }));
  }

  function descHtml(c) { return esc(c.data.desc || '').replace(/\n/g, '<br>'); }

  /* ---------- setup ---------- */

  function setupPage(view, params) {
    const decks = D.all();
    const last = U.store.get('dv-duel-setup', {});
    const preMine = params.get('deck') || last.mine || (decks[0] && decks[0].id);
    const mineDeck = D.get(preMine);
    const cs = App.ClaudeOpponent.settings.get();
    const deckOpts = (sel) => decks.map((d) => '<option value="' + esc(d.id) + '"' + (d.id === sel ? ' selected' : '') + '>' + esc(d.name) + ' (' + d.main.length + ')</option>').join('');
    const oppSel = last.theirs && (D.get(last.theirs) || last.theirs.indexOf('__') === 0) ? last.theirs : '__auto';

    view.innerHTML = '<section class="page">' +
      '<div class="page-head"><h1>Duel</h1><p class="muted">Test your deck in a practice duel against the built-in bot or a Claude AI opponent.</p></div>' +
      (decks.length ? '' : '<div class="panel"><p>You need a deck first. <a class="btn btn-primary" href="#/build">⚡ Auto-build one</a> or <a href="#/decks">create one</a>.</p></div>') +
      '<form class="panel duel-setup" id="duel-form" autocomplete="off">' +
        '<div class="setup-grid">' +
          '<label>Your deck<select name="mine" required>' + deckOpts(preMine) + '</select></label>' +
          '<label>Opponent\'s deck<select name="theirs">' + deckOpts(oppSel) +
            '<option value="__auto"' + (oppSel === '__auto' ? ' selected' : '') + '>Auto-build from an archetype…</option>' +
            '<option value="__mirror"' + (oppSel === '__mirror' ? ' selected' : '') + '>Same as mine (mirror match)</option></select></label>' +
          '<label class="arch-row">Opponent\'s archetype<input name="arch" list="duel-archetypes" placeholder="e.g. Blue-Eyes" value="' + esc(last.arch || 'Blue-Eyes') + '"></label>' +
          '<label>Rulings / format<select name="format">' + F.options(last.format || (mineDeck && mineDeck.format) || 'tcg') + '</select></label>' +
          '<label>Who goes first<select name="first"><option value="coin">Coin toss</option><option value="me"' + (last.first === 'me' ? ' selected' : '') + '>Me</option><option value="opp"' + (last.first === 'opp' ? ' selected' : '') + '>Opponent</option></select></label>' +
          '<label>Starting LP<input type="number" name="lp" min="100" step="100" placeholder="Format default" value="' + esc(last.lp || '') + '"></label>' +
        '</div>' +
        '<p class="muted small" id="fmt-desc"></p>' +
        '<fieldset class="opp-type"><legend>Opponent</legend>' +
          '<label class="check"><input type="radio" name="ai" value="bot"' + (last.ai !== 'claude' ? ' checked' : '') + '> <span><strong>Built-in bot</strong>: free and offline. It summons, sets and attacks by the rules and uses common effects (draw, destroy, search, revive, burn, Fusion).</span></label>' +
          '<label class="check"><input type="radio" name="ai" value="claude"' + (last.ai === 'claude' ? ' checked' : '') + '> <span><strong>Claude AI</strong>: reads every card\'s text and plays its deck like a person. Needs your Anthropic API key, which is billed per use.</span></label>' +
          '<div class="claude-settings">' +
            '<label>Anthropic API key<input type="password" name="key" placeholder="sk-ant-…" value="' + esc(cs.apiKey) + '" autocomplete="off"></label>' +
            '<label>Model<select name="model">' + App.ClaudeOpponent.MODELS.map((m) => '<option value="' + m.id + '"' + (m.id === cs.model ? ' selected' : '') + '>' + esc(m.label) + '</option>').join('') + '</select></label>' +
            '<label>Thinking<select name="effort"><option value="">Balanced (default)</option><option value="low"' + (cs.effort === 'low' ? ' selected' : '') + '>Faster turns</option><option value="high"' + (cs.effort === 'high' ? ' selected' : '') + '>Deeper thinking (slower)</option></select></label>' +
            '<p class="muted small">The key is saved only on this device and sent only to api.anthropic.com. Get one at console.anthropic.com. Costs are rough estimates.</p>' +
          '</div>' +
        '</fieldset>' +
        '<div class="row"><button class="btn btn-primary" type="submit"' + (decks.length ? '' : ' disabled') + '>⚔ Start duel</button><span id="duel-setup-status" class="muted"></span></div>' +
        '<details class="small"><summary>What\'s automated?</summary><p class="muted">Turn and phase order, drawing, Normal and Tribute Summons, Sets, when Spells and Traps can be activated, position changes, battle, damage, LP and win conditions. Common effects resolve with one click. For anything more complex, use the card menus to move cards, change LP or summon. The Claude opponent resolves its own effects.</p></details>' +
        '<datalist id="duel-archetypes"></datalist>' +
      '</form></section>';

    const form = U.$('#duel-form', view);
    api.getArchetypes().then((l) => { U.$('#duel-archetypes', view).innerHTML = l.map((a) => '<option value="' + esc(a) + '">').join(''); }).catch(() => {});
    const sync = () => {
      U.$('.arch-row', view).hidden = form.theirs.value !== '__auto';
      U.$('.claude-settings', view).hidden = form.ai.value !== 'claude';
      U.$('#fmt-desc', view).textContent = F.get(form.format.value).description;
    };
    form.addEventListener('change', (e) => {
      if (e.target.name === 'mine') { const d = D.get(form.mine.value); if (d && d.format) form.format.value = d.format; }
      sync();
    });
    sync();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = U.$('#duel-setup-status', view);
      const setup = { mine: form.mine.value, theirs: form.theirs.value, arch: form.arch.value.trim(), format: form.format.value, first: form.first.value, lp: form.lp.value, ai: form.ai.value };
      U.store.set('dv-duel-setup', setup);
      if (setup.ai === 'claude') {
        App.ClaudeOpponent.settings.set({ apiKey: form.key.value.trim(), model: form.model.value, effort: form.effort.value });
        if (!form.key.value.trim()) { status.textContent = 'Enter your Anthropic API key to play against Claude, or pick the built-in bot.'; return; }
      }
      status.textContent = 'Shuffling decks…';
      try {
        await start(setup);
        location.hash = '#/duel/play';
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  async function cardsFor(ids) {
    const missing = ids.filter((id) => !D.cached(id));
    if (missing.length) D.rememberMany(await api.getCardsByIds(missing));
    return ids.map((id) => D.cached(id)).filter(Boolean);
  }

  async function start(setup) {
    const mine = D.get(setup.mine);
    if (!mine || !mine.main.length) throw new Error('Pick a deck with Main Deck cards.');
    let theirs;
    if (setup.theirs === '__mirror') theirs = { name: mine.name, main: mine.main, extra: mine.extra };
    else if (setup.theirs === '__auto') {
      if (!setup.arch) throw new Error('Type an archetype for your opponent.');
      const built = await App.deckgen.build(setup.arch, { format: setup.format, staples: true });
      theirs = { name: built.name, main: built.main, extra: built.extra };
    } else theirs = D.get(setup.theirs);
    if (!theirs || !theirs.main.length) throw new Error('The opponent\'s deck is empty.');
    const fmt = F.get(setup.format);
    const spec = async (d, who) => ({
      name: d.name,
      playerName: who,
      main: (await cardsFor(d.main)).filter((c) => F.cardAllowed(c, fmt.key) && !api.isExtraDeck(c)),
      extra: (await cardsFor(d.extra)).filter((c) => F.cardAllowed(c, fmt.key))
    });
    const meSpec = await spec(mine, 'You');
    const oppSpec = await spec(theirs, setup.ai === 'claude' ? 'Claude' : 'Bot');
    if (meSpec.main.length < fmt.hand + 1 || oppSpec.main.length < fmt.hand + 1) throw new Error('Both decks need more cards than an opening hand.');
    let first = setup.first === 'me' ? 0 : setup.first === 'opp' ? 1 : (Math.random() < 0.5 ? 0 : 1);
    const duel = new App.Duel.Duel({ format: fmt.key, first: first, lp: Number(setup.lp) || null, decks: [meSpec, oppSpec] });
    duel.log.unshift({ turn: 0, text: (setup.first === 'coin' ? 'Coin toss: ' : '') + (first === 0 ? 'You go' : oppSpec.playerName + ' goes') + ' first. Format: ' + fmt.label + '.' });
    if (mine.main.length < fmt.main[0]) duel.log.unshift({ turn: 0, text: 'Note: your deck is below the ' + fmt.label + ' minimum (' + fmt.main[0] + ') — fine for practice.' });
    session = { duel: duel, oppType: setup.ai, reveal: false, busy: false, status: '', resolving: null, setup: setup };
  }

  /* ---------- the board ---------- */

  function playPage(view) {
    if (!session) {
      view.innerHTML = '<section class="page">' + C.empty('No duel in progress.') + '<p style="text-align:center"><a class="btn btn-primary" href="#/duel">Set up a duel</a></p></section>';
      return;
    }
    const s = session;
    const duel = s.duel;
    const speed = Number(U.store.get('dv-duel-speed', 450));

    const ui = {
      pause: (ms) => new Promise((r) => setTimeout(r, ms == null ? speed : Math.min(ms, speed))),
      status: (t) => { s.status = t; const box = document.getElementById('duel-status'); if (box) box.textContent = t; },
      error: (m) => U.toast(m),
      defenderWindow: (pending) => defendAgainst(pending)
    };
    s.ui = ui;

    view.innerHTML = '<section class="page duel-page"><div id="duel-root"></div></section>';
    const root = U.$('#duel-root', view);

    function slot(c, mine, label) {
      if (!c) return '<div class="slot empty"><span>' + esc(label || '') + '</span></div>';
      const hidden = !c.faceUp && !mine;
      const monster = duel.kind(c) === 'monster';
      const isLink = /link/i.test(c.data.type || '');
      return '<button type="button" class="slot card-slot' + (c.pos === 'def' && monster ? ' def' : '') + (!c.faceUp ? ' facedown' : '') + (mine ? ' mine' : ' theirs') + '" data-uid="' + c.uid + '" title="' + esc(hidden ? 'Face-down card' : c.name) + '">' +
        (hidden ? '<span class="cardback"></span>' : '<img src="' + esc(api.image(c.data, 'small')) + '" alt="' + esc(c.name) + '">') +
        (monster && !hidden ? '<span class="stats">' + duel.atk(c) + (isLink ? '' : ' / ' + duel.def(c)) + '</span>' : '') +
        (!c.faceUp && mine ? '<span class="set-tag">SET</span>' : '') +
        (c.materials && c.materials.length ? '<span class="mats">' + c.materials.length + '</span>' : '') +
        '</button>';
    }

    function pinfo(p) {
      const pl = duel.players[p];
      const mine = p === 0;
      return '<div class="pinfo ' + (mine ? 'me' : 'opp') + (duel.active === p ? ' active' : '') + '">' +
        '<div class="pname"><strong>' + esc(pl.name) + '</strong><span class="muted small">' + esc(pl.deckName) + '</span></div>' +
        '<div class="lp' + (pl.lp <= duel.format.lp / 4 ? ' low' : '') + '">' + pl.lp + '<small>LP</small></div>' +
        '<div class="piles">' +
          '<button type="button" class="pile" data-pile="deck" data-p="' + p + '">Deck ' + pl.deck.length + '</button>' +
          '<button type="button" class="pile" data-pile="gy" data-p="' + p + '">GY ' + pl.gy.length + '</button>' +
          '<button type="button" class="pile" data-pile="banished" data-p="' + p + '">Banished ' + pl.banished.length + '</button>' +
          '<button type="button" class="pile" data-pile="extra" data-p="' + p + '">Extra ' + pl.extra.length + '</button>' +
          (mine ? '' : '<span class="pile static">Hand ' + pl.hand.length + '</span>') +
        '</div></div>';
    }

    function zonesRow(p, kind) {
      const pl = duel.players[p];
      const mine = p === 0;
      let cells;
      if (kind === 'mz') cells = pl.mz.map((c) => slot(c, mine, 'Monster'));
      else cells = pl.st.map((c) => slot(c, mine, 'Spell Trap'));
      if (!mine) cells.reverse();
      const fieldCell = kind === 'st' ? '<div class="field-zone">' + slot(pl.field, mine, 'Field') + '</div>' : '<div class="field-zone spacer"></div>';
      return '<div class="zones ' + kind + '">' + (mine ? '' : fieldCell) + '<div class="zone-cells">' + cells.join('') + '</div>' + (mine ? fieldCell : '') + '</div>';
    }

    function handRow(p) {
      const pl = duel.players[p];
      const mine = p === 0;
      if (!mine && !s.reveal) return '<div class="hand-row theirs">' + pl.hand.map(() => '<div class="slot hand-back"><span class="cardback"></span></div>').join('') + '</div>';
      return '<div class="hand-row' + (mine ? ' mine' : ' theirs') + '">' + pl.hand.map((c) => slot(c, true)).join('') + '</div>';
    }

    function render() {
      const myTurn = duel.active === 0;
      const ph = duel.phase;
      const canAct = myTurn && duel.winner == null && !s.busy;
      const emz = duel.emz.length ? '<div class="zones emz"><div class="zone-cells">' + duel.emz.map((c) => slot(c, c && c.controller === 0, 'Extra Monster')).join('') + '</div></div>' : '';
      const logHtml = duel.log.slice(-80).map((l) => '<li class="' + (l.who === 0 ? 'me' : l.who === 1 ? 'opp' : '') + '">' + esc(l.text) + '</li>').join('');
      root.innerHTML =
        '<div class="duel">' +
          '<div class="board">' +
            pinfo(1) + handRow(1) + zonesRow(1, 'st') + zonesRow(1, 'mz') + emz + zonesRow(0, 'mz') + zonesRow(0, 'st') + handRow(0) + pinfo(0) +
          '</div>' +
          '<aside class="duel-side">' +
            '<div class="turn-box"><div><strong>Turn ' + duel.turn + '</strong> · ' + (myTurn ? 'Your turn' : esc(duel.pname(1)) + '\'s turn') + '</div>' +
              '<div class="phases">' + ['main1', 'battle', 'main2', 'end'].map((x) => '<span class="' + (x === ph ? 'on' : '') + '">' + App.Duel.PHASE_LABEL[x].replace(' Phase', '').replace('Main ', 'M') + '</span>').join('') + '</div>' +
              (s.resolving ? '<div class="resolving">Resolving <strong>' + esc(s.resolving.name) + '</strong>: use the card menus for its effect, then <button type="button" class="btn btn-small btn-primary" id="resolve-done">Done</button></div>' : '') +
              '<div class="row">' +
                (canAct && ph === 'main1' && duel.canEnterBattle() ? '<button type="button" class="btn btn-primary" id="to-battle">⚔ Battle Phase</button>' : '') +
                (canAct && ph === 'battle' ? '<button type="button" class="btn" id="to-main2">Main Phase 2</button>' : '') +
                (canAct ? '<button type="button" class="btn' + (ph === 'main2' || (ph === 'main1' && !duel.canEnterBattle()) ? ' btn-primary' : '') + '" id="end-turn">End Turn</button>' : '') +
              '</div>' +
              '<div id="duel-status" class="muted small">' + esc(s.status || (!myTurn && duel.winner == null ? duel.pname(1) + ' is playing…' : '')) + '</div>' +
            '</div>' +
            '<div class="tools">' +
              '<button type="button" class="btn btn-small" data-tool="draw">Draw 1</button>' +
              '<button type="button" class="btn btn-small" data-tool="search">Search Deck</button>' +
              '<button type="button" class="btn btn-small" data-tool="shuffle">Shuffle</button>' +
              '<button type="button" class="btn btn-small" data-tool="lp">Change LP</button>' +
              '<button type="button" class="btn btn-small" data-tool="reveal">' + (s.reveal ? 'Hide' : 'Reveal') + ' opponent\'s hand</button>' +
              '<button type="button" class="btn btn-small btn-ghost" data-tool="new">New duel</button>' +
            '</div>' +
            '<ol class="duel-log" id="duel-log">' + logHtml + '</ol>' +
          '</aside>' +
        '</div>' +
        (duel.winner != null ? '<div class="winner-banner"><h2>' + (duel.winner === 0 ? '🏆 You win!' : '💀 ' + esc(duel.pname(1)) + ' wins') + '</h2><div class="row"><button type="button" class="btn btn-primary" id="rematch">Rematch</button><a class="btn" href="#/duel">New setup</a></div></div>' : '');
      const log = U.$('#duel-log', root);
      if (log) log.scrollTop = log.scrollHeight;
      maybeOpponentTurn();
    }

    duel.listeners = [];
    duel.on(() => { if (!render.pending) { render.pending = true; requestAnimationFrame(() => { render.pending = false; render(); }); } });

    /* ---------- opponent's turn ---------- */

    function maybeOpponentTurn() {
      if (duel.active !== 1 || duel.winner != null || s.busy) return;
      s.busy = true;
      const runner = s.oppType === 'claude' ? App.ClaudeOpponent.takeTurn : App.Bot.takeTurn;
      Promise.resolve().then(() => runner(duel, 1, ui)).catch((e) => { console.error(e); U.toast('Opponent error: ' + e.message); if (duel.active === 1 && duel.winner == null) duel.endTurn(); })
        .finally(() => { s.busy = false; s.status = ''; render(); });
    }

    async function defendAgainst(pending) {
      if (!pending) return;
      const attacker = duel.find(pending.attacker);
      const target = pending.target ? duel.find(pending.target) : null;
      const options = duel.spellsTraps(0).map((x) => x.card).filter((c) => !c.faceUp && c.setTurn != null && c.setTurn < duel.turn &&
        (duel.kind(c) === 'trap' || /Quick-Play/.test(c.data.race || '')))
        .concat(duel.players[0].hand.filter((c) => (duel.kind(c) === 'trap' && /activate this card from your hand/i.test(c.data.desc || '')) ||
          (duel.kind(c) === 'monster' && /quick effect/i.test(c.data.desc || '') && /(discard this card|send this card from your hand)/i.test(c.data.desc || ''))));
      if (!options.length) { render(); await ui.pause(200); return; }
      const pick = await choose((attacker ? attacker.card.name : 'A monster') + ' attacks ' + (target ? (target.card.faceUp ? 'your ' + target.card.name : 'your face-down monster') : 'you directly') + '!',
        options, { note: 'Respond with one of these cards, or let the attack go through.', extra: [{ label: 'No response', value: [] }], sub: (c) => duel.find(c.uid).zone === 'hand' ? 'from hand' : 'Set' });
      if (!pick || !pick.length) return;
      const loc = duel.find(pick[0]);
      if (duel.kind(loc.card) === 'monster') {
        duel.sendTo(loc.card.uid, 'gy', 'activated from the hand');
        duel.say('You activate ' + loc.card.name + '.', 0);
        await resolveEffect(loc.card, null, false, { attack: pending });
      } else {
        await activateFlow(loc.card.uid, { attack: pending });
      }
    }

    /* ---------- your actions ---------- */

    async function resolveEffect(card, pf, isST, ctx) {
      const autoOk = pf && (!pf.choose || pf.choose.pool.length) && (!pf.fusion || pf.fusion.length) && (pf.ops.length || pf.choose || pf.fusion || pf.negateAttack);
      const buttons = [];
      if (autoOk) buttons.push({ label: 'Auto-resolve: ' + pf.summary, value: 'auto', primary: true });
      if (ctx && ctx.attack) buttons.push({ label: 'It negates the attack', value: 'negate' });
      buttons.push({ label: autoOk ? 'Resolve manually' : 'Resolve it with the card menus', value: 'manual', primary: !autoOk });
      const choice = await ask('Resolve ' + card.name, descHtml(card) + (pf && !autoOk ? '<p class="muted small">' + esc(pf.summary) + '.</p>' : ''), buttons);
      if (choice === 'auto') {
        let chosen = [];
        if (pf.choose) {
          const cards = pf.choose.pool.map((u) => duel.find(u)).filter(Boolean).map((x) => x.card);
          chosen = await choose(pf.choose.label, cards, { sub: (c) => { const l = duel.find(c.uid); return l.player === 0 ? 'yours · ' + l.zone : 'opponent · ' + l.zone; } }) || [];
        }
        let fusionPick = null;
        if (pf.fusion && pf.fusion.length > 1) {
          const ch = await choose('Which Fusion Monster?', pf.fusion.map((f) => f.fusion), { sub: (c) => 'uses ' + pf.fusion.find((f) => f.fusion.uid === c.uid).materials.map((m) => m.name).join(' + ') });
          fusionPick = ch ? pf.fusion.find((f) => f.fusion.uid === ch[0]) : null;
          if (!fusionPick) { if (isST) duel.finishActivation(card.uid); return; }
        }
        App.Effects.run(duel, 0, pf, chosen, fusionPick);
        if (pf.discard) {
          const disc = await choose('Discard ' + pf.discard, duel.players[0].hand.slice(), { count: pf.discard, min: Math.min(pf.discard, duel.players[0].hand.length), confirm: 'Discard' });
          (disc || duel.players[0].hand.slice(0, pf.discard).map((c) => c.uid)).forEach((u) => duel.sendTo(u, 'gy', 'discarded'));
        }
        if (isST) duel.finishActivation(card.uid);
      } else if (choice === 'negate') {
        duel.negateAttack();
        if (isST) duel.finishActivation(card.uid);
      } else {
        s.resolving = { uid: card.uid, name: card.name, isST: isST };
        render();
      }
    }

    async function activateFlow(uid, ctx) {
      const r = duel.activateSpellTrap(0, uid);
      if (!r.ok) { U.toast(r.message); return; }
      const pf = App.Effects.plan(duel, 0, r.card, ctx);
      await resolveEffect(r.card, pf, true, ctx);
      // The bot or Claude may respond to big plays later; keep it simple for now.
    }

    async function summonFlow(c, pos) {
      const need = duel.tributesNeeded(c);
      let tributes = [];
      if (need) {
        const mons = duel.monsters(0).map((m) => m.card);
        if (mons.length < need) { U.toast(c.name + ' needs ' + need + ' Tribute' + (need > 1 ? 's' : '') + '.'); return; }
        tributes = await choose('Choose ' + need + ' monster' + (need > 1 ? 's' : '') + ' to Tribute', mons, { count: need, min: need, confirm: 'Tribute' });
        if (!tributes) return;
      }
      const r = duel.normalSummon(0, c.uid, pos, tributes);
      if (!r.ok) { U.toast(r.message); return; }
      if (pos !== 'set' && /if this card is normal (or special )?summoned/i.test(c.data.desc || '')) {
        const pf = App.Effects.plan(duel, 0, c, { summoned: true });
        if (pf) {
          const go = await ask(c.name + ' was summoned', descHtml(c), [{ label: 'Use its effect', value: true, primary: true }, { label: 'Not now', value: false }]);
          if (go) { duel.say('You activate ' + c.name + '\'s effect.', 0); await resolveEffect(c, pf, false); }
        }
      }
    }

    async function extraSummonFlow(c) {
      const req = String(c.data.desc || '').split('\n')[0];
      const pool = duel.monsters(0).map((m) => m.card).concat(/fusion/i.test(c.data.type) ? duel.players[0].hand.filter((x) => duel.kind(x) === 'monster') : []);
      const mats = await choose('Materials for ' + c.name, pool, { count: 10, min: 0, confirm: 'Summon', note: 'Requirement: ' + req + ' — pick the materials (they go to the GY; Xyz materials are attached).', sub: (x) => duel.find(x.uid).zone === 'hand' ? 'hand' : duel.atk(x) + ' ATK' });
      if (mats === null) return;
      const pos = /link/i.test(c.data.type) ? 'atk' : await ask('Position', '', [{ label: 'Attack Position', value: 'atk', primary: true }, { label: 'Defense Position', value: 'def' }]);
      if (!pos) return;
      const r = duel.specialSummon(0, c.uid, pos, { materials: mats, how: /link/i.test(c.data.type) ? 'Link Summon' : /xyz/i.test(c.data.type) ? 'Xyz Summon' : /synchro/i.test(c.data.type) ? 'Synchro Summon' : /fusion/i.test(c.data.type) ? 'Fusion Summon' : 'from the Extra Deck' });
      if (!r.ok) U.toast(r.message);
    }

    async function attackFlow(c) {
      const chk = duel.canAttack(0, c.uid);
      if (!chk.ok) { U.toast(chk.message); return; }
      const targets = duel.monsters(1).map((m) => m.card);
      let target = null;
      if (targets.length) {
        const pick = await choose('Attack which monster?', targets, { sub: (t) => t.faceUp ? (t.pos === 'atk' ? duel.atk(t) + ' ATK' : duel.def(t) + ' DEF') : 'face-down' });
        if (!pick) return;
        target = pick[0];
      }
      const r = duel.declareAttack(0, c.uid, target);
      if (!r.ok) { U.toast(r.message); return; }
      s.busy = true;
      try {
        if (s.oppType === 'claude') await App.ClaudeOpponent.respondToAttack(duel, 1, ui);
        else App.Bot.respondToAttack(duel, 1);
      } finally { s.busy = false; }
      if (duel.pendingAttack) duel.resolveAttack();
      render();
    }

    async function changeLp() {
      const v = await dialog('<h2 id="modal-title">Change LP</h2><div class="row"><label>Player <select id="lp-who"><option value="0">You</option><option value="1">' + esc(duel.pname(1)) + '</option></select></label>' +
        '<label>Amount <input type="number" id="lp-amt" value="1000" step="100"></label></div><div class="row"><button type="button" class="btn btn-primary" data-v="-1">Take damage</button><button type="button" class="btn" data-v="1">Gain LP</button></div>',
        (body, done) => body.addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (b) done({ p: Number(U.$('#lp-who', body).value), amt: Math.abs(Number(U.$('#lp-amt', body).value) || 0) * Number(b.getAttribute('data-v')) });
        }));
      if (v && v.amt) duel.changeLp(v.p, v.amt, 'manual');
    }

    async function modifyAtk(c) {
      const v = await dialog('<h2 id="modal-title">Change ' + esc(c.name) + '\'s ATK</h2><div class="row"><input type="number" id="atk-amt" value="500" step="100"><label class="check"><input type="checkbox" id="atk-eot" checked> Until end of turn</label></div><div class="row"><button type="button" class="btn btn-primary" data-v="1">Gain ATK</button><button type="button" class="btn" data-v="-1">Lose ATK</button></div>',
        (body, done) => body.addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (b) done({ amount: (Number(U.$('#atk-amt', body).value) || 0) * Number(b.getAttribute('data-v')), eot: U.$('#atk-eot', body).checked });
        }));
      if (v) duel.applyOp(0, { op: 'modify_atk', card: c.uid, amount: v.amount, until_end_of_turn: v.eot });
    }

    /* The action menu for one of your cards. */
    function actionsFor(loc) {
      const c = loc.card;
      const k = duel.kind(c);
      const main = duel.active === 0 && duel.isMain() && !s.busy;
      const acts = [];
      const add = (label, fn, primary) => acts.push({ label: label, fn: fn, primary: primary });
      const moveSet = (exclude) => {
        if (exclude.indexOf('hand') === -1) add('Add to hand', () => duel.sendTo(c.uid, 'hand'));
        if (exclude.indexOf('gy') === -1) add(loc.zone === 'hand' ? 'Discard / send to GY' : 'Send to GY', () => duel.sendTo(c.uid, 'gy'));
        if (exclude.indexOf('banished') === -1) add('Banish', () => duel.sendTo(c.uid, 'banished'));
        if (exclude.indexOf('deck') === -1) add(duel.isExtra(c) ? 'Return to Extra Deck' : 'Shuffle into Deck', () => duel.sendTo(c.uid, 'deck'));
        if (exclude.indexOf('deck') === -1 && !duel.isExtra(c)) add('Put on top of Deck', () => duel.sendTo(c.uid, 'deckTop'));
      };
      if (loc.zone === 'hand') {
        if (k === 'monster') {
          if (main) { add('Normal Summon', () => summonFlow(c, 'atk'), true); add('Set (face-down)', () => summonFlow(c, 'set')); }
          add('Special Summon (by an effect)', async () => { const pos = await ask('Position', '', [{ label: 'Attack', value: 'atk', primary: true }, { label: 'Defense', value: 'def' }]); if (pos) { const r = duel.specialSummon(0, c.uid, pos, { how: 'effect' }); if (!r.ok) U.toast(r.message); } });
          add('Activate effect from hand', async () => { duel.say('You activate ' + c.name + '\'s effect.', 0); await resolveEffect(c, App.Effects.plan(duel, 0, c, { summoned: true }), false); });
        } else {
          add('Activate', () => activateFlow(c.uid), true);
          if (main) add('Set', () => { const r = duel.setSpellTrap(0, c.uid); if (!r.ok) U.toast(r.message); });
        }
        moveSet(['hand']);
      } else if (loc.zone === 'mz' || loc.zone === 'emz') {
        if (duel.active === 0 && duel.phase === 'battle') add('Attack', () => attackFlow(c), true);
        if (main) add(c.faceUp ? 'Change battle position' : 'Flip Summon', () => { const r = duel.changePosition(0, c.uid); if (!r.ok) U.toast(r.message); });
        add('Activate effect', async () => { duel.say('You activate ' + c.name + '\'s effect.', 0); await resolveEffect(c, App.Effects.plan(duel, 0, c, { summoned: true }), false); });
        add('Change ATK', () => modifyAtk(c));
        add('Destroy', () => duel.destroy(c.uid, 'you'));
        add('Turn face-down', () => duel.applyOp(0, { op: 'flip_face_down', card: c.uid }));
        moveSet(['gy']);
      } else if (loc.zone === 'st' || loc.zone === 'field') {
        if (!c.faceUp) add('Activate', () => activateFlow(c.uid), true);
        else add('Activate effect', async () => { duel.say('You activate ' + c.name + '\'s effect.', 0); await resolveEffect(c, App.Effects.plan(duel, 0, c), false); });
        add('Destroy', () => duel.destroy(c.uid, 'you'));
        moveSet(['gy']);
      } else if (loc.zone === 'extra') {
        add('Summon from the Extra Deck', () => extraSummonFlow(c), true);
        add('Send to GY', () => duel.sendTo(c.uid, 'gy'));
        add('Banish', () => duel.sendTo(c.uid, 'banished'));
      } else {
        // gy, banished, deck
        if (k === 'monster' && !duel.isExtra(c)) add('Special Summon', async () => { const pos = await ask('Position', '', [{ label: 'Attack', value: 'atk', primary: true }, { label: 'Defense', value: 'def' }]); if (pos) { const r = duel.specialSummon(0, c.uid, pos, { how: 'effect' }); if (!r.ok) U.toast(r.message); } }, true);
        if (k === 'monster' && duel.isExtra(c) && loc.zone !== 'deck') add('Special Summon', () => duel.specialSummon(0, c.uid, 'atk', { how: 'effect' }), true);
        if (k !== 'monster' && loc.zone !== 'deck') add('Set it on the field', () => { duel.sendTo(c.uid, 'hand', false); const r = duel.setSpellTrap(0, c.uid); if (!r.ok) U.toast(r.message); });
        moveSet([loc.zone === 'banished' ? 'banished' : loc.zone === 'deck' ? 'deck' : 'gy']);
        if (loc.zone === 'deck') acts.forEach((a) => { const fn = a.fn; a.fn = async () => { await fn(); duel.applyOp(0, { op: 'shuffle_deck' }); }; });
      }
      return acts;
    }

    async function openMenu(uid) {
      const loc = duel.find(uid);
      if (!loc) return;
      const c = loc.card;
      const mine = loc.player === 0 || (c.controller === 0);
      if (!mine) {
        if (c.faceUp || loc.zone === 'gy' || loc.zone === 'banished' || (loc.zone === 'hand' && s.reveal)) C.openCard(c.id);
        return;
      }
      const acts = actionsFor(loc);
      const zoneName = { hand: 'Hand', mz: 'Monster Zone', emz: 'Extra Monster Zone', st: 'Spell & Trap Zone', field: 'Field Zone', gy: 'Graveyard', banished: 'Banished', deck: 'Deck', extra: 'Extra Deck' }[loc.zone];
      const pick = await dialog(
        '<div class="menu-card"><img src="' + esc(api.image(c.data, 'small')) + '" alt="">' +
        '<div><h2 id="modal-title">' + esc(c.name) + '</h2><div class="type-line">' + esc(api.typeLine(c.data)) + '</div>' +
        (duel.kind(c) === 'monster' ? '<div class="stat-line">' + esc(api.statLine(Object.assign({}, c.data, { atk: duel.atk(c), def: duel.def(c) }))) + '</div>' : '') +
        '<div class="muted small">' + zoneName + (c.faceUp === false ? ' · face-down' : '') + '</div>' +
        '<div class="card-text small">' + descHtml(c) + '</div></div></div>' +
        '<div class="menu-actions">' + acts.map((a, i) => '<button type="button" class="btn' + (a.primary ? ' btn-primary' : '') + '" data-a="' + i + '">' + esc(a.label) + '</button>').join('') + '</div>',
        (body, done) => body.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) done(Number(b.getAttribute('data-a'))); }));
      if (pick == null) return;
      await acts[pick].fn();
      render();
    }

    async function openPile(p, pile) {
      const pl = duel.players[p];
      if (p === 1 && (pile === 'deck' || pile === 'extra')) { U.toast(duel.pname(1) + '\'s ' + (pile === 'deck' ? 'Deck' : 'Extra Deck') + ' has ' + pl[pile].length + ' cards.'); return; }
      const cards = pile === 'deck' ? pl.deck.slice().sort((a, b) => a.name.localeCompare(b.name)) : pl[pile].slice();
      const label = { deck: 'Your Deck', gy: (p === 0 ? 'Your' : duel.pname(1) + '\'s') + ' Graveyard', banished: (p === 0 ? 'Your' : duel.pname(1) + '\'s') + ' banished cards', extra: 'Your Extra Deck' }[pile];
      const pick = await choose(label + ' (' + cards.length + ')', cards, { note: p === 0 ? 'Pick a card to see what you can do with it.' : 'Pick a card to read it.' });
      if (!pick) return;
      if (p === 1) { C.openCard(duel.find(pick[0]).card.id); return; }
      await openMenu(pick[0]);
    }

    async function endTurn() {
      const over = duel.players[0].hand.length - 6;
      if (over > 0) {
        const disc = await choose('Hand size limit: discard ' + over, duel.players[0].hand.slice(), { count: over, min: over, confirm: 'Discard' });
        (disc || duel.players[0].hand.slice(0, over).map((c) => c.uid)).forEach((u) => duel.sendTo(u, 'gy', 'hand size limit'));
      }
      duel.endTurn();
    }

    root.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('#resolve-done')) {
        const r = s.resolving; s.resolving = null;
        if (r && r.isST) duel.finishActivation(r.uid);
        render();
        return;
      }
      if (t.closest('#to-battle')) { duel.nextPhase(); return; }
      if (t.closest('#to-main2')) { duel.nextPhase(); return; }
      if (t.closest('#end-turn')) { await endTurn(); return; }
      if (t.closest('#rematch')) { try { await start(s.setup); playPage(view); } catch (err) { U.toast(err.message); } return; }
      const tool = t.closest('[data-tool]');
      if (tool) {
        const what = tool.getAttribute('data-tool');
        if (what === 'draw') duel.draw(0, 1);
        if (what === 'shuffle') duel.applyOp(0, { op: 'shuffle_deck' });
        if (what === 'search') await openPile(0, 'deck');
        if (what === 'lp') await changeLp();
        if (what === 'reveal') s.reveal = !s.reveal;
        if (what === 'new') { location.hash = '#/duel'; return; }
        duel.changed();
        return;
      }
      const pile = t.closest('[data-pile]');
      if (pile) { await openPile(Number(pile.getAttribute('data-p')), pile.getAttribute('data-pile')); return; }
      const card = t.closest('[data-uid]');
      if (card) await openMenu(card.getAttribute('data-uid'));
    });

    render();
  }

  App.views = App.views || {};
  App.views.duelSetup = setupPage;
  App.views.duelPlay = playPage;
  App.duelSession = () => session;
})(window.App);
