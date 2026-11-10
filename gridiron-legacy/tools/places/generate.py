import json, re
import os; HERE = os.path.dirname(os.path.abspath(__file__)); exec(open(os.path.join(HERE, 'maps.py')).read().replace("print('maps ok', len(M))", ''))
FLOORCH = set('.:;-_^,=~+%#E')

def js(o):  # JSON is valid JS
    return json.dumps(o, ensure_ascii=False)

ACT = lambda i: {'kind': 'activity', 'id': i}
SNACK = lambda n, p, m, h=0: {'kind': 'snack', 'name': n, 'price': p, 'mood': m, **({'health': h} if h else {})}
PERSON = lambda k: {'kind': 'person', 'key': k}
SHOP = lambda c, n: {'kind': 'shop', 'cat': c, 'name': n}
PAGE = lambda t, s, n: {'kind': 'page', 'tab': t, 'sub': s, 'name': n}
INFO = lambda t: {'kind': 'info', 'text': t}

home_legend = {
  'B': {'solid': True, 'prop': 'bed', 'span': True, 'act': ACT('recovery'), 'label': 'Sleep in & recover'},
  'q': {'solid': True, 'prop': 'bunk', 'span': True},
  'b': {'solid': True, 'prop': 'bookshelf'},
  'e': {'solid': True, 'prop': 'desk'},
  'd': {'solid': True, 'prop': 'desk', 'act': ACT('classes'), 'label': 'Study', 'needs': {'stage': ['hs', 'college']}, 'alt': {'solid': True, 'prop': 'desk', 'act': ACT('media'), 'label': 'Post on socials'}},
  'k': {'solid': True, 'prop': 'counter', 'floor': 'tile', 'act': SNACK('Cook a healthy meal', 15, 2, 3), 'label': 'Cook a meal'},
  'F': {'solid': True, 'prop': 'fridge', 'floor': 'tile'},
  'x': {'solid': True, 'prop': 'minifridge', 'act': SNACK('Grab a snack', 4, 1), 'label': 'Mini fridge: snack'},
  'i': {'solid': True, 'prop': 'island', 'floor': 'tile', 'span': True, 'act': SNACK('Private chef dinner', 60, 3, 4), 'label': 'Kitchen island: chef dinner'},
  't': {'solid': True, 'prop': 'table', 'span': True, 'act': PERSON('family'), 'label': 'Call home'},
  'T': {'solid': True, 'prop': 'tv', 'span': True, 'act': ACT('gaming'), 'label': 'Play video games'},
  'V': {'solid': True, 'prop': 'tv', 'span': True, 'act': ACT('film'), 'label': 'Watch game film'},
  'C': {'solid': True, 'prop': 'couch', 'span': True, 'act': ACT('gaming'), 'label': 'Kick back on the couch'},
  'y': {'prop': 'mat', 'act': ACT('yoga'), 'label': 'Yoga & stretching'},
  'g': {'solid': True, 'prop': 'rack', 'floor': 'rubber', 'span': True, 'act': ACT('weights'), 'label': 'Lift in your home gym', 'needs': {'item': 'homegym'}, 'alt': {'solid': True, 'prop': 'bench_press', 'floor': 'rubber'}},
  's': {'solid': True, 'prop': 'vending', 'span': True, 'act': SNACK('Vending machine snack', 3, 1), 'label': 'Vending machine'},
  'h': {'solid': True, 'prop': 'plant'},
  '0': {'npc': {'key': 'mate0', 'wander': 1.5}},
  'm': {'npc': {'key': 'family', 'wander': 1}, 'floor': 'tile', 'needs': {'housing': ['parents']}},
  'p': {'npc': {'key': 'partner', 'wander': 2}, 'needs': {'partner': True}},
  'a': {'npc': {'key': 'pet', 'wander': 3}, 'needs': {'flag': 'has_dog'}},
}
stadium_legend = {
  'L': {'solid': True, 'prop': 'locker'},
  'o': {'solid': True, 'prop': 'desk'},
  'c': {'npc': {'key': 'coach', 'wander': 0.5}},
  '0': {'npc': {'key': 'mate0', 'wander': 1.5}},
  '1': {'npc': {'key': 'mate1', 'wander': 1.5}},
  '2': {'npc': {'key': 'mate2', 'wander': 1.5}},
  'r': {'solid': True, 'prop': 'rack', 'floor': 'rubber', 'act': ACT('weights'), 'label': 'Weight room'},
  'W': {'solid': True, 'prop': 'treadmill', 'floor': 'rubber', 'act': ACT('sprints'), 'label': 'Speed training'},
  'V': {'solid': True, 'prop': 'screen', 'span': True, 'act': ACT('film'), 'label': 'Film room'},
  'v': {'prop': None, 'act': ACT('meetcoach'), 'label': 'Meet with coach'},
  't': {'solid': True, 'prop': 'trainertable', 'act': ACT('recovery'), 'label': 'Training room: treatment'},
  'u': {'solid': True, 'prop': 'coldtub', 'act': ACT('recovery'), 'label': 'Cold tub & recovery'},
  'y': {'prop': 'mat', 'act': ACT('rehab'), 'label': 'Rehab session', 'needs': {'injured': True}, 'alt': {'prop': 'mat', 'act': ACT('yoga'), 'label': 'Mobility work'}},
  'D': {'floor': 'turf', 'prop': 'sled', 'act': ACT('drills'), 'label': 'Position drills'},
  'M': {'solid': True, 'prop': 'podium', 'span': True, 'act': ACT('media'), 'label': 'Press conference'},
  'k': {'solid': True, 'prop': 'counter', 'span': False, 'act': SNACK('Team nutrition bar', 0, 1, 2), 'label': 'Nutrition bar'},
}
park_legend = {
  'R': {'solid': True, 'prop': 'tree', 'floor': 'grass'},
  'Y': {'solid': True, 'prop': 'campus', 'floor': 'grass'},
  'J': {'floor': 'path', 'prop': 'sign', 'act': ACT('sprints'), 'label': 'Run hill sprints'},
  'f': {'solid': True, 'prop': 'truck', 'act': SNACK('Food truck tacos', 12, 3), 'label': 'Food truck'},
  '2': {'solid': True, 'prop': 'cart', 'act': SNACK('Gelato cart', 6, 2), 'label': 'Gelato cart'},
  'F': {'solid': True, 'prop': 'fountain', 'span': True},
  'b': {'solid': True, 'prop': 'bench', 'act': ACT('gaming'), 'label': 'Relax on the bench'},
  'n': {'npc': {'key': 'fan', 'wander': 4}},
  'c': {'solid': True, 'prop': 'booth', 'act': ACT('charity'), 'label': 'Volunteer at the booth'},
  'H': {'solid': True, 'prop': 'hoop', 'floor': 'court', 'act': ACT('hangout'), 'label': 'Pickup game with friends'},
  'm': {'npc': {'key': 'mate1', 'wander': 2}, 'floor': 'court'},
  'O': {'floor': 'turf', 'prop': None, 'act': ACT('drills'), 'label': 'Run position drills'},
  'v': {'npc': {'key': 'pet', 'wander': 3}, 'needs': {'flag': 'has_dog'}},
  'l': {'solid': True, 'prop': 'lamppost', 'floor': 'boardwalk'},
}
def shop(color, act, label, **kw):
    return {'solid': True, 'prop': 'shopfront', 'span': True, 'color': color, 'act': act, 'label': label, **kw}
downtown_legend = {
  'G': shop('#c0392b', SHOP('gear', 'Gear Shop'), 'Gear Shop'),
  'S': shop('#8e44ad', SHOP('style', 'Boutique'), 'Fashion Boutique'),
  'H': shop('#d35400', SHOP('home', 'Home Store'), 'Home Store'),
  'P': shop('#16a085', SHOP('pets', 'Pet Shop'), 'Pet Shop'),
  'X': shop('#b7950b', SHOP('toys', 'Luxury Toys'), 'Luxury Toys'),
  'Q': shop('#c2185b', SHOP('gifts', 'Gift Shop'), 'Gift Shop'),
  'B': shop('#1f5fa8', PAGE('life', 'invest', 'Bank'), 'Bank: investments'),
  'f': shop('#0e8a6a', ACT('parttime'), 'Part-time job', needs={'stage': ['hs', 'college']}, alt=shop('#0e8a6a', SNACK('Coffee & pastry', 8, 2), 'Coffee shop')),
  'C': shop('#5d6d7e', PAGE('life', 'lifestyle', 'Car Dealer'), 'Car dealer & realtor'),
  'R': shop('#a93226', ACT('date'), 'Restaurant: date night', needs={'partner': True}, alt=shop('#a93226', SNACK('Dinner out', 30, 3), 'Restaurant')),
  '$': shop('#1a5276', ACT('agentcall'), "Agent's office", needs={'agent': True}, alt=shop('#1a5276', INFO('A sports agency. They do not take walk-ins... yet.'), 'Sports agency')),
  'U': shop('#5b2c6f', ACT('nightout'), 'Nightclub', needs={'stage': ['college', 'pro']}, alt=shop('#5b2c6f', SNACK('Milkshake at the diner', 6, 2), 'Diner')),
  'J': shop('#ca6f1e', ACT('charity'), 'Youth center: volunteer'),
  'Z': shop('#2e4053', ACT('business'), 'Your business', needs={'flag': 'has_business'}, alt=shop('#2e4053', INFO('An empty storefront. Maybe someday it is yours.'), 'For lease')),
  'I': shop('#cb4335', ACT('hangout'), 'Arcade with teammates'),
  'h': shop('#2e86c1', ACT('yoga'), 'Yoga studio'),
  'n': {'npc': {'key': 'fan', 'wander': 5}},
  'a': {'npc': {'key': 'agent', 'wander': 2}, 'needs': {'agent': True}},
  'r': {'npc': {'key': 'rival', 'wander': 3}},
  'l': {'solid': True, 'prop': 'lamppost', 'floor': 'pavers'},
}
V = {
 'home': {'icon': 'home', 'legend': home_legend, 'variants': {
   'hs': {'name': 'Family Home', 'floor': 'wood', 'wall': '#efe6d6', 'accent': '#7a8f6a', 'rooms': [['Bedroom', 4, 3], ['Kitchen', 5, 9], ['Living room', 5, 15], ['Hallway & garage gym', 10, 10]]},
   'college': {'name': 'Dorm', 'floor': 'vinyl', 'wall': '#e8edf2', 'accent': '#5b7ca0', 'rooms': [['Your room', 2, 3], ['Roommate', 2, 9], ['Kitchenette', 4, 15], ['Common lounge', 6, 9]]},
   'pro': {'name': 'Penthouse', 'floor': 'marble', 'wall': '#f4f1ec', 'accent': '#2f3b45', 'rooms': [['Master suite', 4, 3], ['Kitchen', 2, 11], ['Living room', 5, 18], ['Home gym', 10, 5], ['Pool deck', 7, 15]]},
 }},
 'stadium': {'icon': 'ball', 'legend': stadium_legend, 'variants': {
   'hs': {'name': 'School Athletics', 'floor': 'concrete', 'wall': '#cfd6dd', 'accent': '#33475b', 'rooms': [['Locker room', 4, 3], ['Coach', 3, 9], ['Weight room', 5, 15], ['Practice field', 10, 3], ['Film', 9, 9], ['Trainer', 9, 15]]},
   'college': {'name': 'Athletic Center', 'floor': 'concrete', 'wall': '#d7dde4', 'accent': '#1f3a5f', 'rooms': [['Locker room', 4, 4], ['Coach', 3, 11], ['Performance center', 5, 19], ['Indoor field', 11, 4], ['Film room', 9, 11], ['Recovery', 9, 19], ['Press room', 11, 19]]},
   'pro': {'name': 'Team Facility', 'floor': 'polished', 'wall': '#e3e7ec', 'accent': '#111820', 'rooms': [['Locker room', 4, 5], ['Head coach', 3, 13], ['Performance center', 5, 21], ['Indoor field', 11, 5], ['Film room', 9, 13], ['Recovery', 9, 21], ['Press room', 11, 22]]},
 }},
 'park': {'icon': 'leaf', 'legend': park_legend, 'outdoor': True, 'variants': {
   'hs': {'name': 'Town Park', 'floor': 'grass', 'alt': 'path', 'sky': '#9fd2f5'},
   'college': {'name': 'Campus Quad', 'floor': 'grass', 'alt': 'path', 'sky': '#a9d6f2'},
   'pro': {'name': 'Waterfront Park', 'floor': 'grass', 'alt': 'path', 'sky': '#8fc8f0'},
 }},
 'downtown': {'icon': 'briefcase', 'legend': downtown_legend, 'outdoor': True, 'variants': {
   'hs': {'name': 'Main Street', 'floor': 'pavers', 'alt': 'pavers', 'sky': '#a4d3f2', 'skyline': 'town'},
   'college': {'name': 'College Town', 'floor': 'pavers', 'alt': 'pavers', 'sky': '#a4d3f2', 'skyline': 'college'},
   'pro': {'name': 'City Center', 'floor': 'pavers', 'alt': 'pavers', 'sky': '#9cc9ee', 'skyline': 'city'},
 }},
}
# validate characters
for (pid, stage), rows in M.items():
    leg = V[pid]['legend']
    for r in rows:
        for ch in r:
            assert ch in FLOORCH or ch in leg, (pid, stage, ch)
    V[pid]['variants'][stage]['map'] = rows

out = ['// Walkable places, one layout per level of play (high school / college / pro). Generated layout data:',
 '// each map is a text grid, one character = one 2-yard tile.',
 '//   #  wall        .  room floor (variant floor)   :  tile (indoors) / path (outdoors)   ;  rug',
 '//   -  rubber gym floor   _  turf   ^  court   ,  grass   =  road   ~  water / pool (solid)   +  pavers',
 '//   %  boardwalk   E  exit',
 '// Other characters are looked up in the place legend (props, people, activities). Legend entries:',
 '//   prop (what to draw), span (one prop across a run of the same character), floor (floor under it), solid,',
 '//   act ({ kind: activity | person | shop | page | snack | travel | info, ... }), label, needs (+ alt), npc.',
 '',
 "export const LEGEND = { E: { floor: 'door', prop: null, act: { kind: 'travel' }, label: 'Leave' } };",
 '',
 '// Floor characters -> floor kind (see the floor painter in scenes/world.js).',
 "export const FLOOR_CHARS = { ':': 'alt', ';': 'rug', '-': 'rubber', '_': 'turf', '^': 'court', ',': 'grass', '=': 'road', '~': 'water', '+': 'pavers', '%': 'boardwalk', E: 'door' };",
 '',
 'export const PLACE_DEFS = ' + js(V) + ';',
 '',
 '/** The layout of a place for your level of play (falls back to pro). */',
 'export function placeFor(id, stage = "pro") {',
 '  const d = PLACE_DEFS[id];',
 "  const v = d.variants[stage] ?? d.variants[stage === 'retired' ? 'pro' : 'hs'] ?? d.variants.pro;",
 '  return { id, icon: d.icon, outdoor: !!d.outdoor, legend: d.legend, start: "E", ...v };',
 '}',
 '',
 '/** Back-compat: PLACES[id] gives the pro layout (names, icons). */',
 'export const PLACES = Object.fromEntries(Object.keys(PLACE_DEFS).map((id) => [id, placeFor(id, "pro")]));',
 '']
open(os.path.join(HERE, '..', '..', 'src', 'data', 'places.js'), 'w').write('\n'.join(out))
print('places.js written')
