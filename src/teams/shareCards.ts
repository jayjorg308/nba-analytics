// Per-game share cards and share pages (docs/plans/jazz-first-site.md,
// "Share cards"; ADR-0067's pattern at game grain): the pure derivation
// behind scripts/generate-game-cards.ts and the build's emission step. A
// 1200x630 card per published game (the score, the two answers, the game's
// court) and an emitted dist/<team>/<game-slug>/index.html pointing its
// og:image at that card. Both read committed files only — the game payload
// and the season index — never the NBA API.
//
// The season homes' pages (ADR-0087) and the player season pages (ADR-0095)
// share one static card per season, so neither ever needs new art.
//
// Node-safe and DOM-free, like src/heroes/socialCards.ts, whose meta shape
// and HTML transform it reuses.

import { aggregateShotMetrics } from '../domain/aggregate'
import type { GamePayload } from '../domain/gamePayload'
import type { PlayerOnFile } from '../domain/playerSeason'
import type { IndexGame } from '../domain/teamSeasonIndex'
import { displayGapUnits, formatGameDate, formatMatchup, formatSignedGap } from '../format'
import { SITE_ORIGIN, type HeroPageMeta } from '../heroes/socialCards'
import { makingAnswer, QUESTIONS, selectionAnswer } from './computedCopy'
import { HOME_COPY, PLAYER_COPY, REPORT_COPY } from './copy'
import { gamePhotoOf } from './gamePhotos'
import type { TeamConfig } from './registry'

/** The committed card for a game, under public/ (no leading slash). */
export function gameCardPath(team: TeamConfig, slug: string): string {
  return `social-cards/${team.slug}/${slug}.png`
}

export interface GameCardSpec {
  slug: string
  /** The output path under public/. */
  out: string
  kicker: string
  score: string
  answers: { question: string; number: string; words: string }[]
  /** The subject's shots in stats.nba.com units (hoop at the origin). */
  shots: { x: number; y: number; made: boolean }[]
  /** The game's own photograph, when one is on file (ADR-0094): it takes
   * the court's place as the banner's wide panel, with its credit in the
   * corner. Absent, the card is the data card ADR-0091's loop draws. */
  photo?: { path: string; position: string; credit: string }
}

function scoreOf(game: GamePayload): string {
  const [subject, opponent] = game.sides
  const won = subject.box.points > opponent.box.points
  return `${won ? 'W' : 'L'} ${subject.box.points}–${opponent.box.points}`
}

/** The card's content: every number is the card page's own, decided the
 * same way (the displayed gap licenses the words, ADR-0023). */
export function gameCardSpec(team: TeamConfig, game: GamePayload, slug: string): GameCardSpec {
  const subject = game.sides[0]
  const m = aggregateShotMetrics(subject.shots, game.zoneBaseline)
  const sel = displayGapUnits(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2)! / 100
  const mak = displayGapUnits(m.making.actualPps, m.selection.playerDietExpectedPps, 2)! / 100
  return {
    slug,
    out: gameCardPath(team, slug),
    kicker: REPORT_COPY.kicker(
      team.name,
      formatGameDate(game._meta.gameDate),
      formatMatchup(game._meta.opponentTricode, game._meta.home),
    ),
    score: scoreOf(game),
    answers: [
      {
        question: QUESTIONS.selection,
        number: formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2),
        words: selectionAnswer(sel),
      },
      {
        question: QUESTIONS.making,
        number: formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2),
        words: makingAnswer(mak),
      },
    ],
    shots: subject.shots.map((s) => ({ x: s.locX, y: s.locY, made: s.made })),
    ...photoOf(slug),
  }
}

function photoOf(slug: string): Pick<GameCardSpec, 'photo'> {
  const photo = gamePhotoOf(slug)
  if (photo === undefined) return {}
  return {
    photo: {
      path: photo.imagePath,
      position: photo.imagePositionWide,
      credit: photo.imageCredit ?? REPORT_COPY.creditPending,
    },
  }
}

/** The files a report card fetches at boot (the node-safe twin of
 * src/teams/urls.ts, which must stay in agreement): the season index, the
 * team shot payload, the game file, and the prior season's index and
 * payload when that season is published. */
export function gamePreloadPaths(team: TeamConfig, season: string, gameId: string): string[] {
  const base = `/data/_teams/${team.tricode.toLowerCase()}`
  const paths = [`${base}/${season}/index.json`, `${base}/${season}.json`, `${base}/${season}/games/${gameId}.json`]
  const start = Number(season.slice(0, 4)) - 1
  const prior = `${start}-${String(start + 1).slice(-2)}`
  if (team.seasons.includes(prior)) paths.push(`${base}/${prior}/index.json`, `${base}/${prior}.json`)
  return paths
}

/** The emitted share page's meta for one published game. */
export function gamePageMeta(team: TeamConfig, season: string, row: IndexGame): HeroPageMeta {
  const date = formatGameDate(row.gameDate)
  const matchup = formatMatchup(row.opponent, row.home)
  const score = `${row.teamScore > row.opponentScore ? 'W' : 'L'} ${row.teamScore}–${row.opponentScore}`
  return {
    // Mirrors the card page's runtime document.title.
    title: `${team.name} ${score} ${matchup} · ${date}`,
    description: REPORT_COPY.shareDescription(team.name, date, matchup),
    imageUrl: `${SITE_ORIGIN}/${gameCardPath(team, row.slug)}`,
    imageAlt: REPORT_COPY.shareImageAlt(team.name, score, date, matchup),
    url: `${SITE_ORIGIN}/${team.slug}/${row.slug}`,
    preloadPaths: gamePreloadPaths(team, season, row.gameId),
  }
}

/** A team season's committed share card (ADR-0087): the site root's, the
 * team route's, and the season page's. Static (the season and the team mark,
 * no numbers), so it is true every day and the loop never redraws it. */
export function seasonCardPath(team: TeamConfig, season: string): string {
  return `social-cards/${team.slug}/${season}.png`
}

/** The card generator's spec for a season card (scripts/generate_social_cards.py,
 * the marquee with the team mark where a headshot stands). */
export function seasonCardSpec(team: TeamConfig, season: string) {
  if (team.teamLogoPath === undefined) throw new Error(`${team.slug} has no team mark for its season card`)
  return {
    slug: `${team.slug}/${season}`,
    playerName: team.name,
    meta: season,
    logoPath: team.teamLogoPath,
    cue: HOME_COPY.cardCue,
  }
}

/** The files a season home fetches at boot (the node-safe twin of the
 * team URLs in src/teams/urls.ts): the season's payload and index, and the
 * prior season's when that season is registered (its faded dots). */
export function seasonPreloadPaths(team: TeamConfig, season: string): string[] {
  const base = `/data/_teams/${team.tricode.toLowerCase()}`
  const paths = [`${base}/${season}.json`, `${base}/${season}/index.json`]
  const start = Number(season.slice(0, 4)) - 1
  const prior = `${start}-${String(start + 1).slice(-2)}`
  if (team.seasons.includes(prior)) paths.push(`${base}/${prior}/index.json`, `${base}/${prior}.json`)
  return paths
}

/** A season home's share meta: the bare team route (/jazz, the canonical
 * season) or a season page (/jazz/<season>). The site root takes the same
 * meta without its og:url (rootPageHtml). */
export function seasonPageMeta(team: TeamConfig, season: string): HeroPageMeta {
  return {
    // Mirrors TeamPage's runtime document.title.
    title: `${team.name} · ${season} · Good Shots`,
    description: HOME_COPY.shareDescription(team.name, season),
    imageUrl: `${SITE_ORIGIN}/${seasonCardPath(team, season)}`,
    // The hero card's alt form (socialCards.ts), naming the mark that
    // stands where a headshot would.
    imageAlt: `${team.name} mark beside the Good Shots wordmark, ${season}`,
    url: season === team.canonicalSeason ? `${SITE_ORIGIN}/${team.slug}` : `${SITE_ORIGIN}/${team.slug}/${season}`,
    preloadPaths: seasonPreloadPaths(team, season),
  }
}

/** A player season page's share meta (ADR-0095 as amended 2026-10-29): his
 * canonical alias (/jazz/<slug>, the canonical season) or his season
 * permalink (/jazz/<season>/<slug>). The card is his season's card, not one
 * of his own: it is committed before his first shot, so a debut can never
 * fail the build the way a missing per-player card would. */
export function playerPageMeta(team: TeamConfig, season: string, player: Pick<PlayerOnFile, 'name' | 'slug'>): HeroPageMeta {
  const card = seasonPageMeta(team, season)
  return {
    // Mirrors PlayerSeasonPage's runtime document.title.
    title: `${player.name} · ${season} · ${team.name}`,
    description: PLAYER_COPY.shareDescription(player.name, team.name, season),
    imageUrl: card.imageUrl,
    imageAlt: card.imageAlt,
    url:
      season === team.canonicalSeason
        ? `${SITE_ORIGIN}/${team.slug}/${player.slug}`
        : `${SITE_ORIGIN}/${team.slug}/${season}/${player.slug}`,
    // The player page fetches what the season home does: the season's index
    // and payload, and the prior season's when that season is registered.
    preloadPaths: seasonPreloadPaths(team, season),
  }
}
