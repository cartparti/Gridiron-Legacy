// Personal interactions. Pick a person, pick an action, they react, you pick a response.
//
// who:     which people offer it: coach, teammate, family, partner, agent, rival, fan
// cost:    energy (0 = quick chat, free once per person per week). Anything with cost > 0 uses a day slot.
// money:   dollars spent
// cond:    { minRel, maxRel, stage, notFlag, flag, pro, married }
// lines:   what they say, chosen by relationship tier: low (<35), mid, high (>=70). {name} = their name.
// responses: your reply options -> { label, effects, result, chance? }  (effects use the normal effect keys;
//            "bond" changes that person's relationship; for teammates it is their personal bond)

export const INTERACTIONS = [
  // ------------------------------------------------ coach
  {
    id: 'coach_talk', who: ['coach'], label: 'Chat', cost: 0,
    lines: { low: 'Coach {name} barely looks up. "Make it quick."', mid: '"What\'s on your mind?" Coach {name} pushes a stack of film aside.', high: 'Coach {name} grins. "My favorite player. Sit down."' },
    responses: [
      { label: '"Just wanted to say thanks, Coach."', effects: { bond: 3 }, result: '"Keep working. That\'s thanks enough."' },
      { label: '"What do I need to improve?"', effects: { bond: 2, train: { iq: 0.3 } }, result: 'Coach rattles off three things. You write them down.' },
    ],
  },
  {
    id: 'coach_film', who: ['coach'], label: 'Watch film together', cost: 1,
    lines: { low: '"Fine. Pull up a chair. Don\'t talk during the clips."', mid: '"Good. Let\'s break down their coverage."', high: '"I saved the good stuff for us. Look at this safety."' },
    responses: [
      { label: 'Take detailed notes', effects: { bond: 5, train: { iq: 1.1 } }, result: 'You see the defense in a whole new way.' },
      { label: 'Suggest a new play idea', chance: { p: 0.5, stat: 'iq', success: { effects: { bond: 8, train: { iq: 0.8 } }, result: '"...Huh. That might work." It goes in the playbook.' }, fail: { effects: { bond: -2, train: { iq: 0.5 } }, result: '"Leave the play calling to me."' } } },
    ],
  },
  {
    id: 'coach_snaps', who: ['coach'], label: 'Ask for a bigger role', cost: 0, cond: { minRel: 40 },
    lines: { low: '"A bigger role? Earn it."', mid: 'Coach {name} folds their arms. "Convince me."', high: '"I was thinking the same thing."' },
    responses: [
      { label: '"I\'m ready. Put the ball in my hands."', chance: { p: 0.55, relScale: true, success: { effects: { bond: 2, extraMoment: 1 }, result: 'You get an extra key moment next game.' }, fail: { effects: { bond: -4 }, result: '"Not yet. Keep grinding."' } } },
      { label: '"Whatever the team needs."', effects: { bond: 4 }, result: 'Coach nods. "That\'s the right answer."' },
    ],
  },
  {
    id: 'coach_apologize', who: ['coach'], label: 'Apologize', cost: 0, cond: { maxRel: 40 },
    lines: { low: '"I\'m listening."', mid: '"Go on."', high: '"For what?"' },
    responses: [
      { label: '"I let you and the team down. It won\'t happen again."', effects: { bond: 9 }, result: 'A long pause. "Alright. Clean slate."' },
      { label: '"Sorry you feel that way."', effects: { bond: -5 }, result: 'Wrong move. Very wrong.' },
    ],
  },
  // ------------------------------------------------ teammates
  {
    id: 'mate_talk', who: ['teammate'], label: 'Chat', cost: 0,
    lines: { low: '{name} shrugs. "Sup."', mid: '{name} daps you up. "What\'s good?"', high: '{name} lights up. "My guy! Tell me something good."' },
    responses: [
      { label: 'Talk about the next game', effects: { bond: 3 }, result: 'You both get fired up.' },
      { label: 'Ask about their family', effects: { bond: 5, mood: 1 }, result: 'They show you photos of a new baby niece.' },
      { label: 'Roast their outfit', chance: { p: 0.6, success: { effects: { bond: 6, mood: 2 }, result: 'They roast you back harder. Love it.' }, fail: { effects: { bond: -5 }, result: 'Too far. They walk off.' } } },
    ],
  },
  {
    id: 'mate_hangout', who: ['teammate'], label: 'Hang out', cost: 1, money: 40,
    lines: { low: '"I guess. Where to?"', mid: '"Wings? Wings."', high: '"Finally! I already picked the spot."' },
    responses: [
      { label: 'Wings and video games', effects: { bond: 9, mood: 5 }, result: 'Four hours disappear. Best night all week.' },
      { label: 'Go bowling', effects: { bond: 8, mood: 4 }, result: 'You lose by 60 pins. Nobody lets you forget it.' },
    ],
  },
  {
    id: 'mate_workout', who: ['teammate'], label: 'Train together', cost: 2,
    lines: { low: '"Try to keep up."', mid: '"Let\'s get after it."', high: '"Partner workout. Let\'s GO."' },
    responses: [
      { label: 'Sprints on the hill', effects: { bond: 6, train: { speed: 1 } }, result: 'You both collapse at the top, laughing.' },
      { label: 'Heavy lifting day', effects: { bond: 6, train: { strength: 1 } }, result: 'You spot each other on PRs.' },
    ],
  },
  {
    id: 'mate_prank', who: ['teammate'], label: 'Prank them', cost: 0, cond: { minRel: 50 },
    lines: { low: '', mid: 'You eye {name}\'s locker and a roll of plastic wrap.', high: 'You eye {name}\'s locker and a roll of plastic wrap.' },
    responses: [
      { label: 'Wrap the whole locker', chance: { p: 0.65, success: { effects: { bond: 6, rel: { teammates: 3 }, mood: 3 }, result: 'The whole locker room is crying laughing. Even {name}.' }, fail: { effects: { bond: -8, rel: { coach: -3 } }, result: 'Their game shoes were inside. Not funny.' } } },
      { label: 'Never mind', effects: {}, result: 'Maybe next week.' },
    ],
  },
  // ------------------------------------------------ family
  {
    id: 'fam_call', who: ['family'], label: 'Call home', cost: 0,
    lines: { low: 'Your mom picks up on the fifth ring. "Oh. You remembered our number."', mid: '"Hi sweetie! Are you eating vegetables?"', high: '"There\'s my superstar! Your grandpa watched every snap."' },
    responses: [
      { label: 'Tell them about your week', effects: { bond: 4, mood: 3 }, result: 'An hour later, you feel lighter.' },
      { label: 'Ask how everyone is doing', effects: { bond: 6, mood: 2 }, result: 'You catch up on every cousin and neighbor.' },
    ],
  },
  {
    id: 'fam_dinner', who: ['family'], label: 'Family dinner', cost: 1,
    lines: { low: '"We\'ll set a plate. If you actually show."', mid: '"Pot roast on Sunday. Be there."', high: '"Your favorite. We made extra."' },
    responses: [
      { label: 'Stay late and help with dishes', effects: { bond: 8, mood: 6 }, result: 'Home always fixes something in you.' },
      { label: 'Bring a teammate along', effects: { bond: 6, mood: 5, rel: { teammates: 3 } }, result: 'Your mom adopts them on the spot.' },
    ],
  },
  {
    id: 'fam_help', who: ['family'], label: 'Help out with bills', cost: 0, money: 2000, cond: { pro: true },
    lines: { low: '"We don\'t need charity."', mid: '"You don\'t have to do that..."', high: '"You\'re too good to us."' },
    responses: [
      { label: '"It\'s the least I can do."', effects: { bond: 10, mood: 4 }, result: 'Your mom cries. Your dad pretends not to.' },
    ],
  },
  // ------------------------------------------------ partner
  {
    id: 'part_talk', who: ['partner'], label: 'Talk', cost: 0,
    lines: { low: '{name} sighs. "Now you want to talk?"', mid: '"How was practice?" {name} asks.', high: '{name} kisses your cheek. "I missed you today."' },
    responses: [
      { label: 'Really listen to their day', effects: { bond: 6, mood: 2 }, result: 'You learn a lot. They notice you cared.' },
      { label: 'Vent about football', effects: { bond: 1, mood: 3 }, result: 'They listen. Mostly.' },
    ],
  },
  {
    id: 'part_date', who: ['partner'], label: 'Plan a date', cost: 1, money: 250,
    lines: { low: '"A date? Fine. Impress me."', mid: '"Ooh, where are we going?"', high: '"Surprise me. You always do."' },
    responses: [
      { label: 'Rooftop dinner', effects: { bond: 10, mood: 6 }, result: 'City lights, great food, better company.' },
      { label: 'Movie night in', effects: { bond: 7, mood: 5 }, result: 'Blanket fort. They pick the movie. Perfect.' },
      { label: 'Go-karts', chance: { p: 0.6, success: { effects: { bond: 9, mood: 7 }, result: 'They beat you. Twice. You have never seen them happier.' }, fail: { effects: { bond: 3, health: -3 }, result: 'You spin out into a hay bale. Bruised ego.' } } },
    ],
  },
  {
    id: 'part_fight', who: ['partner'], label: 'Have the hard talk', cost: 0, cond: { maxRel: 40 },
    lines: { low: '"We need to fix this, or end it."', mid: '"Okay. Let\'s talk."', high: '"Is something wrong?"' },
    responses: [
      { label: 'Promise to make more time', effects: { bond: 12 }, result: 'It is a long night, but you come out stronger.' },
      { label: '"Maybe we want different things."', effects: { breakup: true, mood: -8 }, result: 'It is over. Quietly, sadly over.' },
    ],
  },
  {
    id: 'part_movein', who: ['partner'], label: 'Ask to move in', cost: 0, cond: { minRel: 70, notFlag: 'living_together' },
    lines: { low: '', mid: '', high: '{name} looks at you, surprised. "Are you serious?"' },
    responses: [
      { label: '"I want to come home to you."', effects: { bond: 10, mood: 8, flags: { living_together: true } }, result: 'They say yes. Boxes everywhere by Friday.' },
    ],
  },
  {
    id: 'part_propose', who: ['partner'], label: 'Propose', cost: 0, money: 15000, cond: { minRel: 85, notFlag: 'married', flag: 'living_together' },
    lines: { low: '', mid: '', high: 'You drop to one knee. {name} gasps.' },
    responses: [
      { label: '"Will you marry me?"', chance: { p: 0.9, success: { effects: { bond: 15, mood: 20, fame: 3, flags: { married: true } }, result: 'YES! Happy tears all around.' }, fail: { effects: { bond: -10, mood: -12 }, result: '"I... need more time." Oof.' } } },
    ],
  },
  // ------------------------------------------------ agent
  {
    id: 'agent_check', who: ['agent'], label: 'Check in', cost: 0,
    lines: { low: '{name} answers on speaker, typing. "Yeah, yeah, what?"', mid: '"Talk to me, superstar."', high: '"I was just about to call you. Big things coming."' },
    responses: [
      { label: '"Any sponsors interested?"', effects: { bond: 2, sponsorChance: 0.25 }, result: '"I\'ll make some calls."' },
      { label: '"How\'s my market looking?"', effects: { bond: 2 }, result: '"You keep playing like this, we eat."' },
    ],
  },
  {
    id: 'agent_push', who: ['agent'], label: 'Push for a big deal', cost: 1,
    lines: { low: '"You want me to work harder? You want ME to work harder?"', mid: '"Let\'s get aggressive."', high: '"I have three brands on hold. Pick one."' },
    responses: [
      { label: 'Go on a sponsor tour', effects: { bond: 5, sponsorChance: 0.7, mood: -2 }, result: 'Meetings, handshakes, a lot of photos.' },
    ],
  },
  {
    id: 'agent_fire', who: ['agent'], label: 'Fire your agent', cost: 0,
    lines: { low: '"You can\'t fire me, I quit!" ...wait, no.', mid: '"After everything I\'ve done?"', high: '"...Seriously?"' },
    responses: [
      { label: '"It\'s business. Nothing personal."', effects: { fireAgent: true }, result: 'You are on your own now.' },
      { label: '"Just kidding."', effects: { bond: -3 }, result: 'Nobody laughs.' },
    ],
  },
  // ------------------------------------------------ rival
  {
    id: 'rival_trash', who: ['rival'], label: 'Talk trash', cost: 0,
    lines: { low: '{name} smirks. "Oh look, it\'s my biggest fan."', mid: '{name} rolls their eyes. "What now?"', high: '{name} is already in your face. "Say it."' },
    responses: [
      { label: '"See you on the field."', effects: { rel: { rival: 4 }, fame: 0.5 }, result: 'Short, sharp, effective.' },
      { label: 'Go viral with a roast', chance: { p: 0.5, success: { effects: { rel: { rival: 10 }, fame: 3 }, result: 'The internet crowns you the winner.' }, fail: { effects: { rel: { rival: 8 }, fame: -1 }, result: 'Their comeback is better. Ouch.' } } },
    ],
  },
  {
    id: 'rival_peace', who: ['rival'], label: 'Make peace', cost: 0,
    lines: { low: '{name} narrows their eyes. "What\'s the angle?"', mid: '"...Okay. I\'m listening."', high: '"You? Making peace? Wild."' },
    responses: [
      { label: 'Offer a handshake', effects: { rel: { rival: -12 }, mood: 3 }, result: 'Grudging respect. Still gonna try to beat you.' },
    ],
  },
  {
    id: 'rival_challenge', who: ['rival'], label: 'Challenge to a workout', cost: 2,
    lines: { low: '"You\'re on."', mid: '"Loser buys dinner."', high: '"I\'ve been waiting for this."' },
    responses: [
      { label: '40-yard dash, head to head', chance: { p: 0.5, stat: 'speed', success: { effects: { train: { speed: 1.2 }, fame: 2, rel: { rival: 6 } }, result: 'You win by a step. Someone filmed it.' }, fail: { effects: { train: { speed: 1 }, rel: { rival: 4 }, mood: -3 }, result: 'They win by a hair. You buy dinner.' } } },
    ],
  },
  // ------------------------------------------------ fans
  {
    id: 'fan_autograph', who: ['fan'], label: 'Sign an autograph', cost: 0,
    lines: { low: 'A fan squints. "Are you... somebody?"', mid: 'A fan holds out a ball and a marker. "Could you sign this?"', high: 'A fan shakes with excitement. "OH MY GOSH IT\'S YOU!"' },
    responses: [
      { label: 'Sign it and take a selfie', effects: { fame: 0.6, mood: 3 }, result: 'They will frame it.' },
      { label: 'Give them your wristband too', effects: { fame: 1, mood: 4 }, result: 'Their reaction makes your whole week.' },
    ],
  },
];

export const INTERACTION_BY_ID = Object.fromEntries(INTERACTIONS.map((i) => [i.id, i]));
