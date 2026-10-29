// A player's season, /jazz/<player-slug> (his canonical-season alias) and
// /jazz/<season>/<player-slug> (the permalink): docs/plans/jazz-home-
// transition.md, decisions 10 to 13 and 18; ADR-0095. A tool page, the
// report card's class: the headshot banner, then 01 his games on the
// quadrant (each priced against its own day's ruler, so a dot equals his
// line on that game's card), 02 his season zone by zone against the
// season's league average with the local flags (ADR-0075), 03 the game log,
// newest first, each row linking its report card. His argument, when he has
// one, is linked, never duplicated (the tool and argument split).
//
// Every number is playerSeason.ts's; this component formats.

import { useEffect, useMemo } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { GameQuadrant } from '../chart/GameQuadrant'
import { buildPlayerSeason } from '../domain/playerSeason'
import type { PlayerSeason } from '../domain/playerSeason'
import type { AssistStatus } from '../domain/shotContextPayload'
import type { TeamSeasonIndex } from '../domain/teamSeasonIndex'
import type { TeamShotPayload } from '../domain/teamShotPayload'
import { formatDataThrough, formatGameDate, formatMatchup, formatSignedGap } from '../format'
import { heroBySlug } from '../heroes/registry'
import { heroPageUrl, seasonPageUrl } from '../heroes/urls'
import { PLAYER_COPY } from '../teams/copy'
import type { TeamConfig } from '../teams/registry'
import {
  playerHeadshotUrl,
  teamGameUrl,
  teamPageUrl,
  teamPlayerUrl,
  teamSeasonIndexUrl,
  teamSeasonUrl,
  teamShotPayloadUrl,
} from '../teams/urls'
import { HeadlineBanner } from './HeadlineBanner'
import { PosterBanner } from './PosterBanner'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { TeamPageError } from './TeamPage'
import { useOptionalTeamSeasonIndex, useOptionalTeamShotPayload } from './usePayload'
import { ZoneTable } from './ZoneTable'

function priorSeasonOf(season: string): string {
  const start = Number(season.slice(0, 4)) - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

export function PlayerSeasonPage({ team, season, slug }: { team: TeamConfig; season: string; slug: string }) {
  const known = team.seasons.includes(season)
  const prior = priorSeasonOf(season)
  const hasPrior = known && team.seasons.includes(prior)
  const indexState = useOptionalTeamSeasonIndex(known ? teamSeasonIndexUrl(team, season) : null)
  const payloadState = useOptionalTeamShotPayload(known ? teamShotPayloadUrl(team, season) : null)
  const priorIndexState = useOptionalTeamSeasonIndex(hasPrior ? teamSeasonIndexUrl(team, prior) : null)
  const priorPayloadState = useOptionalTeamShotPayload(hasPrior ? teamShotPayloadUrl(team, prior) : null)

  if (!known) return <TeamPageError message={PLAYER_COPY.notOnFile(team.name, slug, season)} />
  for (const state of [indexState, payloadState, priorIndexState, priorPayloadState]) {
    if (state.status === 'error') return <TeamPageError message={state.message} />
  }
  if (
    indexState.status !== 'ready' ||
    payloadState.status !== 'ready' ||
    priorIndexState.status === 'loading' ||
    priorPayloadState.status === 'loading'
  ) {
    return (
      <main className="hero-page team-page">
        <SiteNav />
        <p className="page-status page-loading">Loading player data…</p>
      </main>
    )
  }
  const priorData =
    priorIndexState.status === 'ready' && priorPayloadState.status === 'ready'
      ? { index: priorIndexState.payload, payload: priorPayloadState.payload }
      : undefined
  return (
    <SeasonReady
      team={team}
      slug={slug}
      index={indexState.payload}
      payload={payloadState.payload}
      prior={priorData}
    />
  )
}

function SeasonReady({
  team,
  slug,
  index,
  payload,
  prior,
}: {
  team: TeamConfig
  slug: string
  index: TeamSeasonIndex
  payload: TeamShotPayload
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload }
}) {
  const season = payload._meta.season
  const ps = useMemo(() => buildPlayerSeason(slug, payload, index, prior), [slug, payload, index, prior])
  const name = ps?.player.name

  useEffect(() => {
    if (name !== undefined) document.title = `${name} · ${season} · ${team.name}`
  }, [name, season, team])

  if (ps === null) return <TeamPageError message={PLAYER_COPY.notOnFile(team.name, slug, season)} />
  return <SeasonPage team={team} ps={ps} payload={payload} />
}

function SeasonPage({ team, ps, payload }: { team: TeamConfig; ps: PlayerSeason; payload: TeamShotPayload }) {
  const { player, season } = ps
  const shots = useMemo(() => payload.shots.filter((s) => s.playerId === player.playerId), [payload, player])
  // The team payload carries no Case 3 context: no assist marking, never guessed.
  const noAssists = useMemo(() => new Map<string, AssistStatus>(), [])
  const hero = heroBySlug(player.slug)
  const argument =
    hero === undefined
      ? null
      : hero.seasons.some((s) => s.season === season)
        ? { href: seasonPageUrl(hero, season), season }
        : { href: heroPageUrl(hero), season: hero.canonicalSeason }
  const teamUrl = season === team.canonicalSeason ? teamPageUrl(team) : teamSeasonUrl(team, season)
  const latest = ps.dots.at(-1)
  const canonical = season === team.canonicalSeason

  return (
    <>
      <main className="hero-page team-page player-season">
        <SiteNav />
        <PosterBanner
          art={{ kind: 'headshot', src: playerHeadshotUrl(player.slug) }}
          logoUrl={null}
          kicker={PLAYER_COPY.kicker(team.name, ps.number ?? '', season)}
          title={player.name}
          cue={PLAYER_COPY.cue}
          className="player-poster"
        />
        <header className="player-header">
          {/* The frontier byline (ADR-0058), his games and his shots. */}
          <p className="hero-byline">
            {formatDataThrough(ps.dataThrough, ps.games.length)} · {player.shots} shots · vs {season} league
            average
          </p>
          <p className="team-note player-links">
            <a href={teamUrl}>← {PLAYER_COPY.backToTeam(team.name, season)}</a>
            {ps.priorSeason !== null && (
              <>
                {' · '}
                <a href={teamPlayerUrl(team, ps.priorSeason, player.slug)}>{PLAYER_COPY.priorSeason(ps.priorSeason)}</a>
              </>
            )}
            {argument !== null && (
              <>
                {' · '}
                <a href={argument.href}>{PLAYER_COPY.argument(argument.season)} →</a>
              </>
            )}
          </p>
          {canonical && !ps.onRoster && <p className="team-note">{PLAYER_COPY.departed(team.name)}</p>}
        </header>

        <HeadlineBanner selection={ps.metrics.selection} making={ps.metrics.making} />

        <section className="report-section" aria-labelledby="player-games-caption">
          <header className="section-caption">
            <p className="section-kicker">{PLAYER_COPY.actGames}</p>
            <h2 id="player-games-caption">{PLAYER_COPY.quadrantCaption}</h2>
            <p className="section-caption-desc">{PLAYER_COPY.quadrantDesc}</p>
          </header>
          {latest === undefined ? (
            <p className="team-note">{PLAYER_COPY.noPricedShot}</p>
          ) : (
            <div className="player-quadrant">
              <GameQuadrant
                dots={ps.dots}
                tonight={latest}
                priorDots={ps.priorDots}
                season={season}
                priorSeason={ps.priorSeason}
                hrefOf={(d) => teamGameUrl(team, d.slug)}
                ariaLabel={`Every ${team.name} game ${player.name} took a priced shot in, shot diet against conversion`}
                tonightLabel={PLAYER_COPY.legendLatest}
              />
            </div>
          )}
        </section>

        <section className="report-section" aria-labelledby="player-zone-caption">
          <header className="section-caption">
            <p className="section-kicker">{PLAYER_COPY.actSeason}</p>
            <h2 id="player-zone-caption">{PLAYER_COPY.zoneCaption}</h2>
            <p className="section-caption-desc">{PLAYER_COPY.zoneDesc(season)}</p>
          </header>
          <div className="section-layout">
            <ChartPanel
              shots={shots}
              zones={ps.metrics.zones}
              assistStatusByShotKey={noAssists}
              ariaLabel={`Half-court shot chart: ${ps.metrics.totalAttempts} shots by ${player.name}, ${season}`}
            />
            <ZoneTable metrics={ps.metrics} zoneConflictsDropped={ps.zoneConflicts} />
          </div>
        </section>

        <section className="report-section" aria-labelledby="player-log-caption">
          <header className="section-caption">
            <p className="section-kicker">{PLAYER_COPY.actLog}</p>
            <h2 id="player-log-caption">{PLAYER_COPY.logCaption}</h2>
            <p className="section-caption-desc">{PLAYER_COPY.logDesc}</p>
          </header>
          <GameLog team={team} ps={ps} />
        </section>
      </main>
      <SiteFooter directoryLink />
    </>
  )
}

function GameLog({ team, ps }: { team: TeamConfig; ps: PlayerSeason }) {
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table className="zone-table report-table player-log" aria-label={`${ps.player.name}’s game log`}>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Opp</th>
              <th scope="col">Result</th>
              <th scope="col">MIN</th>
              <th scope="col">PTS</th>
              <th scope="col">FG</th>
              <th scope="col">3P</th>
              <th scope="col">FT</th>
              <th scope="col">Expected</th>
              <th scope="col">Scored</th>
              <th scope="col">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {[...ps.games].reverse().map((g) => (
              <tr key={g.gameId}>
                <th scope="row">
                  <a href={teamGameUrl(team, g.slug)}>{formatGameDate(g.gameDate)}</a>
                </th>
                <td>{formatMatchup(g.opponent, g.home)}</td>
                <td>
                  {g.won ? 'W' : 'L'} {g.teamScore}–{g.opponentScore}
                </td>
                <td>{g.line.minutes}</td>
                <td>{g.line.points}</td>
                <td>
                  {g.line.fgm}–{g.line.fga}
                </td>
                <td>
                  {g.line.tpm}–{g.line.tpa}
                </td>
                <td>
                  {g.line.ftm}–{g.line.fta}
                </td>
                <td>{g.expected === null ? '—' : g.expected.toFixed(1)}</td>
                <td>{g.scored === null ? '—' : g.scored.toFixed(0)}</td>
                <td>{formatSignedGap(g.scored, g.expected, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">{PLAYER_COPY.logNote}</p>
    </div>
  )
}
