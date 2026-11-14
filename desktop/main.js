/* Duel Vault desktop app (Electron).
   Wraps the same web app that runs on GitHub Pages, served from a private
   app:// address so saved decks survive updates, and adds an in-app updater. */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, protocol, net, ipcMain, shell, session, Menu } = require('electron');
const updater = require('./updater');

if (process.env.DUEL_VAULT_USER_DATA) app.setPath('userData', process.env.DUEL_VAULT_USER_DATA);

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

const APP_URL = 'app://duel-vault/index.html';
let win = null;
let web = null;          // { dir, version, source }
let lastCheck = null;    // result of the most recent update check

function bundledWebDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..');
}

function resolveWeb() {
  const dir = bundledWebDir();
  const version = updater.readVersion(dir) || app.getVersion();
  web = updater.activeWebRoot(dir, version, app.getPath('userData'));
}

function serveFile(request) {
  const url = new URL(request.url);
  let rel = decodeURIComponent(url.pathname);
  if (!rel || rel === '/') rel = '/index.html';
  const root = path.resolve(web.dir);
  const file = path.resolve(root, '.' + rel);
  if (file !== root && !file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString()).catch(() => new Response('Not found', { status: 404 }));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 420,
    minHeight: 500,
    title: 'Duel Vault',
    backgroundColor: '#0f1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  win.once('ready-to-show', () => win.show());

  // Links that open a new tab (YGOPRODeck, GitHub…) go to the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  win.loadURL(APP_URL);
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const checkItem = { label: 'Check for Updates…', click: () => win && win.webContents.send('dv:menu-check') };
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [{ role: 'about' }, checkItem, { type: 'separator' }, { role: 'services' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }]
    }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        ...(isMac ? [] : [checkItem]),
        { label: 'Duel Vault on GitHub', click: () => shell.openExternal('https://github.com/' + updater.REPO) },
        { label: 'All releases', click: () => shell.openExternal('https://github.com/' + updater.REPO + '/releases') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('dv:info', () => ({
  appVersion: app.getVersion(),
  webVersion: web.version,
  webSource: web.source,
  platform: process.platform
}));

ipcMain.handle('dv:check', async () => {
  lastCheck = await updater.checkForUpdate({ appVersion: app.getVersion(), webVersion: web.version });
  // Only hand the page what it needs to display; download URLs stay in this process.
  const { status, current, latest, notes, releaseUrl, minAppVersion } = lastCheck;
  return { status, current, latest, notes, releaseUrl, minAppVersion };
});

ipcMain.handle('dv:install', async (event) => {
  if (!lastCheck || lastCheck.status !== 'available') throw new Error('No update is ready to install. Check for updates first.');
  const version = await updater.installUpdate(lastCheck, app.getPath('userData'), {
    onProgress: (got, total) => event.sender.send('dv:progress', { got, total })
  });
  resolveWeb();
  lastCheck = null;
  return { version: version, active: web.version };
});

ipcMain.handle('dv:open', (e, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) return shell.openExternal(url);
  return null;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    resolveWeb();
    protocol.handle('app', serveFile);

    // Let the Excel export download card pictures (the image server sends no CORS header).
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['https://images.ygoprodeck.com/*'] }, (details, cb) => {
      const headers = Object.assign({}, details.responseHeaders);
      Object.keys(headers).forEach((k) => { if (k.toLowerCase() === 'access-control-allow-origin') delete headers[k]; });
      headers['Access-Control-Allow-Origin'] = ['*'];
      cb({ responseHeaders: headers });
    });

    buildMenu();
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
