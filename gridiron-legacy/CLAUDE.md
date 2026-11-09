# Gridiron Legacy — project brief and status

Read this every session. Run instructions are in README.md.

## What we are building
An American football career and life-sim browser game. One athlete, high school to the Hall of Fame.
Like New Star Soccer in mechanics only: the player controls key moments (throw, cut, catch, later
tackle/kick); everything else is simulated. Around it: weekly schedule, relationships, money, fame,
health and branching events. Look: retro voxel/pixel athletes on a 3D field with an angled camera (see v0.6). Clean and
distinctive, not realistic. Do not copy any other game's look, art or assets.

## Tech rules
- Browser, mobile-first (portrait, touch, big tap targets), also mouse + keyboard.
- Plain HTML + JavaScript ES modules + three.js (vendored). No framework, no build step.
- Multi-file project: `src/core`, `src/data`, `src/sim`, `src/ui`, `src/scenes`, `src/audio`, `tests/`, `tools/`.
- `src/sim` must never touch the DOM (it runs in Node for tests and balance scripts).
- Data-driven: events, teams, names, activities, items live in `src/data`.
- 3 save slots in localStorage; every storage call wrapped in try/catch (see `src/core/storage.js`).
- Original, fictional names only. List every asset and license in ASSETS.md.
- Commit after each working milestone. Later (only once fun): optional Capacitor iOS wrap.

## How to work with the owner
- Plain language, little jargon. Tell them exactly how to run and test each change.
- Before building something large, give a short plan and ask about real design decisions.
- If something is too big or risky, say so and propose a smaller first version.
- After `npm test` passes and the change is verified in a browser, commit.

## Status (v0.1)
Built in one pass covering most of the brief's milestones 1-7 at a first-version level:
- Weekly life-sim loop with energy budget, 21 activities, 125 branching events (hs/college/pro/any),
  chained storylines via flags, risky dice choices.
- Leagues: 10-team high school, 12-team college, 30-team pro (2 conferences) with generated rosters,
  round-robin schedules, standings, playoff brackets, title games.
- Key moments: QB throw, RB run, WR route & catch in three.js, with play calls and stat-tied timing.
- Relationships (coach, teammates, family, partner, agent, rival), money (salary, sponsors, rent,
  cars, perks, investments, side business), fame and press (headlines + fan posts), injuries
  (play hurt or sit), suspensions, grades/eligibility.
- Recruiting, declare early, draft, rookie contracts, free agency under a salary cap, retirement,
  awards, records book across decades, legacy tiers, Hall of Fame screen.
- Title backdrop, light/dark theme, synthesized SFX, tutorial tips, settings, export/import saves.
- Tests: `npm test`. Balance: `npm run balance`.

## v0.2 changes
- Retro pixel-art look: scene rendered at low resolution and scaled up crisply; procedural pixel
  sprites (`src/scenes/pixelart.js`); flat-color stadium; weather particles; slow-mo and screen shake.
- Cornerback position (coverage + open-field tackle), with defensive stats, DPOY, INT records.
- 11 minigame types, route concepts and coverages, harder default timing, difficulty setting.
- In-game: 26 mid-game events (`src/data/gameEvents.js`), 4th-down decisions, two-minute drills /
  final stands, weather, momentum, 5-8 moments per game.
- Modern UI: Inter + Silkscreen fonts (vendored), SVG icon set (`src/ui/icons.js`), glass HUD.

## v0.3 changes
- Sharper sprites: 24x32 skeleton-posed pixel art with shading, 28 poses, casual-clothes style.
  Animation system in `src/scenes/actors.js` (one-shot actions, held poses, backpedal, celebrations).
- Fixed minigame spawns near the goal line (all positions relative to the field); goalposts fade.
- Store (`src/data/items.js`, `src/sim/shop.js`): 40+ items; gear adds to minigame tolerance.
- People & interactions (`src/data/interactions.js`, `src/sim/social.js`): 3 named teammates per team,
  dialogue choices, gifts; chats free weekly, bigger plans use a day slot ({ done } plan entries).
- Walkable places (`src/data/places.js` text maps, `src/scenes/world.js`, `src/ui/screens/world.js`):
  Home, Park, Stadium, Downtown. Activities there fill the week plan.

## v0.4 changes
- Weather: weekly forecast (`state.week.forecast`), storm and fog added; wind drifts passes, rain/storm
  slip (drops, fumbles, slips on cuts), snow slows players, fog hides reads; lightning; world weather.
- Cities with 2-3 high schools (`CITIES` in teams.js), crosstown rivals; 32 colleges / 4 conferences;
  randomized offers; pick-by-pick draft with team needs (`teamNeed`, `draftStock` in flow.js).
- Phone (`src/sim/phone.js`, `src/ui/screens/phone.js`): texts, Huddle social feed/posts, bank, calendar.

## v0.5 (round 1 of 5) changes
- Low-poly 3D jointed rig with toon shading (`src/scenes/actors.js`) for players and townspeople;
  procedural poses/actions/celebrations; 3D menu portraits (`src/scenes/portrait.js`). Pixel art removed.
- Free-control plays (`src/scenes/play/engine.js`, `controls.js`, `src/data/playbook.js`): 22 live
  players, joystick/WASD, sprint/juke/spin/stiff/dive, OL/DL engagement, man/zone coverage, tackle
  tells (red ring + windup), AI QB reads, TD celebration cutscene. Smooth full-res rendering.
- Remaining rounds: 2 customization + unique NPCs + jerseys; 3 graphics; 4 team-colored menus +
  awards/standings; 5 message responses, field minigames, story cutscenes, training minigames.

## v0.6 (round 2 of 5) changes
- Retro voxel art direction (owner's reference: chunky pixel/voxel athletes, CRT-style dark UI). Characters
  are box rigs with big heads and 12x12 pixel-art face/hair textures (nearest filtering); scene renders at
  ~560 pixel rows and scales up crisply; voxel crowd + ad boards; darker grass.
- Looks (`src/data/looks.js`): skin, 12 hair styles + colors, eyes/brows/nose/mouth/beard, arm tattoos,
  gear (cleats, gloves, wristbands, arm sleeves, visor, eye black), height/weight (small rating nudges),
  TD celebration. Editor `src/ui/screens/look.js` (creation + Career tab "Edit look"). Every NPC and every
  on-field player gets a unique random look; old saves upgrade via `normalizeLook`.
- Kits (`src/data/kits.js`): home/away/third per team; pregame lineup + uniform picker (`g.kit`);
  opponent picks a non-clashing kit.
- Retro arcade theme in `styles/main.css` (dark by default, team-colored top bar/tabs, scanlines).

## v0.7 (round 3 of 5) changes
- Swag (looks.js + Swag tab in the editor): knee braces, leg sleeves, elbow pads, two-tone cleats, tape spats,
  towel, hand warmer, chains, 8 visor tints, more gear colors. Older looks get swag defaults in `normalizeLook`.
- Stadium detail: textured tiers, roof canopies with light strips, big screen with the live score
  (`stadium.setScoreboard`), instanced sideline teams + benches, pylons, down-marker sticks, real team names
  in the end zones.
- Play-by-play commentary banner (`src/data/commentary.js`, `hud.say`), retro HUD styling.
- Walkable places: 16px pixel floor textures (planks, grass, stone, asphalt, water), brick/painted walls with
  caps, voxel trees/plants, instanced grass tufts and flowers, closer camera.

## v0.8 (round 4 of 5) changes
- Animation flow: hip/shoulder counter-rotation, steady head, knee lift + forearm lag, double bounce and sway,
  banking into turns and leaning into acceleration (turn rate/accel tracked in `animateRun`), idle weight shift
  and glances.
- In-game: 50 events (24 new) incl. a `presnap` trigger right before your key moments (audibles, hot routes,
  blitz reads, jump the route...); random penalty flags during free-control plays (holding, PI, facemask).
- Awards: `TROPHIES`, `recordLeagueAwards` (state.awardHistory: who won each award every season), `awardWatch`.
  Career tab subtabs: Profile / Awards (trophy case, team achievements, live award watch) / League Awards.
  `history` entries now store madePlayoffs + seed.
- Standings: badges, W-L, games back, point diff, last-5 form, playoff line. Team colors carried through menus
  (card tops, subtabs, labels, tabs) with `--team-ink` for contrast.

## v0.9 (round 5 of 5) changes
- Ragdoll tackles (`ragdoll`/`endRagdoll` in actors.js: physics tumble of the body inside the root, ground contact
  from the real bounding box, flailing limbs, settles flat). Hard hits (`hardHit` in engine.js): BIG HIT/BOOM,
  slow-mo replay camera (`cinematic` in director.js, letterbox via body.cine), optional pixel blood
  (`bloodBurst`, Settings → Blood effects), and a chance of a real injury (result.injured → sim injury, userOut).
- Training drills (`src/ui/screens/drills.js`): Sprint Ladder, Power Reps, Cone Reaction, Film Room; result stored
  in `state.week.drills[slot]`, scales training 0.6x–1.5x (`drillMultiplier` in week.js).
- Phone (`src/data/texts.js`): templated texts with contextual replies (bond + effects + their answer),
  troll comments on your posts with clapback risk (`replyToComment`).
- In-game event risky choices are playable (`clutchChallenge`: timing or mash), outcome forced into
  `resolveGameEvent(state, idx, forced)`.
- Cutscenes (`src/scenes/cutscenes.js`, `runCutscene` in director): tunnel run-out (first game at each level),
  draft night, trophy lift (champions), Hall of Fame induction. Skippable; off with Reduced motion.

## Known gaps / next ideas
- Pass rush and kicking minigames not built yet.
- Minigame feel needs real-device playtesting and tuning (timings in `src/scenes/minigames/*`).
- Events: 125 written; brief asks for hundreds. Add more, especially multi-step storylines.
- AI pro rosters are simple (no depth charts or AI trades); the player's team role is always starter.
- No music yet. No iOS wrap yet.
