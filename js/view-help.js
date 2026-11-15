/* Help: the "How to play" guide (also shown on the duel board) and the Help page. */
(function (App) {
  'use strict';

  const esc = App.U.esc;

  const GLOSSARY = [
    ['LP (Life Points)', 'Each duelist starts with 8,000 (4,000 in Speed Duel). Reach 0 and you lose.'],
    ['GY (Graveyard)', 'Where cards go when they are destroyed, used or discarded. Some cards work from the GY.'],
    ['Banished', 'Removed from play, face-up beside the field. Harder to get back than the GY.'],
    ['Extra Deck', 'Up to 15 Fusion, Synchro, Xyz and Link Monsters, summoned by using monsters as materials.'],
    ['Normal Summon', 'Play a monster from your hand face-up. You get one Normal Summon (or Set) per turn.'],
    ['Tribute Summon', 'A Level 5-6 monster needs 1 monster sent to the GY first; Level 7 or higher needs 2.'],
    ['Special Summon', 'Any summon that comes from a card effect or the Extra Deck. No limit per turn.'],
    ['Set', 'Place a card face-down. Set monsters are in Defense Position; Set Traps can be used from your next turn.'],
    ['Chain', 'When a card is activated, players can respond with another. The last card played resolves first.'],
    ['Hand trap', 'A monster you use from your hand during your opponent\'s turn, like Ash Blossom & Joyous Spring.'],
    ['Quick-Play Spell', 'A Spell you can use during either player\'s turn once it is Set.'],
    ['Once per turn', 'An effect you can use only one time each turn. The app warns you if you try twice.'],
    ['Archetype', 'A family of cards that support each other, like Lunalight or Blue-Eyes.'],
    ['Starter / Extender', 'A starter begins your combo on its own; an extender adds more summons after it.'],
    ['Staple', 'A strong card that fits in almost any deck, like hand traps and board breakers.'],
    ['Format / Banlist', 'The rules you play by. TCG, OCG, Speed Duel and Goat each limit which cards are allowed and how many copies.']
  ];

  const SHORTCUTS = [['B', 'Go to the Battle Phase'], ['M', 'Go to Main Phase 2'], ['E', 'End your turn'], ['?', 'Open this guide']];

  function duelHtml() {
    return '<div class="help-steps">' +
      '<div><h4>🎯 The goal</h4><p>Bring your opponent\'s Life Points (LP) to 0. You also win if they must draw from an empty Deck.</p></div>' +
      '<div><h4>🔁 Your turn</h4><p>You draw automatically, then play cards in <strong>Main Phase 1</strong>, attack in the <strong>Battle Phase</strong>, play more in <strong>Main Phase 2</strong>, and press <strong>End Turn</strong>. The line under the turn box always says what you can do next.</p></div>' +
      '<div><h4>🃏 Playing cards</h4><p><strong>Click any card</strong> to see what you can do with it. Cards that <span class="glow-sample">glow</span> can be played right now. Greyed-out buttons tell you why not. You can also <strong>drag</strong> a card from your hand onto a zone.</p></div>' +
      '<div><h4>✨ Summoning</h4><p>One Normal Summon (or Set) per turn. Level 5-6 monsters need 1 Tribute, Level 7+ need 2. For Fusion, Synchro, Xyz and Link Monsters, click your <strong>Extra</strong> pile and pick the materials yourself; the app checks they follow the rules.</p></div>' +
      '<div><h4>⚔ Attacking</h4><p>In the Battle Phase, click a monster that glows orange and choose a target, or drag it onto one. If your opponent has no monsters, you attack their LP directly. Nobody can attack on the very first turn of the duel.</p></div>' +
      '<div><h4>⛓ Responding</h4><p>When your opponent plays a card, you\'ll be asked if you want to respond with a Set Trap, a Quick-Play Spell or a hand trap. Choose <em>Never</em> in ⚙ Settings to skip these questions.</p></div>' +
      '<div><h4>🛠 When a card isn\'t automated</h4><p>Common effects resolve with one click. For anything else, use <strong>More moves</strong> in a card\'s menu or the <strong>Manual tools</strong> box to move cards, change LP or draw, just like on a real table.</p></div>' +
      '</div>' +
      '<h4>Keyboard shortcuts</h4><table class="kbd-table">' + SHORTCUTS.map((k) => '<tr><td><kbd>' + esc(k[0]) + '</kbd></td><td>' + esc(k[1]) + '</td></tr>').join('') + '</table>';
  }

  function page(view) {
    view.innerHTML = '<section class="page help-page">' +
      '<div class="page-head"><h1>Help</h1><p class="muted">Everything Duel Vault can do, and the Yu-Gi-Oh! words it uses.</p></div>' +
      '<nav class="help-toc panel"><a href="#help-start">Getting started</a><a href="#help-features">What each page does</a><a href="#help-duel">How to duel</a><a href="#help-words">Yu-Gi-Oh! words</a><a href="#help-faq">Questions</a></nav>' +
      '<div class="panel" id="help-start"><h2>Getting started in 3 steps</h2><ol class="big-steps">' +
        '<li><strong>Make a deck.</strong> Go to <a href="#/build">⚡ Auto-Build</a>, type an archetype such as "Lunalight" or click a famous duelist, then press <em>Save to My Decks</em>.</li>' +
        '<li><strong>Test it.</strong> Press <em>Save &amp; test hands</em> to deal opening hands and see how often you draw a starter.</li>' +
        '<li><strong>Duel.</strong> Go to <a href="#/duel">⚔ Duel</a>, click an opponent and press <em>Start duel</em>. No deck yet? Borrow a famous duelist\'s deck.</li>' +
      '</ol></div>' +
      '<div class="panel" id="help-features"><h2>What each page does</h2><div class="help-grid">' +
        '<div><h4>🔍 Card Search</h4><p>Type part of a card\'s name. Filter by type, attribute, level or archetype. Click a card to read its effect, see which archetype it belongs to, get tips on how to use it, and add it to a deck.</p></div>' +
        '<div><h4>🆕 New Releases</h4><p>Upcoming and recent products, plus newly released cards. Click ☆ to add a set to your watchlist.</p></div>' +
        '<div><h4>📚 My Decks</h4><p>Build and edit decks. The builder checks deck size and the banlist, and shows your opening-hand odds. Export to Excel (with card pictures) or .ydk, or import an Excel/CSV sheet to build a deck automatically.</p></div>' +
        '<div><h4>⚡ Auto-Build</h4><p>Type an archetype, or pick Yugi, Kaiba, Jaden and others, and get a ready-to-play deck with an explanation of every pick.</p></div>' +
        '<div><h4>🎴 Draw Tester</h4><p>Deal test hands from any deck and see the chance of opening a starter, from 10,000 simulated hands.</p></div>' +
        '<div><h4>⚔ Duel</h4><p>Practise against famous duelists, played by the free built-in bot or by Claude AI with your own API key.</p></div>' +
      '</div></div>' +
      '<div class="panel" id="help-duel"><h2>How to duel</h2>' + duelHtml() + '</div>' +
      '<div class="panel" id="help-words"><h2>Yu-Gi-Oh! words</h2><dl class="glossary">' + GLOSSARY.map((g) => '<dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd>').join('') + '</dl></div>' +
      '<div class="panel" id="help-faq"><h2>Questions</h2>' +
        '<details><summary>Where are my decks saved?</summary><p class="muted">On this device only. To back them up or move them, open a deck and export it to Excel or .ydk, then import it on the other device.</p></details>' +
        '<details><summary>How do I update the Mac app?</summary><p class="muted">When a new version is out, an <strong>Update</strong> button appears at the top right. Click it, then <strong>Install</strong>. Your decks are kept.</p></details>' +
        '<details><summary>Card pictures aren\'t showing.</summary><p class="muted">Card data and pictures come from the free YGOPRODeck service, so you need an internet connection. Cards you have opened before still work offline.</p></details>' +
        '<details><summary>A card\'s effect didn\'t happen in a duel.</summary><p class="muted">The app automates the most common effects. For others, click the card and open <strong>More moves</strong>, or use <strong>Manual tools</strong>, to do what the card says.</p></details>' +
        '<details><summary>Does the Claude opponent cost money?</summary><p class="muted">Yes, it uses your own Anthropic API key, which is billed per use. The built-in bot is free.</p></details>' +
      '</div></section>';
    // In-page links (the router uses the hash, so scroll instead of navigating).
    view.addEventListener('click', (e) => {
      const a = e.target.closest('.help-toc a');
      if (!a) return;
      e.preventDefault();
      const t = view.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  App.help = { duelHtml: duelHtml, GLOSSARY: GLOSSARY };
  App.views = App.views || {};
  App.views.help = page;
})(window.App);
