/* In-app updates for the Duel Vault desktop app.

   How it works:
   - Every GitHub Release of this repo carries three kinds of files:
       update.json           { version, minAppVersion, sha256, notes }
       duel-vault-web.zip    the web app (HTML/CSS/JS) for that version
       Duel-Vault-*.dmg      full Mac installers
   - "Check for updates" reads the latest release. If only the web app changed
     (the usual case), the zip is downloaded, its SHA-256 is verified, and it is
     unpacked into the app's data folder. One click, no reinstall.
   - If the release needs a newer desktop shell (minAppVersion is above this
     app's version), the user is sent to the release page to download the new
     installer instead.
   Plain Node (no Electron imports) so it can be unit-tested. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const REPO = 'AhmedWalid4499/yugioh';
const API = process.env.DUEL_VAULT_UPDATE_API || 'https://api.github.com';
const WEB_ZIP = 'duel-vault-web.zip';
const MANIFEST = 'update.json';

function compareVersions(a, b) {
  const pa = String(a || '0').replace(/^v/, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').replace(/^v/, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function readVersion(dir) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8'));
    return v && v.version ? String(v.version) : null;
  } catch (e) {
    return null;
  }
}

/* Which copy of the web app to run: a downloaded update if it is newer than
   the one bundled inside the app, otherwise the bundled one. */
function activeWebRoot(bundledDir, bundledVersion, userDataDir) {
  const current = path.join(userDataDir, 'web-current');
  const v = readVersion(current);
  if (v && fs.existsSync(path.join(current, 'index.html')) && compareVersions(v, bundledVersion) > 0) {
    return { dir: current, version: v, source: 'update' };
  }
  return { dir: bundledDir, version: bundledVersion, source: 'bundled' };
}

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DuelVault-Updater' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Update server replied with HTTP ' + res.status);
  return res.json();
}

/* Returns one of:
   { status: 'up-to-date', current, latest }
   { status: 'available', current, latest, notes, zipUrl, sha256, releaseUrl }
   { status: 'needs-new-app', current, latest, notes, releaseUrl, minAppVersion } */
async function checkForUpdate(opts) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const release = await getJson(API + '/repos/' + REPO + '/releases/latest', fetchImpl);
  if (!release) return { status: 'up-to-date', current: opts.webVersion, latest: opts.webVersion, noReleases: true };

  const assets = release.assets || [];
  const manifestAsset = assets.find((a) => a.name === MANIFEST);
  const zipAsset = assets.find((a) => a.name === WEB_ZIP);
  const tagVersion = String(release.tag_name || '').replace(/^v/, '');
  let manifest = { version: tagVersion };
  if (manifestAsset) {
    const res = await fetchImpl(manifestAsset.browser_download_url, { headers: { 'User-Agent': 'DuelVault-Updater' } });
    if (!res.ok) throw new Error('Could not read the update details (HTTP ' + res.status + ').');
    manifest = await res.json();
  }

  const latest = String(manifest.version || tagVersion);
  const base = {
    current: opts.webVersion,
    latest: latest,
    notes: manifest.notes || release.body || '',
    releaseUrl: release.html_url
  };
  if (compareVersions(latest, opts.webVersion) <= 0) return Object.assign({ status: 'up-to-date' }, base);
  if ((manifest.minAppVersion && compareVersions(manifest.minAppVersion, opts.appVersion) > 0) || !zipAsset) {
    return Object.assign({ status: 'needs-new-app', minAppVersion: manifest.minAppVersion || latest }, base);
  }
  return Object.assign({ status: 'available', zipUrl: zipAsset.browser_download_url, sha256: manifest.sha256 || null }, base);
}

function safeEntryName(name) {
  const n = name.replace(/\\/g, '/');
  return n && !n.startsWith('/') && !/^[a-zA-Z]:/.test(n) && n.split('/').indexOf('..') === -1;
}

/* Downloads, verifies and installs a web update. Returns the installed version. */
async function installUpdate(info, userDataDir, opts) {
  const options = opts || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const onProgress = options.onProgress || (() => {});

  const res = await fetchImpl(info.zipUrl, { headers: { 'User-Agent': 'DuelVault-Updater' } });
  if (!res.ok) throw new Error('Download failed (HTTP ' + res.status + ').');
  const total = Number(res.headers.get('content-length')) || 0;
  const chunks = [];
  let received = 0;
  if (res.body && res.body.getReader) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      received += value.length;
      onProgress(received, total);
    }
  } else {
    chunks.push(Buffer.from(await res.arrayBuffer()));
  }
  const buf = Buffer.concat(chunks);

  if (info.sha256) {
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    if (hash.toLowerCase() !== String(info.sha256).toLowerCase()) {
      throw new Error('The downloaded update is corrupted (checksum mismatch). Please try again.');
    }
  }

  const zip = new AdmZip(buf);
  const staging = path.join(userDataDir, 'web-staging');
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  for (const entry of zip.getEntries()) {
    if (!safeEntryName(entry.entryName)) throw new Error('The update contains an unsafe file path.');
    const target = path.join(staging, entry.entryName);
    if (entry.isDirectory) { fs.mkdirSync(target, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.getData());
  }

  const version = readVersion(staging);
  if (!fs.existsSync(path.join(staging, 'index.html')) || !version) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw new Error('The update is incomplete (missing index.html or version.json).');
  }
  if (info.latest && compareVersions(version, info.latest) !== 0) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw new Error('The update has version ' + version + ' but ' + info.latest + ' was expected.');
  }

  // Swap in the new version, keeping the previous one as a backup.
  const current = path.join(userDataDir, 'web-current');
  const previous = path.join(userDataDir, 'web-previous');
  fs.rmSync(previous, { recursive: true, force: true });
  if (fs.existsSync(current)) fs.renameSync(current, previous);
  fs.renameSync(staging, current);
  return version;
}

module.exports = { compareVersions, readVersion, activeWebRoot, checkForUpdate, installUpdate, REPO, WEB_ZIP, MANIFEST };
