import { useEffect, useMemo, type CSSProperties } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { CreationValueChart } from '../chart/CreationValueChart'
import { LineVsFloorChart, type FloorReference } from '../chart/LineVsFloorChart'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import type { CreationPayload } from '../domain/creationPayload'
import type { FreethrowPayload } from '../domain/freethrowPayload'
import type { DerivedPayload } from '../domain/payload'
import type { ShotContextPayload } from '../domain/shotContextPayload'
import { formatDataThrough } from '../format'
import type { HeroConfig } from '../heroes/types'
import {
  creationPayloadUrl,
  freethrowPayloadUrl,
  heroImageUrl,
  indexUrl,
  payloadUrl,
  shotContextPayloadUrl,
  teamLogoUrl,
} from '../heroes/urls'
import { AssistedMakes } from './AssistedMakes'
import { CreationTable } from './CreationTable'
import { FreethrowSeasonLine, FreethrowTable } from './FreethrowTable'
import { HeadlineBanner } from './HeadlineBanner'
import { Term } from './Term'
import {
  useCreationPayload,
  useFreethrowPayload,
  usePayload,
  useShotContextPayload,
} from './usePayload'
import { ZoneTable } from './ZoneTable'

export function HeroPage({ hero }: { hero: HeroConfig }) {
  const state = usePayload(payloadUrl(hero))
  // The sibling payloads (ADRs 0030/0032/0053): all required per hero — one
  // class of hero page, so the page waits for all four.
  const creationState = useCreationPayload(creationPayloadUrl(hero))
  const contextState = useShotContextPayload(shotContextPayloadUrl(hero))
  const freethrowState = useFreethrowPayload(freethrowPayloadUrl(hero))

  useEffect(() => {
    document.title = `${hero.playerName} · ${hero.season} · shot selection`
  }, [hero])

  // Contract violations and load failures are shown plainly, never styled
  // away — any payload's failure fails the page (one class of hero page).
  if (state.status === 'error') {
    return <PageError message={state.message} />
  }
  if (creationState.status === 'error') {
    return <PageError message={creationState.message} />
  }
  if (contextState.status === 'error') {
    return <PageError message={contextState.message} />
  }
  if (freethrowState.status === 'error') {
    return <PageError message={freethrowState.message} />
  }
  if (
    state.status === 'loading' ||
    creationState.status === 'loading' ||
    contextState.status === 'loading' ||
    freethrowState.status === 'loading'
  ) {
    return (
      <main className="hero-page">
        <p className="page-status">Loading shot data…</p>
      </main>
    )
  }
  return (
    <HeroReady
      hero={hero}
      payload={state.payload}
      creation={creationState.payload}
      context={contextState.payload}
      freethrow={freethrowState.payload}
    />
  )
}

function PageError({ message }: { message: string }) {
  return (
    <main className="hero-page">
      <p className="page-status page-error">{message}</p>
    </main>
  )
}

function HeroReady({
  hero,
  payload,
  creation,
  context,
  freethrow,
}: {
  hero: HeroConfig
  payload: DerivedPayload
  creation: CreationPayload
  context: ShotContextPayload
  freethrow: FreethrowPayload
}) {
  // The single production call site for all four aggregations. Cross-sibling
  // identity/provenance failures happen here, after each Zod boundary; keep
  // them inside the same plain page-error contract as load failures.
  const computed = useMemo(() => {
    try {
      return {
        status: 'ready' as const,
        metrics: aggregateShotMetrics(payload.shots, payload.zoneBaseline),
        creationMetrics: aggregateCreationMetrics(creation),
        contextMetrics: aggregateShotContextMetrics(payload, context),
        freethrowMetrics: aggregateFreethrowMetrics(freethrow),
      }
    } catch (error) {
      return {
        status: 'error' as const,
        message: `Payloads contradict: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }, [payload, creation, context, freethrow])
  if (computed.status === 'error') return <PageError message={computed.message} />
  const { metrics, creationMetrics, contextMetrics, freethrowMetrics } = computed
  const logoUrl = teamLogoUrl(hero)
  // The line-vs-floor chart's reference ticks (ADR-0056): the league's PPS
  // from the floor's canonical bands — rim, three, mid — read off the shot
  // aggregation. A mapping over existing outputs, not a computation
  // (ADR-0011); the chart formats both aggregations' values side by side.
  const floorReferences: FloorReference[] = metrics.zones
    .filter((zone) =>
      ['Restricted Area', 'Above the Break 3', 'Mid-Range'].includes(zone.zone),
    )
    .map((zone) => ({ label: zone.zone, pps: zone.leaguePps }))

  return (
    <main className="hero-page">
      {/* The poster banner carries the h1 — question first (ADR-0018),
          just at hero scale. */}
      <header className="hero-banner">
        <img
          className="hero-banner-photo"
          src={heroImageUrl(hero)}
          alt={hero.hero.imageAlt}
          // Focal points as custom properties so the stylesheet can pick per
          // layout (inline object-position would defeat the media query).
          style={
            {
              '--hero-pos': hero.hero.imagePosition,
              '--hero-pos-wide': hero.hero.imagePositionWide,
            } as CSSProperties
          }
          fetchPriority="high"
        />
        {logoUrl && (
          // Decorative team mark: the stylesheet ghosts it into the wide
          // layout's dark left column and hides it on the narrow poster.
          <img className="hero-banner-logo" src={logoUrl} alt="" aria-hidden="true" />
        )}
        <div className="hero-banner-overlay">
          {/* Kicker + title flex as one block so the cue can sit outside it,
              pinned to the banner's bottom edge in both layouts — it is a
              scroll affordance, not part of the title. */}
          <div className="hero-banner-text">
            <p className="hero-kicker">{hero.hero.kicker}</p>
            <h1 className="hero-title">{hero.thesis}</h1>
          </div>
          <p className="hero-cue" aria-hidden="true">
            ↓ The verdict
          </p>
        </div>
      </header>
      <header className="hero-header">
        {/* The answer before the evidence (ADR-0017) — authored hero copy,
            kept honest by the colocated verdict guard. */}
        <p className="hero-verdict">{hero.verdict}</p>
        {/* The byline carries the reconciled frontier (ADR-0058/0059):
            structural copy, one form for completed and living seasons, so
            the verdict always reads as a statement about the season through
            the stated date. */}
        <p className="hero-byline">
          {payload._meta.player} · {payload._meta.season} ·{' '}
          {formatDataThrough(payload._meta.dataThrough, payload._meta.gamesIncluded)} · vs
          league average
        </p>
      </header>
      <HeadlineBanner selection={metrics.selection} making={metrics.making} />
      {/* The first act: the two-axis evidence, opened by the same full-width
          section header as the acts that follow (ADR-0051). The header spans
          both columns, so the zone table names itself via aria-label. */}
      <section className="zone-section" aria-labelledby="zone-caption">
        <header className="section-caption">
          {/* Act kickers name each act's CUT of the same reconciled shots —
              place, manner, credit (ADR-0051 amendment). Dimension words
              only, never rhetoric: the argumentative payoff lives in each
              description (the creation act's "why his conversion lands
              where it does", ADR-0031). Structural, direction-free copy —
              never a per-hero claim, so no verdict-guard obligations and
              no change on a hero swap. */}
          <p className="section-kicker">01 · THE WHERE</p>
          <h2 id="zone-caption">ZONE BY ZONE</h2>
          <p className="section-caption-desc">
            {/* nbsp: the unit phrase wraps as one — never a stranded "points)"
                as the whole second line. The jargon-bearing words are dictionary
                terms (ADR-0052), each wrapped at its FIRST prose mention only —
                "shot diet" was already defined in the headline subtitle above. */}
            shot diet and <Term id="shot-making">shot making</Term>, vs league average (
            <Term id="making-delta">making Δ</Term> in FG percentage&nbsp;points)
          </p>
        </header>
        <div className="section-layout">
          <ChartPanel
            shots={payload.shots}
            zones={metrics.zones}
            assistStatusByShotKey={contextMetrics.assistStatusByShotKey}
            ariaLabel={`Half-court shot chart: ${metrics.totalAttempts} shots by ${payload._meta.player}, ${payload._meta.season}`}
          />
          <ZoneTable metrics={metrics} zoneConflictsDropped={payload._meta.zoneConflictsDropped} />
        </div>
      </section>
      {/* The second act (ADR-0031): creation evidence backs the verdict's
          why AFTER the court and table back the two-axis thesis — the
          evidence unfolds in the order the verdict argues (ADR-0018). The
          section's job is the WHY behind the making verdict: what each kind
          of shot is worth (the diet cut largely restates the zone story and
          stays table-only). */}
      <section className="creation-section" aria-labelledby="creation-caption">
        <header className="section-caption">
          <p className="section-kicker">02 · THE HOW</p>
          <h2 id="creation-caption">SHOT CREATION</h2>
          <p className="section-caption-desc">
            why his conversion lands where it does: <Term id="pps">points per shot</Term> by
            creation context, vs league average
          </p>
        </header>
        <div className="section-layout">
          <CreationValueChart metrics={creationMetrics} />
          <CreationTable metrics={creationMetrics} />
        </div>
        <AssistedMakes
          metrics={contextMetrics}
          showMidRangeBands={metrics.midRangeSplit.visible}
        />
      </section>
      {/* The fourth act (ADR-0056): the scoring the shot chart cannot see.
          Trips are a different universe from the shots (most have no shot),
          so the line gets its own act rather than a berth inside SHOT
          CREATION — ADR-0042's own logic. The kicker names the cut and the
          place; the chart prices a trip against the floor; generation is a
          two-number story and lives in the description and the table. */}
      <section className="freethrow-section" aria-labelledby="freethrow-caption">
        <header className="section-caption">
          <p className="section-kicker">04 · THE LINE</p>
          <h2 id="freethrow-caption">FREE THROWS</h2>
          <p className="section-caption-desc">
            the points his fouls created: what a <Term id="trip">trip</Term> to the line is
            worth, priced against the&nbsp;floor
          </p>
        </header>
        <div className="section-layout">
          {/* Visual left, data twin right, both from the top edge (the
              register every act holds). The season line is the visual
              column's stat coda — the generation story under the value
              story, never a preamble that pushes the table down. */}
          <div className="freethrow-visual">
            <LineVsFloorChart metrics={freethrowMetrics} floorReferences={floorReferences} />
            <FreethrowSeasonLine metrics={freethrowMetrics} />
          </div>
          <FreethrowTable metrics={freethrowMetrics} />
        </div>
      </section>
      {/* The quiet way back to the directory (ADR-0022) — after the argument,
          never above it; cross-hero navigation is links between pages, not a
          switcher on this one. */}
      <footer className="hero-footer">
        <a href={indexUrl()}>← All players</a>
      </footer>
    </main>
  )
}
