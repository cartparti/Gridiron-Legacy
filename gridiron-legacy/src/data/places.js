// Walkable places, drawn as text maps. One character = one tile (2 yards).
//
//   #  wall          .  floor (place default)     ,  grass       :  path / sidewalk
//   =  road          ~  water (solid)             _  turf / court
//   Any other character is looked up in the place's `legend` (and then the shared LEGEND).
//
// Legend entries:
//   floor:  floor color under the object
//   solid:  blocks walking
//   prop:   what to draw (box, bed, tv, couch, counter, table, tree, bench, locker, desk, rack,
//           treadmill, hoop, fountain, truck, booth, shopfront, sign, mat, pool, plant, trophy, door, car)
//   act:    what happens when you interact:
//           { kind: 'activity', id }        does a weekly activity (uses a day slot + energy)
//           { kind: 'person', key }         talk to someone (coach, mate0, family, partner, agent, rival, fan)
//           { kind: 'shop', cat, name }     opens a store section
//           { kind: 'page', tab, sub, name } jumps to a hub page (housing & cars, investments)
//           { kind: 'snack', name, price, mood }  small purchase with an instant mood boost
//           { kind: 'travel' }              opens the map to go somewhere else
//           { kind: 'info', text }          just a line of flavor text
//   needs:  only appears if this is true: { item, flag, partner, stage, housing }
//   npc:    spawns a person here instead of a prop: { key, wander, look? }

export const LEGEND = {
  E: { floor: 'door', prop: 'door', act: { kind: 'travel' }, label: 'Leave' },
};

export const PLACES = {
  home: {
    name: 'Home',
    icon: 'home',
    floor: '#b98b5b',
    floorAlt: '#a87a4c',
    wall: '#e9dcc7',
    wallTop: '#cdbb9f',
    outdoor: false,
    start: 'E',
    map: [
      '################',
      '#BB..#....TT....#',
      '#....#..........#',
      '#.d..:...CC.....#',
      '#....#......a...#',
      '##:###..........#',
      '#kkk.#....y.....#',
      '#....:..........#',
      '#.tt.#..g...p...#',
      '#..m.#..........#',
      '#######E#########',
    ],
    legend: {
      ':': { floor: 'floor', prop: null },
      B: { solid: true, prop: 'bed', act: { kind: 'activity', id: 'recovery' }, label: 'Sleep in & recover' },
      d: { solid: true, prop: 'desk', act: { kind: 'activity', id: 'classes' }, label: 'Study', needs: { stage: ['hs', 'college'] }, alt: { solid: true, prop: 'desk', act: { kind: 'activity', id: 'media' }, label: 'Post on socials' } },
      T: { solid: true, prop: 'tv', act: { kind: 'activity', id: 'gaming' }, label: 'Play video games' },
      C: { solid: true, prop: 'couch', act: { kind: 'activity', id: 'film' }, label: 'Watch game film' },
      k: { solid: true, prop: 'counter', act: { kind: 'snack', name: 'Cook a healthy meal', price: 15, mood: 2, health: 3 }, label: 'Cook a meal' },
      t: { solid: true, prop: 'table', act: { kind: 'person', key: 'family' }, label: 'Call home' },
      y: { prop: 'mat', act: { kind: 'activity', id: 'yoga' }, label: 'Yoga & stretching' },
      g: { solid: true, prop: 'rack', act: { kind: 'activity', id: 'weights' }, label: 'Lift in your home gym', needs: { item: 'homegym' }, alt: { solid: true, prop: 'plant' } },
      a: { npc: { key: 'pet', wander: 3 }, needs: { flag: 'has_dog' } },
      p: { npc: { key: 'partner', wander: 2 }, needs: { partner: true } },
      m: { npc: { key: 'family', wander: 1 }, needs: { housing: ['parents'] } },
    },
  },
  park: {
    name: 'Riverside Park',
    icon: 'leaf',
    floor: '#56b04d',
    floorAlt: '#4ea446',
    outdoor: true,
    start: 'E',
    map: [
      'RRRRRRRRRRRRRRRRRRRRRR',
      'R,,,,,,,,,,,,,,,,,,,,R',
      'R,,J::::::::::::,,R,,R',
      'R,,:,,,,,,,,,,,:,,,,,R',
      'R,f:,,,,FF,,,,,:,,b,,R',
      'R,,:,,,,FF,,,,,:,,,,,R',
      'R,,:,,,,,,,,,,,:,n,,,R',
      'R,,::::::::::::::,,,,R',
      'R,,,,,,,,,,,,,,,,,,c,R',
      'R,n,,,__H__,,,,OOOO,,R',
      'R,,,,,__m__,,v,OOOO,,R',
      'R,,,,,_____,,,,OOOO,,R',
      'R,R,,,,,,,,,,,,,,,,R,R',
      'RRRRRRRRRRE:RRRRRRRRRR',
    ],
    legend: {
      R: { solid: true, prop: 'tree', floor: 'grass' },
      J: { floor: 'path', prop: 'sign', act: { kind: 'activity', id: 'sprints' }, label: 'Run hill sprints' },
      f: { solid: true, prop: 'truck', act: { kind: 'snack', name: 'Food truck tacos', price: 12, mood: 3 }, label: 'Food truck' },
      F: { solid: true, prop: 'fountain' },
      b: { solid: true, prop: 'bench', act: { kind: 'activity', id: 'gaming' }, label: 'Relax on the bench' },
      n: { npc: { key: 'fan', wander: 4 } },
      c: { solid: true, prop: 'booth', act: { kind: 'activity', id: 'charity' }, label: 'Volunteer at the booth' },
      H: { solid: true, prop: 'hoop', floor: 'court', act: { kind: 'activity', id: 'hangout' }, label: 'Pickup game with friends' },
      m: { npc: { key: 'mate1', wander: 2 }, floor: 'court' },
      O: { floor: 'turf', prop: null, act: { kind: 'activity', id: 'drills' }, label: 'Run position drills' },
      v: { npc: { key: 'pet', wander: 3 }, needs: { flag: 'has_dog' } },
    },
  },
  stadium: {
    name: 'The Stadium',
    icon: 'ball',
    floor: '#9aa3ad',
    floorAlt: '#8f98a3',
    wall: '#34495e',
    wallTop: '#3f4c5c',
    outdoor: false,
    start: 'E',
    map: [
      '####################',
      '#LLLLL#ooo#rrr..www#',
      '#.....#.c.#........#',
      '#.0.1.:...:..WW....#',
      '#.....#####........#',
      '#.2...#VVV#####:####',
      '##:####.v.#ttt.....#',
      '#_____:...:........#',
      '#_____#####...y....#',
      '#__D__#mmm#........#',
      '#_____#.M.:........#',
      '#_____#####........#',
      '#######E############',
    ],
    legend: {
      L: { solid: true, prop: 'locker' },
      0: { npc: { key: 'mate0', wander: 1.5 } },
      1: { npc: { key: 'mate1', wander: 1.5 } },
      2: { npc: { key: 'mate2', wander: 1.5 } },
      o: { solid: true, prop: 'desk' },
      c: { npc: { key: 'coach', wander: 0.5 } },
      r: { solid: true, prop: 'rack', act: { kind: 'activity', id: 'weights' }, label: 'Weight room' },
      w: { solid: true, prop: 'rack', act: { kind: 'activity', id: 'doubles' }, label: 'Two-a-days' },
      W: { solid: true, prop: 'treadmill', act: { kind: 'activity', id: 'sprints' }, label: 'Speed training' },
      V: { solid: true, prop: 'tv', act: { kind: 'activity', id: 'film' }, label: 'Film room' },
      v: { prop: null, act: { kind: 'activity', id: 'meetcoach' }, label: 'Meet with coach' },
      t: { solid: true, prop: 'table', act: { kind: 'activity', id: 'recovery' }, label: 'Training room: ice & treatment' },
      y: { prop: 'mat', act: { kind: 'activity', id: 'rehab' }, label: 'Rehab session', needs: { injured: true }, alt: { prop: 'mat', act: { kind: 'activity', id: 'yoga' }, label: 'Mobility work' } },
      _: { floor: 'turf' },
      D: { floor: 'turf', prop: 'cone', act: { kind: 'activity', id: 'drills' }, label: 'Position drills on the field' },
      m: { solid: true, prop: 'desk' },
      M: { prop: 'mic', act: { kind: 'activity', id: 'media' }, label: 'Press conference' },
    },
  },
  downtown: {
    name: 'Downtown',
    icon: 'briefcase',
    ground: 'path',
    floor: '#9aa0a6',
    floorAlt: '#8f959b',
    outdoor: true,
    start: 'E',
    map: [
      '########################',
      '#GG#SS#HH#PP#XX#QQ#BB#ff#',
      '#::::::::::::::::::::::#',
      '#::n::::::a::::::n:::::#',
      '#======================#',
      '#======================#',
      '#::::::::::::::::::::::#',
      '#::n:::::::::::r::::n::#',
      '#CC#RR#$$#UU#JJ#ZZ#II#hh#',
      '###########E############',
    ],
    legend: {
      G: { solid: true, prop: 'shopfront', color: '#e63946', act: { kind: 'shop', cat: 'gear', name: 'Gear Shop' }, label: 'Gear Shop' },
      S: { solid: true, prop: 'shopfront', color: '#9b5de5', act: { kind: 'shop', cat: 'style', name: 'Boutique' }, label: 'Fashion Boutique' },
      H: { solid: true, prop: 'shopfront', color: '#f4a261', act: { kind: 'shop', cat: 'home', name: 'Home Store' }, label: 'Home Store' },
      P: { solid: true, prop: 'shopfront', color: '#2a9d8f', act: { kind: 'shop', cat: 'pets', name: 'Pet Shop' }, label: 'Pet Shop' },
      X: { solid: true, prop: 'shopfront', color: '#ffd166', act: { kind: 'shop', cat: 'toys', name: 'Luxury Toys' }, label: 'Luxury Toys' },
      Q: { solid: true, prop: 'shopfront', color: '#ff70a6', act: { kind: 'shop', cat: 'gifts', name: 'Gift Shop' }, label: 'Gift Shop' },
      B: { solid: true, prop: 'shopfront', color: '#3a86ff', act: { kind: 'page', tab: 'life', sub: 'invest', name: 'Bank' }, label: 'Bank: investments' },
      f: { solid: true, prop: 'shopfront', color: '#06d6a0', act: { kind: 'activity', id: 'parttime' }, label: 'Part-time job', needs: { stage: ['hs', 'college'] }, alt: { solid: true, prop: 'shopfront', color: '#06d6a0', act: { kind: 'snack', name: 'Coffee & pastry', price: 8, mood: 2 }, label: 'Coffee shop' } },
      C: { solid: true, prop: 'shopfront', color: '#adb5bd', act: { kind: 'page', tab: 'life', sub: 'lifestyle', name: 'Car Dealer' }, label: 'Car dealer & realtor' },
      R: { solid: true, prop: 'shopfront', color: '#d62828', act: { kind: 'activity', id: 'date' }, label: 'Restaurant: date night', needs: { partner: true }, alt: { solid: true, prop: 'shopfront', color: '#d62828', act: { kind: 'snack', name: 'Steakhouse dinner', price: 90, mood: 4 }, label: 'Steakhouse' } },
      $: { solid: true, prop: 'shopfront', color: '#118ab2', act: { kind: 'activity', id: 'agentcall' }, label: "Agent's office", needs: { agent: true }, alt: { solid: true, prop: 'shopfront', color: '#118ab2', act: { kind: 'info', text: 'A sports agency. They do not take walk-ins... yet.' }, label: 'Sports agency' } },
      U: { solid: true, prop: 'shopfront', color: '#7209b7', act: { kind: 'activity', id: 'nightout' }, label: 'Nightclub' },
      J: { solid: true, prop: 'shopfront', color: '#fb8500', act: { kind: 'activity', id: 'charity' }, label: 'Youth center: volunteer' },
      Z: { solid: true, prop: 'shopfront', color: '#4361ee', act: { kind: 'activity', id: 'business' }, label: 'Your business', needs: { flag: 'has_business' }, alt: { solid: true, prop: 'shopfront', color: '#4361ee', act: { kind: 'info', text: 'An empty storefront. Maybe someday it is yours.' }, label: 'For lease' } },
      I: { solid: true, prop: 'shopfront', color: '#ef476f', act: { kind: 'activity', id: 'hangout' }, label: 'Arcade with teammates' },
      h: { solid: true, prop: 'shopfront', color: '#8ecae6', act: { kind: 'activity', id: 'yoga' }, label: 'Yoga studio' },
      n: { npc: { key: 'fan', wander: 5 } },
      a: { npc: { key: 'agent', wander: 2 }, needs: { agent: true } },
      r: { npc: { key: 'rival', wander: 3 } },
    },
  },
};

export const FLOOR_COLORS = {
  floor: null, // place default
  grass: ['#56b04d', '#4ea446'],
  path: ['#c9b48a', '#bea97f'],
  court: ['#c2703d', '#b8683a'],
  turf: ['#3f9a3c', '#4aab44'],
  road: ['#3d4248', '#373c41'],
  water: ['#3a86ff', '#2f75e6'],
  door: ['#6b4423', '#5e3b1e'],
};
