// Events that can happen at any career stage.
export const ANY_EVENTS = [
  {
    id: 'any_burnout', title: 'Running on Empty', repeat: true, cond: { maxMood: 28 },
    text: 'You stare at the ceiling at 3 a.m. Football feels like a job you hate. Your mood is in the basement.',
    choices: [
      { label: 'Take a mental health day', effects: { mood: 15, energy: -2, rel: { coach: -2 } }, result: 'You turn off your phone and go fishing. It helps.' },
      { label: 'Call home', effects: { mood: 10, rel: { family: 6 } }, result: 'Your mom talks for an hour. You mostly listen. It helps.' },
      { label: 'Push through', effects: { mood: -3, train: { strength: 0.5 } }, result: 'You lift angry. It does not help.' },
    ],
  },
  {
    id: 'any_bad_sleep', title: 'Insomnia', repeat: true, weight: 0.6,
    text: 'You can\'t sleep before game week. Your mind keeps replaying plays.',
    choices: [
      { label: 'Get up and watch film', effects: { train: { iq: 0.8 }, energy: -1 }, result: 'Tired, but you spotted something.' },
      { label: 'Meditation app', effects: { mood: 3, health: 2 }, result: 'Out by midnight.' },
    ],
  },
  {
    id: 'any_flu', title: 'Flu Season', weight: 0.7,
    text: 'Half the locker room has the flu. You feel a tickle in your throat.',
    choices: [
      { label: 'Rest and fluids', effects: { energy: -2, health: 6 }, result: 'You beat it before it beats you.' },
      { label: 'Ignore it', chance: { p: 0.5, success: { effects: {}, result: 'False alarm.' }, fail: { effects: { health: -18, energy: -3 }, result: 'Full flu. Brutal week.' } } },
    ],
  },
  {
    id: 'any_grandparent', title: 'Grandpa\'s Advice', weight: 0.8,
    text: 'Your grandpa, who played in the old days, calls. "Want to know the secret? Low pad level. Always."',
    choices: [
      { label: 'Visit him', effects: { rel: { family: 8 }, mood: 6, train: { strength: 0.4 } }, result: 'He shows you old photos and a technique nobody uses anymore.' },
      { label: 'Thank him on the phone', effects: { rel: { family: 2 } }, result: '"Love you, kid."' },
    ],
  },
  {
    id: 'any_lost_wallet', title: 'Lost Wallet', weight: 0.5,
    text: 'You find a wallet on the sidewalk with $400 in cash and an ID.',
    choices: [
      { label: 'Return it', effects: { mood: 5, fame: 0.5 }, result: 'The owner posts about it. "Classy athlete!"' },
      { label: 'Keep the cash', effects: { money: 400, mood: -4 }, result: 'Easy money. It feels bad.' },
    ],
  },
  {
    id: 'any_teammate_birthday', title: 'Surprise Party', weight: 0.8, repeat: true,
    text: 'The team is throwing a surprise party for your center. Everyone is chipping in.',
    choices: [
      { label: 'Chip in and plan it', effects: { money: -100, rel: { teammates: 7 }, mood: 4, energy: -1 }, result: 'Your center cries. Linemen are big softies.' },
      { label: 'Just show up', effects: { rel: { teammates: 2 } }, result: 'Good cake.' },
    ],
  },
  {
    id: 'any_dog', title: 'A Stray Dog', weight: 0.6, cond: { flags: { has_dog: false } },
    text: 'A scruffy dog follows you home from practice and sits on your doorstep.',
    choices: [
      { label: 'Adopt him', effects: { flags: { has_dog: true }, mood: 12, money: -300 }, result: 'You name him Blitz. He eats your cleats on day one.' },
      { label: 'Take him to a shelter', effects: { mood: 2 }, result: 'He gets adopted within a week.' },
    ],
  },
  {
    id: 'any_dog_happy', title: 'Blitz', weight: 0.4, repeat: true, cond: { flags: { has_dog: true } },
    text: 'Blitz greets you at the door after a terrible practice, tail going a hundred miles an hour.',
    choices: [{ label: 'Belly rubs', effects: { mood: 8 }, result: 'Instantly better.' }],
  },
  {
    id: 'any_weather', title: 'Snow Game Forecast', weight: 0.6,
    text: 'The forecast for game day: heavy snow. Coach is changing the game plan.',
    choices: [
      { label: 'Practice in the cold all week', effects: { health: -4, train: { strength: 0.6 }, rel: { coach: 4 } }, result: 'Frozen fingers, ready for anything.' },
      { label: 'Stay indoors, stay healthy', effects: { health: 3 }, result: 'Warm and well-rested.' },
    ],
  },
  {
    id: 'any_podcast', stages: ['college', 'pro'], title: 'Podcast Invite', cond: { minFame: 15 }, weight: 0.8,
    text: 'A popular football podcast wants you for an hour-long interview.',
    choices: [
      { label: 'Open up about your journey', effects: { fame: 4, mood: 3, rel: { family: 3 } }, result: 'Your story about {hometown} resonates. Downloads explode.' },
      { label: 'Talk trash about {rival}', effects: { fame: 5, rel: { rival: 15, coach: -3 } }, result: 'Clickbait gold.' },
      { label: 'Decline', effects: {}, result: 'Not everything needs a microphone.' },
    ],
  },
  {
    id: 'any_injury_scare', title: 'Tweaked Something', weight: 0.7, cond: { injured: false },
    text: 'You felt a twinge in your hamstring during sprints.',
    choices: [
      { label: 'Shut it down for the week', effects: { energy: -3, health: 8 }, result: 'Better safe than sorry.' },
      { label: 'Keep going', chance: { p: 0.65, success: { effects: { train: { speed: 0.5 } }, result: 'It loosens up. Nothing serious.' }, fail: { effects: { injury: true }, result: 'Pulled hamstring. You will miss time.' } } },
    ],
  },
  {
    id: 'any_superstition', title: 'Lucky Socks', weight: 0.6,
    text: 'You played your best game wearing mismatched socks. Your teammates say you can never wash them again.',
    choices: [
      { label: 'Never wash them', effects: { mood: 5, rel: { teammates: 4 }, flags: { lucky_socks: true } }, result: 'The smell is now a team legend.' },
      { label: 'Wash them, you\'re not crazy', effects: { rel: { teammates: -1 } }, result: 'Your teammates are concerned for you.' },
    ],
  },
  {
    id: 'any_hometown_hero', stages: ['college', 'pro'], title: 'Hometown Mural', cond: { minFame: 40 }, weight: 0.8,
    text: 'An artist in {hometown} wants to paint a mural of you on the side of the old diner.',
    choices: [
      { label: 'Attend the unveiling', effects: { fame: 4, mood: 10, rel: { family: 8 } }, result: 'The whole town comes out. There is a marching band.' },
      { label: 'Humbly decline', effects: { fame: 1 }, result: 'They paint a giant football instead.' },
    ],
  },
  {
    id: 'any_tax_bill', stages: ['pro'], title: 'Tax Time', cond: { minMoney: 20000 }, weight: 0.6, phase: 'offseason',
    text: 'Your accountant calls with bad news: you owe more taxes than you thought.',
    choices: [
      { label: 'Pay it', effects: { moneyPct: -0.08 }, result: 'Painful. Legal.' },
      { label: 'Hire a better accountant ($3K)', effects: { money: -3000, moneyPct: -0.04, flags: { money_smart: true } }, result: 'Half the damage. Worth it.' },
    ],
  },
  {
    id: 'any_gym_buddy', title: 'Training Partner', weight: 0.7,
    text: 'A former track star offers to train with you three mornings a week.',
    choices: [
      { label: 'Sign up', effects: { train: { speed: 1.5 }, energy: -1 }, result: 'Your 40 time drops.' },
      { label: 'Not interested', effects: {}, result: 'Maybe another time.' },
    ],
  },
  {
    id: 'any_family_emergency', title: 'Family Emergency', weight: 0.5,
    text: 'Your mom calls crying. Your grandma is in the hospital. Game day is in four days.',
    choices: [
      { label: 'Fly home immediately', effects: { energy: -4, rel: { family: 15, coach: -2 }, mood: -4 }, result: 'You hold her hand. She tells you to go win one for her.' },
      { label: 'Call every night, stay with the team', effects: { rel: { family: -8 }, mood: -8 }, result: 'She pulls through. You wish you had been there.' },
    ],
  },
  {
    id: 'any_crypto', stages: ['college', 'pro'], title: 'Hot Tip', weight: 0.5, cond: { minMoney: 2000 },
    text: 'A teammate swears a meme coin called GRIDCOIN is about to "moon."',
    choices: [
      { label: 'Put in 25% of your cash', chance: { p: 0.25, success: { effects: { moneyPct: 0.5 }, result: 'It moons! You cash out at the top. Genius.' }, fail: { effects: { moneyPct: -0.22 }, result: 'It crashes 90% overnight.' } } },
      { label: 'Pass', effects: {}, result: 'Two weeks later it is worth zero.' },
    ],
  },
  {
    id: 'any_rival_respect', title: 'Unexpected Message', weight: 0.6, cond: { rel: { rival: [60, 100] } },
    text: '{rival} sends you a DM after your last game: "That was impressive. Don\'t tell anyone I said that."',
    choices: [
      { label: 'Respond with respect', effects: { rel: { rival: -15 }, mood: 4 }, result: 'Rivals can be friends. Sort of.' },
      { label: 'Screenshot and post it', effects: { fame: 3, rel: { rival: 20 } }, result: 'Brutal. The feud is back on.' },
    ],
  },
  {
    id: 'any_new_playbook', title: 'Playbook Overhaul', weight: 0.6,
    text: 'The coaching staff installs a new set of plays. Some players are struggling to learn them.',
    choices: [
      { label: 'Host a study session', effects: { train: { iq: 1 }, rel: { teammates: 6, coach: 4 }, energy: -1 }, result: 'You become the guy everyone asks.' },
      { label: 'Learn it on your own', effects: { train: { iq: 1.2 } }, result: 'You have it down in two days.' },
    ],
  },
  {
    id: 'any_social_troll', title: 'Online Troll', weight: 0.6, cond: { minFame: 10 },
    text: 'A troll has commented on every one of your posts for a month. Today it got personal.',
    choices: [
      { label: 'Block and move on', effects: { mood: 2 }, result: 'Out of sight, out of mind.' },
      { label: 'Clap back', chance: { p: 0.5, success: { effects: { fame: 3, mood: 4 }, result: 'Your reply goes viral for all the right reasons.' }, fail: { effects: { fame: -3, scandal: true }, result: 'You lose your cool. It becomes a story.' } } },
    ],
  },
  {
    id: 'any_offseason_vacation', title: 'Offseason Plans', phase: 'offseason',
    text: 'The season is over. How do you spend the first two weeks?',
    choices: [
      { label: 'Beach trip', effects: { money: -1500, mood: 12, health: 10 }, result: 'Sun, sand, sleep.' },
      { label: 'Straight back to the gym', effects: { train: { strength: 1, speed: 1 }, mood: -4 }, result: 'While they rest, you work.' },
      { label: 'Go home to {hometown}', effects: { rel: { family: 10 }, mood: 8 }, result: 'Mom\'s cooking. Old friends. Your childhood bedroom.' },
    ],
  },
  {
    id: 'any_mentor_call', title: 'An Old Coach Calls', weight: 0.5, phase: 'offseason',
    text: 'Your peewee coach calls out of the blue. They are retiring and wanted you to know you were their favorite.',
    choices: [
      { label: 'Go to the retirement party', effects: { mood: 10, fame: 1, rel: { family: 4 } }, result: 'You give a speech. There is not a dry eye in the room.' },
      { label: 'Send a gift', effects: { money: -200, mood: 4 }, result: 'Coach sends back a photo of you at age 8, in a helmet too big for you.' },
    ],
  },
  {
    id: 'any_sleep_study', title: 'Sleep Science', weight: 0.5,
    text: 'The team nutritionist says your sleep is terrible. She recommends a strict routine.',
    choices: [
      { label: 'Commit to it', effects: { health: 8, mood: -2, flags: { sleep_routine: true } }, result: 'Lights out at 10 p.m. You feel incredible.' },
      { label: 'Nah', effects: {}, result: 'You keep scrolling at 1 a.m.' },
    ],
  },
  {
    id: 'any_charity_auction', stages: ['college', 'pro'], title: 'Charity Auction', weight: 0.6, cond: { minFame: 20 },
    text: 'A children\'s charity is auctioning "lunch with you." Bids are already high.',
    choices: [
      { label: 'Add a signed jersey too', effects: { fame: 3, mood: 6 }, result: 'It raises $40,000 for kids.' },
      { label: 'Just the lunch', effects: { fame: 1.5, mood: 3 }, result: 'Lunch is with a sweet retired couple. They knew your grandpa.' },
    ],
  },
  {
    id: 'any_teammate_fight', title: 'Locker Room Tension', weight: 0.6,
    text: 'Two of your teammates are about to fight over a blown assignment.',
    choices: [
      { label: 'Get between them', chance: { p: 0.65, success: { effects: { rel: { teammates: 10, coach: 4 } }, result: 'They cool off. You earn respect from both.' }, fail: { effects: { health: -6, rel: { teammates: 3 } }, result: 'You catch an elbow, but the fight stops.' } } },
      { label: 'Let the coaches handle it', effects: { rel: { teammates: -3 } }, result: 'It gets ugly before it gets better.' },
    ],
  },
  {
    id: 'any_doc_film', stages: ['college', 'pro'], title: 'Documentary Crew', weight: 0.5, cond: { minFame: 35 },
    text: 'A streaming service wants to follow you with cameras for a season-long documentary.',
    choices: [
      { label: 'Let them in', effects: { fame: 8, sponsor: 0.8, rel: { teammates: -4, coach: -3 }, mood: -3 }, result: 'Cameras everywhere. Ratings will be huge.' },
      { label: 'Keep your privacy', effects: { mood: 2 }, result: 'Some things are just for you.' },
    ],
  },
];
