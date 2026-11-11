# Gridiron Legacy — project brief and status

Read this every session. Run instructions are in README.md.

## What we are building
An American football career and life-sim browser game. One athlete, high school to the Hall of Fame.
Like New Star Soccer in mechanics only: the player controls key moments (throw, cut, catch, later
tackle/kick); everything else is simulated. Around it: weekly schedule, relationships, money, fame,
health and branching events. Look (since v0.20): smooth, realistic-leaning 3D athletes with human proportions, real
lighting and a modern UI (the old retro voxel/pixel style was retired at the owner's request). Clean and distinctive. Do not copy any other game's look, art or assets.

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

## v0.10 changes
- QB balance: tighter man coverage in pass mode, contested-catch breakups, defenders burst on the catch,
  AI ball carriers juke/break tackles less and run slightly slower after the catch.
- Playbook pool (`MORE` + `dealPlays` in playbook.js): 6-10 plays per mode/call, 3 random each snap.
- Brawling: `battle()` in engine (blocks sway, trade shoves, pancakes either way), CB/WR hand-fighting,
  pile-ons after tackles, post-whistle scuffles, `dustPuff` turf on contact and sprints.
- New position DT (Defensive Tackle): moments `dt_rush` (mode 'rush') and `dt_run` (mode 'runStop'). You
  start locked with a blocker; build LEVERAGE by driving into him, RIP/SWIM/BULL RUSH to shed, SACK the QB,
  BAT passes. Stats defSacks/tfl; awards/records/press/grades handle DT; `DEF_POSITIONS` in game.js.
- Stadium audio (`src/audio/stadium.js`): crowd bed, reactions aware of home/away (`react(kind, homeGood)`),
  chants, air horn, chiptune music loops (Settings → Stadium music).
- Visuals: cheering fans with raised arms, signs, camera flashes, crowd hype (`ctx.hype`), TD flame jets +
  fireworks (`src/scenes/fx.js`), crowd cam at the end of TD celebrations, ball trail, end zone stripes,
  midfield team letters, team-colored border; broadcast score bug + player name tag in the HUD.
- Texts: random wordings per reply (`ALT`, `ALT_BACK`), Huddle Mentions thread (`TAGS`, `sendTag`).

## v0.10.1: size matters
- Bigger visual size spread (`bodyScale` in looks.js). On-field entities carry hIn/wLb/mass: within-position
  speed from weight/height, mass-weighted collisions, block push and pancakes by mass ratio, broken tackles
  and hit power by mass, catch radius and contested catches by height, bull rush by mass. Pre-snap shows the
  size matchup; HUD tag, pregame lineup and profile show height/weight.

## v0.11 changes
- Fixed: every touchdown froze the game (flameJet color index went negative). Effects now run in try/catch,
  and runMinigame auto-sims a play (fallbackQuality) after repeated update errors instead of freezing.
- Sacks/TFL now keep negative yardsAllowed through `finalize` (ball moves back).
- Instant replay: engine records root/body/joint transforms ~30 fps (`record`/`applyFrame`); after each play a
  REPLAY / CONTINUE prompt; slow-mo playback with sideline / end zone / sky-cam angles (`runReplay`).
- Pixel team crests with mascot glyphs (`src/ui/crest.js`), used by `teamBadge` everywhere.
- Week tab: team hero banner (crest, mascot name, record, streak, rank), Highlight Reel of real snapshots
  (`ctx.snapshot` in director → result.highlights → state.highlights, last 8), side decorations on wide screens.

## v0.12 changes
- O-line: pass pro locks every lineman onto a rusher at the snap; they punch forward ~1s, then anchor and give
  ground slowly; rushers shed slower when you're on offense.
- WR: the QB throws to where YOUR ROUTE will be (closest point on the route + your speed) unless you CALL FOR
  IT; tighter man coverage on the user receiver.
- Quick-time events (`startQte` in engine; `ctx.setTimeScale` in director): contested catch (ring), CB breakup
  (ring), fight for yards / reach for the end zone (mash). Max 2 per play. CSS `.qte--ring/.qte--mash`.
- Slow-mo: diving catches (`completeCatch`), goal-line dives on TDs, QTE wins; all snap highlight pictures.
- Pixel activity icons (`src/ui/pixelIcons.js`, used by `activityIcon`), livelier week UI.
- Life → Social (`src/data/life.js`, `src/sim/life.js`, `src/ui/screens/social.js`): meet someone (personality-
  driven 3-round first date → partner), 6 date-night venues, 6 hangouts; each uses a day via `useDaySlot`.
- Level-appropriate content: game events can have cond.stages (new hs/college/pro events), some "any" weekly
  events limited to college/pro, no brand tags in HS. Stadium `setLevel('hs'|'college'|'pro')`: HS bleachers +
  fence + press box + small scoreboard, college bowl + band section, pro upper deck + roof + big board.

## v0.13 changes (owner's screen-recording reference: soccer career game)
- Live match screen (gameday.js): sticky match header (crests, score, LIVE, clock), drive chart canvas (bar per
  drive up/down by team, height by result, T/F markers, momentum line), headline, icon feed, bottom bar with live
  RATING (+delta, sparkline), ENERGY, APPROACH (attacking/balanced/careful) and INTENSITY (low/mid/high) toggles,
  pause and x1/x2/x3 reveal speed, TOUCHDOWN banner, pregame "where you line up" diagram (`positionDiagram`).
  Sim: g.plan, g.energy, g.rating/ratingHist/lastDelta, g.chart; `setGamePlan`, `planBonus`/`planRisk`, INTENSITY.
- Replay controls: pause, 0.5x/1x, YOUR CAM (drag to orbit), SAVE to highlight reel, close; progress bar.
- Career: `src/sim/legends.js` (generated legends per save seed, `legendBoard`, `allTimeRank`, `awardRace`,
  `marketValue`, `journey`), `src/ui/screens/careerStats.js` (level/skill points card, all-time rank teaser,
  overall cards, by-season bars + table, by level, journey, market/NIL value). Tabs: Career / Trophies /
  Award Race (podium + young-player race) / Legends / League Awards.
- Levels & skill points: `src/sim/progress.js` (XP from games, training, awards; 1 point per level; cost rises
  at 80+/90+).
- Team → Lineup (`src/ui/screens/lineup.js`): formation of your unit with portrait cards, captain C, bench.
- Life → Home (`src/data/home.js`, `src/sim/home.js`, `src/ui/screens/home.js`): 8 upgrade lines x3 levels
  (energy/health/mood/fame/training perks), 2 free home actions per week (physio, sleep, eat, study = +4%
  timing, stretch = half training injury risk), Visit my home.
- Outfits: Casual + Gala tabs in the look editor; `outfit: 'gala'` suit with tie used in draft/HOF cutscenes.
- Stadium: triangle bunting and a tifo banner (big games / college / pro), `setBigGame`.
- Week: last-5 form chips for both teams, "The Stands" fan ticker.

## v0.14 changes
- Scenery outside the stadium (`src/scenes/environment.js`, `stadium.setEnvironment(biome, seed)`): city skyline
  with lit windows, farmland (fields, barns, silos, water tower), pines + mountains (snow caps), desert mesas +
  cacti, coast (ocean, boats, lighthouse, palms), bayou (cypress, pools). Distance haze in `applyAtmosphere`.
- Team culture (`src/data/culture.js`, `teamCulture(team, level)`): biome from the city name, stadium name +
  nickname, tradition, home-field trait (loud/altitude/heat/cold/humid/wind/intimate; real effects in game.js for
  visitors: timing, energy drain, momentum swings; home teams get +2% timing), turf color, end zone pattern,
  crowd look (whiteout/blackout/color rush), stadium song. Shown on the pregame venue card and match header.
- Helmets: 8 facemask styles (`MASK_BARS` in actors.js), facemask color (incl. team), stripe (single/double/
  triple/none), shell finish (gloss/matte/chrome); Helmet tab in the editor; AI masks by position (`POS_MASK`).

## v0.15 changes
- Traits (`src/data/traits.js`, `src/sim/traits.js`): 5 per position (QB/RB/WR/CB/DT) plus 3 for any position,
  unlocked by career stats, player level or teammate relationship (`checkTraitUnlocks` after each game, new
  unlocks are auto-equipped into a free slot). Slots: 1 at the start, 2 at level 5, 3 at level 10. Stored in
  `player.traits {unlocked, equipped}`; Career > Traits page; unlock cards on the results screen. The play
  engine reads `opts.traits` via `has(id)`; workhorse/captain also affect the sim (game.js).
- Animation: joints are damped springs (`u.jv`, `u.rzv`), per-player gait, `bump()` staggers on contact,
  knockdowns are short ragdolls, hard hits ragdoll the tackler too.
- Game speed: `settings.gameSpeed` (Slow 0.72 / Realistic 0.85 default / Fast 1) sets `R.playSpeed` during plays.

## v0.16 changes
- SNAP button (Space) on offense, incl. the goal-line dive: you snap the ball when ready; a 15-second play clock
  snaps it for you. Defense still snaps automatically.
- Coverage (engine `aiDefense` man block): defenders read the receiver with a reaction lag (`e.rv`), keep a
  shrinking cushion and stay on top, backpedal then flip and match speed; safeties shade over the deepest route;
  AI receivers throttle down at breaks. Window size scales with your QB skill (`qbSkill`). Separation at 1.8s went
  from ~3-7 yd to ~1-2.5 yd.
- Sideline life (`src/scenes/sideline.js`, `stadium.sideline`): voxel team mascot per mascot kind (sideline + behind
  the far end zone), cheer squads (fewer in HS), bench backrests in team colors, coaches with headsets pacing,
  cooler tables, kicking nets, photographers.
- Between-play broadcast shots (`src/scenes/interludes.js`, run by `runMinigame` when `opts.interlude` is set,
  ~55% of plays from gameday): mascot, cheer, coach, crowd, huddle (your unit), bench. Tap/any key skips.
- More time on the ball: after a non-scoring moment the same series can continue (`d.series`, up to 2 extra snaps,
  odds rise with OVR and play quality); a long series can use up a later scheduled drive; label "Same series".
- Training points (`creditTraining` in progress.js, `player.trainPts`): drill grades earn A+ 60% / A 45% / B 30% /
  C 15% toward a bonus skill point (only improvements count on retries). Shown on the drill card, result screen
  and Career skill card.
- tools/balance.js handles DT.

## v0.17 changes
- Game wear on uniforms (`applyWear`/`addWear` in actors.js): grass, dust, mud (wet games), blood flecks (Settings),
  soaked/darker fabric with wet glints in rain/storm, snow flecks; grows with `opts.wear.progress` (gameday:
  drive cursor / drives), linemen dirtiest, more after going down. Stained copies are cached by bucket + variant.
- Field weathering (`src/scenes/fieldwear.js`, `stadium.fieldWear`): transparent pixel layer per game (key) with
  footprints, cleat divots, slide marks and worn patches between the hashes; mud in rain, churned snow blanket.
- Practice mode (`src/ui/screens/practice.js`, title button): every moment type per position, skill level, opponent,
  weather, field position, call; drills and clutch challenges. Never touches saves.
- Opponent strength matters (`matchup()` in game.js, k -1.5..1.5 vs league average of the unit you face): scales
  tolerance (±13%) and, in the engine (`opts.oppStrength`), defender speed, coverage reads, pass-rush shed rate,
  blocker strength vs your rush and AI ball-carrier jukes. Matchup chip on the pregame venue card.
- Your real hometown (`src/data/hometown.js`): type a town in Create; two schools (yours + crosstown rival) with
  mascots from name hints and palette colors, stable by name; replaces Mill Creek in the HS league
  (`teamDefs(kind, state)` with `state.career.customTown`).
- More detail: fans with faces, hair/hats, size variety and facing the field (matrices built once, then only Y is
  updated); bench players with pads, sleeves, facemasks, numbers, socks, helmet-off players and size variety;
  mascots with brows, cheeks, teeth, number, tails, fingers; cheerleaders with faces, bows, hair styles, trim.
  Sideline figures are baked into vertex-colored meshes (`bake` in sideline.js) to keep draw calls low.

## v0.17.1: more flags, both sides
- Post-play flags (~15% of plays, `maybeFlag` in engine; `globalThis.__flagRate` overrides for tests): DPI (spot foul),
  defensive holding, roughing the passer (wipes out sacks), facemask, horse-collar, late hit, illegal contact on the
  defense; holding, OPI, illegal block in the back, chop block, illegal formation/shift, intentional grounding on the
  offense; offsetting penalties; flags on you when you're involved. Half the distance near the goal.
- Pre-snap flags (`preSnapFlag`): false start, illegal motion, encroachment, neutral zone, DT offsides, offsides =
  free play (accepted only if the play went badly), delay of game when the 20-second play clock runs out.
- Results carry `penYds` (+ toward the offense's goal) and `autoFirst`; resolveMoment moves the ball with them but
  never adds them to stats. Simulated drives in the feed get penalty notes too.

## v0.17.2: clocks
- Match screen: scoreboard game clock (`runClockTo` in gameday.js) ticks down between feed entries, quarter progress
  bar; drive clocks now always run down within a quarter (createUserGame).
- In plays: score-bug game clock runs while the ball is live (`gameSecs`, `hud.clock`), stops when the play is dead;
  PLAY CLOCK box pre-snap (`hud.playClock`, real seconds, red at 5) — 20 s on offense, then delay of game.

## v0.17.3: tuning
- Flags: post-play 5% (was 15%), pre-snap 1.2% + free play 0.8%, sim drive notes 6%.
- Coverage loosened: AI receivers no longer slow down much at breaks, defenders read later (0.2 s + skill) with a
  random "slow" defender now and then, bigger cushion floor (1.4 + skill), no longer outrun receivers. Probe: one
  receiver usually 3+ yd open at 1.8 s; throwing to the most open man completes ~5/6 for 3-8 yd.

## v0.18: more customization
- Jersey tab (looks.js JERSEY_* lists, `JERSEY_DEFAULTS` merged into old saves): sleeves (standard / cut-off / long
  undershirt), length (full / cropped with undershirt or bare band), fit (tight / normal / loose = torso + arm
  scale), shoulder pad size (scales pads + shoulder width), back plate, horse collar (neck roll), undershirt color,
  socks (team / white / black / striped), mouthguard (hangs off the facemask).
- Gear: 8 cleat designs (`cleatDesignTex`), low / mid / high cuts, glove designs + accent color.
- Hair: twists, cornrows, undercut, pompadour, spiky, ponytail, waves, frohawk, slicked back. Facial hair: boxed,
  long (hanging volume), mutton chops, handlebar, Van Dyke, soul patch. Tattoos: flames, skull, wings, rose,
  numbers, geometric, koi, plus a neck tattoo (`neckMat`).
- Random NPC looks use the new options, matched to position (linemen big pads/neck rolls, skill players small pads,
  tight fits, crop tops).

## v0.19: installable phone app (PWA)
- `manifest.webmanifest`, `icons/` (pixel football, 192/512/maskable/apple-touch), `sw.js` (network-first cache:
  updates appear on next open, offline falls back to cache; bump CACHE when the file list changes), iOS/Android meta
  tags and SW registration + `navigator.storage.persist()` in index.html (skipped inside iframes like the artifact).
- Hosting: `.github/workflows/pages.yml` deploys gridiron-legacy/ to GitHub Pages on pushes to the dev branch and
  main. Live app: https://cartparti.github.io/Gridiron-Legacy/ (repo renamed from Star-wars-blaster-battle). Saves stay in localStorage on that address, so never change the Pages URL without telling the owner
  (Export/Import save moves careers).

## v0.20: realistic art direction, stage 1 (players, rendering, field, type)
- Renderer: antialiased full resolution (DPR cap 1.75), ACES tone mapping, hemisphere + key + rim lights and a baked
  gradient environment map (PMREM). No CRT scanlines / RGB-split text. Portraits render at 2x with the same look.
- Characters keep the same rig/animation/material system but use `softBox` (rounded box that preserves face groups/UVs)
  and `limb` (tapered capsule-like) geometry; smaller head (headScale 0.86), V-taper torso, thicker neck.
  `toon()` now returns MeshStandardMaterial (name kept); `shiny()` for helmets/masks/chains. `pixMat` draws on the
  same logical grid but renders at TEX_SCALE (crisp) or upscaled-smooth (`soft`) with linear filtering; materials
  store `userData.logical` (stains use it). New hand-drawn smooth face (`face2` keys). Helmet = one rounded shell with
  an invisible front face group, gloss/matte/chrome roughness, round bars. Soft radial contact shadows.
- Field: 16 px/yd mowed turf with gradients, cross-mow, patches, blade noise, crisp lines. UI font: Inter 800 via
  `--pixel` (Silkscreen no longer used).
- Next stages: stadium/crowd/sideline/mascots smooth (still blocky), then menus.

## v0.21: human bodies + places overhaul
- Bodies: `headShape` (oval/round/square/long/wide/heart via `headGeo`: proportions + jaw taper) and `bodyType`
  (lean/athletic/muscular/stocky/lanky: torso width/depth, limb thickness, belly, lanky height). Joint blending
  spheres (hips, knees, deltoids, elbows) + trapezius and belly volumes so the rig reads as one body. Body tab chips.
  Random NPCs get position-appropriate body types.
- Places (`src/data/places.js` is generated by `python3 tools/places/generate.py` from `tools/places/maps.py`: PLACE_DEFS with `variants`
  per stage, `placeFor(id, stage)`): Home = Family Home / Dorm / Penthouse; Stadium = School Athletics / Athletic
  Center / Team Facility; Park = Town Park / Campus Quad / Waterfront Park; Downtown = Main Street / College Town /
  City Center. Organized rooms with floor labels (`rooms`), floor characters `FLOOR_CHARS`, `span` props.
- `src/scenes/props.js`: rounded, lit furniture/street props (bed, bunk, desk+chair+monitor, bookshelf, counters with
  sink/stove, fridge, island+stools, dining table+chairs, TV wall with live screen, film screen+seats, sectional with
  coffee table, power rack, treadmill, lockers+bench, trainer table, cold tub, sled, press podium, vending, plants,
  trees, campus buildings, shopfronts with awnings/signs, facades, hedges, lampposts, food truck, gelato cart, booth,
  hoop, fountain, dog). World engine (`src/scenes/world.js`) rewritten: painted high-res floors (wood, vinyl, marble,
  tile, concrete, polished, rubber, turf, court, grass, path, pavers, road w/ center line, boardwalk, rugs with
  borders), thin cutaway walls (back 3.0, interior 1.15, in front of you 0.28) with baseboards + back-wall windows,
  props turned to face the room (couches face the TV), near-side shops cut low with floating name boards, skyline /
  tree backdrops, soft shadow-mapped key light (renderer.shadowMap on; only world lights cast).

## v0.22: people, plays, halftime, injuries, cinematics
- People: `sculpt()` lathe limbs (calf/forearm/thigh muscle profiles), rounder cranium, nose + ears. Gender is a look
  field: `randomLook(r, {gender})` picks from `MALE_HAIR`/`FEMALE_HAIR`; girls get earrings, lips, lashes, softer
  brows, narrower shoulders/wider hips, and a dress (`o.dress`) when not in uniform. `feminize`/`masculinize` fix up
  old saves; `sim/social.js ensure()` enforces partner/agent gender (female `PARTNER_NAMES`, `FEMALE_AGENTS`).
- Playbook: big per-mode pools (`BIG`) merged into `PLAYS`; `dealPlays(mode, call)` shows 2 from your call + a wildcard
  and skips the last 12 shown. In-play QTEs are rolled per play (`qteOn`, max one per play) instead of every catch;
  new sack QTEs (`WRAP HIM UP!` for DL/blitz, `BREAK THE SACK!` for QB).
- Hometown "Sandy" → school 1 is "Stone Lopez Academy" (`hometown.js`).
- Halftime: `g.halftimeUI` makes `stepGame` return `{type:'halftime'}` once; `g.half` is the first-half snapshot.
  `showHalftime()` opens the locker room (`sets.js lockerRoom`, styled per level, team colours + crest) via
  `director.openSet`; one pick from `HALFTIME_CHOICES` (rest +15 energy / speech momentum / study +5% timing).
- Injuries: INJURIES carry `part`/`severe`/`bone`. `hardHit` can injure (you or ~3% AI), bends the limb wrong
  (`applyInjuryLook`, bone poke for `bone`), slows the dead phase, and pops an X-ray card (`play/xray.js`). The
  result's `injuryId` feeds `newInjury(state, {id})` so the report matches what you saw.
- Cinematics: `cutscenes.playerOfGameCutscene` (postgame POTG, `lastGame.potg`), `sets.js` banquet (season awards),
  date, hangout, gaming scenes via `runSetCutscene` (social screen dates/hangouts, world activities).
- Tests: `tests/round8.test.js`.

## v0.23: real hair + football physics
- Uniforms are guys only: `makePlayer` forces a male look (girls are cheerleaders, fans, dates, family, press).
- Hair (`actors.js` HAIR_SPEC / addHairVolume): no boxes. A shell = hi-res `headGeo(shape, 16)` pushed out along
  the ellipsoid normal by a per-style thickness, feathered under the scalp at a hairline (F/S/B polar angles, or a
  custom mask for mohawks); strand/curl/wave/rows canvas textures with bump. Hanging hair = tapered `lockGeo`
  tubes (long, ponytail, braids with bumps, locs); buns/twists/curls are blobs, spikes are cones, mohawk/frohawk a
  squashed ridge tube. `helmetHair` hangs long hair/ponytails/braids/locs out of the helmet. Geometry cached per
  head shape + style.
- Football: `makeBall` is a lathe football (pebbled leather, stripes, laces). `play/ballphys.js` simulates it:
  gravity, tumbling, the erratic tip bounce, then a curling side-roll to rest. Passes spiral (`orientInFlight`,
  `flight.wobble` for ducks); the carrier holds it in the right hand (`carryBall`).
- Fumbles are live: big hits raise `fumbleP` (also the QTE-fail tackle path and strip sacks); `fumbleOut` pops the
  ball, everyone `chaseLoose`s, `updateLoose` handles bobbles, falls on it (`finishLoose` → tackle/td/fumble
  whistle), out of bounds (offense keeps it), or YOU scoop it (`e.scoop` → SCOOP AND SCORE / FUMBLE RECOVERY).
  Incompletions/PDs/batted balls bounce away. Test hook: `globalThis.__forceFumble`.

## v0.24: human skulls, faces and necks
- `headGeo(shape, seg, sex)`: real proportions (taller/deeper than wide), skull sculpt (occiput, sloped forehead,
  temples, the nape tucked in behind the jaw, male jaw angle) + face sculpt placed by the face texture's own UVs
  (brow ridge, eye sockets, nose bridge/tip/nostrils, cheekbones, muzzle, lips, chin; softer for girls). Seams share
  displacement/normals (`smoothSeams`). seg 30 bare heads, 12 under helmets. Painted nose cone removed.
- Measured texture->head mapping (Y: crown +1, chin -0.83): nose tip -0.27, under nose -0.40, mouth -0.56, lower lip
  -0.62, chin -0.78; mouth corners X +-0.19. `BEARD_MASK` uses these.
- `neckGeo` lathe neck (wider into the traps, thicker for players, slimmer for girls) + Adam's apple for guys; head
  sits higher (headGroup y 0.035) so the neck shows. `earGeo` shell ears set back at eye level.
- Beards are 3D (`addBeard`, curl texture) with a cheek line sloping to the sideburns and the back edge following the
  jaw; the face texture only keeps a soft shadow under them. Side/back/top head textures are plain skin now.

## v0.25: unique faces, clean jaw lines
- Look fields `jaw` (defined/sharp/square/soft), `cheek` (normal/high/chiseled), `chin` (normal/strong/pointed/small),
  `faceW` (narrow/normal/broad); randomized per person, editable in the Body tab. `faceParams(L)` fills missing ones
  from a hash of the look (old saves get unique faces, nothing is written back). `L.nose` drives the sculpted nose.
- `headGeo(shape, seg, sex, fp)`: JAW_K/CHEEK_K/CHIN_K/FACEW_K/NOSE_K. The jaw underside is lifted to one slanted plane
  chin -> neck (no double chin); jaw width spans cheek to ear; vee taper to the chin. Hair shells and beards use the
  same fp so they fit. Tests: `tests/round9.test.js`.

## v0.26: living skin, 3D eyes, cleaner faces
- `skinMat`/`skinPhys`: MeshPhysicalMaterial with warm sheen, light clearcoat and a touch of warm emissive (matte
  skin read as clay). `pixMat(..., { skin: true, scale })` gives textured skin (face, head sides, neck, arms) the same.
- Face texture painted at 24x (288 px) with tapered arched brows, natural lip tint, soft blush, a nose-bridge
  highlight; painted eyeballs removed. `EYE_COLS = [3.1, 8.9]` (eyes set wider); sockets, brows and anchors use it.
- `makeEyes`: glossy eyeballs (iris texture faces -z at u=0.75), skin-coloured upper/lower lid caps (`EYE_OPEN` per
  eye style), lash line (thicker + wing for girls); `blink()` in animateRun tips the upper lids. Anchors come from
  `headGeo(...).userData.eyes`. Bare heads seg 40.
- Shading lessons: a steep nose underside, cheek hollows at nose height, or a drooping "long" nose all cast a band
  under the nose that reads as a mustache. Keep the nose easing into the lip and the hollows low/out toward the jaw.

## v0.28: real tattoos + situational football
- (v0.27 MakeHuman heads were reverted; heads are the v0.26 sculpted ones.)
- Tattoos: `drawTattoo(g, style, x0, y0, w, h, { aspect, seed, skin, size })` paints vector ink art (soft bleed) on the
  limb's wrap-around texture; `aspect` corrects for the limb being wider round than its texture is tall (arms ~2.2-2.6),
  `size` scales designs for small areas (neck). Arms render crisp at 24x (`armMat` key `arm2`), neck at 32x (`neck2`).
- Plays: `situationOf(m)` (goal line <=5, red zone <=20, backed up >=88, short <=2, long) and `playFit(mode, pl, s)` score
  every play; `dealPlays(mode, call, m)` returns the best fits (with variety). `RED` pools hold red-zone/goal-line
  concepts (red: true, never offered outside the red zone). The picker shows the situation tag.
- Engine: routes are scaled to fit the end zone (`room = yardLine + 8.6`, break points scale too); backed up -> `under`
  centre (own goal < 3 yds) or pistol (< 6.5) instead of shotgun.
- Sim: Hail Mary only on the last drive of a half from 40+ out; ~6% of moments are backed up (88-97); no RB screens from
  your own end zone.

## v0.29: what's new + cleaner menus
- `src/data/changelog.js` (newest first, plain language) + `src/ui/whatsnew.js`: shown every time the game opens
  (`app.init`), skipped in automated browsers (`navigator.webdriver`) unless `window.__forceWhatsNew`. ADD AN ENTRY
  for every update the player will notice. No slide-in animation (it stalled over the 3D title screen).
- Look editor: `TABS` (id, label, icon) in `TAB_GROUPS` (You / Uniform / Off the field) shown as an icon grid;
  every view is built from `sec(title, ...rows)` cards; `toggle()` for on/off; preview in a sticky `.look-sticky`.
- Create screen: Position moved above Look; 5-column cards that fit; `.pos-detail` with stats sorted by weight as bars.

## v0.30: a real career
- `src/sim/career.js`: depth chart (`p.depth = { role, rival, trust }`; `initDepth` on every new team/stage with an
  edge, `weeklyDepth` promotions/benchings/injuries ahead of you, `depthAfterGame`; backups get 2 late moments via
  `momentCount` + late candidates in `createUserGame`), award race (`state.race`, `awardRace`), `seasonStakes`
  (top 4 make the playoffs: per conference in the pros), recruiting (`recruitStars`, `visitSchool` reveals the role,
  2 visits; `chooseCollege` uses the visit edge), combine (`runCombine`/`answerInterview`, phase `combine`,
  `flow.finishCombine` -> `runDraft` adds `combine.bonus` to stock; draft round sets the pro depth edge),
  `POST_CAREER` epilogues (`flow.choosePostCareer`) and `nextGenerationOpts` (newCareer `legacyBonus`, `parentName`).
- Storylines: `src/data/events/arcs.js` (feud, love vs. grind, shady agent, rival race) chain with `effects.chain`
  + flags. Play style: `state.playStyle` ('moments' | 'more' | 'every', from settings.playStyle).
- Saves: `storage.exportCode/importCode` (GL2 = gzip base64), Back up / Restore modals (slots, settings, season
  review), `requestPersist()`. Voice: `src/audio/voice.js` (speechSynthesis, settings.voice) hooked into hud.say.
  Menu music: 'menu' song via `app.menuMusic()` on title/setup screens. Tour: `src/ui/onboarding.js` (once per career).
- Tests: `tests/round10.test.js`.

## v0.31: balance, contact physics, stadium grounds
- Balance (measure with a bot over many careers per position): `gameGrade` and `awards.seasonPerf` calibrated so a
  typical good pro game/season is ~65-70 at every position; legacy "Career production" is position-neutral (from each
  pro season's perf) and the peak bonus is relative to `POS_PEAK`. Result (40 careers each): ~11 awards, 340-365 legacy,
  60-75% HOF for every position. Run-stop quality rewards stuffed runs; user INT odds lowered (PDs are the norm).
- Engine physics: `startWrap`/`updateWrap`/`finishTackle` (inelastic momentum; tacklers ride along; gang tackles via
  tryTackle on a wrapped carrier; Sprint drives the pile); big hits still drop the carrier instantly. Momentum cuts
  (`cutK` on the user's acceleration, wet fields worse); glancing contacts slow the carrier. Debug hook `__play` has
  `flight/qb/carrier/user` for scripted play tests.
- `src/scenes/grounds.js`: facade behind the stands, plaza, parking lots with instanced cars, tailgates and fans,
  light poles, blimp (college/pro), sideline coolers/TV cameras/photographers, inflatable team tunnel.

## Known gaps / next ideas
- Pass rush and kicking minigames not built yet.
- Minigame feel needs real-device playtesting and tuning (timings in `src/scenes/minigames/*`).
- Events: 125 written; brief asks for hundreds. Add more, especially multi-step storylines.
- AI pro rosters are simple (no depth charts or AI trades); the player's team role is always starter.
- No music yet. No iOS wrap yet.
