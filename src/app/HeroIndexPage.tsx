import { useEffect } from 'react'
import { HEROES } from '../heroes/registry'
import { indexMetaOf } from '../heroes/types'
import { headshotUrl, heroPageUrl } from '../heroes/urls'
import { SiteNav } from './SiteNav'

// The hero index (ADR-0022/0065): a directory of arguments, deliberately not
// a switcher (ADR-0018). The directory shows WHO is on file — the first
// registered hero as a full-width marquee (registry order is the directory
// order, so first place is the cover story), the rest as a name-only rail —
// built from each hero's standard NBA headshot on a controlled dark ground.
// The action poster stays the hero page's asset: faces answer "who's here",
// the poster argues the thesis. Everything reads straight off the registry:
// registering a hero is what publishes its face here.

export function HeroIndexPage({ unknownPath }: { unknownPath?: string }) {
  useEffect(() => {
    document.title = 'Good Shots · one player at a time'
  }, [])

  const featured = HEROES[0]!
  const rest = HEROES.slice(1)

  return (
    <main className="index-page">
      <SiteNav />
      {/* The document-outline h1 is the site name; the marquee name below is
          the visual headline. */}
      <h1 className="sr-only">Good Shots</h1>
      {unknownPath !== undefined && (
        <p className="page-status index-miss">
          No player lives at “/{unknownPath}”. The directory is below.
        </p>
      )}
      <a className="index-marquee" href={heroPageUrl(featured)}>
        {/* Decorative: the adjacent text carries the name, so a repeated
            alt would double every screen-reader announcement. */}
        <img src={headshotUrl(featured)} alt="" />
        <span className="index-marquee-text">
          <span className="index-meta">{indexMetaOf(featured)}</span>
          <span className="index-marquee-name">{featured.playerName}</span>
          <span className="index-cue">Is he taking good shots? → The verdict</span>
        </span>
      </a>
      {/* The rail heading names its section via aria-labelledby (the house
          pattern): an aria-label beside a visible heading would give screen
          readers different words than the page shows. "Verdicts" is the
          product's own payoff word, established by the marquee's cue
          directly above — the rail offers more of the same argument, not a
          leftovers bin. */}
      {rest.length > 0 && (
        <section className="index-rail" aria-labelledby="rail-title">
          <h2 className="index-rail-title" id="rail-title">
            More verdicts
          </h2>
          <ul>
            {rest.map((hero) => (
              <li key={hero.slug}>
                <a className="index-card" href={heroPageUrl(hero)}>
                  <img src={headshotUrl(hero)} alt="" />
                  <span className="index-card-name">{hero.playerName}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="index-footer">
        <p>One question per player · verdict first, evidence after</p>
      </footer>
    </main>
  )
}
