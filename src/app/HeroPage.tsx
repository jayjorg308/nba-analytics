import { useEffect, useMemo, type CSSProperties } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { CreationValueChart } from '../chart/CreationValueChart'
import { GrowthDietChart } from '../chart/GrowthDietChart'
import { LineVsFloorChart, type FloorReference } from '../chart/LineVsFloorChart'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { aggregateGrowthMetrics, type GrowthMetrics } from '../domain/aggregateGrowth'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import type { CreationPayload } from '../domain/creationPayload'
import type { FreethrowPayload } from '../domain/freethrowPayload'
import type { DerivedPayload } from '../domain/payload'
import type { ShotContextPayload } from '../domain/shotContextPayload'
import { formatDataThrough } from '../format'
import type { HeroConfig, HeroSeasonConfig } from '../heroes/types'
import {
  creationPayloadUrl,
  freethrowPayloadUrl,
  heroImageUrl,
  heroPageUrl,
  indexUrl,
  payloadUrl,
  seasonPageUrl,
  shotContextPayloadUrl,
  teamLogoUrl,
} from '../heroes/urls'
import { AssistedMakes } from './AssistedMakes'
import { CreationTable } from './CreationTable'
import { FreethrowSeasonLine, FreethrowTable } from './FreethrowTable'
import { GrowthSpineLine, GrowthTable } from './GrowthTable'
import { HeadlineBanner } from './HeadlineBanner'
import { Term } from './Term'
import {
  useCreationPayload,
  useFreethrowPayload,
  useOptionalShotPayload,
  usePayload,
  useShotContextPayload,
} from './usePayload'
import { ZoneTable } from './ZoneTable'

export function HeroPage({
  hero,
  seasonConfig,
}: {
  hero: HeroConfig
  seasonConfig: HeroSeasonConfig
}) {
  // The page renders one season argument (ADR-0060) — the canonical season
  // behind /<slug>, or a specific one behind its /<slug>/<season> permalink.
  const state = usePayload(payloadUrl(hero, seasonConfig.season))
  // The sibling payloads (ADRs 0030/0032/0053): all required per hero — one
  // class of hero page, so the page waits for all four.
  const creationState = useCreationPayload(creationPayloadUrl(hero, seasonConfig.season))
  const contextState = useShotContextPayload(shotContextPayloadUrl(hero, seasonConfig.season))
  const freethrowState = useFreethrowPayload(freethrowPayloadUrl(hero, seasonConfig.season))
  // The growth coda's existence gate (ADR-0061): the rendered season is the
  // canonical one AND a prior argued season exists. Only the prior SHOT
  // payload is fetched — the coda's scope (two-axis + zones) needs nothing
  // else; the prior season's full four still deploy for its own page.
  const canonicalIdx = hero.seasons.findIndex((s) => s.season === hero.canonicalSeason)
  const priorSeasonConfig =
    seasonConfig.season === hero.canonicalSeason && canonicalIdx > 0
      ? hero.seasons[canonicalIdx - 1]!
      : null
  const priorState = useOptionalShotPayload(
    priorSeasonConfig === null ? null : payloadUrl(hero, priorSeasonConfig.season),
  )

  useEffect(() => {
    document.title = `${hero.playerName} · ${seasonConfig.season} · shot selection`
  }, [hero, seasonConfig])

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
  if (priorState.status === 'error') {
    return <PageError message={priorState.message} />
  }
  if (
    state.status === 'loading' ||
    creationState.status === 'loading' ||
    contextState.status === 'loading' ||
    freethrowState.status === 'loading' ||
    priorState.status === 'loading'
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
      seasonConfig={seasonConfig}
      payload={state.payload}
      creation={creationState.payload}
      context={contextState.payload}
      freethrow={freethrowState.payload}
      prior={
        priorSeasonConfig !== null && priorState.status === 'ready'
          ? { seasonConfig: priorSeasonConfig, payload: priorState.payload }
          : null
      }
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
  seasonConfig,
  payload,
  creation,
  context,
  freethrow,
  prior,
}: {
  hero: HeroConfig
  seasonConfig: HeroSeasonConfig
  payload: DerivedPayload
  creation: CreationPayload
  context: ShotContextPayload
  freethrow: FreethrowPayload
  /** The prior argued season behind the growth coda (ADR-0061); null when
   * the rendered season is not canonical or has no prior argument. */
  prior: { seasonConfig: HeroSeasonConfig; payload: DerivedPayload } | null
}) {
  // The single production call site for all five aggregations. Cross-sibling
  // identity/provenance failures happen here, after each Zod boundary; keep
  // them inside the same plain page-error contract as load failures.
  const computed = useMemo(() => {
    try {
      const metrics = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
      let growthMetrics: GrowthMetrics | null = null
      if (prior !== null) {
        // Read-time drift check (the hero:report pattern): the fetched file
        // must be the season the registry names.
        if (prior.payload._meta.season !== prior.seasonConfig.season) {
          throw new Error(
            `prior season payload is ${prior.payload._meta.season}, ` +
              `expected ${prior.seasonConfig.season}`,
          )
        }
        growthMetrics = aggregateGrowthMetrics(
          {
            season: prior.seasonConfig.season,
            player: prior.payload._meta.player,
            metrics: aggregateShotMetrics(prior.payload.shots, prior.payload.zoneBaseline),
          },
          { season: seasonConfig.season, player: payload._meta.player, metrics },
        )
      }
      return {
        status: 'ready' as const,
        metrics,
        creationMetrics: aggregateCreationMetrics(creation),
        contextMetrics: aggregateShotContextMetrics(payload, context),
        freethrowMetrics: aggregateFreethrowMetrics(freethrow),
        growthMetrics,
      }
    } catch (error) {
      return {
        status: 'error' as const,
        message: `Payloads contradict: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }, [payload, creation, context, freethrow, prior, seasonConfig])
  if (computed.status === 'error') return <PageError message={computed.message} />
  const { metrics, creationMetrics, contextMetrics, freethrowMetrics, growthMetrics } = computed
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
            <p className="hero-kicker">{seasonConfig.kicker}</p>
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
        <p className="hero-verdict">{seasonConfig.verdict}</p>
        {/* The byline carries the reconciled frontier (ADR-0058/0059):
            structural copy, one form for completed and living seasons, so
            the verdict always reads as a statement about the season through
            the stated date. */}
        <p className="hero-byline">
          {payload._meta.player} · {payload._meta.season} ·{' '}
          {formatDataThrough(payload._meta.dataThrough, payload._meta.gamesIncluded)} · vs
          league average
        </p>
        {seasonConfig.season !== hero.canonicalSeason && (
          // The structural forward link (ADR-0060): a prior season argument
          // points at the hero's current one. The season labels above carry
          // the temporal frame — this is navigation, never a hedge on the
          // frozen verdict.
          <p className="hero-forward">
            <a href={heroPageUrl(hero)}>His {hero.canonicalSeason} season →</a>
          </p>
        )}
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
      {/* The growth coda (ADR-0061/0062): the page's one cross-season
          surface, deliberately OUTSIDE the numbered acts — the act kickers
          name cuts of ONE reconciled season (ADR-0051), so the coda opens
          with the shared header recipe minus the act number. Present iff the
          rendered season is canonical with a prior argued season; structural
          copy only — authored growth language lives in the verdict, backed
          by growth claims. */}
      {growthMetrics !== null && (
        <section className="growth-section" aria-labelledby="growth-caption">
          <header className="section-caption">
            <h2 id="growth-caption">SEASON OVER SEASON</h2>
            <p className="section-caption-desc">
              his {growthMetrics.currentSeason} against his{' '}
              <a href={seasonPageUrl(hero, growthMetrics.priorSeason)}>
                {growthMetrics.priorSeason}
              </a>
              , each season measured against its own league
            </p>
          </header>
          <div className="section-layout">
            {/* Visual left, data twin right (ADR-0051): the diet dumbbell —
                the stable axis — over the two-axis spine movement as the
                stat coda (THE LINE's register, ADR-0056/0062). */}
            <div className="growth-visual">
              <GrowthDietChart metrics={growthMetrics} />
              <GrowthSpineLine metrics={growthMetrics} />
            </div>
            <GrowthTable metrics={growthMetrics} />
          </div>
        </section>
      )}
      {/* The quiet way back to the directory (ADR-0022) — after the argument,
          never above it; cross-hero navigation is links between pages, not a
          switcher on this one. */}
      <footer className="hero-footer">
        <a href={indexUrl()}>← All players</a>
      </footer>
    </main>
  )
}
