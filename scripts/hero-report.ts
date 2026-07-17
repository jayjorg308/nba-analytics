// Print a hero's computed story from a derived payload (ROADMAP v1.1 #2),
// plus its Case 2 creation and Case 3 assisted-makes sections from the two
// required sibling payloads (ADRs 0031/0032).
// Runs under tsx so it reuses the production load boundaries and aggregations
// (parseDerivedPayload → aggregateShotMetrics and the two sibling parse +
// aggregate paths) — the metrics live in TypeScript by decision
// (ADR-0009); a second implementation would drift.
//
// Usage:
//   npm run hero:report -- <player-slug> <season>             latest payloads under data/derived/
//   npm run hero:report -- <player-slug> <season> --deployed  the committed public/data/ copies
//   npm run hero:report -- --file <path> [--creation-file <path>] [--context-file <path>]

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCreationPayload } from '../src/domain/creationPayload'
import { parseDerivedPayload } from '../src/domain/payload'
import { parseShotContextPayload } from '../src/domain/shotContextPayload'
import { renderCreationReport } from '../src/report/creationReport'
import { renderHeroReport } from '../src/report/heroReport'
import { renderShotContextReport } from '../src/report/shotContextReport'

const USAGE = [
  'usage:',
  '  npm run hero:report -- <player-slug> <season> [--deployed]',
  '  npm run hero:report -- --file <path/to/payload.json> [--creation-file <path>] [--context-file <path>]',
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

/** The sibling creation payload's path, or null with a reason when it cannot
 * be resolved (the report still prints the shot story — this is a reading
 * tool, not the deploy gate; the sync and the real-data guard enforce
 * ADR-0030's required rule). */
function resolveCreationPayloadPath(): { path: string | null; note?: string } {
  const creationFlag = args.indexOf('--creation-file')
  if (creationFlag !== -1) {
    const file = args[creationFlag + 1]
    if (!file) fail(USAGE)
    return { path: file }
  }
  if (args.indexOf('--file') !== -1) {
    return { path: null, note: 'no --creation-file given alongside --file' }
  }

  const [slug, season] = args.filter((a) => !a.startsWith('--'))
  if (args.includes('--deployed')) {
    return { path: join('public', 'data', slug!, `${season}.creation.json`) }
  }
  const sourceDir = join('data', 'derived', slug!, season!, 'creation')
  let candidates: string[]
  try {
    candidates = readdirSync(sourceDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    candidates = []
  }
  if (candidates.length === 0) {
    return { path: null, note: `no derived creation payloads under ${sourceDir}` }
  }
  return { path: join(sourceDir, candidates[candidates.length - 1]!) }
}

function resolveContextPayloadPath(): { path: string | null; note?: string } {
  const contextFlag = args.indexOf('--context-file')
  if (contextFlag !== -1) {
    const file = args[contextFlag + 1]
    if (!file) fail(USAGE)
    return { path: file }
  }
  if (args.indexOf('--file') !== -1) {
    return { path: null, note: 'no --context-file given alongside --file' }
  }
  const [slug, season] = args.filter((a) => !a.startsWith('--'))
  if (args.includes('--deployed')) {
    return { path: join('public', 'data', slug!, `${season}.context.json`) }
  }
  const sourceDir = join('data', 'derived', slug!, season!, 'shot-context')
  let candidates: string[]
  try {
    candidates = readdirSync(sourceDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    candidates = []
  }
  if (candidates.length === 0) {
    return { path: null, note: `no derived shot-context payloads under ${sourceDir}` }
  }
  return { path: join(sourceDir, candidates[candidates.length - 1]!) }
}

const payloadPath = resolvePayloadPath()

let raw: string
try {
  raw = readFileSync(payloadPath, 'utf-8')
} catch (e) {
  fail(`cannot read ${payloadPath}: ${e instanceof Error ? e.message : String(e)}`)
}

let report: string
let seasonFgaTarget: number
let shotPayload: ReturnType<typeof parseDerivedPayload>
try {
  shotPayload = parseDerivedPayload(JSON.parse(raw))
  report = renderHeroReport(shotPayload)
  seasonFgaTarget = shotPayload._meta.totalShots + shotPayload._meta.zoneConflictsDropped
} catch (e) {
  // A payload that fails the contract is a real error, surfaced plainly —
  // never swallowed (ADR-0007).
  fail(`payload contract violation in ${payloadPath}:\n${e instanceof Error ? e.message : String(e)}`)
}

console.log(`payload: ${payloadPath}`)
console.log('')
console.log(report)

const creation = resolveCreationPayloadPath()
if (creation.path === null) {
  console.log('')
  console.log(
    `!! creation section skipped: ${creation.note} — run ingestion/derive_creation.py ` +
      '(the creation payload is required per hero, ADR-0030)',
  )
} else {
  let creationRaw: string
  try {
    creationRaw = readFileSync(creation.path, 'utf-8')
  } catch (e) {
    fail(
      `cannot read ${creation.path}: ${e instanceof Error ? e.message : String(e)}\n` +
        'run ingestion/derive_creation.py (the creation payload is required per hero, ADR-0030)',
    )
  }
  try {
    const creationPayload = parseCreationPayload(JSON.parse(creationRaw))
    // The ADR-0030 identity, cross-checked at read time: a report must never
    // narrate two payloads that contradict each other.
    if (creationPayload._meta.seasonFga !== seasonFgaTarget) {
      fail(
        `payloads contradict: creation seasonFga ${creationPayload._meta.seasonFga} != ` +
          `shot payload pre-drop total ${seasonFgaTarget} — re-derive and re-sync together`,
      )
    }
    console.log('')
    console.log(`creation payload: ${creation.path}`)
    console.log('')
    console.log(renderCreationReport(creationPayload))
  } catch (e) {
    fail(
      `creation payload contract violation in ${creation.path}:\n${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

const context = resolveContextPayloadPath()
if (context.path === null) {
  fail(
    `cannot render required assisted-makes section: ${context.note} — ` +
      'run ingestion/derive_shot_context.py (ADR-0032)',
  )
} else {
  let contextRaw: string
  try {
    contextRaw = readFileSync(context.path, 'utf-8')
  } catch (e) {
    fail(
      `cannot read ${context.path}: ${e instanceof Error ? e.message : String(e)}\n` +
        'run ingestion/derive_shot_context.py (the shot-context payload is required per hero, ADR-0032)',
    )
  }
  try {
    const contextPayload = parseShotContextPayload(JSON.parse(contextRaw))
    console.log('')
    console.log(`shot-context payload: ${context.path}`)
    console.log('')
    console.log(renderShotContextReport(shotPayload, contextPayload))
  } catch (e) {
    fail(
      `shot-context payload contract violation in ${context.path}:\n${e instanceof Error ? e.message : String(e)}`,
    )
  }
}
