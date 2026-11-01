import './App.css'
import { Analytics } from '@vercel/analytics/react'
import { ComparisonPage } from './app/ComparisonPage'
import { HeroIndexPage } from './app/HeroIndexPage'
import { HeroPage } from './app/HeroPage'
import { MethodologyPage } from './app/MethodologyPage'
import { ARGUMENTS_ROUTE, COMPARE_ROUTE, METHODOLOGY_ROUTE, parseRoute } from './app/routes'
import { PlayerSeasonPage } from './app/PlayerSeasonPage'
import { PlayersNightPage } from './app/PlayersNightPage'
import { ReportCardPage } from './app/ReportCardPage'
import { parseTeamRoute } from './app/teamRoute'
import { TeamPage } from './app/TeamPage'
import { heroBySlug } from './heroes/registry'
import { canonicalSeasonOf } from './heroes/types'
import { HOME_TEAM, teamBySlug } from './teams/registry'

function App() {
    // Read once at render: navigation between pages is full page loads
    // (plain anchors, ADR-0022), so the path never changes while mounted.
    const route = parseRoute(window.location.pathname, import.meta.env.BASE_URL)
    // The site root is the home team's canonical season (ADR-0087, amending
    // ADR-0022): the same page /jazz renders, in place, never a redirect.
    // The directory of arguments lives at /arguments, and each hero is a
    // directory of season arguments (ADR-0060): /<slug> renders the canonical
    // season in place, /<slug>/<season> a specific season argument. An
    // unknown path, hero or season, renders the directory with a quiet note.
    if (route.slug === '') {
        return (
            <>
                <TeamPage team={HOME_TEAM} season={HOME_TEAM.canonicalSeason} />
                <Analytics />
            </>
        )
    }
    if (route.slug === ARGUMENTS_ROUTE && route.season === undefined) {
        return (
            <>
                <HeroIndexPage />
                <Analytics />
            </>
        )
    }
    // The methodology page (ADR-0071): a static route beside the directory,
    // resolved before the registry so a hero slug can never shadow it (the
    // reserved-route guard in registry.test.ts forbids the collision from
    // the other side). A deeper path under it is nobody's page and falls
    // through to the directory's unknown-path note.
    if (route.slug === METHODOLOGY_ROUTE && route.season === undefined) {
        return (
            <>
                <MethodologyPage />
                <Analytics />
            </>
        )
    }
    // The retired game cards (ADR-0096) render nothing here: vercel.json
    // forwards /game and the three Jazz heroes' cards before the app loads,
    // and any other /game path falls to the directory's unknown-path note.
    // The comparison page (ADR-0076): the second reserved static route,
    // resolved before the registry like the methodology page. Its state
    // lives entirely in the query string — comparisonRoute.ts reads it; the
    // path itself carries nothing. A deeper path under it is nobody's page.
    if (route.slug === COMPARE_ROUTE && route.season === undefined) {
        return (
            <>
                <ComparisonPage />
                <Analytics />
            </>
        )
    }
    // The team surface (ADR-0081/0082): a reserved team slug resolved before
    // the registry. teamRoute.ts reads the segments after it: /jazz renders
    // the canonical team season in place, /jazz/<season> a season with
    // deployed payloads, /jazz/<game-slug> a report card, /jazz/<gameId>
    // (the first team page's links) the same card, /jazz/<player-slug> a
    // player's canonical season and /jazz/<season>/<player-slug> its
    // permalink (ADR-0095), and /jazz/<game-slug>/<player-slug> his night in
    // that game (ADR-0096). A three-segment path arrives whole in the
    // route's slug (parseRoute keeps deeper paths together). Anything else
    // under the team slug is nobody's page.
    const [teamSegment, ...deeper] = route.slug.split('/')
    const team = teamBySlug(teamSegment!)
    if (team !== undefined) {
        const teamRoute =
            deeper.length === 0
                ? parseTeamRoute(route.season)
                : deeper.length === 2
                  ? parseTeamRoute(deeper[0], deeper[1])
                  : ({ kind: 'unknown' } as const)
        if (teamRoute.kind === 'player' || teamRoute.kind === 'seasonPlayer') {
            return (
                <>
                    <PlayerSeasonPage
                        team={team}
                        season={teamRoute.kind === 'player' ? team.canonicalSeason : teamRoute.season}
                        slug={teamRoute.slug}
                    />
                    <Analytics />
                </>
            )
        }
        if (teamRoute.kind === 'night') {
            return (
                <>
                    <PlayersNightPage team={team} route={teamRoute} />
                    <Analytics />
                </>
            )
        }
        if (teamRoute.kind === 'canonical') {
            return (
                <>
                    <TeamPage team={team} season={team.canonicalSeason} />
                    <Analytics />
                </>
            )
        }
        if (teamRoute.kind === 'game' || teamRoute.kind === 'gameId') {
            return (
                <>
                    <ReportCardPage team={team} route={teamRoute} />
                    <Analytics />
                </>
            )
        }
        if (teamRoute.kind === 'season' && team.seasons.includes(teamRoute.season)) {
            return (
                <>
                    <TeamPage team={team} season={teamRoute.season} />
                    <Analytics />
                </>
            )
        }
        return (
            <>
                <HeroIndexPage unknownPath={route.season === undefined ? route.slug : `${route.slug}/${route.season}`} />
                <Analytics />
            </>
        )
    }
    const hero = heroBySlug(route.slug)
    const seasonConfig =
        hero === undefined
            ? undefined
            : route.season === undefined
              ? canonicalSeasonOf(hero)
              : hero.seasons.find((s) => s.season === route.season)
    if (hero === undefined || seasonConfig === undefined) {
        const unknownPath =
            route.season === undefined ? route.slug : `${route.slug}/${route.season}`
        return (
            <>
                <HeroIndexPage unknownPath={unknownPath} />
                <Analytics />
            </>
        )
    }
    return (
        <>
            <HeroPage hero={hero} seasonConfig={seasonConfig} />
            <Analytics />
        </>
    )
}

export default App
