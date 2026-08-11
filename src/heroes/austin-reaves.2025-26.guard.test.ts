// The committed verdict guard (ADR-0017) for Austin Reaves's 2025-26 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). Every directional claim is asserted against the DEPLOYED payloads'
// metrics; when the data moves, rewrite the copy and this mapping together —
// never loosen an assertion.
//
// Reaves is the hero the fourth act was built for. His two-axis spine is the
// Mitchell shape at lower amplitude (a small selection cost, a material
// making payback), which on its own would be a thin argument. What makes the
// page is THE LINE: he draws fouls at 1.85x the league rate and converts at
// 87%, so better than a quarter of his scoring happens on attempts the shot
// chart cannot see. The reserved 'scoring attempt' vocabulary would state
// that in one word and is exactly why it stays reserved — the verdict has to
// earn it in prose instead.
//
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070), claim by claim:
//   "gives up rim attempts for short shots in the paint and threes
//    above the break"                                             -> claim 2
//   "costs him a little value"                                    -> claim 1
//   "more than pays it back"                                      -> claim 3
//   "well above average inside ten feet"                          -> why 1
//   "his threes land right at the league mark"                    -> claim 4
//   "more than half of Reaves's threes come off the dribble,
//    nearly twice the league rate"                                -> why 2
//   "those pull-ups produce essentially average value"            -> why 3
//   "the catch-and-shoot looks he gets least often"               -> why 4
//   "the ones he converts well above average"                     -> why 5
//   "draws fouls far more often than average"                     -> line 1
//   "converts well above the league rate once he gets there"      -> line 2
//   "more than a quarter of his points come at the line"          -> line 3

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
import { austinReaves as hero } from './austin-reaves'
import { seasonArgumentOf } from './types'
import type { CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import {
  FAR_FTA_RATE,
  MATERIAL_DIET_LEAN_PP,
  MATERIAL_PPS,
  NEUTRAL_BAND_PPS,
  STRONG_PPS,
  WELL_FT_PCT,
} from './verdictLadder'

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

// Verdict semantics — thresholds the prose is held to, priced from the house
// ladder (ADR-0068; the neutral, material, strong, and diet-lean bars are
// imported directly, their names already matching):
//
// "costs him a little value": selection past the neutral band but short of
// materiality — TWO-SIDED, because "a little" overstates inside the band and
// understates past materiality. THE THINNEST CLAIM ON THE PAGE (actual:
// −0.024, four thousandths past neutral). It is exact because the season is
// complete; on a living season this margin would not be authorable.
//
// "gives up rim attempts for short shots in the paint and threes above the
// break": three diet leans, each clearing the ladder's bare bar in share
// points (actual: rim −5.3, non-RA paint +7.6, above-the-break +6.3).
//
// "more than pays it back": making at least material AND strictly larger
// than the selection cost (actual: +0.067 vs −0.024 — 2.8x). Deliberately
// NOT the Mitchell guard's "more than twice", which the prose does not
// promise; the words say the payback exceeds the cost, so that is the bar.
const PAYS_BACK = 1
// "his threes land right at the league mark": the combined-threes rollup
// (ADR-0016's verdict grain, 328 attempts) inside the neutral band on value
// (actual: +0.000 PPS, 36.0% vs 36.0% FG).
//
// "well above average inside ten feet": the General family's inside tier
// clears the ladder's strong bar (actual: +0.129, 298 attempts).
//
// "more than half of Reaves's threes come off the dribble": the pull-up
// slice of his threes exceeds half (actual: 53.0%) — one-sided, as
// "more than" is by construction.
const MORE_THAN_HALF = 0.5
// "nearly twice the league rate": that slice against the league's, as a
// TWO-SIDED band — "nearly twice" understates above 2.0 and overstates
// below the floor (actual: 53.0% vs 27.0% — 1.96x).
const NEARLY_TWICE_FLOOR = 1.8
const NEARLY_TWICE_CEILING = 2
// "those pull-ups produce essentially average value": inside the neutral
// band, the ladder's own words for it (actual: −0.005 on 306 attempts).
//
// "the catch-and-shoot looks he gets least often": his catch-and-shoot
// share below the league's by at least the bare diet bar (actual: 20.1% vs
// 31.7% — 11.6 share points, which also clears the "far" bar; the prose
// only claims the direction).
//
// "the ones he converts well above average": the ladder's strong bar on
// that context's value (actual: +0.122 on 153 attempts).
//
// "draws fouls far more often than average": the ladder's FTA-rate "far"
// bar on BOTH technical cuts (ADR-0055; actual: +0.223 / +0.194).
//
// "converts well above the league rate": the FT "well" bar on both cuts
// (actual: +0.088 / +0.088), sample-safe at 371 FTA.
//
// "more than a quarter of his points come at the line": FT points share
// over a quarter on both cuts — one-sided. The without-technicals cut is
// the binding one at 0.256, six thousandths of margin (actual: 0.272 /
// 0.256).
const A_QUARTER = 0.25

// The verdict's directional shot claims (ADR-0017): one entry per claim,
// named after the verdict words it backs, asserted against the shot
// metrics. Shot claims need no lexicon licensing (two-axis vocabulary is
// always legal), so the type is local.
interface ShotClaim {
  name: string
  assert: (m: ShotMetrics) => void
}

const shotClaims: ShotClaim[] = [
  {
    name: 'claim 1: selection costs a little, past neutral but short of material',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-NEUTRAL_BAND_PPS)
      expect(m.selection.selectionDelta!).toBeGreaterThanOrEqual(-MATERIAL_PPS)
    },
  },
  {
    name: 'claim 2: rim share given up for non-RA paint and above-the-break threes',
    assert: (m) => {
      const zone = (z: string) => m.zones.find((r) => r.zone === z)!
      const rim = zone('Restricted Area')
      expect(rim.attemptShare).not.toBeNull()
      expect(rim.leagueAttemptShare - rim.attemptShare!).toBeGreaterThanOrEqual(
        MATERIAL_DIET_LEAN_PP,
      )
      for (const name of ['In The Paint (Non-RA)', 'Above the Break 3']) {
        const row = zone(name)
        expect(row.attemptShare).not.toBeNull()
        expect(row.attemptShare! - row.leagueAttemptShare).toBeGreaterThanOrEqual(
          MATERIAL_DIET_LEAN_PP,
        )
      }
    },
  },
  {
    name: 'claim 3: making is material and more than pays back the selection cost',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.making.makingPpsDelta!).toBeGreaterThanOrEqual(MATERIAL_PPS)
      expect(m.making.makingPpsDelta!).toBeGreaterThan(
        Math.abs(m.selection.selectionDelta!) * PAYS_BACK,
      )
    },
  },
  {
    name: 'claim 4: combined threes land inside the neutral band, sample-safe',
    assert: (m) => {
      expect(m.threes.pps).not.toBeNull()
      expect(m.threes.smallSampleMaking).toBe(false)
      expect(Math.abs(m.threes.pps! - m.threes.leaguePps)).toBeLessThanOrEqual(NEUTRAL_BAND_PPS)
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('off the dribble', 'pull-up',
// 'catch-and-shoot').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: inside ten feet converts well above the league value, sample-safe',
    assert: (c) => {
      const inside = c.general.inside
      expect(inside.pps).not.toBeNull()
      expect(inside.smallSamplePps).toBe(false)
      expect(inside.pps! - inside.leaguePps!).toBeGreaterThanOrEqual(STRONG_PPS)
    },
  },
  {
    name: 'why 2: more than half his threes are pull-ups, nearly twice the league slice',
    assert: (c) => {
      const arrival = c.general.pullUpThrees
      expect(arrival.share).not.toBeNull()
      expect(arrival.leagueShare).not.toBeNull()
      expect(arrival.share!).toBeGreaterThan(MORE_THAN_HALF)
      const ratio = arrival.share! / arrival.leagueShare!
      expect(ratio).toBeGreaterThanOrEqual(NEARLY_TWICE_FLOOR)
      expect(ratio).toBeLessThanOrEqual(NEARLY_TWICE_CEILING)
    },
  },
  {
    name: 'why 3: pull-ups produce essentially average value, sample-safe',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.pps).not.toBeNull()
      expect(pu.smallSamplePps).toBe(false)
      expect(Math.abs(pu.pps! - pu.leaguePps!)).toBeLessThanOrEqual(NEUTRAL_BAND_PPS)
    },
  },
  {
    name: 'why 4: catch-and-shoot is the look he gets least often vs the league',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      expect(cs.attemptShare).not.toBeNull()
      expect(cs.leagueAttemptShare - cs.attemptShare!).toBeGreaterThanOrEqual(
        MATERIAL_DIET_LEAN_PP,
      )
    },
  },
  {
    name: 'why 5: catch-and-shoot converts well above the league value, sample-safe',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      expect(cs.pps).not.toBeNull()
      expect(cs.smallSamplePps).toBe(false)
      expect(cs.pps! - cs.leaguePps!).toBeGreaterThanOrEqual(STRONG_PPS)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion on
// a league-baselined metric holds on BOTH technical cuts.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: draws fouls far more often than average, on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      for (const cut of [rate.value!, rate.withoutTechnicals!]) {
        expect(cut - rate.league).toBeGreaterThanOrEqual(FAR_FTA_RATE)
      }
    },
  },
  {
    name: 'line 2: converts well above the league rate, on both cuts, sample-safe',
    assert: (f) => {
      const conv = f.seasonLine.conversion
      expect(conv.value).not.toBeNull()
      expect(conv.withoutTechnicals).not.toBeNull()
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      for (const cut of [conv.value!, conv.withoutTechnicals!]) {
        expect(cut - conv.league).toBeGreaterThanOrEqual(WELL_FT_PCT)
      }
    },
  },
  {
    name: 'line 3: more than a quarter of his points come at the line, on both cuts',
    assert: (f) => {
      const share = f.seasonLine.ftPointsShare
      expect(share.value).not.toBeNull()
      expect(share.withoutTechnicals).not.toBeNull()
      for (const cut of [share.value!, share.withoutTechnicals!]) {
        expect(cut).toBeGreaterThan(A_QUARTER)
      }
    },
  },
]

// Assist vocabulary needs its own claim kind over the shot-context payload
// (AssistClaim, worst-case bounds — see the Mitchell guard for the pattern).
// This verdict makes no assist claim, so the tripwire holds it at zero and
// the shot-context payload is deliberately not loaded here.

// Loaded only when every payload is deployed; the suite below skips
// otherwise. (A skipped describe still executes its factory at collection,
// so the loads cannot live at describe scope.)
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
  'verdict guard: Austin Reaves 2025-26 (ADR-0017/0029)',
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
