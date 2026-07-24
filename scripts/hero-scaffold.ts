// Scaffold a season argument (ADR-0063): the mechanical skeleton of a hero
// add — the hero module (created, or its seasons[] appended), the per-season
// guard skeleton, and the registry entry — with every authored field left as
// a TODO(scaffold) sentinel the authoring tripwire enforces. The tool drafts
// structure, never judgment: no verdict prose, no claim thresholds, no crop
// values. Runs under tsx and imports the same emit core its tests cover.
//
// Usage:
//   npm run hero:scaffold -- <player-slug> <season>
//
// Preconditions: all four derived payloads for <slug>/<season> must resolve
// (the hero:sync partial-fails stance, applied at the add recipe's front
// door). The player name is read from the shot payload's _meta.player —
// never typed by hand. After scaffolding, the suite stays red until the
// copy is authored, the banner asset lands, and hero:sync deploys the
// payloads — a half-finished add can never merge.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseDerivedPayload } from '../src/domain/payload'
import { planScaffold, SEASON_PATTERN, SLUG_PATTERN } from '../src/scaffold/plan'

const USAGE = 'usage: npm run hero:scaffold -- <player-slug> <season>'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const [slug, season, ...rest] = process.argv.slice(2)
if (!slug || !season || rest.length > 0) fail(USAGE)
if (!SLUG_PATTERN.test(slug)) fail(`invalid slug '${slug}' — lowercase kebab-case\n${USAGE}`)
if (!SEASON_PATTERN.test(season)) fail(`invalid season '${season}' — e.g. 2026-27\n${USAGE}`)

// ---- Preconditions: all four derived payloads (same latest-file rule as
// hero:sync — ISO pull-date filenames sort lexicographically). ----

function latestDerived(sourceDir: string): string | null {
  let candidates: string[]
  try {
    candidates = readdirSync(sourceDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    return null
  }
  const latest = candidates[candidates.length - 1]
  return latest === undefined ? null : join(sourceDir, latest)
}

const derivedDir = join('data', 'derived', slug, season)
const contracts = [
  { name: 'shot', dir: derivedDir, hint: 'python ingestion/derive_payload.py' },
  { name: 'creation', dir: join(derivedDir, 'creation'), hint: 'python ingestion/derive_creation.py' },
  {
    name: 'shot-context',
    dir: join(derivedDir, 'shot-context'),
    hint: 'python ingestion/derive_shot_context.py',
  },
  {
    name: 'freethrow',
    dir: join(derivedDir, 'freethrow'),
    hint: 'python ingestion/derive_freethrow.py',
  },
]
const resolved = contracts.map((c) => ({ ...c, source: latestDerived(c.dir) }))
const missing = resolved.filter((c) => c.source === null)
if (missing.length > 0) {
  fail(
    [
      `scaffolding requires all four derived payloads for ${slug}/${season} — ` +
        'a partial add is not an add (ADR-0063). Missing:',
      ...missing.map((c) => `  ${c.name}: nothing under ${c.dir} — run ${c.hint}`),
    ].join('\n'),
  )
}

// ---- Identity: the player name comes from the payload, never a CLI arg. ----

const shotSource = resolved[0]!.source!
const payload = parseDerivedPayload(JSON.parse(readFileSync(shotSource, 'utf-8')))
if (payload._meta.season !== season) {
  fail(
    `${shotSource} is a ${payload._meta.season} payload, not ${season} — ` +
      'check the derive output before scaffolding',
  )
}
const playerName = payload._meta.player

// ---- Plan (pure) and apply. ----

const modulePath = join('src', 'heroes', `${slug}.ts`)
const guardPath = join('src', 'heroes', `${slug}.${season}.guard.test.ts`)

let plan
try {
  plan = planScaffold(
    { slug, season, playerName },
    {
      moduleSource: existsSync(modulePath) ? readFileSync(modulePath, 'utf-8') : null,
      registrySource: readFileSync(join('src', 'heroes', 'registry.ts'), 'utf-8'),
      guardFileExists: existsSync(guardPath),
    },
  )
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

for (const file of plan.files) {
  // Belt and suspenders under the planner's never-overwrite rule.
  if (file.action === 'create' && existsSync(file.path)) {
    fail(`${file.path} already exists — a scaffold never overwrites (ADR-0063)`)
  }
  writeFileSync(file.path, file.content, 'utf-8')
  console.log(`${file.action === 'create' ? 'created' : 'updated'} ${file.path}`)
}

console.log(
  [
    '',
    `scaffolded ${plan.mode === 'new-hero' ? 'new hero' : 'season append'}: ${playerName} ${season}`,
    '',
    'The suite is now red on purpose (the authoring tripwire) until the add is complete:',
    `  1. npm run hero:sync -- ${slug} ${season}   (deploy the four payloads)`,
    `  2. add the banner photo at public/img/${slug}-hero.jpg (web-sized derivative, ADR-0021)`,
    `  3. npm run hero:report -- ${slug} ${season} --deployed   (read the story + claim headroom)`,
    `  4. author the verdict + kicker + alt + focal points (replace every TODO(scaffold))`,
    `     and declare the claims in src/heroes/${slug}.${season}.guard.test.ts`,
    '  5. npm test && npm run lint && npm run build',
  ].join('\n'),
)
