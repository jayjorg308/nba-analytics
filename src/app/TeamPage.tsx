// The team surface (ADR-0081/0082/0084, the Jazz surface plan): a TOOL, not
// an argument. No banner, no thesis, no verdict — a header naming the
// surface and its frontier, the season-to-date two-axis profile over the
// team shot payload, and the game ledger. Every number is aggregateTeam's
// (one aggregation over slices of one payload); this component formats.
// Both team contracts are required — one class of team page.

import { useEffect, useMemo } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { aggregateTeam } from '../domain/aggregateTeam'
import type { TeamMetrics } from '../domain/aggregateTeam'
import type { LedgerFacts } from '../domain/ledgerFacts'
import type { AssistStatus } from '../domain/shotContextPayload'
import type { TeamShotPayload } from '../domain/teamShotPayload'
import { formatDataThrough } from '../format'
import { methodologyUrl } from '../heroes/urls'
import { TEAM_COPY } from '../teams/copy'
import type { TeamConfig } from '../teams/registry'
import { ledgerFactsUrl, teamPageUrl, teamSeasonUrl, teamShotPayloadUrl } from '../teams/urls'
import { HeadlineBanner } from './HeadlineBanner'
import { TEAM_SUBJECT } from './headlineSubject'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { TeamLedgerTable } from './TeamLedgerTable'
import { Term } from './Term'
import { useLedgerFacts, useTeamShotPayload } from './usePayload'
import { ZoneTable } from './ZoneTable'

export function TeamPageError({ message }: { message: string }) {
  return (
    <main className="hero-page team-page">
      <SiteNav />
      <p className="page-status page-error">{message}</p>
    </main>
  )
}

export function TeamPage({ team, season }: { team: TeamConfig; season: string }) {
  const payloadState = useTeamShotPayload(teamShotPayloadUrl(team, season))
  const ledgerState = useLedgerFacts(ledgerFactsUrl(team, season))

  useEffect(() => {
    document.title = `${team.name} · ${season} · shot profile`
  }, [team, season])

  if (payloadState.status === 'error') return <TeamPageError message={payloadState.message} />
  if (ledgerState.status === 'error') return <TeamPageError message={ledgerState.message} />
  if (payloadState.status === 'loading' || ledgerState.status === 'loading') {
    return (
      <main className="hero-page team-page">
        <SiteNav />
        <p className="page-status page-loading">Loading team shot data…</p>
      </main>
    )
  }
  return (
    <TeamReady team={team} season={season} payload={payloadState.payload} ledger={ledgerState.payload} />
  )
}

export function TeamHeader({
  team,
  season,
  metrics,
}: {
  team: TeamConfig
  season: string
  metrics: TeamMetrics
}) {
  return (
    <header className="team-header">
      <p className="hero-kicker">{TEAM_COPY.kicker(team.name, season)}</p>
      <h1 className="team-title">{TEAM_COPY.title(team.name)}</h1>
      {/* The frontier byline (ADR-0058): structural copy, one form for a
          completed and a living season. */}
      <p className="hero-byline">
        {formatDataThrough(metrics.dataThrough, metrics.games)} · {metrics.shots} shots · vs{' '}
        {season} league average
      </p>
      {team.seasons.length > 1 && (
        <p className="team-seasons">
          {TEAM_COPY.seasonsLabel}:{' '}
          {team.seasons.map((s, i) => (
            <span key={s}>
              {i > 0 ? ' · ' : ''}
              {s === season ? (
                <span aria-current="page">{s}</span>
              ) : (
                <a href={s === team.canonicalSeason ? teamPageUrl(team) : teamSeasonUrl(team, s)}>{s}</a>
              )}
            </span>
          ))}
        </p>
      )}
      <p className="team-note">
        {TEAM_COPY.toolNote}{' '}
        <a href={`${methodologyUrl()}#methodology-team`}>{TEAM_COPY.toolNoteCue} →</a>
      </p>
    </header>
  )
}

function TeamReady({
  team,
  season,
  payload,
  ledger,
}: {
  team: TeamConfig
  season: string
  payload: TeamShotPayload
  ledger: LedgerFacts
}) {
  const metrics = useMemo(() => aggregateTeam(payload, ledger), [payload, ledger])
  // The team payload carries no Case 3 context: the scatter renders every
  // shot with no assist marking (the map is empty, never guessed).
  const noAssists = useMemo(() => new Map<string, AssistStatus>(), [])
  return (
    <>
      <main className="hero-page team-page">
        <SiteNav />
        <TeamHeader team={team} season={season} metrics={metrics} />
        <HeadlineBanner
          selection={metrics.profile.selection}
          making={metrics.profile.making}
          subject={TEAM_SUBJECT}
        />
        <section className="zone-section" aria-labelledby="team-zone-caption">
          <header className="section-caption">
            <h2 id="team-zone-caption">{TEAM_COPY.profileCaption}</h2>
            <p className="section-caption-desc">
              the team’s <Term id="shot-diet">shot diet</Term> and{' '}
              <Term id="shot-making">shot making</Term>, vs league average (
              <Term id="making-delta">making Δ</Term> in FG percentage&nbsp;points)
            </p>
          </header>
          <div className="section-layout">
            {/* No per-shot tooltips on a team season: thousands of dots are
                a pattern, not individual shots, and the hover targets made
                the Shots view slow. Player pages keep them. */}
            <ChartPanel
              shots={payload.shots}
              zones={metrics.profile.zones}
              assistStatusByShotKey={noAssists}
              shotTooltips={false}
              ariaLabel={`Half-court shot chart: ${metrics.profile.totalAttempts} shots by the ${team.name}, ${season}`}
            />
            <ZoneTable metrics={metrics.profile} zoneConflictsDropped={metrics.zoneConflictsDropped} />
          </div>
        </section>
        <section className="team-ledger-section" aria-labelledby="team-ledger-caption">
          <header className="section-caption">
            <h2 id="team-ledger-caption">{TEAM_COPY.ledgerCaption}</h2>
            <p className="section-caption-desc">{TEAM_COPY.ledgerDesc}</p>
          </header>
          <TeamLedgerTable team={team} rows={metrics.ledger} />
        </section>
      </main>
      <SiteFooter directoryLink />
    </>
  )
}
