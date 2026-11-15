/* Checks summoning materials against an Extra Deck monster's requirement
   (its first line of text): Synchro Tuners and Levels, Xyz Levels and counts,
   Link Ratings, and Fusion material names. You always pick the materials;
   this only tells you whether the pick is legal. */
(function (App) {
  'use strict';

  const api = App.api;

  const requirement = (c) => String((c.data || c).desc || '').split('\n')[0].trim();
  const level = (m) => Number(m.data.level) || 0;
  const isTuner = (m) => /tuner/i.test(m.data.type || '');
  const isLink = (m) => /link/i.test(m.data.type || '');
  const isXyz = (m) => /xyz/i.test(m.data.type || '');
  const isEffect = (m) => api.kind(m.data) === 'monster' && !/^Normal/i.test(m.data.type || '') && !/Token/i.test(m.data.type || '');

  /* Does material m fit a requirement phrase like '"Junk Synchron"', 'DARK', 'Dragon', 'Effect', '"HERO"'? */
  function fits(m, phrase) {
    const p = String(phrase || '').trim();
    if (!p) return true;
    const quoted = /"([^"]+)"/.exec(p);
    if (quoted) {
      const q = quoted[1].toLowerCase();
      if (m.name.toLowerCase() !== q && m.name.toLowerCase().indexOf(q) === -1 && String(m.data.archetype || '').toLowerCase() !== q) return false;
    }
    const attr = /\b(DARK|LIGHT|EARTH|WATER|FIRE|WIND|DIVINE)\b/.exec(p);
    if (attr && m.data.attribute !== attr[1]) return false;
    if (/\bEffect\b/.test(p) && !isEffect(m)) return false;
    const race = /\b(Dragon|Spellcaster|Warrior|Machine|Fiend|Fairy|Zombie|Beast-Warrior|Beast|Winged Beast|Insect|Plant|Rock|Pyro|Aqua|Fish|Sea Serpent|Reptile|Thunder|Dinosaur|Psychic|Cyberse|Wyrm|Illusion)\b/.exec(p);
    if (race && !quoted && m.data.race !== race[1]) return false;
    const lv = /Level (\d+)( or (lower|higher|more|less))?/i.exec(p);
    if (lv) {
      const L = Number(lv[1]);
      if (/lower|less/i.test(lv[2] || '') ? level(m) > L : /higher|more/i.test(lv[2] || '') ? level(m) < L : level(m) !== L) return false;
    }
    return true;
  }

  function result(ok, message, unchecked) { return { ok: ok, message: message || '', unchecked: !!unchecked }; }

  function checkSynchro(target, mats, req) {
    const tuners = mats.filter(isTuner);
    const nonTuners = mats.filter((m) => !isTuner(m));
    const tm = /^(\d)\s+Tuners?/i.exec(req) || /^(\d)\s+[^+]*Tuner/i.exec(req);
    const needTuners = tm ? Number(tm[1]) : 1;
    if (tuners.length !== needTuners) return result(false, 'A Synchro Summon of ' + target.name + ' needs exactly ' + needTuners + ' Tuner' + (needTuners > 1 ? 's' : '') + ' (you picked ' + tuners.length + ').');
    const nm = /\+\s*(\d)(\+)?\s+non-Tuner/i.exec(req);
    const needNon = nm ? Number(nm[1]) : 1;
    if (nm && !nm[2] ? nonTuners.length !== needNon : nonTuners.length < needNon) return result(false, target.name + ' needs ' + (nm && !nm[2] ? 'exactly ' : 'at least ') + needNon + ' non-Tuner monster' + (needNon > 1 ? 's' : '') + '.');
    const sum = mats.reduce((s, m) => s + level(m), 0);
    const L = Number(target.data.level) || 0;
    if (sum !== L) return result(false, 'The materials\' Levels add up to ' + sum + ', but ' + target.name + ' is Level ' + L + '.');
    // Named or typed parts, e.g. '"Junk Synchron" + 1+ non-Tuner monsters' or '1 Tuner + 1+ non-Tuner DARK Dragon monsters'.
    const parts = req.split('+').map((x) => x.trim());
    const tunerPart = parts.find((x) => /tuner/i.test(x) && !/non-tuner/i.test(x)) || parts[0];
    if (/"/.test(tunerPart) && !tuners.some((t) => fits(t, tunerPart))) return result(false, 'The Tuner must be ' + tunerPart.replace(/^1\s+/, '') + '.');
    const nonPart = parts.find((x) => /non-tuner/i.test(x));
    if (nonPart) {
      const spec = nonPart.replace(/^\d\+?\s+/, '').replace(/non-Tuners?( monsters?)?/i, '').trim();
      if (spec && !nonTuners.every((m) => fits(m, spec))) return result(false, 'The non-Tuner materials must be ' + spec + ' monsters.');
    }
    return result(true);
  }

  function checkXyz(target, mats, req) {
    const m = /(\d)(\+)?\s+Level\s+(\d+)\s+([^,\n]*?)monsters?/i.exec(req);
    if (!m) {
      if (mats.length < 2) return result(false, 'An Xyz Summon needs at least 2 materials.');
      return result(true, 'Check the requirement yourself: ' + req, true);
    }
    const n = Number(m[1]);
    const L = Number(m[3]);
    if (m[2] ? mats.length < n : mats.length !== n) return result(false, target.name + ' needs ' + (m[2] ? 'at least ' : 'exactly ') + n + ' materials (you picked ' + mats.length + ').');
    const wrong = mats.filter((x) => isXyz(x) || isLink(x) || level(x) !== L);
    if (wrong.length) return result(false, 'Every material must be a Level ' + L + ' monster (' + wrong.map((x) => x.name).join(', ') + ' is not).');
    const spec = (m[4] || '').trim();
    if (spec && !mats.every((x) => fits(x, spec))) return result(false, 'The materials must be Level ' + L + ' ' + spec + ' monsters.');
    return result(true);
  }

  function checkLink(target, mats, req) {
    const rating = Number(target.data.linkval) || 0;
    const m = /^(\d)(\+)?\s+(.*?)monsters?/i.exec(req);
    if (m) {
      const n = Number(m[1]);
      if (m[2] ? mats.length < n : mats.length !== n) return result(false, target.name + ' needs ' + (m[2] ? 'at least ' : 'exactly ') + n + ' materials.');
      const spec = (m[3] || '').trim();
      if (spec && !mats.every((x) => fits(x, spec))) return result(false, 'The materials must be ' + spec + ' monsters.');
    }
    // Link Monsters can count as 1 material or as their Link Rating.
    const min = mats.length;
    const max = mats.reduce((s, x) => s + (isLink(x) ? Number(x.data.linkval) || 1 : 1), 0);
    if (rating < min || rating > max) return result(false, 'Link materials must add up to Link-' + rating + ' (yours can make ' + (min === max ? min : min + '–' + max) + ').');
    const named = (req.match(/"([^"]+)"/g) || []);
    if (named.length && !named.some((q) => mats.some((x) => fits(x, q)))) return result(false, 'The materials must include ' + named.join(' or ') + '.');
    return result(true);
  }

  /* Tries to assign the picked cards to the Fusion requirement; all must be used. */
  function checkFusion(target, mats, req) {
    const used = [];
    const take = (pred) => {
      const c = mats.find((x) => used.indexOf(x) === -1 && pred(x));
      if (c) used.push(c);
      return !!c;
    };
    const countSpec = /^(\d)(\+)?\s+(.*?)monsters?$/i.exec(req.replace(/\.$/, ''));
    if (countSpec && !/\+\s/.test(req.slice(countSpec[1].length + (countSpec[2] ? 1 : 0)))) {
      const n = Number(countSpec[1]);
      const spec = countSpec[3].trim();
      if (countSpec[2] ? mats.length < n : mats.length !== n) return result(false, target.name + ' needs ' + (countSpec[2] ? 'at least ' : 'exactly ') + n + ' materials.');
      if (spec && !mats.every((x) => fits(x, spec))) return result(false, 'Every material must be ' + spec + '.');
      return result(true);
    }
    const parts = req.split(/\s\+\s/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return result(mats.length >= 2, mats.length >= 2 ? 'Check the requirement yourself: ' + req : 'A Fusion Summon needs at least 2 materials.', true);
    let flexible = false;
    for (const part of parts) {
      const multi = /^(\d)(\+)?\s+(.*)$/.exec(part);
      const count = multi ? Number(multi[1]) : 1;
      if (multi && multi[2]) flexible = true;
      const spec = (multi ? multi[3] : part).replace(/monsters?$/i, '').trim();
      for (let i = 0; i < count; i++) {
        if (!take((x) => fits(x, spec))) return result(false, target.name + ' needs ' + part + '.');
      }
    }
    if (used.length !== mats.length && !flexible) return result(false, 'You picked ' + mats.length + ' materials but ' + target.name + ' uses ' + used.length + '.');
    return result(true);
  }

  /* Main entry: is this a legal set of materials for target? */
  function check(target, mats) {
    const t = target.data.type || '';
    const req = requirement(target);
    if (!mats.length) return result(false, 'Pick the materials first.');
    if (/synchro/i.test(t)) return checkSynchro(target, mats, req);
    if (/xyz/i.test(t)) return checkXyz(target, mats, req);
    if (/link/i.test(t)) return checkLink(target, mats, req);
    if (/fusion/i.test(t)) return checkFusion(target, mats, req);
    return result(true, '', true);
  }

  function summonKind(c) {
    const t = c.data.type || '';
    return /link/i.test(t) ? 'Link Summon' : /xyz/i.test(t) ? 'Xyz Summon' : /synchro/i.test(t) ? 'Synchro Summon' : /fusion/i.test(t) ? 'Fusion Summon' : /ritual/i.test(t) ? 'Ritual Summon' : 'Special Summon';
  }

  App.Materials = { check: check, requirement: requirement, fits: fits, summonKind: summonKind };
})(window.App);
