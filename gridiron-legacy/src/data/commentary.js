// Play-by-play commentary shown in a banner during free-control plays. {name} = your last name.
export const COMMENTARY = {
  snap: ['Here comes the snap...', 'Ball is snapped!', 'And we are live!', 'The crowd is on its feet...', '{name} lines up. Here we go.'],
  snapDef: ['They break the huddle...', '{name} is locked in on his man.', 'Defense set. Here is the snap.', 'Eyes on the quarterback...'],
  throw: ['The ball is in the air!', 'Lets it fly!', 'Throws it downfield!', 'Fires a dart!'],
  catch: ['Hauled in!', 'What a grab!', 'Snags it out of the air!', 'Secure catch!'],
  big: ['He is loose! Somebody catch him!', 'Daylight! Look at him go!', 'Breaking into the open field!', 'The ground rises to meet the moment!'],
  short: ['Brought down.', 'Wrapped up after a short gain.', 'Not much there.', 'Stuffed at the line.'],
  gain: ['Good gain on the play.', 'Moving the chains.', 'Solid yardage.', 'Picks up a chunk.'],
  incomplete: ['Falls incomplete.', 'Nobody there.', 'Off the fingertips.', 'Thrown away.'],
  sack: ['SACKED! Buried in the backfield!', 'Swallowed up by the rush!', 'No time to throw. Down he goes.'],
  turnover: ['TURNOVER! What a disaster!', 'The defense takes it away!', 'Oh no. That is a giveaway.'],
  td: ['TOUCHDOWN! The place is shaking!', 'He is in! Touchdown!', 'Six points! Unbelievable!', 'Into the end zone! What a play by {name}!'],
  pick: ['PICKED OFF by {name}!', 'Interception! {name} jumped that route!', 'Read it all the way. Picked!'],
  sackBy: ['{name} gets HOME! Sack!', 'Beat his man and buried the quarterback!', 'What a pass rush by {name}!'],
  pancake: ['Pancaked! He put that lineman on his back.', 'Bull rush... and he is flat on the turf!'],
  scuffle: ['Some pushing and shoving after the whistle!', 'Tempers flaring out there!', 'The refs step in to separate them.', 'Somebody did not like that hit.'],
  diving: ['LAYS OUT! What a diving catch!', 'Full extension! He caught it!', 'Diving grab! Unbelievable concentration!'],
  pd: ['Broken up! Great coverage by {name}.', 'Swatted away!', 'Knocked down at the last second!'],
  stop: ['{name} makes the stop!', 'Big hit! {name} wraps him up.', 'Textbook tackle by {name}.'],
  allowed: ['He slips through. Gain on the play.', 'They found a seam there.', 'Got behind the coverage...'],
};

export function line(kind, name = '') {
  const arr = COMMENTARY[kind] ?? COMMENTARY.snap;
  return arr[Math.floor(Math.random() * arr.length)].replaceAll('{name}', name);
}
