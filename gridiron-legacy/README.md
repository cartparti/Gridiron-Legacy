# Gridiron Legacy

An American football career and life-sim for the browser. Take one athlete from high school
to the Hall of Fame. You play only the key moments (a throw, a cut, a catch) in a stylized
2.5D stadium; everything else is simulated. Around the field is a life sim: weekly schedule,
relationships, money, fame, injuries and 125 branching story events.

Mobile-first (portrait, touch), and it also works with a mouse and keyboard. The look is
retro pixel art on an angled 3D field, with a clean modern UI around it.

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
   Pick **Safe / Balanced / Risky**, then play the minigame:
   - **QB pass**: read the coverage (man / zone / blitz), press near a receiver, drag to where the ball
     should land, hold for power, release. Nine route concepts. Keyboard: `1` `2` `3`, arrows, hold `Space`.
   - **QB scramble / Hail Mary**: run for it when the pocket collapses; heave it into the end zone late.
   - **RB run / screen**: follow the hole, tap left/right (or swipe, `←` `→`) to cut, JUKE before contact.
     Screens start with a timed catch. **Goal-line dive**: tap fast to drive the pile, then time your leap.
   - **WR route**: pick one of three routes, tap in the yellow zone to break, tap when the rings meet.
     **Jump ball** and **sideline toe-tap** (tap again before you cross the line) too.
   - **CB coverage**: drag to shadow the receiver, tap BREAK as the ball arrives for a pick or pass breakup.
     **Open-field tackle**: read the runner's lean, shuffle into the lane, time your TACKLE.
5. **Seasons**: standings, playoffs and a title game. End-of-season awards, records, aging.
6. **Career**: pick a hometown and one of its 2-3 high schools (the crosstown school is your rival) →
   2 high school seasons → offers from a random mix of 32 colleges in 4 conferences → 3 college
   seasons (or declare early) → a pick-by-pick draft where teams weigh your college résumé against
   their needs → pro seasons with contracts, free agency and a
   salary cap → retirement at 34, when your rating declines, or when you choose (30+).
7. **Legacy**: Journeyman, Solid Starter, Star of Your Era, or Hall of Fame.

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
                        world.js (walkable places), pixelart (procedural sprites), minigames/ (passPlay, runPlay,
                        routePlay, goalLine, coverPlay, tacklePlay, 2D fallback)
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
