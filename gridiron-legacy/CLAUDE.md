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

## v0.33: natural faces + face sliders and presets
- Faces: front of the head wraps toward the ellipsoid (`fwrap` in headGeo), EYE_R 0.031, softer nose, head 5% bigger and
  sitting lower on a fuller neck. Mouth is painted as real lips (cupid's bow, parting line, expression via corner lift).
  Painted fringe is only a soft hairline shadow; no painted side strips. Skin has a shared pore bump map (`skinDetailTex`).
- Hair: `long` is one double-sided curtain mesh; mohawk/frohawk masks stop at the hairline (`hawkLim`). Shells use seg 24.
- Face sliders: `look.fs` {browH, eyeSize, eyeSpace, eyeTilt, noseW, noseL, lips, jawW, cheekS, chinS, neck} in -1..1
  (`FACE_SLIDERS`/`fsOf` in actors.js, `FACE_SLIDER_DEFS` in looks.js; missing = 0). They feed headGeo (part of fpKey),
  faceMat (brows, eye columns via `eyeCols`, lips), makeEyes (size, tilt) and the neck. `FACE_PRESETS` (12, face fields
  only) in the Face tab, which now also holds Face shape. randomLook adds random sliders (computed last).
- Portraits: front key light; `portraitURL(spec, { face: true })` close-up (uses `rig.headG`), used by the editor on the
  Face/Hair tabs. Tests: `tests/round11.test.js`.
- v0.34: look editor preview follows the change: `TAB_VIEW` (default per tab) + `KEY_VIEW` (per option) in look.js, helmet
  forced on for `HELMET_KEYS`; Face/Upper/Full/Legs picker; `portraitURL(..., { view })` ('face'|'upper'|'full'|'legs');
  portraits look at the camera (no idle glance). `.screen .look-sticky` sits under the pinned screen header.
- v0.35-0.36 (owner's head-drawing references): shorter, shallower heads (HEAD_DIMS h ~0.375, d ~0.335, smaller rounding),
  male jaw straight down to an angle then a V to the chin, almond `EYE_OPEN`, low straight male brows, projecting chin,
  smaller nose tip, neck ~2/3 head width (neckK m 1.22 / f 1.06 / players 1.32) set back (z 0.035) and leaning forward
  (rotation.x -0.16). Check faces front, 3/4 AND profile.
- v0.37 nose: headGeo nose = straight wedge from rootY 4.75 (projects ~45% at the root, level with the brow) to tipY
  7.5 + 0.35*(len-1), sharp-sided ridge (`sst(W, 0.2W, dx)`), rounded tip ball, wing lobes; faceMat paints a matching bridge
  highlight, wing creases and angled nostrils from the same NOSE_K + fs values.
- v0.38 profile fix: jaw floor = near-level chin -> jaw angle at Zn -0.05, then steep ramus up to the skull base (was one
  chin->occiput slope = insect look); front wrap is cylindrical (x/z only) so the chin keeps its place; upper-lip mass and
  cheek fill beside the mouth; chin 0.03; bigger visible ears (scale 1.15-1.2, y 0.2); eyes set back (EYE_R*0.8), EYE_R 0.033.
- v0.39 robustness: `blendSurface` (Taubin smoothing, 2 iters at seg 40, scaled by seg^2) after the face sculpt; choice x
  slider products clamped (jaw angle 0.88-1.2, cheek bone <=1.9 / hollow <=2.3, chin size <=1.7, down <=0.025); toned-down
  CHIN_K/CHEEK_K extremes; bigger eyes sink instead of bulging; face texture base = the side texture's gradient (no seam).
  Stress test: every head shape with extreme sliders, front / 3/4 / profile.

## v0.40: team identities on uniforms
- `teamIdentity(team)` in kits.js (stable hash of id+name): glyph (`mascotKind`, now in `src/data/mascots.js` with `GLYPHS`;
  horse before cat), logo glyph|letter (shield teams use the letter), helmet stripe/finish/mask, jersey pattern, number font,
  sleeve stripe count, pants stripe, collar, chestLogo. Stored as `kit.style` (throwback third kit overrides) and copied by
  `kitUniform`. Uniforms without a style (uniformFrom) render the old plain way.
- actors.js: `drawLogo` (glyph cells with outline / letter), `jerseyMat` (patterns, collars, chest logo, `NUM_FONTS`, stroked
  outlines; scale 9), `helmetMat` (logo on both sides, mirrored glyph on the left; stripes incl. wide/tri; scale 16),
  `pantsStripeMat` on thighs (lathe u 0.25/0.75), armMat sleeve stripes. Helmet stripe/finish come from the team (removed from
  the Helmet tab); facemask = team color unless the player picked a non-default one. Back plate moved to the jersey hem.

## v0.41: phone memory fix (play-call freeze)
- Owner report: tapping Safe/Balanced/Risky froze the game (iPhone). Cause: every play builds 22 new random players and
  each unique face texture / head / hair / beard geometry (keys include the continuous face sliders) was cached forever:
  ~18 MB of canvases per play (450 MB after 30 plays, over iOS Safari's canvas limit), plus GPU textures never disposed.
  Old versions leaked the same way.
- actors.js: `trackedMap` / `trackedObj` caches stamp the generation each entry was last used; `sweepActorCaches(keep=1)`
  (called at the start of runMinigame / runCutscene / runSetCutscene) disposes entries unused for a play, disposes owned
  textures and empties their canvases (Safari frees canvas memory only then). Memory now stays ~50-60 MB. `actorCacheSize()`.
- Robustness: pixMat returns a plain material if getContext fails; runMinigame wraps each stadium setup step (`safe`) and
  the play build (sims it with fallbackQuality on failure); gameday's play() catches a rejected runMinigame.
- Don't keep actor meshes alive across plays in persistent scenes (a swept texture's canvas is emptied).

## v0.42: signing day + real-city pro league
- Signing day (`commitScene` in sets.js, run from `signingDay` in offseason.js before the letter modal): HS gym, bleachers,
  family/teammates/coach/photographers, three `schoolCap`s (chosen + 2 best other offers by prestige, shuffled). Fake reaches
  ('reach' pose) at the others, then the chosen hat flies to the head ('hatOn' pose) and is attached to `rig.headG`.
- Pro league = 20 teams, `PRO_DIVISIONS` (Northwest, Southwest, Northeast, Southeast, Heartland), real cities + original names.
  Each def has `glyph` (mascotKind uses it; new GLYPHS axe/star/gear/gator/snake + sideline mascot features), `kit`
  (overrides teamIdentity; new jersey patterns plaid/scales/flames/stars), `biome`, `landmarks`, `trait` (culture.js).
  `proTeamDef(id)` looks them up, so other levels and old saves are unaffected.
- environment.js `LANDMARKS` (bridge, needle, volcano, rockies, saltflat, temple, bridges, river, lake, lakes, palms, saguaro, orb,
  strip, pyramid, spire, supertall, obelisk, dome, superdome, towers, deco, speedway, twinspire, fountains, arch, hills, skyline)
  placed past the -z end (the offense attacks -z) so the play camera sees them. Passed via culture.landmarks -> setEnvironment.
- league.js: `isDivisionLeague` (pro teams with div and no conf), `leagueDivisions`, `projectedSeeds` (5 division winners by record
  then 3 wild cards); seedPlayoffs 1v8/4v5 + 2v7/3v6; rounds Wild Card / Semifinal / Legacy Bowl. Old saves (Summit/Coastal confs)
  keep the old rules. seasonStakes returns { div } and division rank; hub standings by division; rivals from the same division.
- Tests: `tests/round12.test.js`.

## v0.43: draft night event + Salt Lake Trappers
- `draftNightScene` (sets.js) replaces the old stadium `draftCutscene` (still in cutscenes.js, unused): theater set, LED screen
  canvas (`redraw('intro'|'clock'|'name')`, crest drawn when loaded), commissioner, fans in league colors, green-room table
  (you, mom, agent), photographers, follow spot, beams; timeline T.clock/call/name/walk/shake/cap/jersey with a path up the stairs.
  Cap = `schoolCap` in team colors attached to `rig.headG`; `draftJersey` canvas with name + number from the home kit.
- runSetCutscene({ crowd }) starts the crowd bed; ctx.audio = { react, setCrowd, music, stopMusic }. New react kinds ooh /
  applause / roar; new songs tension + fanfare (audio/stadium.js).
- SLC = Salt Lake Trappers (glyph `coonskin`, def `accent` = home numbers/trim/stripe in teamKits, jersey pattern `fringe`,
  landmark `cabins`: log cabins + palisade fort; sideline mascot with coonskin cap).

## v0.44: receivers improvise after their routes
- engine.js aiOffense: `e.improv` starts once `e.s` passes the route length (+1.1 s for sit routes) or during a QB scramble
  (after 55% of the route). `improvise()` re-picks a spot every ~0.6 s from 14 candidates scored by predicted separation,
  throwing range, scramble side, sideline penalty and spacing from other receivers; hard break when it opens room. Stays in
  bounds and downfield of the line. aiDefense: zone defenders cover loose (improvising) receivers within 13 yds, preferring
  uncovered ones; man coverage unchanged (keeps trailing its man). Test: hold.cjs-style probe with the rush disabled.

## v0.45: QB pressure + biomechanics pass
- QB pressure (engine.js): a pass-play QB who crosses the line (z < -0.4) becomes `carrier` with `qb.scramble` (all defenders
  pursue; result { scramble } -> rushing stats in game.js, no more "sack" 10 yards downfield). When you're QB the defense
  blitzes (LB, sometimes NB) or spies (`e.spy`: mirrors, attacks when you leave the pocket / after 3.2 s); on rollouts
  (|x - start| > 4.5) LBs and defenders within 8 yds pursue after a read delay; pass-rush shed +0.1 and DL pursuit 0.92 for a
  user QB; designed QB runs (play.qbRun) are read at 0.6/0.75 s with 0.93 pursuit.
- Rig (actors.js mkLeg/mkArm): `ankle` group (foot pivots there) and `wrist` group (hand); seam spheres shrunk (hip 0.088,
  knee 0.066, elbow 0.054) + ankle sphere. Replays record ankles (partsOf has 15 parts).
- Animation (applyPose tail): `lookAtTarget` (u.lookAt via `setLookAt(mesh, {x,y,z})` in the character's parent space; neck
  yaw/pitch within limits, spine follows 18%), `legIK` (planted feet: stance/swing from the stride phase and duty factor,
  idle corrective steps incl. crossed-feet after turns, landing prediction from u.vel, two-bone IK in hips-local space with
  roll, flat-foot ankle + toe-off/toe-up, pelvis drop when out of reach; IK blends out for actions/holds not in IK_HOLDS /
  IK_ACTIONS, hops, ragdolls, celebrations; `STANCE` gives block/tackle a staggered base), `jointLimits`, `groundContact`
  (lifts/settles dives, falls, tackles, lying down via key joint points; u.gfix). Cadence: u.omega = 2*pi*speed/cycleLen.
  Wrists spring toward P.lw/P.rw (flick when running, cocked on throws, open on catches).
- The model's legs (0.92) are slightly longer than the hip height (0.91): IK aims the ankle at ground + 0.008 so standing
  knees stay soft. Engine sets look targets every live frame (ball in the air, carrier, QB, CB's man).
- Test tools (scratchpad, not in the repo): poses.cjs (pose sheet in cells), film.cjs (filmstrips: cut, tackle, catch, idle,
  block), animperf.cjs, qbrun.cjs (edge scramble yards).

## v0.46: surfaces and footing
- `src/data/surface.js` `surfaceFor(culture, weather, wear)` -> { kind grass|turf, cond, grip, sink, slip, slide, bounce,
  debris, footSink, label, short, desc }. Wet grass becomes mud with wear progress. culture.surface (culture.js, own seeded
  stream: painted turf colors always 'turf', else hs 30% / college 40% / pro 50%; a team def may set surfaceType).
- engine.js: `surf` per play (setSurface in actors, cleared on cleanup); maxSpeed and user speed * (1 - sink); moveToward
  accel * grip; user cutK * (1/grip)^1.5; `footing(e, dt)` each frame: slips on hard cuts at speed (stumble 'slip' action,
  or a wipeout for non-carrier AI) and getting stuck in mud/snow ('stuck' action, speed capped 0.45 s, legs churn); wrap
  pile decay and dive length scale with slide/sink; ground-impact debris via u.groundHit; spray behind user/carrier.
- actors.js: `setSurface`; ragdoll restitution/slide from SURF (turf bounces up to 3 times, slick ground keeps sliding after
  settling via g.slideV); IK planted feet sink by footSink; dustPuff(scene, origin, n, kind = SURF.debris) with DEBRIS colors.
- UI: pregame venue card FIELD chip; HUD weather tag adds Turf/Mud/Slick turf/Snow; Practice has a FIELD option.

## v0.47: injuries that matter, tush push, smoother animation, phone performance
- Injuries: INJURIES have `tier` (minor/moderate/out/season), `limited` (last N weeks back as questionable) and `noPlay`
  positions. `src/sim/injury.js`: `injuryStatus(inj, pos)` -> probable/questionable/out/season, `INJURY_STATUS` (tol, speed,
  aggravate), `injuryNote`, `inGameOutcome` (in-play injury: minor = back after a series via g.skipNext, moderate 35% back,
  else g.userOut). gameDayStatus uses it; g.playingHurt stores the status (tolerance mult, `opts.hurt` user speed in the
  engine, aggravation odds in finishGame). `g.freshInjury` skips the same-week recovery tick. Hub/profile/results show it.
- Engine: `stillDown(e, dt)` handles e.out (on the ground) -> getup action + e.rise (0.7 s, can't act) -> e.ramp (speed
  ramp in moveToward). AI whiffed lunges lie 1.4-2.3 s, user 1.0 s. Rollouts: only zone LBs come up (contain, then attack
  once the QB is near/past the line); man/CB/S coverage stays until the QB crosses (z < -0.4 makes him the carrier).
  Hand-fighting also during receiver improv.
- Tush push: moment `qb_sneak` (MOMENT_NAMES 'Tush Push'), `src/scenes/minigames/tushPush.js`. buildMoment sets
  `d.shortYd` on 3rd/4th and 1 (5%) or 1st and goal from the 1 (35%) for QB/RB; pickType picks it (QB 75%, RB 30%, RB =
  `m.pusher`). Tap rate over 0.6 s * perTap (strength) vs defense push with random surges; 3 s; result yards/first down/TD.
  QB gets rushing stats, RB pushers none. Practice: QB 'qb_sneak', RB 'rb_push'.
- Animation (actors.js): actions blend in/out of the pose underneath (preAct, eased progress `e`), better fall/getup/throw;
  `celebPose()` multi-beat routines with personal tempo u.cs and mirror u.cm, eased in over 0.35 s; new styles bow, shuffle,
  heart, leanback (looks.js CELEBRATIONS); breathing in stance/block/sit; idle fidgets (hands on hips, bounce, shake, clap);
  flip no longer unwinds; body offsets ease at 12.
- Texts (phone.js): `sendTemplate(state, tid, { cool, force })` with per-template cooldown (`ph.sentAt`, week index) and
  `freshLine` (last 40 lines not repeated). postGameTexts: candidates by notability, budget 1-2; weekly 35%; new templates
  mate_loss, family_big (playoffs), coach_hurt; more lines per template.
- Performance (director.js): PHONE detection, DPR cap 1.4 on phones (1.75 desktop), `adaptResolution` steps DPR 0.75..max
  from measured frame times; `R.fpsCap` 30 for the title backdrop; `setLiteMaterials(PHONE)` during plays (skin = plain
  MeshStandardMaterial, keys get '|lite'); crowd animation throttled to 30 Hz; HUD clocks only write on change.
- Tests: `tests/round13.test.js`; balance test now 40 careers per position (10 was too noisy).

## v0.48
- Owner found 0.47's phone resolution blurry: DPR is back to min(devicePixelRatio, 1.75) everywhere, no adaptive resolution,
  no lite skin during plays (`setLiteMaterials` still exists, unused). Keep the 30 fps title cap and 30 Hz crowd.
- Confetti 140 -> 55 particles; trophy-lift bursts every 2.4 s.
- Receiver improv: deep phase first (candidates fan downfield, deeper scores higher, within 34 yd of the QB); check back
  after `e.checkT` (3.1-3.9 s) or when the QB is scrambling behind the line after 2.4 s (closer to the QB scores higher).

## v0.49: extreme hits + live X-ray
- hardHit: `impact = relV * sqrt(massRatio)`; big > 10 (or 12% random); `extreme` = big && (impact > 12.5 || 14% random,
  hitstick x1.6); test hooks `__forceExtreme` (also skips the wrap-up), `__forceInjury`. Injuries: user target big 3.5% x hf
  (minor/moderate pool only), extreme 30% x hf (severe weights x2.5); user tackler extreme 6% (shoulder/concussion/hand/elbow);
  AI target extreme 14% (big 1%). Simulated injuries (newInjury without id) weight severe x0.35.
- `extremeXray` (engine) + `src/scenes/play/xraylive.js` `liveXray(scene, [two meshes], others)`: shell material on the two
  (re-applied every frame because addWear swaps uniforms), ghost material on everyone else, bone cylinders/knobs/skull placed
  from rig world positions each frame (depthTest off, renderOrder 999), ribcage rings parented to the spine, `crack(mesh,
  part, bone)` turns the part red and splits the bone. Close cinematic (`cinematic(target, s, { dist, height, spin, look,
  force })`), setTimeScale 0.45, timed in play time (0.07 crack, 0.23 end). Injury report / X-ray card / AI injury line wait
  in `afterXray` until it ends. One per play; always when you're involved, 35% for AI hits; off with reduced motion.
- CSS `.xray-fx` overlay (vignette, scanlines, X-RAY tag, red flash + FRACTURE/CONCUSSION/INJURY label). sfx.crack.

## v0.50: Mascot position
- `POSITIONS.MS` (label Mascot, `mascot: true`; stats read as hustle/showmanship/crowd IQ/stamina), POS_SIZE.MS. Moments
  (MOMENT_POOL.MS): ms_hype / ms_tshirt / ms_rival (once a game, `g.rivalDone`) / ms_stunt (Q2-Q3 only). `MASCOT_TYPES`,
  `isMascot`. outcomeFromQuality -> `mascotOutcome` (hype = q*20, shirts, danceWin, stunt, text). resolveMoment ->
  `resolveMascotMoment`: mascot stats, momentum (q-0.5)*0.5, drive simulated by driveOutcome with +(q-0.5)*0.08 bonus.
  No presnap/clutch game events, no autoDriveStats for MS. gameGrade MS = 12 + avg quality * 88. Labels per moment.
- Stats (emptyStats): hype, shirts, danceWins, stunts. seasonPerf MS; STAT_CATS/records hype + danceWins (no generated AI
  mascots in leaders). Awards keep internal names; `awardLabel(name, pos)` shows mascot names (UI, news, banquet, watch, race).
  Balance (20 careers): MS ~11 awards / ~357 legacy, same band as QB/RB/CB.
- Scenes: `src/scenes/minigames/mascot.js` (mascotHype rhythm rings, mascotTshirt screen-space target taps + arcing shirts,
  mascotRival Simon-style combo copy + charge/takedown, mascotStunt trampoline power/flips/landing; `headOff` on flops). You
  are `makeMascot(opts.myMascot, teamColors)` from sideline.js at x 27.8 in front of the +x stands; the sideline mascot is
  hidden during the moment. gameday passes myMascot/oppMascot/team names; no interludes for mascot moments; CALL_DESC_MS.
- Traits MS: showman, cannonarm, smoothmoves, acrobat. Practice: position chip 'Mascot'. Create: 3-column position grid
  (🐾 card). Lineup shows the mascot card on the sideline; position diagram marks the sideline. Tests: `tests/round14.test.js`.

## v0.51: mascot costume, skills, traits
- `look.costume` { kind 'team'|glyph kind, fur 'team'|'swap'|palette id, eyes, mouth, hat, extra, shoes, shoesBig, name } —
  lists/defaults + `costumeOf`, `costumeSpec(look, teamKind, teamColors)` -> { kind, colors, costume }, `mascotName(seed)`,
  `mascotDisplayName(p)` in src/data/mascots.js. `makeMascot(kind, colors, costume)` (sideline.js) applies fur, eyes, mouth,
  hat, extra, shoes. Portraits: `portraitURL({ mascot: costumeSpec(...) }, { full })` (mascotPortrait in portrait.js).
- Look editor for position MS: groups You / Costume (suit, cface, cextra) / Off the field; no jersey/helmet/gear/swag/celeb.
  lookEditor opts mascotKind, teamColors, seed (create.js passes the school, openLookModal the current team).
- Mascot shows on: hub top bar + profile (costume portrait, MASCOT chip, "name" · team mascot, Edit costume), lineup card,
  gameday pregame (costume vs their mascot, no kit picker), minigames (`opts.costume`, `opts.mascotName` in the HUD tag).
- Skills: `statLabel(k, pos)` (MASCOT_STAT_LABELS Hustle/Showmanship/Crowd IQ/Stamina) used by statBars, skill points,
  camp, aging, create, look editor, effect chips. `activityFor(a, pos)` renames training activities (MASCOT_ACTIVITIES).
- Traits: MS gets only MS traits (ANY traits hidden): + crowdwhisper (momentum x1.3), fanfav (+0.15 fame per q>0.65 moment),
  tireless (energy drain x0.7), velcro (no head pop, +0.1 quality on flops).

## v0.52: friends + leaderboard (no server)
- Why no live online board: the artifact `db` only lets the owner (and editors invited by email while there is no public link)
  write; friends opening the public link can never save, and the GitHub Pages app has no backend. Owner chose friend codes.
- `src/sim/friends.js` (pure): `friendCard(state)` snapshot (id = `p.uid` via `careerId`, at, names, pos, mascotName, stage,
  year, team {id,name,city,colors,kind}, ovr, level, fame, money, legacy + tier, awards [[label, n]], ind, titles, records,
  games, wins, stats (mainStats), seasons, house {name, rooms [[label, level, upgrade name]]}, look). `cleanCard` validates
  and clamps untrusted cards; `addFriend(list, card, selfId)` -> added/updated/older/self/bad (newest `at` wins, max 60);
  `BOARDS` + `leaderboard(friends, me, board)`.
- `src/core/friendcode.js`: `encodeCard` -> "GLF2." gzip base64url (GLF1 plain fallback), `decodeCard` finds a code anywhere in
  pasted text/links, `shareLink(code)` = Pages URL + `#friend=CODE` (~1.5 KB). app.init reads `#friend=`, adds the friend,
  toasts, clears the hash (and opens Friends on the title).
- `src/ui/screens/friends.js`: `friendsPage` (your card + Share via navigator.share / clipboard / code modal, Add a friend,
  leaderboard tabs, `openCard` modal with portrait/costume, stats, awards, house, remove) and `friendsScreen` (title).
  Friends live in `app.settings.friends` (all slots). Hub Career subtab 'friends'; title "Friends" button. Tests: round15.
