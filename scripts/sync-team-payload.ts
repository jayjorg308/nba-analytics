// Copy the latest derived team shot payload(s) into public/data/_teams/ so the
// deployed app can fetch them (ADR-0082; the deployed-copy rule is ADR-0010:
// the app reads persisted JSON, never the API). public/data/ is committed;
// data/ is not.
//
// Team payloads live under a leading-underscore key so no hero slug can ever
// collide with them and the hero-directory scans stay blind to them.
//
// Usage:
//   npm run team:sync                     sync every liveTeams entry in season.config.json
//   npm run team:sync -- <tricode> <season>   sync one (e.g. uta 2026-27)

import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

interface LiveTeam {
  tricode: string
  season: string
}

function latestSource(sourceDir: string): string | null {
  let candidates: string[]
  try {
    candidates = readdirSync(sourceDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    candidates = []
  }
  if (candidates.length === 0) {
    console.error(
      `no derived team payloads under ${sourceDir} — run ingestion/derive_team_payload.py ` +
        `(or the season loop's team session) first`,
    )
    return null
  }
  // <pull-date>[T<HHMMSS>].json sorts lexicographically == chronologically.
  return join(sourceDir, candidates[candidates.length - 1]!)
}

const [tricodeArg, seasonArg] = process.argv.slice(2)
if ((tricodeArg === undefined) !== (seasonArg === undefined)) {
  console.error('usage: npm run team:sync [-- <tricode> <season>]')
  process.exit(1)
}

const targets: LiveTeam[] =
  tricodeArg !== undefined && seasonArg !== undefined
    ? [{ tricode: tricodeArg.toLowerCase(), season: seasonArg }]
    : (
        JSON.parse(readFileSync('season.config.json', 'utf-8')) as { liveTeams?: LiveTeam[] }
      ).liveTeams?.map((t) => ({ tricode: t.tricode.toLowerCase(), season: t.season })) ?? []

if (targets.length === 0) {
  console.error('no team targets — season.config.json has no liveTeams and none were given')
  process.exit(1)
}

// Both team contracts sync together (shot payload + ledger facts, ADR-0082/
// 0084): a target with either missing fails before anything is copied, so a
// one-sided deployment update can never ship.
const resolved = targets.flatMap((t) => {
  const derivedDir = join('data', 'derived', '_teams', t.tricode, t.season)
  return [
    {
      source: latestSource(derivedDir),
      dest: join('public', 'data', '_teams', t.tricode, `${t.season}.json`),
    },
    {
      source: latestSource(join(derivedDir, 'ledger')),
      dest: join('public', 'data', '_teams', t.tricode, `${t.season}.ledger.json`),
    },
  ]
})
if (resolved.some((r) => r.source === null)) process.exit(1)
for (const { source, dest } of resolved) {
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(source!, dest)
  console.log(`synced ${source} -> ${dest}`)
}
