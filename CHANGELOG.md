# Changelog

Each `## <version>` section becomes the "What's new" text shown in the app's update dialog and on the GitHub Release page.

## 1.8.0
- **Card effects now follow the rules.** Each card's text is split into its separate effects, the way the rules read it. Only the effect you choose is used; before, the app ran the first thing it recognised anywhere in the card's text.
- **Timing:**
  - Hand traps like Ash Blossom and Effect Veiler only work in response.
  - "If this card is Summoned" effects are offered right after the summon, not at any time.
  - Traps like Mirror Force can only be activated when a monster attacks.
  - Ignition effects only work in your Main Phase.
- **Where:** effects only work from the zone their text says: hand, field or GY.
- **Conditions:** checks such as "if you control no monsters", "if your opponent controls a monster" or "if you control no face-up cards" (Lightning Storm).
- **Costs come first:** discarding, Tributing, banishing from the GY, paying LP, detaching materials and banishing from the Deck. You pick which cards pay.
- **Once per turn** is tracked for each effect separately ("each effect of … once per turn"), or for the whole card when its text says so.
- **"Activate 1 of these effects"** cards (Lightning Storm, Triple Tactics Talent, Elemental HERO Stratos…) let you choose the option.
- **Your choice of effect:** cards with several effects ask which one to use. Greyed-out effects say why they can't be used now.
- **Special Summon (by its own rule):** cards like Dark Magician Girl the Magician's Apprentice and Cyber Dragon have a button for their own Special Summon, with its condition and cost checked.
- **Partly automatic effects:** when the app can only do part of an effect, it says exactly which part is yours to do with the card menus.
- **Smarter, fairer bot:** it follows the same rules. It pays its costs, respects conditions and once-per-turn limits, and only uses effects it fully understands. It now uses its monsters' effects too.

## 1.7.0
- **A new game-style look:** a midnight duel-arena theme with gold and cyan light, game-style windows, buttons and menu bar.
- **Title screen:** the app opens on an animated title screen. Press **Start** (click or Enter) to begin.
- **Main menu:**
  - Choose Free Duel, Deck Editor, Auto-Build, Card Database, New Releases or Help.
  - Move with the arrow keys or mouse; a big preview shows what each choice does, and Free Duel features *today's rival*.
  - Press **Esc** on any page to come back to the menu.
- **Your duelist profile:** set your duelist name, and earn ranks from *Rookie Duelist* to *Legendary Duelist* as you win. Your wins and losses are counted overall and against each rival.
- **Rival select:**
  - A fighting-game style roster with a big spotlight on the selected rival, tabs for each series, and a ★ on every rival you've beaten.
  - A **VS screen** plays before each duel, and the results screen shows your record.
- **9 new rivals:**
  - ARC-V: **Yuto** (Phantom Knights), **Yugo** (Speedroid / Clear Wing), **Yuri** (Predaplant) and **Zarc** (Supreme King).
  - VRAINS: **Ai** (@Ignister), **Soulburner** (Salamangreat), **Revolver** (Rokket / Borrel), **Blue Angel** (Trickstar) and **Go Onizuka** (Gouki).
  - That makes 26 duelists in all.
- **Menu sounds** when you move through menus, confirm a choice or start a duel.

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
