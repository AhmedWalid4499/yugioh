/* Game formats ("rulings") you can pick for a deck, the draw tester and duels. */
(function (App) {
  'use strict';

  const FORMATS = {
    tcg: {
      key: 'tcg', label: 'TCG Advanced', short: 'TCG',
      description: 'Current Master Rule with the TCG banlist.',
      banKey: 'ban_tcg', legalTag: 'TCG',
      lp: 8000, hand: 5, firstPlayerDraws: false,
      main: [40, 60], extra: 15, side: 15,
      monsterZones: 5, spellZones: 5, extraMonsterZones: 2,
      allowed: { link: true, pendulum: true, xyz: true, synchro: true, fusion: true, ritual: true, skill: false }
    },
    ocg: {
      key: 'ocg', label: 'OCG', short: 'OCG',
      description: 'Current Master Rule with the Japanese/Asian (OCG) banlist.',
      banKey: 'ban_ocg', legalTag: 'OCG',
      lp: 8000, hand: 5, firstPlayerDraws: false,
      main: [40, 60], extra: 15, side: 15,
      monsterZones: 5, spellZones: 5, extraMonsterZones: 2,
      allowed: { link: true, pendulum: true, xyz: true, synchro: true, fusion: true, ritual: true, skill: false }
    },
    speed: {
      key: 'speed', label: 'Speed Duel', short: 'Speed',
      description: '3 monster zones, 4000 LP, 4-card hands, 20–30 card decks, one Skill card.',
      banKey: null, legalTag: 'Speed Duel',
      lp: 4000, hand: 4, firstPlayerDraws: false,
      main: [20, 30], extra: 5, side: 5,
      monsterZones: 3, spellZones: 3, extraMonsterZones: 0,
      allowed: { link: false, pendulum: false, xyz: true, synchro: true, fusion: true, ritual: true, skill: true }
    },
    goat: {
      key: 'goat', label: 'Goat format', short: 'Goat',
      description: 'Classic April 2005 rules and banlist: the first player draws, no Synchro/Xyz/Pendulum/Link.',
      banKey: 'ban_goat', legalTag: 'GOAT',
      lp: 8000, hand: 5, firstPlayerDraws: true,
      main: [40, 60], extra: 15, side: 15,
      monsterZones: 5, spellZones: 5, extraMonsterZones: 0,
      allowed: { link: false, pendulum: false, xyz: false, synchro: false, fusion: true, ritual: true, skill: false }
    }
  };

  const F = {};
  F.list = () => Object.keys(FORMATS).map((k) => FORMATS[k]);
  F.get = (key) => FORMATS[key] || FORMATS.tcg;

  F.options = function (selected) {
    return F.list().map((f) => '<option value="' + f.key + '"' + (f.key === (selected || 'tcg') ? ' selected' : '') + '>' + App.U.esc(f.label) + '</option>').join('');
  };

  /* Is this card's frame/type allowed at all in the format? */
  F.cardAllowed = function (card, key) {
    const f = F.get(key);
    const t = String((card && card.type) || '') + ' ' + String((card && card.frameType) || '');
    if (/link/i.test(t) && !f.allowed.link) return false;
    if (/pendulum/i.test(t) && !f.allowed.pendulum) return false;
    if (/xyz/i.test(t) && !f.allowed.xyz) return false;
    if (/synchro/i.test(t) && !f.allowed.synchro) return false;
    if (/skill/i.test(t) && !f.allowed.skill) return false;
    // If the API told us which formats the card is legal in, respect that too.
    const misc = card && card.misc_info && card.misc_info[0];
    if (misc && Array.isArray(misc.formats) && misc.formats.length && f.legalTag && (key === 'speed' || key === 'goat')) {
      if (misc.formats.indexOf(f.legalTag) === -1) return false;
    }
    return true;
  };

  /* Max copies in this format (banlist), 0 when not allowed at all. */
  F.copyLimit = function (card, key) {
    const f = F.get(key);
    if (!F.cardAllowed(card, key)) return 0;
    if (/skill/i.test(String(card && card.type))) return 1;
    if (!f.banKey) return 3;
    const ban = card && card.banlist_info && card.banlist_info[f.banKey];
    if (ban === 'Banned' || ban === 'Forbidden') return 0;
    if (ban === 'Limited') return 1;
    if (ban === 'Semi-Limited') return 2;
    return 3;
  };

  F.banStatus = function (card, key) {
    const f = F.get(key);
    if (!f.banKey) return '';
    return (card && card.banlist_info && card.banlist_info[f.banKey]) || '';
  };

  App.formats = F;
})(window.App);
