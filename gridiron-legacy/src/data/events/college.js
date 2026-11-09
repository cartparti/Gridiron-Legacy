// College events.
export const COLLEGE_EVENTS = [
  {
    id: 'col_freshman_hazing', title: 'Freshman Talent Show', stages: ['college'], weight: 5, cond: { maxWeek: 2, flags: { col_talent_done: false } },
    text: 'Tradition says every freshman performs at the team talent show. The upperclassmen are already chanting your name.',
    choices: [
      { label: 'Sing a power ballad', chance: { p: 0.5, success: { effects: { rel: { teammates: 12 }, mood: 6, flags: { col_talent_done: true } }, result: 'Standing ovation. They call you "Pipes" now.' }, fail: { effects: { rel: { teammates: 6 }, mood: -2, flags: { col_talent_done: true } }, result: 'You crack on the high note. They love it anyway.' } } },
      { label: 'Do a comedy roast of the coaches', chance: { p: 0.5, success: { effects: { rel: { teammates: 10, coach: 3 }, flags: { col_talent_done: true } }, result: 'Even Coach {coach} laughs.' }, fail: { effects: { rel: { teammates: 5, coach: -8 }, flags: { col_talent_done: true } }, result: 'One joke goes too far. Coach is not laughing.' } } },
    ],
  },
  {
    id: 'col_booster', title: 'Generous Booster', stages: ['college'], cond: { minFame: 15 },
    text: 'A booster with a huge watch invites you to dinner and slides an envelope across the table. "Just a little thank-you. Nobody needs to know."',
    choices: [
      { label: 'Take it', chance: { p: 0.65, success: { effects: { money: 5000, mood: 3, flags: { took_booster_money: true } }, result: '$5,000 in cash. Your stomach feels weird.' }, fail: { effects: { money: 5000, fame: -8, suspend: 2, rel: { coach: -15, family: -10 } }, result: 'Compliance finds out. Two-game suspension and a national story.' } } },
      { label: 'Report it to compliance', effects: { rel: { coach: 8 }, fame: 2 }, result: 'The school thanks you quietly. The booster never calls again.' },
      { label: 'Refuse politely', effects: { rel: { family: 4 } }, result: 'He shrugs. "Your loss, kid."' },
    ],
  },
  {
    id: 'col_booster_followup', title: 'The Investigation', stages: ['college'], cond: { flags: { took_booster_money: true } }, weight: 2,
    text: 'A reporter calls. She has heard the booster has been paying players, and your name came up.',
    choices: [
      { label: 'No comment', chance: { p: 0.6, success: { effects: { clearFlags: ['took_booster_money'], mood: -4 }, result: 'The story runs without your name. You dodged it.' }, fail: { effects: { fame: -6, rel: { coach: -10 }, clearFlags: ['took_booster_money'], suspend: 1 }, result: 'The story names you. One-game suspension.' } } },
      { label: 'Come clean and repay it', effects: { money: -5000, fame: 1, rel: { coach: 5, family: 6 }, clearFlags: ['took_booster_money'] }, result: 'Painful, but you sleep well for the first time in weeks.' },
    ],
  },
  {
    id: 'col_endorsement', title: 'Endorsement Offer', stages: ['college'], cond: { minFame: 18 },
    text: 'A local car dealership wants you in a TV commercial. Legal endorsement deal, $2,500, one afternoon of filming.',
    choices: [
      { label: 'Do it, ham it up', effects: { money: 2500, fame: 4, rel: { teammates: -2 } }, result: 'Your catchphrase "Drive it like you stole it, legally" becomes a campus meme.' },
      { label: 'Do it, keep it classy', effects: { money: 2500, fame: 2 }, result: 'Clean, professional. Your grandma loves it.' },
      { label: 'Pass, stay focused', effects: { rel: { coach: 3 } }, result: 'Coach appreciates it.' },
    ],
  },
  {
    id: 'col_major', title: 'Choosing a Major', stages: ['college'], cond: { flags: { chose_major: false } },
    text: 'Your academic advisor needs you to declare a major. The team pushes everyone toward General Studies.',
    choices: [
      { label: 'Business', effects: { academics: -5, flags: { chose_major: true, major_business: true } }, result: 'Harder classes, but you learn how money works.' },
      { label: 'Kinesiology', effects: { train: { strength: 0.6, speed: 0.6 }, flags: { chose_major: true } }, result: 'You study the science of what you do.' },
      { label: 'General Studies', effects: { academics: 10, flags: { chose_major: true } }, result: 'Easy schedule, more time for football.' },
    ],
  },
  {
    id: 'col_starter_battle', title: 'Depth Chart Battle', stages: ['college'], cond: { maxWeek: 3 },
    text: 'A five-star transfer just arrived at your position. Coach {coach} says the starting job is "open."',
    choices: [
      { label: 'Outwork him every day', effects: { train: { skill: 1, speed: 0.5, strength: 0.5 }, mood: -4, health: -4, rel: { coach: 6 } }, result: 'You win the job. He transfers again by spring.' },
      { label: 'Befriend him', effects: { rel: { teammates: 8 }, train: { iq: 0.8 } }, result: 'You push each other. Both of you get better.' },
      { label: 'Complain to Coach', effects: { rel: { coach: -10 } }, result: '"Earn it."' },
    ],
  },
  {
    id: 'col_roommate', title: 'Roommate Trouble', stages: ['college'],
    text: 'Your roommate plays drums. At 2 a.m. Every night.',
    choices: [
      { label: 'Buy noise-cancelling headphones ($250)', effects: { money: -250, health: 4 }, result: 'Silence. Glorious silence.' },
      { label: 'Confront him', chance: { p: 0.5, success: { effects: { health: 6, mood: 3 }, result: 'He apologizes and switches to a practice pad.' }, fail: { effects: { mood: -6 }, result: 'Now he plays louder. Out of spite.' } } },
      { label: 'Move off campus ($220/wk)', effects: { setHousing: 'offcampus', mood: 4 }, result: 'Your own place. Your own rules.' },
    ],
  },
  {
    id: 'col_rival_game_hype', title: 'Rivalry Week', stages: ['college'], cond: { minWeek: 4 },
    text: 'It is rivalry week against {rivalTeam}. {rival} says in a press conference that you are "a system player."',
    choices: [
      { label: 'Fire back at the podium', effects: { fame: 4, rel: { rival: 15, coach: -3 }, flags: { rival_feud: true } }, result: 'ESPN-style shows replay your quote all week.' },
      { label: '"We\'ll see Saturday."', effects: { fame: 2, rel: { coach: 4 } }, result: 'Cool, calm. The fans love it.' },
    ],
  },
  {
    id: 'col_viral_catch', title: 'Viral Moment', stages: ['college'], cond: { minFame: 10 },
    text: 'A clip of you doing a backflip at practice has 2 million views. Brands are DMing you.',
    choices: [
      { label: 'Ride the wave: post more', effects: { fame: 6, rel: { coach: -4 }, sponsor: 0.6 }, result: 'Followers triple. A brand deal lands.' },
      { label: 'Stay low-key', effects: { fame: 2, rel: { coach: 3 } }, result: 'The clip fades. Your focus doesn\'t.' },
    ],
  },
  {
    id: 'col_agent_runner', title: 'The Runner', stages: ['college'], cond: { minOvr: 65, agent: false },
    text: 'A man says he works for a sports agency. He offers a "loan" if you sign with them after college. That is against the rules.',
    choices: [
      { label: 'Take the loan', chance: { p: 0.5, success: { effects: { money: 8000, flags: { owes_agency: true } }, result: 'Money now, problems later.' }, fail: { effects: { money: 8000, fame: -10, suspend: 3, rel: { coach: -15 } }, result: 'Caught. Three-game suspension. Draft stock tanks.' } } },
      { label: 'Walk away', effects: { rel: { family: 3 } }, result: 'Smart. You will hire a real agent at the right time.' },
    ],
  },
  {
    id: 'col_exam_week', title: 'Finals vs. Film', stages: ['college'], cond: { maxAcademics: 70 },
    text: 'Finals overlap with bowl prep. Your GPA is borderline for eligibility.',
    choices: [
      { label: 'Study all week', effects: { academics: 18, energy: -2 }, result: 'Eligible. Exhausted, but eligible.' },
      { label: 'Cram the last night', chance: { p: 0.55, success: { effects: { academics: 8 }, result: 'Barely passed. A miracle.' }, fail: { effects: { academics: -10, suspend: 1 }, result: 'Academic suspension for a game.' } } },
    ],
  },
  {
    id: 'col_injury_hide', title: 'Hiding the Pain', stages: ['college'], cond: { maxHealth: 70 },
    text: 'Your knee has been swelling after practice. If you tell the trainers, you might lose your starting spot.',
    choices: [
      { label: 'Tell the trainers', effects: { health: 12, rel: { coach: 2 }, energy: -1 }, result: 'Treatment and a light week. The knee thanks you.' },
      { label: 'Tape it and play', chance: { p: 0.6, success: { effects: { rel: { coach: 4 }, health: -4 }, result: 'You gut it out. Nobody knows.' }, fail: { effects: { injury: true }, result: 'Something pops. You are going to miss time.' } } },
    ],
  },
  {
    id: 'col_campus_love', title: 'Library Meet-Cute', stages: ['college'], cond: { partner: false },
    text: '{partnerCandidate} sits across from you in the library and asks if you are "the football guy." They have never watched a game.',
    choices: [
      { label: 'Ask them to coffee', effects: { newPartner: true, mood: 10 }, result: 'Two-hour coffee. Zero football talk. Perfect.' },
      { label: '"Just a student, like you."', effects: { mood: 3 }, result: 'Nice chat. Maybe next time.' },
    ],
  },
  {
    id: 'col_partner_jealous', title: 'Away Games', stages: ['college'], cond: { partner: true },
    text: '{partner} feels like they never see you. Travel, practice, film, repeat.',
    choices: [
      { label: 'Plan a weekend trip together', effects: { rel: { partner: 12 }, money: -300, energy: -1 }, result: 'Two days of no football. Exactly what you both needed.' },
      { label: '"This is the season. You knew."', effects: { rel: { partner: -12 } }, result: 'Cold silence for a week.' },
      { label: 'Invite them to every home game', effects: { rel: { partner: 6 }, mood: 2 }, result: 'They start learning the rules. They even have opinions now.' },
    ],
  },
  {
    id: 'col_breakup_risk', title: 'The Talk', stages: ['college', 'pro'], cond: { partner: true, rel: { partner: [0, 30] } },
    text: '{partner} says the two of you need to talk. It doesn\'t sound good.',
    choices: [
      { label: 'Fight for it', chance: { p: 0.5, success: { effects: { rel: { partner: 20 }, mood: 4 }, result: 'Hard conversation. You come out closer.' }, fail: { effects: { breakup: true, mood: -12 }, result: 'It is over. The apartment feels empty.' } } },
      { label: 'Let it go', effects: { breakup: true, mood: -8 }, result: 'An amicable split. Still hurts.' },
    ],
  },
  {
    id: 'col_coach_leaving', title: 'Coach Leaving?', stages: ['college'], cond: { minWeek: 6 },
    text: 'Rumor says Coach {coach} is interviewing for a pro job. Your teammates are rattled.',
    choices: [
      { label: 'Rally the locker room', effects: { rel: { teammates: 8 }, fame: 1 }, result: 'Players-only meeting. You lead it. Something shifts.' },
      { label: 'Ask Coach directly', effects: { rel: { coach: 6 } }, result: '"I\'m here for you, kid." For now.' },
    ],
  },
  {
    id: 'col_declare_whispers', title: 'Draft Whispers', stages: ['college'], cond: { minOvr: 72 },
    text: 'Scouts are saying you could be a first-round pick. Teammates keep asking if you will declare early.',
    choices: [
      { label: '"Focused on this season."', effects: { rel: { coach: 6, teammates: 4 } }, result: 'Exactly what a leader says.' },
      { label: 'Hint you\'re leaving', effects: { fame: 3, rel: { coach: -6 } }, result: 'Mock drafts move you up. Coach moves you down his Christmas list.' },
    ],
  },
  {
    id: 'col_charity_game', title: 'Hospital Visit', stages: ['college'],
    text: 'The team visits a children\'s hospital. A kid named Leo asks you to score a touchdown for him on Saturday.',
    choices: [
      { label: 'Promise him', effects: { mood: 8, fame: 2, flags: { promise_leo: true } }, result: 'He makes you pinky swear.' },
      { label: 'Give him your gloves', effects: { mood: 6, fame: 1 }, result: 'He refuses to take them off.' },
    ],
  },
  {
    id: 'col_spring_ball', title: 'Spring Practice', stages: ['college'], phase: 'offseason',
    text: 'Spring practice is optional for veterans, but the new offensive coordinator wants to see everyone.',
    choices: [
      { label: 'Attend every session', effects: { train: { iq: 1.5, skill: 1 }, rel: { coach: 8 } }, result: 'You learn the new playbook first.' },
      { label: 'Rest and recover', effects: { health: 15, mood: 6, rel: { coach: -4 } }, result: 'Fresh legs for the summer.' },
    ],
  },
  {
    id: 'col_summer_internship', title: 'Summer Internship', stages: ['college'], phase: 'offseason', cond: { flags: { major_business: true } },
    text: 'A local investment firm offers you a summer internship. It would cut into your training.',
    choices: [
      { label: 'Take it', effects: { money: 3000, flags: { money_smart: true }, train: { speed: -0.5 } }, result: 'You learn about compound interest. It will matter later.' },
      { label: 'Train instead', effects: { train: { speed: 1, strength: 1 } }, result: 'Gains over gains.' },
    ],
  },
  {
    id: 'col_party_fight', title: 'Frat Party Fight', stages: ['college'],
    text: 'At a party, a guy starts shoving your teammate. Phones come out.',
    choices: [
      { label: 'Step in and de-escalate', chance: { p: 0.6, success: { effects: { rel: { teammates: 8 }, fame: 1 }, result: 'You calm everyone down. Someone posts it: "Leader."' }, fail: { effects: { fame: -5, suspend: 1, rel: { coach: -8 } }, result: 'A punch is thrown. You are in the video. Suspended.' } } },
      { label: 'Pull your teammate out', effects: { rel: { teammates: 4, coach: 2 } }, result: 'Smart exit.' },
    ],
  },
  {
    id: 'col_nil_collective', title: 'Name & Image Deal', stages: ['college'], cond: { minFame: 25 },
    text: 'The school\'s alumni group offers a legal name-and-image deal: $1,200 a week to appear at events.',
    choices: [
      { label: 'Sign it', effects: { sponsor: 1.0, rel: { teammates: -2 } }, result: 'A real paycheck. Some teammates are jealous.' },
      { label: 'Share it with the O-line', effects: { sponsor: 0.5, rel: { teammates: 12 } }, result: 'You give half to your linemen. They will run through walls for you.' },
    ],
  },
  {
    id: 'col_promise_leo_follow', title: 'For Leo', stages: ['college'], cond: { flags: { promise_leo: true } },
    text: 'Leo\'s mom sends you a video. He watched your last game from his hospital bed, wearing your number.',
    choices: [
      { label: 'Visit him again', effects: { mood: 12, fame: 3, clearFlags: ['promise_leo'] }, result: 'He is going home next week. You both cry.' },
    ],
  },
  {
    id: 'col_transfer_portal', title: 'Transfer Portal', stages: ['college'], phase: 'offseason', cond: { rel: { coach: [0, 35] } },
    text: 'Things with Coach {coach} are rough. A rival program says they would love to have you.',
    choices: [
      { label: 'Stay and fix it', effects: { rel: { coach: 15 } }, result: 'A long talk. A fresh start.' },
      { label: 'Transfer', effects: { transfer: true, rel: { teammates: -10 } }, result: 'New school, new colors, new chance.' },
    ],
  },
  {
    id: 'col_bowl_trip', title: 'Bowl Week Fun', stages: ['college'], cond: { minWeek: 8 },
    text: 'The team hotel has a go-kart track, a buffet and a curfew of 11 p.m.',
    choices: [
      { label: 'Respect curfew', effects: { health: 5, rel: { coach: 4 } }, result: 'Boring. Smart.' },
      { label: 'Sneak out', chance: { p: 0.5, success: { effects: { mood: 10, rel: { teammates: 6 } }, result: 'Best night of college.' }, fail: { effects: { rel: { coach: -12 }, suspend: 1 }, result: 'Bed check. Busted.' } } },
    ],
  },
  {
    id: 'col_heisman_hype', title: 'Trophy Buzz', stages: ['college'], cond: { minFame: 30, minOvr: 70 },
    text: 'Your name is on the Ironstone Trophy watch list. The school wants to launch a campaign website.',
    choices: [
      { label: 'Embrace it', effects: { fame: 6, mood: 3, rel: { teammates: -3 } }, result: 'Billboards with your face appear on campus.' },
      { label: '"It\'s a team award."', effects: { fame: 2, rel: { teammates: 8 } }, result: 'Teammates print "IT\'S A TEAM AWARD" t-shirts.' },
    ],
  },
  {
    id: 'col_mentor_hs', title: 'Hometown Clinic', stages: ['college'], phase: 'offseason',
    text: 'Your old high school asks you to run a youth clinic in {hometown}.',
    choices: [
      { label: 'Run it for free', effects: { fame: 3, mood: 8, rel: { family: 6 } }, result: '200 kids show up. The local news covers it.' },
      { label: 'Charge a fee', effects: { money: 1500, fame: 1 }, result: 'Smaller crowd. Decent money.' },
    ],
  },
  {
    id: 'col_tutor_cheat', title: 'Answer Key', stages: ['college'], cond: { maxAcademics: 60 },
    text: 'A teammate has the answer key for the stats midterm. "Everyone\'s using it."',
    choices: [
      { label: 'Use it', chance: { p: 0.6, success: { effects: { academics: 15 }, result: 'An A. A hollow A.' }, fail: { effects: { academics: -15, suspend: 2, fame: -4 }, result: 'Academic integrity hearing. Two-game suspension.' } } },
      { label: 'Study for real', effects: { academics: 10, energy: -1 }, result: 'A B-minus you earned.' },
    ],
  },
];
