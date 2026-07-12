import { useEffect, type CSSProperties } from 'react'
import { HEROES } from '../heroes/registry'
import { heroImageUrl, heroPageUrl } from '../heroes/urls'

// The hero index (ADR-0022): a directory of arguments, deliberately not a
// switcher (ADR-0018). Each tile is a hero's banner at directory scale —
// same photo, same poster type carrying the thesis — linking to the complete
// argument at its own URL. Tiles read straight off the registry: registering
// a hero is all it takes to appear here.

export function HeroIndexPage({ unknownPath }: { unknownPath?: string }) {
  useEffect(() => {
    document.title = 'Shot selection · the player files'
  }, [])

  return (
    <main className="index-page">
      {unknownPath !== undefined && (
        <p className="page-status">
          No player lives at “/{unknownPath}” — the directory is below.
        </p>
      )}
      <header className="index-header">
        <p className="index-kicker">Shot selection · vs league average</p>
        <h1 className="index-title">One player at a time</h1>
        <p className="index-deck">
          Each page asks one question of one player’s season — is he taking
          good shots? — and argues the answer: verdict first, evidence after.
        </p>
      </header>
      <ul className="hero-index">
        {HEROES.map((hero) => (
          <li key={hero.slug}>
            <a className="hero-tile" href={heroPageUrl(hero)}>
              <img
                src={heroImageUrl(hero)}
                alt={hero.hero.imageAlt}
                // The tile is the narrow (full-bleed) banner at small scale,
                // so it reuses that layout's focal point.
                style={{ '--hero-pos': hero.hero.imagePosition } as CSSProperties}
              />
              <span className="hero-tile-overlay">
                <span className="hero-tile-kicker">{hero.hero.kicker}</span>
                <span className="hero-tile-title">{hero.thesis}</span>
                <span className="hero-tile-cue" aria-hidden="true">
                  → The verdict
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
