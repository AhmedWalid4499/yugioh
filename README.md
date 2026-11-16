# Duel Vault: Yu-Gi-Oh! database & deck builder

A personal Yu-Gi-Oh! TCG companion that runs in your web browser. Card data comes live from the free [YGOPRODeck API](https://ygoprodeck.com/api-guide/), so new cards and sets show up as soon as YGOPRODeck adds them.

## What it does

### 🏫 Academy Campus: make friends with the duelists
- **Campus map:** walk around the island; who is where changes in the morning, afternoon and evening. Click a duelist to talk in a visual-novel style scene.
- **In a conversation:** Talk (once a day, with answers to choose and real duelling tips), Give a gift (a card from your binder), Duel, see their deck, or chat freely with Claude using your own API key.
- **Friendship hearts:** each new heart has a reward (DP, cards from their deck, at 5 hearts their ace). At 3 hearts a duelist can become your **partner**, who cheers you on in duels.

### 🏝 Academy look, animations and the Card Shop
- **Look:** the bright Academy theme (sky, sea and an academy island, original artwork) is the default. The dark Arena look is in your profile, along with your **dorm colour** (Red, Yellow or Blue).
- **Animations:** screen wipes; a pre-duel speech bubble, coin toss and "DUEL!" call; summon cut-ins; turn-change sweeps; rolling LP; and a Victory/Defeat screen.
- **Duel Points:** +500 a win (+300 for the first win against each rival) and +100 a loss.
- **Card Shop:** spend DP on booster packs from real sets, open them with an animation, and collect the cards in **My binder**.

### 🎮 Title screen, main menu and profile
- The app opens on an animated **title screen**. Press **Start** (click, or press Enter) to begin.
- **Main menu:**
  - Choose Free Duel, Deck Editor, Auto-Build, Card Database, New Releases or Help & Guide.
  - Move with the mouse or the arrow keys; a large preview shows what each choice does.
  - Free Duel features *today's rival*.
  - Press **Esc** on any page to come back to the menu.
- **Your duelist profile:** click your name to change it. Ranks go from *Rookie Duelist* to *Legendary Duelist* as you win. Wins and losses are counted overall and against each rival.
- **❓ Help** explains every page and how to duel, lists common Yu-Gi-Oh! words, and answers frequent questions. On the duel board, press **?** to open the same guide.
- The look is an original midnight duel-arena theme made with CSS and SVG. It doesn't use any game's or show's artwork; card pictures come from YGOPRODeck.

### 🔍 Card Search
- Search every card by name, with filters for card type, sub-type, attribute, level/rank, archetype and banlist status.
- Open any card to see:
  - **The full effect text**, with stats, summoning requirements and banlist status.
  - **How to use it**: roles worked out from the card text (Starter, Searcher, Extender, Hand Trap, Negation, Removal, Floodgate…) plus practical tips.
  - **Which deck it belongs to**: its archetype, other cards it names, any pre-built Structure Decks it came in, and other cards from the same archetype.
  - TCG/OCG release dates and every set it was printed in, with rarities.
- **Archetype pages** list every card in an archetype by Main/Extra/Spell/Trap, count each role, and point out the likely starters.

### 🆕 New Releases
- Every TCG product with its release date, in tabs for **Upcoming**, **Last 90 days**, **All sets** and **My watchlist**.
- Filter by Booster Sets, Decks (Structure/Starter), Tins & Collections or Promos.
- Star (☆) a set to add it to your watchlist.
- A **New cards** tab lists cards released in the last 60 days and those due in the next few months.
- Each set has its own page with the card list, rarities, the archetypes it supports, and a button that turns the card list into a deck.

### 🃏 My Decks (deck builder)
- Create, rename, duplicate and delete decks, and add notes for combo lines or a shopping list.
- Search and add cards from the same screen. Extra Deck monsters go to the Extra Deck automatically.
- Enforces the **TCG banlist** (Forbidden, Limited, Semi-Limited) and deck sizes (Main 40–60, Extra 15, Side 15).
- A **deck check** panel shows:
  - your main strategy
  - **opening-hand odds**: the chance of drawing at least one starter, hand trap and so on, going first or second
  - suggestions for improving the deck
- **Import/Export `.ydk`** files, the standard format used by YGOPRODeck, EDOPro, Dueling Book and others. You can also copy a plain-text card list.

### 📊 Excel import & export
- **Export Excel** saves your deck as an `.xlsx` sheet with **each card's picture** next to its quantity, name, section, type, stats, archetype, banlist status and full effect text, so it's handy for printing, sharing or shopping lists.
- **Import deck** also accepts an **Excel sheet (.xlsx)** or **.csv** and builds the deck for you:
  - Use columns headed **Qty**, **Card Name** and **Section** (Main / Extra / Side). Only *Card Name* is required.
  - Leave *Section* blank and Extra Deck monsters are placed automatically.
  - Name matching ignores capital letters and punctuation. Rows like `3x Dark Magician` and section headings like `Side Deck` also work.
  - Cards that can't be matched are listed in the deck's **Notes** so you can fix them.
  - A **Download Excel template** button gives you a ready-made sheet to fill in.
  - Excel files exported by Duel Vault can be imported again to rebuild the same deck.

### ⚡ Auto-Build
- Type an archetype (for example **Lunalight**, Snake-Eye or Blue-Eyes), pick a format, and get a ready-to-play deck.
- The builder reads every card in the archetype and ranks it by its role (starter, searcher, extender, Fusion enabler, boss). Starters get 3 copies.
- It then adds generic staples for the format (optional): hand traps and board breakers in TCG/OCG, or classic staples in Goat.
- It also fills the Extra Deck, with the archetype's Extra Deck monsters first.
- You get a short game plan ("open with…, aim for…"), and each pick shows why it was chosen. Save it, then edit it in the deck builder like any other deck.
- These are rule-based picks from card text, not tournament-tested lists. If an archetype has too few cards, it tells you how many slots are left to fill.

### 🃏 Draw Tester
- In any deck, open **🃏 Test hands** to deal opening hands, draw extra cards and toggle going first or second.
- It runs **10,000 simulated hands** to show your chance of opening at least 1 starter, 2 or more starters, a brick, or a hand trap.
- Tick which cards count as starters; the odds update instantly.

### ⚔ Duel
- Practice duels with any saved deck. Your opponent can use one of your decks, an auto-built deck from any archetype, or a mirror match.
- **Built-in bot (free, offline):** plays a full turn the way a player would:
  - uses Spells and searches
  - Special Summons extenders
  - makes Synchro, Xyz, Link and Fusion Summons from its field
  - attacks with sensible ordering and never makes a losing attack
  - chains hand traps, counter traps and summon/attack traps against your plays
- **Claude AI opponent:** reads every card's text and plays its deck like a person, including effects the bot doesn't understand.
  - Needs your own Anthropic API key, from console.anthropic.com. The key is saved only on your device and sent only to Anthropic.
  - Choose Opus 5.5 (strongest, roughly $1–2 per duel), Sonnet 5.5 (roughly 50¢–$1) or Haiku 5.5 (roughly 5¢). These are rough estimates.
  - If a request fails, the built-in bot plays that turn.
- **What's automated:** turn and phase order, drawing, Normal and Tribute Summons, Sets, when Spells and Traps can be activated, position changes, battle, damage, LP and win conditions.
- Common effects resolve with **one click**: draw, destroy, search, revive, burn, Fusion Summons, and Mirror Force-style Traps. Anything else you resolve with the card menus: move cards between zones, Special Summon, change ATK or LP, search the Deck.

### 🃏 Card effects
- **Rule-based reading:** each card's text is split into its separate effects. Each effect has its own timing, condition, cost and once-per-turn limit, and the zone it works from (hand, field or GY).
- **Resolving:** only the effect you choose is used. Its costs are paid first, and you pick which cards pay.
- **Options:** cards that say "activate 1 of these effects" let you choose which.
- **What the app can't do itself:** the dialog says which part to do with the card menus.

### 🎮 Duel board
- **Guided play:**
  - A line under the turn box tells you what you can do next.
  - Card menus show only the moves the rules allow right now, and greyed-out buttons explain why.
  - Free moves for effects the app doesn't automate are under *More moves*.
- **Keyboard shortcuts:** **B** Battle Phase, **M** Main Phase 2, **E** End Turn, **?** How to play.
- **No deck needed:** on the setup screen you can borrow any famous duelist's deck as your own.
- **Drag and drop:**
  - Drag a card from your hand onto a Monster Zone to summon or set it.
  - Drag a Spell or Trap onto a Spell & Trap Zone to activate or set it.
  - Drag a monster onto an opponent's monster, or their LP, to attack.
  - Drag a card onto your GY, Banished pile or Deck to send it there.

  Clicking a card still opens its full menu, which also works on phones.
- **Hover preview** of any card, **glow hints** for what you can play and which monsters can attack, LP bars, and animations for summons, attacks, explosions and damage.
- **Materials are always your choice:** for Fusion, Synchro, Xyz and Link Summons you pick the materials and the app checks them against the card's requirement.
- **Sound effects** with an on/off button and volume slider.
- **Chains and responses (official rules):**
  - When your opponent activates a card or summons, you're asked whether to respond with a Set Trap or Quick-Play, a hand trap, or a Quick Effect. Choose *When I can*, *Always* or *Never*.
  - Your opponent responds to your plays too, for example with Ash Blossom against a search or Bottomless Trap Hole against a big summon.
- **Also in duels:** FLIP effects, once-per-turn warnings, monster effects from the GY, Surrender, and a duel speed setting.
- **Portraits** next to each duelist's name: their ace card by default, or any picture you choose with 📷 (saved on your device only). Official character artwork isn't included because it's copyrighted.

### 🌟 Famous duelists
Pick a rival from the 32 duelists on the fighting-game style rival select (with series tabs and a ★ on every rival you've beaten), each with a **modern version of their deck**. It's built live from the newest support cards in the database and always includes their ace and signature cards:

| Series | Duelists |
| --- | --- |
| Duel Monsters | Yugi (Dark Magician), Kaiba (Blue-Eyes), Joey (Red-Eyes), Mai (Harpie), Pegasus (Toon), Marik (Winged Dragon of Ra), Bakura (Destiny Board / Dark Necrofear) |
| GX | Jaden (Elemental HERO), Syrus (Vehicroid), Alexis (Cyber Blader / Cyber Angel), Jesse (Crystal Beast), Yubel, Zane (Cyber Dragon), Aster (Destiny HERO), Chazz (Armed Dragon) |
| 5D's | Yusei (Synchron/Junk/Stardust), Jack (Red Dragon Archfiend), Crow (Blackwing), Akiza (Rose Dragon) |
| ZEXAL | Yuma (Utopia), Kite (Galaxy-Eyes/Photon) |
| ARC-V | Yuya (Performapal/Odd-Eyes), Yuto (Phantom Knights), Yugo (Speedroid/Clear Wing), Yuri (Predaplant), Zarc (Supreme King) |
| VRAINS | Playmaker (Code Talker), Ai (@Ignister), Soulburner (Salamangreat), Revolver (Rokket/Borrel), Blue Angel (Trickstar), Go Onizuka (Gouki) |

A VS screen plays before each duel. The built-in bot or Claude can play any of them; with Claude, comments come in the character's voice. To use one of their decks yourself, pick them on the Auto-Build page.

### 📜 Formats (rulings)
Pick the format per deck (in the deck builder) and per duel. It sets the banlist, deck sizes, card legality, LP, hand size and zones:

| Format | Banlist | LP | Hand | Main Deck | Notes |
| --- | --- | --- | --- | --- | --- |
| TCG Advanced | TCG | 8000 | 5 | 40–60 | Current Master Rule, Extra Monster Zones |
| OCG | OCG | 8000 | 5 | 40–60 | Current Master Rule |
| Speed Duel | — | 4000 | 4 | 20–30 | 3 Monster/Spell zones, Extra Deck 0–5 |
| Goat | Goat (2005) | 8000 | 5 | 40–60 | First player draws; no Synchro, Xyz, Pendulum or Link |

## 🍎 Mac app

### Download and install
1. Go to the [latest release](https://github.com/AhmedWalid4499/yugioh/releases/latest).
2. Download the `.dmg` for your Mac. For Apple Silicon (M1, M2, M3, M4) choose `Duel-Vault-<version>-arm64.dmg`. For Intel choose `…-x64.dmg`. To check which you have, open  → About This Mac.
3. Open the `.dmg` and drag **Duel Vault** into **Applications**.

### Opening it for the first time
The app isn't registered with Apple (that costs $99/year), so macOS shows a warning the first time:
1. Open Duel Vault from Applications. macOS says it can't verify the app. Click **Done**.
2. Go to  → **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to "Duel Vault was blocked".
3. Confirm with **Open Anyway** and your password. After that, it opens normally.

If that doesn't work, run this once in Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Duel Vault.app"
```

### Updates
- The app checks for updates when it starts, and every few hours while it's open. When there's a new version, the **⬆ Update to vX** button lights up in the top-right corner. You can also use **Duel Vault → Check for Updates…** in the menu bar.
- Most updates install **with one click** in a few seconds. Your decks and watchlist are kept.
- If an update changes the Mac app itself, the button opens the download page for the new `.dmg` instead.

### Publishing an update (for maintainers)
1. Make your changes and raise the version number in **both** `package.json` (`"version"`) and `js/version.js`.
2. Add a `## <version>` section to `CHANGELOG.md`. It becomes the "What's new" text in the app.
3. If anything in `desktop/` or the Electron version changed, also set `"duelVault": { "minAppVersion": "<version>" }` in `package.json`. That makes existing apps download the new `.dmg` instead of the one-click update.
4. Merge to `main`. The **Mac app** GitHub Action tests everything, builds the `.dmg` files and publishes the release automatically.

## How to open it in a browser

**Option 1: on your computer.** Download the repository (Code → Download ZIP), unzip it and double-click `index.html`. Nothing to install.

**Option 2: as a website (GitHub Pages, free).**
1. On GitHub, open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
3. After a minute your site is live at `https://<your-username>.github.io/yugioh/`.

> Your decks and watchlist are saved **in the browser or app you use**: they won't sync between your phone, your laptop and the Mac app. Use **Export .ydk** or **Export Excel** to back up a deck or move it to another device.

## Good to know
- The "How to use it" roles and tips come from reading the card text with rules, not from tournament data. They're a solid starting point, and the real card text is always shown next to them.
- Set lists and archetype names are cached for a few hours to keep the app fast and respect YGOPRODeck's rate limits.
- Card images are loaded from YGOPRODeck's image server. If a picture can't be downloaded during Excel export, that cell uses an `IMAGE()` formula instead, which shows the picture in Excel 365 and Google Sheets.
- This is a fan-made tool and isn't affiliated with Konami. Yu-Gi-Oh! is a trademark of Konami.

## Credits
- Card data and images: [YGOPRODeck API](https://ygoprodeck.com/api-guide/).
- Sound effects: [uisfx](https://github.com/romainsimon/uisfx) via [`@wubbleai/community-sfx`](https://www.npmjs.com/package/@wubbleai/community-sfx), CC0 1.0 (`vendor/sfx`).
- Synthesised game sounds: [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force, MIT (`vendor/zzfx`).
- Fonts: [Cinzel](https://fonts.google.com/specimen/Cinzel) and [Rajdhani](https://fonts.google.com/specimen/Rajdhani) via Fontsource, SIL Open Font License (`vendor/fonts`).
- Excel support: [ExcelJS](https://github.com/exceljs/exceljs), MIT.

## For developers
Plain HTML, CSS and JavaScript, with no build step. The files:

| File | Purpose |
| --- | --- |
| `js/api.js` | YGOPRODeck API client and caching |
| `js/insights.js` | Card role detection and usage tips |
| `js/decks.js` | Deck storage, banlist validation, YDK import/export |
| `js/excel.js` | Excel/CSV import and Excel export with pictures |
| `vendor/exceljs.min.js` | [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 (MIT), loaded only when Excel features are used |
| `js/components.js` | Card tiles and the card detail modal |
| `js/view-*.js` | Search/Archetype, Releases/Set and Decks/Builder pages |
| `js/app.js` | Hash router |
| `js/formats.js` | Formats: banlists, deck sizes, LP, zones and legality |
| `js/deckgen.js` | Auto-Build: archetype(s) and signature cards to deck |
| `js/characters.js` | Famous duelists: archetypes, signature cards and personas |
| `js/view-tools.js` | Auto-Build and Draw Tester pages |
| `js/duel/engine.js` | Duel rules engine (zones, summons, phases, battle, LP) and fx events |
| `js/duel/materials.js` | Checks Fusion/Synchro/Xyz/Link materials against card requirements |
| `js/sound.js` | Sound effects (CC0 samples + ZzFX) |
| `js/duel/effects.js` | Effect reader: common effect wording to one-click resolution |
| `js/duel/bot.js` | Built-in bot opponent |
| `js/duel/claude.js` | Claude AI opponent (Messages API with a `take_actions` tool) |
| `js/view-duel.js` | Duel setup and board |
| `js/desktop.js` | Update button and version display (Mac app only) |
| `desktop/` | Electron shell, preload bridge and updater |
| `scripts/build-web.js` | Builds the web bundle, update zip and release notes |
| `.github/workflows/mac-app.yml` | Tests, builds the `.dmg` files and publishes releases |

The Mac app lives in `desktop/` (Electron). `main.js` serves the web app from a private `app://` address and `updater.js` handles in-app updates from GitHub Releases. The packaging config is in the `build` section of `package.json`.

```bash
npm install
npm start
```

That runs the desktop app from source. To run the tests:

```bash
npm test
```

```bash
npm run build:web && npm run test:desktop
```

`npm test` runs the updater unit tests, the duel and format unit tests, and the web smoke test against mocked card and Claude APIs. The second command runs the desktop app end to end, including a one-click update. On Linux, wrap it in `xvfb-run -a`.
