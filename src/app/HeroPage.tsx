import { useEffect, useMemo, type CSSProperties } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { aggregateShotMetrics } from '../domain/aggregate'
import type { DerivedPayload } from '../domain/payload'
import type { HeroConfig } from '../heroes/types'
import { heroImageUrl, payloadUrl, teamLogoUrl } from '../heroes/urls'
import { HeadlineBanner } from './HeadlineBanner'
import { usePayload } from './usePayload'
import { ZoneTable } from './ZoneTable'

export function HeroPage({ hero }: { hero: HeroConfig }) {
  const state = usePayload(payloadUrl(hero))

  useEffect(() => {
    document.title = `${hero.playerName} · ${hero.season} · shot selection`
  }, [hero])

  if (state.status === 'loading') {
    return (
      <main className="hero-page">
        <p className="page-status">Loading shot data…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    // Contract violations and load failures are shown plainly, never styled away.
    return (
      <main className="hero-page">
        <p className="page-status page-error">{state.message}</p>
      </main>
    )
  }
  return <HeroReady hero={hero} payload={state.payload} />
}

function HeroReady({ hero, payload }: { hero: HeroConfig; payload: DerivedPayload }) {
  // THE single production call site of the aggregation (ADR-0007/0009).
  // Everything below receives slices of `metrics` and only formats — nothing
  // in the UI recomputes a rate, share, or PPS.
  const metrics = useMemo(
    () => aggregateShotMetrics(payload.shots, payload.zoneBaseline),
    [payload],
  )
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
