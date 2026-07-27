// The committed verdict guard (ADR-0017) for Donovan Mitchell's 2025-26 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). SCAFFOLDED SKELETON: author the verdict from
//   npm run hero:report -- donovan-mitchell 2025-26
// then map every directional claim to an assertion here — report →
// verdict → claims, never the reverse. Declare each threshold beside its
// claim with the bar's rationale (see any shipped guard for the
// pattern); claim headroom (hero:report's closing section) is an
// authoring input only, never a guard input (ADR-0059).
//
// Current verdict, claim by claim:
//   TODO(scaffold): map each verdict prose fragment to the claim backing it:
//   "<verdict words>"                                   -> claim 1
//   "<why-sentence words>"                              -> why 1 (creation)
//   "<line-sentence words>"                             -> line 1 (free throw)

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ShotMetrics } from '../domain/aggregate'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { authoringProblems } from './authoring'
import { donovanMitchell as hero } from './donovan-mitchell'
import { seasonArgumentOf } from './types'
import type { CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'

// The guarded season argument, selected explicitly (ADR-0060/0061): a flip
// moving the canonical pointer must never silently repoint these claims at
// a different season's data.
const seasonConfig = seasonArgumentOf(hero, '2025-26')

const payloadPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.json`,
)
const creationPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.creation.json`,
)
const freethrowPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.freethrow.json`,
)

// The verdict's directional shot claims (ADR-0017): one entry per claim,
// named after the verdict words it backs, asserted against the shot
// metrics. Shot claims need no lexicon licensing (two-axis vocabulary is
// always legal), so the type is local; the array mirrors the claim-family
// pattern so every aggregation below is consumed from day one.
interface ShotClaim {
  name: string
  assert: (m: ShotMetrics) => void
}

// TODO(scaffold): populate from the authored verdict, e.g.
//   {
//     name: 'claim 1: <the verdict words this backs>',
//     assert: (m) => {
//       expect(m.selection.selectionDelta).not.toBeNull()
//     },
//   },
const shotClaims: ShotClaim[] = []

// The creation-kind claims (ADR-0029): declaring at least one licenses the
// verdict's creation vocabulary (the lexicon tripwire below enforces it).
// TODO(scaffold): populate iff the authored verdict uses creation vocabulary.
const creationClaims: CreationClaim[] = []

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion
// on a league-baselined metric must hold on BOTH technical cuts.
// TODO(scaffold): populate iff the verdict uses free-throw vocabulary.
const freethrowClaims: FreethrowClaim[] = []

// Assist vocabulary needs its own claim kind over the shot-context payload
// (AssistClaim, worst-case bounds — see the Shai guard for the pattern);
// the tripwire below holds it at zero until one is declared.

// Loaded only when every payload is deployed; the suite below skips
// otherwise — a scaffold's normal state until hero:sync runs. (A
// skipped describe still executes its factory at collection, so the
// loads cannot live at describe scope.)
function loadMetrics() {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  return {
    shot: aggregateShotMetrics(payload.shots, payload.zoneBaseline),
    creation: aggregateCreationMetrics(
      parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),
    ),
    freethrow: aggregateFreethrowMetrics(
      parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),
    ),
  }
}
const deployed =
  existsSync(payloadPath) && existsSync(creationPath) && existsSync(freethrowPath)
const metrics = deployed ? loadMetrics() : null

describe.skipIf(metrics === null)(
  'verdict guard: Donovan Mitchell 2025-26 (ADR-0017/0029)',
  () => {
  for (const claim of shotClaims) {
    it(claim.name, () => claim.assert(metrics!.shot))
  }

  // The why-sentence's creation-kind claims (ADR-0029), run against the
  // deployed creation payload's metrics.
  for (const claim of creationClaims) {
    it(claim.name, () => claim.assert(metrics!.creation))
  }

  // The line-sentence's free-throw claims (ADR-0055/0056), run against the
  // deployed free-throw payload's metrics.
  for (const claim of freethrowClaims) {
    it(claim.name, () => claim.assert(metrics!.freethrow))
  }

  it('vocabulary is claim-backed; unshipped vocabulary absent (ADR-0029)', () => {
    expect(unshippedTermsIn(seasonConfig.verdict)).toEqual([])
    expect(unbackedCreationTerms(seasonConfig.verdict, creationClaims.length)).toEqual([])
    expect(unbackedFreethrowTerms(seasonConfig.verdict, freethrowClaims.length)).toEqual([])
    expect(unbackedAssistTerms(seasonConfig.verdict, 0)).toEqual([])
    expect(invalidAssistInterpretationsIn(seasonConfig.verdict)).toEqual([])
  })
  },
)

// The authoring tripwire (ADR-0063): deliberately OUTSIDE the payload
// skipIf — no data needed, so it holds on clean clones and CI alike.
describe('authoring completeness (ADR-0063)', () => {
  it('no scaffold sentinel remains and referenced banner assets exist', () => {
    expect(authoringProblems(hero, seasonConfig)).toEqual([])
  })
})
