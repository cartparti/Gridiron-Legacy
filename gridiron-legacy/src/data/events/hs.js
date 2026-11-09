// High school events.
export const HS_EVENTS = [
  {
    id: 'hs_first_day', title: 'Varsity Locker', stages: ['hs'], weight: 6, cond: { maxWeek: 2, flags: { hs_first_day_done: false } },
    text: 'Your name is taped above a varsity locker for the first time. A senior lineman tosses you an old practice jersey. "Rookies carry the water jugs."',
    choices: [
      { label: 'Carry the jugs, smile', effects: { rel: { teammates: 8 }, mood: -2, flags: { hs_first_day_done: true } }, result: 'The seniors nod. You are one of them now, sort of.' },
      { label: '"I didn\'t come here to carry jugs."', effects: { rel: { teammates: -6, coach: 3 }, fame: 1, flags: { hs_first_day_done: true } }, result: 'Coach {coach} smirks. The seniors do not.' },
    ],
  },
  {
    id: 'hs_party', title: 'Lake House Party', stages: ['hs'],
    text: 'Word is everybody is going to the lake house this Friday night. Your phone keeps buzzing. Kickoff against {rivalTeam} is the next week.',
    choices: [
      { label: 'Go, but leave early', effects: { mood: 6, rel: { teammates: 4 } }, result: 'You show your face, grab a soda, and get home by eleven.' },
      {
        label: 'Go all night',
        chance: {
          p: 0.55,
          success: { effects: { mood: 12, rel: { teammates: 8 }, fame: 1 }, result: 'Legendary night. Nobody posts anything bad. Somehow.' },
          fail: { effects: { mood: 4, rel: { coach: -12, family: -8 }, fame: -1, flags: { hs_party_caught: true } }, result: 'Someone posts a video. Coach {coach} has seen it. So has your mom.' },
        },
      },
      { label: 'Stay home and watch film', effects: { train: { iq: 1.2 }, mood: -3, rel: { coach: 3 } }, result: 'You spot a tell in their linebacker\'s stance.' },
    ],
  },
  {
    id: 'hs_party_fallout', title: 'Laps at Dawn', stages: ['hs'], cond: { flags: { hs_party_caught: true } },
    text: 'Coach {coach} meets you at the track at 5:30 a.m. "You want to party? Let\'s party." Coach points at the bleachers.',
    choices: [
      { label: 'Run every step without a word', effects: { rel: { coach: 12 }, health: -6, train: { speed: 0.6 }, clearFlags: ['hs_party_caught'] }, result: 'By the 40th flight, Coach is almost smiling.' },
      { label: 'Argue it was harmless', effects: { rel: { coach: -8 }, suspend: 1, clearFlags: ['hs_party_caught'] }, result: '"Then you can watch Friday\'s game from the bench."' },
    ],
  },
  {
    id: 'hs_failing_chem', title: 'Failing Chemistry', stages: ['hs'], cond: { maxAcademics: 55 },
    text: 'Your chemistry teacher hands back a quiz with a red 48 on it. "One more like this and you\'re academically ineligible."',
    choices: [
      { label: 'Get a tutor ($200)', effects: { money: -200, academics: 20 }, result: 'Turns out moles are not the animal. Grades climbing.' },
      { label: 'Ask a teammate to help', effects: { academics: 12, rel: { teammates: 4 } }, result: 'The backup kicker is a chemistry genius. Who knew?' },
      { label: 'Wing it', chance: { p: 0.4, success: { effects: { academics: 5 }, result: 'You scrape a C-minus. Phew.' }, fail: { effects: { academics: -10, suspend: 1 }, result: 'Ineligible for a game. Coach is furious.' } } },
    ],
  },
  {
    id: 'hs_recruit_letter', title: 'First Letter', stages: ['hs'], cond: { minOvr: 55 },
    text: 'A thick envelope arrives with a college logo on it. It is a form letter, but your name is spelled right.',
    choices: [
      { label: 'Pin it on the wall', effects: { mood: 8, fame: 1 }, result: 'Every morning it reminds you why you lift.' },
      { label: 'Post it online', effects: { fame: 3, rel: { teammates: -3 } }, result: 'Lots of likes. A few teammates roll their eyes.' },
    ],
  },
  {
    id: 'hs_camp_invite', title: 'Elite Camp Invite', stages: ['hs'], phase: 'offseason', cond: { minOvr: 50 },
    text: 'You are invited to the Lone Pine Elite Camp, where college scouts watch prospects compete. It costs $600 and a week of your summer.',
    choices: [
      { label: 'Go and compete', chance: { p: 0.5, stat: 'skill', success: { effects: { money: -600, fame: 6, train: { skill: 1.5 }, flags: { camp_star: true } }, result: 'You win camp MVP. Three scouts ask for your number.' }, fail: { effects: { money: -600, train: { skill: 1 }, mood: -4 }, result: 'You hold your own, but nobody writes your name down.' } } },
      { label: 'Train at home instead', effects: { train: { speed: 1, strength: 1 } }, result: 'Quiet summer, louder muscles.' },
    ],
  },
  {
    id: 'hs_rival_trash', title: 'Trash Talk', stages: ['hs'],
    text: '{rival} from {rivalTeam} posts a clip of you dropping a pass with the caption "overrated." It has 4,000 views.',
    choices: [
      { label: 'Fire back', effects: { fame: 3, rel: { rival: 15, coach: -4 }, flags: { rival_feud: true } }, result: 'The comments are a war zone. Everyone is circling the rivalry game.' },
      { label: 'Ignore it', effects: { mood: -2, rel: { coach: 4 } }, result: 'Coach {coach}: "Let your play do the talking."' },
      { label: 'Reply "see you on the field" 🤝', effects: { fame: 2, rel: { rival: 5 } }, result: 'Classy. The clip gets more views anyway.' },
    ],
  },
  {
    id: 'hs_homecoming', title: 'Homecoming Dance', stages: ['hs'], cond: { partner: false },
    text: 'Homecoming is Saturday. {partnerCandidate} from your history class asks if you are going with anyone.',
    choices: [
      { label: '"Want to go together?"', effects: { newPartner: true, mood: 10, money: -80 }, result: 'You go together. It is awkward, then it is great.' },
      { label: 'Go with the team', effects: { rel: { teammates: 6 }, mood: 5 }, result: 'The offensive line does a choreographed dance. Unforgettable.' },
      { label: 'Skip it, rest up', effects: { health: 6, mood: -3 }, result: 'You hear it was a great night.' },
    ],
  },
  {
    id: 'hs_dad_pressure', title: 'Kitchen Table Talk', stages: ['hs'],
    text: 'Your dad slides a printed spreadsheet across the kitchen table: your stats, color-coded. "We need to talk about your footwork."',
    choices: [
      { label: 'Listen and work on it', effects: { train: { skill: 1 }, rel: { family: 5 }, mood: -3 }, result: 'He is annoying. He is also right.' },
      { label: '"Dad, I have coaches."', effects: { rel: { family: -6 }, mood: 3 }, result: 'Silence over dinner. He means well.' },
    ],
  },
  {
    id: 'hs_younger_sibling', title: 'Little Brother', stages: ['hs'],
    text: 'Your little brother wants you to come to his peewee game Saturday morning. You have extra film session scheduled.',
    choices: [
      { label: 'Go cheer him on', effects: { rel: { family: 10 }, mood: 8 }, result: 'He scores a touchdown and points at you in the stands.' },
      { label: 'Do the film session', effects: { train: { iq: 1 }, rel: { family: -5, coach: 2 } }, result: 'He says it is fine. It is not fine.' },
    ],
  },
  {
    id: 'hs_weight_record', title: 'School Record', stages: ['hs'], cond: { minAge: 16 },
    text: 'The school squat record is 455 pounds. The whole team has gathered to watch you try.',
    choices: [
      { label: 'Go for it', chance: { p: 0.45, stat: 'strength', success: { effects: { stats: { strength: 2 }, fame: 3, rel: { teammates: 8 } }, result: 'The bar bends, the gym erupts. Your name goes on the wall.' }, fail: { effects: { health: -10, mood: -4 }, result: 'Stuck at the bottom. Spotters save you. Your back is not happy.' } } },
      { label: 'Not today', effects: { rel: { teammates: -2 } }, result: '"Next week," you promise.' },
    ],
  },
  {
    id: 'hs_qb_audible', title: 'The Audible', stages: ['hs'], cond: { positions: ['QB'] },
    text: 'Coach {coach} has called the same run play six times. You see a blitz coming that would leave the slot wide open.',
    choices: [
      { label: 'Audible to the pass', chance: { p: 0.5, stat: 'iq', success: { effects: { fame: 3, rel: { coach: 6 }, train: { iq: 1 } }, result: 'Touchdown. Coach says nothing, but hands you the headset next week.' }, fail: { effects: { rel: { coach: -10 } }, result: 'Interception. "MY plays, son."' } } },
      { label: 'Run the call', effects: { rel: { coach: 3 } }, result: 'Two-yard gain. Safe. Boring.' },
    ],
  },
  {
    id: 'hs_part_time_boss', title: 'Shift Conflict', stages: ['hs'], cond: { maxMoney: 400 },
    text: 'The grocery store manager offers you extra Saturday shifts, $150 a week. Saturday is when the team does recovery.',
    choices: [
      { label: 'Take the shifts', effects: { money: 450, health: -6, rel: { coach: -3 } }, result: 'Three weeks of cash. Your legs feel heavy.' },
      { label: 'Decline', effects: { mood: -1 }, result: 'Football first.' },
    ],
  },
  {
    id: 'hs_scout_in_stands', title: 'Scout in the Stands', stages: ['hs'], cond: { minWeek: 3 },
    text: 'Someone in a college polo is sitting in the bleachers with a clipboard. Every teammate has noticed.',
    choices: [
      { label: 'Play your game', effects: { mood: 3, rel: { coach: 2 } }, result: 'Calm and steady. Exactly what scouts want to see.' },
      { label: 'Try to show off', chance: { p: 0.5, success: { effects: { fame: 4 }, result: 'Your highlight play goes straight into the scout\'s notebook.' }, fail: { effects: { fame: -1, rel: { coach: -4 } }, result: 'You freelance, it backfires, and he leaves at halftime.' } } },
    ],
  },
  {
    id: 'hs_teammate_quit', title: 'Best Friend Quits', stages: ['hs'],
    text: 'Your best friend on the team says they are quitting to work at their uncle\'s shop. They have been blocking for you since peewee.',
    choices: [
      { label: 'Talk them into staying', chance: { p: 0.6, success: { effects: { rel: { teammates: 10 }, mood: 5 }, result: 'They stay. "Somebody has to keep you upright."' }, fail: { effects: { mood: -6 }, result: 'His mind is made up. You hug it out.' } } },
      { label: 'Support their choice', effects: { mood: -2, rel: { teammates: 3 } }, result: '"Come to my games," you tell them. They do, every single one.' },
    ],
  },
  {
    id: 'hs_newspaper', title: 'Local Paper Interview', stages: ['hs'], cond: { minFame: 8 },
    text: 'The Tri-County Ledger wants a profile on you: "Rising Star." The reporter asks what makes you different.',
    choices: [
      { label: 'Credit your teammates', effects: { rel: { teammates: 8 }, fame: 2 }, result: 'Linemen cut out the article and tape it to their lockers.' },
      { label: '"I\'m the best in the state."', effects: { fame: 5, rel: { teammates: -5, rival: 10 } }, result: 'Bold. Everyone in the county read it. Including {rival}.' },
      { label: 'Talk about {hometown}', effects: { fame: 3, rel: { family: 6 } }, result: 'Your grandma buys twenty copies.' },
    ],
  },
  {
    id: 'hs_coach_extra', title: 'Saturday Sessions', stages: ['hs'], cond: { rel: { coach: [55, 100] } },
    text: 'Coach {coach} offers to work with you one-on-one on Saturday mornings. "You\'ve got something, kid."',
    choices: [
      { label: 'Absolutely', effects: { train: { skill: 1.2, iq: 1.2 }, rel: { coach: 8 }, mood: -2 }, result: 'Six weeks later, you are a different player.' },
      { label: 'Saturdays are for rest', effects: { health: 4, rel: { coach: -3 } }, result: 'Coach nods, but you can tell they are disappointed.' },
    ],
  },
  {
    id: 'hs_prom', title: 'Prom Night', stages: ['hs'], phase: 'offseason', cond: { minAge: 17 },
    text: 'Prom is coming. Limo, suits, the whole thing. It costs about $400 all in.',
    choices: [
      { label: 'Go all out', effects: { money: -400, mood: 12, rel: { partner: 10, teammates: 4 } }, result: 'A night you will tell your kids about.' },
      { label: 'Keep it simple', effects: { money: -120, mood: 6, rel: { partner: 3 } }, result: 'Pizza before, dancing after. Perfect.' },
      { label: 'Skip it', effects: { mood: -4, rel: { partner: -8 } }, result: 'You train. Instagram tells you what you missed.' },
    ],
  },
  {
    id: 'hs_gatorade_bath', title: 'The Big Bet', stages: ['hs'], cond: { minWeek: 4 },
    text: 'The team bets Coach {coach} that if you win the next two games, Coach has to dye their hair in team colors.',
    choices: [
      { label: 'Hype it up', effects: { rel: { teammates: 8, coach: -2 }, mood: 6, fame: 1 }, result: 'Posters go up around school: DYE, COACH, DYE?' },
      { label: 'Stay out of it', effects: { rel: { coach: 3 } }, result: 'Coach appreciates the respect.' },
    ],
  },
  {
    id: 'hs_shoe_deal_rumor', title: 'Free Cleats?', stages: ['hs'], cond: { minFame: 12 },
    text: 'A man at the sporting goods store says he can get you free top-tier cleats if you "remember him later." Something feels off.',
    choices: [
      { label: 'Take them', chance: { p: 0.6, success: { effects: { mood: 5, train: { speed: 0.5 } }, result: 'Nothing comes of it. Nice cleats.' }, fail: { effects: { fame: -4, rel: { coach: -10 }, suspend: 1 }, result: 'The league investigates improper benefits. One-game suspension.' } } },
      { label: 'Politely decline', effects: { rel: { coach: 4, family: 3 } }, result: 'Your mom says she is proud of you.' },
    ],
  },
  {
    id: 'hs_film_club', title: 'Film Room Key', stages: ['hs'], cond: { minAcademics: 60 },
    text: 'The team manager trusts you with a key to the film room. You could watch tape anytime.',
    choices: [
      { label: 'Use it every lunch', effects: { train: { iq: 2 }, mood: -3 }, result: 'Lunchtime is now tape time.' },
      { label: 'Share it with the QB room', effects: { train: { iq: 1 }, rel: { teammates: 6 } }, result: 'Film parties become a team tradition.' },
    ],
  },
];
