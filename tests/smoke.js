/* End-to-end smoke test. Opens index.html in headless Chromium with the
   YGOPRODeck API mocked, and walks through search, card details, deck
   building, YDK import/export, releases and archetype pages.
   Run:  node tests/smoke.js   (needs the `playwright` package) */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const ExcelJS = require('exceljs');
const os = require('os');
const { cards, sets, archetypes } = require('./fixtures');

const ROOT = path.resolve(__dirname, '..');
const URL_BASE = 'file://' + path.join(ROOT, 'index.html');
const SHOTS = process.env.SHOTS_DIR || null;
const PNG = process.env.CARD_PNG ? fs.readFileSync(process.env.CARD_PNG) : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.log('  ✗ ' + msg); }
}

function apiResponse(url) {
  const u = new URL(url);
  const p = u.searchParams;
  const file = u.pathname.split('/').pop();
  if (file === 'archetypes.php') return archetypes;
  if (file === 'cardsets.php') return sets;
  let list = cards.slice();
  if (p.get('id')) {
    const ids = p.get('id').split(',').map(Number);
    list = list.filter((c) => ids.includes(c.id));
  }
  if (p.get('name')) {
    const names = p.get('name').split('|');
    list = list.filter((c) => names.includes(c.name));
  }
  if (p.get('fname')) list = list.filter((c) => c.name.toLowerCase().includes(p.get('fname').toLowerCase()));
  if (p.get('archetype')) list = list.filter((c) => c.archetype === p.get('archetype'));
  if (p.get('cardset')) list = list.filter((c) => (c.card_sets || []).some((s) => s.set_name === p.get('cardset')));
  if (p.get('type')) list = list.filter((c) => c.type === p.get('type'));
  if (p.get('banlist')) list = list.filter((c) => c.banlist_info);
  if (p.get('startdate')) list = list.filter((c) => c.misc_info && c.misc_info[0].tcg_date >= p.get('startdate'));
  if (!list.length) return { __status: 400, error: 'No card matching your query was found in the database.' };
  if (p.get('num')) {
    const num = +p.get('num');
    const off = +(p.get('offset') || 0);
    const page = list.slice(off, off + num);
    return { data: page, meta: { total_rows: list.length, next_page_offset: off + num < list.length ? off + num : null } };
  }
  return { data: list };
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await context.route('https://db.ygoprodeck.com/**', (route) => {
    const body = apiResponse(route.request().url());
    const status = body.__status || 200;
    delete body.__status;
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  await context.route('https://images.ygoprodeck.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  // Fake Claude API: summons the first Level 1-4 monster in hand, attacks directly when it can.
  const claudeCalls = [];
  await context.route('https://api.anthropic.com/**', (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
    const body = JSON.parse(route.request().postData());
    claudeCalls.push(body);
    const content = body.messages[0].content;
    const state = JSON.parse(content.split('Game state:\n')[1]);
    let actions = [];
    if (/Battle Phase/.test(content)) actions = state.you.field.monsters.filter((m) => m.position === 'attack').map((m) => ({ type: 'attack', card: m.uid, target: state.opponent.field.monsters.length ? state.opponent.field.monsters[0].uid : 'direct' }));
    else if (/Main Phase 1/.test(content)) {
      const mon = state.you.hand.find((c) => c.atk != null && c.level >= 1 && c.level <= 4);
      if (mon) actions.push({ type: 'normal_summon', card: mon.uid, position: 'attack' });
    } else actions = [{ type: 'pass' }];
    route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_1', name: 'take_actions', input: { comment: 'Your move, duelist!', actions } }] }) });
  });

  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };

  console.log('Title screen & main menu');
  await page.goto(URL_BASE);
  await page.waitForSelector('.title-screen');
  check((await page.textContent('.ts-logo')).trim() === 'Duel Vault', 'the app opens on a title screen');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.title-screen', { state: 'detached' });
  check((await page.locator('.mm-item').count()) >= 6 && (await page.locator('[data-nav="home"].active').count()) === 1, 'pressing Start opens the main menu');
  check((await page.getAttribute('.mm-item.on', 'data-item')) === 'campus' && (await page.locator('.pv-campus .btn-primary').count()) === 1, 'Academy Campus is highlighted first');
  await page.keyboard.press('ArrowDown');
  check((await page.getAttribute('.mm-item.on', 'data-item')) === 'duel' && (await page.locator('.pv-duel .btn-primary').count()) === 1, 'arrow keys move through the menu (Free Duel shows today\'s rival)');
  await page.hover('.mm-item[data-item="search"]');
  await page.fill('.pv-search input', 'dark magician');
  await page.press('.pv-search input', 'Enter');
  await page.waitForFunction(() => location.hash.indexOf('#/search?q=dark') === 0);
  // Wait for the Card Search page itself, not just the address: the page renders on hashchange.
  await page.waitForSelector('[data-nav="search"].active');
  check((await page.inputValue('.search-input')) === 'dark magician', 'searching from the menu opens Card Search with the query');
  await page.focus('.search-input');
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => document.activeElement.classList.contains('search-input') === false && location.hash.indexOf('#/search') === 0), 'Esc in a text box only leaves the box');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => location.hash === '#/home');
  check(true, 'Esc goes back to the main menu');
  check((await page.textContent('#dp-badge')).trim() === '1,000 DP', 'you start with 1,000 Duel Points');

  console.log('Card Shop');
  await page.goto(URL_BASE + '#/shop');
  await page.waitForSelector('.pack-tile[data-set="Legend of Blue Eyes White Dragon"]');
  await page.click('.pack-tile[data-set="Legend of Blue Eyes White Dragon"]');
  await page.waitForSelector('.po-pack');
  check(true, 'buying a pack shows the pack');
  await page.click('.po-pack', { force: true });
  await page.waitForSelector('.po-cards:not([hidden]) .po-card');
  check((await page.locator('.po-card').count()) === 9, 'tearing it open deals 9 cards');
  await page.click('#po-all', { force: true });
  await page.waitForSelector('#po-done:not([hidden])');
  check((await page.locator('.po-card.flipped').count()) === 9, '"Reveal all" flips every card');
  await page.click('#po-done', { force: true });
  await page.waitForSelector('.pack-open', { state: 'detached' });
  check((await page.textContent('#dp-badge')).trim() === '800 DP', 'the pack cost 200 DP');
  await page.goto(URL_BASE + '#/shop?tab=binder');
  check((await page.locator('.binder-card').count()) >= 1, 'the cards are in your binder');
  console.log('Academy Campus');
  await page.goto(URL_BASE + '#/campus');
  await page.waitForSelector('.place');
  check((await page.locator('.place').count()) === 8, 'the campus map has 8 places');
  const spot = await page.evaluate(() => { const w = App.bonds.whereabouts(); return Object.keys(w).find((k) => w[k].length); });
  await page.click('.place[href="#/campus?at=' + spot + '"]');
  await page.waitForSelector('.npc');
  await page.click('.npc >> nth=0', { force: true });
  await page.waitForSelector('.vn-choice');
  check(/\S/.test(await page.textContent('.vn-text')), 'meeting a duelist opens a conversation');
  await page.click('.vn-choice:has-text("Talk")');
  await page.waitForSelector('.vn-choice:has-text("Tell me more")');
  await page.click('.vn-choice:has-text("Tell me more")');
  await page.waitForFunction(() => Object.values((JSON.parse(localStorage.getItem('dv-bonds') || '{}').people) || {}).some((x) => x.pts > 0));
  check(true, 'answering raises your friendship');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.vn', { state: 'detached' });
  check(true, 'Esc ends the conversation');
  await page.goto(URL_BASE + '#/help');
  check((await page.locator('.glossary dt').count()) >= 10 && (await page.locator('#help-duel .help-steps').count()) === 1, 'Help page explains duels and Yu-Gi-Oh! words');

  console.log('Search');
  await page.goto(URL_BASE + '#/search');
  await page.waitForSelector('.card-tile');
  check((await page.locator('#view .card-tile').count()) === cards.length, 'landing page lists newest cards');
  await shot('01-search');
  await page.fill('.search-input', 'ash');
  await page.waitForFunction(() => document.querySelectorAll('#view .card-tile').length === 2);
  check(true, 'typing "ash" narrows results to 2 cards');

  console.log('Card details');
  await page.click('.card-tile[data-card-id="14558127"]');
  await page.waitForSelector('#modal-title');
  const modalText = await page.textContent('#modal-body');
  check(/Hand Trap/.test(modalText), 'Ash Blossom is detected as a Hand Trap');
  check(/How to use it/.test(modalText) && /generic/i.test(modalText), 'usage tips + generic deck fit are shown');
  await shot('02-card-detail');
  await page.click('[data-new-deck]');
  await page.waitForSelector('.builder');
  check(/#\/deck\//.test(page.url()), 'starting a deck from a card opens the deck builder');
  check((await page.textContent('.zone-main .count')).trim() === '1', 'Ash Blossom is in the Main Deck');

  console.log('Deck builder');
  await page.waitForSelector('#builder-search [data-quick-add="9674034"]');
  for (let i = 0; i < 3; i++) await page.click('[data-quick-add="9674034"]');
  check((await page.textContent('.zone-main .count')).trim() === '4', '3 copies of Snake-Eye Ash added');
  await page.click('[data-quick-add="9674034"]');
  check(/maximum 3/.test(await page.textContent('#toast')), '4th copy is blocked');
  await page.click('[data-quick-add="48452496"]');
  await page.click('[data-quick-add="48452496"]');
  check(/maximum 1/.test(await page.textContent('#toast')), 'Limited card capped at 1');
  await page.click('[data-quick-add="55144522"]');
  check(/Forbidden/.test(await page.textContent('#toast')), 'Forbidden card cannot be added');
  await page.click('[data-quick-add="86066372"]');
  check((await page.textContent('.zone-extra .count')).trim() === '1', 'Link monster goes to the Extra Deck');
  await page.click('.zone-main .deck-slot[data-id="9674034"] [data-act="move"]');
  check((await page.textContent('.zone-side .count')).trim() === '1', 'card moved to Side Deck');
  const stats = await page.textContent('#deck-stats');
  check(/at least 40/.test(stats), 'deck check warns about deck size');
  check(/Opening hand odds/.test(stats) && /Starter/.test(stats), 'opening-hand odds table shown');
  await page.fill('#deck-name', 'Snake-Eye Test');
  await page.press('#deck-name', 'Enter');
  await shot('03-deck-builder');

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#deck-export')]);
  const ydk = fs.readFileSync(await download.path(), 'utf8');
  check(/#main\n14558127\n9674034\n9674034\n48452496\n#extra\n86066372\n!side\n9674034/.test(ydk), 'YDK export is correct');

  console.log('Excel export');
  const [xdl] = await Promise.all([page.waitForEvent('download'), page.click('#deck-excel')]);
  const exported = path.join(os.tmpdir(), 'dv-export-' + Date.now() + '.xlsx');
  await xdl.saveAs(exported);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(exported);
  const ws = wb.getWorksheet('Deck');
  check(ws.getCell('A1').value === 'Snake-Eye Test', 'Excel file has the deck name as title');
  const names = [];
  ws.eachRow((row, n) => { if (n > 4 && typeof row.getCell(2).value === 'number') names.push(row.getCell(2).value + 'x ' + row.getCell(3).text + ' [' + row.getCell(4).value + ']'); });
  check(names.join('|') === '1x Ash Blossom & Joyous Spring [Main]|2x Snake-Eye Ash [Main]|1x Snake-Eyes Poplar [Main]|1x Accesscode Talker [Extra]|1x Snake-Eye Ash [Side]', 'Excel rows list qty, name and section: ' + names.join(', '));
  check(ws.getImages().length === 5, 'card pictures are embedded in the sheet (' + ws.getImages().length + ')');
  check(/negate that effect/.test(ws.getRow(6).getCell(12).text), 'card effect text is included');

  console.log('Deck list + import');
  await page.goto(URL_BASE + '#/decks');
  await page.waitForSelector('.deck-card');
  check(/Snake-Eye Test/.test(await page.textContent('.deck-list')), 'deck appears in My Decks with new name');
  await page.click('#import-toggle');
  await page.fill('#import-name', 'Imported');
  await page.fill('#import-text', '#main\n46986414\n46986414\n10045474\n99999999\n#extra\n86066372\n!side\n');
  await page.click('#import-go');
  await page.waitForSelector('.builder');
  check((await page.textContent('.zone-main .count')).trim() === '3', 'imported deck has 3 main cards (unknown id skipped)');
  check((await page.textContent('.zone-extra .count')).trim() === '1', 'imported deck has 1 extra card');

  console.log('Excel import');
  const sheet = path.join(os.tmpdir(), 'dv-import-' + Date.now() + '.xlsx');
  const iwb = new ExcelJS.Workbook();
  const iws = iwb.addWorksheet('My list');
  iws.addRow(['Qty', 'Card Name', 'Section']);
  iws.addRow([3, 'ash blossom & joyous spring', 'Main']);
  iws.addRow([2, 'Dark Magician', '']);
  iws.addRow([1, 'Accesscode Talker', '']);
  iws.addRow([1, 'Infinite Impermanence', 'Side']);
  iws.addRow([2, 'Totally Fake Card', 'Main']);
  await iwb.xlsx.writeFile(sheet);
  await page.goto(URL_BASE + '#/decks');
  await page.click('#import-toggle');
  await page.setInputFiles('#import-file', sheet);
  await page.fill('#import-name', 'From Excel');
  await page.click('#import-go');
  await page.waitForSelector('.builder');
  check((await page.textContent('.zone-main .count')).trim() === '5', 'Excel import: 5 Main Deck cards (name matching ignores case)');
  check((await page.textContent('.zone-extra .count')).trim() === '1', 'Excel import: Extra Deck monster placed automatically');
  check((await page.textContent('.zone-side .count')).trim() === '1', 'Excel import: Side Deck section respected');
  check(/Totally Fake Card/.test(await page.inputValue('#deck-notes')), 'unknown card names are listed in the deck notes');

  await page.goto(URL_BASE + '#/decks');
  await page.click('#import-toggle');
  await page.setInputFiles('#import-file', exported);
  await page.click('#import-go');
  await page.waitForSelector('.builder');
  const rt = ['main', 'extra', 'side'].map(async (z) => (await page.textContent('.zone-' + z + ' .count')).trim());
  check((await Promise.all(rt)).join('/') === '4/1/1', 'exported Excel file re-imports to the same deck');
  check((await page.inputValue('#deck-name')) === 'Snake-Eye Test', 're-imported deck keeps its name');

  const csv = path.join(os.tmpdir(), 'dv-import-' + Date.now() + '.csv');
  fs.writeFileSync(csv, 'Main Deck\n3x Dark Magician\n"Ash Blossom & Joyous Spring",2\nSide Deck\n1 Infinite Impermanence\n');
  await page.goto(URL_BASE + '#/decks');
  await page.click('#import-toggle');
  await page.setInputFiles('#import-file', csv);
  await page.click('#import-go');
  await page.waitForSelector('.builder');
  const cz = ['main', 'side'].map(async (z) => (await page.textContent('.zone-' + z + ' .count')).trim());
  check((await Promise.all(cz)).join('/') === '5/1', 'CSV without headers ("3x Name" lines, section rows) imports correctly');

  console.log('Releases');
  await page.goto(URL_BASE + '#/releases');
  await page.click('[data-tab="upcoming"]');
  await page.waitForSelector('.set-row');
  check(/Mystic Future Booster/.test(await page.textContent('.set-list')), 'upcoming tab shows future set');
  await page.click('[data-tab="recent"]');
  const recent = await page.textContent('.set-list');
  check(/Rage of the Abyss/.test(recent) && /Mega Tin/.test(recent) && !/Legend of Blue Eyes/.test(recent), 'recent tab shows only the last 90 days');
  await page.click('[data-cat="Tins & Collections"]');
  check((await page.locator('.set-row').count()) === 1, 'category filter works');
  await page.click('[data-cat="All"]');
  await page.click('.set-row:has-text("Rage of the Abyss") [data-watch]');
  await page.click('[data-tab="watch"]');
  check((await page.locator('.set-row').count()) === 1, 'starred set appears in the watchlist');
  await shot('04-releases');
  await page.click('.set-link');
  await page.waitForSelector('#set-body .card-tile');
  check(/Snake-Eye/.test(await page.textContent('#set-body')), 'set page lists cards and archetypes');
  await page.click('[data-tab], .back').catch(() => {});
  await page.goto(URL_BASE + '#/releases');
  await page.click('[data-tab="cards"]');
  await page.waitForSelector('#rel-body .card-tile');
  check((await page.locator('#rel-body .card-tile').count()) === 1, 'New cards tab lists recently released cards');

  console.log('Archetype');
  await page.goto(URL_BASE + '#/archetype/Snake-Eye');
  await page.waitForSelector('#arch-body .card-tile');
  const arch = await page.textContent('#arch-body');
  check(/Likely starters/.test(arch) && /Snake-Eye Ash/.test(arch), 'archetype page highlights starters');
  await shot('05-archetype');

  console.log('Auto-build & draw tester');
  await page.goto(URL_BASE + '#/build?a=lunalight');
  await page.waitForSelector('#ab-result .pick', { timeout: 15000 });
  const ab = await page.textContent('#ab-result');
  check(/Lunalight \(auto-built\)/.test(ab) && /Lunalight Yellow Marten/.test(ab), 'typing "lunalight" auto-builds a Lunalight deck with its starter');
  check(/Ash Blossom/.test(ab) && /Staple/.test(ab) && /Lunalight Cat Dancer/.test(ab), 'it adds staples and the Fusion monster to the Extra Deck');
  await shot('07-autobuild');
  await page.click('[data-save="test"]');
  await page.waitForSelector('#dt-hand .hand-card');
  check((await page.locator('#dt-hand .hand-card').count()) === 5, 'draw tester deals a 5-card opening hand');
  check(/At least 1 starter/.test(await page.textContent('#dt-stats')), 'draw tester shows opening odds from 10,000 hands');
  await page.check('#dt-second');
  check((await page.locator('#dt-hand .hand-card').count()) === 6, 'going second deals 6 cards');
  await page.click('#dt-draw');
  check((await page.locator('#dt-hand .hand-card').count()) === 7, 'Draw 1 adds a card');
  await shot('08-drawtest');

  console.log('Duel vs bot');
  await page.evaluate(() => localStorage.setItem('dv-duel-speed', '0'));
  await page.click('a:has-text("Duel with this deck")');
  await page.waitForSelector('#duel-form');
  await page.selectOption('#duel-form [name=theirs]', '__mirror');
  await page.evaluate(() => { document.querySelector('.more-options').open = true; });
  await page.selectOption('#duel-form [name=first]', 'me');
  await page.check('#duel-form [name=ai][value=bot]');
  await page.click('#duel-form button[type=submit]');
  await page.waitForSelector('.board');
  check((await page.locator('.hand-row.mine .card-slot').count()) === 5 && (await page.locator('.hand-row.theirs .hand-back').count()) === 5, 'both players start with 5 cards; the opponent\'s hand is hidden');
  check(/Main Phase/.test(await page.locator('#duel-guide').innerText()), 'the board tells you what to do next');
  const bigUid = await page.evaluate(() => { const d = App.duelSession().duel; const c = d.players[0].hand.find((x) => d.kind(x) === 'monster' && d.tributesNeeded(x) > d.monsters(0).length); return c ? c.uid : null; });
  if (bigUid) {
    await page.click('[data-uid="' + bigUid + '"]');
    check(await page.locator('.menu-actions button:has-text("Tribute Summon")').first().isDisabled() && /Needs \d Tribute/.test(await page.locator('.why').innerText()), 'a monster that needs Tributes shows why it can\'t be summoned yet');
    await page.keyboard.press('Escape');
  }
  const toSummon = await page.evaluate(() => { const d = App.duelSession().duel; const c = d.players[0].hand.find((x) => d.kind(x) === 'monster' && !d.isExtra(x) && d.tributesNeeded(x) === 0); return c ? c.uid : null; });
  if (toSummon) {
    await page.click('[data-uid="' + toSummon + '"]');
    await page.click('.menu-actions button:has-text("Normal Summon")');
    if (await page.locator('[data-b]:has-text("Not now")').count()) await page.click('[data-b]:has-text("Not now")');
    check(await page.evaluate(() => App.duelSession().duel.monsters(0).length === 1), 'Normal Summon through the card menu');
  }
  await shot('09-duel-board');
  // Drag a monster from the hand onto a chosen Monster Zone.
  await page.evaluate(() => { const d = App.duelSession().duel; d.players[0].normalSummoned = false; });
  const dragUid = await page.evaluate(() => { const d = App.duelSession().duel; const c = d.players[0].hand.find((x) => d.kind(x) === 'monster' && !d.isExtra(x) && d.tributesNeeded(x) === 0); return c ? c.uid : null; });
  if (dragUid) {
    await page.dragAndDrop('[data-uid="' + dragUid + '"]', '.zones.mz [data-drop="mz"][data-index="4"]');
    await page.click('[data-b]:has-text("Normal Summon")');
    if (await page.locator('[data-b]:has-text("Not now"):visible').count()) await page.click('[data-b]:has-text("Not now")');
    check(await page.evaluate((u) => { const d = App.duelSession().duel; return d.players[0].mz[4] && d.players[0].mz[4].uid === u; }, dragUid), 'drag a card from the hand onto Monster Zone 5 to summon it there');
  }
  // Extra Deck summon: you choose the materials and the rules check them.
  await page.evaluate(() => {
    const d = App.duelSession().duel;
    const cat = d.players[0].extra.find((x) => /Cat Dancer/.test(x.name));
    const luna = d.players[0].deck.filter((x) => /^Lunalight/.test(x.name) && d.kind(x) === 'monster').slice(0, 2);
    luna.forEach((x) => { d.players[0].deck.splice(d.players[0].deck.indexOf(x), 1); d.players[0].hand.push(x); });
    window.__catUid = cat && cat.uid; window.__luna = luna.map((x) => x.uid);
    d.changed();
  });
  const catUid = await page.evaluate(() => window.__catUid);
  if (catUid) {
    await page.click('[data-pile="extra"][data-p="0"]');
    await page.click('.pick-card[data-pick="' + catUid + '"]');
    await page.click('.menu-actions button:has-text("Summon from the Extra Deck")');
    check(await page.locator('.pick-grid .pick-card.selected').count() === 0, 'materials are not pre-picked for you');
    const others = await page.evaluate(() => { const d = App.duelSession().duel; return d.players[0].hand.filter((x) => d.kind(x) === 'monster').concat(d.monsters(0).map((m) => m.card)).filter((x) => !/^Lunalight/.test(x.name)).map((x) => x.uid).slice(0, 2); });
    if (others.length) {
      await page.click('.pick-card[data-pick="' + others[0] + '"]');
      await page.click('[data-ok]');
      check(/don't fit/.test(await page.textContent('#modal-body')), 'wrong materials are caught with an explanation');
      await page.click('[data-b]:has-text("Choose again")');
    }
    const luna = await page.evaluate(() => window.__luna);
    for (const u of luna) await page.click('.pick-card[data-pick="' + u + '"]');
    await page.click('[data-ok]');
    if (await page.locator('[data-b]:has-text("Attack Position"):visible').count()) await page.click('[data-b]:has-text("Attack Position")');
    check(await page.evaluate(() => App.duelSession().duel.monsters(0).some((m) => /Cat Dancer/.test(m.card.name))), 'Fusion Summon with the materials you chose');
  }
  await page.click('#end-turn');
  // Let the bot play; answer any "respond to the attack?" prompt with No response.
  for (let i = 0; i < 100; i++) {
    const st = await page.evaluate(() => { const d = App.duelSession().duel; return { a: d.active, t: d.turn, w: d.winner }; });
    if ((st.a === 0 && st.t >= 3) || st.w != null) break;
    if (await page.locator('[data-extra]:has-text("No response"):visible').count()) await page.click('[data-extra]:has-text("No response")');
    await page.waitForTimeout(100);
  }
  const afterBot = await page.evaluate(() => { const d = App.duelSession().duel; return { a: d.active, t: d.turn, log: d.log.map((l) => l.text).join('\n') }; });
  check(afterBot.a === 0 && afterBot.t === 3 && /Turn 2: Bot/.test(afterBot.log), 'the bot plays its turn and passes back to you');
  check(/Bot (Normal Summons|Tribute Summons|Sets a monster|activates|Sets a card)/.test(afterBot.log), 'the bot made plays on its turn');
  const mine = await page.evaluate(() => { const d = App.duelSession().duel; const m = d.monsters(0).find((x) => x.card.faceUp && x.card.pos === 'atk'); return m ? m.card.uid : null; });
  if (mine) {
    await page.click('#to-battle');
    await page.click('[data-uid="' + mine + '"]');
    await page.click('.menu-actions button:has-text("Attack")');
    if (await page.locator('.pick-grid .pick-card').count()) await page.click('.pick-grid .pick-card >> nth=0');
    await page.waitForTimeout(300);
    check(/attacks/.test(await page.textContent('#duel-log')), 'attack through the card menu (battle is calculated)');
  }
  await shot('10-duel-after-bot');

  console.log('Famous duelists');
  await page.goto(URL_BASE + '#/duel');
  await page.waitForSelector('.char-tile');
  check((await page.locator('.char-tile[data-char="marik"]').count()) === 1 && (await page.locator('.char-tile[data-char="bakura"]').count()) === 1, 'Marik and Bakura are rivals');
  check((await page.locator('.char-tile').count()) >= 26 && (await page.locator('.char-tile[data-char="zarc"]').count()) === 1 && (await page.locator('.char-tile[data-char="ai"]').count()) === 1, 'the rival select offers every famous duelist, including Zarc and Ai');
  await page.click('[data-series="VRAINS"]');
  check(await page.isHidden('.char-tile[data-char="yugi"]') && await page.isVisible('.char-tile[data-char="ai"]'), 'series tabs filter the rivals');
  await page.click('[data-series="All"]');
  await page.click('.char-tile[data-char="yugi"]');
  check((await page.inputValue('#duel-form [name=theirs]')) === '__char:yugi' && (await page.textContent('.sl-name')) === 'Yugi Muto', 'clicking Yugi selects him and shows him in the spotlight');
  await page.evaluate(() => { document.querySelector('.more-options').open = true; });
  await page.selectOption('#duel-form [name=first]', 'opp');
  await page.check('#duel-form [name=ai][value=bot]');
  await page.click('#duel-form button[type=submit]');
  await page.waitForSelector('.board');
  for (let i = 0; i < 150; i++) {
    if (await page.evaluate(() => { const d = App.duelSession().duel; return d.active === 0 || d.winner != null; })) break;
    if (await page.locator('[data-extra]:has-text("No response"):visible').count()) await page.click('[data-extra]:has-text("No response")');
    await page.waitForTimeout(100);
  }
  const yl = await page.evaluate(() => { const d = App.duelSession().duel; return { name: d.players[1].name, deck: d.players[1].deckName, log: d.log.map((l) => l.text).join('\n') }; });
  check(yl.name === 'Yugi' && yl.deck === 'Yugi\'s Deck' && /Yugi Muto steps up/.test(yl.log) && /Turn 1: Yugi/.test(yl.log), 'duel against Yugi with his own deck (played by the bot)');

  console.log('Duel vs Claude (mocked API)');
  await page.goto(URL_BASE + '#/duel');
  await page.waitForSelector('#duel-form');
  await page.selectOption('#duel-form [name=theirs]', '__mirror');
  await page.evaluate(() => { document.querySelector('.more-options').open = true; });
  await page.selectOption('#duel-form [name=first]', 'opp');
  await page.check('#duel-form [name=ai][value=claude]');
  await page.fill('#duel-form [name=key]', 'sk-ant-test');
  await page.click('#duel-form button[type=submit]');
  await page.waitForSelector('.board');
  // Claude's plays open your response window when you could chain (e.g. a hand trap): answer "No response".
  for (let i = 0; i < 150; i++) {
    if (await page.evaluate(() => { const d = App.duelSession().duel; return d.active === 0 || d.winner != null; })) break;
    if (await page.locator('[data-extra]:has-text("No response"):visible').count()) await page.click('[data-extra]:has-text("No response")');
    await page.waitForTimeout(100);
  }
  const cl = await page.evaluate(() => { const d = App.duelSession().duel; return { log: d.log.map((l) => l.text).join('\n'), mons: d.monsters(1).length }; });
  check(claudeCalls.length >= 1 && claudeCalls[0].model === 'claude-opus-5-5' && claudeCalls[0].tools[0].name === 'take_actions', 'Claude opponent calls the API with the take_actions tool');
  check(/💬 Your move, duelist!/.test(cl.log) && cl.mons === 1, 'Claude\'s summon and comment show up on the board');
  await shot('11-duel-claude');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'duel board fits a phone screen (no sideways scroll)');
  await shot('12-duel-mobile');
  await page.setViewportSize({ width: 1360, height: 900 });

  console.log('Mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL_BASE + '#/search');
  await page.waitForSelector('.card-tile');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'no horizontal scroll at phone width');
  await shot('06-mobile');

  check(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
