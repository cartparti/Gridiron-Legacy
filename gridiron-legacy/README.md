# Gridiron Legacy

An American football career and life-sim for the browser. Take one athlete from high school
to the Hall of Fame. You play only the key moments (a throw, a cut, a catch) in a stylized
2.5D stadium; everything else is simulated. Around the field is a life sim: weekly schedule,
relationships, money, fame, injuries and 125 branching story events.

Mobile-first (portrait, touch), and it also works with a mouse and keyboard.

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
for five play styles (Balanced, Grinder, Social, Gunslinger, Cautious).

## How to play

1. **Create** an athlete: quarterback, running back or wide receiver, a background that
   shapes your starting ratings, and a high school.
2. **Each week**, fill five days with activities. Each costs energy. Training raises ratings,
   people activities build relationships, media builds fame. Energy you *don't* spend becomes
   game-day freshness, which widens the timing windows in the minigames.
3. **Random events** pop up most weeks: two or three choices with lasting consequences. 🎲
   choices are a gamble.
4. **Game day**: the game is simulated drive by drive and pauses on 3 to 6 key moments.
   Pick **Safe / Balanced / Risky**, then play the minigame:
   - **QB**: green rings mean open. Press near a receiver, drag to where the ball should land
     (lead him), hold to build power, release. Overpowering sails the ball; waiting too long gets you sacked.
     Keyboard: `1` `2` `3`, arrows, hold `Space`.
   - **RB**: follow the green arrow to the hole, tap left/right (or swipe, or `←` `→`) to cut,
     hit JUKE (swipe up / `Space`) right before contact. Strength breaks tackles.
   - **WR**: tap when you reach the yellow zone to snap your break, then tap again when the
     shrinking ring meets the white ring to make the catch.
5. **Seasons**: standings, playoffs and a title game. End-of-season awards, records, aging.
6. **Career**: 2 high school seasons → college recruiting (pick from offers) → 3 college
   seasons (or declare early) → the draft → pro seasons with contracts, free agency and a
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
    sim/                pure game logic, no DOM (runs in Node for tests)
      flow.js           the career state machine: the API the UI and the bot use
      player.js league.js game.js week.js events.js effects.js
      awards.js legacy.js press.js bot.js
    ui/                 app controller, components, screens/
    scenes/             three.js: director (renderer + HUD), stadium, actors,
                        minigames/ (qbThrow, rbRun, wrCatch, 2D fallback)
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
