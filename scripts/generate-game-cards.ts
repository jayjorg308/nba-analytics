// Generate every published team game's share card (docs/plans/jazz-first-
// site.md, "Share cards"; ADR-0067's pattern at game grain). The committed
// season indexes say which games are published (every season directory with
// one, registered or not: the season loop publishes a living season before
// the registry lists it, ADR-0091); src/teams/shareCards.ts derives each
// card's content from the committed game file; scripts/generate_game_cards.py
// (PIL) draws them, as JSON on stdin — the TS-registry/Python-assets split
// every card family uses.
//
// Usage: npm run cards:games [-- <game-slug> ...]   (no args = every game)
//        npm run cards:games -- --missing            (only games without a card:
//                                                    the season loop's step)
// Output: public/social-cards/<team>/<game-slug>.png (committed; the build's
// emission step requires one per published game of a registered season).

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseGamePayload } from '../src/domain/gamePayload'
import { parseTeamSeasonIndex } from '../src/domain/teamSeasonIndex'
import { publishedSeasons } from '../src/teams/published'
import { TEAMS } from '../src/teams/registry'
import { gameCardPath, gameCardSpec } from '../src/teams/shareCards'

const args = process.argv.slice(2)
const missingOnly = args.includes('--missing')
const only = new Set(args.filter((a) => a !== '--missing'))
if (missingOnly && only.size > 0) {
  console.error('usage: npm run cards:games [-- <game-slug> ... | --missing]')
  process.exit(1)
}
const specs = []
for (const team of TEAMS) {
  for (const season of publishedSeasons(team)) {
    const dir = path.join('public', 'data', '_teams', team.tricode.toLowerCase(), season)
    const index = parseTeamSeasonIndex(JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf-8')))
    for (const row of index.games) {
      if (only.size > 0 && !only.has(row.slug)) continue
      if (missingOnly && existsSync(path.join('public', gameCardPath(team, row.slug)))) continue
      const game = parseGamePayload(
        JSON.parse(readFileSync(path.join(dir, 'games', `${row.gameId}.json`), 'utf-8')),
      )
      specs.push(gameCardSpec(team, game, row.slug))
    }
  }
}
if (specs.length === 0) {
  if (missingOnly) console.log('every published game has its card')
  else console.log(only.size > 0 ? `no published game matches ${[...only].join(', ')}` : 'no published games')
  process.exit(only.size > 0 ? 1 : 0)
}

const result = spawnSync('python', ['scripts/generate_game_cards.py'], {
  input: JSON.stringify(specs),
  stdio: ['pipe', 'inherit', 'inherit'],
})
if (result.error) {
  console.error(`failed to run python: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
