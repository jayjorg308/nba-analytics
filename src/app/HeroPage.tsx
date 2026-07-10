import { useEffect, useMemo } from 'react'
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
      <header className="hero-header">
        <h1>{heroConfig.thesis}</h1>
        <p className="hero-byline">
          {payload._meta.player} · {payload._meta.season} · vs league average
        </p>
      </header>
      <HeadlineBanner selection={metrics.selection} />
      <div className="hero-layout">
        <ChartPanel
          shots={payload.shots}
          ariaLabel={`Half-court shot chart: ${metrics.totalAttempts} shots by ${payload._meta.player}, ${payload._meta.season}`}
        />
        <ZoneTable metrics={metrics} />
      </div>
    </main>
  )
}
