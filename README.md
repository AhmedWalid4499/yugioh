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

## How to open it

**Option 1: on your computer.** Download the repository (Code → Download ZIP), unzip it and double-click `index.html`. Nothing to install.

**Option 2: as a website (GitHub Pages, free).**
1. On GitHub, open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
3. After a minute your site is live at `https://<your-username>.github.io/yugioh/`.

> Your decks and watchlist are saved **in the browser you use**: they won't sync between your phone and laptop. Use **Export .ydk** to back up a deck or move it to another device.

## Good to know
- The "How to use it" roles and tips come from reading the card text with rules, not from tournament data. They're a solid starting point, and the real card text is always shown next to them.
- Set lists and archetype names are cached for a few hours to keep the app fast and respect YGOPRODeck's rate limits.
- Card images are loaded from YGOPRODeck's image server.
- This is a fan-made tool and isn't affiliated with Konami. Yu-Gi-Oh! is a trademark of Konami.

## For developers
Plain HTML, CSS and JavaScript, with no build step. The files:

| File | Purpose |
| --- | --- |
| `js/api.js` | YGOPRODeck API client and caching |
| `js/insights.js` | Card role detection and usage tips |
| `js/decks.js` | Deck storage, banlist validation, YDK import/export |
| `js/components.js` | Card tiles and the card detail modal |
| `js/view-*.js` | Search/Archetype, Releases/Set and Decks/Builder pages |
| `js/app.js` | Hash router |

Run the end-to-end smoke test, which uses a mocked API:

```bash
npm install
npm test
```
