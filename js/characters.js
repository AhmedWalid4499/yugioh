/* Character opponents: famous duelists from the anime, each with their
   archetypes and signature cards. Their decks are built live by the
   Auto-Builder, so they always use the newest support cards in the database
   ("modern" versions of their decks). */
(function (App) {
  'use strict';

  const CHARACTERS = [
    {
      id: 'yugi', name: 'Yugi Muto', short: 'Yugi', series: 'Duel Monsters', ace: 'Dark Magician',
      archetypes: ['Dark Magician', 'Magician Girl'],
      signature: ['Dark Magician', 'Dark Magician Girl', 'Dark Magical Circle', 'Eternal Soul', 'Illusion of Chaos', 'Magicians\' Souls', 'The Dark Magicians', 'Dark Magician the Dragon Knight'],
      style: 'Spellcasters built around Dark Magician and Dark Magician Girl.',
      persona: 'calm, kind and confident; trusts the heart of the cards'
    },
    {
      id: 'kaiba', name: 'Seto Kaiba', short: 'Kaiba', series: 'Duel Monsters', ace: 'Blue-Eyes White Dragon',
      archetypes: ['Blue-Eyes'],
      signature: ['Blue-Eyes White Dragon', 'The White Stone of Ancients', 'Sage with Eyes of Blue', 'Blue-Eyes Alternative White Dragon', 'Bingo Machine, Go!!!', 'Blue-Eyes Ultimate Dragon', 'Blue-Eyes Twin Burst Dragon'],
      style: 'Raw power: summon Blue-Eyes White Dragon fast and overwhelm the field.',
      persona: 'arrogant, competitive and proud of his dragons'
    },
    {
      id: 'joey', name: 'Joey Wheeler', short: 'Joey', series: 'Duel Monsters', ace: 'Red-Eyes Black Dragon',
      archetypes: ['Red-Eyes'],
      signature: ['Red-Eyes Black Dragon', 'Red-Eyes Fusion', 'Red-Eyes Insight', 'Red-Eyes Black Flare Dragon', 'Red-Eyes Slash Dragon', 'Red-Eyes Dark Dragoon'],
      style: 'Red-Eyes Black Dragon with gutsy, high-risk plays.',
      persona: 'loud, loyal and never gives up'
    },
    {
      id: 'mai', name: 'Mai Valentine', short: 'Mai', series: 'Duel Monsters', ace: 'Harpie Lady',
      archetypes: ['Harpie'],
      signature: ['Harpie Lady', 'Harpie Lady Sisters', 'Harpie\'s Pet Dragon', 'Elegant Egotist', 'Harpies\' Hunting Ground', 'Harpie\'s Feather Duster'],
      style: 'Harpie Ladies that sweep away Spells and Traps.',
      persona: 'confident, stylish and a little teasing'
    },
    {
      id: 'pegasus', name: 'Maximillion Pegasus', short: 'Pegasus', series: 'Duel Monsters', ace: 'Toon World',
      archetypes: ['Toon'],
      signature: ['Toon World', 'Toon Kingdom', 'Toon Dark Magician Girl', 'Toon Summoned Skull', 'Blue-Eyes Toon Dragon', 'Toon Cyber Dragon'],
      style: 'Toon monsters that attack directly from their cartoon world.',
      persona: 'theatrical, playful and fond of cartoons'
    },
    {
      id: 'jaden', name: 'Jaden Yuki', short: 'Jaden', series: 'GX', ace: 'Elemental HERO Neos',
      archetypes: ['Elemental HERO', 'Neo-Spacian', 'HERO'],
      signature: ['Elemental HERO Neos', 'Elemental HERO Stratos', 'Elemental HERO Shadow Mist', 'Polymerization', 'Miracle Fusion', 'Elemental HERO Flame Wingman', 'Elemental HERO Sunrise'],
      style: 'Elemental HEROes that Fusion Summon into powerful heroes.',
      persona: 'cheerful and laid-back; duels for the fun of it'
    },
    {
      id: 'zane', name: 'Zane Truesdale', short: 'Zane', series: 'GX', ace: 'Cyber End Dragon',
      archetypes: ['Cyber Dragon'],
      signature: ['Cyber Dragon', 'Cyber End Dragon', 'Power Bond', 'Cyber Dragon Infinity', 'Cyber Dragon Nova', 'Cyber Emergency'],
      style: 'Machine Fusions led by Cyber End Dragon.',
      persona: 'serious, respectful and intensely focused'
    },
    {
      id: 'aster', name: 'Aster Phoenix', short: 'Aster', series: 'GX', ace: 'Destiny HERO - Dystopia',
      archetypes: ['Destiny HERO'],
      signature: ['Destiny HERO - Malicious', 'Destiny HERO - Dystopia', 'Destiny HERO - Destroyer Phoenix Enforcer', 'Destiny Draw', 'Destiny HERO - Decider'],
      style: 'Destiny HEROes that control fate with draws and the GY.',
      persona: 'cool, professional and sure of his destiny'
    },
    {
      id: 'chazz', name: 'Chazz Princeton', short: 'Chazz', series: 'GX', ace: 'Armed Dragon LV7',
      archetypes: ['Armed Dragon', 'Ojama'],
      signature: ['Armed Dragon LV7', 'Armed Dragon LV5', 'Armed Dragon LV3', 'Ojama Yellow', 'Armed Dragon Thunder LV10'],
      style: 'Level-up Armed Dragons with a few Ojama surprises.',
      persona: 'boastful and dramatic, but secretly soft-hearted'
    },
    {
      id: 'yusei', name: 'Yusei Fudo', short: 'Yusei', series: '5D\'s', ace: 'Stardust Dragon',
      archetypes: ['Synchron', 'Junk', 'Stardust'],
      signature: ['Junk Synchron', 'Stardust Dragon', 'Junk Warrior', 'Quickdraw Synchron', 'Shooting Star Dragon', 'Junk Speeder', 'Doppelwarrior'],
      style: 'Synchro Summons: Synchron Tuners into Junk Warrior and Stardust Dragon.',
      persona: 'quiet, determined and believes in his friends'
    },
    {
      id: 'jack', name: 'Jack Atlas', short: 'Jack', series: '5D\'s', ace: 'Red Dragon Archfiend',
      archetypes: ['Resonator'],
      signature: ['Red Dragon Archfiend', 'Hot Red Dragon Archfiend', 'Scarlight Red Dragon Archfiend', 'Red Nova Dragon', 'Red Wyvern', 'Red Sprinter', 'Red Rising Dragon'],
      style: 'Resonators and Red Dragon Archfiend: power that crushes defenders.',
      persona: 'proud, bold and calls himself the king'
    },
    {
      id: 'crow', name: 'Crow Hogan', short: 'Crow', series: '5D\'s', ace: 'Black-Winged Dragon',
      archetypes: ['Blackwing'],
      signature: ['Blackwing - Gale the Whirlwind', 'Blackwing - Bora the Spear', 'Black-Winged Dragon', 'Blackwing Full Armor Master', 'Blackwing - Simoon the Poison Wind'],
      style: 'A swarm of Blackwings that Synchro Summon from the hand.',
      persona: 'street-smart, generous and quick with a joke'
    },
    {
      id: 'akiza', name: 'Akiza Izinski', short: 'Akiza', series: '5D\'s', ace: 'Black Rose Dragon',
      archetypes: ['Rose Dragon'],
      signature: ['Black Rose Dragon', 'Blue Rose Dragon', 'Ruddy Rose Dragon', 'White Rose Dragon', 'Black Rose Moonlight Dragon'],
      style: 'Plants and Rose Dragons with board-wiping Black Rose Dragon.',
      persona: 'cool and elegant, with a fierce side'
    },
    {
      id: 'yuma', name: 'Yuma Tsukumo', short: 'Yuma', series: 'ZEXAL', ace: 'Number 39: Utopia',
      archetypes: ['Utopia', 'Gagaga', 'Dododo', 'Gogogo'],
      signature: ['Number 39: Utopia', 'Gagaga Magician', 'Zubaba Knight', 'Number 39: Utopia Double', 'Number 39: Utopia Beyond', 'Gogogo Golem'],
      style: 'Rank 4 Xyz Summons into Number 39: Utopia.',
      persona: 'energetic and stubborn; never gives up on a duel'
    },
    {
      id: 'kite', name: 'Kite Tenjo', short: 'Kite', series: 'ZEXAL', ace: 'Galaxy-Eyes Photon Dragon',
      archetypes: ['Galaxy-Eyes', 'Photon', 'Galaxy'],
      signature: ['Galaxy-Eyes Photon Dragon', 'Photon Thrasher', 'Galaxy Soldier', 'Number 62: Galaxy-Eyes Prime Photon Dragon', 'Photon Orbital'],
      style: 'Photon monsters and Galaxy-Eyes Photon Dragon.',
      persona: 'cold, intense and fiercely protective'
    },
    {
      id: 'yuya', name: 'Yuya Sakaki', short: 'Yuya', series: 'ARC-V', ace: 'Odd-Eyes Pendulum Dragon',
      archetypes: ['Performapal', 'Odd-Eyes'],
      signature: ['Odd-Eyes Pendulum Dragon', 'Stargazer Magician', 'Timegazer Magician', 'Odd-Eyes Rebellion Dragon', 'Performapal Pendulum Sorcerer'],
      style: 'Pendulum Summons with Performapals and Odd-Eyes dragons.',
      persona: 'a showman who wants to make everyone smile'
    },
    {
      id: 'playmaker', name: 'Playmaker (Yusaku Fujiki)', short: 'Playmaker', series: 'VRAINS', ace: 'Decode Talker',
      archetypes: ['Code Talker', 'Cynet'],
      signature: ['Decode Talker', 'Encode Talker', 'Firewall Dragon', 'Cyberse Wizard', 'Code of Soul'],
      style: 'Cyberse Link Summons into Code Talkers.',
      persona: 'calm, analytical and few words'
    }
  ];

  let aces = null;
  /* Loads each character's ace card (for its picture). */
  function loadAces() {
    if (!aces) {
      aces = App.api.getCardsByNames(CHARACTERS.map((c) => c.ace)).then((found) => {
        App.decks.rememberMany(Object.keys(found).map((k) => found[k]));
        return found;
      }).catch(() => { aces = null; return {}; });
    }
    return aces;
  }

  function tiles(selectedId) {
    const esc = App.U.esc;
    return '<div class="char-grid">' + CHARACTERS.map((c) =>
      '<button type="button" class="char-tile' + (c.id === selectedId ? ' selected' : '') + '" data-char="' + c.id + '" title="' + esc(c.style) + '">' +
        '<span class="char-art" data-ace="' + esc(c.ace) + '"></span>' +
        '<span class="char-name">' + esc(c.name) + '</span>' +
        '<span class="char-sub">' + esc(c.series) + ' · ' + esc(c.archetypes[0]) + '</span>' +
      '</button>').join('') + '</div>';
  }

  /* Fills in the ace pictures once they load. */
  function paintArt(root) {
    loadAces().then((found) => {
      App.U.$$('.char-art[data-ace]', root).forEach((el) => {
        const card = found[App.api.normName(el.getAttribute('data-ace'))];
        const url = card && App.api.image(card, 'cropped');
        if (url) el.style.backgroundImage = 'url("' + url + '")';
      });
    });
  }

  App.characters = {
    tiles: tiles,
    paintArt: paintArt,
    list: () => CHARACTERS.slice(),
    get: (id) => CHARACTERS.find((c) => c.id === id) || null,
    /* Builds the character's deck for a format (live, newest support). */
    buildDeck: function (id, format) {
      const ch = this.get(id);
      if (!ch) return Promise.reject(new Error('Unknown character.'));
      return App.deckgen.build(ch.archetypes[0], {
        format: format, staples: true, archetypes: ch.archetypes, signature: ch.signature, name: ch.short + '\'s Deck'
      });
    }
  };
})(window.App);
