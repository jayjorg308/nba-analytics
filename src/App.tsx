import './App.css'
import { Analytics } from '@vercel/analytics/react'
import { HeroPage } from './app/HeroPage'
import { routeSlug } from './app/routes'
import { HEROES, heroBySlug } from './heroes/registry'

function App() {
    // Read once at render: navigation between pages is full page loads
    // (plain anchors, ADR-0022), so the path never changes while mounted.
    const slug = routeSlug(window.location.pathname, import.meta.env.BASE_URL)
    // TEMPORARY(single-hero): the hero index is hidden while the Cody
    // Williams page is polished (2026-07-12; revisit after v2/v3 — ROADMAP
    // status note) — the root serves the default hero directly and unknown
    // paths fall back to him instead of the directory. Revert: root renders
    // <HeroIndexPage />, an unknown slug renders
    // <HeroIndexPage unknownPath={slug} /> (component and tests are dormant,
    // not deleted).
    const hero = heroBySlug(slug) ?? HEROES[0]
    return (
        <>
            <HeroPage hero={hero} />
            <Analytics />
        </>
    )
}

export default App
