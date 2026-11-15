# Changelog

Each `## <version>` section becomes the "What's new" text shown in the app's update dialog and on the GitHub Release page.

## 1.6.0
- **New Home page:** search for a card straight away, jump to any part of the app, carry on with your decks or an unfinished duel, and challenge a duelist in one click. First-time visitors get a 3-step guide.
- **Simpler duel setup:**
  - Three numbered steps: your opponent, your deck, and who plays your opponent.
  - The rest (rulings, who goes first, Life Points, your picture) is under *More options*.
  - A bar at the bottom always shows who's duelling and has the **Start duel** button.
- **Duel without a deck:** borrow a famous duelist's deck as your own.
- **The duel board guides you:**
  - A line under the turn box tells you what you can do next.
  - Card menus show only the moves the rules allow right now. Greyed-out buttons explain why (for example "Needs 2 Tributes").
  - Free moves for effects the app doesn't handle are under *More moves*.
  - Manual tools and settings fold away.
- **How to play:** a guide on the duel board (press **?**), with keyboard shortcuts: **B** Battle Phase, **M** Main Phase 2, **E** End Turn.
- **Help page:** a guide to every page, how to duel, a list of Yu-Gi-Oh! words, and answers to common questions.
- **My Decks:** every deck has *Test hands* and *Duel* buttons. When you have no decks, the page offers to auto-build one.

## 1.5.0
- **Much smarter bot:**
  - Synchro, Xyz and Link Summons from its own field (checked by the same rules as yours), plus Fusion Summons with spells.
  - Special Summons extenders from its hand when their condition is met (e.g. Cyber Dragon).
  - Uses its monsters' "when summoned" searches and plays Spells it understands.
  - Chains hand traps against you: Ash Blossom against searches, Infinite Impermanence and Effect Veiler against monster effects, counter traps against Spells and Traps.
  - Springs Trap Hole-style traps on your summons and Mirror Force-style traps on your attacks.
  - In battle it clears blockers with its weakest winning attacker, never makes losing attacks, Flip Summons when useful, and switches outclassed monsters to Defense.
  - Respects once-per-turn effects.
- **Chains and response windows (official rules):**
  - When your opponent activates a card or summons, you can respond with a Set Trap or Quick-Play, a hand trap, or a Quick Effect.
  - Choose when you're asked: *When I can* (default), *Always* or *Never*.
  - Your opponent can respond to your plays the same way.
- **FLIP effects** activate when a monster is flipped face-up, by an attack or a Flip Summon.
- **Once-per-turn warnings** when you try to use an effect twice in a turn.
- **Monster effects from the GY**, a **Surrender** button and a **duel speed** setting.
- **Portraits:** every duelist is shown with a portrait next to their name: their ace card in their colour, or a picture you choose (📷).

## 1.4.0
- **You choose your materials:** Fusion, Synchro, Xyz and Link Summons let you pick the Fusion Monster and every material yourself. The rules then check your pick: Tuner and Level totals, Xyz Levels and counts, Link Ratings, and named Fusion materials. A card effect that bends the rules can still override the check.
- **Interactive board:**
  - Drag cards from your hand onto a zone to summon, set or activate them.
  - Drag a monster onto an opponent's monster or their LP to attack.
  - Drag a card onto your GY, Banished pile or Deck.
  - Hover any card for a large preview.
  - Playable cards glow, and monsters that can attack glow orange.
- **New look:** a glowing duel playmat, LP bars, a fanned hand, and animations for summons, attacks, explosions, damage numbers and turn/phase banners.
- **Sound effects:** draws, summons, Special Summons, sets, activations, attacks, explosions, damage, phases, victory and defeat. A sound on/off button and volume slider are on the duel screen.
- **Fixed:** some duel windows could close by themselves when you clicked a card.

## 1.3.0
- **Fixed:** Auto-Build and Duel bounced back to Card Search after updating the Mac app. The app had kept old copies of some files; updates now always load fresh files.
- **Famous duelists:** pick Yugi, Kaiba, Joey, Jaden, Yusei, Jack, Crow, Yuma, Kite, Yuya, Playmaker and more as your opponent. Each plays a modern version of their deck, built from the newest support cards with their ace and signature cards.
- Build any famous duelist's deck for yourself from the Auto-Build page.
- When the Claude opponent plays a character, its comments are in that character's voice.
- Smarter bot: it keeps hand traps in hand, Sets weak monsters face-down and prefers searchers.
- The duel board fits laptop screens better.

## 1.2.0
- **Auto-Build:** type an archetype (for example "Lunalight") and get a ready-to-play deck. It includes the archetype's starters, extenders and Extra Deck monsters plus generic staples, and explains each pick.
- **Draw Tester:** deal test hands, draw cards, and see your odds of opening a starter, from 10,000 simulated hands. You choose which cards count as starters.
- **Duel:** practice against the built-in bot or a Claude AI opponent (with your own Anthropic API key).
  - Rules are automated: summons, Tributes, phases, battle, LP.
  - Common effects resolve with one click.
- **Formats:** pick TCG Advanced, OCG, Speed Duel or Goat format for each deck and duel. Banlists, deck sizes, zones, LP and hand size follow the format.

## 1.1.0
- Duel Vault is now a Mac app, with a **Check for updates** button that installs new versions in one click.
- Export decks to Excel with card pictures, and build decks by importing an Excel or CSV sheet.
- Card search with "How to use it" tips, archetype pages, the New Releases tracker with watchlist, and the deck builder with banlist checks and opening-hand odds.
