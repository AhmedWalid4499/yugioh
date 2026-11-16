/* Friendships with the duelists: hearts, rewards, your partner, where each
   duelist hangs out on campus today, and what they say. All dialogue here is
   original writing for this app. */
(function (App) {
  'use strict';

  const U = App.U;
  const KEY = 'dv-bonds';
  const PER_HEART = 20;

  /* How each duelist talks. */
  const TONE = {
    cheerful: ['jaden', 'joey', 'yuma', 'yuya', 'jesse', 'crow', 'ai', 'blueangel', 'goonizuka', 'syrus', 'yugo', 'soulburner'],
    cool: ['kaiba', 'zane', 'kite', 'jack', 'revolver', 'playmaker', 'alexis', 'aster', 'chazz', 'mai'],
    kind: ['yugi', 'yusei', 'akiza', 'yuto'],
    sinister: ['marik', 'bakura', 'yubel', 'yuri', 'zarc', 'pegasus']
  };
  const toneOf = (id) => Object.keys(TONE).find((t) => TONE[t].indexOf(id) !== -1) || 'kind';

  const T = {
    greet: {
      cheerful: [['Oh, hey! You\'re the new student, right?', 'Hi there! Want to hang out?'], ['Hey, buddy! Good to see you!', 'There you are! I was hoping you\'d come by.'], ['My best pal! What are we doing today?', 'Yes! You\'re here! Now it\'s a party.']],
      cool: [['...Do you need something?', 'Hmph. Make it quick.'], ['Oh. It\'s you. Fine, I have a minute.', 'You again. You\'re getting better, I hear.'], ['Good timing. I wanted to talk to you.', 'You\'re one of the few duelists worth my time.']],
      kind: [['Hello! I don\'t think we\'ve met properly.', 'Hi. Nice weather on the island today.'], ['Good to see you again.', 'Hey, how are your duels going?'], ['I always feel better when you\'re around.', 'There\'s my friend. How have you been?']],
      sinister: [['Well, well... a curious little duelist.', 'What brings you to me? How brave.'], ['You keep coming back. Interesting.', 'Ah, it\'s you. I was almost bored.'], ['My favourite plaything returns. Kidding... mostly.', 'You fascinate me. Don\'t let that go to your head.']]
    },
    small: [
      'The sunset from the lighthouse is the best thing on this island.',
      'I heard someone pulled a Secret Rare at the Card Shop this morning.',
      'Today\'s class was all about chains. Last in, first out — who knew?',
      'The cafeteria\'s lunch special is gone in five minutes every single day.',
      'I could duel from sunrise to sunset if they let me.',
      'Have you noticed how the sea looks different before a big duel?',
      'Somebody left a Spell Card in the library. I wonder whose it is.',
      'The harbor is quiet in the evening. Good place to think about your deck.'
    ],
    react: {
      cheerful: { good: ['Ha! You get it!', 'Right?! That\'s what I\'m talking about!'], ask: ['Ooh, you want to know more? Okay, listen up!', 'Sure thing! Here\'s the deal...'], meh: ['Aw, okay. No worries!', 'Huh. Tough crowd today!'] },
      cool: { good: ['...You\'re not as dull as I thought.', 'Hmph. At least you understand.'], ask: ['Fine. Pay attention, I won\'t repeat it.', 'You want advice? Listen carefully.'], meh: ['Whatever. Your loss.', 'Don\'t waste my time, then.'] },
      kind: { good: ['I\'m glad you think so!', 'That makes me happy to hear.'], ask: ['Of course. Here\'s something that helped me.', 'Sure, I\'m happy to share.'], meh: ['That\'s okay. Maybe another time.', 'No worries. We all have off days.'] },
      sinister: { good: ['Heh. Good answer.', 'You\'re learning to please me. Clever.'], ask: ['Curious, are we? Very well...', 'You want my secrets? Here\'s a taste.'], meh: ['How rude. I\'ll remember that.', 'Hmph. Your indifference is noted.'] }
    },
    tips: [
      'Count your hand traps: keep at least one for your opponent\'s turn.',
      'Set your Traps before you attack. You can\'t use them the turn you Set them.',
      'Don\'t Normal Summon right away. See what your Spells can do first.',
      'A monster in Defense Position doesn\'t lose you LP when it\'s attacked.',
      'Read your opponent\'s once-per-turn effects. If they\'ve used them, it\'s your window.',
      'Fusion, Synchro, Xyz, Link: your Extra Deck is a toolbox. Plan which one you need before you start your combo.',
      'Ash Blossom stops searches. Bait it out with a less important card first.',
      'Going second? Keep cards that break boards, like Dark Ruler No More or Lightning Storm.'
    ],
    gift: {
      love: ['Whoa, this is perfect for my deck! Thank you!', 'You remembered what I use? I love it!'],
      like: ['Oh, nice card! Thanks!', 'I can find a use for this. Thank you.'],
      ok: ['Huh, a gift? Thanks, I guess!', 'That\'s thoughtful of you.']
    },
    cheer: {
      cheerful: ['You\'ve got this!', 'Go, go, go!', 'Show them what you\'ve got!', 'That\'s my partner!'],
      cool: ['Don\'t let them push you around.', 'Finish it.', 'Not bad. Keep going.', 'Focus.'],
      kind: ['Believe in your deck.', 'I\'m right here with you.', 'Nice move!', 'Take your time.'],
      sinister: ['Make them suffer... nicely.', 'Heh. Delicious.', 'Crush them.', 'Don\'t disappoint me.']
    },
    already: ['We already talked today. Come back tomorrow!', 'I\'ve got to go soon. Let\'s talk again tomorrow.']
  };

  const pick = (arr, seed) => arr[Math.abs(seed == null ? Math.floor(Math.random() * 1e6) : seed) % arr.length];
  const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

  function all() { return U.store.get(KEY, { partner: null, people: {} }); }
  function save(b) { U.store.set(KEY, b); }
  function rec(b, id) { return b.people[id] || (b.people[id] = { pts: 0, talked: -1, gifted: -1, chatPts: 0, chatDay: -1, rewards: [], chat: [] }); }

  const hearts = (pts) => Math.min(5, Math.floor(pts / PER_HEART));

  /* Rewards for reaching each heart. Cards come from the duelist's own deck. */
  function rewardFor(id, level) {
    const c = App.characters.get(id);
    if (!c) return null;
    const sig = c.signature.filter((n) => n !== c.ace);
    if (level === 1) return { dp: 300, text: '300 DP' };
    if (level === 2) return { card: sig[0] || c.ace, text: 'a card from ' + c.short + '\'s deck' };
    if (level === 3) return { dp: 500, partner: true, text: '500 DP, and ' + c.short + ' can now be your partner' };
    if (level === 4) return { card: sig[1] || sig[0] || c.ace, text: 'another card from ' + c.short + '\'s deck' };
    return { card: c.ace, text: c.short + '\'s ace card, ' + c.ace };
  }

  /* Adds friendship points. Returns { before, after, newHearts: [levels], rewards: [{level, text}] }. */
  async function add(id, n) {
    const b = all();
    const r = rec(b, id);
    const before = hearts(r.pts);
    r.pts = Math.max(0, Math.min(5 * PER_HEART, r.pts + n));
    const after = hearts(r.pts);
    const levels = [];
    for (let l = before + 1; l <= after; l++) if (r.rewards.indexOf(l) === -1) { r.rewards.push(l); levels.push(l); }
    save(b);
    const given = [];
    for (const l of levels) {
      const rw = rewardFor(id, l);
      if (!rw) continue;
      if (rw.dp) App.profile.set({ dp: App.profile.dp() + rw.dp });
      if (rw.card && App.shop) {
        try {
          const found = await App.api.getCardsByNames([rw.card]);
          const card = found[App.api.normName(rw.card)];
          if (card) { App.decks.rememberMany([card]); App.shop.addToCollection([{ card: card, tier: 'ultra' }]); }
        } catch (e) { /* offline: the card can't be added now */ }
      }
      given.push({ level: l, text: rw.text });
    }
    return { before: before, after: after, rewards: given };
  }

  /* ---------- campus schedule ---------- */

  const PLACES = [
    { id: 'classroom', name: 'Classroom', icon: '📚', blurb: 'Lessons on chains, timing and card effects.', hue: '#8fb8ff' },
    { id: 'arena', name: 'Duel Arena', icon: '⚔', blurb: 'Where students settle their rivalries.', hue: '#ff9a8a' },
    { id: 'shop', name: 'Card Shop', icon: '🛒', blurb: 'Fresh boosters every morning.', hue: '#ffd36e' },
    { id: 'cafeteria', name: 'Cafeteria', icon: '🍙', blurb: 'The lunch special never lasts.', hue: '#ffc29a' },
    { id: 'harbor', name: 'Harbor', icon: '⚓', blurb: 'Ships, gulls and a quiet place to think.', hue: '#7fd1e8' },
    { id: 'lighthouse', name: 'Lighthouse', icon: '🗼', blurb: 'The best view of the sunset.', hue: '#c9a8ff' },
    { id: 'forest', name: 'Forest Path', icon: '🌲', blurb: 'Strange spirits are said to wander here.', hue: '#8fdc9e' },
    { id: 'dorms', name: 'Dorms', icon: '🏠', blurb: 'Home sweet home. Your partner often waits here.', hue: '#ffb0d0' }
  ];

  function slot() { const h = new Date().getHours(); return h < 12 ? 0 : h < 18 ? 1 : 2; }
  const SLOT_NAMES = ['Morning', 'Afternoon', 'Evening'];

  /* Who is where right now (changes each morning, afternoon and evening). */
  function whereabouts() {
    const ids = App.characters.list().map((c) => c.id);
    let seed = today() * 3 + slot();
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    const partner = all().partner;
    const out = {};
    PLACES.forEach((pl) => { out[pl.id] = []; });
    ids.forEach((id, i) => { if (id !== partner) out[PLACES[i % PLACES.length].id].push(id); });
    if (partner) out.dorms.unshift(partner);
    return out;
  }

  /* ---------- dialogue ---------- */

  function greet(id) {
    const r = rec(all(), id);
    const h = hearts(r.pts);
    return pick(T.greet[toneOf(id)][h >= 4 ? 2 : h >= 2 ? 1 : 0]);
  }

  /* A topic: returns { text, choices: [{ key, label }] }. */
  function topic(id) {
    const c = App.characters.get(id);
    const sig = c.signature.filter((n) => n !== c.ace);
    const options = [
      'My deck? ' + c.style + ' My ace is ' + c.ace + '.',
      'If I could open with one card, it\'d be ' + (pick(sig) || c.ace) + '.',
      pick(T.small),
      pick(T.small)
    ];
    return {
      text: pick(options),
      choices: [{ key: 'good', label: pick(['That sounds awesome!', 'I totally agree!', 'You\'re so cool!']) }, { key: 'ask', label: 'Tell me more! (ask for a tip)' }, { key: 'meh', label: pick(['Hmm, okay.', 'If you say so.']) }]
    };
  }

  /* Your answer to a topic. Returns { text, pts }. */
  function answer(id, key) {
    const tone = toneOf(id);
    const line = pick(T.react[tone][key]);
    if (key === 'ask') return { text: line + ' ' + pick(T.tips), pts: 5 };
    return { text: line, pts: key === 'good' ? 6 : 1 };
  }

  function talkedToday(id) { return rec(all(), id).talked === today(); }
  function markTalked(id) { const b = all(); rec(b, id).talked = today(); save(b); }
  function giftedToday(id) { return rec(all(), id).gifted === today(); }
  function markGifted(id) { const b = all(); rec(b, id).gifted = today(); save(b); }

  /* How much a duelist likes a card: 'love' (their deck), 'like' (same Attribute/Type as their ace) or 'ok'. */
  function giftTaste(id, card) {
    const c = App.characters.get(id);
    const name = String(card.name || '');
    if (c.signature.indexOf(name) !== -1 || c.archetypes.some((a) => name.indexOf(a) !== -1 || card.archetype === a)) return 'love';
    const ace = App.characters.aceData(id);
    if (ace && ((card.attribute && card.attribute === ace.attribute) || (card.race && card.race === ace.race))) return 'like';
    return 'ok';
  }
  const giftLine = (taste) => pick(T.gift[taste]);
  const giftPts = (taste) => (taste === 'love' ? 15 : taste === 'like' ? 8 : 3);

  function cheer(id) { return pick(T.cheer[toneOf(id)]); }

  /* Free chat via Claude: system prompt for the character. */
  function chatSystem(id) {
    const c = App.characters.get(id);
    const r = rec(all(), id);
    const h = hearts(r.pts);
    const you = App.profile.name() || 'the player';
    return 'You are ' + c.name + ' from Yu-Gi-Oh! ' + c.series + ', talking with a fellow student (' + you + ') on the academy island of Duel Vault, a fan-made Yu-Gi-Oh! companion app.\n' +
      'Personality: ' + c.persona + '.\nYour deck: ' + c.style + ' Your ace is ' + c.ace + '. Signature cards: ' + c.signature.join(', ') + '.\n' +
      'Friendship with ' + you + ': ' + h + ' of 5 hearts' + (h <= 1 ? ' (you barely know them)' : h <= 3 ? ' (you are friends)' : ' (you are close friends)') + (all().partner === id ? '. They chose you as their duel partner.' : '.') + '\n' +
      'Reply in character in 1 to 3 short sentences, in your own words. Do not quote lines from the anime. Keep it friendly and suitable for all ages. ' +
      'You can give real Yu-Gi-Oh! advice about cards, rules and deck building. If asked about something unrelated to Yu-Gi-Oh! or campus life, answer briefly and steer back.';
  }
  function chatLog(id) { return (rec(all(), id).chat || []).slice(-20); }
  function pushChat(id, role, content) {
    const b = all();
    const r = rec(b, id);
    r.chat = (r.chat || []).concat([{ role: role, content: String(content).slice(0, 1200) }]).slice(-20);
    let gained = 0;
    if (role === 'user') {
      if (r.chatDay !== today()) { r.chatDay = today(); r.chatPts = 0; }
      if (r.chatPts < 6) { r.chatPts += 2; gained = 2; }
    }
    save(b);
    return gained;
  }

  App.bonds = {
    PER_HEART: PER_HEART,
    get: (id) => rec(all(), id),
    hearts: (id) => hearts(rec(all(), id).pts),
    add: add,
    rewardFor: rewardFor,
    partner: () => all().partner,
    setPartner(id) { const b = all(); b.partner = id; save(b); },
    places: PLACES,
    slotName: () => SLOT_NAMES[slot()],
    whereabouts: whereabouts,
    greet: greet,
    topic: topic,
    answer: answer,
    talkedToday: talkedToday,
    markTalked: markTalked,
    alreadyLine: () => pick(T.already),
    giftedToday: giftedToday,
    markGifted: markGifted,
    giftTaste: giftTaste,
    giftLine: giftLine,
    giftPts: giftPts,
    cheer: cheer,
    chatSystem: chatSystem,
    chatLog: chatLog,
    pushChat: pushChat,
    tone: toneOf
  };
})(window.App);
