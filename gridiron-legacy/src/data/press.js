// Headline and social-post templates. Tokens: {name} {last} {team} {opp} {score} {yards} {tds} {pos}

export const OUTLETS = {
  hs: ['Tri-County Ledger', 'Friday Night Report', 'Prep Gridiron Weekly'],
  college: ['Campus Chronicle', 'Heartland Sports Desk', 'Saturday Spotlight'],
  pro: ['GGL Network', 'The Gridiron Times', 'Sunday Wire', 'Hashmark Daily'],
};

export const HEADLINES = {
  great_win: [
    '{last} Unstoppable as {team} Roll Past {opp}',
    '{name} Puts On a Show in {score} Rout',
    'Can Anyone Stop {last}? {team} Cruise',
    '{last} Takes Over: {line}',
  ],
  great_loss: [
    "{last}'s Heroics Not Enough as {team} Fall to {opp}",
    'Brilliant {last} Left Wanting More in {score} Loss',
    '{name} Shines in Defeat',
  ],
  good_win: [
    '{team} Handle {opp}, {score}',
    'Steady {last} Guides {team} to Win',
    '{team} Take Care of Business',
  ],
  good_loss: [
    '{team} Come Up Short Against {opp}',
    '{opp} Edge {team} Despite Solid {last} Outing',
  ],
  bad_win: [
    '{team} Survive Despite Quiet Day From {last}',
    'Ugly But Effective: {team} Grind Out Win',
  ],
  bad_loss: [
    '{last} Struggles as {team} Stumble',
    'Rough Day at the Office for {name}',
    'Questions Mount for {last} After {score} Loss',
  ],
  sat_out: ['{team} Play Without {last}', '{last} Watches From Sideline'],
  clutch: ['ICE COLD: {last} Delivers in the Clutch', '{last} Saves the Day Late vs {opp}'],
  title: ['CHAMPIONS! {last} Leads {team} to the {title}', '{team} Win the {title} Behind {last}'],
};

export const FAN_POSTS = {
  great: [
    '{last} is HIM. no debate 🔥', 'just watched {last} cook for 60 minutes straight', 'put {last} in the Hall NOW',
    'my kid wants a {last} jersey for their birthday and honestly same', '{line}?? {last} is a cheat code',
  ],
  good: ['solid day from {last}', '{last} doing {last} things', 'W. {last} quietly balling'],
  bad: ['{last} was cooked today 💀', 'bench {last}?? just asking', 'that was rough to watch ngl', 'someone check on {last}'],
  scandal: ['yikes {last}...', 'not a good look {last}', 'we need answers {last}'],
};
