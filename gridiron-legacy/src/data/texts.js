// Text messages with contextual replies. Each reply: { label, bond (this person), effects (anything
// applyEffects understands: mood, fame, health, money, train, rel), back (their answer) }.
// "who" decides which contact sends it: coach, family, partner, agent, rival, mate (a teammate).

export const TEXTS = {
  // ---------------- after games
  coach_great: {
    who: 'coach', text: ['Film session was fun today. You were the best player on the field.', 'That\'s the standard. Keep it there.', 'Proud of you. Rest up.'],
    replies: [
      { label: 'Thanks coach. Just doing my job.', bond: 3, back: 'That humility will take you far.' },
      { label: 'I want more. What should I work on?', bond: 4, effects: { train: { iq: 0.3 } }, back: 'Come in early tomorrow. We\'ll break down your footwork.' },
      { label: '😎', bond: -1, back: 'Don\'t let it go to your head.' },
    ],
  },
  coach_good: {
    who: 'coach', text: ['Solid game. Clean up the details and you\'re dangerous.', 'Good work. Film at 8.'],
    replies: [
      { label: 'I\'ll be there at 7:45.', bond: 3, back: 'Early is on time.' },
      { label: 'Which details?', bond: 2, effects: { train: { skill: 0.2 } }, back: 'Your second step. We\'ll show you.' },
    ],
  },
  coach_bad: {
    who: 'coach', text: ['We need more from you. My office, Monday.', 'Shake it off. Watch the tape, learn, move on.', 'That\'s not who you are. Bounce back.'],
    replies: [
      { label: 'My fault. It won\'t happen again.', bond: 3, effects: { mood: -1 }, back: 'That\'s what I want to hear.' },
      { label: 'The line didn\'t block for me.', bond: -4, effects: { rel: { teammates: -3 } }, back: 'We win and lose as a TEAM. Remember that.' },
      { label: 'Can we watch film together?', bond: 4, effects: { train: { iq: 0.4 } }, back: 'Door\'s open. Bring a notebook.' },
    ],
  },
  family_win: {
    who: 'family', text: ['WE WON!!! Your dad screamed so loud the neighbors called 😂', 'So proud of you, sweetie ❤️', 'Grandpa says that was your best game yet!'],
    replies: [
      { label: '❤️ love you guys', bond: 2, effects: { mood: 2 }, back: 'Love you more!!' },
      { label: 'Tell grandpa I said thanks!', bond: 3, back: 'He\'s telling the whole neighborhood 😂' },
      { label: 'Busy, talk later', bond: -2, back: 'Oh. Okay. Call when you can.' },
    ],
  },
  family_loss: {
    who: 'family', text: ['Tough one. We love you no matter what ❤️', 'Head up, kiddo. Call us tonight?'],
    replies: [
      { label: 'Thanks mom ❤️ I\'ll call', bond: 3, effects: { mood: 3 }, back: 'Talk tonight. Proud of you.' },
      { label: 'I don\'t want to talk about it', bond: -1, effects: { mood: -1 }, back: 'Okay. We\'re here when you\'re ready.' },
    ],
  },
  family_hurt: {
    who: 'family', text: ['We saw you get hurt. Are you okay?? Call us!', 'Please rest. Your health matters more than any game.'],
    replies: [
      { label: 'I\'m okay, don\'t worry', bond: 2, back: 'Promise me you\'ll listen to the trainers.' },
      { label: 'Honestly it hurts a lot', bond: 3, effects: { mood: 2 }, back: 'We\'re driving up this weekend. No arguments.' },
    ],
  },
  partner_win: {
    who: 'partner', text: ['You were amazing today 😍', 'Dinner\'s on me tonight, superstar.'],
    replies: [
      { label: 'Dinner sounds perfect ❤️', bond: 4, effects: { mood: 3 }, back: 'It\'s a date 😘' },
      { label: 'Celebrating with the team tonight', bond: -3, effects: { rel: { teammates: 3 } }, back: 'Oh... have fun I guess.' },
    ],
  },
  partner_loss: {
    who: 'partner', text: ['Come home, I made your favorite. Forget football tonight.', 'I\'m proud of you anyway ❤️'],
    replies: [
      { label: 'Best news all day. On my way', bond: 4, effects: { mood: 4 }, back: 'Couch, blanket, food. Ready for you.' },
      { label: 'I need to be alone tonight', bond: -2, back: 'Okay. I\'m here if you need me.' },
    ],
  },
  mate_great: {
    who: 'mate', text: ['BRO. 🔥🔥🔥', 'You were COOKING today', 'Wings on me. You earned it.'],
    replies: [
      { label: 'Couldn\'t do it without you', bond: 3, effects: { rel: { teammates: 2 } }, back: 'Facts. We eat together 🍗' },
      { label: 'Wings on YOU then 😂', bond: 2, back: 'Deal. Don\'t order the whole menu.' },
      { label: 'I\'m HIM. 😤', bond: 1, effects: { fame: 0.5, rel: { coach: -1 } }, back: 'Okay okay, humble pie incoming lol' },
    ],
  },
  mate_win: {
    who: 'mate', text: ['Big W 💪', 'Good win. Recovery tomorrow?'],
    replies: [
      { label: 'Ice bath at 10. Let\'s go', bond: 3, effects: { health: 2 }, back: 'Bring towels this time 🥶' },
      { label: '💪', bond: 1, back: '💪💪' },
    ],
  },
  agent_great: {
    who: 'agent', text: ['Phones are ringing after that one. Keep it up.', 'That game just added zeros to your next deal.'],
    replies: [
      { label: 'Get me that bag 💰', bond: 2, back: 'That\'s my job. You keep balling.' },
      { label: 'Football first. Money later.', bond: 1, effects: { rel: { coach: 1 } }, back: 'Respect. That attitude sells too.' },
    ],
  },
  rival_beat: {
    who: 'rival', text: ['Lucky day. See you next year.', 'Enjoy it while it lasts.'],
    replies: [
      { label: 'Scoreboard. 😘', bond: 6, effects: { fame: 0.8 }, back: '...' },
      { label: 'Good game, honestly.', bond: -4, effects: { fame: 0.4, mood: 1 }, back: '...respect. Still coming for you.' },
      { label: '(leave on read)', bond: 2, back: null },
    ],
  },
  rival_lost: {
    who: 'rival', text: ['Better luck next time 😘', 'Told you.'],
    replies: [
      { label: 'Enjoy it. Next time is mine.', bond: 3, back: 'We\'ll see.' },
      { label: 'Refs helped you lol', bond: 5, effects: { rel: { coach: -1 } }, back: 'Cry about it 😂' },
      { label: 'GG.', bond: -4, effects: { mood: 1 }, back: 'GG.' },
    ],
  },
  // ---------------- weekly
  mate_wings: {
    who: 'mate', text: ['Anyone down for wings Thursday?'],
    replies: [
      { label: 'I\'m in 🍗', bond: 3, effects: { mood: 2 }, back: 'Bet. 7pm.' },
      { label: 'Can\'t, film study', bond: -1, effects: { train: { iq: 0.2 }, rel: { coach: 1 } }, back: 'Nerd 😂 respect though' },
    ],
  },
  mate_playbook: {
    who: 'mate', text: ['Did you see the new playbook install? My brain hurts'],
    replies: [
      { label: 'Same lol. Study together?', bond: 3, effects: { train: { iq: 0.2 } }, back: 'Library at 4?' },
      { label: 'Easy for me 😎', bond: -1, back: 'Ok genius 🙄' },
    ],
  },
  mate_lift: {
    who: 'mate', text: ['Lift at 6am. Don\'t be late 😤'],
    replies: [
      { label: 'I\'ll be there first', bond: 3, effects: { train: { strength: 0.3 } }, back: 'Loser buys protein shakes.' },
      { label: '😴', bond: -1, back: 'I\'m calling you at 5:45.' },
    ],
  },
  family_veg: {
    who: 'family', text: ['Don\'t forget to eat a vegetable this week.'],
    replies: [
      { label: 'Yes mom 🥦', bond: 2, effects: { health: 1 }, back: 'Send a picture as proof 😂' },
      { label: 'Does pizza sauce count?', bond: 1, effects: { mood: 1 }, back: 'NO.' },
    ],
  },
  family_cousin: {
    who: 'family', text: ['Your little cousin wore your jersey to school today!'],
    replies: [
      { label: 'Tell them I said what\'s up!', bond: 3, effects: { fame: 0.2 }, back: 'They screamed 😂' },
      { label: 'I\'ll mail them signed gloves', bond: 5, effects: { money: -60, fame: 0.4, mood: 2 }, back: 'You just made their entire year.' },
    ],
  },
  coach_film: {
    who: 'coach', text: ['Extra film session available Wednesday if you want it.'],
    replies: [
      { label: 'I\'ll be there', bond: 3, effects: { train: { iq: 0.4 }, mood: -1 }, back: 'Good. Bring questions.' },
      { label: 'I\'ve got plans, sorry', bond: -3, back: 'Your call.' },
    ],
  },
  partner_movie: {
    who: 'partner', text: ['Miss you. Movie night soon?'],
    replies: [
      { label: 'Friday. I\'ll bring snacks', bond: 4, effects: { mood: 2 }, back: 'Yay!! I\'m picking the movie 😏' },
      { label: 'Season\'s busy, sorry', bond: -4, back: 'It\'s always busy.' },
    ],
  },
  agent_brands: {
    who: 'agent', text: ['A couple of brands asked about you. Let\'s talk.'],
    replies: [
      { label: 'Set up the meetings', bond: 2, effects: { fame: 0.5, money: 400 }, back: 'Already on it. Small appearance fee came in.' },
      { label: 'Not during the season', bond: -1, effects: { rel: { coach: 1 } }, back: 'Understood. I\'ll keep them warm.' },
    ],
  },
  rival_trash: {
    who: 'rival', text: ['Saw your highlights. Cute.', 'You still think you\'re the best in this league? 😂'],
    replies: [
      { label: 'I don\'t think. I know.', bond: 5, effects: { fame: 0.6 }, back: 'We\'ll see on Saturday.' },
      { label: 'Why are you watching my highlights?', bond: 4, effects: { mood: 2 }, back: '...whatever.' },
      { label: '(block them)', bond: -6, effects: { mood: 1 }, back: null },
    ],
  },
};

export const AFTER_GAME = {
  coach: { great: 'coach_great', good: 'coach_good', bad: 'coach_bad' },
  family: { win: 'family_win', loss: 'family_loss', hurt: 'family_hurt' },
  partner: { win: 'partner_win', loss: 'partner_loss' },
  mate: { great: 'mate_great', win: 'mate_win' },
  agent: { great: 'agent_great' },
  rival: { beat: 'rival_beat', lost: 'rival_lost' },
};
export const WEEKLY = ['mate_wings', 'mate_playbook', 'mate_lift', 'family_veg', 'family_cousin', 'coach_film', 'partner_movie', 'agent_brands', 'rival_trash'];

// Social media: fan comments on your posts, including trolls you can answer.
export const TROLL_COMMENTS = ['overrated', 'mid player honestly', 'fraud alert 🚨', 'my grandma runs faster', 'pads must be heavy lol', 'can\'t do it in big games'];
export const COMMENT_REPLIES = {
  fan: [
    { label: '❤️', effects: { fame: 0.1 } },
    { label: 'Appreciate you! 🙏', effects: { fame: 0.25, mood: 1 } },
  ],
  troll: [
    { label: 'Clap back', effects: { fame: 1 }, risk: 0.35 },
    { label: 'Kill \'em with kindness', effects: { fame: 0.5, mood: 1 } },
    { label: 'Ignore', effects: {} },
  ],
};
export const CLAPBACKS = ['Check the scoreboard 😴', 'Stay mad. 🏈', 'Couldn\'t be me typing this from my couch', 'Highlights speak for themselves.'];
