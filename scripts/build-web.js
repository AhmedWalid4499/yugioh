/* Packages the web app for the desktop app and for in-app updates.
   Output (in dist/):
     web/                  the web app, bundled inside the Mac app
     duel-vault-web.zip    the same files, downloaded by the in-app updater
     update.json           { version, minAppVersion, sha256, notes }
     release-notes.md      text for the GitHub Release page */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WEB = path.join(DIST, 'web');
const pkg = require(path.join(ROOT, 'package.json'));
const version = pkg.version;
const minAppVersion = (pkg.duelVault && pkg.duelVault.minAppVersion) || version;

// The web app's own version must match package.json.
const versionJs = fs.readFileSync(path.join(ROOT, 'js', 'version.js'), 'utf8');
const m = /App\.VERSION\s*=\s*'([^']+)'/.exec(versionJs);
if (!m || m[1] !== version) {
  console.error(`js/version.js says ${m ? m[1] : '(missing)'} but package.json says ${version}. Update js/version.js.`);
  process.exit(1);
}

function notesFor(v) {
  try {
    const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    const start = log.indexOf('## ' + v);
    if (start === -1) return '';
    const rest = log.slice(start).split('\n').slice(1);
    const end = rest.findIndex((l) => /^## /.test(l));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  } catch (e) {
    return '';
  }
}

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dest, f));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(WEB, { recursive: true, force: true });
fs.mkdirSync(WEB, { recursive: true });
['index.html', 'css', 'js', 'vendor'].forEach((p) => copy(path.join(ROOT, p), path.join(WEB, p)));
fs.writeFileSync(path.join(WEB, 'version.json'), JSON.stringify({ version, minAppVersion }, null, 2) + '\n');

const zip = new AdmZip();
zip.addLocalFolder(WEB);
const zipPath = path.join(DIST, 'duel-vault-web.zip');
zip.writeZip(zipPath);
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');

const notes = notesFor(version);
fs.writeFileSync(path.join(DIST, 'update.json'), JSON.stringify({ version, minAppVersion, sha256, notes }, null, 2) + '\n');

fs.writeFileSync(path.join(DIST, 'release-notes.md'), [
  notes || 'Updates and improvements.',
  '',
  '### Download',
  '- **Apple Silicon Macs (M1/M2/M3/M4):** `Duel-Vault-' + version + '-arm64.dmg`',
  '- **Intel Macs:** `Duel-Vault-' + version + '-x64.dmg`',
  '',
  'Already have Duel Vault? Use **Check for updates** in the app instead.',
  'First time opening it? See [how to open the app](https://github.com/AhmedWalid4499/yugioh#-mac-app).',
  ''
].join('\n'));

console.log(`Built web app v${version} (min app ${minAppVersion}), sha256 ${sha256.slice(0, 12)}…`);
