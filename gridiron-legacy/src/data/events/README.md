# Writing events

Events are plain objects in `hs.js`, `college.js`, `pro.js` and `any.js`. Add one by copying an
existing event and changing the text. The engine is `src/sim/events.js`.

```js
{
  id: 'unique_id',            // required, never reuse
  title: 'Short title',
  text: 'What happens. Tokens: {first} {last} {team} {coach} {partner} {agent} {rival} {rivalTeam} {hometown} {business}',
  stages: ['hs'],             // hs | college | pro (omit = any stage)
  phase: 'season',            // season (default) | offseason | any
  weight: 1,                  // relative likelihood (default 1)
  repeat: false,              // true = can happen more than once
  cond: {                     // all optional
    minAge, maxAge, minFame, maxFame, minMoney, maxMoney, minMood, maxMood, minOvr, minHealth, maxHealth,
    minAcademics, maxAcademics,
    flags: { some_flag: true, other_flag: false },
    rel: { coach: [min, max] },
    partner: true, agent: true, injured: false, positions: ['QB'],
    minWeek, maxWeek,
  },
  choices: [
    {
      label: 'Button text',
      hint: 'optional short hint',
      effects: { /* see below */ },
      result: 'What happened.',
      // Optional dice roll instead of fixed effects. `stat` adds (stat-50)/200 to p.
      chance: { p: 0.5, stat: 'iq', success: { effects, result }, fail: { effects, result } },
    },
  ],
}
```

## Effects

| key | meaning |
| --- | --- |
| `mood`, `health`, `fame`, `academics` | add to the value |
| `money` | dollars; `moneyPct` takes a fraction of your bank balance |
| `energy` | energy change for this week only |
| `stats` | direct stat change, e.g. `{ speed: 1 }` |
| `train` | training units (scaled like weekly training) |
| `rel` | relationship change, e.g. `{ coach: 5, partner: -10 }` |
| `flags` / `clearFlags` | set flags / remove flags (array) |
| `injury` | `true` for a random minor injury |
| `suspend` | number of games you must sit out |
| `newPartner` / `breakup` | start or end a relationship |
| `hireAgent` / `fireAgent` | gain or lose an agent |
| `sponsor` | multiplier for a new sponsor deal (1 = normal) |
| `business` | start a side business with this name |
| `chain` | event id that fires next week (`{ id, delay }` for later) |
