# Duel Vault: Yu-Gi-Oh! database & deck builder

A personal Yu-Gi-Oh! TCG companion that runs in your web browser. Card data comes live from the free [YGOPRODeck API](https://ygoprodeck.com/api-guide/), so new cards and sets show up as soon as YGOPRODeck adds them.

## What it does

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

`npm test` runs the updater unit tests and the web smoke test against a mocked card API. The second command runs the desktop app end to end, including a one-click update. On Linux, wrap it in `xvfb-run -a`.
