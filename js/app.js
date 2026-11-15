/* Hash router, tiny event bus and global wiring. */
(function (App) {
  'use strict';

  const U = App.U;
  const C = App.C;

  /* Events: listeners added with onRoute() are dropped on every navigation,
     so views never leak handlers. */
  let routeListeners = [];
  App.onRoute = function (name, fn) { routeListeners.push({ name: name, fn: fn }); };
  App.emit = function (name, payload) {
    routeListeners.filter((l) => l.name === name).forEach((l) => l.fn(payload));
  };

  const ROUTES = [
    [/^\/search$/, (v, m, p) => App.views.search(v, p), 'search'],
    [/^\/archetype\/(.+)$/, (v, m) => App.views.archetype(v, decodeURIComponent(m[1])), 'search'],
    [/^\/releases$/, (v) => App.views.releases(v), 'releases'],
    [/^\/set\/(.+)$/, (v, m) => App.views.set(v, decodeURIComponent(m[1])), 'releases'],
    [/^\/decks$/, (v) => App.views.decks(v), 'decks'],
    [/^\/deck\/([\w-]+)$/, (v, m, p) => App.views.deck(v, m[1], p), 'decks'],
    [/^\/card\/(\d+)$/, (v, m, p) => { App.views.search(v, p); C.openCard(m[1]); }, 'search'],
    [/^\/build$/, (v, m, p) => App.views.build(v, p), 'build'],
    [/^\/test\/([\w-]+)$/, (v, m) => App.views.test(v, m[1]), 'decks'],
    [/^\/duel$/, (v, m, p) => App.views.duelSetup(v, p), 'duel'],
    [/^\/duel\/play$/, (v) => App.views.duelPlay(v), 'duel']
  ];

  App.router = function () {
    const raw = location.hash.replace(/^#/, '') || '/search';
    const qIndex = raw.indexOf('?');
    const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
    const params = new URLSearchParams(qIndex === -1 ? '' : raw.slice(qIndex + 1));

    routeListeners = [];
    const host = document.getElementById('view');
    // A fresh container per page means old event listeners are discarded with it.
    const page = document.createElement('div');
    host.replaceChildren(page);

    let route = ROUTES.find((r) => r[0].test(path));
    if (!route) { location.replace('#/search'); return; }
    const m = path.match(route[0]);
    U.$$('[data-nav]').forEach((a) => a.classList.toggle('active', a.getAttribute('data-nav') === route[2]));
    route[1](page, m, params);
    window.scrollTo(0, 0);
  };

  /* Any element with data-card-id opens that card's details. */
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]');
    if (close) { C.closeModal(); return; }
    const el = e.target.closest('[data-card-id]');
    if (el && !e.target.closest('[data-quick-add]')) {
      e.preventDefault();
      C.openCard(el.getAttribute('data-card-id'));
    }
  });

  // Card pictures that fail to load (e.g. offline) fall back to a coloured placeholder.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.parentElement) img.parentElement.classList.add('img-failed');
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('modal').hidden) C.closeModal();
  });

  window.addEventListener('hashchange', () => {
    if (!document.getElementById('modal').hidden) C.closeModal();
    App.router();
  });

  App.router();
})(window.App);
