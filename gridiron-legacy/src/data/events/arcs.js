// Multi-week storylines: each choice sets flags and queues the next chapter a few weeks later
// (effects.chain), so later events remember what you did.
export const ARC_EVENTS = [
  // ---------------------------------------------------------------- locker-room feud
  {
    id: 'arc_feud_1', title: 'Called Out', weight: 0.9, cond: { minWeek: 2, flags: { feud_done: false } },
    text: 'Dre Hollins, one of the team leaders, tells a reporter you are "all about yourself." The quote is everywhere by lunch.',
    choices: [
      { label: 'Talk to him privately', effects: { rel: { teammates: 4 }, flags: { feud_private: true }, chain: { id: 'arc_feud_2b', delay: 2 } }, result: 'You find him in the weight room. It is awkward. It is a start.' },
      { label: 'Fire back on social media', effects: { fame: 1, rel: { teammates: -6 }, flags: { feud_public: true }, chain: { id: 'arc_feud_2a', delay: 2 } }, result: 'Your post gets 40,000 likes. The locker room goes quiet when you walk in.' },
      { label: 'Ignore it', effects: { mood: -2, chain: { id: 'arc_feud_2b', delay: 3 } }, result: 'You keep your head down. People notice.' },
    ],
  },
  {
    id: 'arc_feud_2a', title: 'A Split Locker Room', weight: 0.01, cond: { flags: { feud_public: true } },
    text: 'The team has picked sides: yours and Dre\'s. Coach {coach} calls you both into his office and shuts the door.',
    choices: [
      { label: 'Apologize to the whole team', effects: { rel: { teammates: 8, coach: 3 }, mood: -2, flags: { feud_done: true } }, result: 'You stand up in the team meeting. Dre is the first to clap. It is over.' },
      { label: 'Tell Coach to bench him', effects: { rel: { coach: -6, teammates: -8 }, chain: { id: 'arc_feud_3', delay: 3 } }, result: 'Coach stares at you for a long time. "Get out of my office."' },
    ],
  },
  {
    id: 'arc_feud_3', title: 'Has the Team Quit?', weight: 0.01, cond: { flags: { feud_public: true } },
    text: 'Practice is tense. After a sloppy week, a reporter asks if the team has quit on the season. Everyone looks at you.',
    choices: [
      { label: 'Call a players-only meeting', effects: { rel: { teammates: 10 }, mood: 4, flags: { feud_done: true } }, result: 'Two hours, a lot of yelling, one group hug. The team is back.' },
      { label: '"Ask Dre."', effects: { rel: { teammates: -6 }, mood: -5, fame: -1, flags: { feud_done: true } }, result: 'The season keeps going. The feud never really ends.' },
    ],
  },
  {
    id: 'arc_feud_2b', title: 'Clearing the Air', weight: 0.01, cond: { flags: { feud_done: false } },
    text: 'Dre pulls you aside after practice. "I was out of line. Want to grab food and figure this out?"',
    choices: [
      { label: 'Grab dinner with him', effects: { rel: { teammates: 6 }, mood: 4, train: { iq: 0.3 }, flags: { feud_done: true } }, result: 'Turns out he has been watching your film. He has notes. Good ones.' },
      { label: '"I\'m still mad."', effects: { rel: { teammates: -2 }, flags: { feud_done: true } }, result: 'He shrugs. "Your call." Things stay cold.' },
    ],
  },
  // ---------------------------------------------------------------- love vs. the grind
  {
    id: 'arc_love_1', title: 'Another Cancelled Date', weight: 1, cond: { partner: true, minWeek: 3, flags: { love_done: false } },
    text: '{partner}: "That\'s the third date you\'ve cancelled for extra film. Is this how it\'s going to be?"',
    choices: [
      { label: 'Promise to do better', effects: { mood: 2, flags: { love_promise: true }, chain: { id: 'arc_love_2', delay: 3 } }, result: '"Okay. I\'m holding you to that."' },
      { label: '"Football comes first right now."', effects: { mood: -3, train: { iq: 0.5 }, flags: { love_neglect: true }, chain: { id: 'arc_love_2x', delay: 2 } }, result: 'Silence on the other end. Then: "Got it."' },
    ],
  },
  {
    id: 'arc_love_2', title: 'The Surprise', weight: 0.01, cond: { partner: true, flags: { love_promise: true } },
    text: '{partner} planned a surprise night out this Friday. It is also the night before your biggest film session of the year.',
    choices: [
      { label: 'Go. You promised.', effects: { mood: 8, rel: { partner: 10 }, flags: { love_done: true } }, result: 'Best night you have had in months. You still crush the film session.' },
      { label: 'Skip it for film', effects: { train: { iq: 0.6 }, mood: -4, chain: { id: 'arc_love_end', delay: 1 } }, result: 'You text "sorry, next time." No reply.' },
    ],
  },
  {
    id: 'arc_love_2x', title: 'Radio Silence', weight: 0.01, cond: { partner: true, flags: { love_neglect: true } },
    text: '{partner} has not texted back in two days. Your mom asks what is going on.',
    choices: [
      { label: 'Show up with flowers', effects: { mood: 3, money: -80, rel: { partner: 8 }, flags: { love_done: true } }, result: 'It takes a long talk on the porch. You are okay. Better than okay.' },
      { label: 'Give them space', effects: { chain: { id: 'arc_love_end', delay: 2 } }, result: 'You wait. The silence gets longer.' },
    ],
  },
  {
    id: 'arc_love_end', title: 'It\'s Over', weight: 0.01, cond: { partner: true },
    text: '{partner}: "I can\'t keep waiting for you to have time for me. I\'m done."',
    choices: [
      { label: 'Let them go', effects: { breakup: true, mood: -10, flags: { love_done: true } }, result: 'You sit in your car for an hour before driving home.' },
      { label: 'Beg for one more chance', chance: { p: 0.35, success: { effects: { mood: 5, rel: { partner: 5 }, flags: { love_done: true } }, result: '"One more. That\'s it."' }, fail: { effects: { breakup: true, mood: -12, flags: { love_done: true } }, result: '"Goodbye."' } } },
    ],
  },
  // ---------------------------------------------------------------- the agent's "can't-miss" deal
  {
    id: 'arc_agent_1', title: 'A Can\'t-Miss Deal', weight: 0.9, stages: ['college', 'pro'], cond: { agent: true, flags: { agent_done: false } },
    text: '{agent} calls, breathless: an energy drink wants you as the face of the brand. Huge money, right now. The reviews online are... not great.',
    choices: [
      { label: 'Sign it', effects: { money: 40000, fame: 2, flags: { shady_deal: true }, chain: { id: 'arc_agent_2', delay: 3 } }, result: 'Your face is on 10,000 cans by Friday.' },
      { label: 'Pass', effects: { rel: { agent: -4 }, flags: { agent_done: true } }, result: '{agent} sighs. "Your loss, kid."' },
      { label: 'Ask for the lab reports first', effects: { rel: { agent: -2 }, chain: { id: 'arc_agent_2b', delay: 2 } }, result: '{agent} goes quiet. "Let me... check."' },
    ],
  },
  {
    id: 'arc_agent_2', title: 'Recalled', weight: 0.01, cond: { flags: { shady_deal: true } },
    text: 'The energy drink is pulled from shelves after people get sick. Reporters are camped outside the facility asking for you.',
    choices: [
      { label: 'Apologize publicly', effects: { fame: -2, mood: -3, flags: { agent_done: true } }, result: 'It stings, but people respect you owning it.' },
      { label: 'Blame {agent}', effects: { rel: { agent: -15 }, fame: -1, flags: { agent_done: true } }, result: 'The quote goes viral. {agent} stops returning calls.' },
      { label: 'Fire {agent}', effects: { fireAgent: true, fame: -1, mood: 2, flags: { agent_done: true } }, result: 'You hang up and feel lighter than you have in weeks.' },
    ],
  },
  {
    id: 'arc_agent_2b', title: 'The Lab Reports', weight: 0.01, cond: { agent: true },
    text: 'The reports never come. A week later the drink is recalled nationwide. {agent} calls: "Good instincts, kid."',
    choices: [{ label: 'Smile', effects: { mood: 5, fame: 1, rel: { agent: 6 }, flags: { agent_done: true } }, result: 'Dodged that one.' }],
  },
  // ---------------------------------------------------------------- the rival's trash talk
  {
    id: 'arc_rival_1', title: 'Overrated', weight: 0.9, cond: { minWeek: 2, flags: { rivalarc_done: false } },
    text: '{rival} posts a clip of your worst play with one word: "Overrated." Your phone will not stop buzzing.',
    choices: [
      { label: 'Respond: "See you on the field."', effects: { fame: 2, rel: { rival: 10 }, flags: { rival_beef: true }, chain: { id: 'arc_rival_2', delay: 2 } }, result: 'The internet grabs popcorn.' },
      { label: 'Stay quiet, watch more film', effects: { train: { iq: 0.4 }, mood: 1, chain: { id: 'arc_rival_2', delay: 2 } }, result: 'You screenshot it and set it as your lock screen.' },
    ],
  },
  {
    id: 'arc_rival_2', title: 'The 40-Yard Challenge', weight: 0.01, cond: { flags: { rivalarc_done: false } },
    text: '{rival} shows up at your practice field with a camera crew and challenges you to a 40-yard race. Right now.',
    choices: [
      { label: 'Race him', hint: 'Speed decides it', chance: { p: 0.5, stat: 'speed', success: { effects: { fame: 4, mood: 6, rel: { rival: 6 }, flags: { rivalarc_done: true } }, result: 'You win by a step. The video gets 3 million views.' }, fail: { effects: { fame: -2, mood: -5, flags: { rivalarc_done: true } }, result: 'He beats you by a hair. That one is going to sting until game day.' } } },
      { label: 'Walk away', effects: { mood: 2, fame: -1, flags: { rivalarc_done: true } }, result: '"Save it for Saturday," you say. Half the internet calls you scared.' },
    ],
  },
];
