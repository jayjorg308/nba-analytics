// Fetch the standard NBA headshot (ADR-0065's formula) for every player with
// a season page on a team surface (ADR-0095): every shooter of every
// registered team season, saved at the conventional img/<slug>-headshot.png
// the hero directory already uses, so a hero's headshot serves his tool page
// too. Skips any file already committed. A mechanical asset, committed by PR
// like every deployed image; the player page hides a missing one, never
// shows a placeholder.
//
// The download is hero:add's (ingestion/hero_add.py download_headshot: curl
// first, with the TLS-hang fallback ADR-0066 records, and a PNG check).
//
// Usage: npm run team:headshots [-- --dry-run]   (--dry-run lists, fetches nothing)

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { seasonShooters } from '../src/domain/playerSeason'
import { parseTeamShotPayload } from '../src/domain/teamShotPayload'
import { TEAMS } from '../src/teams/registry'

const wanted = new Map<string, { playerId: number; name: string }>()
for (const team of TEAMS) {
  for (const season of team.seasons) {
    const file = path.join('public', 'data', '_teams', team.tricode.toLowerCase(), `${season}.json`)
    const payload = parseTeamShotPayload(JSON.parse(readFileSync(file, 'utf-8')))
    for (const p of seasonShooters(payload)) wanted.set(p.slug, { playerId: p.playerId, name: p.name })
  }
}

const missing = [...wanted].filter(([slug]) => !existsSync(path.join('public', 'img', `${slug}-headshot.png`)))
console.log(`${wanted.size} players with pages, ${missing.length} without a committed headshot`)
if (process.argv.includes('--dry-run')) {
  for (const [slug, { playerId, name }] of missing) console.log(`  ${name} (${playerId}) -> img/${slug}-headshot.png`)
  process.exit(0)
}
const failed: string[] = []
for (const [slug, { playerId, name }] of missing) {
  const dest = path.join('public', 'img', `${slug}-headshot.png`)
  const result = spawnSync(
    'python',
    [
      '-c',
      'import sys; from pathlib import Path; sys.path.insert(0, "ingestion"); import hero_add; ' +
        'hero_add.download_headshot(int(sys.argv[1]), Path(sys.argv[2]))',
      String(playerId),
      dest,
    ],
    { stdio: 'inherit' },
  )
  if (result.error || result.status !== 0) failed.push(`${name} (${playerId})`)
}
if (failed.length > 0) {
  console.error(`no headshot for: ${failed.join(', ')}; their pages render the banner without one`)
  process.exit(1)
}
