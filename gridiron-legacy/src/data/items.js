// The store. All brands are fictional.
//
// Fields:
//   cat:     gear | style | home | pets | toys | gifts
//   price:   one-time cost; weekly: ongoing cost
//   gear:    { slot, tol, types? } widens minigame timing windows (only the best item per slot counts).
//            types limits it to certain moments (e.g. catching); omitted = every moment.
//   mood:    weekly mood bonus while owned
//   fame:    one-time fame on purchase
//   train:   training bonus { stat: fraction }
//   energy:  weekly energy bonus
//   gift:    consumable used when interacting with people ({ rel: amount }); can be bought many times
//   minStage / minFame: requirements to buy
//   flag:    sets a story flag when bought (some events check these)

const CATCH = ['wr_route', 'wr_jumpball', 'wr_toetap', 'rb_screen', 'cb_cover', 'qb_hailmary'];
const RUN = ['qb_sneak', 'rb_run', 'rb_screen', 'qb_scramble', 'rb_goalline', 'cb_tackle', 'dt_rush', 'dt_run'];
const THROW = ['qb_throw', 'qb_hailmary'];

export const ITEM_CATS = [
  ['gear', 'Gear', 'Equipment that helps on the field'],
  ['style', 'Style', 'Clothes, watches and jewelry'],
  ['home', 'Home', 'Upgrades for your place'],
  ['pets', 'Pets', 'A friend waiting at home'],
  ['toys', 'Toys', 'Big-ticket fun'],
  ['gifts', 'Gifts', 'Give these to people you care about'],
];

export const ITEMS = [
  // ---------------- gear (best per slot counts)
  { id: 'cleats1', cat: 'gear', name: 'Strideline Speed Cleats', price: 180, gear: { slot: 'cleats', tol: 0.03 }, desc: '+3% timing on every play.' },
  { id: 'cleats2', cat: 'gear', name: 'Strideline Pro Cleats', price: 900, gear: { slot: 'cleats', tol: 0.05 }, desc: '+5% timing on every play.' },
  { id: 'cleats3', cat: 'gear', name: 'Strideline Custom Elite', price: 6500, gear: { slot: 'cleats', tol: 0.08 }, minStage: 'college', desc: '+8% timing. Molded to your feet.' },
  { id: 'gloves1', cat: 'gear', name: 'Sticky Receiver Gloves', price: 120, gear: { slot: 'gloves', tol: 0.05, types: CATCH }, desc: '+5% on catches and breakups.' },
  { id: 'gloves2', cat: 'gear', name: 'Grip-Tek Pro Gloves', price: 1400, gear: { slot: 'gloves', tol: 0.09, types: CATCH }, desc: '+9% on catches and breakups.' },
  { id: 'sleeve1', cat: 'gear', name: 'Compression Arm Sleeve', price: 90, gear: { slot: 'arm', tol: 0.04, types: THROW }, desc: '+4% on throws.' },
  { id: 'sleeve2', cat: 'gear', name: 'Wristband Playbook', price: 600, gear: { slot: 'arm', tol: 0.07, types: THROW }, desc: '+7% on throws. Plays at a glance.' },
  { id: 'pads1', cat: 'gear', name: 'Lightweight Shoulder Pads', price: 700, gear: { slot: 'pads', tol: 0.05, types: RUN }, desc: '+5% on runs and tackles.' },
  { id: 'visor', cat: 'gear', name: 'Tinted Visor', price: 250, gear: { slot: 'helmet', tol: 0.03 }, fame: 0.5, desc: '+3% timing. Looks fast.' },
  { id: 'helmet2', cat: 'gear', name: 'Carbon Shell Helmet', price: 4800, gear: { slot: 'helmet', tol: 0.06 }, minStage: 'pro', desc: '+6% timing, fewer concussions.' },
  { id: 'mouthguard', cat: 'gear', name: 'Custom Mouthguard', price: 150, gear: { slot: 'mouth', tol: 0.02 }, desc: '+2% timing. Breathe easy.' },
  // ---------------- style
  { id: 'hoodie', cat: 'style', name: 'Team Hoodie', price: 60, mood: 1, desc: 'Comfy. +1 mood/week.' },
  { id: 'sneakers', cat: 'style', name: 'Limited Sneaker Drop', price: 650, mood: 1, fame: 1, desc: 'Camped out for these.' },
  { id: 'suit', cat: 'style', name: 'Tailored Draft Suit', price: 3200, fame: 2, mood: 1, minStage: 'college', desc: 'Walk the stage in style.' },
  { id: 'chain', cat: 'style', name: 'Gold Chain', price: 12000, fame: 2, mood: 2, minStage: 'pro', desc: 'Catches the light on camera.' },
  { id: 'watch', cat: 'style', name: 'Meridian Chronograph', price: 45000, fame: 3, mood: 2, minStage: 'pro', desc: 'Swiss-ish. Very shiny.' },
  { id: 'wardrobe', cat: 'style', name: 'Designer Wardrobe', price: 90000, fame: 4, mood: 3, minStage: 'pro', weekly: 400, desc: 'Fashion week regular.' },
  { id: 'grill', cat: 'style', name: 'Diamond Grill', price: 28000, fame: 3, mood: 1, minStage: 'pro', desc: 'Smile for the cameras.' },
  // ---------------- home
  { id: 'gamingrig', cat: 'home', name: 'Gaming Setup', price: 2500, mood: 2, desc: 'Triple monitors. +2 mood/week.' },
  { id: 'theater', cat: 'home', name: 'Home Theater', price: 18000, mood: 3, minStage: 'pro', desc: 'Watch film in 4K. +3 mood/week.', train: { iq: 0.1 } },
  { id: 'homegym', cat: 'home', name: 'Home Gym', price: 25000, train: { strength: 0.15, speed: 0.1 }, minStage: 'pro', desc: '+15% strength, +10% speed training.' },
  { id: 'trophyroom', cat: 'home', name: 'Trophy Room', price: 40000, mood: 2, fame: 2, minStage: 'pro', desc: 'Every award, lit up.' },
  { id: 'pool', cat: 'home', name: 'Pool & Hot Tub', price: 85000, mood: 3, energy: 1, weekly: 300, minStage: 'pro', desc: '+3 mood, +1 energy/week.' },
  { id: 'chefkitchen', cat: 'home', name: "Chef's Kitchen", price: 60000, mood: 2, minStage: 'pro', desc: 'Date nights at home.' },
  { id: 'cryo', cat: 'home', name: 'Cryo Chamber', price: 120000, energy: 1, minStage: 'pro', desc: '+1 energy every week.' },
  // ---------------- pets
  { id: 'dog', cat: 'pets', name: 'Rescue Dog', price: 300, mood: 3, weekly: 25, flag: 'has_dog', desc: 'A loyal friend. +3 mood/week.' },
  { id: 'cat', cat: 'pets', name: 'Shelter Cat', price: 150, mood: 2, weekly: 15, flag: 'has_cat', desc: 'Judges your route running. +2 mood/week.' },
  { id: 'parrot', cat: 'pets', name: 'Talking Parrot', price: 1200, mood: 2, fame: 1, weekly: 20, desc: 'Learned to say "TOUCHDOWN".' },
  { id: 'horse', cat: 'pets', name: 'Ranch Horse', price: 40000, mood: 3, weekly: 600, minStage: 'pro', desc: 'Weekend trail rides.' },
  // ---------------- toys
  { id: 'motorbike', cat: 'toys', name: 'Motorcycle', price: 22000, mood: 2, fame: 1, minStage: 'pro', desc: 'Your coach hates this.' },
  { id: 'boat', cat: 'toys', name: 'Lake Boat', price: 180000, mood: 3, fame: 2, weekly: 900, minStage: 'pro', desc: 'Offseason on the water.' },
  { id: 'art', cat: 'toys', name: 'Art Collection', price: 250000, mood: 1, fame: 3, minStage: 'pro', desc: 'Culture. Might even appreciate.' },
  { id: 'yacht', cat: 'toys', name: 'Yacht', price: 2500000, mood: 5, fame: 6, weekly: 9000, minStage: 'pro', desc: 'The ultimate flex.' },
  { id: 'jet', cat: 'toys', name: 'Private Jet Share', price: 4000000, energy: 1, fame: 5, weekly: 15000, minStage: 'pro', desc: 'Fly private. +1 energy/week.' },
  // ---------------- gifts (consumables)
  { id: 'g_flowers', cat: 'gifts', name: 'Flowers', price: 60, gift: { partner: 6, family: 4 }, desc: 'Classic.' },
  { id: 'g_tickets', cat: 'gifts', name: 'Game Tickets', price: 200, gift: { family: 7, teammates: 2, partner: 4 }, desc: 'Best seats in the house.' },
  { id: 'g_jersey', cat: 'gifts', name: 'Signed Jersey', price: 40, gift: { family: 5, teammates: 3, rival: -4 }, desc: 'Your name on the back.' },
  { id: 'g_dinner', cat: 'gifts', name: 'Fancy Dinner Voucher', price: 400, gift: { partner: 9, family: 6, agent: 4, coach: 3 }, desc: 'Five courses.' },
  { id: 'g_watch', cat: 'gifts', name: 'Engraved Watch', price: 5000, gift: { partner: 14, family: 10, coach: 8, agent: 8, teammates: 6 }, minStage: 'pro', desc: 'A gift they will keep forever.' },
  { id: 'g_rolex', cat: 'gifts', name: 'Watches for the O-Line', price: 60000, gift: { teammates: 25 }, minStage: 'pro', desc: 'The linemen will run through walls for you.' },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
