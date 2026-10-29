import './App.css'
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { ComparisonPage } from './app/ComparisonPage'
import { HeroIndexPage } from './app/HeroIndexPage'
import { HeroPage } from './app/HeroPage'
import { MethodologyPage } from './app/MethodologyPage'
import { GameCardPage } from './app/GameCardPage'
import { GameLandingPage } from './app/GameLandingPage'
import { COMPARE_ROUTE, METHODOLOGY_ROUTE, parseGameRoute, parseRoute } from './app/routes'
import { PlayerSeasonPage } from './app/PlayerSeasonPage'
import { ReportCardPage } from './app/ReportCardPage'
import { parseTeamRoute } from './app/teamRoute'
import { TeamPage } from './app/TeamPage'
import { heroBySlug } from './heroes/registry'
import { canonicalSeasonOf } from './heroes/types'
import { teamBySlug, utahJazz } from './teams/registry'

// PROTOTYPE hook (throwaway): the Jazz home variants at /?variant= and
// /jazz?variant=, dev builds only; the production build drops the branch.
const PrototypeJazzHome = import.meta.env.DEV
    ? lazy(() => import('./app/PROTOTYPE_JazzHome').then((m) => ({ default: m.PrototypeJazzHome })))
    : null
const PROTOTYPE_VARIANT = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('variant') : null

function prototypeHome(current: ReactNode): ReactNode | null {
    if (PrototypeJazzHome === null || PROTOTYPE_VARIANT === null) return null
    return (
        <Suspense fallback={null}>
            <PrototypeJazzHome team={utahJazz} current={current} initial={PROTOTYPE_VARIANT} />
        </Suspense>
    )
}

function App() {
    // Read once at render: navigation between pages is full page loads
    // (plain anchors, ADR-0022), so the path never changes while mounted.
    const route = parseRoute(window.location.pathname, import.meta.env.BASE_URL)
    if (route.slug === '' || (route.slug === 'jazz' && route.season === undefined)) {
        const proto = prototypeHome(
            route.slug === '' ? <HeroIndexPage /> : <TeamPage team={utahJazz} season={utahJazz.canonicalSeason} />,
        )
        if (proto !== null) return proto
    }
    // The hero index is the site root (ADR-0022): the root renders the
    // directory of arguments, and each hero is a directory of season
    // arguments (ADR-0060) — /<slug> renders the canonical season in place,
    // /<slug>/<season> a specific season argument. An unknown path — hero or
    // season — renders the directory with a quiet note.
    if (route.slug === '') {
        return (
            <>
                <HeroIndexPage />
                <Analytics />
            </>
        )
    }
    // The methodology page (ADR-0071): the one static route beside the
    // directory, resolved before the registry so a hero slug can never
    // shadow it (the reserved-route guard in registry.test.ts forbids the
    // collision from the other side). A deeper path under it is nobody's
    // page and falls through to the directory's unknown-path note.
    if (route.slug === METHODOLOGY_ROUTE && route.season === undefined) {
        return (
            <>
                <MethodologyPage />
                <Analytics />
            </>
        )
    }
    // Game cards (ADR-0086): the third reserved route family — /game is the
    // landing, /game/<slug>/<date> a card. Resolved before the registry like
    // every reserved route; a malformed game path falls through to the
    // directory's unknown-path note. Deliberately UNLINKED from the directory
    // since the Jazz-site integration: the family retires in phase 3 of
    // docs/plans/jazz-first-site.md (the Jazz player's night replaces it), so
    // no page advertises URLs that are about to go. Reachable by URL only.
    const gameRoute = parseGameRoute(window.location.pathname, import.meta.env.BASE_URL)
    if (gameRoute?.kind === 'landing') {
        return (
            <>
                <GameLandingPage />
                <Analytics />
            </>
        )
    }
    if (gameRoute?.kind === 'card') {
        return (
            <>
                <GameCardPage slug={gameRoute.slug} date={gameRoute.date} />
                <Analytics />
            </>
        )
    }
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
    // permalink (ADR-0095). A three-segment path arrives whole in the
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
