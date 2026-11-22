// v0.61 events: everyday life at each level plus two new storylines (the walk-on and the documentary crew).
export const EXTRA_EVENTS = [
  // ---------------------------------------------------------------- high school
  {
    id: 'hs_drivers_test', title: "Driver's Test", stages: ['hs'], cond: { flags: { drivers_license: false } },
    text: 'Your driving test is Thursday. The examiner is a huge fan of the {rivalTeam}.',
    choices: [
      { label: 'Practice parallel parking all week', effects: { energy: -1, mood: 4, flags: { drivers_license: true } }, result: 'Perfect parking. The examiner grudgingly writes "PASS".' },
      { label: 'Wing it', chance: { p: 0.55, stat: 'iq', success: { effects: { mood: 5, flags: { drivers_license: true } }, result: 'You pass by one point. Freedom!' }, fail: { effects: { mood: -4, fame: -0.5 }, result: 'You clip a cone. Then another cone. The whole school hears about it.' } } },
    ],
  },
  {
    id: 'hs_pep_rally', title: 'Pep Rally', stages: ['hs'], cond: { minWeek: 2 },
    text: 'The principal hands you the microphone at the pep rally. 900 students are staring at you. Somebody starts a drum roll.',
    choices: [
      { label: 'Give a fiery speech', chance: { p: 0.6, success: { effects: { fame: 1.5, rel: { teammates: 4 }, mood: 4 }, result: 'The gym goes nuts. Kids are chanting your name in the hallways all week.' }, fail: { effects: { fame: -0.5, mood: -3 }, result: 'Your voice cracks on the big line. It becomes a meme by lunch.' } } },
      { label: 'Hand the mic to the seniors', effects: { rel: { teammates: 5 }, mood: 2 }, result: 'Classy move. The seniors bring the house down.' },
      { label: 'Lead a cheer with the band', effects: { fame: 1, mood: 5 }, result: 'You play the big drum. Badly. Everyone loves it.' },
    ],
  },
  {
    id: 'hs_part_time', title: 'Burger Shift', stages: ['hs'], cond: { maxMoney: 3000 },
    text: 'The burger place downtown offers you weekend shifts. The owner says customers will love seeing the town\'s football star at the register.',
    choices: [
      { label: 'Take the job', effects: { money: 600, energy: -1, fame: 0.5 }, result: 'Free fries and a little cash. People come in just to get your autograph on their receipts.' },
      { label: 'Focus on football', effects: { mood: 1 }, result: 'Maybe next summer.' },
    ],
  },
  {
    id: 'hs_little_brother', title: 'A Little Shadow', stages: ['hs', 'college'], cond: { minFame: 10 },
    text: 'A 7-year-old from your street now wears your number every day and copies your warm-up routine in his front yard.',
    choices: [
      { label: 'Teach him a real drill', effects: { mood: 6, fame: 0.5 }, result: 'Twenty minutes of footwork. He will remember it forever. So will you.' },
      { label: 'Give him your old cleats', effects: { mood: 4, rel: { family: 2 } }, result: 'They are three sizes too big. He refuses to take them off.' },
    ],
  },

  // ---------------------------------------------------------------- college
  {
    id: 'col_fire_alarm', title: '3 A.M. Fire Alarm', stages: ['college'], cond: { minWeek: 1 },
    text: 'Someone burned popcorn in the dorm at 3 a.m. the night before the game. Everyone is outside in their pajamas.',
    choices: [
      { label: 'Sleep in the team bus', effects: { health: -2, rel: { teammates: 3 } }, result: 'Half the offense ends up in there. Weirdly great team bonding.' },
      { label: 'Find out who did it', effects: { mood: -2, fame: 0.3 }, result: 'It was the backup kicker. The team never lets him forget it.' },
    ],
  },
  {
    id: 'col_booster_dinner', title: 'Booster Dinner', stages: ['college'], cond: { minFame: 15 },
    text: 'The school\'s biggest donors want you at a fancy dinner. Steak, speeches and a lot of handshakes.',
    choices: [
      { label: 'Go and charm everyone', effects: { energy: -1, fame: 1, rel: { coach: 4 } }, result: 'You remember everyone\'s name. The athletic director winks at you.' },
      { label: 'Politely skip it', effects: { rel: { coach: -2 }, mood: 2 }, result: 'Coach says nothing. His eyebrows say everything.' },
    ],
  },
  {
    id: 'col_finals', title: 'Finals Week', stages: ['college'], phase: 'any', cond: { maxAcademics: 70 },
    text: 'Three exams in two days, and film study is mandatory. Something has to give.',
    choices: [
      { label: 'Pull two all-nighters', effects: { academics: 10, health: -5, mood: -3 }, result: 'Passed everything. You sleep for 14 hours.' },
      { label: 'Ask the tutor for help', effects: { academics: 6, energy: -1 }, result: 'Flash cards in the locker room. It works.' },
      { label: 'Cram the night before', chance: { p: 0.5, stat: 'iq', success: { effects: { academics: 5 }, result: 'Somehow, it all clicks.' }, fail: { effects: { academics: -5, mood: -4 }, result: 'Your mind goes blank on question one.' } } },
    ],
  },

  // ---------------------------------------------------------------- pro
  {
    id: 'pro_vet_retires', title: 'A Mentor Retires', stages: ['pro'], cond: { minWeek: 4 },
    text: 'The 14-year veteran who showed you the ropes announces this is his last season. He asks you to speak at his send-off.',
    choices: [
      { label: 'Give a heartfelt speech', effects: { rel: { teammates: 8 }, mood: 4, fame: 0.5 }, result: 'Not a dry eye in the locker room. He hugs you for a full minute.' },
      { label: 'Roast him (lovingly)', effects: { rel: { teammates: 6 }, mood: 6 }, result: 'The room is crying laughing. He laughs hardest of all.' },
    ],
  },
  {
    id: 'pro_golf_charity', title: 'Charity Golf Classic', stages: ['pro'], phase: 'offseason',
    text: 'You are invited to a celebrity charity golf tournament. You have played golf exactly twice.',
    choices: [
      { label: 'Play anyway', chance: { p: 0.5, success: { effects: { fame: 2, mood: 5 }, result: 'You hit a hole-in-one on 7. It is on every sports show.' }, fail: { effects: { fame: 1, mood: 2 }, result: 'Your ball ends up in the lake four times. The crowd loves you anyway.' } } },
      { label: 'Donate instead', effects: { money: -25000, fame: 1 }, result: 'Your check funds a whole youth league.' },
    ],
  },
  {
    id: 'pro_cover_athlete', title: 'Cover Athlete', stages: ['pro'], cond: { minFame: 65, flags: { cover_athlete: false } },
    text: 'The makers of Blitz Kings want you on the cover of the next game. Some players say the cover is cursed.',
    choices: [
      { label: 'Do it', effects: { fame: 5, money: 500000, flags: { cover_athlete: true } }, result: 'Your face is in every store in the country. The curse can try.' },
      { label: 'Pass, just in case', effects: { mood: 1, flags: { cover_athlete: true } }, result: 'A rival takes it. You sleep fine.' },
    ],
  },
  {
    id: 'pro_contract_year', title: 'Contract Year', stages: ['pro'], cond: { minWeek: 2 },
    text: 'Reporters keep asking about your next contract. "Are you worried about your future here?"',
    choices: [
      { label: '"I only think about this week."', effects: { rel: { coach: 3 }, mood: 1 }, result: 'Boring but perfect. The story goes away.' },
      { label: '"Pay me and find out."', effects: { fame: 1.5, rel: { coach: -3 } }, result: 'The quote is on a T-shirt by Friday.' },
    ],
  },

  // ---------------------------------------------------------------- any level
  {
    id: 'any_old_coach', title: 'Your First Coach', stages: ['college', 'pro'], cond: { minFame: 20 },
    text: 'Your old youth-league coach from {hometown} is in the stands today. He drove six hours.',
    choices: [
      { label: 'Give him your gloves after the game', effects: { mood: 6, fame: 0.5 }, result: 'He frames them next to a picture of you at age 8.' },
      { label: 'Get him on the field for warm-ups', effects: { mood: 5, rel: { coach: 1 } }, result: 'He shouts "keep your feet moving!" like you are eight years old again.' },
    ],
  },
  {
    id: 'any_viral_dance', title: 'The Dance', cond: { minFame: 8 },
    text: 'A clip of you dancing at a teammate\'s birthday is getting millions of views. The dance has a name now.',
    choices: [
      { label: 'Lean into it', effects: { fame: 2, mood: 4 }, result: 'Kids everywhere are doing your dance at recess.' },
      { label: 'Ask people to delete it', effects: { fame: -0.5, mood: -2 }, result: 'That only makes it spread faster.' },
    ],
  },

  // ---------------------------------------------------------------- storyline: the walk-on
  {
    id: 'arc_walkon_1', title: 'The Walk-On', stages: ['college', 'pro'], weight: 0.8, cond: { minWeek: 1, flags: { walkon_done: false } },
    text: 'A walk-on named Teddy Okoro stays after every practice asking you for tips. Nobody else even knows his name.',
    choices: [
      { label: 'Work out with him', effects: { energy: -1, rel: { teammates: 3 }, flags: { walkon_helped: true }, chain: { id: 'arc_walkon_2', delay: 3 } }, result: 'He is slow but he never, ever quits.' },
      { label: 'Give him a few pointers', effects: { flags: { walkon_meh: true }, chain: { id: 'arc_walkon_2', delay: 4 } }, result: 'He writes everything down in a little notebook.' },
      { label: 'Tell him you\'re busy', effects: { flags: { walkon_done: true } }, result: 'He nods and keeps working alone.' },
    ],
  },
  {
    id: 'arc_walkon_2', title: 'Teddy Gets His Shot', weight: 0.01, cond: { flags: { walkon_done: false } },
    text: 'Injuries pile up and Teddy Okoro is starting on special teams this week. He looks terrified. He looks at you.',
    choices: [
      { label: 'Give him a pregame pep talk', effects: { rel: { teammates: 5 }, mood: 3, flags: { walkon_done: true } }, result: 'He makes the tackle on the opening kickoff. The sideline explodes. He points straight at you.' },
      { label: 'Let him handle it himself', effects: { flags: { walkon_done: true } }, result: 'He does fine. Afterwards he says, "Thanks for everything anyway."' },
    ],
  },

  // ---------------------------------------------------------------- storyline: the documentary
  {
    id: 'arc_doc_1', title: 'Documentary Crew', stages: ['pro'], weight: 0.7, cond: { minFame: 45, flags: { doc_done: false } },
    text: 'A streaming service wants to follow you all season for a documentary series. Cameras everywhere, even at home.',
    choices: [
      { label: 'Say yes', effects: { fame: 2, money: 150000, flags: { doc_on: true }, chain: { id: 'arc_doc_2', delay: 3 } }, result: 'A camera crew moves into your life on Monday.' },
      { label: 'Keep your privacy', effects: { mood: 2, flags: { doc_done: true } }, result: 'Some things should stay in the locker room.' },
    ],
  },
  {
    id: 'arc_doc_2', title: 'The Cameras Are Rolling', weight: 0.01, cond: { flags: { doc_on: true, doc_done: false } },
    text: 'The director wants to film a fight. "Drama sells. Can you yell at someone in the locker room?"',
    choices: [
      { label: 'Refuse: show the real you', effects: { rel: { teammates: 5 }, flags: { doc_real: true }, chain: { id: 'arc_doc_3', delay: 3 } }, result: 'They film you reading to your teammates\' kids instead.' },
      { label: 'Give them drama', effects: { fame: 2, rel: { teammates: -6 }, flags: { doc_drama: true }, chain: { id: 'arc_doc_3', delay: 3 } }, result: 'You flip a Gatorade table. It looks great on camera. It looks bad in the locker room.' },
    ],
  },
  {
    id: 'arc_doc_3', title: 'Premiere Night', weight: 0.01, cond: { flags: { doc_on: true, doc_done: false } },
    text: 'The documentary drops. Everybody is watching it.',
    choices: [
      { label: 'Watch it with the team', effects: { mood: 5, fame: 3, flags: { doc_done: true } }, result: 'Reviews say it is "the most human sports show in years." Your mom has watched it nine times.' },
    ],
  },
];
