/* Main menu: a game-style menu with a preview of the highlighted choice. */
(function (App) {
  'use strict';

  const U = App.U;
  const D = App.decks;
  const esc = U.esc;

  /* Today's featured rival changes every day. */
  function featured() {
    const list = App.characters.list();
    const day = Math.floor(Date.now() / 86400000);
    return list[day % list.length];
  }

  function recordLine(r) { return r.w + r.l ? r.w + 'W – ' + r.l + 'L' + (r.w ? ' · ★ Beaten' : '') : 'Not faced yet'; }

  function page(view) {
    const decks = D.all().slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const live = App.duelSession && App.duelSession();
    const liveDuel = live && live.duel && live.duel.winner == null ? live : null;
    const prof = App.profile.get();
    const rival = featured();
    const chars = App.characters.list();
    const beaten = chars.filter((c) => App.profile.vs(c.id).w > 0).length;
    const next = App.profile.nextRank();

    const items = [];
    if (liveDuel) items.push({ id: 'continue', icon: '▶', label: 'Continue Duel', href: '#/duel/play', sub: 'Turn ' + liveDuel.duel.turn + ' vs ' + liveDuel.duel.pname(1) });
    items.push(
      { id: 'duel', icon: '⚔', label: 'Free Duel', href: '#/duel', sub: chars.length + ' rivals · ' + beaten + ' beaten' },
      { id: 'decks', icon: '🂠', label: 'Deck Editor', href: '#/decks', sub: decks.length ? decks.length + (decks.length === 1 ? ' deck' : ' decks') : 'No decks yet' },
      { id: 'build', icon: '⚡', label: 'Auto-Build', href: '#/build', sub: 'A full deck in one click' },
      { id: 'search', icon: '🔍', label: 'Card Database', href: '#/search', sub: 'Every card, with tips' },
      { id: 'releases', icon: '✦', label: 'New Releases', href: '#/releases', sub: 'What\'s out and coming' },
      { id: 'help', icon: '?', label: 'Help & Guide', href: '#/help', sub: 'How everything works' }
    );

    const previews = {
      continue: () => '<div class="pv-art char-art"' + (live.character ? ' data-ace="' + esc(App.characters.get(live.character).ace) + '"' : '') + '></div>' +
        '<div class="pv-body"><h2>Continue your duel</h2><p>Turn ' + liveDuel.duel.turn + ' against <strong>' + esc(liveDuel.duel.pname(1)) + '</strong>. You have ' + liveDuel.duel.players[0].lp + ' LP, they have ' + liveDuel.duel.players[1].lp + '.</p>' +
        '<a class="btn btn-primary btn-big" href="#/duel/play">▶ Back to the duel</a></div>',
      duel: () => {
        const r = App.profile.vs(rival.id);
        return '<div class="pv-art char-art" data-ace="' + esc(rival.ace) + '" style="--ring:' + rival.color + '"></div>' +
          '<div class="pv-body"><div class="pv-kicker">Today\'s rival</div><h2>' + esc(rival.name) + '</h2><p class="muted">' + esc(rival.series) + ' · ' + esc(rival.style) + '</p>' +
          '<p class="pv-record">' + esc(recordLine(r)) + '</p>' +
          '<div class="row"><a class="btn btn-primary btn-big" href="#/duel?vs=' + rival.id + '">⚔ Duel ' + esc(rival.short) + '</a><a class="btn" href="#/duel">Choose a rival</a></div></div>';
      },
      decks: () => '<div class="pv-body"><h2>Deck Editor</h2>' + (decks.length
        ? '<p class="muted">Build, edit and test your decks.</p><ul class="pv-decks">' + decks.slice(0, 4).map((d) => '<li><a href="#/deck/' + esc(d.id) + '">' + esc(d.name) + '</a><span class="muted small">' + d.main.length + ' cards · ' + esc(App.formats.get(d.format).short) + '</span><a class="btn btn-small" href="#/test/' + esc(d.id) + '">Test</a><a class="btn btn-small btn-primary" href="#/duel?deck=' + esc(d.id) + '">Duel</a></li>').join('') + '</ul><a class="btn" href="#/decks">All decks →</a>'
        : '<p class="muted">You don\'t have any decks yet. Let the app build one for you, or start from scratch.</p><div class="row"><a class="btn btn-primary btn-big" href="#/build">⚡ Auto-build a deck</a><a class="btn" href="#/decks">Deck Editor</a></div>') + '</div>',
      build: () => '<div class="pv-body"><h2>Auto-Build</h2><p class="muted">Type an archetype and get a ready-to-play deck, with every pick explained. Or build any famous duelist\'s deck.</p>' +
        '<form class="pv-form" data-go="build"><input name="q" type="search" placeholder="e.g. Lunalight, Snake-Eye, Blue-Eyes" aria-label="Archetype"><button class="btn btn-primary" type="submit">⚡ Build</button></form></div>',
      search: () => '<div class="pv-body"><h2>Card Database</h2><p class="muted">Read any card\'s effect, see which deck it belongs to and how to use it.</p>' +
        '<form class="pv-form" data-go="search"><input name="q" type="search" placeholder="e.g. Dark Magician, Ash Blossom" aria-label="Card name"><button class="btn btn-primary" type="submit">🔍 Search</button></form></div>',
      releases: () => '<div class="pv-body"><h2>New Releases</h2><p class="muted">Upcoming and recent products and newly released cards. Star a set to add it to your watchlist.</p><a class="btn btn-primary btn-big" href="#/releases">✦ See releases</a></div>',
      help: () => '<div class="pv-body"><h2>Help &amp; Guide</h2><p class="muted">How each screen works, how to duel, and what words like <em>Tribute</em>, <em>Chain</em> and <em>Hand trap</em> mean.</p><a class="btn btn-primary btn-big" href="#/help">? Open the guide</a></div>'
    };

    view.innerHTML = '<section class="main-menu">' +
      '<div class="mm-left">' +
        '<div class="player-card">' + App.characters.avatar('you', 'big') +
          '<div class="pc-info"><button type="button" class="pc-name" id="pc-name" title="Change your duelist name">' + esc(prof.name || 'Duelist') + ' ✎</button>' +
          '<div class="pc-rank">' + esc(App.profile.rank()) + '</div>' +
          '<div class="pc-rec"><span class="w">' + prof.wins + ' W</span><span class="l">' + prof.losses + ' L</span>' + (next ? '<span class="muted small">' + next.wins + ' more ' + (next.wins === 1 ? 'win' : 'wins') + ' to ' + esc(next.title) + '</span>' : '') + '</div></div>' +
        '</div>' +
        '<nav class="mm-list" aria-label="Main menu">' + items.map((it, i) =>
          '<a class="mm-item' + (i === 0 ? ' on' : '') + '" href="' + it.href + '" data-item="' + it.id + '"><span class="mm-icon" aria-hidden="true">' + it.icon + '</span><span class="mm-text"><strong>' + esc(it.label) + '</strong><small>' + esc(it.sub) + '</small></span></a>').join('') +
        '</nav>' +
      '</div>' +
      '<div class="mm-preview" id="mm-preview" aria-live="polite"></div>' +
      '<div class="mm-hints"><span><kbd>↑</kbd><kbd>↓</kbd> Choose</span><span><kbd>Enter</kbd> Confirm</span><span><kbd>Esc</kbd> Back to menu (anywhere)</span></div>' +
      '</section>';

    const box = U.$('#mm-preview', view);
    let current = null;
    function show(id, sound) {
      if (id === current) return;
      current = id;
      U.$$('.mm-item', view).forEach((a) => a.classList.toggle('on', a.getAttribute('data-item') === id));
      box.innerHTML = '<div class="pv pv-' + id + '">' + previews[id]() + '</div>';
      App.characters.paintArt(box);
      if (sound) App.sound.play('menu-move');
    }
    show(items[0].id);

    view.addEventListener('mouseover', (e) => { const a = e.target.closest('.mm-item'); if (a) show(a.getAttribute('data-item'), true); });
    view.addEventListener('focusin', (e) => { const a = e.target.closest('.mm-item'); if (a) show(a.getAttribute('data-item'), true); });
    view.addEventListener('click', (e) => {
      if (e.target.closest('.mm-item, .pv a')) App.sound.play('menu-ok');
      if (e.target.closest('#pc-name')) {
        const n = prompt('Your duelist name:', prof.name || '');
        if (n != null) { App.profile.setName(n); App.router(); }
      }
    });
    view.addEventListener('submit', (e) => {
      const f = e.target.closest('.pv-form');
      if (!f) return;
      e.preventDefault();
      const q = f.q.value.trim();
      App.sound.play('menu-ok');
      if (f.getAttribute('data-go') === 'build') location.hash = '#/build' + (q ? '?a=' + encodeURIComponent(q) : '');
      else location.hash = '#/search' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    // Arrow keys move through the menu like a game.
    const onKey = (e) => {
      if (!document.body.contains(view)) { document.removeEventListener('keydown', onKey); return; }
      if (document.body.classList.contains('title-open') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !document.getElementById('modal').hidden) return;
      const k = e.key;
      if (['ArrowDown', 'ArrowUp', 's', 'w'].indexOf(k) === -1) return;
      e.preventDefault();
      const ids = items.map((it) => it.id);
      const i = ids.indexOf(current);
      const n = ids[(i + (k === 'ArrowDown' || k === 's' ? 1 : -1) + ids.length) % ids.length];
      U.$('.mm-item[data-item="' + n + '"]', view).focus();
    };
    document.addEventListener('keydown', onKey);
  }

  App.views = App.views || {};
  App.views.home = page;
})(window.App);
