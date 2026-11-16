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
      // Wire events to this dialog's own element: #modal-body is shared by every
      // dialog, so listeners on it would keep firing for later dialogs.
      const body = document.querySelector('#modal-body .duel-dialog');
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; C._onClose = null; C.closeModal(); resolve(v); };
      C._onClose = () => { if (!settled) { settled = true; resolve(null); } };
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

  const SERIES = ['All', 'Duel Monsters', 'GX', '5D\'s', 'ZEXAL', 'ARC-V', 'VRAINS'];

  /* Fighting-game style rival select: a big spotlight and a grid of faces. */
  function roster(selId) {
    const chars = App.characters.list();
    return '<div class="roster"><div class="spotlight" id="spotlight">' + spotlightHtml(selId) + '</div>' +
      '<div class="roster-side"><div class="series-tabs" role="tablist">' + SERIES.map((x, i) => '<button type="button" class="series-tab' + (i === 0 ? ' on' : '') + '" data-series="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' +
      '<div class="roster-grid">' + chars.map((c) => {
        const r = App.profile.vs(c.id);
        const custom = App.characters.portrait(c.id);
        return '<button type="button" class="char-tile roster-face' + (c.id === selId ? ' selected' : '') + '" data-char="' + c.id + '" data-series-of="' + esc(c.series) + '" style="--ring:' + c.color + '" title="' + esc(c.name) + '">' +
          '<span class="char-art"' + (custom ? ' style="background-image:url(\'' + custom + '\')"' : ' data-ace="' + esc(c.ace) + '"') + '></span>' +
          '<span class="char-name">' + esc(c.short) + '</span>' + (r.w ? '<span class="beaten" title="Beaten">★</span>' : '') + '</button>';
      }).join('') + '</div><p class="muted small">Each rival plays a modern version of their deck, built from the newest cards.</p></div></div>';
  }

  function spotlightHtml(id) {
    const c = id && App.characters.get(id);
    if (!c) return '<div class="sl-empty muted">Pick a rival →</div>';
    const r = App.profile.vs(c.id);
    const custom = App.characters.portrait(c.id);
    return '<div class="sl-art char-art"' + (custom ? ' style="background-image:url(\'' + custom + '\');--ring:' + c.color + '"' : ' data-ace="' + esc(c.ace) + '" style="--ring:' + c.color + '"') + '></div>' +
      '<div class="sl-info" style="--ring:' + c.color + '"><div class="sl-series">' + esc(c.series) + '</div><div class="sl-name">' + esc(c.name) + '</div>' +
      '<div class="sl-deck">' + esc(c.archetypes[0]) + ' · Ace: ' + esc(c.ace) + '</div><p class="sl-style">' + esc(c.style) + '</p>' +
      '<div class="sl-rec">' + (r.w + r.l ? '<span class="w">' + r.w + ' W</span> <span class="l">' + r.l + ' L</span>' + (r.w ? ' <span class="beaten-tag">★ Beaten</span>' : '') : '<span class="muted">Not faced yet</span>') + '</div>' +
      '<div class="sl-photo"><label class="btn btn-small btn-ghost" title="Use your own picture for ' + esc(c.short) + '">📷 Picture<input type="file" accept="image/*" data-portrait="' + c.id + '" hidden></label>' +
      (custom ? '<button type="button" class="btn btn-small btn-ghost" data-portrait-clear="' + c.id + '">Reset</button>' : '') + '</div></div>';
  }

  function setupPage(view, params) {
    const decks = D.all();
    const chars = App.characters.list();
    const last = U.store.get('dv-duel-setup', {});
    const oppSel = params.get('vs') ? '__char:' + params.get('vs') : last.theirs && (D.get(last.theirs) || last.theirs.indexOf('__') === 0) ? last.theirs : '__char:jaden';
    // No deck yet? Play with a famous duelist's deck, so you can duel straight away.
    const validMine = (v) => v && (D.get(v) || (v.indexOf('__char:') === 0 && App.characters.get(v.slice(7))));
    const fallbackMine = decks[0] ? decks[0].id : '__char:' + (oppSel === '__char:yugi' ? 'kaiba' : 'yugi');
    const preMine = [params.get('deck'), last.mine].find(validMine) || fallbackMine;
    const mineDeck = D.get(preMine);
    const cs = App.ClaudeOpponent.settings.get();
    const deckOpts = (sel) => decks.map((d) => '<option value="' + esc(d.id) + '"' + (d.id === sel ? ' selected' : '') + '>' + esc(d.name) + ' (' + d.main.length + ' cards)</option>').join('');
    const charOpts = (sel) => chars.map((c) => '<option value="__char:' + c.id + '"' + ('__char:' + c.id === sel ? ' selected' : '') + '>' + esc(c.name) + ' — ' + esc(c.archetypes[0]) + '</option>').join('');
    const yourDecks = decks.length ? '<optgroup label="Your decks">' : '';

    view.innerHTML = '<section class="page duel-setup-page">' +
      '<div class="page-head"><h1>Duel</h1><p class="muted">Practise against a famous duelist. Pick your opponent and your deck, then press <strong>Start duel</strong>. Everything else is optional.</p></div>' +
      '<form id="duel-form" autocomplete="off">' +
      '<div class="panel roster-panel"><h3><span class="step-num">1</span> Choose your rival</h3>' +
        roster(oppSel.indexOf('__char:') === 0 ? oppSel.slice(7) : null) +
        '<div class="setup-grid more-opp">' +
          '<label>Or play against<select name="theirs"><optgroup label="Famous duelists">' + charOpts(oppSel) + '</optgroup>' + (decks.length ? '<optgroup label="Your decks">' + deckOpts(oppSel) + '</optgroup>' : '') +
            '<option value="__auto"' + (oppSel === '__auto' ? ' selected' : '') + '>A deck auto-built from an archetype…</option>' +
            '<option value="__mirror"' + (oppSel === '__mirror' ? ' selected' : '') + '>The same deck as mine (mirror match)</option></select></label>' +
          '<label class="arch-row">Opponent\'s archetype<input name="arch" list="duel-archetypes" placeholder="e.g. Blue-Eyes" value="' + esc(last.arch || 'Blue-Eyes') + '"></label>' +
        '</div></div>' +
      '<div class="panel"><h3><span class="step-num">2</span> Choose your deck</h3>' +
        '<div class="setup-grid"><label>Your deck<select name="mine" required>' + (decks.length ? yourDecks + deckOpts(preMine) + '</optgroup>' : '') +
          '<optgroup label="Play with a famous duelist\'s deck">' + charOpts(preMine) + '</optgroup></select></label></div>' +
        '<p class="muted small">' + (decks.length ? 'Want a new deck? <a href="#/build">⚡ Auto-build one</a> in one click.' : 'No deck of your own yet? Borrow a famous duelist\'s deck above, or <a href="#/build">⚡ auto-build your own</a> in one click.') + '</p>' +
      '</div>' +
      '<div class="panel"><h3><span class="step-num">3</span> Who plays your opponent?</h3>' +
        '<div class="choice-cards">' +
          '<label class="choice-card"><input type="radio" name="ai" value="bot"' + (last.ai !== 'claude' ? ' checked' : '') + '><span><strong>🤖 Built-in bot</strong><span class="muted small">Free and works offline. Summons, chains hand traps and attacks by the rules.</span></span></label>' +
          '<label class="choice-card"><input type="radio" name="ai" value="claude"' + (last.ai === 'claude' ? ' checked' : '') + '><span><strong>✦ Claude AI</strong><span class="muted small">Reads every card and plays like a person. Needs your Anthropic API key (paid per use).</span></span></label>' +
        '</div>' +
        '<div class="claude-settings">' +
          '<label>Anthropic API key<input type="password" name="key" placeholder="sk-ant-…" value="' + esc(cs.apiKey) + '" autocomplete="off"></label>' +
          '<label>Model<select name="model">' + App.ClaudeOpponent.MODELS.map((m) => '<option value="' + m.id + '"' + (m.id === cs.model ? ' selected' : '') + '>' + esc(m.label) + '</option>').join('') + '</select></label>' +
          '<label>Thinking<select name="effort"><option value="">Balanced (default)</option><option value="low"' + (cs.effort === 'low' ? ' selected' : '') + '>Faster turns</option><option value="high"' + (cs.effort === 'high' ? ' selected' : '') + '>Deeper thinking (slower)</option></select></label>' +
          '<p class="muted small">The key is saved only on this device and sent only to api.anthropic.com. Get one at console.anthropic.com.</p>' +
        '</div>' +
      '</div>' +
      '<details class="panel more-options"' + (last.format && last.format !== 'tcg' || last.lp ? ' open' : '') + '><summary>More options <span class="muted small">rulings, who goes first, Life Points, your picture</span></summary>' +
        '<div class="setup-grid">' +
          '<label>Rulings / format<select name="format">' + F.options(last.format || (mineDeck && mineDeck.format) || 'tcg') + '</select></label>' +
          '<label>Who goes first<select name="first"><option value="coin">Coin toss</option><option value="me"' + (last.first === 'me' ? ' selected' : '') + '>Me</option><option value="opp"' + (last.first === 'opp' ? ' selected' : '') + '>Opponent</option></select></label>' +
          '<label>Starting Life Points<input type="number" name="lp" min="100" step="100" placeholder="Format default" value="' + esc(last.lp || '') + '"></label>' +
        '</div>' +
        '<p class="muted small" id="fmt-desc"></p>' +
        '<div class="you-pic"><div class="row">' + App.characters.avatar('you', 'big') + '<div><strong>Your picture</strong><p class="muted small">Shown next to your name in duels. Saved on this device only.</p>' +
          '<label class="btn btn-small">📷 Choose a picture<input type="file" accept="image/*" data-portrait="you" hidden></label>' +
          (App.characters.portrait('you') ? ' <button type="button" class="btn btn-small btn-ghost" data-portrait-clear="you">Remove</button>' : '') + '</div></div></div>' +
        '<p class="muted small">Automated for you: turn and phase order, drawing, summons and Tributes, Spell and Trap timing, chains, battle, damage and win conditions. Common card effects resolve with one click.</p>' +
      '</details>' +
      '<div class="start-bar"><div class="start-summary" id="start-summary"></div>' +
        '<button class="btn btn-primary btn-big" type="submit">⚔ Start duel</button><span id="duel-setup-status" class="muted small" role="status"></span></div>' +
      '<datalist id="duel-archetypes"></datalist>' +
      '</form></section>';

    const form = U.$('#duel-form', view);
    App.characters.paintArt(view);
    App.characters.wirePortraits(view, () => App.router());
    const showSpot = (id) => { U.$('#spotlight', view).innerHTML = spotlightHtml(id); App.characters.paintArt(U.$('#spotlight', view)); };
    view.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-series]');
      if (tab) {
        const sr = tab.getAttribute('data-series');
        U.$$('.series-tab', view).forEach((x) => x.classList.toggle('on', x === tab));
        U.$$('.roster-face', view).forEach((x) => { x.hidden = sr !== 'All' && x.getAttribute('data-series-of') !== sr; });
        App.sound.play('menu-move');
        return;
      }
      const t = e.target.closest('[data-char]');
      if (!t) return;
      form.theirs.value = '__char:' + t.getAttribute('data-char');
      U.$$('.char-tile', view).forEach((x) => x.classList.toggle('selected', x === t));
      showSpot(t.getAttribute('data-char'));
      App.sound.play('menu-ok');
      sync();
    });
    view.addEventListener('mouseover', (e) => {
      const t = e.target.closest('.roster-face');
      if (!t || t.classList.contains('hovered')) return;
      U.$$('.roster-face.hovered', view).forEach((x) => x.classList.remove('hovered'));
      t.classList.add('hovered');
      App.sound.play('menu-move');
    });
    api.getArchetypes().then((l) => { U.$('#duel-archetypes', view).innerHTML = l.map((a) => '<option value="' + esc(a) + '">').join(''); }).catch(() => {});
    const deckLabel = (v, arch) => {
      if (v.indexOf('__char:') === 0) { const c = App.characters.get(v.slice(7)); return c ? c.short + '\'s ' + c.archetypes[0] + ' deck' : ''; }
      if (v === '__auto') return (arch || 'an archetype') + ' deck';
      if (v === '__mirror') return 'your own deck';
      const d = D.get(v); return d ? d.name : '';
    };
    const sync = () => {
      U.$('.arch-row', view).hidden = form.theirs.value !== '__auto';
      U.$('.claude-settings', view).hidden = form.ai.value !== 'claude';
      U.$('#fmt-desc', view).textContent = F.get(form.format.value).description;
      const t = form.theirs.value;
      const ch = t.indexOf('__char:') === 0 ? App.characters.get(t.slice(7)) : null;
      U.$('#start-summary', view).innerHTML = App.characters.avatar('you') + '<span><strong>You</strong><span class="muted small">' + esc(deckLabel(form.mine.value)) + '</span></span>' +
        '<span class="vs">VS</span>' + (ch ? App.characters.avatar(ch.id) : '<span class="avatar avatar-you">' + (form.ai.value === 'claude' ? '✦' : '🤖') + '</span>') +
        '<span><strong>' + esc(ch ? ch.short : form.ai.value === 'claude' ? 'Claude' : 'Bot') + '</strong><span class="muted small">' + esc(deckLabel(t, form.arch.value.trim())) + ' · ' + esc(F.get(form.format.value).short) + '</span></span>';
      App.characters.paintArt(U.$('#start-summary', view));
    };
    form.addEventListener('change', (e) => {
      if (e.target.name === 'mine') { const d = D.get(form.mine.value); if (d && d.format) form.format.value = d.format; }
      if (e.target.name === 'theirs') {
        U.$$('.char-tile', view).forEach((x) => x.classList.toggle('selected', '__char:' + x.getAttribute('data-char') === form.theirs.value));
        showSpot(form.theirs.value.indexOf('__char:') === 0 ? form.theirs.value.slice(7) : null);
      }
      sync();
    });
    form.addEventListener('input', (e) => { if (e.target.name === 'arch') sync(); });
    sync();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = U.$('#duel-setup-status', view);
      const btn = U.$('button[type=submit]', form);
      const setup = { mine: form.mine.value, theirs: form.theirs.value, arch: form.arch.value.trim(), format: form.format.value, first: form.first.value, lp: form.lp.value, ai: form.ai.value };
      U.store.set('dv-duel-setup', setup);
      if (setup.ai === 'claude') {
        App.ClaudeOpponent.settings.set({ apiKey: form.key.value.trim(), model: form.model.value, effort: form.effort.value });
        if (!form.key.value.trim()) { status.textContent = 'Enter your Anthropic API key in step 3, or pick the built-in bot.'; form.key.focus(); return; }
      }
      status.textContent = 'Building decks and shuffling… this can take a few seconds.';
      btn.disabled = true;
      const t = setup.theirs;
      const ch = t.indexOf('__char:') === 0 ? App.characters.get(t.slice(7)) : null;
      const fast = String(U.store.get('dv-duel-speed', '')) === '0';
      const splash = App.game.vsSplash(
        { avatar: App.characters.avatar('you', 'huge'), name: App.profile.name() || 'You', sub: deckLabel(setup.mine) },
        { avatar: ch ? App.characters.avatar(ch.id, 'huge') : '<span class="avatar avatar-you huge">' + (setup.ai === 'claude' ? '✦' : '🤖') + '</span>', name: ch ? ch.name : setup.ai === 'claude' ? 'Claude' : 'Bot', sub: deckLabel(t, setup.arch) },
        fast);
      try {
        await start(setup);
        const fi = session.firstInfo;
        await splash.ready({ line: ch ? App.characters.line(ch.id, 'intro') : '', coin: fi.coin ? { youFirst: fi.youFirst, firstName: fi.firstName } : null });
        location.hash = '#/duel/play';
      } catch (err) {
        splash.fail();
        status.textContent = err.message;
        btn.disabled = false;
      }
    });
  }

  async function cardsFor(ids) {
    const missing = ids.filter((id) => !D.cached(id));
    if (missing.length) D.rememberMany(await api.getCardsByIds(missing));
    return ids.map((id) => D.cached(id)).filter(Boolean);
  }

  async function start(setup) {
    let mine = D.get(setup.mine);
    if (setup.mine && setup.mine.indexOf('__char:') === 0) {
      const me = App.characters.get(setup.mine.slice(7));
      if (me) { const built = await App.characters.buildDeck(me.id, setup.format); mine = { name: built.name, main: built.main, extra: built.extra }; }
    }
    if (!mine || !mine.main.length) throw new Error('Pick a deck with Main Deck cards.');
    let theirs;
    let character = null;
    if (setup.theirs.indexOf('__char:') === 0) {
      character = App.characters.get(setup.theirs.slice(7));
      if (!character) throw new Error('Pick an opponent.');
      const built = await App.characters.buildDeck(character.id, setup.format);
      theirs = { name: built.name, main: built.main, extra: built.extra };
    } else if (setup.theirs === '__mirror') theirs = { name: mine.name, main: mine.main, extra: mine.extra };
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
    const oppSpec = await spec(theirs, character ? character.short : setup.ai === 'claude' ? 'Claude' : 'Bot');
    App.ClaudeOpponent.setPersona(character && setup.ai === 'claude'
      ? 'You are playing as ' + character.name + ' from Yu-Gi-Oh! ' + character.series + ' (' + character.persona + '). Write your one-sentence comments in that character\'s voice, using your own words rather than quoting the show.'
      : null);
    if (meSpec.main.length < fmt.hand + 1 || oppSpec.main.length < fmt.hand + 1) throw new Error('Both decks need more cards than an opening hand.');
    let first = setup.first === 'me' ? 0 : setup.first === 'opp' ? 1 : (Math.random() < 0.5 ? 0 : 1);
    const duel = new App.Duel.Duel({ format: fmt.key, first: first, lp: Number(setup.lp) || null, decks: [meSpec, oppSpec] });
    duel.log.unshift({ turn: 0, text: (setup.first === 'coin' ? 'Coin toss: ' : '') + (first === 0 ? 'You go' : oppSpec.playerName + ' goes') + ' first. Format: ' + fmt.label + '.' });
    if (character) duel.log.unshift({ turn: 0, text: character.name + ' steps up with ' + character.style.charAt(0).toLowerCase() + character.style.slice(1).replace(/\.$/, '') + (setup.ai === 'claude' ? ' (played by Claude).' : ' (played by the built-in bot).') });
    if (mine.main.length < fmt.main[0]) duel.log.unshift({ turn: 0, text: 'Note: your deck is below the ' + fmt.label + ' minimum (' + fmt.main[0] + ') — fine for practice.' });
    session = { duel: duel, oppType: setup.ai, reveal: false, busy: false, status: '', resolving: null, setup: setup, character: character ? character.id : null,
      firstInfo: { coin: setup.first === 'coin', youFirst: first === 0, firstName: oppSpec.playerName } };
  }

  /* ---------- the board ---------- */

  function playPage(view) {
    if (!session) {
      view.innerHTML = '<section class="page">' + C.empty('No duel in progress.') + '<p style="text-align:center"><a class="btn btn-primary" href="#/duel">Set up a duel</a></p></section>';
      return;
    }
    const s = session;
    const duel = s.duel;
    const SPEEDS = { slow: 800, normal: 450, fast: 150 };
    let speed = U.store.get('dv-duel-speed', 450);
    if (typeof speed === 'string') speed = SPEEDS[speed] != null ? SPEEDS[speed] : Number(speed);
    speed = isNaN(Number(speed)) ? 450 : Number(speed);

    const ui = {
      pause: (ms) => new Promise((r) => setTimeout(r, ms == null ? speed : Math.min(ms, speed))),
      status: (t) => { s.status = t; const box = document.getElementById('duel-status'); if (box) box.textContent = t; },
      error: (m) => U.toast(m),
      defenderWindow: (pending) => defendAgainst(pending),
      responseWindow: (ev) => yourResponse(ev),
      processFlips: () => processFlips()
    };
    s.ui = ui;
    s.open = s.open || {};

    view.innerHTML = '<section class="page duel-page"><div id="duel-root"></div></section>';
    const root = U.$('#duel-root', view);

    /* What a card can do right now (for the glow hints). */
    function hintFor(c, zone) {
      if (duel.active !== 0 || duel.winner != null || s.busy) return '';
      const k = duel.kind(c);
      const main = duel.isMain();
      if (zone === 'hand') {
        if (k === 'monster' && main && !duel.players[0].normalSummoned && !duel.isExtra(c) && duel.tributesNeeded(c) <= duel.monsters(0).length) return ' playable';
        if (k === 'spell' && (main || /Quick-Play/.test(c.data.race || ''))) return ' playable';
        if (k === 'trap' && main) return ' settable';
        return '';
      }
      if ((zone === 'mz' || zone === 'emz') && duel.phase === 'battle' && c.faceUp && c.pos === 'atk' && !c.attacked) return ' ready';
      if ((zone === 'st' || zone === 'field') && !c.faceUp && c.setTurn != null && (duel.kind(c) === 'spell' ? main || /Quick-Play/.test(c.data.race || '') : c.setTurn < duel.turn)) return ' playable';
      return '';
    }

    /* drop: 'mz'|'st'|'field'|'emz' for empty zones (with data-index). */
    function slot(c, mine, label, drop, index, zone) {
      if (!c) return '<div class="slot empty' + (drop ? ' zone-' + drop : '') + '"' + (mine && drop ? ' data-drop="' + drop + '" data-index="' + index + '"' : '') + '><span>' + esc(label || '') + '</span></div>';
      const hidden = !c.faceUp && !mine;
      const monster = duel.kind(c) === 'monster';
      const isLink = /link/i.test(c.data.type || '');
      const fieldZone = zone === 'mz' || zone === 'emz';
      const ownedByMe = (c.controller != null ? c.controller : c.owner) === 0;
      mine = mine && ownedByMe || (mine && zone === 'hand' && !ownedByMe ? 'peek' : mine);
      return '<button type="button" class="slot card-slot' + (c.pos === 'def' && monster && fieldZone ? ' def' : '') + (!c.faceUp ? ' facedown' : '') + (mine ? ' mine' : ' theirs') + (mine === true ? hintFor(c, zone) : '') + (!mine && fieldZone ? ' target' : '') + '" data-uid="' + c.uid + '"' + (mine === true ? ' draggable="true"' : '') + ' title="' + esc(hidden ? 'Face-down card' : c.name) + '">' +
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
        (mine ? App.characters.avatar('you') : s.character ? App.characters.avatar(s.character) : '<span class="avatar avatar-you" style="--ring:#3fb6ff">' + (s.oppType === 'claude' ? '✦' : '🤖') + '</span>') +
        '<div class="pname"><strong>' + esc(mine ? App.profile.name() || pl.name : pl.name) + '</strong><span class="muted small">' + esc(pl.deckName) + '</span></div>' +
        '<div class="lp-box"' + (mine ? '' : ' data-drop="opp-lp"') + '><div class="lp' + (pl.lp <= duel.format.lp / 4 ? ' low' : '') + '" id="lp-' + p + '">' + pl.lp + '<small>LP</small></div>' +
          '<div class="lp-bar"><span style="width:' + Math.max(0, Math.min(100, pl.lp / duel.format.lp * 100)) + '%"></span></div></div>' +
        '<div class="piles">' +
          '<button type="button" class="pile pile-deck" data-pile="deck" data-p="' + p + '"' + (mine ? ' data-drop="deck"' : '') + '>Deck <b>' + pl.deck.length + '</b></button>' +
          '<button type="button" class="pile pile-gy" data-pile="gy" data-p="' + p + '"' + (mine ? ' data-drop="gy"' : '') + '>GY <b>' + pl.gy.length + '</b></button>' +
          '<button type="button" class="pile pile-banished" data-pile="banished" data-p="' + p + '"' + (mine ? ' data-drop="banished"' : '') + '>Banished <b>' + pl.banished.length + '</b></button>' +
          '<button type="button" class="pile pile-extra" data-pile="extra" data-p="' + p + '">Extra <b>' + pl.extra.length + '</b></button>' +
          (mine ? '' : '<span class="pile static">Hand ' + pl.hand.length + '</span>') +
        '</div></div>';
    }

    function zonesRow(p, kind) {
      const pl = duel.players[p];
      const mine = p === 0;
      let cells;
      if (kind === 'mz') cells = pl.mz.map((c, i) => slot(c, mine, 'Monster', 'mz', i, 'mz'));
      else cells = pl.st.map((c, i) => slot(c, mine, 'Spell Trap', 'st', i, 'st'));
      if (!mine) cells.reverse();
      const fieldCell = kind === 'st' ? '<div class="field-zone">' + slot(pl.field, mine, 'Field', 'field', 0, 'field') + '</div>' : '<div class="field-zone spacer"></div>';
      return '<div class="zones ' + kind + '">' + (mine ? '' : fieldCell) + '<div class="zone-cells">' + cells.join('') + '</div>' + (mine ? fieldCell : '') + '</div>';
    }

    function handRow(p) {
      const pl = duel.players[p];
      const mine = p === 0;
      if (!mine && !s.reveal) return '<div class="hand-row theirs">' + pl.hand.map(() => '<div class="slot hand-back"><span class="cardback"></span></div>').join('') + '</div>';
      const n = pl.hand.length;
      return '<div class="hand-row' + (mine ? ' mine' : ' theirs') + '"' + (mine ? ' data-drop="hand"' : '') + '>' + pl.hand.map((c, i) => {
        const tilt = n > 1 ? (i - (n - 1) / 2) * Math.min(4, 24 / n) : 0;
        return '<div class="hand-card-wrap" style="--tilt:' + tilt.toFixed(1) + 'deg">' + slot(c, mine || s.reveal, null, null, null, 'hand') + '</div>';
      }).join('') + '</div>';
    }

    /* The results screen: victory or defeat, the rival's words, DP earned and your record. */
    function resultsHtml() {
      const won = duel.winner === 0;
      const ch = s.character;
      const line = ch ? App.characters.line(ch, won ? 'lose' : 'win') : '';
      const rec = ch ? App.profile.vs(ch) : null;
      const r = s.reward || { dp: 0 };
      return '<div class="results ' + (won ? 'won' : 'lost') + '"><div class="res-title">' + (won ? 'Victory!' : 'Defeat') + '</div>' +
        '<div class="res-body">' + (ch ? App.characters.avatar(ch, 'huge') : '') +
          '<div class="res-info">' + (line ? '<div class="bubble"><span class="who">' + esc(duel.pname(1)) + '</span><span class="say">' + esc(line) + '</span></div>' : '') +
          '<div class="res-dp">+<span id="dp-count" data-to="' + r.dp + '">0</span> DP' + (r.firstWin ? '<small>First win against ' + esc(duel.pname(1)) + ': +300 bonus!</small>' : '') + '</div>' +
          '<div class="res-rec">' + (rec ? 'Record vs ' + esc(duel.pname(1)) + ': <span class="w">' + rec.w + ' W</span> <span class="l">' + rec.l + ' L</span> · ' : '') + esc(App.profile.rank()) + ' · ' + App.profile.dp().toLocaleString('en-US') + ' DP</div></div></div>' +
        '<div class="row center"><button type="button" class="btn btn-primary" id="rematch">Rematch</button><a class="btn" href="#/duel">Choose a rival</a><a class="btn" href="#/shop">🛒 Card Shop</a><a class="btn btn-ghost" href="#/home">Main menu</a></div></div>';
    }

    /* One plain-English line telling you what you can do right now. */
    function guide() {
      if (duel.winner != null) return duel.winner === 0 ? 'You won! Press Rematch to play again.' : 'Duel over. Press Rematch to try again.';
      if (s.resolving) return 'Finish the effect of ' + s.resolving.name + ' with the card menus, then press Done.';
      if (duel.active !== 0) return duel.pname(1) + ' is taking their turn. If you can respond with a card, you will be asked.';
      if (s.busy) return 'Resolving…';
      const ph = duel.phase;
      const handPlays = duel.players[0].hand.filter((c) => hintFor(c, 'hand')).length;
      if (ph === 'main1') {
        const next = duel.canEnterBattle() ? 'press ⚔ Battle Phase to attack' : 'press End Turn (nobody can attack on the very first turn)';
        return (handPlays ? 'Main Phase: click a glowing card in your hand to play it (or drag it onto the field). ' : 'Main Phase: set up your field. ') + 'When you are ready, ' + next + '.';
      }
      if (ph === 'battle') {
        const ready = duel.monsters(0).filter((c) => c.faceUp && c.pos === 'atk' && !c.attacked).length;
        return ready ? 'Battle Phase: click a glowing monster to attack (or drag it onto a target). Then press Main Phase 2 or End Turn.' : 'Battle Phase: no monster can attack now. Press Main Phase 2 or End Turn.';
      }
      if (ph === 'main2') return 'Main Phase 2: play or Set more cards, then press End Turn.';
      return '';
    }

    function render() {
      if (duel.winner != null && !s.recorded) {
        s.recorded = true;
        s.reward = App.profile.record(s.character, duel.winner === 0);
        // Close any open duel dialog (e.g. a response window): the duel is over.
        if (!document.getElementById('modal').hidden) C.closeModal();
      }
      const myTurn = duel.active === 0;
      const ph = duel.phase;
      const canAct = myTurn && duel.winner == null && !s.busy;
      const emz = duel.emz.length ? '<div class="zones emz"><div class="zone-cells">' + duel.emz.map((c, i) => slot(c, !c || c.controller === 0, 'Extra Monster', 'emz', i, 'emz')).join('') + '</div></div>' : '';
      const logHtml = duel.log.slice(-80).map((l) => '<li class="' + (l.who === 0 ? 'me' : l.who === 1 ? 'opp' : '') + '">' + esc(l.text) + '</li>').join('');
      root.innerHTML =
        '<div class="duel">' +
          '<div class="board">' +
            pinfo(1) + handRow(1) + zonesRow(1, 'st') + zonesRow(1, 'mz') + emz + zonesRow(0, 'mz') + zonesRow(0, 'st') + handRow(0) + pinfo(0) +
          '</div>' +
          '<aside class="duel-side">' +
            '<div class="preview" id="card-preview">' + previewHtml(s.previewUid) + '</div>' +
            '<div class="turn-box"><div class="row-between"><div><strong>Turn ' + duel.turn + '</strong> · ' + (myTurn ? 'Your turn' : esc(duel.pname(1)) + '\'s turn') + '</div><button type="button" class="btn btn-small btn-ghost" data-tool="help" title="How to play (shortcut: ?)">❓ How to play</button></div>' +
              '<p class="guide" id="duel-guide">' + esc(guide()) + '</p>' +
              '<div class="phases">' + ['main1', 'battle', 'main2', 'end'].map((x) => '<span class="' + (x === ph ? 'on' : '') + '">' + App.Duel.PHASE_LABEL[x].replace(' Phase', '').replace('Main ', 'M') + '</span>').join('') + '</div>' +
              (s.resolving ? '<div class="resolving">Resolving <strong>' + esc(s.resolving.name) + '</strong>: ' + (s.resolving.todo ? 'do this with the card menus: <em>' + esc(s.resolving.todo) + '</em> ' : 'use the card menus for its effect, ') + 'then <button type="button" class="btn btn-small btn-primary" id="resolve-done">Done</button></div>' : '') +
              '<div class="row">' +
                (canAct && ph === 'main1' && duel.canEnterBattle() ? '<button type="button" class="btn btn-primary" id="to-battle">⚔ Battle Phase</button>' : '') +
                (canAct && ph === 'battle' ? '<button type="button" class="btn" id="to-main2">Main Phase 2</button>' : '') +
                (canAct ? '<button type="button" class="btn' + (ph === 'main2' || (ph === 'main1' && !duel.canEnterBattle()) ? ' btn-primary' : '') + '" id="end-turn">End Turn</button>' : '') +
              '</div>' +
              '<div id="duel-status" class="muted small">' + esc(s.status || (!myTurn && duel.winner == null ? duel.pname(1) + ' is playing…' : '')) + '</div>' +
            '</div>' +
            '<div class="tools">' +
              '<button type="button" class="btn btn-small btn-ghost" data-tool="new">New duel</button>' +
              (duel.winner == null ? '<button type="button" class="btn btn-small btn-danger" data-tool="surrender">🏳 Surrender</button>' : '') +
            '</div>' +
            '<details class="side-box" data-keep="tools"' + (s.open.tools ? ' open' : '') + '><summary>🛠 Manual tools <span class="muted small">for effects the app doesn\'t handle</span></summary><div class="tools">' +
              '<button type="button" class="btn btn-small" data-tool="draw">Draw 1</button>' +
              '<button type="button" class="btn btn-small" data-tool="search">Search Deck</button>' +
              '<button type="button" class="btn btn-small" data-tool="shuffle">Shuffle</button>' +
              '<button type="button" class="btn btn-small" data-tool="lp">Change LP</button>' +
              '<button type="button" class="btn btn-small" data-tool="reveal">' + (s.reveal ? 'Hide' : 'Reveal') + ' opponent\'s hand</button>' +
            '</div></details>' +
            '<details class="side-box" data-keep="settings"' + (s.open.settings ? ' open' : '') + '><summary>⚙ Settings</summary>' +
            '<div class="duel-settings">' +
              '<label>Ask me to respond <select id="set-respond"><option value="auto"' + (U.store.get('dv-respond', 'auto') === 'auto' ? ' selected' : '') + '>When I can</option><option value="always"' + (U.store.get('dv-respond', 'auto') === 'always' ? ' selected' : '') + '>Always</option><option value="never"' + (U.store.get('dv-respond', 'auto') === 'never' ? ' selected' : '') + '>Never</option></select></label>' +
              '<label>Duel speed <select id="set-speed"><option value="slow"' + (speed === 800 ? ' selected' : '') + '>Slow</option><option value="normal"' + (speed === 450 ? ' selected' : '') + '>Normal</option><option value="fast"' + (speed <= 150 ? ' selected' : '') + '>Fast</option></select></label>' +
            '</div>' +
            '<div class="sound-box"><button type="button" class="btn btn-small" data-tool="sound" aria-pressed="' + App.sound.isOn() + '">' + (App.sound.isOn() ? '🔊 Sound on' : '🔇 Sound off') + '</button>' +
              '<input type="range" id="sound-vol" min="0" max="1" step="0.05" value="' + App.sound.volume() + '" aria-label="Volume"' + (App.sound.isOn() ? '' : ' disabled') + '></div>' +
            '</details>' +
            '<ol class="duel-log" id="duel-log">' + logHtml + '</ol>' +
          '</aside>' +
        '</div>' +
        (duel.winner != null ? resultsHtml() : '');
      const log = U.$('#duel-log', root);
      if (log) log.scrollTop = log.scrollHeight;
      App.characters.paintArt(root);
      rollLp();
      const dpc = document.getElementById('dp-count');
      if (dpc && s.dpAnimated) dpc.textContent = dpc.dataset.to;
      else if (dpc) {
        s.dpAnimated = true;
        const to = Number(dpc.dataset.to) || 0;
        const t0 = performance.now();
        const tick = (t) => { const k = Math.min(1, (t - t0) / 900); const el = document.getElementById('dp-count'); if (!el) return; el.textContent = Math.round(to * k); if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
      flushFx();
      maybeOpponentTurn();
    }

    /* ---------- card preview ---------- */

    function previewHtml(uid) {
      const loc = uid && duel.find(uid);
      if (!loc) return '<div class="preview-empty muted small">Hover over a card to see it here.</div>';
      const c = loc.card;
      const mine = loc.player === 0 || c.controller === 0;
      const hidden = (!c.faceUp && !mine) || (loc.zone === 'hand' && !mine && !s.reveal) || loc.zone === 'deck';
      if (hidden) return '<div class="preview-card"><span class="cardback big"></span></div><div class="preview-info"><strong>Face-down card</strong></div>';
      const monster = duel.kind(c) === 'monster';
      return '<div class="preview-card"><img src="' + esc(api.image(c.data, 'large')) + '" alt=""></div>' +
        '<div class="preview-info"><strong>' + esc(c.name) + '</strong><div class="type-line small">' + esc(api.typeLine(c.data)) + '</div>' +
        (monster ? '<div class="stat-line small">' + esc(api.statLine(Object.assign({}, c.data, { atk: duel.atk(c), def: duel.def(c) }))) + '</div>' : '') +
        '<div class="preview-text">' + descHtml(c) + '</div></div>';
    }

    root.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-uid]');
      if (!el || el.getAttribute('data-uid') === s.previewUid) return;
      s.previewUid = el.getAttribute('data-uid');
      const box = document.getElementById('card-preview');
      if (box) box.innerHTML = previewHtml(s.previewUid);
    });

    duel.listeners = [];
    duel.fxListeners = [];
    duel.on(() => { if (!render.pending) { render.pending = true; requestAnimationFrame(() => { render.pending = false; render(); }); } });

    /* ---------- sounds & animations ---------- */

    s.fxQueue = [];
    const el = (uid) => root.querySelector('[data-uid="' + uid + '"]');

    function flushFx() {
      const q = s.fxQueue.splice(0);
      q.forEach((f) => {
        const node = f.uid ? el(f.uid) : null;
        if (f.cls && node) {
          node.classList.add(f.cls);
          node.addEventListener('animationend', () => node.classList.remove(f.cls), { once: true });
        }
        if (f.run) f.run(node);
      });
    }

    function banner(text, kind) {
      document.querySelectorAll('.duel-banner').forEach((x) => x.remove());
      const b = document.createElement('div');
      b.className = 'duel-banner ' + (kind || '');
      b.textContent = text;
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 1500);
    }

    /* Turn change: a wipe with the duelist's portrait. */
    function turnWipe(p) {
      document.querySelectorAll('.turn-wipe').forEach((x) => x.remove());
      const w = document.createElement('div');
      w.className = 'turn-wipe ' + (p === 0 ? 'mine' : 'theirs');
      const av = p === 0 ? App.characters.avatar('you', 'big') : s.character ? App.characters.avatar(s.character, 'big') : '<span class="avatar big avatar-you">' + (s.oppType === 'claude' ? '✦' : '🤖') + '</span>';
      w.innerHTML = '<div class="tw-band">' + av + '<div class="tw-text"><small>Turn ' + duel.turn + '</small><strong>' + esc(p === 0 ? 'Your Turn' : duel.pname(1) + '\'s Turn') + '</strong></div></div>';
      document.body.appendChild(w);
      App.characters.paintArt(w);
      setTimeout(() => w.remove(), speed > 150 ? 1400 : 700);
    }

    /* LP counters roll from the old value to the new one. */
    function rollLp() {
      s.lpShown = s.lpShown || duel.players.map((x) => x.lp);
      duel.players.forEach((pl, p) => {
        const box = document.getElementById('lp-' + p);
        if (!box) return;
        const from = s.lpShown[p];
        const to = pl.lp;
        if (from === to) return;
        s.lpShown[p] = to;
        const small = box.querySelector('small') ? box.querySelector('small').outerHTML : '';
        const t0 = performance.now();
        const dur = speed > 150 ? 650 : 250;
        box.classList.add('rolling');
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
          const b = document.getElementById('lp-' + p);
          if (!b) return;
          b.innerHTML = v + small;
          if (k < 1) requestAnimationFrame(step); else b.classList.remove('rolling');
        };
        box.innerHTML = from + small;
        requestAnimationFrame(step);
      });
    }

    function floatNumber(p, text, kind) {
      const box = document.getElementById('lp-' + p);
      if (!box) return;
      const r = box.getBoundingClientRect();
      const f = document.createElement('div');
      f.className = 'float-num ' + kind;
      f.textContent = text;
      f.style.left = (r.left + r.width / 2) + 'px';
      f.style.top = (r.top + window.scrollY) + 'px';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 1400);
    }

    /* A copy of a card that plays its "destroyed" animation where the card was. */
    function ghost(uid, cls) {
      const node = el(uid);
      if (!node) return;
      const r = node.getBoundingClientRect();
      const g = node.cloneNode(true);
      g.removeAttribute('data-uid');
      g.className += ' ghost ' + cls;
      Object.assign(g.style, { position: 'absolute', left: r.left + window.scrollX + 'px', top: r.top + window.scrollY + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0 });
      document.body.appendChild(g);
      setTimeout(() => g.remove(), 900);
    }

    function lunge(attackerUid, targetUid, p) {
      const a = el(attackerUid);
      if (!a || !a.animate) return;
      const ar = a.getBoundingClientRect();
      let tr;
      const t = targetUid ? el(targetUid) : document.getElementById('lp-' + (1 - p));
      if (t) tr = t.getBoundingClientRect();
      const dx = tr ? (tr.left + tr.width / 2) - (ar.left + ar.width / 2) : 0;
      const dy = tr ? (tr.top + tr.height / 2) - (ar.top + ar.height / 2) : (p === 0 ? -120 : 120);
      a.animate([
        { transform: getComputedStyle(a).transform === 'none' ? 'none' : getComputedStyle(a).transform, zIndex: 5 },
        { transform: 'translate(' + dx * 0.85 + 'px,' + dy * 0.85 + 'px) scale(1.15)', zIndex: 5, offset: 0.45 },
        { transform: getComputedStyle(a).transform === 'none' ? 'none' : getComputedStyle(a).transform }
      ], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)' });
      if (t) setTimeout(() => { t.classList.add('fx-hit'); setTimeout(() => t.classList.remove('fx-hit'), 400); }, 230);
    }

    duel.onFx((type, d) => {
      App.sound.play(type, d);
      switch (type) {
        case 'summon':
          s.fxQueue.push({ uid: d.uid, cls: d.tribute ? 'fx-special' : 'fx-summon' });
          if (d.tribute && speed > 150) { const l = duel.find(d.uid); if (l) App.game.cutIn(l.card, d.player, 'Tribute Summon'); }
          break;
        case 'special':
          s.fxQueue.push({ uid: d.uid, cls: d.extra ? 'fx-special' : 'fx-summon' });
          if (d.extra && speed > 150) { const l = duel.find(d.uid); if (l) App.game.cutIn(l.card, d.player, (d.how || 'Special Summon')); } else if (d.extra && d.how) banner(d.how + '!', 'summon');
          break;
        case 'set': s.fxQueue.push({ uid: d.uid, cls: 'fx-set' }); break;
        case 'activate': s.fxQueue.push({ uid: d.uid, cls: 'fx-activate' }); break;
        case 'draw': if (d.player === 0) s.fxQueue.push({ run: () => { const cards = root.querySelectorAll('.hand-row.mine .card-slot'); for (let i = Math.max(0, cards.length - d.count); i < cards.length; i++) cards[i].classList.add('fx-draw'); } }); break;
        case 'destroy': ghost(d.uid, 'fx-destroy'); break;
        case 'move': if (d.from === 'mz' || d.from === 'emz' || d.from === 'st' || d.from === 'field') ghost(d.uid, d.to === 'banished' ? 'fx-banish' : 'fx-fade'); break;
        case 'attack': lunge(d.attacker, d.target, d.player); break;
        case 'damage':
          floatNumber(d.player, '-' + d.amount, 'dmg');
          if (d.amount >= 2000) { const b = root.querySelector('.board'); if (b) { b.classList.remove('fx-shake'); void b.offsetWidth; b.classList.add('fx-shake'); } }
          break;
        case 'gain': floatNumber(d.player, '+' + d.amount, 'heal'); break;
        case 'phase': if (d.phase === 'battle') banner('Battle Phase', 'battle'); break;
        case 'turn': turnWipe(d.player); break;
        case 'win': banner('Victory!', 'win'); break;
        case 'lose': banner('Defeat', 'lose'); break;
        default: break;
      }
    });

    /* ---------- drag and drop ---------- */

    root.addEventListener('dragstart', (e) => {
      const node = e.target.closest('[data-uid][draggable="true"]');
      if (!node || duel.winner != null) return;
      s.drag = node.getAttribute('data-uid');
      e.dataTransfer.setData('text/plain', s.drag);
      e.dataTransfer.effectAllowed = 'move';
      const loc = duel.find(s.drag);
      const kind = loc && duel.kind(loc.card);
      root.classList.add('dragging', 'drag-from-' + (loc ? loc.zone : 'x'), 'drag-kind-' + kind);
      if (loc && (loc.zone === 'mz' || loc.zone === 'emz') && duel.phase === 'battle' && duel.active === 0) root.classList.add('drag-attack');
    });
    root.addEventListener('dragend', () => {
      s.drag = null;
      root.className = root.className.split(' ').filter((c) => !/^drag/.test(c)).join(' ');
    });
    const dropTarget = (e) => e.target.closest('[data-drop], .card-slot.theirs.target, .card-slot.mine');
    root.addEventListener('dragover', (e) => {
      if (!s.drag) return;
      const t = dropTarget(e);
      if (t) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; t.classList.add('drop-hover'); }
    });
    root.addEventListener('dragleave', (e) => { const t = dropTarget(e); if (t) t.classList.remove('drop-hover'); });
    root.addEventListener('drop', async (e) => {
      const t = dropTarget(e);
      const uid = s.drag || e.dataTransfer.getData('text/plain');
      if (!t || !uid) return;
      e.preventDefault();
      t.classList.remove('drop-hover');
      await handleDrop(uid, t);
      render();
    });

    async function handleDrop(uid, t) {
      const loc = duel.find(uid);
      if (!loc) return;
      const c = loc.card;
      const k = duel.kind(c);
      const drop = t.getAttribute('data-drop');
      const index = Number(t.getAttribute('data-index'));
      const bad = (msg) => { App.sound.play('invalid'); U.toast(msg); };
      // Attacks: my monster onto an opponent's monster or their LP.
      if ((loc.zone === 'mz' || loc.zone === 'emz') && (drop === 'opp-lp' || t.classList.contains('theirs'))) {
        if (duel.phase !== 'battle' || duel.active !== 0) return bad('Attacks happen in your Battle Phase.');
        return attackFlow(c, drop === 'opp-lp' ? null : t.getAttribute('data-uid'));
      }
      if (t.classList.contains('card-slot')) return; // dropped on another of my cards: nothing to do
      if (drop === 'gy' || drop === 'banished' || drop === 'deck' || drop === 'hand') {
        if (loc.zone === drop) return;
        return duel.sendTo(uid, drop === 'deck' ? 'deck' : drop);
      }
      if (drop === 'mz' || drop === 'emz') {
        if (k !== 'monster') return bad('Only monsters go in Monster Zones.');
        const zone = drop === 'mz' ? { mz: index } : { emz: index };
        if (loc.zone === 'hand' && !duel.isExtra(c)) {
          const opts = [];
          if (duel.active === 0 && duel.isMain() && !duel.players[0].normalSummoned) {
            opts.push({ label: (duel.tributesNeeded(c) ? 'Tribute Summon' : 'Normal Summon'), value: 'atk', primary: true }, { label: 'Set face-down', value: 'set' });
          }
          opts.push({ label: 'Special Summon (by an effect)', value: 'special' }, { label: 'Cancel', value: null });
          const how = await ask(c.name, '', opts);
          if (!how) return;
          if (how === 'special') return specialTo(c, zone);
          return summonFlow(c, how, zone);
        }
        if (loc.zone === 'mz' || loc.zone === 'emz') return;
        return specialTo(c, zone);
      }
      if (drop === 'st' || drop === 'field') {
        if (loc.zone !== 'hand') return bad('Play Spells and Traps from your hand.');
        if (k !== 'spell' && k !== 'trap') return bad('Only Spells and Traps go there.');
        const isField = k === 'spell' && /Field/.test(c.data.race || '');
        if ((drop === 'field') !== isField) return bad(isField ? 'Field Spells go in the Field Zone.' : 'That goes in a Spell & Trap Zone.');
        const opts = [];
        if (k === 'spell' || /activate this card from your hand/i.test(c.data.desc || '')) opts.push({ label: 'Activate', value: 'activate', primary: true });
        if (duel.active === 0 && duel.isMain()) opts.push({ label: 'Set face-down', value: 'set', primary: !opts.length });
        opts.push({ label: 'Cancel', value: null });
        const how = await ask(c.name, '', opts);
        if (how === 'activate') return activateFlow(uid, null, drop === 'st' ? index : null);
        if (how === 'set') { const r = duel.setSpellTrap(0, uid, drop === 'st' ? index : null); if (!r.ok) bad(r.message); }
      }
    }

    async function specialTo(c, zone) {
      if (duel.isExtra(c) && duel.find(c.uid).zone === 'extra') return extraSummonFlow(c, { zone: zone });
      const pos = await ask('Position', '', [{ label: 'Attack', value: 'atk', primary: true }, { label: 'Defense', value: 'def' }]);
      if (!pos) return;
      const r = duel.specialSummon(0, c.uid, pos, { how: 'effect', zone: zone });
      if (!r.ok) { U.toast(r.message); return; }
      await opponentRespondsToSummon(c);
      await summonTriggers(c, 'special');
    }

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

    /* The text of one effect, for dialogs. */
    function effectHtml(card, e) {
      if (!e) return descHtml(card);
      return '<div class="effect-text">' + esc(e.text).replace(/\n/g, '<br>') + '</div>' +
        (e.notes && e.notes.length ? '<p class="muted small">' + esc(e.notes.join(' ')) + '</p>' : '') +
        '<details class="small"><summary>Full card text</summary>' + descHtml(card) + '</details>';
    }

    /* Choose one of an effect's options ("Activate 1 of these effects"). */
    async function pickMode(card, pf) {
      if (!pf || !pf.modes) return pf;
      const i = await ask(card.name + ': choose 1 effect', '<p class="muted small">This effect lets you choose one of these.</p>',
        pf.modes.map((m, k) => ({ label: m.modeText + (m.understood ? '' : ' (by hand)'), value: String(k), primary: k === 0 && m.understood })).concat([{ label: 'Cancel', value: null }]));
      return i == null ? null : pf.modes[Number(i)];
    }

    /* Pays an effect's costs, asking you which cards to use. False if cancelled or not payable. */
    async function payCosts(card, costs) {
      if (!costs || !costs.length) return true;
      const problem = App.Effects.costProblem(duel, 0, card, costs);
      if (problem) { App.sound.play('invalid'); U.toast('Can\'t pay the cost: ' + problem); return false; }
      const picks = [];
      for (let i = 0; i < costs.length; i++) {
        const c = costs[i];
        if (c.type !== 'choose') { picks.push(null); continue; }
        const pool = App.Effects.costPool(duel, 0, card, c);
        const got = pool.length === c.count && c.from !== 'hand' ? pool.map((x) => x.uid)
          : await choose('Cost: ' + c.label, pool, { count: c.count, min: c.count, confirm: c.label, note: 'Choose the card' + (c.count > 1 ? 's' : '') + ' to pay the cost with.' });
        if (!got) return false;
        picks.push(got);
      }
      App.Effects.payCost(duel, 0, card, costs, picks);
      duel.say('You pay the cost: ' + costs.map((c) => c.label.toLowerCase()).join(', ') + '.', 0);
      return true;
    }

    async function resolveEffect(card, pf, isST, ctx) {
      if (pf && pf.modes) { pf = await pickMode(card, pf); if (!pf) { if (isST) duel.finishActivation(card.uid); return; } }
      const steps = (pf && pf.steps) || [];
      const isFusion = steps.some((x) => x.fusion);
      const chooseSteps = steps.filter((x) => x.choose);
      const autoOk = pf && pf.understood && !isFusion && chooseSteps.every((x) => x.choose.pool.length);
      const buttons = [];
      if (isFusion) buttons.push({ label: 'Fusion Summon: choose the monster and its materials', value: 'fusion', primary: true });
      else if (autoOk) buttons.push({ label: 'Auto-resolve: ' + pf.summary, value: 'auto', primary: true });
      if (ctx && ctx.attack) buttons.push({ label: 'It negates the attack', value: 'negate' });
      buttons.push({ label: autoOk || isFusion ? 'Resolve manually' : 'Resolve it with the card menus', value: 'manual', primary: !autoOk && !isFusion });
      const empty = pf && pf.understood && chooseSteps.some((x) => !x.choose.pool.length);
      const info = !pf ? '<p class="muted small">The app can\'t resolve this effect by itself: do it with the card menus.</p>'
        : (empty ? '<p class="warn small">There is nothing to choose for this effect right now.</p>' : '') +
          (pf.understood && pf.manual ? '<p class="small"><strong>Auto-resolve does:</strong> ' + esc(pf.summary) + '.<br><strong>You do by hand:</strong> ' + esc(pf.manual) + '</p>' : '') +
          (!pf.understood ? '<p class="muted small">The app can\'t resolve this effect by itself: do it with the card menus, then press Done.</p>' : '');
      const choice = await ask('Resolve ' + card.name, effectHtml(card, pf && pf.effect) + info, buttons);
      if (choice === 'fusion') {
        await fusionFlow(pf.fromDeck);
        if (isST) duel.finishActivation(card.uid);
      } else if (choice === 'auto') {
        const chosen = [];
        for (const st of chooseSteps) {
          const ch = st.choose;
          const cards = ch.pool.map((u) => duel.find(u)).filter(Boolean).map((x) => x.card);
          const pick = await choose(ch.label, cards, { count: ch.count, min: Math.min(ch.min || 1, cards.length), confirm: 'Confirm', sub: (c) => { const l = duel.find(c.uid); return l.player === 0 ? 'yours · ' + l.zone : 'opponent · ' + l.zone; } });
          chosen.push(pick || []);
        }
        App.Effects.run(duel, 0, pf, chosen);
        if (pf.discard) {
          const disc = await choose('Discard ' + pf.discard, duel.players[0].hand.slice(), { count: pf.discard, min: Math.min(pf.discard, duel.players[0].hand.length), confirm: 'Discard' });
          (disc || duel.players[0].hand.slice(0, pf.discard).map((c) => c.uid)).forEach((u) => duel.sendTo(u, 'gy', 'discarded'));
        }
        if (pf.manual) { s.resolving = { uid: card.uid, name: card.name, isST: isST, todo: pf.manual }; render(); return; }
        if (isST) duel.finishActivation(card.uid);
      } else if (choice === 'negate') {
        duel.negateAttack();
        if (isST) duel.finishActivation(card.uid);
      } else {
        s.resolving = { uid: card.uid, name: card.name, isST: isST, todo: pf && pf.effect ? pf.effect.action : '' };
        render();
      }
    }

    /* Activate a Spell/Trap: its activation effect only, after checking timing, condition and cost. */
    async function activateFlow(uid, ctx, zoneIndex) {
      const pre = duel.find(uid);
      if (!pre) return;
      const card = pre.card;
      const problem = App.Effects.activationProblem(duel, 0, card, ctx);
      if (problem) {
        App.sound.play('invalid');
        const go = await ask('Can\'t activate ' + card.name + ' now', '<p>' + esc(problem) + '</p>', [{ label: 'OK', value: false, primary: true }, { label: 'Activate anyway (another card allows it)', value: true }]);
        if (!go) return;
      }
      let pf = App.Effects.plan(duel, 0, card, ctx);
      if (pf && pf.modes) { pf = await pickMode(card, pf); if (!pf) return; }
      const costs = (pf && pf.cost) || [];
      if (!problem && App.Effects.costProblem(duel, 0, card, costs)) { App.sound.play('invalid'); U.toast('Can\'t pay the cost: ' + App.Effects.costProblem(duel, 0, card, costs)); return; }
      const r = duel.activateSpellTrap(0, uid, zoneIndex);
      if (!r.ok) { App.sound.play('invalid'); U.toast(r.message); return; }
      if (!(await payCosts(r.card, costs))) { duel.finishActivation(r.card.uid); return; }
      if (pf) App.Effects.markUsed(duel, 0, r.card, pf.effect);
      if (await negatedByOpponent(r.card, pf, false)) { duel.finishActivation(r.card.uid); return; }
      await resolveEffect(r.card, pf, true, ctx);
    }

    /* Which effect of this card? Only the ones usable now, unless forced (manual). */
    async function pickEffect(c, opts) {
      const o = opts || {};
      const list = App.Effects.options(duel, 0, c, o);
      const usable = o.force ? list : list.filter((x) => x.ok);
      if (!usable.length) {
        App.sound.play('invalid');
        const go = await ask(c.name, (list.length
          ? '<p>None of its effects can be used right now:</p><ul class="effect-list">' + list.map((x) => '<li>' + esc(x.effect.text) + '<br><span class="why small">' + esc(x.why) + '</span></li>').join('') + '</ul>'
          : '<p>This card has no effect you activate (its effects are continuous, or it has none).</p>'),
        [{ label: 'OK', value: false, primary: true }].concat(list.length ? [{ label: 'Use one anyway (another card allows it)', value: true }] : []));
        return go ? pickEffect(c, Object.assign({}, o, { force: true })) : null;
      }
      if (usable.length === 1) return usable[0].effect;
      const i = await dialog('<h2 id="modal-title">' + esc(c.name) + ': which effect?</h2><div class="effect-pick">' +
        usable.map((x, k) => '<button type="button" class="effect-choice" data-k="' + k + '"' + (x.ok ? '' : ' data-off') + '><span>' + esc(x.effect.text) + '</span>' + (x.ok ? '' : '<span class="why small">' + esc(x.why) + '</span>') + '</button>').join('') +
        '</div><div class="row"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button></div>',
        (body, done) => body.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-k]');
          if (b) done(Number(b.getAttribute('data-k')));
          if (ev.target.closest('[data-cancel]')) done(null);
        }));
      return i == null ? null : usable[i].effect;
    }

    /* Uses one effect of a monster (or a face-up Spell/Trap): cost, chain, resolution. */
    async function useEffect(c, e, o) {
      const opts = o || {};
      if (App.Effects.used(duel, 0, c, e) && !opts.force) {
        const go = await ask('Once per turn', '<p>You already used this effect of ' + esc(c.name) + ' this turn.</p>', [{ label: 'Cancel', value: false, primary: true }, { label: 'Use it anyway (another card allows it)', value: true }]);
        if (!go) return;
      }
      let pf = App.Effects.planFor(duel, 0, c, e);
      if (pf.modes) { pf = await pickMode(c, pf); if (!pf) return; }
      const loc = duel.find(c.uid);
      const onField = loc && (loc.zone === 'mz' || loc.zone === 'emz');
      if (!(await payCosts(c, pf.cost))) return;
      App.Effects.markUsed(duel, 0, c, e);
      duel.say('You activate ' + c.name + '\'s effect' + (loc && loc.zone === 'gy' ? ' in the GY' : loc && loc.zone === 'hand' ? ' from your hand' : '') + '.', 0);
      duel.fx('activate', { uid: c.uid, player: 0, kind: duel.kind(c) });
      if (await negatedByOpponent(c, pf, onField)) return;
      await resolveEffect(c, pf, false);
    }

    /* A monster effect you activate (from hand, field or GY), or a face-up Spell/Trap's effect. */
    async function monsterEffectFlow(c, opts) {
      const e = await pickEffect(c, opts);
      if (e) await useEffect(c, e, opts);
    }

    /* "If this card is … Summoned": offer its effect right after the summon. */
    async function summonTriggers(c, how) {
      const loc = duel.find(c.uid);
      if (!loc || (loc.zone !== 'mz' && loc.zone !== 'emz') || !c.faceUp) return;
      const list = App.Effects.options(duel, 0, c, { event: how }).filter((x) => x.effect.type === 'trigger' && x.effect.event && x.effect.event.indexOf(how) !== -1);
      for (const x of list) {
        if (!x.ok) { duel.say(c.name + '\'s effect can\'t be used: ' + x.why, 0); continue; }
        const optional = /you can/i.test(x.effect.pre + ' ' + x.effect.action);
        const go = await ask(c.name + ' was ' + (how === 'normal' ? 'Normal' : 'Special') + ' Summoned', effectHtml(c, x.effect),
          [{ label: 'Use its effect', value: true, primary: true }].concat(optional ? [{ label: 'Not now', value: false }] : []));
        if (go) await useEffect(c, x.effect, { force: true });
      }
    }

    /* "You can Special Summon this card (from your hand) by …" */
    async function procedureFlow(c, proc) {
      if (!(await payCosts(c, proc.costs))) return;
      App.Effects.markUsed(duel, 0, c, proc.effect);
      const pos = proc.defense ? 'def' : await ask('Position', '', [{ label: 'Attack', value: 'atk', primary: true }, { label: 'Defense', value: 'def' }]);
      if (!pos) return;
      const r = duel.specialSummon(0, c.uid, pos, { how: 'its own rule' });
      if (!r.ok) { U.toast(r.message); return; }
      await opponentRespondsToSummon(c);
      await summonTriggers(c, 'special');
    }

    /* Gives the opponent a chance to chain to your activation. True if they negated it. */
    async function negatedByOpponent(card, pf, onField) {
      const ev = { type: 'activate', player: 0, card: card, kind: duel.kind(card), plan: pf, onField: !!onField };
      s.busy = true;
      let resp = {};
      try {
        resp = (await App.Bot.respondToActivation(duel, 1, ev)) || {};
      } finally { s.busy = false; }
      if (resp.negated) {
        duel.say(card.name + '\'s effect is negated by ' + resp.by + '.');
        App.sound.play('invalid');
        render();
        await ask(duel.pname(1) + ' responds!', '<p><strong>' + esc(resp.by) + '</strong> negates ' + esc(card.name) + '.</p>', [{ label: 'OK', value: true, primary: true }]);
        return true;
      }
      return false;
    }

    async function opponentRespondsToSummon(c) {
      s.busy = true;
      try {
        const r = (await App.Bot.respondToSummon(duel, 1, { type: 'summon', player: 0, uid: c.uid })) || {};
        if (r.by) { render(); await ask(duel.pname(1) + ' responds!', '<p>' + esc(duel.pname(1)) + ' activates <strong>' + esc(r.by) + '</strong> against ' + esc(c.name) + '.</p>', [{ label: 'OK', value: true, primary: true }]); }
      } finally { s.busy = false; }
    }

    /* The opponent activated something or summoned: can you respond? */
    async function yourResponse(ev) {
      const mode = U.store.get('dv-respond', 'auto');
      if (mode === 'never' || duel.winner != null) return {};
      const options = duel.spellsTraps(0).map((x) => x.card).filter((c) => !c.faceUp && c.setTurn != null && c.setTurn < duel.turn &&
        (duel.kind(c) === 'trap' || /Quick-Play/.test(c.data.race || '')))
        .concat(duel.players[0].hand.filter((c) => (duel.kind(c) === 'trap' && /activate this card from your hand/i.test(c.data.desc || '')) ||
          (duel.kind(c) === 'monster' && /quick effect/i.test(c.data.desc || '') && /(discard this card|send this card from your hand|banish this card from your hand)/i.test(c.data.desc || ''))))
        .concat(duel.monsters(0).map((m) => m.card).filter((c) => c.faceUp && /quick effect/i.test(c.data.desc || '')));
      if (!options.length && mode !== 'always') return {};
      render();
      const what = ev.type === 'summon'
        ? duel.pname(ev.player) + ' summoned ' + ev.card.name
        : duel.pname(ev.player) + ' activates ' + ev.card.name;
      const pick = await choose(what + ' — respond?', options, {
        note: options.length ? 'Chain a card, or let it resolve. (Change when you are asked in the side panel.)' : 'You have nothing to respond with.',
        extra: [{ label: 'No response', value: [] }],
        sub: (c) => { const z = duel.find(c.uid).zone; return z === 'hand' ? 'from hand' : z === 'mz' || z === 'emz' ? 'on field' : 'Set'; }
      });
      if (!pick || !pick.length) return {};
      const loc = duel.find(pick[0]);
      const c = loc.card;
      const ctx = ev.type === 'summon' ? { summon: ev.uid } : { activation: ev };
      let pf = App.Effects.plan(duel, 0, c, ctx);
      if (duel.kind(c) === 'monster') {
        if (pf && pf.cost && pf.cost.length) { if (!(await payCosts(c, pf.cost))) return {}; }
        else if (loc.zone === 'hand') duel.sendTo(c.uid, 'gy', 'activated from the hand');
        duel.say('You activate ' + c.name + '.', 0);
        duel.fx('activate', { uid: c.uid, player: 0, kind: 'monster' });
      } else {
        const r = duel.activateSpellTrap(0, c.uid);
        if (!r.ok) { U.toast(r.message); return {}; }
        if (pf && pf.cost && pf.cost.length && !(await payCosts(c, pf.cost))) { duel.finishActivation(c.uid); return {}; }
      }
      if (pf) App.Effects.markUsed(duel, 0, c, pf.effect);
      const negates = pf && pf.negateActivation;
      const choice = await ask('Resolve ' + c.name, effectHtml(c, pf && pf.effect), [].concat(
        pf && (pf.ops.length || pf.negateActivation) ? [{ label: 'Auto-resolve: ' + pf.summary, value: 'auto', primary: true }] : [],
        ev.type === 'activate' ? [{ label: 'It negates ' + ev.card.name, value: 'negate' }] : [],
        [{ label: 'Resolve manually', value: 'manual' }]));
      if (choice === 'auto') App.Effects.run(duel, 0, pf);
      if (duel.kind(c) !== 'monster') duel.finishActivation(c.uid);
      if (choice === 'manual') { s.resolving = { uid: c.uid, name: c.name, isST: false }; render(); }
      return { negated: choice === 'negate' || (choice === 'auto' && negates), by: c.name };
    }

    /* FLIP effects of monsters that were just flipped face-up. */
    async function processFlips() {
      while (duel.pendingFlips.length) {
        const uid = duel.pendingFlips.shift();
        const loc = duel.find(uid);
        if (!loc || (loc.zone !== 'mz' && loc.zone !== 'emz')) continue;
        const owner = loc.card.controller != null ? loc.card.controller : loc.card.owner;
        if (owner === 0) {
          const pf = App.Effects.plan(duel, 0, loc.card, { flip: true, summoned: true });
          duel.say(loc.card.name + '\'s FLIP effect activates.', 0);
          if (pf && pf.cost && pf.cost.length && !(await payCosts(loc.card, pf.cost))) continue;
          await resolveEffect(loc.card, pf, false);
        } else {
          duel.pendingFlips.unshift(uid);
          await App.Bot.resolveFlips(duel);
        }
      }
    }

    async function summonFlow(c, pos, zone) {
      const need = duel.tributesNeeded(c);
      let tributes = [];
      if (need) {
        const mons = duel.monsters(0).map((m) => m.card);
        if (mons.length < need) { App.sound.play('invalid'); U.toast(c.name + ' needs ' + need + ' Tribute' + (need > 1 ? 's' : '') + '.'); return; }
        tributes = await choose('Choose ' + need + ' monster' + (need > 1 ? 's' : '') + ' to Tribute', mons, { count: need, min: need, confirm: 'Tribute' });
        if (!tributes) return;
      }
      const r = duel.normalSummon(0, c.uid, pos, tributes, zone);
      if (!r.ok) { App.sound.play('invalid'); U.toast(r.message); return; }
      if (pos !== 'set') await opponentRespondsToSummon(c);
      if (!duel.find(c.uid) || duel.find(c.uid).zone !== 'mz') return;
      if (pos !== 'set') await summonTriggers(c, 'normal');
    }

    function matSub(x) {
      const z = duel.find(x.uid).zone;
      const where = z === 'mz' || z === 'emz' ? 'field' : z;
      const t = x.data.type || '';
      const lv = /link/i.test(t) ? 'Link-' + (x.data.linkval || '?') : (/xyz/i.test(t) ? 'Rank ' : 'Lv ') + (x.data.level || '?');
      return where + ' · ' + lv + (/tuner/i.test(t) ? ' · Tuner' : '');
    }

    /* Fusion spell: you pick which Fusion Monster, then its materials. */
    async function fusionFlow(fromDeck) {
      const extras = duel.players[0].extra.filter((x) => /fusion/i.test(x.data.type || ''));
      if (!extras.length) { App.sound.play('invalid'); U.toast('You have no Fusion Monsters in your Extra Deck.'); return; }
      const sources = duel.players[0].hand.filter((x) => duel.kind(x) === 'monster')
        .concat(duel.monsters(0).map((m) => m.card))
        .concat(fromDeck ? duel.players[0].deck.filter((x) => duel.kind(x) === 'monster') : []);
      const makeable = new Set(App.Effects.fusionOptions(duel, 0, sources).map((o) => o.fusion.uid));
      const pick = await choose('Which Fusion Monster?', extras, { sub: (x) => (makeable.has(x.uid) ? '✓ ' : '') + App.Materials.requirement(x) });
      if (!pick) return;
      await extraSummonFlow(duel.find(pick[0]).card, { pool: sources });
    }

    /* Fusion / Synchro / Xyz / Link: you choose the materials; the rules check them. */
    async function extraSummonFlow(c, opts) {
      const o = opts || {};
      const kind = App.Materials.summonKind(c);
      const req = App.Materials.requirement(c);
      const isFusion = /fusion/i.test(c.data.type || '');
      const pool = o.pool || duel.monsters(0).map((m) => m.card).concat(isFusion ? duel.players[0].hand.filter((x) => duel.kind(x) === 'monster') : []);
      if (!pool.length) { App.sound.play('invalid'); U.toast('You have no monsters to use as materials.'); return; }
      let mats;
      for (;;) {
        mats = await choose(kind + ': ' + c.name, pool, { count: 12, min: 1, confirm: kind, note: 'Requirement: ' + req + '. Pick the materials you want to use.', sub: matSub });
        if (!mats) return;
        const chk = App.Materials.check(c, mats.map((u) => duel.find(u).card));
        if (chk.ok && !chk.unchecked) break;
        App.sound.play(chk.ok ? 'click' : 'invalid');
        const choice = await ask(chk.ok ? 'Check your materials' : 'Those materials don\'t fit',
          '<p>' + esc(chk.message || 'This requirement can\'t be checked automatically.') + '</p><p class="muted small">Requirement: ' + esc(req) + '</p>',
          chk.ok
            ? [{ label: kind + ' with these', value: 'go', primary: true }, { label: 'Choose again', value: 'again' }]
            : [{ label: 'Choose again', value: 'again', primary: true }, { label: 'Summon anyway (a card effect allows it)', value: 'go' }, { label: 'Cancel', value: null }]);
        if (choice === 'go') break;
        if (choice !== 'again') return;
      }
      const pos = /link/i.test(c.data.type || '') ? 'atk' : await ask('Position', '', [{ label: 'Attack Position', value: 'atk', primary: true }, { label: 'Defense Position', value: 'def' }]);
      if (!pos) return;
      const r = duel.specialSummon(0, c.uid, pos, { materials: mats, how: kind, zone: o.zone });
      if (!r.ok) { App.sound.play('invalid'); U.toast(r.message); return; }
      await opponentRespondsToSummon(c);
      await summonTriggers(c, 'special');
    }

    async function attackFlow(c, presetTarget) {
      const chk = duel.canAttack(0, c.uid);
      if (!chk.ok) { App.sound.play('invalid'); U.toast(chk.message); return; }
      const targets = duel.monsters(1).map((m) => m.card);
      let target = presetTarget === undefined ? null : presetTarget;
      if (presetTarget === undefined && targets.length) {
        const pick = await choose('Attack which monster?', targets, { sub: (t) => t.faceUp ? (t.pos === 'atk' ? duel.atk(t) + ' ATK' : duel.def(t) + ' DEF') : 'face-down' });
        if (!pick) return;
        target = pick[0];
      }
      const r = duel.declareAttack(0, c.uid, target);
      if (!r.ok) { App.sound.play('invalid'); U.toast(r.message); return; }
      s.busy = true;
      try {
        await ui.pause(450);
        if (s.oppType === 'claude') await App.ClaudeOpponent.respondToAttack(duel, 1, ui);
        else App.Bot.respondToAttack(duel, 1);
      } finally { s.busy = false; }
      if (duel.pendingAttack) duel.resolveAttack();
      await processFlips();
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
      /* primary: the main button. why: greyed out, with the reason shown. manual: a free move under "More moves". */
      const add = (label, fn, primary, why) => acts.push({ label: label, fn: fn, primary: primary && !why, why: why || '' });
      const manual = (label, fn) => acts.push({ label: label, fn: fn, manual: true });
      const myTurn = duel.active === 0 && !s.busy;
      const desc = c.data.desc || '';
      const moveSet = (exclude) => {
        if (exclude.indexOf('hand') === -1) manual('Add to hand', () => duel.sendTo(c.uid, 'hand'));
        if (exclude.indexOf('gy') === -1) manual(loc.zone === 'hand' ? 'Discard / send to GY' : 'Send to GY', () => duel.sendTo(c.uid, 'gy'));
        if (exclude.indexOf('banished') === -1) manual('Banish', () => duel.sendTo(c.uid, 'banished'));
        if (exclude.indexOf('deck') === -1) manual(duel.isExtra(c) ? 'Return to Extra Deck' : 'Shuffle into Deck', () => duel.sendTo(c.uid, 'deck'));
        if (exclude.indexOf('deck') === -1 && !duel.isExtra(c)) manual('Put on top of Deck', () => duel.sendTo(c.uid, 'deckTop'));
      };
      const specialManual = (label) => manual(label, async () => { const pos = await ask('Position', '', [{ label: 'Attack', value: 'atk', primary: true }, { label: 'Defense', value: 'def' }]); if (pos) { const r = duel.specialSummon(0, c.uid, pos, { how: 'effect' }); if (!r.ok) U.toast(r.message); } });
      if (loc.zone === 'hand') {
        if (k === 'monster') {
          const need = duel.tributesNeeded(c);
          const proc = App.Effects.procedure(duel, 0, c);
          const fromHand = App.Effects.options(duel, 0, c).filter((x) => x.effect.locs.indexOf('hand') !== -1);
          const have = duel.monsters(0).length;
          const why = duel.active !== 0 ? 'Only on your turn.' : !duel.isMain() ? 'Only in your Main Phase.' : duel.players[0].normalSummoned ? 'You already Normal Summoned or Set a monster this turn.' :
            need > have ? 'Needs ' + need + ' Tribute' + (need > 1 ? 's' : '') + ': you control ' + (have || 'no') + ' monster' + (have === 1 ? '' : 's') + '.' : '';
          add(need ? 'Tribute Summon' : 'Normal Summon', () => summonFlow(c, 'atk'), true, why);
          add('Set (face-down)', () => summonFlow(c, 'set'), false, why);
          if (proc) add('Special Summon (by its own rule)', () => procedureFlow(c, proc), true, proc.ok ? '' : proc.why);
          if (fromHand.length) add('Activate effect from hand', () => monsterEffectFlow(c), false, fromHand.some((x) => x.ok) ? '' : fromHand[0].why);
          manual('Activate an effect anyway', () => monsterEffectFlow(c, { force: true }));
          specialManual('Special Summon (by an effect)');
        } else if (k === 'spell') {
          const quick = /Quick-Play/.test(c.data.race || '');
          add('Activate', () => activateFlow(c.uid), true, duel.active !== 0 && !quick ? 'Only on your turn.' : !main && !quick ? 'Only in your Main Phase.' : App.Effects.activationProblem(duel, 0, c));
          add('Set', () => { const r = duel.setSpellTrap(0, c.uid); if (!r.ok) U.toast(r.message); }, false, main ? '' : 'Only in your Main Phase.');
        } else {
          add('Set', () => { const r = duel.setSpellTrap(0, c.uid); if (!r.ok) U.toast(r.message); }, true, main ? '' : 'Only in your Main Phase.');
          if (/activate this card from your hand/i.test(desc)) add('Activate', () => activateFlow(c.uid), false, App.Effects.activationProblem(duel, 0, c));
          else manual('Activate from hand', () => activateFlow(c.uid));
        }
        moveSet(['hand']);
      } else if (loc.zone === 'mz' || loc.zone === 'emz') {
        if (myTurn && duel.phase === 'battle') add('Attack', () => attackFlow(c), true, !c.faceUp || c.pos !== 'atk' ? 'Only face-up Attack Position monsters can attack.' : c.attacked ? 'This monster already attacked this turn.' : '');
        if (main) add(c.faceUp ? 'Change battle position' : 'Flip Summon', async () => { const wasDown = !c.faceUp; const r = duel.changePosition(0, c.uid); if (!r.ok) { U.toast(r.message); return; } if (wasDown) { await opponentRespondsToSummon(c); await processFlips(); } });
        const onField = App.Effects.options(duel, 0, c).filter((x) => x.effect.locs.indexOf('field') !== -1);
        if (onField.length) add('Activate effect', () => monsterEffectFlow(c), false, onField.some((x) => x.ok) ? '' : onField[0].why);
        manual('Activate an effect anyway', () => monsterEffectFlow(c, { force: true }));
        manual('Change ATK', () => modifyAtk(c));
        manual('Destroy', () => duel.destroy(c.uid, 'you'));
        manual('Turn face-down', () => duel.applyOp(0, { op: 'flip_face_down', card: c.uid }));
        moveSet(['gy']);
      } else if (loc.zone === 'st' || loc.zone === 'field') {
        if (!c.faceUp) {
          const tooSoon = duel.kind(c) === 'trap' && c.setTurn != null && c.setTurn >= duel.turn;
          add('Activate', () => activateFlow(c.uid), true, tooSoon ? 'A Trap can\'t be activated the turn it was Set.' : App.Effects.activationProblem(duel, 0, c));
        } else {
          const stOpts = App.Effects.options(duel, 0, c).filter((x) => x.effect.locs.indexOf('field') !== -1);
          if (stOpts.length) add('Activate effect', () => monsterEffectFlow(c), true, stOpts.some((x) => x.ok) ? '' : stOpts[0].why);
          manual('Activate an effect anyway', () => monsterEffectFlow(c, { force: true }));
        }
        manual('Destroy', () => duel.destroy(c.uid, 'you'));
        moveSet(['gy']);
      } else if (loc.zone === 'extra') {
        add('Summon from the Extra Deck', () => extraSummonFlow(c), true, main ? '' : 'Only in your Main Phase.');
        manual('Send to GY', () => duel.sendTo(c.uid, 'gy'));
        manual('Banish', () => duel.sendTo(c.uid, 'banished'));
      } else {
        // gy, banished, deck
        const here = App.Effects.options(duel, 0, c).filter((x) => x.effect.locs.indexOf(loc.zone) !== -1);
        if (here.length && (loc.zone === 'gy' || loc.zone === 'banished')) add('Activate its effect' + (loc.zone === 'gy' ? ' in the GY' : ''), () => monsterEffectFlow(c), true, here.some((x) => x.ok) ? '' : here[0].why);
        if (k === 'monster' && !duel.isExtra(c)) specialManual('Special Summon');
        if (k === 'monster' && duel.isExtra(c) && loc.zone !== 'deck') manual('Special Summon', () => duel.specialSummon(0, c.uid, 'atk', { how: 'effect' }));
        if (k !== 'monster' && loc.zone !== 'deck') manual('Set it on the field', () => { duel.sendTo(c.uid, 'hand', false); const r = duel.setSpellTrap(0, c.uid); if (!r.ok) U.toast(r.message); });
        moveSet([loc.zone === 'banished' ? 'banished' : loc.zone === 'deck' ? 'deck' : 'gy']);
        if (loc.zone === 'deck') acts.forEach((a) => { const fn = a.fn; a.fn = async () => { await fn(); duel.applyOp(0, { op: 'shuffle_deck' }); }; });
      }
      return acts;
    }

    function menuButtons(acts) {
      const btn = (a) => '<button type="button" class="btn' + (a.primary ? ' btn-primary' : '') + '" data-a="' + acts.indexOf(a) + '"' + (a.why ? ' disabled title="' + esc(a.why) + '"' : '') + '>' + esc(a.label) + '</button>';
      const rules = acts.filter((a) => !a.manual);
      const free = acts.filter((a) => a.manual);
      const reasons = rules.filter((a) => a.why).reduce((m, a) => (m.indexOf(a.why) === -1 ? m.concat(a.why) : m), []);
      return (rules.length ? '<div class="menu-actions">' + rules.map(btn).join('') + '</div>' : '<p class="muted small">Nothing to do with this card by the rules right now.</p>') +
        (reasons.length ? '<p class="why small">' + reasons.map(esc).join(' ') + '</p>' : '') +
        (free.length ? '<details class="manual-moves"' + (rules.some((a) => !a.why) ? '' : ' open') + '><summary>More moves <span class="muted small">(manual: for card effects the app doesn\'t handle)</span></summary><div class="menu-actions">' + free.map(btn).join('') + '</div></details>' : '');
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
        menuButtons(acts),
        (body, done) => body.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) done(Number(b.getAttribute('data-a'))); }));
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

    root.addEventListener('input', (e) => { if (e.target.id === 'sound-vol') App.sound.setVolume(e.target.value); });
    // Remember which side boxes are open: the board re-renders after every play.
    root.addEventListener('toggle', (e) => { const k = e.target.getAttribute && e.target.getAttribute('data-keep'); if (k) s.open[k] = e.target.open; }, true);

    function showHelp() { C.openModal('<div class="help-modal"><h2 id="modal-title">How to play</h2>' + App.help.duelHtml() + '</div>'); }

    /* Keyboard shortcuts: B = Battle Phase, M = Main Phase 2, E = End Turn, ? = How to play. */
    const onKey = (e) => {
      if (!document.body.contains(root)) { document.removeEventListener('keydown', onKey); return; }
      if (!document.getElementById('modal').hidden || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') { showHelp(); return; }
      if (duel.active !== 0 || duel.winner != null || s.busy || s.resolving) return;
      const key = e.key.toLowerCase();
      if (key === 'b' && duel.phase === 'main1' && duel.canEnterBattle()) duel.nextPhase();
      else if (key === 'm' && duel.phase === 'battle') duel.nextPhase();
      else if (key === 'e') endTurn();
    };
    document.addEventListener('keydown', onKey);
    root.addEventListener('change', (e) => {
      if (e.target.id === 'set-respond') U.store.set('dv-respond', e.target.value);
      if (e.target.id === 'set-speed') { U.store.set('dv-duel-speed', e.target.value); speed = SPEEDS[e.target.value]; }
    });
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
        if (what === 'sound') App.sound.toggle();
        if (what === 'help') { showHelp(); return; }
        if (what === 'surrender') {
          const sure = await ask('Surrender?', '<p>You will lose this duel.</p>', [{ label: 'Keep playing', value: false, primary: true }, { label: 'Surrender', value: true }]);
          if (sure) duel.surrender(0);
        }
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
