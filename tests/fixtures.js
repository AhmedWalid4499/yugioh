/* Sample API data in the same shape YGOPRODeck returns, used by the smoke test. */
const img = (id) => ({
  id,
  image_url: `https://images.ygoprodeck.com/images/cards/${id}.jpg`,
  image_url_small: `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`,
  image_url_cropped: `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`
});

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const cards = [
  {
    id: 14558127, name: 'Ash Blossom & Joyous Spring', type: 'Tuner Monster', frameType: 'effect',
    typeline: ['Zombie', 'Tuner', 'Effect'],
    desc: 'When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect.\n●Add a card from the Deck to the hand.\n●Special Summon from the Deck.\n●Send a card from the Deck to the GY.\nYou can only use this effect of "Ash Blossom & Joyous Spring" once per turn.',
    atk: 0, def: 1800, level: 3, race: 'Zombie', attribute: 'FIRE',
    card_sets: [{ set_name: 'Maximum Crisis', set_code: 'MACR-EN036', set_rarity: 'Secret Rare' }],
    card_images: [img(14558127)],
    misc_info: [{ tcg_date: '2017-05-04', ocg_date: '2016-04-16', formats: ['TCG', 'OCG'] }]
  },
  {
    id: 9674034, name: 'Snake-Eye Ash', type: 'Effect Monster', frameType: 'effect',
    typeline: ['Pyro', 'Effect'], archetype: 'Snake-Eye',
    desc: 'If this card is Normal or Special Summoned: You can add 1 Level 1 FIRE monster from your Deck to your hand. You can target 1 card you control; send it to the GY, and if you do, Special Summon 1 "Snake-Eye" monster from your Deck. You can only use each effect of "Snake-Eye Ash" once per turn.',
    atk: 800, def: 1000, level: 1, race: 'Pyro', attribute: 'FIRE',
    card_sets: [{ set_name: 'Structure Deck: Fire Kings', set_code: 'SR14-EN001', set_rarity: 'Common' }, { set_name: 'Rage of the Abyss', set_code: 'ROTA-EN010', set_rarity: 'Ultra Rare' }],
    card_images: [img(9674034)],
    misc_info: [{ tcg_date: iso(-20) }]
  },
  {
    id: 48452496, name: 'Snake-Eyes Poplar', type: 'Effect Monster', frameType: 'effect',
    typeline: ['Plant', 'Effect'], archetype: 'Snake-Eye',
    desc: 'If this card is Normal or Special Summoned: You can add 1 "Snake-Eye" Spell/Trap from your Deck to your hand. You can only use this effect of "Snake-Eyes Poplar" once per turn.',
    atk: 1200, def: 1200, level: 1, race: 'Plant', attribute: 'FIRE',
    card_sets: [{ set_name: 'Rage of the Abyss', set_code: 'ROTA-EN011', set_rarity: 'Super Rare' }],
    card_images: [img(48452496)],
    banlist_info: { ban_tcg: 'Limited' }
  },
  {
    id: 86066372, name: 'Accesscode Talker', type: 'Link Monster', frameType: 'link',
    typeline: ['Cyberse', 'Link', 'Effect'],
    desc: '2+ Effect Monsters\nYour opponent cannot activate cards or effects in response to this card\'s effect activations. If this card is Link Summoned: You can target 1 Link Monster that was used as material for its Link Summon; this card gains ATK equal to that monster\'s Link Rating x 1000. You can banish 1 Link Monster from your field or GY; destroy 1 card your opponent controls.',
    atk: 2300, race: 'Cyberse', attribute: 'DARK', linkval: 4, linkmarkers: ['Top', 'Bottom-Left', 'Bottom', 'Bottom-Right'],
    card_sets: [{ set_name: 'Eternity Code', set_code: 'ETCO-EN046', set_rarity: 'Secret Rare' }],
    card_images: [img(86066372)]
  },
  {
    id: 10045474, name: 'Infinite Impermanence', type: 'Trap Card', frameType: 'trap', race: 'Normal',
    desc: 'Target 1 face-up monster your opponent controls; negate its effects (until the end of this turn), then, if this card was Set before activation and is on the field at resolution, for the rest of this turn all other Spell/Trap effects in this column are negated. If you control no cards, you can activate this card from your hand.',
    card_sets: [{ set_name: 'Flames of Destruction', set_code: 'FLOD-EN077', set_rarity: 'Secret Rare' }],
    card_images: [img(10045474)]
  },
  {
    id: 46986414, name: 'Dark Magician', type: 'Normal Monster', frameType: 'normal',
    typeline: ['Spellcaster', 'Normal'], archetype: 'Dark Magician',
    desc: 'The ultimate wizard in terms of attack and defense.',
    atk: 2500, def: 2100, level: 7, race: 'Spellcaster', attribute: 'DARK',
    card_sets: [{ set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-005', set_rarity: 'Ultra Rare' }],
    card_images: [img(46986414)]
  },
  {
    id: 55144522, name: 'Pot of Greed', type: 'Spell Card', frameType: 'spell', race: 'Normal',
    desc: 'Draw 2 cards.',
    banlist_info: { ban_tcg: 'Banned', ban_ocg: 'Banned', ban_goat: 'Limited' },
    card_sets: [{ set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-119', set_rarity: 'Rare' }],
    card_images: [img(55144522)]
  }
];

const lunalight = (id, name, extra) => Object.assign({ id, name, archetype: 'Lunalight', card_sets: [], card_images: [img(id)] }, extra);
cards.push(
  lunalight(48444114, 'Lunalight Yellow Marten', {
    type: 'Effect Monster', frameType: 'effect', race: 'Beast-Warrior', attribute: 'DARK', level: 4, atk: 1700, def: 1000, typeline: ['Beast-Warrior', 'Effect'],
    desc: 'If this card is Normal or Special Summoned: You can add 1 "Lunalight" monster from your Deck to your hand. You can only use this effect of "Lunalight Yellow Marten" once per turn.'
  }),
  lunalight(47705572, 'Lunalight Black Sheep', {
    type: 'Effect Monster', frameType: 'effect', race: 'Beast-Warrior', attribute: 'DARK', level: 2, atk: 100, def: 600, typeline: ['Beast-Warrior', 'Effect'],
    desc: 'You can discard this card; add 1 "Lunalight Fusion" from your Deck to your hand. You can only use this effect of "Lunalight Black Sheep" once per turn.'
  }),
  lunalight(50826232, 'Lunalight Purple Butterfly', {
    type: 'Effect Monster', frameType: 'effect', race: 'Beast-Warrior', attribute: 'DARK', level: 3, atk: 1000, def: 1000, typeline: ['Beast-Warrior', 'Effect'],
    desc: 'You can send this card from your hand to the GY; add 1 "Lunalight" Spell from your Deck to your hand.'
  }),
  lunalight(67144270, 'Lunalight Fusion', {
    type: 'Spell Card', frameType: 'spell', race: 'Normal',
    desc: 'Fusion Summon 1 "Lunalight" Fusion Monster from your Extra Deck, using monsters from your hand or field as material.'
  }),
  lunalight(51777272, 'Lunalight Cat Dancer', {
    type: 'Fusion Monster', frameType: 'fusion', race: 'Beast-Warrior', attribute: 'DARK', level: 7, atk: 2400, def: 2000, typeline: ['Beast-Warrior', 'Fusion', 'Effect'],
    desc: '2 "Lunalight" monsters\nMust first be Fusion Summoned. Cannot be destroyed by battle. You can Tribute 1 other "Lunalight" monster; this turn, this card can attack all monsters your opponent controls.'
  }),
  { id: 12580477, name: 'Raigeki', type: 'Spell Card', frameType: 'spell', race: 'Normal', desc: 'Destroy all monsters your opponent controls.', card_sets: [], card_images: [img(12580477)] },
  { id: 44095762, name: 'Mirror Force', type: 'Trap Card', frameType: 'trap', race: 'Normal', desc: 'When an opponent\'s monster declares an attack: Destroy all your opponent\'s Attack Position monsters.', card_sets: [], card_images: [img(44095762)] },
  { id: 83764718, name: 'Monster Reborn', type: 'Spell Card', frameType: 'spell', race: 'Normal', desc: 'Target 1 monster in either GY; Special Summon it.', banlist_info: { ban_tcg: 'Limited', ban_goat: 'Limited' }, card_sets: [], card_images: [img(83764718)] },
  { id: 69140098, name: 'Gemini Elf', type: 'Normal Monster', frameType: 'normal', race: 'Spellcaster', attribute: 'EARTH', level: 4, atk: 1900, def: 900, desc: 'Elf twins that alternate their attacks.', card_sets: [], card_images: [img(69140098)] },
  { id: 70781052, name: 'Summoned Skull', type: 'Normal Monster', frameType: 'normal', race: 'Fiend', attribute: 'DARK', level: 6, atk: 2500, def: 1200, desc: 'A fiend with dark powers for confusing the enemy.', card_sets: [], card_images: [img(70781052)] }
);

const sets = [
  { set_name: 'Rage of the Abyss', set_code: 'ROTA', num_of_cards: 101, tcg_date: iso(-20) },
  { set_name: 'Structure Deck: Fire Kings', set_code: 'SR14', num_of_cards: 46, tcg_date: iso(-400) },
  { set_name: 'Mystic Future Booster', set_code: 'MYFU', num_of_cards: 100, tcg_date: iso(30) },
  { set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB', num_of_cards: 126, tcg_date: '2002-03-08' },
  { set_name: '2026 Mega Tin', set_code: 'MP26', num_of_cards: 300, tcg_date: iso(-5) }
];

const archetypes = [{ archetype_name: 'Lunalight' }, { archetype_name: 'Snake-Eye' }, { archetype_name: 'Dark Magician' }, { archetype_name: 'Blue-Eyes' }];

module.exports = { cards, sets, archetypes };
