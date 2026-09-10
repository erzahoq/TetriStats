# RNG gamble installation

Copy the files into the matching locations in the bot project:

```text
commands/xp/gamble.js
commands/xp/leaderboard.js
helpers/rngGamble.js
data/rngBadges.json
data/rngRanks.bin
scripts/buildRngRanks.js
scripts/validateRngBadges.js
```

No new `PATHS` entries are required. The existing `PATHS.data.gambleStats`,
`PATHS.data.gambleCooldowns`, `PATHS.data.gambleReminders`, and `PATHS.data.xp`
entries are reused.

`rngRanks.bin` is the precomputed rarity rank for every integer from 0 through
1,000,000. It is loaded once and is about 4 MB. Do not parse it as JSON.

If badge rules or EP values change, rebuild the table from the project root:

```bash
node scripts/buildRngRanks.js
```

You can compare the implemented badge rules against the probabilities in the
badge data with:

```bash
node scripts/validateRngBadges.js
```

The existing gamble stats remain backwards-compatible. Existing fields are
preserved and these fields are added as users roll:

```text
lastNumber
lastTopPercent
bestNumber
bestTopPercent
rarestNumber
uniqueBadges
badges
```

The leaderboard adds three gamble categories:

- Most XP Won From Gamble (`totalXP`)
- Largest Win From Gamble (`best`, already tracked)
- Most Gamble Badges (`uniqueBadges`)

The cooldown is consumed when `/gamble` is invoked, matching the original
command's behavior. The user then has 60 seconds to press the lever.
