import './App.css'
import { Analytics } from '@vercel/analytics/react'
import { HeroIndexPage } from './app/HeroIndexPage'
import { HeroPage } from './app/HeroPage'
import { MethodologyPage } from './app/MethodologyPage'
import { METHODOLOGY_ROUTE, parseRoute } from './app/routes'
import { heroBySlug } from './heroes/registry'
import { canonicalSeasonOf } from './heroes/types'

function App() {
    // Read once at render: navigation between pages is full page loads
    // (plain anchors, ADR-0022), so the path never changes while mounted.
    const route = parseRoute(window.location.pathname, import.meta.env.BASE_URL)
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
