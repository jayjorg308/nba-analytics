import './App.css'
import { Analytics } from '@vercel/analytics/react'
import { HeroIndexPage } from './app/HeroIndexPage'
import { HeroPage } from './app/HeroPage'
import { routeSlug } from './app/routes'
import { heroBySlug } from './heroes/registry'

function App() {
    // Read once at render: navigation between pages is full page loads
    // (plain anchors, ADR-0022), so the path never changes while mounted.
    const slug = routeSlug(window.location.pathname, import.meta.env.BASE_URL)
    // The hero index is the site root (ADR-0022), restored with the fourth
    // hero (v3 Phase 1): the root renders the directory of arguments, an
    // unknown path renders it with a quiet note, and each hero page lives at
    // its own /<slug>.
    if (slug === '') {
        return (
            <>
                <HeroIndexPage />
                <Analytics />
            </>
        )
    }
    const hero = heroBySlug(slug)
    if (!hero) {
        return (
            <>
                <HeroIndexPage unknownPath={slug} />
                <Analytics />
            </>
        )
    }
    return (
        <>
            <HeroPage hero={hero} />
            <Analytics />
        </>
    )
}

export default App
