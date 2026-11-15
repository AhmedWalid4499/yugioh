/* Unit tests for desktop/updater.js against a fake GitHub Releases server.
   Run: node tests/updater.test.js */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.log('  ✗ ' + msg); }
}

function makeZip(version, extra) {
  const zip = new AdmZip();
  zip.addFile('index.html', Buffer.from('<!doctype html><title>v' + version + '</title>'));
  zip.addFile('js/version.js', Buffer.from("window.App={VERSION:'" + version + "'}"));
  zip.addFile('version.json', Buffer.from(JSON.stringify({ version })));
  if (extra) extra(zip);
  return zip.toBuffer();
}

(async () => {
  const state = { release: null, zip: null, manifest: null };
  const server = http.createServer((req, res) => {
    if (req.url === '/repos/AhmedWalid4499/yugioh/releases/latest') {
      if (!state.release) { res.writeHead(404); return res.end('{}'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(state.release));
    }
    if (req.url === '/dl/update.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(state.manifest)); }
    if (req.url === '/dl/duel-vault-web.zip') { res.writeHead(200, { 'content-length': state.zip.length }); return res.end(state.zip); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  process.env.DUEL_VAULT_UPDATE_API = base;
  const U = require('../desktop/updater');

  function publish(version, opts) {
    const o = opts || {};
    state.zip = o.zip || makeZip(version);
    state.manifest = {
      version,
      minAppVersion: o.minAppVersion || '1.1.0',
      sha256: o.sha256 || crypto.createHash('sha256').update(state.zip).digest('hex'),
      notes: 'Notes for ' + version
    };
    state.release = {
      tag_name: 'v' + version,
      html_url: 'https://github.com/AhmedWalid4499/yugioh/releases/tag/v' + version,
      assets: [
        { name: 'update.json', browser_download_url: base + '/dl/update.json' },
        { name: 'duel-vault-web.zip', browser_download_url: base + '/dl/duel-vault-web.zip' }
      ]
    };
  }

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-updater-'));
  const bundled = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-bundled-'));
  fs.writeFileSync(path.join(bundled, 'index.html'), 'bundled');

  console.log('Versions');
  check(U.compareVersions('1.2.0', '1.1.9') === 1, '1.2.0 > 1.1.9');
  check(U.compareVersions('v1.10.0', '1.9.0') === 1, '1.10.0 > 1.9.0 (numeric, not text)');
  check(U.compareVersions('1.1', '1.1.0') === 0, '1.1 == 1.1.0');
  check(U.activeWebRoot(bundled, '1.1.0', userData).source === 'bundled', 'uses the bundled web app when nothing is downloaded');

  console.log('Checking');
  let r = await U.checkForUpdate({ appVersion: '1.1.0', webVersion: '1.1.0' });
  check(r.status === 'up-to-date' && r.noReleases, 'no releases yet → up to date');
  publish('1.1.0');
  r = await U.checkForUpdate({ appVersion: '1.1.0', webVersion: '1.1.0' });
  check(r.status === 'up-to-date', 'same version → up to date');
  publish('1.2.0');
  r = await U.checkForUpdate({ appVersion: '1.1.0', webVersion: '1.1.0' });
  check(r.status === 'available' && r.latest === '1.2.0' && r.notes === 'Notes for 1.2.0', 'newer release → update available with notes');

  console.log('Installing');
  let progressCalls = 0;
  const installed = await U.installUpdate(r, userData, { onProgress: () => progressCalls++ });
  check(installed === '1.2.0', 'installs v1.2.0');
  check(progressCalls > 0, 'reports download progress');
  let active = U.activeWebRoot(bundled, '1.1.0', userData);
  check(active.source === 'update' && active.version === '1.2.0', 'downloaded version becomes active');
  check(fs.readFileSync(path.join(active.dir, 'index.html'), 'utf8').includes('v1.2.0'), 'files were unpacked');
  check(U.activeWebRoot(bundled, '1.3.0', userData).source === 'bundled', 'a newer bundled app (fresh install) wins over an older download');

  publish('1.3.0', { sha256: 'deadbeef' });
  r = await U.checkForUpdate({ appVersion: '1.1.0', webVersion: '1.2.0' });
  let err = null;
  try { await U.installUpdate(r, userData); } catch (e) { err = e; }
  check(err && /checksum/.test(err.message), 'corrupted download is rejected');
  check(U.activeWebRoot(bundled, '1.1.0', userData).version === '1.2.0', 'failed update leaves the current version working');

  publish('1.3.0', { zip: makeZip('1.3.0', (z) => z.addFile('../../evil.txt', Buffer.from('x'))) });
  r = await U.checkForUpdate({ appVersion: '1.1.0', webVersion: '1.2.0' });
  err = null;
  try { await U.installUpdate(r, userData); } catch (e) { err = e; }
  const escaped = fs.existsSync(path.join(userData, '..', 'evil.txt')) || fs.existsSync(path.join(path.dirname(userData), '..', 'evil.txt'));
  check(!escaped && (err ? /unsafe/.test(err.message) : true), 'zip entries cannot write outside the app folder');

  publish('1.3.0', { zip: makeZip('1.2.5') });
  r = await U.checkForUpdate({ appVersion: '1.1.0', webVersion: '1.2.0' });
  err = null;
  try { await U.installUpdate(r, userData); } catch (e) { err = e; }
  check(err && /expected/.test(err.message), 'zip with the wrong version is rejected');

  publish('2.0.0', { minAppVersion: '2.0.0' });
  r = await U.checkForUpdate({ appVersion: '1.1.0', webVersion: '1.2.0' });
  check(r.status === 'needs-new-app' && /releases\/tag\/v2.0.0/.test(r.releaseUrl), 'release needing a newer app → asks to download the new installer');

  server.close();
  fs.rmSync(userData, { recursive: true, force: true });
  fs.rmSync(bundled, { recursive: true, force: true });
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll updater checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
