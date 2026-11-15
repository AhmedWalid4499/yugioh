/* Sound effects for duels.
   - Card handling, chimes and fanfares: CC0 samples from the uisfx library (vendor/sfx).
   - Game hits (attacks, explosions, damage, summon swells): synthesised live with ZzFX
     (vendor/zzfx, MIT). Mute and volume are remembered on this device. */
(function (App) {
  'use strict';

  const U = App.U;
  const KEY = 'dv-sound';
  const SAMPLES = ['draw', 'set', 'activate', 'summon', 'special', 'phase', 'turn', 'click', 'win', 'lose', 'invalid', 'move', 'gain'];

  /* ZzFX parameter lists (volume, randomness, frequency, attack, sustain, release, shape,
     shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
     bitCrush, delay, sustainVolume, decay, tremolo, filter). */
  const SYNTH = {
    attack: [1.1, 0.05, 260, 0.03, 0.04, 0.22, 4, 1.4, -18, 0, 0, 0, 0, 1.6, 0, 0, 0, 0.6, 0.06],
    hit: [1.6, 0.05, 90, 0.005, 0.04, 0.32, 2, 2.4, -6, 0, 0, 0, 0, 0.6, 0, 0.25, 0, 0.5, 0.05],
    explode: [2, 0.1, 70, 0.01, 0.12, 0.7, 4, 2.2, 0, 0, 0, 0, 0, 1.2, 0, 0.5, 0, 0.45, 0.2],
    damage: [1.2, 0.05, 330, 0.01, 0.08, 0.35, 1, 1.6, -8, 0, 0, 0, 0, 0.4, 0, 0.1, 0, 0.7, 0.05],
    shimmer: [0.6, 0, 660, 0.02, 0.25, 0.5, 0, 1.6, 0, 0, 330, 0.07, 0.11, 0, 0, 0, 0.08, 0.6, 0.1]
  };

  const state = Object.assign({ on: true, volume: 0.6 }, U.store.get(KEY, {}));
  const cache = {};
  let unlocked = false;

  function save() { U.store.set(KEY, { on: state.on, volume: state.volume }); }

  function sample(name, vol) {
    if (!state.on) return;
    try {
      const base = cache[name] || (cache[name] = new Audio('vendor/sfx/' + name + '.mp3'));
      const a = base.cloneNode();
      a.volume = Math.max(0, Math.min(1, state.volume * (vol == null ? 1 : vol)));
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* audio unavailable */ }
  }

  function synth(name, vol) {
    if (!state.on || typeof zzfx !== 'function') return;
    try {
      if (typeof zzfxX !== 'undefined' && zzfxX.state === 'suspended') zzfxX.resume();
      zzfxV = 0.3 * state.volume * (vol == null ? 1 : vol);
      zzfx.apply(null, SYNTH[name]);
    } catch (e) { /* audio unavailable */ }
  }

  /* Browsers only allow audio after the first click/tap. */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { if (typeof zzfxX !== 'undefined' && zzfxX.state === 'suspended') zzfxX.resume(); } catch (e) { /* ignore */ }
    SAMPLES.forEach((n) => { if (!cache[n]) { cache[n] = new Audio('vendor/sfx/' + n + '.mp3'); cache[n].preload = 'auto'; } });
  }
  document.addEventListener('pointerdown', unlock, { once: false, capture: true });
  document.addEventListener('keydown', unlock, { once: false, capture: true });

  /* Plays the sound for a duel event (see Duel.fx in duel/engine.js). */
  function play(type, data) {
    const d = data || {};
    switch (type) {
      case 'draw': sample('draw', 0.7); break;
      case 'set': sample('set'); break;
      case 'activate': sample('activate'); synth('shimmer', 0.5); break;
      case 'summon': sample('summon'); if (d.tribute) synth('shimmer', 0.8); break;
      case 'special': sample('special'); if (d.extra) synth('shimmer'); break;
      case 'attack': synth('attack'); break;
      case 'destroy': synth('explode', 0.8); break;
      case 'damage': synth(d.amount >= 2000 ? 'hit' : 'damage', d.amount >= 2000 ? 1 : 0.8); break;
      case 'gain': sample('gain', 0.7); break;
      case 'move': if (d.from !== 'hand') sample('move', 0.5); break;
      case 'phase': sample('phase', 0.6); break;
      case 'turn': sample('turn', 0.6); break;
      case 'win': sample('win'); break;
      case 'lose': sample('lose'); break;
      case 'invalid': sample('invalid', 0.6); break;
      case 'click': sample('click', 0.4); break;
      default: break;
    }
  }

  App.sound = {
    play: play,
    isOn: () => state.on,
    volume: () => state.volume,
    toggle() { state.on = !state.on; save(); if (state.on) { unlock(); sample('click'); } return state.on; },
    setVolume(v) { state.volume = Math.max(0, Math.min(1, Number(v) || 0)); save(); sample('click'); }
  };
})(window.App);
