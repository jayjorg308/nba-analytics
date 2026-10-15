// Per-game share cards and share pages (docs/plans/jazz-first-site.md,
// "Share cards"; ADR-0067's pattern at game grain): the pure derivation
// behind scripts/generate-game-cards.ts and the build's emission step. A
// 1200x630 card per published game (the score, the two answers, the game's
// court) and an emitted dist/<team>/<game-slug>/index.html pointing its
// og:image at that card. Both read committed files only — the game payload
// and the season index — never the NBA API.
//
// Node-safe and DOM-free, like src/heroes/socialCards.ts, whose meta shape
// and HTML transform it reuses.

import { aggregateShotMetrics } from '../domain/aggregate'
import type { GamePayload } from '../domain/gamePayload'
import type { IndexGame } from '../domain/teamSeasonIndex'
import { displayGapUnits, formatGameDate, formatMatchup, formatSignedGap } from '../format'
import { SITE_ORIGIN, type HeroPageMeta } from '../heroes/socialCards'
import { makingAnswer, QUESTIONS, selectionAnswer } from './computedCopy'
import { REPORT_COPY, TEAM_COPY } from './copy'
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

/** The bare team route's share page (/jazz, the canonical season). Emitted
 * so dist/<team>/ is never a directory without its own page now that the
 * report cards live beneath it; it keeps the product-wide card, like the
 * methodology page, and preloads the canonical season's three files. */
export function teamPageMeta(team: TeamConfig): HeroPageMeta {
  const season = team.canonicalSeason
  const base = `/data/_teams/${team.tricode.toLowerCase()}`
  return {
    // Mirrors the team page's runtime document.title.
    title: `${team.name} · ${season} · shot profile`,
    description: TEAM_COPY.toolNote,
    imageUrl: `${SITE_ORIGIN}/social-card.png`,
    imageAlt: 'Good Shots wordmark beside a basketball',
    url: `${SITE_ORIGIN}/${team.slug}`,
    preloadPaths: [`${base}/${season}.json`, `${base}/${season}.ledger.json`, `${base}/${season}/index.json`],
  }
}
