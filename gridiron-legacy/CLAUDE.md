# Gridiron Legacy — project brief and status

Read this every session. Run instructions are in README.md.

## What we are building
An American football career and life-sim browser game. One athlete, high school to the Hall of Fame.
Like New Star Soccer in mechanics only: the player controls key moments (throw, cut, catch, later
tackle/kick); everything else is simulated. Around it: weekly schedule, relationships, money, fame,
health and branching events. Look: stylized low-poly 2.5D field with an angled camera. Clean and
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

## Known gaps / next ideas
- Pass rush and kicking minigames not built yet.
- Minigame feel needs real-device playtesting and tuning (timings in `src/scenes/minigames/*`).
- Events: 125 written; brief asks for hundreds. Add more, especially multi-step storylines.
- AI pro rosters are simple (no depth charts or AI trades); the player's team role is always starter.
- No music yet. No iOS wrap yet.
