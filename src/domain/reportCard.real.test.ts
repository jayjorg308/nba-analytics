// Guards every deployed report card (docs/plans/jazz-first-site.md, test
// plan): each committed game builds its card, and its two numbers equal its
// quadrant dot's and its ledger row's AS DISPLAYED, the gaps of displayed
// anchors (ADR-0023), so a reader who follows a link never sees a number
// change. Ranks appear from the minimum game count on. Covers every team
// season published on disk, registered or not (ADR-0091). Skips on clean
// clones.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatSignedGap } from '../format'
import { publishedSeasons, TEAMS_ROOT as teamsRoot } from '../teams/published'
import { TEAMS } from '../teams/registry'
import type { ShotMetrics } from './aggregate'
import { aggregateTeam } from './aggregateTeam'
import { parseGamePayload } from './gamePayload'
import { buildReportCard, SEASON_RANK_MIN_GAMES } from './reportCard'
import { parseTeamSeasonIndex } from './teamSeasonIndex'
import { parseTeamShotPayload } from './teamShotPayload'

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf-8')) as unknown

const displayed = (m: ShotMetrics) => [
  formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2),
  formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2),
]

const published = TEAMS.flatMap((team) =>
  publishedSeasons(team).map((season) => ({
    team,
    season,
    root: path.join(teamsRoot, team.tricode.toLowerCase()),
  })),
)

describe.skipIf(published.length === 0)('deployed report cards', () => {
  for (const { team, season, root } of published) {
    it(`${team.slug} ${season}: every card equals its dot and its ledger row, as displayed`, () => {
      const index = parseTeamSeasonIndex(readJson(path.join(root, season, 'index.json')))
      const payload = parseTeamShotPayload(readJson(path.join(root, `${season}.json`)))
      const rows = aggregateTeam(payload, index).gameById
      index.games.forEach((g, i) => {
        const game = parseGamePayload(readJson(path.join(root, season, 'games', `${g.gameId}.json`)))
        const card = buildReportCard(game, index, payload)
        const shown = displayed(card.subject.metrics)
        expect(displayed(card.tonight.metrics), g.slug).toEqual(shown)
        expect(displayed(rows.get(g.gameId)!.metrics), g.slug).toEqual(shown)
        expect(card.dots, g.slug).toHaveLength(i + 1)
        expect(card.ranks === null, g.slug).toBe(i + 1 < SEASON_RANK_MIN_GAMES)
      })
    })
  }
})
