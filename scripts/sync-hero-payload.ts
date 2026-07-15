// Copy the latest derived payload(s) into public/data/ so the deployed app
// can fetch them (the app reads persisted JSON, never the API — stats.nba.com
// blocks cloud IPs). public/data/ is committed; /data/ is not (ADR-0010).
//
// Each target syncs BOTH contracts: the shot payload and the creation payload
// (ADR-0030 — the creation payload is REQUIRED per hero; a target with only
// one derivable payload fails the sync rather than shipping half an argument).
// Derived creation payloads live in a creation/ subdirectory, which keeps the
// shot-payload globs here and in the real-data tests blind to them by
// construction.
//
// Runs under tsx so it reads the hero registry directly — the single source
// of hero truth (ADR-0022); no slug/season duplicated in package.json.
//
// Usage:
//   npm run hero:sync                      sync every registered hero
//   npm run hero:sync -- <slug> <season>   sync one (player, season) — useful
//                                          before the hero is registered

import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { HEROES } from '../src/heroes/registry'

function syncLatest(sourceDir: string, dest: string, deriveHint: string): boolean {
  let candidates: string[]
  try {
    candidates = readdirSync(sourceDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    candidates = []
  }
  if (candidates.length === 0) {
    console.error(`no derived payloads under ${sourceDir} — run ${deriveHint} first`)
    return false
  }

  // ISO pull-date filenames sort lexicographically == chronologically.
  const latest = candidates[candidates.length - 1]!
  const source = join(sourceDir, latest)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(source, dest)
  console.log(`synced ${source} -> ${dest}`)
  return true
}

function syncOne(slug: string, season: string): boolean {
  const derivedDir = join('data', 'derived', slug, season)
  const shot = syncLatest(
    derivedDir,
    join('public', 'data', slug, `${season}.json`),
    'ingestion/derive_payload.py',
  )
  const creation = syncLatest(
    join(derivedDir, 'creation'),
    join('public', 'data', slug, `${season}.creation.json`),
    'ingestion/derive_creation.py',
  )
  return shot && creation
}

const [slug, season] = process.argv.slice(2)
if ((slug === undefined) !== (season === undefined)) {
  console.error('usage: npm run hero:sync [-- <player-slug> <season>]')
  process.exit(1)
}

const targets: readonly { slug: string; season: string }[] =
  slug !== undefined && season !== undefined ? [{ slug, season }] : HEROES

let allSynced = true
for (const t of targets) {
  if (!syncOne(t.slug, t.season)) allSynced = false
}
process.exit(allSynced ? 0 : 1)
