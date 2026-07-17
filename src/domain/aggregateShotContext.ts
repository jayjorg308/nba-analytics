// Pure shot-context aggregation (ADR-0049). The UI formats this output; it
// never joins sibling payloads or recomputes coverage/share/bounds itself.

import { EVAL_ZONES, MID_RANGE_BANDS, ZONE_POINT_VALUE } from './constants'
import type { EvalZone, MidRangeBand } from './constants'
import type { DerivedPayload, EnrichedShot } from './payload'
import type { AssistStatus, ShotContext, ShotContextPayload } from './shotContextPayload'

export interface AssistMetricsRow {
  attempts: number
  makes: number
  assistedMakes: number
  unassistedMakes: number
  unknownMakes: number
  classifiedMakes: number
  /** Share among classified makes only. */
  assistedShare: number | null
  /** Classified makes / all makes. */
  coverage: number | null
  /** Conservative assisted-share bounds over all makes. */
  minAssistedShare: number | null
  maxAssistedShare: number | null
}

export interface AssistZoneMetricsRow extends AssistMetricsRow {
  zone: EvalZone
}

export interface AssistBandMetricsRow extends AssistMetricsRow {
  band: MidRangeBand
}

export interface ShotContextMetrics {
  all: AssistMetricsRow
  threes: AssistMetricsRow
  zones: AssistZoneMetricsRow[]
  midRangeBands: AssistBandMetricsRow[]
  assistStatusByShotKey: ReadonlyMap<string, AssistStatus>
}

type ShotIdentity = Pick<EnrichedShot, 'gameId' | 'gameEventId'>

export function shotIdentity(shot: ShotIdentity): string {
  return `${shot.gameId}:${shot.gameEventId}`
}

function aggregateRows(
  shots: EnrichedShot[],
  contexts: ReadonlyMap<string, ShotContext>,
): AssistMetricsRow {
  let makes = 0
  let assistedMakes = 0
  let unassistedMakes = 0
  let unknownMakes = 0

  for (const shot of shots) {
    const context = contexts.get(shotIdentity(shot))!
    if (!shot.made) {
      if (context.assistStatus !== 'notApplicable') {
        throw new Error(`miss ${shotIdentity(shot)} must have notApplicable assist status`)
      }
      continue
    }
    makes += 1
    if (context.assistStatus === 'assisted') assistedMakes += 1
    else if (context.assistStatus === 'unassisted') unassistedMakes += 1
    else if (context.assistStatus === 'unknown') unknownMakes += 1
    else throw new Error(`made shot ${shotIdentity(shot)} cannot have notApplicable assist status`)
  }

  const classifiedMakes = assistedMakes + unassistedMakes
  return {
    attempts: shots.length,
    makes,
    assistedMakes,
    unassistedMakes,
    unknownMakes,
    classifiedMakes,
    assistedShare: classifiedMakes > 0 ? assistedMakes / classifiedMakes : null,
    coverage: makes > 0 ? classifiedMakes / makes : null,
    minAssistedShare: makes > 0 ? assistedMakes / makes : null,
    maxAssistedShare: makes > 0 ? (assistedMakes + unknownMakes) / makes : null,
  }
}

export function aggregateShotContextMetrics(
  shotPayload: DerivedPayload,
  contextPayload: ShotContextPayload,
): ShotContextMetrics {
  if (
    shotPayload._meta.player !== contextPayload._meta.player ||
    shotPayload._meta.playerId !== contextPayload._meta.playerId ||
    shotPayload._meta.season !== contextPayload._meta.season
  ) {
    throw new Error('shot-context sibling player/season identity disagrees')
  }

  const shotKeys = shotPayload.shots.map(shotIdentity)
  const contextKeys = contextPayload.shots.map(shotIdentity)
  const shotKeySet = new Set(shotKeys)
  const contextKeySet = new Set(contextKeys)
  if (
    shotKeys.length !== contextKeys.length ||
    shotKeySet.size !== shotKeys.length ||
    contextKeySet.size !== contextKeys.length ||
    shotKeys.some((key) => !contextKeySet.has(key))
  ) {
    throw new Error('shot and shot-context payload shot identities disagree')
  }

  const loadedGameIds = new Set(
    contextPayload.shots
      .filter((row) => row.eventMatch !== 'missingGame')
      .map((row) => row.gameId),
  )
  const sourceGameIds = new Set(contextPayload._meta.sourceGames.map((game) => game.gameId))
  if (
    loadedGameIds.size !== sourceGameIds.size ||
    [...loadedGameIds].some((gameId) => !sourceGameIds.has(gameId))
  ) {
    throw new Error('shot-context source-game provenance disagrees with loaded shot games')
  }

  const contexts = new Map(contextPayload.shots.map((row) => [shotIdentity(row), row]))
  const assistStatusByShotKey = new Map(
    contextPayload.shots.map((row) => [shotIdentity(row), row.assistStatus]),
  )
  const zones = EVAL_ZONES.map((zone) => ({
    zone,
    ...aggregateRows(
      shotPayload.shots.filter((shot) => shot.zoneBasic === zone),
      contexts,
    ),
  }))
  const midRangeBands = MID_RANGE_BANDS.map((band) => ({
    band,
    ...aggregateRows(
      shotPayload.shots.filter(
        (shot) => shot.zoneBasic === 'Mid-Range' && shot.zoneRange === band,
      ),
      contexts,
    ),
  }))
  const threesShots = shotPayload.shots.filter(
    (shot) => shot.zoneBasic !== 'Backcourt' && ZONE_POINT_VALUE[shot.zoneBasic] === 3,
  )

  return {
    all: aggregateRows(shotPayload.shots, contexts),
    threes: aggregateRows(threesShots, contexts),
    zones,
    midRangeBands,
    assistStatusByShotKey,
  }
}
