// Print a hero's computed story from a derived payload (ROADMAP v1.1 #2).
// Runs under tsx so it reuses the production load boundary and aggregation
// (parseDerivedPayload → aggregateShotMetrics) — the metrics live in
// TypeScript by decision (ADR-0009); a second implementation would drift.
//
// Usage:
//   npm run hero:report -- <player-slug> <season>             latest payload under data/derived/
//   npm run hero:report -- <player-slug> <season> --deployed  the committed public/data/ copy
//   npm run hero:report -- --file <path>                      any payload file

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseDerivedPayload } from '../src/domain/payload'
import { renderHeroReport } from '../src/report/heroReport'

const USAGE = [
  'usage:',
  '  npm run hero:report -- <player-slug> <season> [--deployed]',
  '  npm run hero:report -- --file <path/to/payload.json>',
].join('\n')

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const args = process.argv.slice(2)

function resolvePayloadPath(): string {
  const fileFlag = args.indexOf('--file')
  if (fileFlag !== -1) {
    const file = args[fileFlag + 1]
    if (!file) fail(USAGE)
    return file
  }

  const [slug, season] = args.filter((a) => !a.startsWith('--'))
  if (!slug || !season) fail(USAGE)

  if (args.includes('--deployed')) {
    return join('public', 'data', slug, `${season}.json`)
  }

  // Same latest-payload rule as scripts/sync-hero-payload.mjs: ISO pull-date
  // filenames sort lexicographically == chronologically.
  const sourceDir = join('data', 'derived', slug, season)
  let candidates: string[]
  try {
    candidates = readdirSync(sourceDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    candidates = []
  }
  if (candidates.length === 0) {
    fail(
      `no derived payloads under ${sourceDir} — run ingestion/derive_payload.py first, ` +
        `or read the committed copy with --deployed`,
    )
  }
  return join(sourceDir, candidates[candidates.length - 1]!)
}

const payloadPath = resolvePayloadPath()

let raw: string
try {
  raw = readFileSync(payloadPath, 'utf-8')
} catch (e) {
  fail(`cannot read ${payloadPath}: ${e instanceof Error ? e.message : String(e)}`)
}

let report: string
try {
  report = renderHeroReport(parseDerivedPayload(JSON.parse(raw)))
} catch (e) {
  // A payload that fails the contract is a real error, surfaced plainly —
  // never swallowed (ADR-0007).
  fail(`payload contract violation in ${payloadPath}:\n${e instanceof Error ? e.message : String(e)}`)
}

console.log(`payload: ${payloadPath}`)
console.log('')
console.log(report)
