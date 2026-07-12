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
    const hero = slug === '' ? undefined : heroBySlug(slug)
    return (
        <>
            {slug === '' ? (
                <HeroIndexPage />
            ) : hero ? (
                <HeroPage hero={hero} />
            ) : (
                // No such hero: the directory is the natural landing — with
                // the miss stated plainly, never silently swallowed.
                <HeroIndexPage unknownPath={slug} />
            )}
            <Analytics />
        </>
    )
}

export default App
