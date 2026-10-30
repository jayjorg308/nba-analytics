// Copy the latest derived team contracts into public/data/_teams/ so the
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

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

interface LiveTeam {
  tricode: string
  season: string
}

function latestEntry(dir: string, keep: (name: string) => boolean): string | null {
  let candidates: string[]
  try {
    candidates = readdirSync(dir).filter(keep).sort()
  } catch {
    candidates = []
  }
  // <pull-date>[T<HHMMSS>] names sort lexicographically == chronologically.
  return candidates.length === 0 ? null : join(dir, candidates[candidates.length - 1]!)
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

// The team contracts sync together, from ONE session (ADR-0082/0088/0091):
// the team shot payload and the game export (the season index plus the game
// files with no published copy yet; it carries every game ledger row since
// ADR-0087 retired the ledger facts). A target with either missing, or with
// the two from different sessions, fails before anything is copied, so a
// one-sided deployment update can never ship. Game files are immutable: a published game file the export
// would change fails the sync (the export refuses first; this is the
// backstop), and every index row must name a game file that is published or
// in the export.
const errors: string[] = []
const copies: { source: string; dest: string }[] = []
for (const t of targets) {
  const label = `${t.tricode} ${t.season}`
  const derivedDir = join('data', 'derived', '_teams', t.tricode, t.season)
  const deployedDir = join('public', 'data', '_teams', t.tricode)
  const publishedDir = join(deployedDir, t.season)
  const isJson = (name: string) => name.endsWith('.json')
  const shot = latestEntry(derivedDir, isJson)
  const gamesDir = latestEntry(join(derivedDir, 'games'), (name) =>
    existsSync(join(derivedDir, 'games', name, 'index.json')),
  )
  const absent = [
    shot === null && 'team shot payload',
    gamesDir === null && 'game export (season index)',
  ].filter(Boolean)
  if (absent.length > 0) {
    errors.push(
      `${label}: no derived ${absent.join(', ')} under ${derivedDir} — run the season loop's ` +
        `team session (or ingestion/derive_team_payload.py and export_game_payload.py) first`,
    )
    continue
  }
  const session = basename(gamesDir!)
  if (basename(shot!) !== `${session}.json`) {
    errors.push(
      `${label}: the latest derived contracts come from different sessions (` +
        `${basename(shot!)}, games ${session}) — a partial session never syncs`,
    )
    continue
  }

  const exported = readdirSync(join(gamesDir!, 'games'), { withFileTypes: true })
    .filter((e) => e.isFile() && isJson(e.name))
    .map((e) => e.name)
  const index = JSON.parse(readFileSync(join(gamesDir!, 'index.json'), 'utf-8')) as {
    games: { gameId: string }[]
  }
  const indexed = new Set(index.games.map((g) => `${g.gameId}.json`))
  for (const name of indexed) {
    if (!exported.includes(name) && !existsSync(join(publishedDir, 'games', name))) {
      errors.push(`${label}: index row ${name} has no game file, published or exported`)
    }
  }
  for (const name of exported) {
    const source = join(gamesDir!, 'games', name)
    const dest = join(publishedDir, 'games', name)
    if (!indexed.has(name)) errors.push(`${label}: exported ${name} is not in the season index`)
    if (existsSync(dest) && readFileSync(dest, 'utf-8') !== readFileSync(source, 'utf-8')) {
      errors.push(`${label}: ${dest} is published and would change — game files are immutable`)
    }
    copies.push({ source, dest })
  }
  copies.push(
    { source: shot!, dest: join(deployedDir, `${t.season}.json`) },
    { source: join(gamesDir!, 'index.json'), dest: join(publishedDir, 'index.json') },
  )
}
if (errors.length > 0) {
  for (const e of errors) console.error(e)
  process.exit(1)
}
for (const { source, dest } of copies) {
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(source, dest)
  console.log(`synced ${source} -> ${dest}`)
}
