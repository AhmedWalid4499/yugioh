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

  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };

  console.log('Search');
  await page.goto(URL_BASE);
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
