/* Home: a welcome page that points to everything the app can do. */
(function (App) {
  'use strict';

  const U = App.U;
  const D = App.decks;
  const esc = U.esc;

  const TILES = [
    { href: '#/search', icon: '🔍', title: 'Look up a card', text: 'Read any card\'s effect, see which deck it belongs to and how to use it.' },
    { href: '#/build', icon: '⚡', title: 'Build a deck in one click', text: 'Type an archetype like "Lunalight", or pick a famous duelist\'s deck.' },
    { href: '#/duel', icon: '⚔', title: 'Duel', text: 'Practise against Yugi, Kaiba, Jaden and more. You don\'t need a deck of your own.' },
    { href: '#/releases', icon: '🆕', title: 'New releases', text: 'See what\'s coming out and what just came out. Star the sets you want to follow.' }
  ];

  const QUICK_FOES = ['yugi', 'kaiba', 'jaden', 'yusei', 'yuma'];

  function page(view) {
    const decks = D.all().slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const live = App.duelSession && App.duelSession();
    const liveDuel = live && live.duel && live.duel.winner == null ? live : null;
    const newHere = !decks.length && !U.store.get('dv-home-seen', false);

    view.innerHTML = '<section class="page home-page">' +
      '<div class="hero"><h1>Welcome to Duel Vault</h1>' +
        '<p>Your Yu-Gi-Oh! companion: look up cards, build decks, follow new releases and practise duels.</p>' +
        '<form class="hero-search" role="search"><input type="search" name="q" placeholder="Look up a card… e.g. Dark Magician, Ash Blossom" aria-label="Card name"><button class="btn btn-primary" type="submit">Search</button></form>' +
      '</div>' +
      (liveDuel ? '<a class="panel continue-duel" href="#/duel/play">⚔ <strong>Your duel is still going</strong> (turn ' + liveDuel.duel.turn + ' against ' + esc(liveDuel.duel.pname(1)) + '). <span class="btn btn-small btn-primary">Back to the duel</span></a>' : '') +
      '<div class="home-tiles">' + TILES.map((t) => '<a class="home-tile" href="' + t.href + '"><span class="ht-icon" aria-hidden="true">' + t.icon + '</span><strong>' + esc(t.title) + '</strong><span class="muted small">' + esc(t.text) + '</span></a>').join('') + '</div>' +
      (newHere ? '<div class="panel first-steps"><div class="row-between"><h2>New here? Start in 3 steps</h2><button type="button" class="btn btn-small btn-ghost" data-dismiss-steps>Hide</button></div><ol class="big-steps">' +
        '<li><strong>Make a deck:</strong> <a href="#/build">⚡ Auto-Build</a> one from an archetype or a famous duelist, then save it.</li>' +
        '<li><strong>Test it:</strong> deal some opening hands in the Draw Tester.</li>' +
        '<li><strong>Duel:</strong> pick an opponent on the <a href="#/duel">⚔ Duel</a> page and press Start.</li>' +
      '</ol><p class="muted small">Stuck at any point? Open <a href="#/help">❓ Help</a> for a guide and a list of Yu-Gi-Oh! words.</p></div>' : '') +
      '<div class="home-cols">' +
        '<div class="panel"><div class="row-between"><h2>Your decks</h2>' + (decks.length ? '<a href="#/decks" class="small">All decks →</a>' : '') + '</div>' +
          (decks.length
            ? '<ul class="home-decks">' + decks.slice(0, 4).map((d) => '<li><a class="hd-name" href="#/deck/' + esc(d.id) + '">' + esc(d.name) + '</a><span class="muted small">' + esc(App.formats.get(d.format).short) + ' · ' + d.main.length + ' cards</span>' +
                '<span class="hd-acts"><a class="btn btn-small" href="#/deck/' + esc(d.id) + '">Edit</a><a class="btn btn-small" href="#/test/' + esc(d.id) + '">🎴 Test</a><a class="btn btn-small btn-primary" href="#/duel?deck=' + esc(d.id) + '">⚔ Duel</a></span></li>').join('') + '</ul>'
            : '<p class="muted">You don\'t have any decks yet.</p><p><a class="btn btn-primary" href="#/build">⚡ Auto-build your first deck</a></p>') +
        '</div>' +
        '<div class="panel"><h2>Quick duel</h2><p class="muted small">Click a duelist to challenge them' + (decks.length ? '.' : ', using a borrowed deck.') + '</p>' +
          '<div class="quick-foes">' + QUICK_FOES.map((id) => App.characters.get(id)).filter(Boolean).map((c) =>
            '<a class="quick-foe" href="#/duel?vs=' + c.id + '" title="Duel ' + esc(c.name) + '">' + App.characters.avatar(c.id, 'big') + '<span>' + esc(c.short) + '</span></a>').join('') +
          '</div><p class="small"><a href="#/duel">See all ' + App.characters.list().length + ' duelists →</a></p></div>' +
      '</div>' +
      '</section>';

    App.characters.paintArt(view);
    U.$('.hero-search', view).addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      location.hash = '#/search' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    const hide = U.$('[data-dismiss-steps]', view);
    if (hide) hide.addEventListener('click', () => { U.store.set('dv-home-seen', true); U.$('.first-steps', view).remove(); });
  }

  App.views = App.views || {};
  App.views.home = page;
})(window.App);
