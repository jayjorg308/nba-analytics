// A team season's home (ADR-0087; docs/plans/jazz-home-transition.md,
// decisions 1, 7 to 9, 14, and 15): the site root renders the home team's
// canonical season, `/jazz` is its alias, and `/jazz/<season>` renders any
// registered season in the same layout. Chosen 2026-10-29 from a
// two-variant prototype (A, Acts): the season banner, then numbered acts in
// the report card's recipe. 01 the latest game as a tile with the three
// before it; 02 the featured players as headshot cards over a name rail;
// 03 the season's quadrant; 04 the season's pair and zone by zone; 05 the
// game ledger; 06 the arguments.
//
// A TOOL, not an argument (ADR-0081): structural copy only, every number
// teamHome.ts's (one aggregation over slices of one payload), and the only
// directional words are each report card's own computed copy, decided on
// the displayed gap exactly as the card decides it (ADR-0090).

import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { GameQuadrant } from '../chart/GameQuadrant'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from '../domain/constants'
import type { GameDot } from '../domain/reportCard'
import type { AssistStatus } from '../domain/shotContextPayload'
import { buildTeamHome } from '../domain/teamHome'
import type { FeaturedCard, TeamHome } from '../domain/teamHome'
import type { TeamSeasonIndex } from '../domain/teamSeasonIndex'
import type { TeamShotPayload } from '../domain/teamShotPayload'
import { formatMatchup, formatMonthDay, formatSignedGap } from '../format'
import { directoryOrder, heroBySlug } from '../heroes/registry'
import { argumentsUrl, headshotUrl, heroPageUrl, methodologyUrl } from '../heroes/urls'
import { makingAnswer, nightTitle, QUESTIONS, selectionAnswer } from '../teams/computedCopy'
import { HOME_COPY, REPORT_COPY, TEAM_COPY } from '../teams/copy'
import { seasonHomeOf } from '../teams/registry'
import type { SeasonBanner, TeamConfig } from '../teams/registry'
import {
  playerHeadshotUrl,
  publicAssetUrl,
  teamGameUrl,
  teamLogoUrl,
  teamPageUrl,
  teamPlayerUrl,
  teamSeasonIndexUrl,
  teamSeasonUrl,
  teamShotPayloadUrl,
} from '../teams/urls'
import { HeadlineBanner } from './HeadlineBanner'
import { TEAM_SUBJECT } from './headlineSubject'
import { PosterBanner } from './PosterBanner'
import type { PosterArt } from './PosterBanner'
import { displayedGaps, gameBannerArt } from './reportCardDisplay'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { TeamLedgerTable } from './TeamLedgerTable'
import { Term } from './Term'
import { useOptionalTeamSeasonIndex, useOptionalTeamShotPayload, useTeamSeasonIndex, useTeamShotPayload } from './usePayload'
import { ZoneTable } from './ZoneTable'

export function TeamPageError({ message }: { message: string }) {
  return (
    <main className="hero-page team-page">
      <SiteNav />
      <p className="page-status page-error">{message}</p>
    </main>
  )
}

function priorSeasonOf(season: string): string {
  const start = Number(season.slice(0, 4)) - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

export function TeamPage({ team, season }: { team: TeamConfig; season: string }) {
  const prior = priorSeasonOf(season)
  const hasPrior = team.seasons.includes(prior)
  const payloadState = useTeamShotPayload(teamShotPayloadUrl(team, season))
  const indexState = useTeamSeasonIndex(teamSeasonIndexUrl(team, season))
  const priorIndexState = useOptionalTeamSeasonIndex(hasPrior ? teamSeasonIndexUrl(team, prior) : null)
  const priorPayloadState = useOptionalTeamShotPayload(hasPrior ? teamShotPayloadUrl(team, prior) : null)

  useEffect(() => {
    document.title = `${team.name} · ${season} · Good Shots`
  }, [team, season])

  for (const state of [payloadState, indexState, priorIndexState, priorPayloadState]) {
    if (state.status === 'error') return <TeamPageError message={state.message} />
  }
  if (
    payloadState.status !== 'ready' ||
    indexState.status !== 'ready' ||
    priorIndexState.status === 'loading' ||
    priorPayloadState.status === 'loading'
  ) {
    return (
      <main className="hero-page team-page">
        <SiteNav />
        <p className="page-status page-loading">Loading team shot data…</p>
      </main>
    )
  }
  const priorData =
    priorIndexState.status === 'ready' && priorPayloadState.status === 'ready'
      ? { index: priorIndexState.payload, payload: priorPayloadState.payload }
      : undefined
  return (
    <HomeReady
      team={team}
      season={season}
      payload={payloadState.payload}
      index={indexState.payload}
      prior={priorData}
    />
  )
}

function bannerArt(banner: SeasonBanner | undefined): PosterArt {
  if (banner === undefined) return { kind: 'type' }
  return {
    kind: 'photo',
    src: publicAssetUrl(banner.imagePath),
    alt: banner.imageAlt,
    position: banner.imagePosition,
    positionWide: banner.imagePositionWide,
  }
}

function HomeReady({
  team,
  season,
  payload,
  index,
  prior,
}: {
  team: TeamConfig
  season: string
  payload: TeamShotPayload
  index: TeamSeasonIndex
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload }
}) {
  const config = seasonHomeOf(team, season)
  const home = useMemo(
    () => buildTeamHome(config.featured, payload, index, prior),
    [config, payload, index, prior],
  )
  // The team payload carries no Case 3 context: the scatter renders every
  // shot with no assist marking (the map is empty, never guessed).
  const noAssists = useMemo(() => new Map<string, AssistStatus>(), [])
  const canonical = season === team.canonicalSeason
  const { metrics } = home

  return (
    <>
      <main className="hero-page team-page team-home">
        <SiteNav />
        <PosterBanner
          art={bannerArt(config.banner)}
          logoUrl={teamLogoUrl(team)}
          kicker={HOME_COPY.kicker(season, formatMonthDay(metrics.dataThrough), metrics.games)}
          title={team.name}
          cue={HOME_COPY.cue}
          className="home-poster"
        />
        <div className="home-links">
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
        </div>

        <LatestGames team={team} home={home} />

        <section className="report-section" aria-labelledby="home-players-caption">
          <ActHeader
            id="home-players-caption"
            kicker={HOME_COPY.actPlayers}
            title={HOME_COPY.playersTitle(home.featured.length)}
            desc={home.featured.length > 0 ? HOME_COPY.playersDesc : undefined}
          />
          {home.featured.length > 0 && (
            <ul className="home-cards">
              {home.featured.map((card) => (
                <li key={card.slug}>
                  <FeaturedPlayerCard team={team} season={season} card={card} />
                </li>
              ))}
            </ul>
          )}
          {home.featured.some((c) => c.season !== null && c.season.metrics.evalAttempts < SMALL_SAMPLE_MAKING_ATTEMPTS) && (
            <p className="table-note">{HOME_COPY.cardFlagNote(SMALL_SAMPLE_MAKING_ATTEMPTS)}</p>
          )}
          <Rail team={team} season={season} home={home} canonical={canonical} />
        </section>

        <section className="report-section" aria-labelledby="home-quadrant-caption">
          <ActHeader
            id="home-quadrant-caption"
            kicker={HOME_COPY.actGames}
            title={REPORT_COPY.quadrantCaption}
            desc={HOME_COPY.quadrantDesc}
          />
          <div className="player-quadrant">
            <GameQuadrant
              dots={home.dots}
              tonight={home.latest}
              priorDots={home.priorDots}
              season={season}
              priorSeason={home.priorSeason}
              hrefOf={(d) => teamGameUrl(team, d.slug)}
              ariaLabel={`Every ${team.name} game so far, shot diet against conversion`}
              tonightLabel={HOME_COPY.legendLatest}
            />
          </div>
        </section>

        <section className="report-section" aria-labelledby="home-zone-caption">
          <ActHeader
            id="home-zone-caption"
            kicker={HOME_COPY.actFloor}
            title={TEAM_COPY.profileCaption}
            desc={
              <>
                the team’s <Term id="shot-diet">shot diet</Term> and{' '}
                <Term id="shot-making">shot making</Term>, vs league average (
                <Term id="making-delta">making Δ</Term> in FG percentage&nbsp;points)
              </>
            }
          />
          <HeadlineBanner
            selection={metrics.profile.selection}
            making={metrics.profile.making}
            subject={TEAM_SUBJECT}
          />
          <div className="section-layout home-zones">
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

        <section className="report-section" aria-labelledby="home-ledger-caption">
          <ActHeader
            id="home-ledger-caption"
            kicker={HOME_COPY.actLedger}
            title={TEAM_COPY.ledgerCaption}
            desc={TEAM_COPY.ledgerDesc}
          />
          <TeamLedgerTable team={team} rows={metrics.ledger} />
        </section>

        <ArgumentsSection team={team} />
      </main>
      <SiteFooter />
    </>
  )
}

/** An act's header: the report card's recipe (ADR-0051), a numbered kicker
 * over the caps title over the gray description. */
function ActHeader({ id, kicker, title, desc }: { id: string; kicker: string; title: string; desc?: ReactNode }) {
  return (
    <header className="section-caption">
      <p className="section-kicker">{kicker}</p>
      <h2 id={id}>{title}</h2>
      {desc !== undefined && <p className="section-caption-desc">{desc}</p>}
    </header>
  )
}

/** A game's two displayed numbers and its card's own words for them. */
function readGame(d: GameDot) {
  const m = d.metrics
  const gaps = displayedGaps(m)
  return {
    date: formatMonthDay(d.gameDate),
    matchup: formatMatchup(d.opponent, d.home),
    score: `${d.won ? 'W' : 'L'} ${d.teamScore}–${d.opponentScore}`,
    title: nightTitle(gaps.selection, gaps.making),
    selection: formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2),
    making: formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2),
    selectionWords: selectionAnswer(gaps.selection),
    makingWords: makingAnswer(gaps.making),
  }
}

/** 01 · THE LATEST GAME (decision 9): the newest card as a tile, its own
 * photograph as the ground when one is on file, then the games before it. */
function LatestGames({ team, home }: { team: TeamConfig; home: TeamHome }) {
  const g = readGame(home.latest)
  const { art, credit } = gameBannerArt(home.latest.slug)
  return (
    <section className="report-section report-first" aria-labelledby="home-latest-caption">
      <ActHeader
        id="home-latest-caption"
        kicker={HOME_COPY.actLatest}
        title={`${g.date} ${g.matchup}`.toUpperCase()}
        desc={HOME_COPY.latestDesc(home.previous.length)}
      />
      <a className="home-feature" href={teamGameUrl(team, home.latest.slug)}>
        <span className={`home-feature-face${art.kind === 'photo' ? ' has-photo' : ''}`}>
          {/* The ground, never content: the card itself carries the
              photograph's authored alt text and its credit line. */}
          {art.kind === 'photo' ? (
            <img
              className="home-feature-photo"
              src={art.src}
              alt=""
              style={{ objectPosition: art.positionWide }}
            />
          ) : (
            teamLogoUrl(team) && <img className="home-feature-logo" src={teamLogoUrl(team)!} alt="" />
          )}
          <span className="home-feature-score">{g.score}</span>
          <span className="home-feature-title">{g.title}</span>
          <span className="home-feature-cue">{HOME_COPY.latestCue}</span>
        </span>
        <span className="home-feature-answers">
          <Answer question={QUESTIONS.selection} number={g.selection} words={g.selectionWords} />
          <Answer question={QUESTIONS.making} number={g.making} words={g.makingWords} />
          <span className="home-feature-note">{HOME_COPY.pricedShots(home.latest.metrics.evalAttempts)}</span>
        </span>
      </a>
      {credit !== undefined && <p className="poster-credit home-feature-credit">{credit}</p>}
      {home.previous.length > 0 && (
        <>
          <h3 className="home-subhead">{HOME_COPY.previousLabel(home.previous.length)}</h3>
          <ul className="home-tiles">
            {home.previous.map((d) => {
              const r = readGame(d)
              return (
                <li key={d.gameId}>
                  <a className="home-tile" href={teamGameUrl(team, d.slug)}>
                    <span className="home-tile-date">
                      {r.date} · {r.matchup}
                    </span>
                    <span className="home-tile-score">{r.score}</span>
                    <span className="home-tile-line">
                      <b>{r.selection}</b> {r.selectionWords}
                    </span>
                    <span className="home-tile-line">
                      <b>{r.making}</b> {r.makingWords}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function Answer({ question, number, words }: { question: string; number: string; words: string }) {
  return (
    <span className="answer">
      <span className="answer-question">{question}</span>
      <span className="answer-number">{number}</span>
      <span className="answer-words">{words}</span>
    </span>
  )
}

/** A featured player's card (decision 14): his headshot and name, his priced
 * shots and the two season-to-date numbers with the making flag, and one
 * structural line for his argument. Links his season page; a player with no
 * shot yet has no page, so his card is named but not a link. */
function FeaturedPlayerCard({ team, season, card }: { team: TeamConfig; season: string; card: FeaturedCard }) {
  const ps = card.season
  const hero = heroBySlug(card.slug)
  const status =
    hero !== undefined && hero.seasons.some((s) => s.season === season)
      ? HOME_COPY.statusPublished(season)
      : HOME_COPY.statusNotYet(season)
  const body: ReactNode = (
    <>
      <span className="home-card-figure">
        <img
          src={playerHeadshotUrl(card.slug)}
          alt=""
          onError={(e) => {
            e.currentTarget.hidden = true
          }}
        />
        <span className="home-card-name">{card.playerName}</span>
      </span>
      {ps === null ? (
        <>
          {card.number !== null && <span className="home-card-meta">Nº {card.number}</span>}
          <span className="home-card-none">{HOME_COPY.noShotsYet}</span>
        </>
      ) : (
        <>
          <span className="home-card-meta">
            {HOME_COPY.cardMeta(card.number, ps.games.length, ps.metrics.evalAttempts)}
          </span>
          <span className="home-card-pair">
            <span>
              <b>
                {formatSignedGap(
                  ps.metrics.selection.playerDietExpectedPps,
                  ps.metrics.selection.leagueDietExpectedPps,
                  2,
                )}
              </b>
              <small>{HOME_COPY.cardDiet}</small>
            </span>
            <span>
              <b>
                {formatSignedGap(ps.metrics.making.actualPps, ps.metrics.selection.playerDietExpectedPps, 2)}
                {ps.metrics.evalAttempts < SMALL_SAMPLE_MAKING_ATTEMPTS ? '†' : ''}
              </b>
              <small>{HOME_COPY.cardConversion}</small>
            </span>
          </span>
        </>
      )}
      <span className="home-card-status">{status}</span>
    </>
  )
  return ps === null ? (
    <div className="home-card">{body}</div>
  ) : (
    <a className="home-card" href={teamPlayerUrl(team, season, card.slug)}>
      {body}
    </a>
  )
}

/** Every other shooter, name only (decision 14), departed players under
 * their own caption on the living season. */
function Rail({ team, season, home, canonical }: { team: TeamConfig; season: string; home: TeamHome; canonical: boolean }) {
  const here = canonical ? home.rail.filter((p) => p.onRoster) : home.rail
  const gone = canonical ? home.rail.filter((p) => !p.onRoster) : []
  const list = (players: typeof home.rail) => (
    <ul>
      {players.map((p) => (
        <li key={p.slug}>
          <a href={teamPlayerUrl(team, season, p.slug)}>{p.name}</a>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="home-rail">
      {here.length > 0 && (
        <>
          <h3 className="home-subhead">{home.featured.length > 0 ? HOME_COPY.railTitle : HOME_COPY.railTitleAll}</h3>
          {list(here)}
        </>
      )}
      {gone.length > 0 && (
        <>
          <h3 className="home-subhead">{HOME_COPY.railDeparted}</h3>
          {list(gone)}
        </>
      )}
    </div>
  )
}

/** 06 · THE ARGUMENTS (decision 15): the directory's headshot rail, the
 * home team's arguments first, and the way to the whole directory. */
function ArgumentsSection({ team }: { team: TeamConfig }) {
  return (
    <section className="report-section" aria-labelledby="home-arguments-caption">
      <ActHeader
        id="home-arguments-caption"
        kicker={HOME_COPY.actArguments}
        title={HOME_COPY.argumentsTitle}
        desc={HOME_COPY.argumentsDesc(team.name)}
      />
      <ul className="home-arguments">
        {directoryOrder(team.slug).map((hero) => (
          <li key={hero.slug}>
            <a className="index-card" href={heroPageUrl(hero)}>
              <img src={headshotUrl(hero)} alt="" />
              <span className="index-card-name">{hero.playerName}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="home-all">
        <a href={argumentsUrl()}>{HOME_COPY.allArguments}</a>
      </p>
    </section>
  )
}
