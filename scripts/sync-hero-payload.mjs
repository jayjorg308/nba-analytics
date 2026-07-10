// Copy the latest derived payload for a (player, season) into public/data/ so
// the deployed app can fetch it (the app reads persisted JSON, never the API —
// stats.nba.com blocks cloud IPs). public/data/ is committed; /data/ is not.
//
// Usage: node scripts/sync-hero-payload.mjs <player-slug> <season>
//   (wired as `npm run hero:sync`; the slug/season also live in
//    src/heroConfig.ts — the HeroPage test asserts the two agree)

import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

const [slug, season] = process.argv.slice(2)
if (!slug || !season) {
  console.error('usage: node scripts/sync-hero-payload.mjs <player-slug> <season>')
  process.exit(1)
}

const sourceDir = path.join('data', 'derived', slug, season)
let candidates
try {
  candidates = readdirSync(sourceDir).filter((f) => f.endsWith('.json')).sort()
} catch {
  console.error(`no derived payloads under ${sourceDir} — run ingestion/derive_payload.py first`)
  process.exit(1)
}
if (candidates.length === 0) {
  console.error(`no derived payloads under ${sourceDir} — run ingestion/derive_payload.py first`)
  process.exit(1)
}

// ISO pull-date filenames sort lexicographically == chronologically.
const latest = candidates[candidates.length - 1]
const source = path.join(sourceDir, latest)
const dest = path.join('public', 'data', slug, `${season}.json`)
mkdirSync(path.dirname(dest), { recursive: true })
copyFileSync(source, dest)
console.log(`synced ${source} -> ${dest}`)
