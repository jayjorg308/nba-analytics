// The /game landing (ADR-0081): the card roster's picker, in the compare
// pattern — the directory links here, each roster entry links its player's
// latest card, and prev/next on the card browses the season from there.
// Reads the committed roster index; heroes and (phase 2) non-hero roster
// players list identically.

import { useEffect } from 'react'
import { formatGameDate } from '../format'
import { gameCardUrl, gameLogIndexUrl } from '../heroes/urls'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { useGameLogIndex } from './usePayload'

export function GameLandingPage() {
  const state = useGameLogIndex(gameLogIndexUrl())
  useEffect(() => {
    document.title = 'Game cards · Good Shots'
  }, [])
  return (
    <>
      <main className="gamecard-page">
        <SiteNav />
        <header className="gamecard-header">
          <p className="section-kicker">GAME CARDS</p>
          <h1>One night, priced</h1>
          <p className="gamecard-deck">
            A player's game as the numbers this site tracks: what his shot choices were worth
            at league rates, what he scored on them, and the trips his fouls created. Pick a
            player to open his latest card, then browse game to game.
          </p>
        </header>
        {state.status === 'error' && (
          <p className="page-status page-error">{state.message}</p>
        )}
        {state.status === 'ready' && (
          <ul className="gamecard-roster">
            {state.payload.rosters.map((entry) => (
              <li key={`${entry.slug}/${entry.season}`}>
                <a href={gameCardUrl(entry.slug, entry.dataThrough)}>{entry.player}</a>
                <span>
                  {entry.season} · {entry.totalGames} games · through{' '}
                  {formatGameDate(entry.dataThrough)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter directoryLink />
    </>
  )
}
