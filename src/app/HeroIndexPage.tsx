import { useEffect } from 'react'
import { HEROES } from '../heroes/registry'
import { indexMetaOf } from '../heroes/types'
import { headshotUrl, heroPageUrl, methodologyUrl } from '../heroes/urls'
import { SiteFooter } from './SiteFooter'
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
    document.title = 'Good Shots'
  }, [])

  const featured = HEROES[0]!
  const rest = HEROES.slice(1)

  return (
    <>
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
              alt would double every screen-reader announcement. Face, name,
              cue, and the derived eyebrow are the marquee's whole content:
              team marks were explored here (behind the name, then in the
              banner's own watermark grammar) and declined — the eyebrow
              already names the team (ADR-0065 amendment, 2026-07-28). */}
          <img src={headshotUrl(featured)} alt="" />
          {/* A div, not a span: the featured name is a real heading (the
              page's most important item must exist in the document outline —
              ROADMAP launch item 3), and a heading needs a flow container. */}
          <div className="index-marquee-text">
            <span className="index-meta">{indexMetaOf(featured)}</span>
            <h2 className="index-marquee-name">{featured.playerName}</h2>
            <span className="index-cue">Is he taking good shots? → The verdict</span>
          </div>
        </a>
        {/* The directory's one line of self-explanation (ADR-0071, launch
            item 2): a cold visitor learns what the site is without the
            marquee gaining a deck. Plain prose and a plain anchor only — no
            heading (the outline stays h1 site → h2 name → h2 rail) and no
            Term popovers (the index renders no buttons; the no-switcher
            test holds it that way). The link stands on its own line in the
            marquee cue's grammar, so it never wraps mid-phrase. */}
        <div className="index-blurb">
          <p>
            Good Shots asks one question of a player's season: “Is he taking good shots?”
            Each page argues its answer, verdict first and evidence after.
          </p>
          <a href={methodologyUrl()}>How the argument works →</a>
        </div>
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
      </main>
      {/* The shared sign-off (a sibling of main — a real contentinfo
          landmark). The index is the directory, so no back link here. */}
      <SiteFooter />
    </>
  )
}
