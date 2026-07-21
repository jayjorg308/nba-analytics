// The fourth typed contract (ADR-0053): free-throw trips at trip grain,
// reconstructed from the shared Case 3 game corpus and reconciled against
// its oracles (taxonomy totality, per-game box-score lines, the Gate 5
// season-total artifact — ADR-0054) before anything is persisted. Metric-free
// per the house rule; aggregateFreeThrowMetrics computes every product number.

import { z } from 'zod'

export const FREETHROW_SCHEMA_VERSION = 1

export const TRIP_CLASSES = [
  'shootingFoul2',
  'shootingFoul3',
  'bonus',
  'andOne',
  'flagrant',
  'awayFromPlay',
  'transitionTake',
  'clearPath',
] as const
export type TripClass = (typeof TRIP_CLASSES)[number]

/** The two-tier cleavage (ADR-0053): attempt-equivalent trips end the
 * possession in place of a field-goal attempt; every other class adds points
 * while the counted attempt or retained possession stands. The tier is what a
 * future scoring-attempt model adds to the denominator alongside FGA. */
export const ATTEMPT_EQUIVALENT_CLASSES = [
  'shootingFoul2',
  'shootingFoul3',
  'bonus',
] as const satisfies readonly TripClass[]

/** Free throws awarded per class — exact bounds, because the derive
 * hard-fails on partial trip sequences rather than absorbing them. Flagrant
 * is the one variable-size class (1–3 by where and how the foul occurred). */
const FTA_BY_CLASS: Record<TripClass, readonly [number, number]> = {
  shootingFoul2: [2, 2],
  shootingFoul3: [3, 3],
  bonus: [2, 2],
  andOne: [1, 1],
  flagrant: [1, 3],
  awayFromPlay: [1, 1],
  transitionTake: [1, 1],
  clearPath: [2, 2],
}

const countShape = <T extends readonly [string, ...string[]]>(values: T) =>
  z.strictObject(Object.fromEntries(values.map((value) => [value, z.number().int().min(0)])))

const tripSchema = z
  .strictObject({
    gameId: z.string().min(1),
    period: z.number().int().min(1),
    clock: z.string().regex(/^PT\d{2}M\d{2}(\.\d{1,2})?S$/),
    tripClass: z.enum(TRIP_CLASSES),
    ftm: z.number().int().min(0),
    fta: z.number().int().min(1),
    shotId: z.number().int().nullable(),
  })
  .superRefine((trip, ctx) => {
    const [min, max] = FTA_BY_CLASS[trip.tripClass]
    if (trip.fta < min || trip.fta > max) {
      ctx.addIssue({ code: 'custom', message: `${trip.tripClass} trip fta must be in [${min}, ${max}]` })
    }
    if (trip.ftm > trip.fta) {
      ctx.addIssue({ code: 'custom', message: 'trip ftm exceeds fta' })
    }
    if ((trip.tripClass === 'andOne') !== (trip.shotId !== null)) {
      ctx.addIssue({ code: 'custom', message: 'shotId is present iff the trip is an and-one' })
    }
  })

export const freethrowPayloadSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(FREETHROW_SCHEMA_VERSION),
      player: z.string().min(1),
      playerId: z.number().int().positive(),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      sourceShotPayload: z.string().min(1),
      sourceLeagueTotals: z.string().min(1),
      leagueTotalsPullDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      // Pre-drop season FGA (ADR-0055's FTA-rate denominator), copied from the
      // sibling shot payload and cross-checked against the league artifact's
      // hero FGA at derive time — external totals know nothing of our drops.
      seasonFga: z.number().int().min(0),
      seasonPoints: z.number().int().min(0),
      seasonFtm: z.number().int().min(0),
      seasonFta: z.number().int().min(0),
      technicalFtm: z.number().int().min(0),
      technicalFta: z.number().int().min(0),
      totalTrips: z.number().int().min(0),
      tripClassCounts: countShape(TRIP_CLASSES),
      gamesExpected: z.number().int().min(0),
      gamesLoaded: z.number().int().min(0),
      sourceGames: z.array(
        z.strictObject({
          gameId: z.string().min(1),
          playByPlayPullDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          boxScorePullDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ),
    }),
    trips: z.array(tripSchema),
    leagueBaseline: z
      .strictObject({
        ftm: z.number().int().min(0),
        fta: z.number().int().positive(),
        fga: z.number().int().positive(),
        points: z.number().int().positive(),
      })
      .superRefine((baseline, ctx) => {
        if (baseline.ftm > baseline.fta) {
          ctx.addIssue({ code: 'custom', message: 'league baseline ftm exceeds fta' })
        }
        if (baseline.ftm > baseline.points) {
          ctx.addIssue({ code: 'custom', message: 'league baseline ftm exceeds points' })
        }
      }),
  })
  .superRefine((payload, ctx) => {
    if (payload._meta.totalTrips !== payload.trips.length) {
      ctx.addIssue({ code: 'custom', message: '_meta.totalTrips must equal trips.length' })
    }
    for (const tripClass of TRIP_CLASSES) {
      const actual = payload.trips.filter((trip) => trip.tripClass === tripClass).length
      if (payload._meta.tripClassCounts[tripClass] !== actual) {
        ctx.addIssue({ code: 'custom', message: `tripClassCounts.${tripClass} disagrees with rows` })
      }
    }
    const tripFtm = payload.trips.reduce((sum, trip) => sum + trip.ftm, 0)
    const tripFta = payload.trips.reduce((sum, trip) => sum + trip.fta, 0)
    if (payload._meta.seasonFtm !== tripFtm + payload._meta.technicalFtm) {
      ctx.addIssue({ code: 'custom', message: 'seasonFtm must equal trip ftm plus technicals' })
    }
    if (payload._meta.seasonFta !== tripFta + payload._meta.technicalFta) {
      ctx.addIssue({ code: 'custom', message: 'seasonFta must equal trip fta plus technicals' })
    }
    if (payload._meta.technicalFtm > payload._meta.technicalFta) {
      ctx.addIssue({ code: 'custom', message: 'technicalFtm exceeds technicalFta' })
    }
    if (payload._meta.seasonFtm > payload._meta.seasonPoints) {
      ctx.addIssue({ code: 'custom', message: 'seasonFtm exceeds seasonPoints' })
    }
    const identities = payload.trips.map((trip) => `${trip.gameId}:${trip.period}:${trip.clock}`)
    if (new Set(identities).size !== identities.length) {
      ctx.addIssue({ code: 'custom', message: 'trip identities must be unique' })
    }
    const sourceGameIds = payload._meta.sourceGames.map((game) => game.gameId)
    if (new Set(sourceGameIds).size !== sourceGameIds.length) {
      ctx.addIssue({ code: 'custom', message: 'source game identities must be unique' })
    }
    for (const sourceGame of payload._meta.sourceGames) {
      if (sourceGame.playByPlayPullDate !== sourceGame.boxScorePullDate) {
        ctx.addIssue({ code: 'custom', message: `game ${sourceGame.gameId} source pull dates disagree` })
      }
    }
    if (payload._meta.gamesLoaded !== sourceGameIds.length) {
      ctx.addIssue({ code: 'custom', message: 'gamesLoaded disagrees with sourceGames' })
    }
    if (payload._meta.gamesLoaded > payload._meta.gamesExpected) {
      ctx.addIssue({ code: 'custom', message: 'gamesLoaded exceeds gamesExpected' })
    }
    for (const trip of payload.trips) {
      if (!sourceGameIds.includes(trip.gameId)) {
        ctx.addIssue({ code: 'custom', message: `trip game ${trip.gameId} missing from sourceGames` })
      }
    }
  })

export type FreethrowTrip = z.infer<typeof tripSchema>
export type FreethrowPayload = z.infer<typeof freethrowPayloadSchema>

export function parseFreethrowPayload(json: unknown): FreethrowPayload {
  return freethrowPayloadSchema.parse(json)
}
