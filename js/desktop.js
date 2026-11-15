/* Desktop-only features (Mac app). Does nothing in a normal browser.
   Shows an update button in the top bar that checks GitHub Releases for a new
   version and installs it in one click. */
(function (App) {
  'use strict';

  const U = App.U;
  const esc = U.esc;
  const bridge = window.duelVault;
  const versionBox = document.getElementById('app-version');
  if (versionBox) versionBox.textContent = 'v' + App.VERSION;

  const slot = document.getElementById('app-update');
  if (!bridge || !slot) return;

  document.documentElement.classList.add('is-desktop');
  slot.hidden = false;

  let state = { status: 'idle' };
  let busy = false;

  function render() {
    let label = 'Check for updates';
    let cls = 'btn btn-small btn-ghost';
    let disabled = false;
    if (state.status === 'checking') { label = 'Checking…'; disabled = true; }
    else if (state.status === 'available') { label = '⬆ Update to v' + state.latest; cls = 'btn btn-small btn-primary pulse'; }
    else if (state.status === 'needs-new-app') { label = '⬆ New app v' + state.latest; cls = 'btn btn-small btn-primary pulse'; }
    else if (state.status === 'up-to-date-shown') { label = '✓ Up to date'; }
    else if (state.status === 'installing') { label = state.progress || 'Installing…'; disabled = true; }
    slot.innerHTML = '<button type="button" id="update-btn" class="' + cls + '"' + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  async function check(manual) {
    if (busy) return;
    busy = true;
    const before = state;
    state = { status: 'checking' };
    render();
    try {
      const res = await bridge.checkForUpdate();
      state = res;
      if (res.status === 'up-to-date') {
        if (manual) {
          state = { status: 'up-to-date-shown' };
          U.toast('You\'re on the latest version (v' + res.current + ').');
          setTimeout(() => { if (state.status === 'up-to-date-shown') { state = { status: 'idle' }; render(); } }, 4000);
        } else state = { status: 'idle' };
      } else if (manual) {
        showDetails();
      }
    } catch (e) {
      state = before.status === 'checking' ? { status: 'idle' } : before;
      if (manual) U.toast('Could not check for updates: ' + (e.message || e).toString().replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally {
      busy = false;
      render();
    }
  }

  function notesHtml(notes) {
    if (!notes) return '';
    return '<div class="panel"><h3>What\'s new</h3><p class="card-text">' + esc(notes).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p></div>';
  }

  function showDetails() {
    if (state.status === 'available') {
      App.C.openModal(
        '<div class="update-dialog">' +
          '<h2 id="modal-title">Update available: v' + esc(state.latest) + '</h2>' +
          '<p class="muted">You have v' + esc(state.current) + '. The update downloads in a few seconds; your decks and watchlist are kept.</p>' +
          notesHtml(state.notes) +
          '<div class="row"><button type="button" class="btn btn-primary" id="update-install">Install update</button>' +
          '<button type="button" class="btn" data-close>Later</button></div>' +
          '<p id="update-status" class="muted small"></p>' +
        '</div>');
      U.$('#update-install').addEventListener('click', install);
    } else if (state.status === 'needs-new-app') {
      App.C.openModal(
        '<div class="update-dialog">' +
          '<h2 id="modal-title">New app version: v' + esc(state.latest) + '</h2>' +
          '<p>This update changes the Mac app itself, so it needs a fresh download. Download the new <strong>.dmg</strong>, open it and drag Duel Vault into Applications to replace the old one. Your decks are kept.</p>' +
          notesHtml(state.notes) +
          '<div class="row"><button type="button" class="btn btn-primary" id="update-download">Open download page</button>' +
          '<button type="button" class="btn" data-close>Later</button></div>' +
        '</div>');
      U.$('#update-download').addEventListener('click', () => bridge.openExternal(state.releaseUrl));
    }
  }

  async function install() {
    const btn = U.$('#update-install');
    const status = U.$('#update-status');
    if (btn) btn.disabled = true;
    const latest = state.latest;
    state = { status: 'installing', progress: 'Downloading…' };
    render();
    const off = bridge.onProgress((p) => {
      const pct = p.total ? Math.round((p.got / p.total) * 100) + '%' : Math.round(p.got / 1024) + ' KB';
      state.progress = 'Downloading ' + pct;
      if (status) status.textContent = state.progress;
      render();
    });
    try {
      const res = await bridge.installUpdate();
      if (status) status.textContent = 'Installed v' + res.version + '. Restarting…';
      U.toast('Updated to v' + res.version + '.');
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      const msg = (e.message || String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      if (status) status.textContent = 'Update failed: ' + msg;
      if (btn) btn.disabled = false;
      state = { status: 'available', latest: latest };
      render();
    } finally {
      off();
    }
  }

  slot.addEventListener('click', (e) => {
    if (!e.target.closest('#update-btn')) return;
    if (state.status === 'available' || state.status === 'needs-new-app') showDetails();
    else check(true);
  });
  bridge.onMenuCheck(() => check(true));

  bridge.getInfo().then((info) => {
    if (versionBox) versionBox.textContent = 'v' + info.webVersion + (info.webVersion !== info.appVersion ? ' (app ' + info.appVersion + ')' : '');
  }).catch(() => {});

  render();
  setTimeout(() => check(false), 2500);
  setInterval(() => check(false), 6 * 3600 * 1000);
})(window.App);
