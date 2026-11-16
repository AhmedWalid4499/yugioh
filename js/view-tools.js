/* Auto-Build page (archetype → ready deck) and the Draw Tester. */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const C = App.C;
  const D = App.decks;
  const F = App.formats;
  const esc = U.esc;

  /* ---------- Auto-Build ---------- */

  function buildPage(view, params) {
    const last = U.store.get('dv-autobuild', { a: '', format: U.store.get('dv-default-format', 'tcg'), staples: true });
    const a = params.get('a') || last.a;
    view.innerHTML = '<section class="page">' +
      '<div class="page-head"><h1>Auto-Build a Deck</h1><p class="muted">Type an archetype and get a ready-to-play deck. Then test your opening hands or duel with it.</p></div>' +
      '<form class="panel autobuild" id="ab-form" autocomplete="off">' +
        '<div class="search-row">' +
          '<input class="search-input" name="a" list="ab-archetypes" placeholder="Archetype, e.g. Lunalight, Snake-Eye, Blue-Eyes…" value="' + esc(a) + '" aria-label="Archetype" required>' +
          '<button class="btn btn-primary" type="submit">⚡ Build deck</button>' +
        '</div>' +
        '<div class="filter-row">' +
          '<label>Format <select name="format">' + F.options(last.format) + '</select></label>' +
          '<label class="check"><input type="checkbox" name="staples"' + (last.staples ? ' checked' : '') + '> Add generic staples (hand traps, board breakers)</label>' +
        '</div>' +
        '<datalist id="ab-archetypes"></datalist>' +
      '</form>' +
      '<div class="panel"><h3>Or build a famous duelist\'s deck</h3><p class="muted small">Their archetypes and signature cards, built with the newest support in the database.</p>' + App.characters.tiles() + '</div>' +
      '<div id="ab-result"></div>' +
    '</section>';
    App.characters.paintArt(view);
    App.characters.wirePortraits(view, () => App.router());

    api.getArchetypes().then((list) => {
      U.$('#ab-archetypes', view).innerHTML = list.map((x) => '<option value="' + esc(x) + '">').join('');
    }).catch(() => {});

    const form = U.$('#ab-form', view);
    const out = U.$('#ab-result', view);
    let result = null;

    let character = null;
    async function run() {
      const opts = { format: form.format.value, staples: form.staples.checked };
      const input = form.a.value.trim();
      if (!input) return;
      const ch = character && character.name === input ? character : null;
      if (ch) Object.assign(opts, { archetypes: ch.archetypes, signature: ch.signature, name: ch.short + '\'s Deck' });
      U.store.set('dv-autobuild', { a: input, format: opts.format, staples: opts.staples });
      out.innerHTML = C.loading('Building ' + (ch ? ch.short + '\'s' : 'a ' + input) + ' deck…');
      try {
        result = await App.deckgen.build(ch ? ch.archetypes[0] : input, opts);
        render();
      } catch (e) {
        out.innerHTML = C.error(e);
      }
    }

    function pickTile(p) {
      return '<div class="pick">' + C.cardTile(p.card, p.reason) + '<span class="pick-qty">×' + p.copies + '</span>' +
        (p.generic ? '<span class="pick-tag">Staple</span>' : '') + '</div>';
    }

    function render() {
      const fmt = F.get(result.format);
      const main = result.picks.filter((p) => p.zone === 'main');
      const extra = result.picks.filter((p) => p.zone === 'extra');
      const kinds = { monster: 0, spell: 0, trap: 0 };
      main.forEach((p) => { const k = api.kind(p.card); if (kinds[k] != null) kinds[k] += p.copies; });
      out.innerHTML =
        '<div class="panel">' +
          '<div class="row-between"><div><h2>' + esc(result.name) + '</h2>' +
          '<p class="muted">' + esc(fmt.label) + ' · Main ' + result.main.length + ' (' + kinds.monster + ' monsters, ' + kinds.spell + ' spells, ' + kinds.trap + ' traps) · Extra ' + result.extra.length + '</p></div>' +
          '<div class="row"><button type="button" class="btn btn-primary" data-save="edit">Save to My Decks</button>' +
          '<button type="button" class="btn" data-save="test">Save & test hands</button>' +
          '<button type="button" class="btn" data-save="duel">Save & duel</button>' +
          '<button type="button" class="btn btn-ghost" id="ab-again">↻ Rebuild</button></div></div>' +
          '<h4>Game plan</h4><ul class="tips">' +
            (result.starters.length ? '<li><strong>Open with:</strong> ' + result.starters.slice(0, 6).map(esc).join(', ') + '. These start your combos, so the builder runs as many copies as allowed.</li>' : '<li>No clear starters were detected; this archetype may rely on its Field Spell or on generic cards.</li>') +
            (result.bosses.length ? '<li><strong>Aim for:</strong> ' + result.bosses.slice(0, 4).map(esc).join(', ') + '.</li>' : '') +
            '<li>Open the <a href="#/archetype/' + encodeURIComponent(result.archetype) + '">' + esc(result.archetype) + '</a> page to see every card and swap picks in the deck builder.</li>' +
          '</ul>' +
          (result.notes.length ? '<ul class="problems">' + result.notes.map((n) => '<li>⚠ ' + esc(n) + '</li>').join('') + '</ul>' : '') +
          '<p class="muted small">Built by rules from card text and a list of well-known staples — a strong starting point, not a tournament-tested list.</p>' +
        '</div>' +
        '<h2 class="section-title">Main Deck <span class="muted">(' + result.main.length + ')</span></h2><div class="grid">' + main.map(pickTile).join('') + '</div>' +
        (extra.length ? '<h2 class="section-title">Extra Deck <span class="muted">(' + result.extra.length + ')</span></h2><div class="grid">' + extra.map(pickTile).join('') + '</div>' : '');

      U.$('#ab-again', out).addEventListener('click', run);
      U.$$('[data-save]', out).forEach((b) => b.addEventListener('click', () => {
        const deck = D.create(result.name, { main: result.main.slice(), extra: result.extra.slice(), side: [] }, result.format);
        deck.notes = 'Auto-built from the "' + result.archetype + '" archetype for ' + fmt.label + '.\n' +
          (result.starters.length ? 'Starters: ' + result.starters.join(', ') + '\n' : '') + result.notes.join('\n');
        D.save(deck);
        const where = b.getAttribute('data-save');
        U.toast('Saved "' + deck.name + '".');
        location.hash = where === 'test' ? '#/test/' + deck.id : where === 'duel' ? '#/duel?deck=' + deck.id : '#/deck/' + deck.id;
      }));
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    view.addEventListener('click', (e) => {
      const t = e.target.closest('[data-char]');
      if (!t) return;
      character = App.characters.get(t.getAttribute('data-char'));
      U.$$('.char-tile', view).forEach((x) => x.classList.toggle('selected', x === t));
      form.a.value = character.name;
      run();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (params.get('char') && App.characters.get(params.get('char'))) {
      const t = view.querySelector('.char-tile[data-char="' + params.get('char') + '"]');
      if (t) t.click();
    } else if (params.get('a')) run();
  }

  /* ---------- Draw Tester ---------- */

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function testPage(view, id) {
    const deck = D.get(id);
    if (!deck) { view.innerHTML = '<section class="page">' + C.empty('Deck not found.') + '</section>'; return; }
    const fmt = F.get(deck.format);
    if (!deck.main.length) {
      view.innerHTML = '<section class="page"><a class="back" href="#/deck/' + esc(id) + '">← Back to deck</a>' + C.empty('This deck has no Main Deck cards yet.') + '</section>';
      return;
    }

    const unique = Array.from(new Set(deck.main.map(Number)));
    // Which cards count as "starters" — auto-detected, then editable.
    let starterIds = deck.testStarters || unique.filter((cid) => {
      const c = D.cached(cid);
      if (!c) return false;
      const r = App.insights.analyse(c).roleKeys;
      return r.indexOf('starter') !== -1 || r.indexOf('searcher') !== -1;
    });
    let goingSecond = false;
    let pile = [];
    let hand = [];

    view.innerHTML = '<section class="page">' +
      '<div class="page-head row-between"><div><a class="back" href="#/deck/' + esc(id) + '">← ' + esc(deck.name) + '</a><h1>Draw Tester</h1>' +
      '<p class="muted">' + esc(fmt.label) + ' · ' + deck.main.length + '-card Main Deck · ' + fmt.hand + '-card opening hand</p></div>' +
      '<div class="row"><a class="btn btn-primary" href="#/duel?deck=' + esc(id) + '">⚔ Duel with this deck</a></div></div>' +
      '<div class="panel">' +
        '<div class="row">' +
          '<button type="button" class="btn btn-primary" id="dt-new">🔀 New hand</button>' +
          '<button type="button" class="btn" id="dt-draw">Draw 1</button>' +
          '<label class="check"><input type="checkbox" id="dt-second"> Going second (draw 1 extra)</label>' +
          '<span class="muted small" id="dt-left"></span>' +
        '</div>' +
        '<div class="hand" id="dt-hand"></div>' +
        '<p class="small" id="dt-verdict"></p>' +
      '</div>' +
      '<div class="panel"><h3>Opening odds <span class="muted small">(10,000 simulated hands)</span></h3><div id="dt-stats"></div></div>' +
      '<div class="panel"><h3>Which cards count as starters?</h3><p class="muted small">Tick the cards that let you begin your combo on their own. The odds above update instantly.</p><div class="starter-picks" id="dt-starters"></div></div>' +
    '</section>';

    function newHand() {
      pile = shuffle(deck.main.map(Number));
      const n = fmt.hand + (goingSecond ? 1 : 0);
      hand = pile.splice(0, n);
      renderHand();
    }
    function drawOne() {
      if (!pile.length) { U.toast('Your deck is empty.'); return; }
      hand.push(pile.shift());
      renderHand();
    }
    function renderHand() {
      U.$('#dt-hand', view).innerHTML = hand.map((cid) => {
        const c = D.cached(cid) || { id: cid, name: '#' + cid };
        const isStarter = starterIds.indexOf(Number(cid)) !== -1;
        return '<button type="button" class="hand-card' + (isStarter ? ' is-starter' : '') + '" data-card-id="' + cid + '" title="' + esc(c.name) + '">' +
          '<img src="' + esc(api.image(c, 'small')) + '" alt="' + esc(c.name) + '"><span>' + esc(c.name) + '</span></button>';
      }).join('');
      U.$('#dt-left', view).textContent = pile.length + ' cards left in deck';
      const s = hand.filter((cid) => starterIds.indexOf(Number(cid)) !== -1).length;
      const ht = hand.filter((cid) => { const c = D.cached(cid); return c && App.insights.analyse(c).roleKeys.indexOf('handtrap') !== -1; }).length;
      U.$('#dt-verdict', view).innerHTML = s
        ? '✅ <strong>Playable hand</strong>: ' + U.plural(s, 'starter') + (ht ? ' and ' + U.plural(ht, 'hand trap') : '') + '.'
        : '⚠ <strong>Brick</strong>: no starter in this hand' + (ht ? ' (but ' + U.plural(ht, 'hand trap') + ' to interact with)' : '') + '.';
    }

    function simulate() {
      const N = 10000;
      const deckIds = deck.main.map(Number);
      const set = new Set(starterIds.map(Number));
      const htSet = new Set(unique.filter((cid) => { const c = D.cached(cid); return c && App.insights.analyse(c).roleKeys.indexOf('handtrap') !== -1; }));
      const res = { first: [0, 0, 0], second: [0, 0, 0] };
      const run = (size, out) => {
        for (let i = 0; i < N; i++) {
          // Partial Fisher–Yates: only shuffle the cards we draw.
          const a = deckIds.slice();
          let st = 0;
          let ht = 0;
          for (let k = 0; k < size && k < a.length; k++) {
            const j = k + Math.floor(Math.random() * (a.length - k));
            const t = a[k]; a[k] = a[j]; a[j] = t;
            if (set.has(a[k])) st++;
            if (htSet.has(a[k])) ht++;
          }
          if (st >= 1) out[0]++;
          if (st >= 2) out[1]++;
          if (ht >= 1) out[2]++;
        }
      };
      run(fmt.hand, res.first);
      run(fmt.hand + 1, res.second);
      const pct = (n) => Math.round((n / N) * 1000) / 10 + '%';
      const starterCopies = deckIds.filter((x) => set.has(x)).length;
      U.$('#dt-stats', view).innerHTML =
        '<table class="table"><thead><tr><th></th><th>Going 1st (' + fmt.hand + ')</th><th>Going 2nd (' + (fmt.hand + 1) + ')</th></tr></thead><tbody>' +
        '<tr><td>At least 1 starter</td><td><strong>' + pct(res.first[0]) + '</strong></td><td><strong>' + pct(res.second[0]) + '</strong></td></tr>' +
        '<tr><td>2 or more starters</td><td>' + pct(res.first[1]) + '</td><td>' + pct(res.second[1]) + '</td></tr>' +
        '<tr><td>Brick (no starter)</td><td>' + pct(N - res.first[0]) + '</td><td>' + pct(N - res.second[0]) + '</td></tr>' +
        (htSet.size ? '<tr><td>At least 1 hand trap</td><td>' + pct(res.first[2]) + '</td><td>' + pct(res.second[2]) + '</td></tr>' : '') +
        '</tbody></table>' +
        '<p class="muted small">' + U.plural(starterCopies, 'starter copy', 'starter copies') + ' in ' + deckIds.length + ' cards. ' +
        (res.first[0] / N < 0.8 ? 'Under 80% — consider more starters or a smaller deck.' : 'Over 80% — a consistent deck.') + '</p>';
    }

    function renderStarters() {
      U.$('#dt-starters', view).innerHTML = unique.map((cid) => {
        const c = D.cached(cid) || { name: '#' + cid };
        const n = deck.main.filter((x) => Number(x) === cid).length;
        return '<label class="check starter-pick"><input type="checkbox" value="' + cid + '"' + (starterIds.indexOf(cid) !== -1 ? ' checked' : '') + '> ' + esc(c.name) + ' <span class="muted">×' + n + '</span></label>';
      }).join('');
    }

    U.$('#dt-new', view).addEventListener('click', newHand);
    U.$('#dt-draw', view).addEventListener('click', drawOne);
    U.$('#dt-second', view).addEventListener('change', (e) => { goingSecond = e.target.checked; newHand(); });
    U.$('#dt-starters', view).addEventListener('change', () => {
      starterIds = U.$$('#dt-starters input:checked', view).map((i) => Number(i.value));
      const d = D.get(id);
      d.testStarters = starterIds;
      D.save(d);
      simulate();
      renderHand();
    });

    renderStarters();
    newHand();
    simulate();
  }

  App.views = App.views || {};
  App.views.build = buildPage;
  App.views.test = testPage;
})(window.App);
