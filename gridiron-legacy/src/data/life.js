// Life outside football: dating (meeting someone new, first dates, date nights) and hangouts with friends.
// Choice effects use the normal effects keys (mood, health, money, fame, rel: { partner, teammates, coach ... }).

export const PERSONALITIES = [
  { id: 'adventurous', label: 'Adventurous', likes: 'bold', dislikes: 'shy', blurb: 'Always up for something new.' },
  { id: 'chill', label: 'Laid-back', likes: 'fun', dislikes: 'bold', blurb: 'Easygoing, loves a good laugh.' },
  { id: 'ambitious', label: 'Ambitious', likes: 'deep', dislikes: 'fun', blurb: 'Driven and focused on big goals.' },
  { id: 'romantic', label: 'Romantic', likes: 'sweet', dislikes: 'deep', blurb: 'Big heart, notices the little things.' },
];
export const INTERESTS = ['music', 'art', 'cooking', 'hiking', 'movies', 'fashion', 'video games', 'dogs', 'travel', 'science'];

/** First date: 3 rounds. Each choice carries a style that their personality likes or dislikes. */
export const FIRST_DATE = [
  { text: '{name} smiles across the table. "So... what do you actually do when you\'re not playing football?"', choices: [
    { label: '"Honestly? Mostly sleep and eat. Pro napper."', style: 'fun' },
    { label: '"I\'m trying to figure out who I am outside the game."', style: 'deep' },
    { label: '"Let\'s skip small talk. What\'s the craziest thing you\'ve done?"', style: 'bold' },
    { label: '"I like hearing about other people more. Tell me about you."', style: 'sweet' },
  ] },
  { text: '"I\'m really into {interest}," {name} says, eyes lighting up. "Is that weird?"', choices: [
    { label: '"That\'s awesome. Show me sometime?"', style: 'sweet' },
    { label: '"Weird? We should go do it this weekend."', style: 'bold' },
    { label: '"What got you into it? I want the whole story."', style: 'deep' },
    { label: '"Only weird if you\'re better at it than me 😂"', style: 'fun' },
  ] },
  { text: 'The check comes. {name} reaches for it at the same time as you.', choices: [
    { label: 'Grab it first. "I got this. You can get the next one."', style: 'sweet' },
    { label: '"Split it, then dessert somewhere else?"', style: 'bold' },
    { label: 'Thumb war for it.', style: 'fun' },
    { label: '"Let\'s split it. I like keeping things fair."', style: 'deep' },
  ] },
];

export const DATE_VENUES = [
  { id: 'dinner', label: 'Fancy Dinner', money: 90, cost: 1, desc: 'Candles, cloth napkins, tiny portions.', base: { rel: { partner: 6 }, mood: 4 },
    moments: ['The waiter recognizes you and asks for a selfie in the middle of dessert.', 'You order something you can\'t pronounce. It\'s delicious.', '{name} steals your fries. Of course they do.'],
    choices: [
      { label: 'Talk about the future together', effects: { rel: { partner: 4 } }, result: '{name} squeezes your hand. "I like where this is going."' },
      { label: 'Make them laugh all night', effects: { rel: { partner: 3 }, mood: 3 }, result: 'You both laugh so hard the next table stares.' },
      { label: 'Check your phone "real quick"', effects: { rel: { partner: -5 } }, result: '{name} goes quiet. That was not the move.' },
    ] },
  { id: 'movies', label: 'Movie Night', money: 35, cost: 1, desc: 'Popcorn, a dark theater, arm-rest wars.', base: { rel: { partner: 4 }, mood: 3 },
    moments: ['The movie is terrible. You spend it whispering jokes.', '{name} jumps at every scary part and grabs your arm.', 'Somebody behind you won\'t stop talking about your last game.'],
    choices: [
      { label: 'Share the popcorn (give them most of it)', effects: { rel: { partner: 3 } }, result: 'Small things. They notice.' },
      { label: 'Argue about the ending on the way home', effects: { rel: { partner: 2 }, mood: 2 }, result: 'Spirited debate. You were right. Probably.' },
      { label: 'Fall asleep halfway through', effects: { rel: { partner: -2 }, health: 2 }, result: '{name} took a photo of you drooling. It\'s on their phone forever.' },
    ] },
  { id: 'arcade', label: 'Arcade', money: 30, cost: 1, desc: 'Claw machines, air hockey, way too many tickets.', base: { rel: { partner: 5 }, mood: 5 },
    moments: ['You win a giant stuffed bear at the claw machine on the first try.', '{name} destroys you at air hockey. Twice.', 'Kids recognize you and challenge you to a basketball game.'],
    choices: [
      { label: 'Let them win the next game', effects: { rel: { partner: 3 } }, result: 'They know. They pretend not to know. Everyone wins.' },
      { label: 'Go full competitive mode', effects: { mood: 3, rel: { partner: 1 } }, result: 'Trash talk flies. It\'s honestly the best date yet.' },
      { label: 'Spend all your tickets on a gift for them', effects: { rel: { partner: 5 } }, result: 'A plastic ring and a bouncy ball. They wear the ring all week.' },
    ] },
  { id: 'beach', label: 'Beach Day', money: 10, cost: 1, desc: 'Sun, sand and a cooler full of snacks.', base: { rel: { partner: 5 }, mood: 6, health: 2 },
    moments: ['A seagull steals your sandwich. {name} cries laughing.', 'You build a sandcastle shaped like a stadium.', 'The sunset is unreal.'],
    choices: [
      { label: 'Race them into the waves', effects: { mood: 3, rel: { partner: 2 } }, result: 'You lose on purpose. Mostly.' },
      { label: 'Just talk for hours', effects: { rel: { partner: 4 } }, result: 'You lose track of time completely.' },
      { label: 'Throw a football around', effects: { rel: { partner: 2 }, train: { skill: 0.2 } }, result: 'They have a better spiral than half your team.' },
    ] },
  { id: 'concert', label: 'Concert', money: 140, cost: 1, desc: 'Front-row seats to their favorite artist.', base: { rel: { partner: 8 }, mood: 7 },
    moments: ['The artist shouts out "the football star in row one". The crowd goes nuts.', 'You know zero lyrics. You sing anyway.', '{name} cries during the encore.'],
    choices: [
      { label: 'Sing along badly and loudly', effects: { mood: 3, rel: { partner: 3 } }, result: 'Someone films it. It\'s going around online. Worth it.' },
      { label: 'Get them backstage passes', money: 80, effects: { rel: { partner: 6 }, fame: 0.5 }, result: 'They meet their idol. You are officially the best.' },
      { label: 'Leave early to beat traffic', effects: { rel: { partner: -3 }, health: 1 }, result: 'Practical. Not romantic.' },
    ] },
  { id: 'cook', label: 'Cook at Home', money: 20, cost: 1, desc: 'Your kitchen, a recipe, questionable skills.', base: { rel: { partner: 4 }, mood: 3, health: 1 },
    moments: ['The smoke alarm goes off. Twice.', 'You make pasta from scratch. It actually works.', '{name} puts on music and you dance in the kitchen.'],
    choices: [
      { label: 'Follow the recipe exactly', effects: { rel: { partner: 2 }, health: 2 }, result: 'Chef\'s kiss. Who knew?' },
      { label: 'Improvise everything', effects: { mood: 3, rel: { partner: 2 } }, chance: { p: 0.5, failText: 'It\'s inedible. You order pizza and laugh about it.', successText: 'Somehow, it\'s the best thing either of you has ever eaten.' }, result: '' },
      { label: 'Make their favorite meal from memory', effects: { rel: { partner: 5 } }, result: '"You remembered?" They\'re genuinely touched.' },
    ] },
];

export const HANGOUTS = [
  { id: 'bowling', label: 'Bowling Night', money: 25, cost: 1, desc: 'Rented shoes and terrible form.', base: { mood: 5, rel: { teammates: 3 } },
    text: 'The crew takes over two lanes. {mate} insists on bumpers "for the vibe".',
    choices: [
      { label: 'Go for strikes, talk trash', effects: { mood: 2 }, result: 'You bowl a 180. Nobody lets you forget the gutter balls though.' },
      { label: 'Bet loser buys wings', effects: { money: -20, mood: 3, rel: { teammates: 2 } }, result: 'You lose. Wings are on you. Best $20 spent.' },
    ] },
  { id: 'gaming', label: 'Video Game Marathon', money: 0, cost: 1, desc: 'Controllers, energy drinks, no sleep.', base: { mood: 6, rel: { teammates: 2 }, health: -1 },
    text: '{mate} brought the new football game. You\'re rated lower than yourself in real life. Outrageous.',
    choices: [
      { label: 'Play as yourself and dominate', effects: { mood: 3, fame: 0.2 }, result: 'You post the clip. Fans love it.' },
      { label: 'Call it early and sleep', effects: { health: 3, rel: { teammates: -1 } }, result: '"Lame!" But you feel great tomorrow.' },
    ] },
  { id: 'pickup', label: 'Pickup Basketball', money: 0, cost: 1, desc: 'Park court, shirts vs skins.', base: { mood: 4, health: 1, rel: { teammates: 2 } },
    text: 'Locals realize who you are and want to see if you can hoop.',
    choices: [
      { label: 'Show off your hops', effects: { fame: 0.4, mood: 2 }, chance: { p: 0.85, failText: 'You land weird on your ankle. Ouch. Nothing serious, but it\'s sore.', failEffects: { health: -8 }, successText: 'You throw down a dunk. The court erupts.' }, result: '' },
      { label: 'Play team ball, pass a lot', effects: { rel: { teammates: 3 } }, result: 'Nobody expected a football player to have court vision.' },
    ] },
  { id: 'bonfire', label: 'Beach Bonfire', money: 15, cost: 1, desc: 'Fire, s\'mores, and stories.', base: { mood: 6, rel: { teammates: 3 } },
    text: 'Someone brings a guitar. {mate} tells a story about you from freshman year that is 90% made up.',
    choices: [
      { label: 'Tell an even crazier story back', effects: { mood: 3, rel: { teammates: 2 } }, result: 'Legendary. Everyone is crying laughing.' },
      { label: 'Deep talk by the fire', effects: { mood: 4, rel: { teammates: 3 } }, result: 'You find out {mate} almost quit last year. You\'re glad they didn\'t.' },
    ] },
  { id: 'party', label: 'House Party', money: 0, cost: 1, desc: 'Loud music, big crowd. Could get messy.', base: { mood: 7, fame: 0.4 },
    text: 'The house is packed. Phones are everywhere. {mate} hands you a cup.',
    choices: [
      { label: 'Stay a couple hours, then head out', effects: { mood: 2, rel: { coach: 1 } }, result: 'Fun, responsible, home by midnight.' },
      { label: 'Party until sunrise', effects: { mood: 4, health: -6 }, chance: { p: 0.65, failText: 'A video of you surfaces online. Coach is NOT happy.', failEffects: { rel: { coach: -6 }, fame: -1, scandal: true }, successText: 'Best night of the year. Nobody filmed anything... you hope.' }, result: '' },
    ] },
  { id: 'roadtrip', label: 'Road Trip', money: 60, cost: 2, desc: 'Gas station snacks and a long playlist.', base: { mood: 9, rel: { teammates: 4 } },
    text: 'Four of you, one car, no plan. {mate} is in charge of music. Bad idea.',
    choices: [
      { label: 'Take the scenic route', effects: { mood: 3 }, result: 'Mountains, a lake, a diner with the best pie on Earth.' },
      { label: 'Find the biggest roadside attraction', effects: { mood: 3, fame: 0.3, rel: { teammates: 2 } }, result: 'A 40-foot fiberglass cow. You take 200 photos.' },
    ] },
];
