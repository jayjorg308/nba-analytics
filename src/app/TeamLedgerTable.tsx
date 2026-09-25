// The game ledger (ADR-0084): one row per game, newest first — exact box
// facts and the headline pair over that game's rows, every delta the gap of
// its two displayed anchors (ADR-0023). A row under the making bar carries †
// and its attempt count stays visible (ADR-0081); nothing is hidden and no
// row compares itself to another. Formats only (ADR-0011).

import type { TeamGameRow } from '../domain/aggregateTeam'
import { formatGameDate, formatMatchup, formatSignedGap } from '../format'
import { TEAM_COPY } from '../teams/copy'
import type { TeamConfig } from '../teams/registry'
import { teamGameUrl } from '../teams/urls'

export function TeamLedgerTable({ team, rows }: { team: TeamConfig; rows: readonly TeamGameRow[] }) {
  const anyThin = rows.some((r) => r.thinSample)
  return (
    <div className="table-panel team-ledger-panel">
      <div className="zone-scroll">
        <table className="zone-table team-ledger-table" aria-label="Game ledger, newest first">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Opp</th>
              <th scope="col">Result</th>
              <th scope="col">FG</th>
              <th scope="col">FT</th>
              <th scope="col">Shots</th>
              <th scope="col">Selection Δ</th>
              <th scope="col">Conversion Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.gameId}>
                <th scope="row">
                  <a href={teamGameUrl(team, r.gameId)}>{formatGameDate(r.gameDate)}</a>
                </th>
                <td>{formatMatchup(r.opponent, r.home)}</td>
                <td>
                  {r.won ? 'W' : 'L'} {r.teamScore}–{r.opponentScore}
                </td>
                <td>
                  {r.fgm}–{r.fga}
                </td>
                <td>
                  {r.ftm}–{r.fta}
                </td>
                <td>
                  {r.shots}
                  {r.thinSample ? '†' : ''}
                </td>
                <td>
                  {formatSignedGap(
                    r.metrics.selection.playerDietExpectedPps,
                    r.metrics.selection.leagueDietExpectedPps,
                    2,
                  )}
                </td>
                <td>
                  {formatSignedGap(
                    r.metrics.making.actualPps,
                    r.metrics.selection.playerDietExpectedPps,
                    2,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        Selection Δ is expected points per shot from the game’s shot diet minus the league diet’s;
        Conversion Δ is actual points per shot minus that expectation. Both in points per shot.
        {anyThin ? ` ${TEAM_COPY.ledgerThinNote}` : ''}
      </p>
    </div>
  )
}
