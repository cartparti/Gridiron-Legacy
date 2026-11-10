# Gridiron Legacy

An American football career and life-sim for the browser. Take one athlete from high school
to the Hall of Fame. You play only the key moments (a throw, a cut, a catch) in a stylized
2.5D stadium; everything else is simulated. Around the field is a life sim: weekly schedule,
relationships, money, fame, injuries and 125 branching story events.

Mobile-first (portrait, touch), and it also works with a mouse and keyboard. The look is
chunky voxel players with pixel-art faces on a retro-rendered 3D field, with a clean modern UI around it.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install.

```bash
cd gridiron-legacy
npm start            # serves the game at http://localhost:8080
```

Open that address in a browser. To play on your phone, make sure the phone is on the same
Wi-Fi and open `http://<your-computer's-IP>:8080`.

(Any static file server works too, for example `python3 -m http.server`. Opening
`index.html` directly from disk does **not** work, because browsers block ES modules on `file://`.)

## Test it

```bash
npm test             # simulation, event and save-system tests (node:test, ~3 seconds)
npm run balance      # simulates 300 full careers and prints a balance report
node tools/balance.js 100 0.7   # 100 careers per strategy, as a skilled player
```

The balance report shows legacy tiers (how often careers reach the Hall of Fame), peak
ratings, team win rate, titles, money, draft position, stats per game and retirement reasons
for five play styles (Balanced, Grinder, Social, Gunslinger, Cautious), across all four positions.

## How to play

1. **Create** an athlete: quarterback, running back, wide receiver or cornerback, a background
   that shapes your starting ratings, a high school, and a difficulty (Easy / Normal / Hard / Legend).
2. **Each week**, fill five days with activities. Each costs energy. Training raises ratings,
   people activities build relationships, media builds fame. Energy you *don't* spend becomes
   game-day freshness, which widens the timing windows in the minigames.
   You can also **walk around** your house, Riverside Park, the stadium and downtown (drag
   anywhere to move, or WASD / arrows; E or Space to interact). Using the weight room, film room,
   jogging trail, your desk and so on fills your next day slot, just like the planner. Talk to
   teammates, your coach, family, your partner, fans and your rival; shop downtown.
   **People** (Life tab): chat for free once a week, or spend a day hanging out, training together,
   watching film with Coach, going on dates, and more. Short dialogue choices change relationships.
   You have three named teammates on every team. Give gifts bought in the **Store**.
   **Store** (Life tab or downtown): gear that widens your timing windows on the field, plus style,
   home upgrades, pets, big-ticket toys and gifts.
   **Phone** (top bar): Huddle social media (post once a week, followers grow with fame), texts from
   coach, teammates, family, partner and agent, plus Bank, Calendar, News and Contacts apps.
   **Weather**: each week has a forecast. Rain and storms make the ball slippery, snow slows
   everyone, wind pushes passes (watch the arrow), fog hides coverage until late.
3. **Random events** pop up most weeks: two or three choices with lasting consequences. 🎲
   choices are a gamble.
4. **Game day**: the game is simulated drive by drive and pauses on 5 to 8 key moments, plus
   4th-down decisions, two-minute drills, and mid-game events (pregame, halftime, celebrations,
   big hits, clutch time). Weather (rain, snow, wind, night) and momentum change the timing windows.
   Each key moment is a **free-control play**: pick one of three plays (Safe / Balanced / Risky,
   keys `1` `2` `3`), then you control your athlete anywhere on the field with all 22 players live.
   - **Move**: floating joystick on the left half of the screen (mobile) or `WASD` / arrows (PC).
     Hold the SPRINT button or `Shift` to sprint (drains stamina).
   - **Ball carrier** (RB, scrambling QB, WR after the catch): JUKE `J`, SPIN `K`, STIFF ARM `L`,
     DIVE `F`. Defenders flash a **red ring** and wind up just before they lunge - that is your cue.
   - **QB**: drop back, then tap a receiver on the field or press `1`-`5` to throw. Pressure and
     wind affect accuracy. Run if the pocket collapses.
   - **WR**: run your route (or freelance), `C` to call for the ball, `Space` to catch as it arrives.
   - **DT**: you start locked up with a blocker. Push the stick toward the QB to build leverage, then RIP
     `J`, SWIM `K` or BULL RUSH `L` to break free. SACK `F`, BAT IT `Space`.
   - **CB**: shadow your man, `Space` to swat / pick the pass, `F` to tackle. Pick-sixes are live.
   - **Goal-line dive**: tap fast to drive the pile, then time your leap.
   - Touchdowns trigger a celebration cutscene. Big hits send players flying (ragdolls), sometimes in a
     slow-motion replay, with occasional pixel blood (turn it off in Settings). Hard hits can injure you.
   - Risky choices in mid-game events are quick challenges: stop the marker in the zone, or mash.
   - Training days have optional drills (Training Drills card under This Week): play them for up to +50% gains.
   - Phone texts have reply choices that change your relationships; you can answer trolls on your posts.
   - Cutscenes: running out of the tunnel, draft night, lifting a title trophy, the Hall of Fame.
5. **Seasons**: standings, playoffs and a title game. End-of-season awards, records, aging.
6. **Your look**: build your athlete in the creator (skin, hair, face, tattoos, gear, height and
   weight, touchdown celebration, plus swag: arm/leg sleeves, knee braces, elbow pads, two-tone cleats,
   tape, towels, hand warmers, chains and tinted visors) and change it any time from **Career → Edit look** (size is fixed).
   Before each game, pick your **Home, Away or Alternate** uniform; the opponent avoids a clash.
7. **Career**: pick a hometown and one of its 2-3 high schools (the crosstown school is your rival) →
   2 high school seasons → offers from a random mix of 32 colleges in 4 conferences → 3 college
   seasons (or declare early) → a pick-by-pick draft where teams weigh your college résumé against
   their needs → pro seasons with contracts, free agency and a
   salary cap → retirement at 34, when your rating declines, or when you choose (30+).
8. **Legacy**: Journeyman, Solid Starter, Star of Your Era, or Hall of Fame.

Everything autosaves to one of three save slots. Slots can be exported/imported as files.
Settings: light/dark/auto theme, sound, reduced motion, tutorial tips.

## Project layout

```
gridiron-legacy/
  index.html            page shell + import map for three.js
  styles/main.css       all styles; light and dark theme tokens
  src/
    main.js             entry point
    core/               rng (seeded), storage (save slots), util
    data/               ALL tunable content: config, teams, names, positions,
                        activities, lifestyle (housing/cars/perks/investments/
                        sponsors/injuries), press templates, events/
    data/items.js, interactions.js, places.js   store, personal interactions, walkable maps
    sim/                pure game logic, no DOM (runs in Node for tests)
      shop.js social.js store purchases & gear bonuses; people & interactions
      flow.js           the career state machine: the API the UI and the bot use
      player.js league.js game.js week.js events.js effects.js
      awards.js legacy.js press.js bot.js
    ui/                 app controller, components, screens/
    scenes/             three.js: director (renderer + HUD), stadium, actors,
                        world.js (walkable places), portrait.js (3D menu portraits),
                        play/ (free-control engine + touch/keyboard controls), minigames/ (goalLine, 2D fallback)
    audio/sfx.js        synthesized sound effects (Web Audio)
  tests/                node:test suites
  tools/                serve.js (dev server), balance.js (balance report)
  vendor/               three.js (MIT)
```

### Adding content

- **Events**: copy one in `src/data/events/*.js`. The format is documented in
  `src/data/events/README.md`. `npm test` validates every event (unknown effect keys,
  unfilled `{tokens}`, broken chains) so typos are caught.
- **Teams, names, activities, housing, cars, sponsors, injuries**: edit the files in `src/data/`.
- **Balance numbers**: `src/data/config.js` first, then the formulas in `src/sim/`.

### Design notes

- The simulation is deterministic per save: all randomness flows through a seeded RNG
  stored in the save, so tests are repeatable.
- The UI and the balance bot drive the game through the same functions in `sim/flow.js`.
- If WebGL is unavailable, minigames fall back to a 2D timing meter.
- All teams, players, leagues, brands and trophies are fictional. See `ASSETS.md`.

## Play it on your phone (installable app)
The game is published with GitHub Pages at https://cartparti.github.io/gridiron-legacy/
- iPhone: open it in **Safari** → Share → **Add to Home Screen**. Always launch it from the icon.
- Android: open it in **Chrome** → ⋮ menu → **Install app** (or Add to Home screen).
Saves stay on the phone; updates load automatically the next time you open the app.
Settings → Export save makes a backup you can import on another device.
