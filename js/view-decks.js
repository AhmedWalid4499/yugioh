/* My Decks list and the Deck Builder. */
(function (App) {
  'use strict';

  const U = App.U;
  const api = App.api;
  const C = App.C;
  const D = App.decks;
  const esc = U.esc;

  const KIND_ORDER = { monster: 0, spell: 1, trap: 2, skill: 3, token: 4 };

  function group(ids) {
    const map = new Map();
    ids.forEach((id) => {
      const key = Number(id);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([id, n]) => ({ id: id, n: n, card: D.cached(id) }))
      .sort((a, b) => {
        const ka = a.card ? KIND_ORDER[api.kind(a.card)] : 9;
        const kb = b.card ? KIND_ORDER[api.kind(b.card)] : 9;
        if (ka !== kb) return ka - kb;
        return (a.card ? a.card.name : '').localeCompare(b.card ? b.card.name : '');
      });
  }

  function kindCounts(ids) {
    const out = { monster: 0, spell: 0, trap: 0 };
    ids.forEach((id) => {
      const c = D.cached(id);
      if (c) { const k = api.kind(c); if (out[k] != null) out[k]++; }
    });
    return out;
  }

  function coverImage(deck) {
    const id = deck.extra[0] || deck.main[0];
    const c = id && D.cached(id);
    return c ? (api.image(c, 'cropped') || api.image(c, 'small')) : '';
  }

  /* ---------- Deck list ---------- */

  function decksPage(view) {
    const decks = D.all();
    view.innerHTML = '<section class="page">' +
      '<div class="page-head row-between"><div><h1>My Decks</h1><p class="muted">Decks are saved in this browser. Export them as .ydk files to back them up or use them in simulators.</p></div>' +
        '<div class="row"><button type="button" class="btn btn-primary" id="new-deck">+ New deck</button><button type="button" class="btn" id="import-toggle">Import deck</button></div></div>' +
      '<div class="panel" id="import-panel" hidden>' +
        '<h3>Import a deck</h3>' +
        '<p class="muted small">Choose an <strong>Excel sheet (.xlsx)</strong> or <strong>.csv</strong> with card names and quantities, or a <strong>.ydk</strong> file (from YGOPRODeck, EDOPro, Dueling Book…). You can also paste .ydk text below.</p>' +
        '<div class="row"><input type="text" id="import-name" placeholder="Deck name (optional)" aria-label="Deck name"><input type="file" id="import-file" accept=".xlsx,.csv,.ydk,.txt" aria-label="Deck file"></div>' +
        '<p class="muted small">Excel tip: use columns headed <em>Qty</em>, <em>Card Name</em> and <em>Section</em> (Main / Extra / Side). <button type="button" class="btn btn-small" id="excel-template">Download Excel template</button></p>' +
        '<textarea id="import-text" rows="6" placeholder="#main&#10;14558127&#10;…&#10;#extra&#10;…&#10;!side&#10;…" aria-label="YDK text"></textarea>' +
        '<div class="row"><button type="button" class="btn btn-primary" id="import-go">Import</button><span id="import-status" class="muted"></span></div>' +
      '</div>' +
      (decks.length
        ? '<div class="deck-list">' + decks.map((d) => {
          const problems = D.validate(d);
          const cover = coverImage(d);
          return '<div class="deck-card">' +
            '<a class="deck-cover" href="#/deck/' + esc(d.id) + '">' + (cover ? '<img loading="lazy" src="' + esc(cover) + '" alt="">' : '<span>◆</span>') + '</a>' +
            '<div class="deck-card-body">' +
              '<a class="deck-title" href="#/deck/' + esc(d.id) + '">' + esc(d.name) + '</a>' +
              '<div class="muted small">Main ' + d.main.length + ' · Extra ' + d.extra.length + ' · Side ' + d.side.length + '</div>' +
              '<div class="small ' + (problems.length ? 'warn' : 'ok') + '">' + (problems.length ? '⚠ ' + U.plural(problems.length, 'issue') : '✓ Tournament legal') + '</div>' +
              '<div class="muted small">Edited ' + esc(new Date(d.updated).toLocaleDateString()) + '</div>' +
              '<div class="row">' +
                '<a class="btn btn-small btn-primary" href="#/deck/' + esc(d.id) + '">Edit</a>' +
                '<button type="button" class="btn btn-small" data-dup="' + esc(d.id) + '">Duplicate</button>' +
                '<button type="button" class="btn btn-small" data-export="' + esc(d.id) + '">.ydk</button>' +
                '<button type="button" class="btn btn-small" data-excel="' + esc(d.id) + '">Excel</button>' +
                '<button type="button" class="btn btn-small btn-danger" data-del="' + esc(d.id) + '">Delete</button>' +
              '</div>' +
            '</div></div>';
        }).join('') + '</div>'
        : '<div class="panel empty-hero"><h2>No decks yet</h2><p>Create a deck, import a .ydk file, or open any card and press “Start a deck with this card”.</p></div>') +
    '</section>';

    U.$('#new-deck', view).addEventListener('click', () => {
      const name = prompt('Name your deck', 'New Deck');
      if (name === null) return;
      const deck = D.create(name.trim() || 'New Deck');
      location.hash = '#/deck/' + deck.id;
    });
    U.$('#import-toggle', view).addEventListener('click', () => {
      const p = U.$('#import-panel', view);
      p.hidden = !p.hidden;
    });
    let sheetFile = null;
    U.$('#excel-template', view).addEventListener('click', () => {
      App.excel.downloadTemplate().catch((err) => U.toast(err.message));
    });
    U.$('#import-file', view).addEventListener('change', (e) => {
      const file = e.target.files[0];
      sheetFile = null;
      U.$('#import-text', view).hidden = false;
      if (!file) return;
      if (/\.(xlsx|csv)$/i.test(file.name)) {
        sheetFile = file;
        U.$('#import-text', view).hidden = true;
        U.$('#import-status', view).textContent = 'Ready to import ' + file.name + '.';
        return;
      }
      if (/\.xls$/i.test(file.name)) {
        U.$('#import-status', view).textContent = 'Old .xls files are not supported. In Excel choose File → Save As → Excel Workbook (.xlsx).';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        U.$('#import-text', view).value = reader.result;
        const nameBox = U.$('#import-name', view);
        if (!nameBox.value) nameBox.value = file.name.replace(/\.(ydk|txt)$/i, '');
      };
      reader.readAsText(file);
    });
    U.$('#import-go', view).addEventListener('click', async () => {
      const status = U.$('#import-status', view);
      const btn = U.$('#import-go', view);
      btn.disabled = true;
      status.textContent = 'Importing… looking up cards';
      try {
        if (sheetFile) {
          const r = await App.excel.importFile(sheetFile, U.$('#import-name', view).value.trim());
          U.toast('Imported ' + U.plural(r.added, 'card') + (r.notFound.length ? ' · ' + r.notFound.length + ' not found (listed in Notes)' : '') + '.');
          location.hash = '#/deck/' + r.deck.id;
          return;
        }
        const res = await D.importYdk(U.$('#import-name', view).value.trim() || 'Imported Deck', U.$('#import-text', view).value);
        if (res.unknown.length) U.toast(U.plural(res.unknown.length, 'card id') + ' could not be found and were skipped.');
        location.hash = '#/deck/' + res.deck.id;
      } catch (e) {
        status.textContent = e.message;
        btn.disabled = false;
      }
    });

    view.addEventListener('click', (e) => {
      const dup = e.target.closest('[data-dup]');
      if (dup) { D.duplicate(dup.getAttribute('data-dup')); App.router(); return; }
      const del = e.target.closest('[data-del]');
      if (del) {
        const d = D.get(del.getAttribute('data-del'));
        if (d && confirm('Delete "' + d.name + '"? This cannot be undone.')) { D.remove(d.id); App.router(); }
        return;
      }
      const ex = e.target.closest('[data-export]');
      if (ex) exportDeck(D.get(ex.getAttribute('data-export')));
      const xl = e.target.closest('[data-excel]');
      if (xl) exportExcel(D.get(xl.getAttribute('data-excel')), xl);
    });
  }

  function exportDeck(deck) {
    if (!deck) return;
    U.download(deck.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '.ydk', D.toYdk(deck));
  }

  async function exportExcel(deck, btn) {
    if (!deck) return;
    const label = btn ? btn.textContent : '';
    if (btn) btn.disabled = true;
    try {
      const res = await App.excel.exportDeck(deck, (done, total) => {
        if (btn) btn.textContent = 'Pictures ' + done + '/' + total;
      });
      U.toast(res.missingPics
        ? 'Excel file saved. ' + res.missingPics + ' picture(s) could not be downloaded and use an online image link instead.'
        : 'Excel file saved with card pictures.');
    } catch (e) {
      U.toast('Excel export failed: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  function textList(deck) {
    const part = (title, ids) => {
      if (!ids.length) return '';
      return title + ' (' + ids.length + ')\n' + group(ids).map((g) => g.n + 'x ' + (g.card ? g.card.name : '#' + g.id)).join('\n') + '\n\n';
    };
    return (deck.name + '\n\n' + part('Main Deck', deck.main) + part('Extra Deck', deck.extra) + part('Side Deck', deck.side)).trim() + '\n';
  }

  /* ---------- Deck builder ---------- */

  function zoneHtml(deck, zone) {
    const ids = deck[zone];
    const groups = group(ids);
    const k = kindCounts(ids);
    const breakdown = zone === 'extra' ? '' : ' <span class="muted small">' + k.monster + ' monsters · ' + k.spell + ' spells · ' + k.trap + ' traps</span>';
    const range = zone === 'main' ? '40–60' : '0–15';
    const bad = zone === 'main' ? (ids.length < 40 || ids.length > 60) : ids.length > 15;
    return '<section class="zone zone-' + zone + '">' +
      '<h3>' + D.zoneName(zone) + ' <span class="count' + (bad ? ' warn' : '') + '">' + ids.length + '</span><span class="muted small"> / ' + range + '</span>' + breakdown + '</h3>' +
      (groups.length
        ? '<div class="deck-grid">' + groups.map((g) => {
          const c = g.card || { id: g.id, name: 'Unknown card #' + g.id };
          const img = api.image(c, 'small');
          return '<div class="deck-slot" data-zone="' + zone + '" data-id="' + g.id + '">' +
            '<button type="button" class="slot-img" data-card-id="' + g.id + '" title="' + esc(c.name) + '">' +
              (img ? '<img loading="lazy" src="' + esc(img) + '" alt="' + esc(c.name) + '">' : '<span class="noimg">' + esc(c.name) + '</span>') +
              C.banBadge(c) +
              '<span class="qty">×' + g.n + '</span>' +
            '</button>' +
            '<div class="slot-actions">' +
              '<button type="button" data-act="dec" title="Remove one" aria-label="Remove one ' + esc(c.name) + '">−</button>' +
              '<button type="button" data-act="inc" title="Add one" aria-label="Add one ' + esc(c.name) + '">+</button>' +
              '<button type="button" data-act="move" title="' + (zone === 'side' ? 'Move to Main/Extra' : 'Move to Side') + '" aria-label="Move ' + esc(c.name) + '">' + (zone === 'side' ? '↑' : '↓') + '</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
        : '<div class="zone-empty muted">' + (zone === 'main' ? 'Search on the left and press + to add cards.' : 'Empty') + '</div>') +
    '</section>';
  }

  function statsHtml(deck) {
    const problems = D.validate(deck);
    const main = deck.main;
    const roleCount = {};
    const roleCards = {};
    main.forEach((id) => {
      const c = D.cached(id);
      if (!c) return;
      App.insights.analyse(c).roleKeys.forEach((r) => {
        roleCount[r] = (roleCount[r] || 0) + 1;
        roleCards[r] = roleCards[r] || new Set();
        roleCards[r].add(c.name);
      });
    });
    const N = main.length;
    const odds = (k, hand) => N ? Math.round(U.probAtLeastOne(N, k, hand) * 100) : 0;
    const starters = roleCount.starter || 0;
    const handtraps = roleCount.handtrap || 0;
    const engine = new Set();
    main.forEach((id) => { const c = D.cached(id); if (c && c.archetype) engine.add(c.archetype); });
    const archCounts = {};
    main.concat(deck.extra).forEach((id) => { const c = D.cached(id); if (c && c.archetype) archCounts[c.archetype] = (archCounts[c.archetype] || 0) + 1; });
    const topArch = Object.keys(archCounts).sort((a, b) => archCounts[b] - archCounts[a]).slice(0, 4);

    const advice = [];
    if (N && starters < 8) advice.push('Only ' + starters + ' starter' + (starters === 1 ? '' : 's') + ' detected. Many competitive decks aim for 8–12 so they open a play most games.');
    if (N >= 40 && handtraps === 0) advice.push('No hand traps detected. Adding a few (e.g. Ash Blossom & Joyous Spring) helps you interact on your opponent\'s turn.');
    if (N > 40) advice.push('Your Main Deck is over 40 — every extra card lowers the chance of drawing your best ones.');
    if (deck.extra.length && deck.extra.length < 15) advice.push('You have ' + (15 - deck.extra.length) + ' free Extra Deck slots — extra options cost nothing in consistency.');

    const roleRow = (key, label) => roleCount[key]
      ? '<tr><td><span class="chip role-' + key + '">' + label + '</span></td><td>' + roleCount[key] + '</td><td>' + odds(roleCount[key], 5) + '%</td><td>' + odds(roleCount[key], 6) + '%</td></tr>'
      : '';

    return '<section class="panel stats">' +
      '<h3>Deck check</h3>' +
      (problems.length
        ? '<ul class="problems">' + problems.map((p) => '<li>⚠ ' + esc(p) + '</li>').join('') + '</ul>'
        : '<p class="ok">✓ Legal under the current TCG banlist and deck-size rules.</p>') +
      (topArch.length ? '<p class="small">Main strategy: ' + topArch.map((a) => '<a href="#/archetype/' + encodeURIComponent(a) + '">' + esc(a) + '</a> (' + archCounts[a] + ')').join(', ') + '</p>' : '') +
      (N ? '<h4>Opening hand odds</h4><table class="table small"><thead><tr><th>Role</th><th>Cards</th><th>Going 1st (5)</th><th>Going 2nd (6)</th></tr></thead><tbody>' +
        roleRow('starter', 'Starter') + roleRow('searcher', 'Searcher') + roleRow('extender', 'Extender') + roleRow('handtrap', 'Hand Trap') +
        roleRow('negate', 'Negation') + roleRow('removal', 'Removal') +
        '</tbody></table><p class="muted small">Chance to open at least one card with that role. Roles are detected from card text.</p>' : '') +
      (advice.length ? '<h4>Suggestions</h4><ul class="tips">' + advice.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') +
    '</section>';
  }

  function deckPage(view, id, params) {
    const deck = D.get(id);
    if (!deck) {
      view.innerHTML = '<section class="page">' + C.empty('That deck was not found. It may have been deleted, or it was created in a different browser.') + '<p><a class="btn" href="#/decks">Back to My Decks</a></p></section>';
      return;
    }
    D.setActive(deck.id);

    view.innerHTML = '<section class="page builder">' +
      '<div class="page-head row-between">' +
        '<div><a class="back" href="#/decks">← My Decks</a><input class="deck-name" id="deck-name" value="' + esc(deck.name) + '" aria-label="Deck name"></div>' +
        '<div class="row">' +
          '<button type="button" class="btn" id="deck-excel">Export Excel</button>' +
          '<button type="button" class="btn" id="deck-export">Export .ydk</button>' +
          '<button type="button" class="btn" id="deck-copy">Copy card list</button>' +
          '<button type="button" class="btn btn-ghost" id="deck-sort" title="Refresh card details & banlist status">↻ Refresh cards</button>' +
        '</div>' +
      '</div>' +
      '<div class="builder-cols">' +
        '<aside class="builder-search"><h3>Add cards</h3><div id="builder-search"></div></aside>' +
        '<div class="builder-deck">' +
          '<div id="deck-zones"></div>' +
          '<div id="deck-stats"></div>' +
          '<section class="panel"><h3>Notes</h3><textarea id="deck-notes" rows="4" placeholder="Combo lines, side-deck plans, cards to buy…">' + esc(deck.notes || '') + '</textarea></section>' +
        '</div>' +
      '</div>' +
    '</section>';

    function current() { return D.get(deck.id) || deck; }

    function renderDeck() {
      const d = current();
      U.$('#deck-zones', view).innerHTML = zoneHtml(d, 'main') + zoneHtml(d, 'extra') + zoneHtml(d, 'side');
      U.$('#deck-stats', view).innerHTML = statsHtml(d);
    }
    renderDeck();

    const searchTile = (c) => '<div class="tile-wrap">' + C.cardTile(c) +
      '<button type="button" class="quick-add" data-quick-add="' + c.id + '" title="Add to deck" aria-label="Add ' + esc(c.name) + ' to deck">+</button></div>';

    const initial = {};
    if (params.get('archetype')) initial.archetype = params.get('archetype');
    App.mountSearch(U.$('#builder-search', view), { compact: true, tile: searchTile, filters: initial });

    view.addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick-add]');
      if (quick) {
        const card = D.cached(quick.getAttribute('data-quick-add'));
        if (!card) return;
        const res = D.addCard(current(), card, 'auto');
        U.toast(res.message);
        if (res.ok) renderDeck();
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act) {
        const slot = act.closest('.deck-slot');
        const zone = slot.getAttribute('data-zone');
        const cid = Number(slot.getAttribute('data-id'));
        const d = current();
        const what = act.getAttribute('data-act');
        if (what === 'dec') D.removeCard(d, cid, zone);
        if (what === 'inc') {
          const card = D.cached(cid);
          if (card) { const r = D.addCard(d, card, zone === 'side' ? 'side' : 'auto'); if (!r.ok) U.toast(r.message); }
        }
        if (what === 'move') {
          const r = D.moveCard(d, cid, zone, zone === 'side' ? 'main' : 'side');
          if (r.message) U.toast(r.message);
        }
        renderDeck();
      }
    });

    U.$('#deck-name', view).addEventListener('change', (e) => {
      const d = current();
      d.name = e.target.value.trim() || 'Untitled Deck';
      D.save(d);
      U.toast('Deck renamed.');
    });
    U.$('#deck-notes', view).addEventListener('input', U.debounce((e) => {
      const d = current();
      d.notes = e.target.value;
      D.save(d);
    }, 500));
    U.$('#deck-export', view).addEventListener('click', () => exportDeck(current()));
    U.$('#deck-excel', view).addEventListener('click', (e) => exportExcel(current(), e.currentTarget));
    U.$('#deck-copy', view).addEventListener('click', async () => {
      const txt = textList(current());
      try {
        await navigator.clipboard.writeText(txt);
        U.toast('Card list copied to clipboard.');
      } catch (e) {
        U.download(current().name + '.txt', txt);
      }
    });
    U.$('#deck-sort', view).addEventListener('click', async () => {
      const d = current();
      const ids = d.main.concat(d.extra, d.side);
      if (!ids.length) return;
      U.toast('Refreshing card details…');
      try {
        const cards = await api.getCardsByIds(ids);
        D.rememberMany(cards);
        renderDeck();
        U.toast('Card details and banlist status updated.');
      } catch (e) {
        U.toast(e.message);
      }
    });

    App.onRoute('deck-changed', (changedId) => { if (changedId === deck.id) renderDeck(); });
  }

  App.views = App.views || {};
  App.views.decks = decksPage;
  App.views.deck = deckPage;
})(window.App);
