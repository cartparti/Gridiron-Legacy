// Mid-game events: short decisions that pop up DURING a game.
//
// trigger: when it can fire
//   pregame      before kickoff
//   halftime     at the half
//   afterTD      right after you score / make a big defensive play
//   afterBad     right after a turnover or a bad moment of yours
//   bigHit       after a moment where you took contact
//   clutch       4th quarter, close game, before your next moment
//   random       between drives, any time
//   presnap      at the line, right before one of your key moments (affects that play)
// cond: { rivalry, playoff, trailing, leading, positions, weather, minFame }
// choices[].effects: normal effects (mood, fame, rel, health, injury ...)
// choices[].game:    effects on THIS game:
//   tol        timing window bonus for the rest of the game (e.g. 0.06 = 6% wider)
//   momentum   swing momentum (-1..1)
//   extra      add one extra key moment for you later this game
//   skip       you sit out your next key moment
//   flag       15-yard penalty on your team's next key moment
//   oppBoost   the opponent's next drive is more dangerous
//   points     points for your team right now (e.g. a 2-point conversion)

export const GAME_EVENTS = [
  // ---------------- pregame
  {
    id: 'g_rival_tunnel', trigger: 'pregame', cond: { rivalry: true }, title: 'Tunnel Talk',
    text: '{rival} bumps your shoulder in the tunnel. "Hope you brought a helmet for your ego."',
    choices: [
      { label: 'Get in their face', effects: { fame: 1, rel: { rival: 8 } }, game: { momentum: 0.15, tol: -0.03 }, result: 'Both benches spill out. You are fired up, maybe too fired up.' },
      { label: 'Smile and walk away', effects: { rel: { coach: 2 } }, game: { tol: 0.04 }, result: 'Ice in your veins. Your rival looks rattled.' },
    ],
  },
  {
    id: 'g_crowd_loud', trigger: 'pregame', cond: { playoff: true }, title: 'Hostile Crowd',
    text: 'The stadium is shaking. You can barely hear the play call in the huddle.',
    choices: [
      { label: 'Wave your arms: get louder!', effects: { fame: 1 }, game: { momentum: 0.2, tol: -0.02 }, result: 'Half the stadium boos you. The other half loves it.' },
      { label: 'Use hand signals all game', effects: { rel: { coach: 2 } }, game: { tol: 0.03 }, result: 'Silent, efficient, focused.' },
    ],
  },
  {
    id: 'g_weather_gear', trigger: 'pregame', cond: { weather: ['rain', 'snow'] }, title: 'Slick Conditions',
    text: 'The field is a mess. The equipment manager offers sticky gloves and longer cleats.',
    choices: [
      { label: 'Take the gear', effects: {}, game: { tol: 0.05 }, result: 'Your hands feel like Velcro.' },
      { label: 'Stick with what you know', effects: { mood: 2 }, game: {}, result: 'No surprises. Hopefully.' },
    ],
  },
  {
    id: 'g_pregame_speech', trigger: 'pregame', cond: { minFame: 20 }, title: 'Pregame Huddle',
    text: 'The team looks at you. Somebody needs to say something.',
    choices: [
      { label: 'Fiery speech', effects: { rel: { teammates: 4 } }, game: { momentum: 0.25 }, result: 'Helmets slam. The sideline is bouncing.' },
      { label: 'Calm, short and focused', effects: { rel: { coach: 3 } }, game: { tol: 0.03 }, result: '"Do your job." Nods all around.' },
      { label: 'Let the captains talk', effects: {}, game: {}, result: 'You stay in your zone.' },
    ],
  },
  {
    id: 'g_family_stands', trigger: 'pregame', title: 'Family in the Stands',
    text: 'You spot your family in the stands holding a giant sign with your face on it.',
    choices: [
      { label: 'Point at them', effects: { mood: 5, rel: { family: 4 } }, game: { momentum: 0.05 }, result: 'Your mom screams loud enough to hear from the field.' },
      { label: 'Stay locked in', effects: {}, game: { tol: 0.02 }, result: 'Game face on.' },
    ],
  },
  // ---------------- after a TD / big play
  {
    id: 'g_celebrate', trigger: 'afterTD', title: 'Celebration Time',
    text: 'You just made the play of the game. The cameras are on you.',
    choices: [
      { label: 'Choreographed dance', effects: { fame: 2 }, game: { momentum: 0.15 }, chance: { p: 0.65, failGame: { flag: true }, failText: 'Flag! Excessive celebration. 15 yards.' }, result: 'The crowd goes wild. Instant meme.' },
      { label: 'Hand the ball to the ref', effects: { rel: { coach: 3 } }, game: { tol: 0.02 }, result: '"Act like you\'ve been there before."' },
      { label: 'Give the ball to a kid in the stands', effects: { fame: 1.5, mood: 3 }, game: { momentum: 0.1 }, result: 'That kid will remember this forever.' },
    ],
  },
  {
    id: 'g_two_point', trigger: 'afterTD', cond: { trailing: true }, title: 'Go for Two?',
    text: 'Coach is thinking about a two-point conversion and looks at you. "Your call."',
    choices: [
      { label: 'Go for two', effects: {}, game: {}, chance: { p: 0.48, stat: 'skill', successGame: { points: 1, momentum: 0.2 }, successText: 'Converted! Two points, not one.', failGame: { points: -1, momentum: -0.1 }, failText: 'Stopped short. No points.' }, result: '' },
      { label: 'Kick the extra point', effects: {}, game: {}, result: 'Safe and sure.' },
    ],
  },
  {
    id: 'g_taunt', trigger: 'afterTD', cond: { rivalry: true }, title: 'Taunt Opportunity',
    text: '{rival} is standing right there on their sideline, sulking.',
    choices: [
      { label: 'Spike it at their feet', effects: { fame: 2, rel: { rival: 10 } }, game: { flag: true, momentum: 0.1 }, result: 'Flag, worth it?' },
      { label: 'Ignore it', effects: { rel: { coach: 2 } }, game: {}, result: 'Classy. That stings even more.' },
    ],
  },
  // ---------------- after a bad play
  {
    id: 'g_coach_yell', trigger: 'afterBad', title: 'Coach Is Furious',
    text: 'Coach {coach} grabs your face mask on the sideline. "WHAT WAS THAT?"',
    choices: [
      { label: '"My fault. Won\'t happen again."', effects: { rel: { coach: 3 } }, game: { tol: 0.02 }, result: 'Coach lets go. "Show me."' },
      { label: 'Yell back', effects: { rel: { coach: -8 } }, game: { skip: true, momentum: -0.05 }, result: 'Coach sits you for a series.' },
      { label: 'Walk away, reset', effects: {}, game: { tol: 0.01 }, result: 'Deep breaths on the bench.' },
    ],
  },
  {
    id: 'g_shake_it_off', trigger: 'afterBad', title: 'Shake It Off',
    text: 'A veteran teammate sits next to you on the bench after that mistake.',
    choices: [
      { label: 'Listen to the advice', effects: { rel: { teammates: 3 } }, game: { tol: 0.04 }, result: '"Next play mentality." It works.' },
      { label: 'Stew on it', effects: { mood: -3 }, game: { tol: -0.03 }, result: 'You replay it in your head for a quarter.' },
    ],
  },
  {
    id: 'g_boo_birds', trigger: 'afterBad', cond: { minFame: 25 }, title: 'Boos Rain Down',
    text: 'The home crowd is booing. A few are chanting the backup\'s name.',
    choices: [
      { label: 'Cup your ear at them', effects: { fame: -1 }, game: { momentum: 0.05 }, result: 'Bold. Now you HAVE to deliver.' },
      { label: 'Tune it out', effects: {}, game: { tol: 0.02 }, result: 'Noise is just noise.' },
    ],
  },
  // ---------------- big hits
  {
    id: 'g_big_hit', trigger: 'bigHit', title: 'Big Hit',
    text: 'You got absolutely leveled on that play. Your ears are ringing.',
    choices: [
      { label: 'Pop right up, stay in', effects: { rel: { teammates: 3 } }, game: { tol: -0.04 }, chance: { p: 0.82, failText: 'Something isn\'t right. You leave the game hurt.', failEffects: { injury: true } }, result: 'You pop up and the sideline erupts.' },
      { label: 'Get checked by trainers (miss a series)', effects: { health: 6 }, game: { skip: true }, result: 'Cleared. Back next series.' },
    ],
  },
  {
    id: 'g_hit_retaliate', trigger: 'bigHit', title: 'Late Hit',
    text: 'That hit came after the whistle. The defender is standing over you, talking trash.',
    choices: [
      { label: 'Shove back', effects: { fame: 1 }, game: { flag: true, momentum: 0.05 }, result: 'Offsetting penalties... no, just yours.' },
      { label: 'Let the refs handle it', effects: { rel: { coach: 3 } }, game: { momentum: 0.1 }, result: 'Flag on THEM. 15 free yards.' },
    ],
  },
  // ---------------- halftime
  {
    id: 'g_halftime_down', trigger: 'halftime', cond: { trailing: true }, title: 'Halftime: Down',
    text: 'The locker room is silent. You are down at the half. Coach looks around for a leader.',
    choices: [
      { label: 'Stand up and speak', effects: { rel: { teammates: 5 } }, game: { momentum: 0.3 }, result: 'By the end, guys are punching lockers. Good energy.' },
      { label: 'Ask Coach for more touches', effects: { rel: { coach: -2 } }, game: { extra: true }, result: '"You want the ball? You got it."' },
      { label: 'Ice and focus', effects: { health: 5 }, game: { tol: 0.03 }, result: 'Quiet prep for the second half.' },
    ],
  },
  {
    id: 'g_halftime_up', trigger: 'halftime', cond: { leading: true }, title: 'Halftime: Up',
    text: 'You are winning at the half. Coach warns everyone not to get comfortable.',
    choices: [
      { label: 'Keep the pedal down', effects: {}, game: { momentum: 0.1 }, result: 'Nobody relaxes.' },
      { label: 'Rest your legs', effects: { health: 6 }, game: { tol: 0.02 }, result: 'Fresh legs for the second half.' },
    ],
  },
  {
    id: 'g_halftime_adjust', trigger: 'halftime', title: 'Halftime Adjustments',
    text: 'The coordinator spots a weakness on the whiteboard. "Watch their #24. Bites on everything."',
    choices: [
      { label: 'Study the tape on the tablet', effects: { train: { iq: 0.3 } }, game: { tol: 0.05 }, result: 'You see it now. It is going to be a good half.' },
      { label: 'Trust your instincts', effects: {}, game: { momentum: 0.05 }, result: 'You already knew.' },
    ],
  },
  // ---------------- clutch
  {
    id: 'g_clutch_ball', trigger: 'clutch', cond: { positions: ['QB', 'RB', 'WR'] }, title: 'Put It in My Hands',
    text: 'Fourth quarter, close game. The huddle is tense. Do you ask for the ball?',
    choices: [
      { label: '"Give me the ball."', effects: { fame: 1 }, game: { extra: true, tol: -0.02 }, result: 'All eyes on you now.' },
      { label: '"Trust the play call."', effects: { rel: { coach: 2 } }, game: { tol: 0.02 }, result: 'Calm and collected.' },
    ],
  },
  {
    id: 'g_clutch_defense', trigger: 'clutch', cond: { positions: ['CB', 'DT'] }, title: 'Shadow Their Best',
    text: 'Fourth quarter. Their star receiver is killing the other corner. Coach asks if you want the assignment.',
    choices: [
      { label: '"Put me on their WR1."', effects: { fame: 1 }, game: { extra: true, tol: -0.02 }, result: 'You walk across the field. The crowd notices.' },
      { label: '"I\'ll play my side."', effects: {}, game: { tol: 0.02 }, result: 'Stay disciplined.' },
    ],
  },
  {
    id: 'g_clutch_timeout', trigger: 'clutch', title: 'Timeout',
    text: 'The opponent calls timeout to ice you. The jumbotron is showing your face.',
    choices: [
      { label: 'Wave to the camera', effects: { fame: 1 }, game: { momentum: 0.05 }, result: 'Cool as can be.' },
      { label: 'Visualize the play', effects: {}, game: { tol: 0.04 }, result: 'You have already run it in your head five times.' },
    ],
  },
  // ---------------- random
  {
    id: 'g_injured_teammate', trigger: 'random', title: 'Teammate Down',
    text: 'A teammate is carted off. The sideline is shaken.',
    choices: [
      { label: 'Rally the troops', effects: { rel: { teammates: 4 } }, game: { momentum: 0.15 }, result: '"Let\'s win this one for #52."' },
      { label: 'Stay focused on your job', effects: {}, game: { tol: 0.02 }, result: 'Head down. Next play.' },
    ],
  },
  {
    id: 'g_trick_play', trigger: 'random', cond: { positions: ['RB', 'WR'] }, title: 'Trick Play?',
    text: 'The coordinator wants to run a trick play where you throw the ball. "You in?"',
    choices: [
      { label: 'Let\'s do it!', effects: {}, game: {}, chance: { p: 0.45, stat: 'skill', successGame: { points: 7, momentum: 0.35 }, successText: 'TOUCHDOWN on the trick play! The stadium loses its mind.', successEffects: { fame: 4 }, failGame: { momentum: -0.2 }, failText: 'You throw a duck. Intercepted.' }, result: '' },
      { label: '"Let\'s keep it simple."', effects: {}, game: {}, result: 'Normal play.' },
    ],
  },
  {
    id: 'g_ref_bad_call', trigger: 'random', title: 'Terrible Call',
    text: 'The refs just made an awful call against your team. Your teammates are losing it.',
    choices: [
      { label: 'Argue with the ref', effects: {}, game: { flag: true }, result: 'Unsportsmanlike conduct. Now it\'s worse.' },
      { label: 'Calm everyone down', effects: { rel: { teammates: 3, coach: 3 } }, game: { tol: 0.02 }, result: 'Leadership. The team refocuses.' },
    ],
  },
  {
    id: 'g_fan_sign', trigger: 'random', cond: { minFame: 15 }, title: 'Viral Sign',
    text: 'A fan\'s sign with your face on a superhero body is on the jumbotron.',
    choices: [
      { label: 'Do the superhero pose', effects: { fame: 1.5, mood: 3 }, game: { momentum: 0.05 }, result: 'Instant highlight.' },
      { label: 'Ignore it', effects: {}, game: {}, result: 'Focus.' },
    ],
  },
  {
    id: 'g_cramp', trigger: 'random', title: 'Cramping Up',
    text: 'Your calf is locking up. The trainers have pickle juice and a bench.',
    choices: [
      { label: 'Gulp it and stay in', effects: { health: -3 }, game: { tol: -0.03 }, result: 'Gross. Effective-ish.' },
      { label: 'Sit a series and stretch', effects: { health: 3 }, game: { skip: true, tol: 0.02 }, result: 'Loose and ready.' },
    ],
  },
  {
    id: 'g_qb_audible', trigger: 'random', cond: { positions: ['QB'] }, title: 'Audible?',
    text: 'You see a blitz coming. You could audible out of the called play.',
    choices: [
      { label: 'Audible', effects: { rel: { coach: -1 } }, game: {}, chance: { p: 0.55, stat: 'iq', successGame: { momentum: 0.2, tol: 0.03 }, successText: 'Perfect read. Big gain.', failGame: { oppBoost: true, momentum: -0.15 }, failText: 'Miscommunication. Turnover.' }, result: '' },
      { label: 'Run the play as called', effects: { rel: { coach: 2 } }, game: {}, result: 'Short gain.' },
    ],
  },
  {
    id: 'g_cb_bait', trigger: 'random', cond: { positions: ['CB'] }, title: 'Bait the QB?',
    text: 'You notice the QB stares down the first read. You could play off and bait the throw.',
    choices: [
      { label: 'Bait the throw', effects: {}, game: {}, chance: { p: 0.5, stat: 'iq', successGame: { momentum: 0.3, points: 0, extra: true }, successText: 'The QB takes the bait... you nearly had it. Next time.', failGame: { oppBoost: true }, failText: 'He sees through it. Big completion behind you.' }, result: '' },
      { label: 'Play it straight', effects: {}, game: { tol: 0.02 }, result: 'Disciplined coverage.' },
    ],
  },
  // ---------------- presnap (at the line, right before your play)
  {
    id: 'p_blitz_look', trigger: 'presnap', cond: { positions: ['QB'] }, title: 'Blitz Look',
    text: 'Both linebackers creep up to the line. The safety is cheating down. Something is coming.',
    choices: [
      { label: 'Audible to a quick slant', effects: {}, game: { tol: 0.06 }, result: 'You bark the new call. Everyone adjusts.' },
      { label: 'Slide the protection', effects: { rel: { teammates: 2 } }, game: { tol: 0.03 }, result: 'Your linemen nod. Nobody is getting a free shot.' },
      { label: 'Stay with it and take a shot', effects: {}, game: {}, chance: { p: 0.45, stat: 'iq', successGame: { tol: 0.1, momentum: 0.15 }, successText: 'You beat the blitz before it gets there!', failGame: { tol: -0.06 }, failText: 'They got there fast. You are rushed.' }, result: '' },
    ],
  },
  {
    id: 'p_hard_count', trigger: 'presnap', cond: { positions: ['QB'] }, title: 'Hard Count',
    text: 'The defensive line is twitchy. One good hard count might pull somebody offside.',
    choices: [
      { label: 'Try the hard count', effects: {}, game: {}, chance: { p: 0.4, stat: 'iq', successGame: { tol: 0.08, momentum: 0.1 }, successText: 'Jumped! Free five yards and a fresh look.', failGame: { flag: true }, failText: 'Your own guard flinches. False start.' }, result: '' },
      { label: 'Just snap it', effects: {}, game: {}, result: 'No games. Let\'s play.' },
    ],
  },
  {
    id: 'p_hot_route', trigger: 'presnap', cond: { positions: ['WR'] }, title: 'Hot Route',
    text: 'Your corner is playing way off. The quarterback glances at you, waiting for a signal.',
    choices: [
      { label: 'Signal a quick hitch', effects: { rel: { teammates: 1 } }, game: { tol: 0.07 }, result: 'Free yards. You both saw it.' },
      { label: 'Signal go, beat him deep', effects: {}, game: {}, chance: { p: 0.4, stat: 'speed', successGame: { tol: 0.1, momentum: 0.2 }, successText: 'He bites. You are behind him.', failGame: { tol: -0.04 }, failText: 'He was baiting you. Tight coverage.' }, result: '' },
      { label: 'Run what is called', effects: { rel: { coach: 1 } }, game: {}, result: 'Stick to the plan.' },
    ],
  },
  {
    id: 'p_press', trigger: 'presnap', cond: { positions: ['WR'] }, title: 'Press Coverage',
    text: 'The corner walks right up into your face. "You\'re not getting off the line today."',
    choices: [
      { label: 'Swim move off the line', effects: {}, game: {}, chance: { p: 0.55, stat: 'skill', successGame: { tol: 0.08 }, successText: 'Clean release. He is grabbing air.', failGame: { tol: -0.05 }, failText: 'He jams you hard. Route is late.' }, result: '' },
      { label: 'Ask for a motion to get a free release', effects: {}, game: { tol: 0.03 }, result: 'You motion across and get a running start.' },
    ],
  },
  {
    id: 'p_stacked_box', trigger: 'presnap', cond: { positions: ['RB'] }, title: 'Stacked Box',
    text: 'Eight defenders crowd the line. Running into that looks like running into a wall.',
    choices: [
      { label: 'Tell the QB to check to a pass', effects: { rel: { coach: 1 } }, game: { tol: 0.05 }, result: 'Smart. A quick toss to the outside instead.' },
      { label: 'Run it anyway. Pound them.', effects: { fame: 0.5 }, game: {}, chance: { p: 0.45, stat: 'strength', successGame: { tol: 0.08, momentum: 0.15 }, successText: 'You bounce off three guys and keep going!', failGame: { tol: -0.06 }, failText: 'They were waiting for you.' }, result: '' },
    ],
  },
  {
    id: 'p_cutback', trigger: 'presnap', cond: { positions: ['RB'] }, title: 'Read the Front',
    text: 'The defensive end is lined up wide. There could be a cutback lane on the backside.',
    choices: [
      { label: 'Plan to cut back', effects: {}, game: { tol: 0.05 }, result: 'You will look for the backside crease.' },
      { label: 'Hit the called hole hard', effects: { rel: { coach: 1 } }, game: { tol: 0.02 }, result: 'Downhill. No dancing.' },
    ],
  },
  {
    id: 'p_jump_route', trigger: 'presnap', cond: { positions: ['CB'] }, title: 'Film Study Pays Off',
    text: 'You recognize this formation from film. They ran a slant out of it four times last week.',
    choices: [
      { label: 'Jump the slant', effects: {}, game: {}, chance: { p: 0.5, stat: 'iq', successGame: { tol: 0.12, momentum: 0.2 }, successText: 'Called it! You are sitting right on the route.', failGame: { tol: -0.08, oppBoost: true }, failText: 'Double move! He is behind you.' }, result: '' },
      { label: 'Stay disciplined', effects: {}, game: { tol: 0.03 }, result: 'Eyes on your man, not the QB.' },
    ],
  },
  {
    id: 'p_switch_coverage', trigger: 'presnap', cond: { positions: ['CB'] }, title: 'Mismatch',
    text: 'They motion their fastest receiver toward your side. The safety looks at you: switch?',
    choices: [
      { label: '"I got him."', effects: { fame: 0.5 }, game: { tol: -0.02, momentum: 0.1 }, result: 'You want the best. You get the best.' },
      { label: 'Call for safety help over the top', effects: { rel: { teammates: 2 } }, game: { tol: 0.05 }, result: 'Bracket coverage. Smart.' },
    ],
  },
  {
    id: 'p_crowd_noise', trigger: 'presnap', title: 'Can\'t Hear',
    text: 'The crowd is deafening. Half the huddle did not hear the call.',
    choices: [
      { label: 'Burn a timeout', effects: { rel: { coach: -1 } }, game: { tol: 0.05 }, result: 'Everyone is on the same page now.' },
      { label: 'Wing it', effects: {}, game: {}, chance: { p: 0.6, successText: 'Everyone figures it out. Phew.', failGame: { tol: -0.06 }, failText: 'Two guys run the same route. Ugly.' }, result: '' },
    ],
  },
  {
    id: 'p_dt_snapcount', trigger: 'presnap', cond: { positions: ['DT'] }, title: 'Time the Snap',
    text: 'You have been watching the center\'s hands all game. He always dips before the snap.',
    choices: [
      { label: 'Jump the snap count', effects: {}, game: {}, chance: { p: 0.45, stat: 'iq', successGame: { tol: 0.12, momentum: 0.15 }, successText: 'You are off the ball before anyone moves. Free run at the QB!', failGame: { flag: true }, failText: 'Offside! Five yards.' }, result: '' },
      { label: 'Stay patient', effects: {}, game: { tol: 0.03 }, result: 'React, don\'t guess.' },
    ],
  },
  {
    id: 'p_dt_double', trigger: 'presnap', cond: { positions: ['DT'] }, title: 'Double Team',
    text: 'The guard and center are both eyeing you. They are going to double you.',
    choices: [
      { label: 'Split the double team', effects: {}, game: {}, chance: { p: 0.4, stat: 'strength', successGame: { tol: 0.1, momentum: 0.2 }, successText: 'You split them both. The crowd roars!', failGame: { tol: -0.06 }, failText: 'Two big men bury you.' }, result: '' },
      { label: 'Eat the double, free a teammate', effects: { rel: { teammates: 3 } }, game: { tol: 0.02, momentum: 0.05 }, result: 'Your linebacker runs free behind you.' },
    ],
  },
  {
    id: 'g_dt_clutch', trigger: 'clutch', cond: { positions: ['DT'] }, title: 'Pin Your Ears Back',
    text: 'They need a big play. Coach asks if you want to rush from the edge this series.',
    choices: [
      { label: 'Line me up on the edge', effects: { fame: 0.5 }, game: { tol: 0.04, momentum: 0.1 }, result: 'Speed against a slow tackle. Advantage you.' },
      { label: 'Stay inside, collapse the pocket', effects: { rel: { coach: 2 } }, game: { tol: 0.03 }, result: 'Push the middle so he can\'t step up.' },
    ],
  },
  // ---------------- more random / on-field happenings
  {
    id: 'g_fumble_scrum', trigger: 'random', title: 'Loose Ball!',
    text: 'A fumble on the kick return! The ball bounces toward the pile and you are closest.',
    choices: [
      { label: 'Dive on it', effects: {}, game: {}, chance: { p: 0.55, stat: 'speed', successGame: { momentum: 0.3, extra: true }, successText: 'You come up with it! The sideline goes crazy.', failGame: { momentum: -0.1 }, failText: 'Somebody rips it out at the bottom of the pile.', successEffects: { fame: 1 } }, result: '' },
      { label: 'Let the special teams guys handle it', effects: {}, game: {}, result: 'They recover it. Not your job.' },
    ],
  },
  {
    id: 'g_onside', trigger: 'random', cond: { trailing: true }, title: 'Onside Kick?',
    text: 'Coach asks the captains: try a surprise onside kick?',
    choices: [
      { label: 'Do it. Steal a possession!', effects: {}, game: {}, chance: { p: 0.3, successGame: { extra: true, momentum: 0.3 }, successText: 'RECOVERED! Nobody saw that coming.', failGame: { oppBoost: true, momentum: -0.15 }, failText: 'They pounce on it. Short field for them.' }, result: '' },
      { label: 'Kick it deep', effects: { rel: { coach: 1 } }, game: {}, result: 'Play the field position game.' },
    ],
  },
  {
    id: 'g_challenge', trigger: 'random', title: 'Throw the Red Flag?',
    text: 'You are sure the last catch by their receiver bobbled out of bounds. Coach looks at you.',
    choices: [
      { label: '"Challenge it, coach!"', effects: {}, game: {}, chance: { p: 0.45, successGame: { momentum: 0.25 }, successText: 'Overturned! Incomplete.', failGame: { momentum: -0.1 }, failText: 'Call stands. Lost a timeout.' }, result: '' },
      { label: '"Let it go."', effects: { rel: { coach: 1 } }, game: {}, result: 'Save the timeout.' },
    ],
  },
  {
    id: 'g_helmet_off', trigger: 'random', title: 'Lost Your Helmet',
    text: 'Your helmet pops off on a pile-up. Rules say you sit out one play.',
    choices: [
      { label: 'Argue with the ref', effects: { rel: { coach: -2 } }, game: {}, chance: { p: 0.2, successText: 'Somehow the ref lets it go.', failGame: { flag: true }, failText: 'Unsportsmanlike conduct. 15 yards.' }, result: '' },
      { label: 'Jog off, fix the chin strap', effects: {}, game: { tol: 0.02 }, result: 'Quick fix. You come back focused.' },
    ],
  },
  {
    id: 'g_rain_delay', trigger: 'random', cond: { weather: ['storm'] }, title: 'Lightning Delay',
    text: 'Lightning! Both teams head to the locker rooms for a 30-minute delay.',
    choices: [
      { label: 'Stay loose, stretch and bounce', effects: { health: 2 }, game: { tol: 0.04 }, result: 'You come out warm and ready.' },
      { label: 'Get a speech going', effects: { rel: { teammates: 3 } }, game: { momentum: 0.2 }, result: 'The room is buzzing when you come back out.' },
      { label: 'Scroll your phone', effects: { mood: 2 }, game: { tol: -0.03 }, result: 'You come back cold and stiff.' },
    ],
  },
  {
    id: 'g_mascot', trigger: 'random', title: 'Mascot Shenanigans',
    text: 'The opposing mascot is mocking you from the sideline. The crowd is loving it.',
    choices: [
      { label: 'Do a dance-off with the mascot', effects: { fame: 1.5, mood: 3 }, game: { momentum: 0.1 }, result: 'Instant highlight. Even their fans cheer.' },
      { label: 'Ignore it', effects: {}, game: { tol: 0.02 }, result: 'Focus.' },
    ],
  },
  {
    id: 'g_gatorade', trigger: 'random', title: 'Sideline Fire',
    text: 'Your teammates are dead silent on the sideline. You can feel the energy draining.',
    choices: [
      { label: 'Fire them up', effects: { rel: { teammates: 3 } }, game: { momentum: 0.2 }, result: 'Helmets slapping, guys yelling. The sideline is alive.' },
      { label: 'Lead by example. Stay quiet.', effects: {}, game: { tol: 0.03 }, result: 'Actions over words.' },
    ],
  },
  {
    id: 'g_trash_talk', trigger: 'random', title: 'Trash Talk',
    text: 'A defender keeps chirping at you after every play. "You are SOFT, {last}."',
    choices: [
      { label: 'Talk back', effects: { fame: 0.5 }, game: { momentum: 0.1 }, chance: { p: 0.7, failGame: { flag: true }, failText: 'The ref only heard you. Flag on YOU.' }, result: 'He has nothing to say back.' },
      { label: 'Point at the scoreboard', effects: {}, game: { tol: 0.03 }, result: 'Say less.' },
    ],
  },
  {
    id: 'g_fake_punt', trigger: 'random', title: 'Fake Punt?',
    text: '4th and 3 near midfield. The special teams coach asks: run the fake?',
    choices: [
      { label: 'Run the fake!', effects: {}, game: {}, chance: { p: 0.45, successGame: { extra: true, momentum: 0.25 }, successText: 'First down! The crowd cannot believe it.', failGame: { oppBoost: true, momentum: -0.2 }, failText: 'Stuffed. They take over at midfield.' }, result: '' },
      { label: 'Punt it', effects: {}, game: {}, result: 'Pinned them deep.' },
    ],
  },
  {
    id: 'g_hurt_star', trigger: 'random', title: 'Their Star Goes Down',
    text: 'Their best player limps off. Your team could attack the backup.',
    choices: [
      { label: 'Go right at the backup', effects: {}, game: { tol: 0.05, momentum: 0.1 }, result: 'You smell blood.' },
      { label: 'Check on him first', effects: { fame: 1, rel: { rival: 3 } }, game: {}, result: 'Classy. The cameras catch it.' },
    ],
  },
  {
    id: 'g_wind_shift', trigger: 'random', cond: { weather: ['wind', 'storm', 'rain', 'snow'] }, title: 'Weather Turns',
    text: 'The weather is getting worse by the minute. Coach wants to simplify the game plan.',
    choices: [
      { label: 'Agree: short and safe', effects: { rel: { coach: 2 } }, game: { tol: 0.04 }, result: 'Grind it out.' },
      { label: 'Push to keep attacking', effects: {}, game: { momentum: 0.1, tol: -0.02 }, result: 'Fortune favors the bold.' },
    ],
  },
  // ---------------- more afterTD / afterBad / halftime / clutch
  {
    id: 'g_lambeau', trigger: 'afterTD', title: 'Into the Stands?',
    text: 'You are standing right next to the wall. The front row is reaching out to you.',
    choices: [
      { label: 'Leap into the crowd', effects: { fame: 2, mood: 4 }, game: { momentum: 0.15 }, result: 'Swallowed by fans. Best feeling in the world.' },
      { label: 'Find your teammates', effects: { rel: { teammates: 3 } }, game: {}, result: 'Pile of helmets in the end zone.' },
    ],
  },
  {
    id: 'g_sideline_tablet', trigger: 'afterBad', title: 'Tablet Time',
    text: 'On the sideline, a coach pulls up the last play on the tablet. You see exactly what went wrong.',
    choices: [
      { label: 'Study it closely', effects: { rel: { coach: 2 } }, game: { tol: 0.05 }, result: 'Lesson learned. It will not happen again.' },
      { label: 'Wave it off, you know', effects: {}, game: { momentum: 0.05 }, result: 'You trust your instincts.' },
    ],
  },
  {
    id: 'g_halftime_injury', trigger: 'halftime', title: 'Tweaked Something',
    text: 'Your hamstring is tight. The trainer offers to tape it or keep you out for a bit.',
    choices: [
      { label: 'Tape it and go', effects: {}, game: {}, chance: { p: 0.8, successText: 'Feels fine. Let\'s go.', failEffects: { injury: true }, failText: 'It grabs on the first play. You are done for the day.' }, result: '' },
      { label: 'Sit the first series of the half', effects: { health: 4 }, game: { skip: true }, result: 'Better safe.' },
    ],
  },
  {
    id: 'g_clutch_icing', trigger: 'clutch', title: 'They Call Timeout',
    text: 'The other coach calls timeout to make you think about it. Everyone is staring at you.',
    choices: [
      { label: 'Laugh it off with teammates', effects: { rel: { teammates: 2 } }, game: { tol: 0.04 }, result: 'Loose and confident.' },
      { label: 'Visualize the play', effects: {}, game: { tol: 0.05 }, result: 'You have already seen it happen.' },
    ],
  },
];
