/* End-to-end test of the desktop app (Electron) and its one-click updater,
   against a fake GitHub Releases server and a mocked card API.
   Run: npm run build:web && npm run test:desktop
   (on Linux without a display: xvfb-run -a npm run test:desktop) */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { _electron: electron } = require('playwright');
const { cards, sets, archetypes } = require('./fixtures');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.SHOTS_DIR || null;
let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.log('  ✗ ' + msg); }
}

/* A "next version" of the web app, built from dist/web with a bumped version. */
function buildNextRelease(version) {
  const web = path.join(ROOT, 'dist', 'web');
  if (!fs.existsSync(web)) throw new Error('Run "npm run build:web" first.');
  const zip = new AdmZip();
  zip.addLocalFolder(web);
  zip.updateFile('version.json', Buffer.from(JSON.stringify({ version })));
  zip.updateFile('js/version.js', Buffer.from(fs.readFileSync(path.join(web, 'js', 'version.js'), 'utf8').replace(/VERSION = '[^']+'/, "VERSION = '" + version + "'")));
  return zip.toBuffer();
}

/* Answers card-API requests inside Electron's main process with test data. */
async function mockApis(app) {
  await app.evaluate(({ session, net }, data) => {
    session.defaultSession.protocol.handle('https', (req) => {
      const u = new URL(req.url);
      const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
      if (u.hostname === 'db.ygoprodeck.com') {
        const file = u.pathname.split('/').pop();
        const body = file === 'archetypes.php' ? data.archetypes : file === 'cardsets.php' ? data.sets : { data: data.cards, meta: { total_rows: data.cards.length } };
        return new Response(JSON.stringify(body), { status: 200, headers });
      }
      if (u.hostname === 'images.ygoprodeck.com') return new Response('', { status: 404 });
      return net.fetch(req, { bypassCustomProtocolHandlers: true });
    });
  }, { cards, sets, archetypes });
}

(async () => {
  const NEXT = '9.9.0';
  const zip = buildNextRelease(NEXT);
  const manifest = { version: NEXT, minAppVersion: '1.0.0', sha256: crypto.createHash('sha256').update(zip).digest('hex'), notes: 'Test release notes' };
  const server = http.createServer((req, res) => {
    if (req.url.endsWith('/releases/latest')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        tag_name: 'v' + NEXT, html_url: 'https://github.com/AhmedWalid4499/yugioh/releases/tag/v' + NEXT,
        assets: [
          { name: 'update.json', browser_download_url: base + '/dl/update.json' },
          { name: 'duel-vault-web.zip', browser_download_url: base + '/dl/duel-vault-web.zip' }
        ]
      }));
    }
    if (req.url === '/dl/update.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(manifest)); }
    if (req.url === '/dl/duel-vault-web.zip') { res.writeHead(200, { 'content-length': zip.length }); return res.end(zip); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-desktop-'));

  const app = await electron.launch({
    args: [ROOT, '--no-sandbox'],
    cwd: ROOT,
    env: Object.assign({}, process.env, { DUEL_VAULT_UPDATE_API: base, DUEL_VAULT_USER_DATA: userData })
  });
  const errors = [];
  const win = await app.firstWindow();
  await mockApis(app);
  await win.reload();
  win.on('pageerror', (e) => errors.push(e.message));

  console.log('Desktop app');
  await win.waitForSelector('.card-tile', { timeout: 20000 });
  check(/^app:\/\/duel-vault\//.test(win.url()), 'loads the web app from the private app:// address');
  check((await win.title()) === 'Duel Vault', 'window title is Duel Vault');
  check((await win.textContent('#app-version')).trim() === 'v1.1.0', 'footer shows the installed version (v1.1.0)');
  check(await win.isVisible('#app-update'), 'update button is shown in the desktop app');

  // Make a deck so we can confirm it survives the update.
  await win.click('a[data-nav="decks"]');
  await win.click('#new-deck');
  await win.waitForSelector('#deck-name');
  await win.fill('#deck-name', 'Keep Me');
  await win.press('#deck-name', 'Enter');

  console.log('Update');
  await win.waitForSelector('#update-btn:has-text("Update to v' + NEXT + '")', { timeout: 15000 });
  check(true, 'automatically finds the new release and shows "Update to v' + NEXT + '"');
  if (SHOTS) await win.screenshot({ path: path.join(SHOTS, 'desktop-update-available.png') });
  await win.click('#update-btn');
  await win.waitForSelector('#update-install');
  check(/Test release notes/.test(await win.textContent('#modal-body')), 'update dialog shows the release notes');
  if (SHOTS) await win.screenshot({ path: path.join(SHOTS, 'desktop-update-dialog.png') });
  await Promise.all([win.waitForEvent('load', { timeout: 20000 }), win.click('#update-install')]);
  await win.waitForFunction((v) => document.getElementById('app-version').textContent.indexOf(v) !== -1, NEXT, { timeout: 15000 });
  check(true, 'one click installs the update and reloads into v' + NEXT);
  check(fs.existsSync(path.join(userData, 'web-current', 'version.json')), 'update is stored in the app data folder');

  await win.evaluate(() => { location.hash = '#/decks'; });
  await win.waitForSelector('.deck-list');
  check(/Keep Me/.test(await win.textContent('.deck-list')), 'saved decks are kept after updating');

  console.log('Up to date');
  await win.click('#update-btn');
  await win.waitForSelector('#update-btn:has-text("Up to date")', { timeout: 10000 });
  check(true, 'checking again reports "Up to date"');

  await app.close();

  console.log('Restart');
  const app2 = await electron.launch({ args: [ROOT, '--no-sandbox'], cwd: ROOT, env: Object.assign({}, process.env, { DUEL_VAULT_UPDATE_API: base, DUEL_VAULT_USER_DATA: userData }) });
  const win2 = await app2.firstWindow();
  await mockApis(app2);
  await win2.waitForFunction((v) => (document.getElementById('app-version') || {}).textContent && document.getElementById('app-version').textContent.indexOf(v) !== -1, NEXT, { timeout: 15000 });
  check(true, 'the updated version is used after restarting the app');
  await app2.close();

  check(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  server.close();
  fs.rmSync(userData, { recursive: true, force: true });
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll desktop checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
