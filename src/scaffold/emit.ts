// The season-argument scaffold's emit core (ADR-0063): pure string builders
// and structured edits, no filesystem — scripts/hero-scaffold.ts is the thin
// shell that reads and writes. Everything mechanical is real (slug, player
// name, thesis, conventional paths); every authored field carries the
// scaffold sentinel, so the authoring tripwire (src/heroes/authoring.ts)
// holds the suite red until a human writes it. The tool drafts structure,
// never judgment: no verdict prose, no claim thresholds, no crop values.
//
// Emitted code must land lint- and typecheck-clean — the repo gate, not this
// module, is what verifies a real scaffold — so the guard skeleton consumes
// every aggregation it sets up (empty claim arrays drive the it() loops).

import { SCAFFOLD_SENTINEL } from '../heroes/authoring'

/** The identity a scaffold is built from: the slug is user-chosen (it is
 * the URL); the player name comes from the shot payload's `_meta.player`,
 * never a CLI arg. */
export interface ScaffoldIdentity {
  slug: string
  season: string
  playerName: string
}

/** cody-williams -> codyWilliams: the hero module's export identifier. */
export function heroExportName(slug: string): string {
  return slug
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

/** A single-quoted TS string literal, escaped (De'Aaron survives). */
function quoted(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** One season argument's object literal, at the seasons[] entry indent —
 * shared by the new-module emit and the append edit so both modes scaffold
 * the identical entry. */
export function emitSeasonEntry({ season, playerName }: ScaffoldIdentity): string {
  const kicker = `${playerName} · ${SCAFFOLD_SENTINEL}: team · Nº ${SCAFFOLD_SENTINEL}: jersey · ${season}`
  return [
    '    {',
    `      season: ${quoted(season)},`,
    '      // Season-owned copy (ADR-0060): the kicker embeds the season string.',
    `      kicker: ${quoted(kicker)},`,
    '      // The verdict (ADR-0017): the answer before the evidence. AUTHORED',
    '      // COPY — author it from hero:report, then hold every directional',
    '      // claim in the colocated guard; when the data moves, rewrite both',
    '      // together, never loosen an assertion.',
    `      verdict: ${quoted(`${SCAFFOLD_SENTINEL}: author the verdict from hero:report`)},`,
    '    },',
  ].join('\n')
}

/** A new hero module: mechanical fields real, authored fields sentinel'd. */
export function emitHeroModule(id: ScaffoldIdentity): string {
  const { slug, season, playerName } = id
  return [
    `// ${playerName} — scaffolded season argument (ADR-0063): every field below`,
    `// marked ${SCAFFOLD_SENTINEL} is AUTHORED COPY (ADR-0017/0021) awaiting its`,
    '// author; the authoring tripwire in the colocated guard keeps the suite',
    '// red until each is written and the banner asset exists. Author the',
    '// verdict from',
    `//   npm run hero:report -- ${slug} ${season}`,
    `// and declare its claims in ./${slug}.${season}.guard.test.ts.`,
    '',
    "import type { HeroConfig } from './types'",
    '',
    `export const ${heroExportName(slug)}: HeroConfig = {`,
    `  slug: ${quoted(slug)},`,
    `  playerName: ${quoted(playerName)},`,
    '  // The v1 question, stated verbatim and nothing more (ADR-0005).',
    `  thesis: ${quoted(`Is ${playerName} taking good shots?`)},`,
    '  hero: {',
    '    // The committed image is always a web-sized derivative, never a',
    '    // full-resolution source (ADR-0021).',
    `    imagePath: ${quoted(`img/${slug}-hero.jpg`)},`,
    '    // Optional normalized team mark (1024px transparent square, 58–62%',
    '    // footprint — interface enforced by ingestion/test_team_logo_assets.py):',
    `    // teamLogoPath: 'img/<team>-logo.png',`,
    `    imageAlt: ${quoted(`${SCAFFOLD_SENTINEL}: describe the banner photo for screen readers`)},`,
    '    // Focal points: the narrow full-bleed poster crop, then the wide',
    "    // right-anchored panel crop (ADR-0021/0025) — e.g. '50% 28%'.",
    `    imagePosition: ${quoted(`${SCAFFOLD_SENTINEL}: narrow focal point`)},`,
    `    imagePositionWide: ${quoted(`${SCAFFOLD_SENTINEL}: wide focal point`)},`,
    '  },',
    `  canonicalSeason: ${quoted(season)},`,
    '  seasons: [',
    emitSeasonEntry(id),
    '  ],',
    '}',
    '',
  ].join('\n')
}

/** The per-season guard skeleton (ADR-0063): the invariant structure of
 * every shipped guard — explicit season pin, payload trio, skipIf preamble,
 * empty claim arrays driving the it() loops, the universal lexicon tripwire,
 * and the authoring tripwire outside the skipIf. No thresholds, no
 * directional assertions, nothing read from the payloads. */
export function emitGuardFile(id: ScaffoldIdentity): string {
  const { slug, season, playerName } = id
  const exportName = heroExportName(slug)
  const pathConst = (name: string, suffix: string): string[] => [
    `const ${name} = path.resolve(`,
    '  process.cwd(),',
    "  'public',",
    "  'data',",
    '  hero.slug,',
    '  `${seasonConfig.season}' + suffix + '.json`,',
    ')',
  ]
  return [
    `// The committed verdict guard (ADR-0017) for ${playerName}'s ${season} season`,
    '// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/',
    '// 0063). SCAFFOLDED SKELETON: author the verdict from',
    `//   npm run hero:report -- ${slug} ${season}`,
    '// then map every directional claim to an assertion here — report →',
    '// verdict → claims, never the reverse. Declare each threshold beside its',
    "// claim with the bar's rationale (see any shipped guard for the",
    "// pattern); claim headroom (hero:report's closing section) is an",
    '// authoring input only, never a guard input (ADR-0059).',
    '//',
    '// Current verdict, claim by claim:',
    `//   ${SCAFFOLD_SENTINEL}: map each verdict prose fragment to the claim backing it:`,
    '//   "<verdict words>"                                   -> claim 1',
    '//   "<why-sentence words>"                              -> why 1 (creation)',
    '//   "<line-sentence words>"                             -> line 1 (free throw)',
    '',
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import { describe, expect, it } from 'vitest'",
    "import type { ShotMetrics } from '../domain/aggregate'",
    "import { aggregateShotMetrics } from '../domain/aggregate'",
    "import { aggregateCreationMetrics } from '../domain/aggregateCreation'",
    "import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'",
    "import { parseCreationPayload } from '../domain/creationPayload'",
    "import { parseFreethrowPayload } from '../domain/freethrowPayload'",
    "import { parseDerivedPayload } from '../domain/payload'",
    "import { authoringProblems } from './authoring'",
    `import { ${exportName} as hero } from './${slug}'`,
    "import { seasonArgumentOf } from './types'",
    "import type { CreationClaim, FreethrowClaim } from './verdictLexicon'",
    'import {',
    '  invalidAssistInterpretationsIn,',
    '  unbackedAssistTerms,',
    '  unbackedCreationTerms,',
    '  unbackedFreethrowTerms,',
    '  unshippedTermsIn,',
    "} from './verdictLexicon'",
    '',
    '// The guarded season argument, selected explicitly (ADR-0060/0061): a flip',
    '// moving the canonical pointer must never silently repoint these claims at',
    "// a different season's data.",
    `const seasonConfig = seasonArgumentOf(hero, ${quoted(season)})`,
    '',
    ...pathConst('payloadPath', ''),
    ...pathConst('creationPath', '.creation'),
    ...pathConst('freethrowPath', '.freethrow'),
    '',
    "// The verdict's directional shot claims (ADR-0017): one entry per claim,",
    '// named after the verdict words it backs, asserted against the shot',
    '// metrics. Shot claims need no lexicon licensing (two-axis vocabulary is',
    '// always legal), so the type is local; the array mirrors the claim-family',
    '// pattern so every aggregation below is consumed from day one.',
    'interface ShotClaim {',
    '  name: string',
    '  assert: (m: ShotMetrics) => void',
    '}',
    '',
    `// ${SCAFFOLD_SENTINEL}: populate from the authored verdict, e.g.`,
    '//   {',
    "//     name: 'claim 1: <the verdict words this backs>',",
    '//     assert: (m) => {',
    '//       expect(m.selection.selectionDelta).not.toBeNull()',
    '//     },',
    '//   },',
    'const shotClaims: ShotClaim[] = []',
    '',
    '// The creation-kind claims (ADR-0029): declaring at least one licenses the',
    "// verdict's creation vocabulary (the lexicon tripwire below enforces it).",
    `// ${SCAFFOLD_SENTINEL}: populate iff the authored verdict uses creation vocabulary.`,
    'const creationClaims: CreationClaim[] = []',
    '',
    "// The line-sentence's free-throw claims (ADR-0055/0056): every assertion",
    '// on a league-baselined metric must hold on BOTH technical cuts.',
    `// ${SCAFFOLD_SENTINEL}: populate iff the verdict uses free-throw vocabulary.`,
    'const freethrowClaims: FreethrowClaim[] = []',
    '',
    '// Assist vocabulary needs its own claim kind over the shot-context payload',
    '// (AssistClaim, worst-case bounds — see the Shai guard for the pattern);',
    '// the tripwire below holds it at zero until one is declared.',
    '',
    '// Loaded only when every payload is deployed; the suite below skips',
    "// otherwise — a scaffold's normal state until hero:sync runs. (A",
    '// skipped describe still executes its factory at collection, so the',
    '// loads cannot live at describe scope.)',
    'function loadMetrics() {',
    "  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))",
    '  return {',
    '    shot: aggregateShotMetrics(payload.shots, payload.zoneBaseline),',
    '    creation: aggregateCreationMetrics(',
    "      parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),",
    '    ),',
    '    freethrow: aggregateFreethrowMetrics(',
    "      parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),",
    '    ),',
    '  }',
    '}',
    'const deployed =',
    '  existsSync(payloadPath) && existsSync(creationPath) && existsSync(freethrowPath)',
    'const metrics = deployed ? loadMetrics() : null',
    '',
    'describe.skipIf(metrics === null)(',
    `  ${quoted(`verdict guard: ${playerName} ${season} (ADR-0017/0029)`)},`,
    '  () => {',
    '  for (const claim of shotClaims) {',
    '    it(claim.name, () => claim.assert(metrics!.shot))',
    '  }',
    '',
    "  // The why-sentence's creation-kind claims (ADR-0029), run against the",
    "  // deployed creation payload's metrics.",
    '  for (const claim of creationClaims) {',
    '    it(claim.name, () => claim.assert(metrics!.creation))',
    '  }',
    '',
    "  // The line-sentence's free-throw claims (ADR-0055/0056), run against the",
    "  // deployed free-throw payload's metrics.",
    '  for (const claim of freethrowClaims) {',
    '    it(claim.name, () => claim.assert(metrics!.freethrow))',
    '  }',
    '',
    "  it('vocabulary is claim-backed; unshipped vocabulary absent (ADR-0029)', () => {",
    '    expect(unshippedTermsIn(seasonConfig.verdict)).toEqual([])',
    '    expect(unbackedCreationTerms(seasonConfig.verdict, creationClaims.length)).toEqual([])',
    '    expect(unbackedFreethrowTerms(seasonConfig.verdict, freethrowClaims.length)).toEqual([])',
    '    expect(unbackedAssistTerms(seasonConfig.verdict, 0)).toEqual([])',
    '    expect(invalidAssistInterpretationsIn(seasonConfig.verdict)).toEqual([])',
    '  })',
    '  },',
    ')',
    '',
    '// The authoring tripwire (ADR-0063): deliberately OUTSIDE the payload',
    '// skipIf — no data needed, so it holds on clean clones and CI alike.',
    "describe('authoring completeness (ADR-0063)', () => {",
    "  it('no scaffold sentinel remains and referenced banner assets exist', () => {",
    '    expect(authoringProblems(hero, seasonConfig)).toEqual([])',
    '  })',
    '})',
    '',
  ].join('\n')
}

/** Append-mode module edit: insert the new season entry before the seasons[]
 * closing bracket. Structured, anchored, and loud: an unrecognizable module
 * shape or an already-argued season is a thrown error, never a guess. The
 * canonicalSeason pointer is deliberately untouched — moving it is the flip
 * PR's human step (ADR-0059/0060/0063). */
export function appendSeasonEntry(moduleSource: string, id: ScaffoldIdentity): string {
  if (moduleSource.includes(`season: ${quoted(id.season)}`)) {
    throw new Error(`${id.slug} already argues ${id.season} — nothing to scaffold`)
  }
  // Match and insert in the file's own line-ending convention (a CRLF
  // checkout must not grow a mixed-endings module).
  const eol = moduleSource.includes('\r\n') ? '\r\n' : '\n'
  const anchor = `${eol}  ],${eol}}`
  const at = moduleSource.lastIndexOf(anchor)
  if (at === -1 || moduleSource.indexOf(anchor) !== at) {
    throw new Error(
      `could not find one seasons[] closing anchor in the ${id.slug} module — ` +
        'append the season entry by hand',
    )
  }
  const entry = emitSeasonEntry(id).replaceAll('\n', eol)
  return `${moduleSource.slice(0, at)}${eol}${entry}${moduleSource.slice(at)}`
}

/** Registry edit: the import (before the types import) and the HEROES entry
 * (appended at the end — index tile order is add order). Eager on purpose
 * (ADR-0063): registering makes an incomplete add loud, because the
 * real-data guards immediately demand deployed payloads and the authoring
 * tripwire demands authored copy. */
export function registerHero(registrySource: string, id: ScaffoldIdentity): string {
  const exportName = heroExportName(id.slug)
  if (registrySource.includes(`from './${id.slug}'`)) {
    throw new Error(`${id.slug} is already registered`)
  }
  const typesImport = "import type { HeroConfig } from './types'"
  const typesAt = registrySource.indexOf(typesImport)
  if (typesAt === -1) {
    throw new Error('could not find the types import anchor in registry.ts')
  }
  const eol = registrySource.includes('\r\n') ? '\r\n' : '\n'
  const headerAnchor = 'export const HEROES: readonly HeroConfig[] = ['
  const headerAt = registrySource.indexOf(headerAnchor)
  const closeAt = headerAt === -1 ? -1 : registrySource.indexOf(`${eol}]`, headerAt)
  if (closeAt === -1) {
    throw new Error('could not find the HEROES array anchor in registry.ts')
  }
  // Apply the later edit first so the earlier index stays valid.
  const withEntry = `${registrySource.slice(0, closeAt)}${eol}  ${exportName},${registrySource.slice(closeAt)}`
  return `${withEntry.slice(0, typesAt)}import { ${exportName} } from './${id.slug}'${eol}${withEntry.slice(typesAt)}`
}
