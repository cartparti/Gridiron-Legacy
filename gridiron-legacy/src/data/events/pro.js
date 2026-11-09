// Pro events.
export const PRO_EVENTS = [
  {
    id: 'pro_rookie_dinner', title: 'Rookie Dinner', stages: ['pro'], weight: 5, cond: { flags: { rookie_dinner_done: false } },
    text: 'Tradition: the rookies pay for the veterans\' team dinner. The bill arrives: $38,000.',
    choices: [
      { label: 'Pay with a smile', effects: { money: -38000, rel: { teammates: 12 }, flags: { rookie_dinner_done: true } }, result: 'The vets toast you. Respect earned.' },
      { label: 'Split it with other rookies', effects: { money: -9000, rel: { teammates: 5 }, flags: { rookie_dinner_done: true } }, result: 'Fair enough. Nobody complains much.' },
      { label: 'Refuse', effects: { rel: { teammates: -15 }, fame: 1, flags: { rookie_dinner_done: true } }, result: 'Your car gets filled with packing peanuts. Twice.' },
    ],
  },
  {
    id: 'pro_agent_pitch', title: 'Agent Pitch', stages: ['pro'], cond: { agent: false }, weight: 4,
    text: 'Super-agent {agentCandidate} wants to represent you. Standard fee: 3% of your contracts. "I get my guys paid."',
    choices: [
      { label: 'Sign with them', effects: { hireAgent: true, rel: { agent: 10 } }, result: 'You have representation. Sponsor calls start coming in.' },
      { label: 'Represent yourself', effects: { mood: 2 }, result: 'You keep the 3%. You also keep all the paperwork.' },
    ],
  },
  {
    id: 'pro_contract_holdout', title: 'Holdout?', stages: ['pro'], phase: 'offseason', cond: { minOvr: 82, agent: true },
    text: '{agent} thinks you are underpaid. "Skip minicamp, and they\'ll come to us."',
    choices: [
      { label: 'Hold out', chance: { p: 0.5, success: { effects: { salaryBump: 0.2, rel: { coach: -10, agent: 8 }, fame: 3 }, result: 'The team blinks. Your salary goes up 20%.' }, fail: { effects: { rel: { coach: -15, teammates: -8 }, fame: -3 }, result: 'The team doesn\'t budge. You report late and look bad.' } } },
      { label: 'Report on time', effects: { rel: { coach: 8, teammates: 4, agent: -6 } }, result: 'Coach notices. Your agent sulks.' },
    ],
  },
  {
    id: 'pro_shoe_campaign', title: 'Signature Shoe', stages: ['pro'], cond: { minFame: 55 },
    text: 'Strideline wants to build a signature cleat around you. Your face in every mall in the country.',
    choices: [
      { label: 'Sign the big deal', effects: { sponsor: 3.0, fame: 6, energy: -1 }, result: 'Your logo is designed. It looks incredible.' },
      { label: 'Negotiate a charity tie-in', effects: { sponsor: 2.2, fame: 8, mood: 5 }, result: 'Every pair sold buys cleats for a kid in {hometown}.' },
    ],
  },
  {
    id: 'pro_late_night_club', title: 'Club Invitation', stages: ['pro'], cond: { minFame: 30 },
    text: 'A famous rapper invites you to their VIP table on Thursday night. Practice is Friday at 8.',
    choices: [
      { label: 'Go, home by midnight', effects: { mood: 8, fame: 2, health: -3 }, result: 'Photos with celebrities. Home by 12:05.' },
      { label: 'Go all night', chance: { p: 0.5, success: { effects: { mood: 14, fame: 5, health: -8 }, result: 'Legendary night. You drag yourself through practice.' }, fail: { effects: { fame: -6, rel: { coach: -12 }, scandal: true }, result: 'Paparazzi catch you stumbling out at 4 a.m. Fined by the team.' } } },
      { label: 'Decline', effects: { rel: { coach: 3 } }, result: 'Early night, sharp practice.' },
    ],
  },
  {
    id: 'pro_scandal_tweet', title: 'Old Posts Resurface', stages: ['pro'], cond: { minFame: 25 },
    text: 'Someone dug up embarrassing posts you made at 15. They are trending.',
    choices: [
      { label: 'Sincere apology', effects: { fame: -2, rel: { coach: 3 }, mood: -4 }, result: 'Most people accept it. The story dies in a day.' },
      { label: 'Delete everything, say nothing', chance: { p: 0.5, success: { effects: { mood: -2 }, result: 'Gone, and somehow forgotten.' }, fail: { effects: { fame: -6, scandal: true }, result: 'Screenshots are forever. It drags on for a week.' } } },
      { label: 'Laugh it off on camera', chance: { p: 0.5, stat: 'iq', success: { effects: { fame: 3 }, result: 'Self-deprecating and charming. Fans love you more.' }, fail: { effects: { fame: -5, scandal: true }, result: 'Read as dismissive. Bad week.' } } },
    ],
  },
  {
    id: 'pro_family_house', title: 'A House for Mom', stages: ['pro'], cond: { minMoney: 400000, flags: { bought_mom_house: false } },
    text: 'Your mom has worked double shifts your whole life. A house near {hometown} costs $350,000.',
    choices: [
      { label: 'Buy it for her', effects: { money: -350000, rel: { family: 30 }, mood: 15, fame: 2, flags: { bought_mom_house: true } }, result: 'She cries for an hour. So do you.' },
      { label: 'Not yet', effects: { rel: { family: -3 } }, result: 'Someday soon.' },
    ],
  },
  {
    id: 'pro_cousin_loan', title: 'Cousin Needs Money', stages: ['pro'], cond: { minMoney: 100000 },
    text: 'Your cousin needs $60,000 for a "can\'t-miss" restaurant idea.',
    choices: [
      { label: 'Give it', chance: { p: 0.3, success: { effects: { money: 20000, rel: { family: 10 } }, result: 'The restaurant is a hit! Your cousin pays you back with interest.' }, fail: { effects: { money: -60000, rel: { family: 4 } }, result: 'It closes in six months. Your cousin is very sorry.' } } },
      { label: 'Say no kindly', effects: { rel: { family: -6 } }, result: 'Thanksgiving is a little tense this year.' },
      { label: 'Help write a business plan', effects: { rel: { family: 6 }, energy: -1 }, result: 'Your cousin realizes the idea needs more planning first. Good outcome.' },
    ],
  },
  {
    id: 'pro_advisor_scam', title: 'Financial Advisor', stages: ['pro'], cond: { minMoney: 250000 },
    text: 'A smooth advisor promises 30% annual returns. "Other players are already in."',
    choices: [
      { label: 'Invest $200K', chance: { p: 0.15, success: { effects: { money: 120000 }, result: 'Somehow it works. You got lucky.' }, fail: { effects: { money: -200000, mood: -12 }, result: 'It was a fraud scheme. The money is gone.' } } },
      { label: 'Get a second opinion', effects: { flags: { money_smart: true } }, result: 'Your second advisor laughs. "30%? Run."' },
    ],
  },
  {
    id: 'pro_business_idea', title: 'Business Idea', stages: ['pro'], cond: { flags: { has_business: false }, minMoney: 50000 },
    text: 'You have an idea for a business. Which one?',
    choices: [
      { label: 'Clothing line ($40K)', effects: { money: -40000, business: 'clothing line' }, result: 'First drop: hoodies with your number. Sold out in an hour.' },
      { label: 'Smoothie bar ($60K)', effects: { money: -60000, business: 'smoothie bar' }, result: 'The "End Zone Blast" is a menu staple.' },
      { label: 'Not now', effects: {}, result: 'Football first.' },
    ],
  },
  {
    id: 'pro_business_expand', title: 'Business Is Booming', stages: ['pro'], cond: { flags: { has_business: true }, minMoney: 150000 },
    text: 'Your {business} is doing well. An investor wants to put in money to open three more locations.',
    choices: [
      { label: 'Expand ($100K)', chance: { p: 0.6, success: { effects: { money: -100000, flags: { business_big: true }, fame: 3 }, result: 'Expansion is a success. Weekly revenue jumps.' }, fail: { effects: { money: -100000, mood: -6 }, result: 'Overextended. The new spots struggle.' } } },
      { label: 'Stay small', effects: { mood: 2 }, result: 'Steady and manageable.' },
    ],
  },
  {
    id: 'pro_teammate_dui', title: 'Teammate in Trouble', stages: ['pro'],
    text: 'At 1 a.m., a teammate calls. They are at a bar and too drunk to drive.',
    choices: [
      { label: 'Go get them', effects: { rel: { teammates: 12 }, health: -3 }, result: 'They never forget it.' },
      { label: 'Send a car service', effects: { rel: { teammates: 5 }, money: -150 }, result: 'Safe at home. Good enough.' },
      { label: 'Ignore the call', effects: { rel: { teammates: -8 } }, result: 'They are arrested the next morning. The team suffers.' },
    ],
  },
  {
    id: 'pro_trade_rumor', title: 'Trade Rumors', stages: ['pro'], cond: { rel: { coach: [0, 40] } },
    text: 'Headlines say your team is shopping you before the deadline.',
    choices: [
      { label: 'Request a trade', chance: { p: 0.5, success: { effects: { trade: true, mood: 4 }, result: 'You are traded! New city, new start.' }, fail: { effects: { rel: { coach: -10 } }, result: 'No deal. Awkward.' } } },
      { label: 'Recommit publicly', effects: { rel: { coach: 10, teammates: 5 } }, result: 'The rumors die down.' },
    ],
  },
  {
    id: 'pro_proposal', title: 'The Ring', stages: ['pro'], cond: { partner: true, rel: { partner: [75, 100] }, flags: { married: false } },
    text: 'You have been carrying a ring for two weeks. {partner} has no idea.',
    choices: [
      { label: 'Propose on the field after a win', chance: { p: 0.85, success: { effects: { flags: { married: true }, mood: 20, fame: 5, rel: { partner: 20 } }, result: 'The jumbotron catches it. 70,000 people cheer. They said yes!' }, fail: { effects: { mood: -15, rel: { partner: -20 } }, result: 'Too public. They said "can we talk about this privately?"' } } },
      { label: 'Propose privately at dinner', effects: { flags: { married: true }, mood: 18, rel: { partner: 20 } }, result: 'Quiet, perfect. They said yes.' },
      { label: 'Wait', effects: {}, result: 'The ring stays in your sock drawer.' },
    ],
  },
  {
    id: 'pro_baby', title: 'Big News', stages: ['pro'], cond: { flags: { married: true, has_kid: false } },
    text: '{partner} hands you a small box. Inside: a tiny jersey with your number.',
    choices: [
      { label: 'Celebrate!', effects: { flags: { has_kid: true }, mood: 20, rel: { partner: 15, family: 15 } }, result: 'You are going to be a parent.' },
    ],
  },
  {
    id: 'pro_kid_birthday', title: 'Birthday Party', stages: ['pro'], cond: { flags: { has_kid: true } }, repeat: true, weight: 0.5,
    text: 'Your kid\'s birthday party is the same afternoon as an optional team walkthrough.',
    choices: [
      { label: 'Go to the party', effects: { mood: 10, rel: { family: 8, partner: 6, coach: -2 } }, result: 'You lose the three-legged race. Best day of the year.' },
      { label: 'Go to the walkthrough', effects: { train: { iq: 0.5 }, rel: { coach: 3, partner: -10, family: -6 } }, result: 'They save you a slice of cake.' },
    ],
  },
  {
    id: 'pro_painkillers', title: 'Pills', stages: ['pro'], cond: { maxHealth: 65 },
    text: 'A team doctor offers strong painkillers so you can practice at full speed this week.',
    choices: [
      { label: 'Take them', effects: { health: 10, energy: 2, flags: { pills: true } }, result: 'You feel nothing. That is the problem.' },
      { label: 'Rest instead', effects: { energy: -2, health: 12 }, result: 'Lighter week, body heals.' },
    ],
  },
  {
    id: 'pro_pills_followup', title: 'Dependency', stages: ['pro'], cond: { flags: { pills: true } },
    text: 'You realize you are reaching for the pills every day now.',
    choices: [
      { label: 'Get help', effects: { clearFlags: ['pills'], mood: -6, health: 6, rel: { family: 10 } }, result: 'The hardest and best decision you have made.' },
      { label: 'You can handle it', chance: { p: 0.4, success: { effects: { clearFlags: ['pills'] }, result: 'You taper off on your own. Lucky.' }, fail: { effects: { health: -20, mood: -12, injury: true, clearFlags: ['pills'] }, result: 'Your body shuts down. Missed time and a hard reckoning.' } } },
    ],
  },
  {
    id: 'pro_rival_pro', title: 'Old Rival', stages: ['pro'],
    text: '{rival}, your rival since high school, is now starting for {rivalTeam}. A reporter asks if you are still friends.',
    choices: [
      { label: '"Respect. Always."', effects: { fame: 2, rel: { rival: -10 } }, result: '{rival} sends a text: "Respect back. Still gonna beat you."' },
      { label: '"Friends? Never were."', effects: { fame: 5, rel: { rival: 15 }, flags: { rival_feud: true } }, result: 'The league marks your matchup as a primetime game.' },
    ],
  },
  {
    id: 'pro_mentor_rookie', title: 'Rookie Asks for Help', stages: ['pro'], cond: { minAge: 27 },
    text: 'A nervous rookie at your position asks if you would watch film with them.',
    choices: [
      { label: 'Take them under your wing', effects: { rel: { teammates: 10, coach: 6 }, fame: 2, energy: -1 }, result: 'Five years later, they thank you in their own award speech.' },
      { label: 'They\'re competition', effects: { rel: { teammates: -6 } }, result: 'They figure it out without you. They remember.' },
    ],
  },
  {
    id: 'pro_contract_ext', title: 'Extension Talks', stages: ['pro'], cond: { minOvr: 80 },
    text: 'The front office wants to discuss an extension mid-season. It could be a distraction.',
    choices: [
      { label: 'Table it until offseason', effects: { rel: { coach: 6 } }, result: 'Focus stays on football.' },
      { label: 'Negotiate now', chance: { p: 0.5, success: { effects: { salaryBump: 0.15 }, result: 'Done in a week. 15% raise.' }, fail: { effects: { mood: -6, rel: { coach: -4 } }, result: 'Talks stall publicly. Awkward locker room.' } } },
    ],
  },
  {
    id: 'pro_gameshow', title: 'Late Night TV', stages: ['pro'], cond: { minFame: 45 },
    text: 'A late night talk show wants you on next Tuesday.',
    choices: [
      { label: 'Do a funny bit', chance: { p: 0.6, success: { effects: { fame: 8, mood: 6 }, result: 'Your bit goes viral. Even non-football fans know your name.' }, fail: { effects: { fame: 2, mood: -3 }, result: 'Jokes land with a thud. The host is nice about it.' } } },
      { label: 'Decline', effects: { rel: { coach: 2 } }, result: 'Tuesday is film day anyway.' },
    ],
  },
  {
    id: 'pro_charity_found', title: 'Start a Foundation', stages: ['pro'], cond: { minMoney: 200000, flags: { foundation: false } },
    text: 'You could start a foundation for youth sports in {hometown}. It costs $150,000 to launch.',
    choices: [
      { label: 'Launch it', effects: { money: -150000, fame: 10, mood: 12, rel: { family: 10 }, flags: { foundation: true } }, result: 'The first field opens next spring. Your name is on the scoreboard.' },
      { label: 'Donate quietly instead', effects: { money: -40000, mood: 8 }, result: 'Nobody knows. That\'s the point.' },
    ],
  },
  {
    id: 'pro_coach_fired', title: 'Coach Fired', stages: ['pro'], cond: { minWeek: 7 },
    text: 'Coach {coach} has been fired midseason. The interim coach wants to change the offense.',
    choices: [
      { label: 'Embrace the change', effects: { rel: { coach: -30 }, newCoach: true, train: { iq: 0.8 } }, result: 'New playbook, new energy.' },
      { label: 'Publicly defend old coach', effects: { rel: { teammates: 6 }, newCoach: true, fame: 2 }, result: 'Loyalty. The new coach takes note, not kindly.' },
    ],
  },
  {
    id: 'pro_supercar_crash', title: 'Fender Bender', stages: ['pro'], cond: { flags: { car_super: true } },
    text: 'You scrape your supercar on a parking garage pillar. $40,000 in damage. A fan films it.',
    choices: [
      { label: 'Laugh, pay, move on', effects: { money: -40000, fame: 1 }, result: '"Parking: not my position." The fans love it.' },
      { label: 'Demand the video be deleted', effects: { money: -40000, fame: -4 }, result: 'Streisand effect. Everyone has seen it now.' },
    ],
  },
  {
    id: 'pro_vet_leadership', title: 'Captain\'s Patch', stages: ['pro'], cond: { rel: { teammates: [70, 100] }, flags: { captain: false } },
    text: 'Your teammates voted. They want you to wear the C as team captain.',
    choices: [
      { label: 'Accept', effects: { flags: { captain: true }, fame: 4, rel: { coach: 8 }, mood: 8 }, result: 'The patch feels heavier than it looks.' },
    ],
  },
  {
    id: 'pro_hof_visit', title: 'Hall of Fame Visit', stages: ['pro'], phase: 'offseason', cond: { minAge: 28 },
    text: 'You visit the Canton Ridge Hall of Fame. You stand in front of the empty wall at the end of the hallway.',
    choices: [
      { label: 'Imagine your bust there', effects: { mood: 6, train: { iq: 0.5 } }, result: 'Motivation for another year.' },
    ],
  },
  {
    id: 'pro_retire_talk', title: 'How Much Longer?', stages: ['pro'], phase: 'offseason', cond: { minAge: 31 },
    text: '{partnerOrFamily} asks over dinner: "How many more years do you want to do this?"',
    choices: [
      { label: '"Until they drag me off."', effects: { rel: { family: -4 }, mood: 4 }, result: 'They sigh, and they support you.' },
      { label: '"Maybe one or two more."', effects: { rel: { family: 8 }, mood: 2 }, result: 'An honest answer. It feels good to say it.' },
    ],
  },
  {
    id: 'pro_offseason_training', title: 'Offseason Program', stages: ['pro'], phase: 'offseason',
    text: 'A famous training guru offers a private six-week program in the desert. $50,000.',
    choices: [
      { label: 'Sign up', effects: { money: -50000, train: { speed: 1.5, strength: 1.5, skill: 1 } }, result: 'Brutal. You come back in the best shape of your life.' },
      { label: 'Vacation instead', effects: { money: -20000, mood: 15, health: 12 }, result: 'Beaches, sleep, and zero cardio.' },
    ],
  },
  {
    id: 'pro_fan_encounter', title: 'Little Fan', stages: ['pro'], repeat: true, weight: 0.6,
    text: 'At the grocery store, a kid in your jersey freezes when they see you.',
    choices: [
      { label: 'Selfie and an autograph', effects: { mood: 5, fame: 1 }, result: 'Their mom thanks you three times.' },
      { label: 'Give them tickets to Sunday', effects: { mood: 7, fame: 1.5, money: -400 }, result: 'Best day of their life.' },
    ],
  },
  {
    id: 'pro_video_game', title: 'Video Game Cover', stages: ['pro'], cond: { minFame: 70, minOvr: 85 },
    text: 'Arcwing Games wants you on the cover of their football game. Some say it is cursed.',
    choices: [
      { label: 'Do it', effects: { sponsor: 2.5, fame: 10, flags: { cover_curse: true } }, result: 'Your face is on millions of screens. Curse? What curse?' },
      { label: 'Decline, superstition', effects: { fame: 2, mood: 2 }, result: 'Nobody gets cursed today.' },
    ],
  },
  {
    id: 'pro_cover_curse', title: 'The Curse', stages: ['pro'], cond: { flags: { cover_curse: true } },
    text: 'You tweak something in practice. Every analyst is saying the word "curse."',
    choices: [
      { label: 'Play through it', chance: { p: 0.5, success: { effects: { clearFlags: ['cover_curse'], fame: 3 }, result: 'Curse broken. You play the best game of your life.' }, fail: { effects: { injury: true, clearFlags: ['cover_curse'] }, result: 'Out a few weeks. The internet goes wild.' } } },
      { label: 'Take precautions', effects: { energy: -2, health: 10, clearFlags: ['cover_curse'] }, result: 'Light week. Curse avoided, maybe.' },
    ],
  },
  {
    id: 'pro_gambling', title: 'Sketchy Offer', stages: ['pro'],
    text: 'A stranger at a gas station offers you $50,000 to "keep it close" this Sunday.',
    choices: [
      { label: 'Report it to the league', effects: { fame: 3, rel: { coach: 6 } }, result: 'The league investigates. You are praised for integrity.' },
      { label: 'Walk away silently', effects: {}, result: 'You never see them again.' },
    ],
  },
];
