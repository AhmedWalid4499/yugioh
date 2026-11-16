/* Character opponents: famous duelists from the anime, each with their
   archetypes and signature cards. Their decks are built live by the
   Auto-Builder, so they always use the newest support cards in the database
   ("modern" versions of their decks). */
(function (App) {
  'use strict';

  const CHARACTERS = [
    {
      id: 'yugi', color: '#8e44ad', name: 'Yugi Muto', short: 'Yugi', series: 'Duel Monsters', ace: 'Dark Magician',
      archetypes: ['Dark Magician', 'Magician Girl'],
      signature: ['Dark Magician', 'Dark Magician Girl', 'Dark Magical Circle', 'Eternal Soul', 'Illusion of Chaos', 'Magicians\' Souls', 'The Dark Magicians', 'Dark Magician the Dragon Knight'],
      style: 'Spellcasters built around Dark Magician and Dark Magician Girl.',
      persona: 'calm, kind and confident; trusts the heart of the cards'
    },
    {
      id: 'kaiba', color: '#3d8bfd', name: 'Seto Kaiba', short: 'Kaiba', series: 'Duel Monsters', ace: 'Blue-Eyes White Dragon',
      archetypes: ['Blue-Eyes'],
      signature: ['Blue-Eyes White Dragon', 'The White Stone of Ancients', 'Sage with Eyes of Blue', 'Blue-Eyes Alternative White Dragon', 'Bingo Machine, Go!!!', 'Blue-Eyes Ultimate Dragon', 'Blue-Eyes Twin Burst Dragon'],
      style: 'Raw power: summon Blue-Eyes White Dragon fast and overwhelm the field.',
      persona: 'arrogant, competitive and proud of his dragons'
    },
    {
      id: 'joey', color: '#e74c3c', name: 'Joey Wheeler', short: 'Joey', series: 'Duel Monsters', ace: 'Red-Eyes Black Dragon',
      archetypes: ['Red-Eyes'],
      signature: ['Red-Eyes Black Dragon', 'Red-Eyes Fusion', 'Red-Eyes Insight', 'Red-Eyes Black Flare Dragon', 'Red-Eyes Slash Dragon', 'Red-Eyes Dark Dragoon'],
      style: 'Red-Eyes Black Dragon with gutsy, high-risk plays.',
      persona: 'loud, loyal and never gives up'
    },
    {
      id: 'mai', color: '#e84393', name: 'Mai Valentine', short: 'Mai', series: 'Duel Monsters', ace: 'Harpie Lady',
      archetypes: ['Harpie'],
      signature: ['Harpie Lady', 'Harpie Lady Sisters', 'Harpie\'s Pet Dragon', 'Elegant Egotist', 'Harpies\' Hunting Ground', 'Harpie\'s Feather Duster'],
      style: 'Harpie Ladies that sweep away Spells and Traps.',
      persona: 'confident, stylish and a little teasing'
    },
    {
      id: 'pegasus', color: '#c0392b', name: 'Maximillion Pegasus', short: 'Pegasus', series: 'Duel Monsters', ace: 'Toon World',
      archetypes: ['Toon'],
      signature: ['Toon World', 'Toon Kingdom', 'Toon Dark Magician Girl', 'Toon Summoned Skull', 'Blue-Eyes Toon Dragon', 'Toon Cyber Dragon'],
      style: 'Toon monsters that attack directly from their cartoon world.',
      persona: 'theatrical, playful and fond of cartoons'
    },
    {
      id: 'marik', color: '#d4a017', name: 'Marik Ishtar', short: 'Marik', series: 'Duel Monsters', ace: 'The Winged Dragon of Ra',
      archetypes: ['Egyptian God'],
      signature: ['The Winged Dragon of Ra', 'The Winged Dragon of Ra - Sphere Mode', 'The Winged Dragon of Ra - Immortal Phoenix', 'Lava Golem', 'Revival Jam', 'Gil Garth', 'Mystical Beast of Serket', 'Ra\'s Disciple'],
      style: 'The Winged Dragon of Ra, backed by Lava Golem and Revival Jam.',
      persona: 'a menacing schemer who loves to see opponents squirm'
    },
    {
      id: 'bakura', color: '#6c3483', name: 'Yami Bakura', short: 'Bakura', series: 'Duel Monsters', ace: 'Dark Necrofear',
      archetypes: ['Spirit Message'],
      signature: ['Destiny Board', 'Spirit Message "I"', 'Spirit Message "N"', 'Spirit Message "A"', 'Spirit Message "L"', 'Dark Sanctuary', 'Dark Necrofear', 'Diabound Kernel', 'Man-Eater Bug'],
      style: 'Spells out doom with Destiny Board while Dark Necrofear haunts the field.',
      persona: 'a sinister spirit with a dark, mocking sense of humour'
    },
    {
      id: 'jaden', color: '#e74c3c', name: 'Jaden Yuki', short: 'Jaden', series: 'GX', ace: 'Elemental HERO Neos',
      archetypes: ['Elemental HERO', 'Neo-Spacian', 'HERO'],
      signature: ['Elemental HERO Neos', 'Elemental HERO Stratos', 'Elemental HERO Shadow Mist', 'Polymerization', 'Miracle Fusion', 'Elemental HERO Flame Wingman', 'Elemental HERO Sunrise'],
      style: 'Elemental HEROes that Fusion Summon into powerful heroes.',
      persona: 'cheerful and laid-back; duels for the fun of it'
    },
    {
      id: 'syrus', color: '#5dade2', name: 'Syrus Truesdale', short: 'Syrus', series: 'GX', ace: 'Super Vehicroid Jumbo Drill',
      archetypes: ['Roid'],
      signature: ['Super Vehicroid Jumbo Drill', 'Steamroid', 'Gyroid', 'Drillroid', 'Submarineroid', 'Expressroid', 'Super Vehicroid - Stealth Union', 'Power Bond', 'Vehicroid Connection Zone'],
      style: 'Vehicroid machines that fuse into Super Vehicroid Jumbo Drill.',
      persona: 'nervous at first but braver every duel; looks up to his big brother'
    },
    {
      id: 'alexis', color: '#f1948a', name: 'Alexis Rhodes', short: 'Alexis', series: 'GX', ace: 'Cyber Blader',
      archetypes: ['Cyber Angel'],
      signature: ['Cyber Blader', 'Cyber Tutu', 'Etoile Cyber', 'Blade Skater', 'Cyber Angel Benten', 'Cyber Angel Dakini', 'Machine Angel Ritual'],
      style: 'Graceful Cyber Girls and Ritual Cyber Angels led by Cyber Blader.',
      persona: 'cool, skilled and confident; the top duelist of her dorm'
    },
    {
      id: 'jesse', color: '#48c9b0', name: 'Jesse Anderson', short: 'Jesse', series: 'GX', ace: 'Rainbow Dragon',
      archetypes: ['Crystal Beast'],
      signature: ['Rainbow Dragon', 'Crystal Beast Ruby Carbuncle', 'Crystal Beast Sapphire Pegasus', 'Crystal Beast Amethyst Cat', 'Crystal Beacon', 'Rainbow Bridge', 'Rainbow Overdragon'],
      style: 'Seven Crystal Beasts that gather to call Rainbow Dragon.',
      persona: 'friendly, upbeat and close to his Crystal Beasts'
    },
    {
      id: 'yubel', color: '#8e44ad', name: 'Yubel', short: 'Yubel', series: 'GX', ace: 'Yubel',
      archetypes: ['Yubel'],
      signature: ['Yubel', 'Yubel - Terror Incarnate', 'Yubel - The Ultimate Nightmare', 'Spirit of Yubel', 'Nightmare Pain', 'Samsara D Lotus'],
      style: 'Yubel turns battle damage back on you, and grows stronger when destroyed.',
      persona: 'obsessive and unsettling, speaks of love and pain in the same breath'
    },
    {
      id: 'zane', color: '#95a5a6', name: 'Zane Truesdale', short: 'Zane', series: 'GX', ace: 'Cyber End Dragon',
      archetypes: ['Cyber Dragon'],
      signature: ['Cyber Dragon', 'Cyber End Dragon', 'Power Bond', 'Cyber Dragon Infinity', 'Cyber Dragon Nova', 'Cyber Emergency'],
      style: 'Machine Fusions led by Cyber End Dragon.',
      persona: 'serious, respectful and intensely focused'
    },
    {
      id: 'aster', color: '#7f8c8d', name: 'Aster Phoenix', short: 'Aster', series: 'GX', ace: 'Destiny HERO - Dystopia',
      archetypes: ['Destiny HERO'],
      signature: ['Destiny HERO - Malicious', 'Destiny HERO - Dystopia', 'Destiny HERO - Destroyer Phoenix Enforcer', 'Destiny Draw', 'Destiny HERO - Decider'],
      style: 'Destiny HEROes that control fate with draws and the GY.',
      persona: 'cool, professional and sure of his destiny'
    },
    {
      id: 'chazz', color: '#2c3e50', name: 'Chazz Princeton', short: 'Chazz', series: 'GX', ace: 'Armed Dragon LV7',
      archetypes: ['Armed Dragon', 'Ojama'],
      signature: ['Armed Dragon LV7', 'Armed Dragon LV5', 'Armed Dragon LV3', 'Ojama Yellow', 'Armed Dragon Thunder LV10'],
      style: 'Level-up Armed Dragons with a few Ojama surprises.',
      persona: 'boastful and dramatic, but secretly soft-hearted'
    },
    {
      id: 'yusei', color: '#2980b9', name: 'Yusei Fudo', short: 'Yusei', series: '5D\'s', ace: 'Stardust Dragon',
      archetypes: ['Synchron', 'Junk', 'Stardust'],
      signature: ['Junk Synchron', 'Stardust Dragon', 'Junk Warrior', 'Quickdraw Synchron', 'Shooting Star Dragon', 'Junk Speeder', 'Doppelwarrior'],
      style: 'Synchro Summons: Synchron Tuners into Junk Warrior and Stardust Dragon.',
      persona: 'quiet, determined and believes in his friends'
    },
    {
      id: 'jack', color: '#c0392b', name: 'Jack Atlas', short: 'Jack', series: '5D\'s', ace: 'Red Dragon Archfiend',
      archetypes: ['Resonator'],
      signature: ['Red Dragon Archfiend', 'Hot Red Dragon Archfiend', 'Scarlight Red Dragon Archfiend', 'Red Nova Dragon', 'Red Wyvern', 'Red Sprinter', 'Red Rising Dragon'],
      style: 'Resonators and Red Dragon Archfiend: power that crushes defenders.',
      persona: 'proud, bold and calls himself the king'
    },
    {
      id: 'crow', color: '#34495e', name: 'Crow Hogan', short: 'Crow', series: '5D\'s', ace: 'Black-Winged Dragon',
      archetypes: ['Blackwing'],
      signature: ['Blackwing - Gale the Whirlwind', 'Blackwing - Bora the Spear', 'Black-Winged Dragon', 'Blackwing Full Armor Master', 'Blackwing - Simoon the Poison Wind'],
      style: 'A swarm of Blackwings that Synchro Summon from the hand.',
      persona: 'street-smart, generous and quick with a joke'
    },
    {
      id: 'akiza', color: '#c0392b', name: 'Akiza Izinski', short: 'Akiza', series: '5D\'s', ace: 'Black Rose Dragon',
      archetypes: ['Rose Dragon'],
      signature: ['Black Rose Dragon', 'Blue Rose Dragon', 'Ruddy Rose Dragon', 'White Rose Dragon', 'Black Rose Moonlight Dragon'],
      style: 'Plants and Rose Dragons with board-wiping Black Rose Dragon.',
      persona: 'cool and elegant, with a fierce side'
    },
    {
      id: 'yuma', color: '#e67e22', name: 'Yuma Tsukumo', short: 'Yuma', series: 'ZEXAL', ace: 'Number 39: Utopia',
      archetypes: ['Utopia', 'Gagaga', 'Dododo', 'Gogogo'],
      signature: ['Number 39: Utopia', 'Gagaga Magician', 'Zubaba Knight', 'Number 39: Utopia Double', 'Number 39: Utopia Beyond', 'Gogogo Golem'],
      style: 'Rank 4 Xyz Summons into Number 39: Utopia.',
      persona: 'energetic and stubborn; never gives up on a duel'
    },
    {
      id: 'kite', color: '#2c82c9', name: 'Kite Tenjo', short: 'Kite', series: 'ZEXAL', ace: 'Galaxy-Eyes Photon Dragon',
      archetypes: ['Galaxy-Eyes', 'Photon', 'Galaxy'],
      signature: ['Galaxy-Eyes Photon Dragon', 'Photon Thrasher', 'Galaxy Soldier', 'Number 62: Galaxy-Eyes Prime Photon Dragon', 'Photon Orbital'],
      style: 'Photon monsters and Galaxy-Eyes Photon Dragon.',
      persona: 'cold, intense and fiercely protective'
    },
    {
      id: 'yuya', color: '#27ae60', name: 'Yuya Sakaki', short: 'Yuya', series: 'ARC-V', ace: 'Odd-Eyes Pendulum Dragon',
      archetypes: ['Performapal', 'Odd-Eyes'],
      signature: ['Odd-Eyes Pendulum Dragon', 'Stargazer Magician', 'Timegazer Magician', 'Odd-Eyes Rebellion Dragon', 'Performapal Pendulum Sorcerer'],
      style: 'Pendulum Summons with Performapals and Odd-Eyes dragons.',
      persona: 'a showman who wants to make everyone smile'
    },
    {
      id: 'yuto', color: '#6c5ce7', name: 'Yuto', short: 'Yuto', series: 'ARC-V', ace: 'Dark Rebellion Xyz Dragon',
      archetypes: ['Phantom Knights'],
      signature: ['Dark Rebellion Xyz Dragon', 'The Phantom Knights of Ancient Cloak', 'The Phantom Knights of Silent Boots', 'The Phantom Knights of Break Sword', 'Phantom Knights\' Fog Blade', 'Dark Requiem Xyz Dragon'],
      style: 'Phantom Knights that Xyz Summon into Dark Rebellion Xyz Dragon.',
      persona: 'a quiet resistance fighter who duels to protect his friends'
    },
    {
      id: 'yugo', color: '#00a8ff', name: 'Yugo', short: 'Yugo', series: 'ARC-V', ace: 'Clear Wing Synchro Dragon',
      archetypes: ['Speedroid', 'Clear Wing'],
      signature: ['Clear Wing Synchro Dragon', 'Speedroid Terrortop', 'Speedroid Taketomborg', 'Speedroid Den-Den Daiko Duke', 'Hi-Speedroid Chanbara', 'Crystal Wing Synchro Dragon', 'Clear Wing Fast Dragon'],
      style: 'Speedroids that race into Synchro Summons of Clear Wing Synchro Dragon.',
      persona: 'hot-headed, fast-talking and proud of his riding duels (and it\'s Yu-GO, not Yu-YA)'
    },
    {
      id: 'yuri', color: '#9b59b6', name: 'Yuri', short: 'Yuri', series: 'ARC-V', ace: 'Starving Venom Fusion Dragon',
      archetypes: ['Predaplant', 'Starving Venom'],
      signature: ['Starving Venom Fusion Dragon', 'Predaplant Ophrys Scorpio', 'Predaplant Chlamydosundew', 'Predaplant Verte Anaconda', 'Predaplast', 'Greedy Venom Fusion Dragon', 'Predaplant Dragostapelia'],
      style: 'Predaplants that Fusion Summon Starving Venom Fusion Dragon.',
      persona: 'polite on the surface, cruel and mocking underneath'
    },
    {
      id: 'zarc', color: '#b71540', name: 'Zarc', short: 'Zarc', series: 'ARC-V', ace: 'Supreme King Z-ARC',
      archetypes: ['Supreme King', 'Odd-Eyes'],
      signature: ['Supreme King Z-ARC', 'Supreme King Dragon Darkwurm', 'Supreme King Gate Zero', 'Supreme King Gate Infinity', 'Supreme King Dragon Odd-Eyes', 'Supreme King Dragon Starving Venom', 'Supreme King Dragon Clear Wing', 'Supreme King Dragon Dark Rebellion'],
      style: 'The Supreme King: Pendulum gates and the four dimension dragons, all leading to Z-ARC.',
      persona: 'the Supreme King Dragon; menacing, overwhelming and hungry for destruction'
    },
    {
      id: 'playmaker', color: '#1abc9c', name: 'Playmaker (Yusaku Fujiki)', short: 'Playmaker', series: 'VRAINS', ace: 'Decode Talker',
      archetypes: ['Code Talker', 'Cynet'],
      signature: ['Decode Talker', 'Encode Talker', 'Firewall Dragon', 'Cyberse Wizard', 'Code of Soul'],
      style: 'Cyberse Link Summons into Code Talkers.',
      persona: 'calm, analytical and few words'
    },
    {
      id: 'ai', color: '#8e44ad', name: 'Ai', short: 'Ai', series: 'VRAINS', ace: 'The Arrival Cyberse @Ignister',
      archetypes: ['@Ignister', 'A.I.'],
      signature: ['The Arrival Cyberse @Ignister', 'Dark Templar @Ignister', 'Wizard @Ignister', 'Achichi @Ignister', 'Hiyari @Ignister', 'Doshin @Ignister', 'A.I. Love Fusion'],
      style: '@Ignister Cyberse monsters that Link Summon The Arrival Cyberse @Ignister.',
      persona: 'the chatty, cheeky DARK Ignis who loves jokes and showing off'
    },
    {
      id: 'soulburner', color: '#e67e22', name: 'Soulburner (Takeru Homura)', short: 'Soulburner', series: 'VRAINS', ace: 'Salamangreat Heatleo',
      archetypes: ['Salamangreat'],
      signature: ['Salamangreat Heatleo', 'Salamangreat Gazelle', 'Salamangreat Circle', 'Salamangreat Foxer', 'Salamangreat Sunlight Wolf', 'Salamangreat Almiraj', 'Salamangreat Raging Phoenix'],
      style: 'Fiery Salamangreats that Link Summon and reincarnate their own Link Monsters.',
      persona: 'fiery, passionate and loyal to his partner Flame'
    },
    {
      id: 'revolver', color: '#7f8fa6', name: 'Revolver', short: 'Revolver', series: 'VRAINS', ace: 'Borreload Dragon',
      archetypes: ['Rokket', 'Borrel'],
      signature: ['Borreload Dragon', 'Absorouter Dragon', 'Quick Launch', 'Rokket Tracer', 'Rokket Recharger', 'Borrelsword Dragon', 'Borreload Savage Dragon'],
      style: 'Rokket Dragons that fire into Borrel Link Monsters.',
      persona: 'cold, precise leader of the Knights of Hanoi'
    },
    {
      id: 'blueangel', color: '#74b9ff', name: 'Blue Angel (Skye Zaizen)', short: 'Blue Angel', series: 'VRAINS', ace: 'Trickstar Holly Angel',
      archetypes: ['Trickstar'],
      signature: ['Trickstar Holly Angel', 'Trickstar Candina', 'Trickstar Lycoris', 'Trickstar Light Stage', 'Trickstar Reincarnation'],
      style: 'Trickstars that burn your LP every time you add cards to your hand.',
      persona: 'a cheerful idol duelist who is tougher than she looks'
    },
    {
      id: 'goonizuka', color: '#d35400', name: 'Go Onizuka', short: 'Go', series: 'VRAINS', ace: 'Gouki The Great Ogre',
      archetypes: ['Gouki'],
      signature: ['Gouki The Great Ogre', 'Gouki Twistcobra', 'Gouki Suprex', 'Gouki Headbatt', 'Gouki Re-Match', 'Gouki The Powerload Ogre'],
      style: 'Gouki wrestlers that tag in and Link Summon The Great Ogre.',
      persona: 'a charismatic pro wrestler of a duelist who plays to the crowd'
    }
  ];


  /* Original lines for the pre-duel cut-in and the results screen (not quotes from the show). */
  const LINES = {
    yugi: ['Let\'s see where the cards lead us. Ready?', 'A great duel. Your deck has a lot of heart.', 'Well played! You earned that win.'],
    kaiba: ['You dare challenge me? Fine. I\'ll make this quick.', 'As expected. Come back when you\'re worthy.', 'Hmph. A lucky draw. It won\'t happen twice.'],
    joey: ['Alright, let\'s roll! I\'m fired up!', 'Yeah! Did you see that comeback?!', 'Aw man... Rematch! Right now!'],
    mai: ['Try to keep up, sweetie.', 'Better luck next time, darling.', 'Not bad... I\'ll admit you surprised me.'],
    pegasus: ['Oh, how delightful! Shall we begin our little show?', 'What a charming performance — for me!', 'Oh my! That was not in my script at all.'],
    marik: ['Your soul trembles already. Let the punishment begin.', 'Ahaha! Kneel before the might of the gods!', 'Impossible... this cannot be!'],
    bakura: ['Let\'s play a little game, shall we? The stakes are... high.', 'Your fate was sealed the moment you sat down.', 'Tch. Enjoy it while it lasts.'],
    jaden: ['This is gonna be a blast! Let\'s duel!', 'That was so much fun! Let\'s go again sometime!', 'Whoa, you\'re good! That was awesome!'],
    syrus: ['I-I can do this! Let\'s duel!', 'I won? I actually won! Thanks for the duel!', 'Aww... I\'ll train harder, I promise.'],
    alexis: ['Show me what you\'ve got. I won\'t hold back.', 'Nice try. Keep practising and you\'ll get there.', 'Impressive. You really earned that one.'],
    jesse: ['Hey there, friend! Let\'s have a great duel!', 'Thanks for the duel! My Crystal Beasts had a blast.', 'Ha! You got me fair and square, partner!'],
    yubel: ['You\'ll feel every bit of the pain I give you... with love.', 'Such sweet suffering. Again?', 'This isn\'t over. Nothing is ever over.'],
    zane: ['Give me everything you have. Respect demands it.', 'You fought well. Never stop striving.', 'A worthy victory. I respect you.'],
    aster: ['Destiny already decided how this ends.', 'Just as fate foretold.', 'So you can change destiny after all.'],
    chazz: ['The great Chazz is here! Prepare to lose!', 'Ha! Chazz it up! Nobody beats me!', 'This... this was just a warm-up!'],
    yusei: ['Let\'s see how our decks connect.', 'Good duel. Our bonds made the difference.', 'You read every move. Well done.'],
    jack: ['There is only one king. Prove you can challenge him!', 'The king remains undefeated!', 'Hmph. Today the throne is yours.'],
    crow: ['Let\'s fly! Don\'t blink or you\'ll miss it!', 'Ha! Too fast for ya!', 'Grounded... nice moves, though!'],
    akiza: ['Don\'t underestimate my roses. They have thorns.', 'Every rose blooms in the end.', 'You really are strong. Thank you.'],
    yuma: ['Let\'s feel the flow! I\'m not giving up, ever!', 'Kattobingu! We did it!', 'I lost... but I\'m not giving up!'],
    kite: ['I have no time to waste. Let\'s finish this.', 'Exactly as calculated.', 'Hmph. You surpassed my calculations.'],
    yuya: ['Ladies and gentlemen, welcome to the show!', 'And that\'s the finale! Did everyone smile?', 'You stole the show... I\'ll bring a better act!'],
    yuto: ['I fight to protect what matters. Get ready.', 'This is for my friends.', 'You fought with conviction. I can respect that.'],
    yugo: ['Clear the road! I\'m going full speed!', 'Nobody outruns me!', 'Hey, that was a cheap shot! Rematch!'],
    yuri: ['Oh, a new specimen for my collection.', 'How delightful. You\'ll make a lovely card.', 'How rude. I wasn\'t done playing.'],
    zarc: ['Every dimension will bow. You first.', 'Destruction is the only ending.', 'Impossible... I am supreme!'],
    playmaker: ['Let\'s get this over with.', 'Calculation complete.', 'You were the better duelist today.'],
    ai: ['Ooh, a challenger! Try not to cry when I win, okay?', 'Ta-da! Who\'s the best? Me!', 'Wait, what? That wasn\'t supposed to happen!'],
    soulburner: ['Feel the burn! My soul is on fire!', 'Burned to a crisp!', 'Ugh, my fire went out... next time!'],
    revolver: ['I will end this quickly and precisely.', 'Target eliminated.', 'A miscalculation. It will not happen again.'],
    blueangel: ['Ready for a show? Smile for the crowd!', 'Thanks for watching, everyone!', 'Aww, I lost... but it was fun!'],
    goonizuka: ['Ladies and gentlemen, the champion enters the ring!', 'And the crowd goes wild!', 'You got me in the final round...']
  };

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

  /* ---------- portraits ----------
     Official character artwork is copyrighted, so by default each duelist is shown
     with an emblem of their ace card in their colour. You can set your own picture
     for any duelist (and for yourself); it is resized and kept on this device only. */
  const PKEY = 'dv-portrait:';
  function portrait(id) { return App.U.store.get(PKEY + id, null); }

  function setPortrait(id, file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Choose an image file.')); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 192;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 3, w, h);
          const url = canvas.toDataURL('image/jpeg', 0.85);
          if (!App.U.store.set(PKEY + id, url)) { reject(new Error('Could not save the picture (storage is full).')); return; }
          resolve(url);
        };
        img.onerror = () => reject(new Error('That image could not be read.'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('That file could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  function clearPortrait(id) { App.U.store.remove(PKEY + id); }

  /* A round portrait: your picture if set, else the ace-card emblem. */
  function avatar(id, cls) {
    const esc = App.U.esc;
    const c = CHARACTERS.find((x) => x.id === id);
    const custom = portrait(id);
    const color = c ? c.color : '#e3b341';
    if (custom) return '<span class="avatar ' + (cls || '') + '" style="--ring:' + color + ';background-image:url(\'' + custom + '\')"></span>';
    if (!c) return '<span class="avatar avatar-you ' + (cls || '') + '" style="--ring:' + color + '">' + (id === 'you' ? '★' : '?') + '</span>';
    return '<span class="avatar ' + (cls || '') + '" data-ace="' + esc(c.ace) + '" style="--ring:' + color + '"></span>';
  }

  function tiles(selectedId) {
    const esc = App.U.esc;
    return '<div class="char-grid">' + CHARACTERS.map((c) => {
      const custom = portrait(c.id);
      return '<div class="char-tile-wrap"><button type="button" class="char-tile' + (c.id === selectedId ? ' selected' : '') + '" data-char="' + c.id + '" title="' + esc(c.style) + '" style="--ring:' + c.color + '">' +
        '<span class="char-art"' + (custom ? ' style="background-image:url(\'' + custom + '\')"' : ' data-ace="' + esc(c.ace) + '"') + '></span>' +
        '<span class="char-name">' + esc(c.name) + '</span>' +
        '<span class="char-sub">' + esc(c.series) + ' · ' + esc(c.archetypes[0]) + '</span>' +
      '</button>' +
      '<label class="char-photo" title="Use your own picture for ' + esc(c.short) + '">📷<input type="file" accept="image/*" data-portrait="' + c.id + '" hidden></label>' +
      (custom ? '<button type="button" class="char-photo-clear" data-portrait-clear="' + c.id + '" title="Back to the ace-card emblem">✕</button>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  /* Hooks the 📷 buttons inside root; onChange re-renders. */
  function wirePortraits(root, onChange) {
    root.addEventListener('change', (e) => {
      const input = e.target.closest && e.target.closest('[data-portrait]');
      if (!input || !input.files || !input.files[0]) return;
      setPortrait(input.getAttribute('data-portrait'), input.files[0])
        .then(() => { App.U.toast('Picture saved on this device.'); if (onChange) onChange(); })
        .catch((err) => App.U.toast(err.message));
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-portrait-clear]');
      if (!b) return;
      e.stopPropagation();
      clearPortrait(b.getAttribute('data-portrait-clear'));
      if (onChange) onChange();
    });
  }

  /* Fills in the ace pictures once they load. */
  function paintArt(root) {
    loadAces().then((found) => {
      App.U.$$('.char-art[data-ace], .avatar[data-ace]', root).forEach((el) => {
        const card = found[App.api.normName(el.getAttribute('data-ace'))];
        const url = card && App.api.image(card, 'cropped');
        if (url) el.style.backgroundImage = 'url("' + url + '")';
      });
    });
  }

  App.characters = {
    tiles: tiles,
    paintArt: paintArt,
    avatar: avatar,
    portrait: portrait,
    setPortrait: setPortrait,
    clearPortrait: clearPortrait,
    wirePortraits: wirePortraits,
    list: () => CHARACTERS.slice(),
    get: (id) => CHARACTERS.find((c) => c.id === id) || null,
    /* kind: 'intro' | 'win' (they won) | 'lose' (they lost) */
    line: (id, kind) => { const l = LINES[id]; return l ? l[{ intro: 0, win: 1, lose: 2 }[kind] || 0] : ''; },
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
