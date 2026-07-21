// Copy the latest derived payload(s) into public/data/ so the deployed app
// can fetch them (the app reads persisted JSON, never the API — stats.nba.com
// blocks cloud IPs). public/data/ is committed; /data/ is not (ADR-0010).
//
// Each target syncs all four required contracts: shot, creation,
// shot-context, and free throw (ADRs 0030/0032/0053). A target with any
// missing derived sibling fails rather than shipping a partial argument.
// Derived sibling payloads live in dedicated subdirectories, keeping the
// root shot-payload glob blind to them by construction.
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

function latestSource(sourceDir: string, deriveHint: string): string | null {
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
    return null
  }

  // ISO pull-date filenames sort lexicographically == chronologically.
  const latest = candidates[candidates.length - 1]!
  return join(sourceDir, latest)
}

interface SyncFile {
  source: string
  dest: string
}

function syncResolved({ source, dest }: SyncFile): void {
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(source, dest)
  console.log(`synced ${source} -> ${dest}`)
}

function resolveOne(slug: string, season: string): SyncFile[] | null {
  const derivedDir = join('data', 'derived', slug, season)
  const sources = [
    latestSource(derivedDir, 'ingestion/derive_payload.py'),
    latestSource(join(derivedDir, 'creation'), 'ingestion/derive_creation.py'),
    latestSource(join(derivedDir, 'shot-context'), 'ingestion/derive_shot_context.py'),
    latestSource(join(derivedDir, 'freethrow'), 'ingestion/derive_freethrow.py'),
  ]
  if (sources.some((source) => source === null)) return null
  return [
    { source: sources[0]!, dest: join('public', 'data', slug, `${season}.json`) },
    {
      source: sources[1]!,
      dest: join('public', 'data', slug, `${season}.creation.json`),
    },
    {
      source: sources[2]!,
      dest: join('public', 'data', slug, `${season}.context.json`),
    },
    {
      source: sources[3]!,
      dest: join('public', 'data', slug, `${season}.freethrow.json`),
    },
  ]
}

const [slug, season] = process.argv.slice(2)
if ((slug === undefined) !== (season === undefined)) {
  console.error('usage: npm run hero:sync [-- <player-slug> <season>]')
  process.exit(1)
}

const targets: readonly { slug: string; season: string }[] =
  slug !== undefined && season !== undefined ? [{ slug, season }] : HEROES

// Resolve every required sibling for every target before copying anything.
// A missing context can therefore never leave a one-sided deployment update.
const resolved = targets.map((target) => resolveOne(target.slug, target.season))
if (resolved.some((files) => files === null)) process.exit(1)
for (const files of resolved) {
  for (const file of files!) syncResolved(file)
}
