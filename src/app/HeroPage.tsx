import { useEffect, useMemo, type CSSProperties } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { aggregateShotMetrics } from '../domain/aggregate'
import type { DerivedPayload } from '../domain/payload'
import { heroConfig } from '../heroConfig'
import { HeadlineBanner } from './HeadlineBanner'
import { usePayload } from './usePayload'
import { ZoneTable } from './ZoneTable'

export function HeroPage() {
  const state = usePayload(heroConfig.payloadUrl)

  useEffect(() => {
    document.title = `${heroConfig.playerName} · ${heroConfig.season} · shot selection`
  }, [])

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
  return <HeroReady payload={state.payload} />
}

function HeroReady({ payload }: { payload: DerivedPayload }) {
  // THE single production call site of the aggregation (ADR-0007/0009).
  // Everything below receives slices of `metrics` and only formats — nothing
  // in the UI recomputes a rate, share, or PPS.
  const metrics = useMemo(
    () => aggregateShotMetrics(payload.shots, payload.zoneBaseline),
    [payload],
  )

  return (
    <main className="hero-page">
      {/* The poster banner carries the h1 — question first (ADR-0018),
          just at hero scale. */}
      <header className="hero-banner">
        <img
          src={heroConfig.hero.imageUrl}
          alt={heroConfig.hero.imageAlt}
          // Focal points as custom properties so the stylesheet can pick per
          // layout (inline object-position would defeat the media query).
          style={
            {
              '--hero-pos': heroConfig.hero.imagePosition,
              '--hero-pos-wide': heroConfig.hero.imagePositionWide,
            } as CSSProperties
          }
          fetchPriority="high"
        />
        <div className="hero-banner-overlay">
          <p className="hero-kicker">{heroConfig.hero.kicker}</p>
          <h1 className="hero-title">{heroConfig.thesis}</h1>
          <p className="hero-cue" aria-hidden="true">
            ↓ The verdict
          </p>
        </div>
      </header>
      <header className="hero-header">
        {/* The answer before the evidence (ADR-0017) — authored hero copy,
            kept honest by the committed verdict guard. */}
        <p className="hero-verdict">{heroConfig.verdict}</p>
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
    </main>
  )
}
