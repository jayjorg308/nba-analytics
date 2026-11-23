// The committed verdict guard (ADR-0017) for Ace Bailey's 2026-27 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). A LIVING season (ADR-0059): the season loop's full gate runs this
// file before every daily publish, so a claim the data walks away from
// halts the publish until the copy and this mapping are rewritten
// together. Never loosen an assertion to let a publish through.
//
// The first growth-sentence (ADR-0061, 2026-11-23): its claims consume
// both seasons' deployed shot payloads through the growth aggregation and
// assert the movement itself.
//
// Authored at the flip from hero:report through 2026-11-22 (18 games, 213
// attempts). Actuals and margins below are as of that frontier; the thin
// ones are named, since they are the claims most likely to move first.
//
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070), claim by claim:
//   "trades some rim looks for corner threes"                -> claim 1
//   "that tradeoff nets out to an essentially league-average
//    shot diet"                                              -> claim 2
//   "The mid-range habit that defined last season is mostly
//    gone"                                                   -> growth 1
//   "He converts a bit below what that diet should yield"    -> claim 3
//   "the gap comes from beyond the arc"                      -> claim 4
//   "Inside ten feet he finishes well above average"         -> why 1 (creation)
//   "His pull-ups convert above average"                     -> why 2 (creation)
//   "the catch-and-shoot looks that carry most of his threes
//    land far below"                                         -> why 3 (creation)
//   "gets there at well under half the league rate"          -> line 1 (free throw)
//   "the cheapest points available barely factor into his
//    scoring"                                                -> line 2 + pricing
//   ("The problem now is his shot making" is the judgment pivot over
//    claims 2 + 3; "the creation numbers flip the usual script" frames why
//    2 + 3; "the free throw line compounds the problem" frames line 1 + 2.)

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import type { ShotMetrics } from '../domain/aggregate'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { aggregateGrowthMetrics } from '../domain/aggregateGrowth'
import { ZONE_POINT_VALUE } from '../domain/constants'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { aceBailey as hero } from './ace-bailey'
import { authoringProblems } from './authoring'
import { seasonArgumentOf } from './types'
import type { CreationClaim, FreethrowClaim, GrowthClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unbackedGrowthTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import {
  FAR_DIET_LEAN_PP,
  FAR_PPS,
  MATERIAL_PPS,
  NEUTRAL_BAND_PPS,
  STRONG_PPS,
} from './verdictLadder'

// The guarded season argument, selected explicitly (ADR-0060/0061): a flip
// moving the canonical pointer must never silently repoint these claims at
// a different season's data.
const seasonConfig = seasonArgumentOf(hero, '2026-27')
// The prior argued season the growth claims measure from: the hero's
// season argument immediately before this one (ADR-0061), read from the
// registry rather than restated.
const priorSeason = hero.seasons[hero.seasons.indexOf(seasonConfig) - 1]!.season

const deployedPath = (season: string, suffix = '') =>
  path.resolve(process.cwd(), 'public', 'data', hero.slug, `${season}${suffix}.json`)
const payloadPath = deployedPath(seasonConfig.season)
const creationPath = deployedPath(seasonConfig.season, '.creation')
const freethrowPath = deployedPath(seasonConfig.season, '.freethrow')
const priorPayloadPath = deployedPath(priorSeason)

// Verdict semantics, priced from the house ladder (ADR-0068):
// "essentially league-average shot diet": selection inside the neutral band
// (actual −0.016; margin 0.004, the thinnest claim on the page — selection
// sat at −0.020 to −0.038 for most of the season and crossed into the band
// on 11-20).
// "a bit below what that diet should yield": making past the neutral band
// and short of material, two-sided (actual −0.034; margins 0.014 / 0.016 —
// making swung from +0.029 on 11-15 to −0.034 by 11-22).
// "well above average" (inside ten feet): the ladder's strong bar (actual
// +0.213; margin 0.113).
// "above average" (pull-ups): a bare comparative prices at material
// (actual +0.204 on 51 attempts, past the sample bar since 11-20).
// "far below" (catch-and-shoot): the far bar (actual −0.366; margin 0.216).
// "well under half the league rate" / "barely factor into his scoring": at
// most half the league value on BOTH technical cuts (ADR-0055), the 2025-26
// pricing (actual FTA rate 0.37x; FT points share 0.43x, rising from 0.21x
// in early November, the line claim to watch).
const HALF_CEILING = 0.5
// "most of his threes": a strict majority (actual 86 of 106, 81%).
const MOST_SHARE = 0.5
// "mostly gone": last season's mid-range lean has shrunk by more than half
// (actual +12.1 to +1.6 share points, 87% of it gone; margin 4.4 points).
const MOSTLY_GONE = 0.5

// The verdict's directional shot claims (ADR-0017): asserted against the
// shot metrics. Shot claims need no lexicon licensing (two-axis vocabulary
// is always legal), so the type is local.
interface ShotClaim {
  name: string
  assert: (m: ShotMetrics) => void
}

const CORNERS: readonly string[] = ['Left Corner 3', 'Right Corner 3']

const shotClaims: ShotClaim[] = [
  {
    name: 'claim 1: rim looks below the league share, corner threes above, the diet’s two largest leans',
    assert: (m) => {
      for (const z of m.zones) expect(z.attemptShare, z.zone).not.toBeNull()
      const gap = (z: (typeof m.zones)[number]) => z.attemptShare! - z.leagueAttemptShare
      const ra = m.zones.find((z) => z.zone === 'Restricted Area')!
      const cornerGap = m.zones
        .filter((z) => CORNERS.includes(z.zone))
        .reduce((sum, z) => sum + gap(z), 0)
      // "trades some rim looks": below the league share at the rim (actual
      // −6.6 points)...
      expect(gap(ra)).toBeLessThan(0)
      // ..."for corner threes": above it in the two corners combined
      // (actual +9.4 points; left 2.00x, right 1.53x)...
      expect(cornerGap).toBeGreaterThan(0)
      // ...and those are the tradeoff that matters: no other zone leans
      // further either way (next largest: Above the Break −2.7, Mid-Range
      // +1.6).
      for (const z of m.zones.filter((r) => r !== ra && !CORNERS.includes(r.zone))) {
        expect(gap(ra), z.zone).toBeLessThan(gap(z))
        expect(cornerGap, z.zone).toBeGreaterThan(gap(z))
      }
    },
  },
  {
    name: 'claim 2: the diet nets out essentially league average (selection inside the neutral band)',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(Math.abs(m.selection.selectionDelta!)).toBeLessThanOrEqual(NEUTRAL_BAND_PPS)
    },
  },
  {
    name: 'claim 3: making a bit below what the diet should yield (past neutral, short of material)',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.making.makingPpsDelta!).toBeLessThanOrEqual(-NEUTRAL_BAND_PPS)
      expect(m.making.makingPpsDelta!).toBeGreaterThan(-MATERIAL_PPS)
    },
  },
  {
    name: 'claim 4: the gap comes from beyond the arc',
    assert: (m) => {
      // The combined threes read cold at a grain past the small-sample bar
      // (actual −9.0 pp on 106 attempts, cold-1)...
      expect(makingDeltaBin(m.threes.makingDelta)).toBeLessThan(0)
      expect(m.threes.smallSampleMaking).toBe(false)
      // ...and no two-point zone reads below league on the making scale the
      // court shows the reader (actual: rim +3.0, paint +23.2, mid-range
      // +3.8, all warm), the Cody Williams 2025-26 claim's semantics.
      for (const z of m.zones.filter((r) => ZONE_POINT_VALUE[r.zone] === 2)) {
        expect(makingDeltaBin(z.makingDelta), z.zone).toBeGreaterThanOrEqual(0)
      }
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('pull-ups', 'catch-and-shoot').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: inside ten feet well above league value, sample-safe',
    assert: (c) => {
      const inside = c.general.inside
      expect(inside.pps).not.toBeNull()
      expect(inside.smallSamplePps).toBe(false)
      expect(inside.pps! - inside.leaguePps!).toBeGreaterThanOrEqual(STRONG_PPS)
    },
  },
  {
    name: 'why 2: pull-ups convert above league value, sample-safe',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.pps).not.toBeNull()
      expect(pu.smallSamplePps).toBe(false)
      expect(pu.pps! - pu.leaguePps!).toBeGreaterThanOrEqual(MATERIAL_PPS)
    },
  },
  {
    name: 'why 3: catch-and-shoot carries most of his threes and lands far below league value, sample-safe',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      expect(cs.pps).not.toBeNull()
      expect(cs.smallSamplePps).toBe(false)
      expect(cs.leaguePps! - cs.pps!).toBeGreaterThanOrEqual(FAR_PPS)
      expect(c.general.catchAndShootThrees.share).not.toBeNull()
      expect(c.general.catchAndShootThrees.share!).toBeGreaterThan(MOST_SHARE)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion
// holds on BOTH technical cuts. Ratios of season totals, not conversion
// estimates, so the † discipline does not bind them.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: FTA rate at most half the league rate, on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      expect(rate.value!).toBeLessThanOrEqual(rate.league * HALF_CEILING)
      expect(rate.withoutTechnicals!).toBeLessThanOrEqual(rate.league * HALF_CEILING)
    },
  },
  {
    name: 'line 2: FT points share at most half the league share, on both cuts',
    assert: (f) => {
      const share = f.seasonLine.ftPointsShare
      expect(share.value).not.toBeNull()
      expect(share.withoutTechnicals).not.toBeNull()
      expect(share.value!).toBeLessThanOrEqual(share.league * HALF_CEILING)
      expect(share.withoutTechnicals!).toBeLessThanOrEqual(share.league * HALF_CEILING)
    },
  },
]

// The growth-sentence's claims (ADR-0061): movement in the vs-league
// residuals, each season against its own league, asserted as the movement
// itself (never two static anchors a reader must subtract, ADR-0023).
const growthClaims: GrowthClaim[] = [
  {
    name: 'growth 1: the mid-range lean that defined last season has shrunk by more than half',
    assert: (g) => {
      const mid = g.zones.find((z) => z.zone === 'Mid-Range')!
      expect(mid.prior.dietGap).not.toBeNull()
      expect(mid.current.dietGap).not.toBeNull()
      // "the mid-range habit that defined last season": the prior season's
      // largest lean toward any zone, past the far diet-lean bar (actual
      // +12.1 share points; the 2025-26 verdict led with it). Frozen data.
      expect(mid.prior.dietGap!).toBeGreaterThanOrEqual(FAR_DIET_LEAN_PP)
      for (const z of g.zones) {
        expect(mid.prior.dietGap!, z.zone).toBeGreaterThanOrEqual(z.prior.dietGap!)
      }
      // "is mostly gone": the movement takes away more than half of it.
      expect(mid.prior.dietGap! - mid.current.dietGap!).toBeGreaterThanOrEqual(
        mid.prior.dietGap! * MOSTLY_GONE,
      )
    },
  },
]

// Loaded only when every payload is deployed; the suite below skips
// otherwise. (A skipped describe still executes its factory at collection,
// so the loads cannot live at describe scope.)
function loadMetrics() {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  const prior = parseDerivedPayload(JSON.parse(readFileSync(priorPayloadPath, 'utf-8')))
  const shot = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
  return {
    shot,
    creation: aggregateCreationMetrics(
      parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),
    ),
    freethrow: aggregateFreethrowMetrics(
      parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),
    ),
    growth: aggregateGrowthMetrics(
      {
        season: priorSeason,
        player: prior._meta.player,
        metrics: aggregateShotMetrics(prior.shots, prior.zoneBaseline),
      },
      { season: seasonConfig.season, player: payload._meta.player, metrics: shot },
    ),
  }
}
const deployed = [payloadPath, creationPath, freethrowPath, priorPayloadPath].every((p) =>
  existsSync(p),
)
const metrics = deployed ? loadMetrics() : null

describe.skipIf(metrics === null)('verdict guard: Ace Bailey 2026-27 (ADR-0017/0029/0061)', () => {
  for (const claim of shotClaims) {
    it(claim.name, () => claim.assert(metrics!.shot))
  }

  for (const claim of creationClaims) {
    it(claim.name, () => claim.assert(metrics!.creation))
  }

  for (const claim of freethrowClaims) {
    it(claim.name, () => claim.assert(metrics!.freethrow))
  }

  for (const claim of growthClaims) {
    it(claim.name, () => claim.assert(metrics!.growth))
  }

  it('line pricing: a league two-shot trip outprices every zone on the floor', () => {
    // "the cheapest points available" is the buyer's phrasing of the
    // line-vs-floor pricing (ADR-0055/0056), each side from its own
    // aggregation (ADR-0011).
    const leagueTwoShotTrip = 2 * metrics!.freethrow.seasonLine.conversion.league
    for (const z of metrics!.shot.zones) {
      expect(leagueTwoShotTrip, z.zone).toBeGreaterThan(z.leaguePps)
    }
  })

  it('vocabulary is claim-backed; unshipped vocabulary absent (ADR-0029/0061)', () => {
    expect(unshippedTermsIn(seasonConfig.verdict)).toEqual([])
    expect(unbackedCreationTerms(seasonConfig.verdict, creationClaims.length)).toEqual([])
    expect(unbackedFreethrowTerms(seasonConfig.verdict, freethrowClaims.length)).toEqual([])
    expect(unbackedGrowthTerms(seasonConfig.verdict, growthClaims.length)).toEqual([])
    expect(unbackedAssistTerms(seasonConfig.verdict, 0)).toEqual([])
    expect(invalidAssistInterpretationsIn(seasonConfig.verdict)).toEqual([])
  })
})

// The authoring tripwire (ADR-0063): deliberately OUTSIDE the payload
// skipIf — no data needed, so it holds on clean clones and CI alike.
describe('authoring completeness (ADR-0063)', () => {
  it('no scaffold sentinel remains and referenced banner assets exist', () => {
    expect(authoringProblems(hero, seasonConfig)).toEqual([])
  })
})
