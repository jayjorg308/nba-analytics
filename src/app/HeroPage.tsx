import { useEffect, useMemo, type CSSProperties } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { CreationDietChart } from '../chart/CreationDietChart'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import type { CreationPayload } from '../domain/creationPayload'
import type { DerivedPayload } from '../domain/payload'
import type { HeroConfig } from '../heroes/types'
import { creationPayloadUrl, heroImageUrl, payloadUrl, teamLogoUrl } from '../heroes/urls'
import { CreationTable } from './CreationTable'
import { HeadlineBanner } from './HeadlineBanner'
import { useCreationPayload, usePayload } from './usePayload'
import { ZoneTable } from './ZoneTable'

export function HeroPage({ hero }: { hero: HeroConfig }) {
  const state = usePayload(payloadUrl(hero))
  // The sibling creation payload (ADR-0030): required per hero — one class
  // of hero page, so the page waits for both and surfaces either failure.
  const creationState = useCreationPayload(creationPayloadUrl(hero))

  useEffect(() => {
    document.title = `${hero.playerName} · ${hero.season} · shot selection`
  }, [hero])

  // Contract violations and load failures are shown plainly, never styled
  // away — either payload's failure fails the page (one class of hero page).
  if (state.status === 'error') {
    return <PageError message={state.message} />
  }
  if (creationState.status === 'error') {
    return <PageError message={creationState.message} />
  }
  if (state.status === 'loading' || creationState.status === 'loading') {
    return (
      <main className="hero-page">
        <p className="page-status">Loading shot data…</p>
      </main>
    )
  }
  return <HeroReady hero={hero} payload={state.payload} creation={creationState.payload} />
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
}: {
  hero: HeroConfig
  payload: DerivedPayload
  creation: CreationPayload
}) {
  // THE single production call site of the aggregation (ADR-0007/0009).
  // Everything below receives slices of `metrics` and only formats — nothing
  // in the UI recomputes a rate, share, or PPS.
  const metrics = useMemo(
    () => aggregateShotMetrics(payload.shots, payload.zoneBaseline),
    [payload],
  )
  // ...and the single production call site of its creation sibling (ADR-0030).
  const creationMetrics = useMemo(() => aggregateCreationMetrics(creation), [creation])
  const logoUrl = teamLogoUrl(hero)

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
        <p className="hero-byline">
          {payload._meta.player} · {payload._meta.season} · vs league average
        </p>
      </header>
      <HeadlineBanner selection={metrics.selection} making={metrics.making} />
      <div className="hero-layout">
        <ChartPanel
          shots={payload.shots}
          zones={metrics.zones}
          ariaLabel={`Half-court shot chart: ${metrics.totalAttempts} shots by ${payload._meta.player}, ${payload._meta.season}`}
        />
        <ZoneTable metrics={metrics} zoneConflictsDropped={payload._meta.zoneConflictsDropped} />
      </div>
      {/* The second act (ADR-0031): creation evidence backs the verdict's
          why AFTER the court and table back the two-axis thesis — the
          evidence unfolds in the order the verdict argues (ADR-0018). */}
      <section className="creation-section" aria-labelledby="creation-caption">
        <header className="creation-caption">
          <h2 id="creation-caption">SHOT CREATION</h2>
          <p className="creation-caption-desc">
            how his shots come to be — creation diet and points per shot by context, vs league
            average
          </p>
        </header>
        <div className="creation-layout">
          <CreationDietChart metrics={creationMetrics} />
          <CreationTable metrics={creationMetrics} />
        </div>
      </section>
      {/* The quiet way back to the directory (ADR-0022) — after the argument,
          never above it; cross-hero navigation is links between pages, not a
          switcher on this one.
          TEMPORARY(single-hero): hidden with the index (2026-07-12) — a
          directory link with the directory hidden would just loop back to
          this page. Restore with the index (re-import indexUrl from
          ../heroes/urls):
          <footer className="hero-footer">
            <a href={indexUrl()}>← All players</a>
          </footer> */}
    </main>
  )
}
