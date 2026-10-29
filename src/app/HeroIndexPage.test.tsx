// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { directoryOrder, HEROES } from '../heroes/registry'
import { canonicalSeasonOf, indexMetaOf } from '../heroes/types'
import { HOME_TEAM } from '../teams/registry'
import { HeroIndexPage } from './HeroIndexPage'

afterEach(cleanup)

// Non-hero links on the index: the navbar wordmark, the blurb's methodology
// link and the footer's Methodology link (ADR-0071), the comparison
// discovery link (comparison plan §5), plus the footer's three social links
// (Instagram, X, contact email). The count also guards that the shared
// footer renders no Arguments link here — the page IS the directory
// (ROADMAP launch item 4; at /arguments since ADR-0087).
const CHROME_LINKS = 7

// The directory's order (ADR-0087): the home team's arguments first.
const ORDERED = directoryOrder(HOME_TEAM.slug)

describe('HeroIndexPage (the directory of arguments, ADR-0022/0065/0087)', () => {
  it('marquees the first registered hero and rails the rest, all as plain links', () => {
    render(<HeroIndexPage />)

    // Every registered hero links to its own page, plus the site chrome:
    // the navbar wordmark home link and the footer's three social links —
    // a directory of complete pages, never a switcher (ADR-0018).
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(HEROES.length + CHROME_LINKS)
    // The wordmark is now an image; its alt keeps the link's accessible
    // name, so the way home still reads "Good Shots".
    screen.getByRole('link', { name: 'Good Shots' })
    // The footer's outward links (footer only — the navbar stays a single
    // plain anchor, ADR-0065).
    screen.getByRole('link', { name: 'Instagram' })
    screen.getByRole('link', { name: 'X (formerly Twitter)' })
    expect(
      screen.getByRole('link', { name: 'Email' }).getAttribute('href'),
    ).toMatch(/^mailto:/)
    // The two ways to the methodology page (ADR-0071): the blurb's cue
    // link between the marquee and the rail, and the footer's ring —
    // deliberately distinct accessible names, so each is queryable alone.
    expect(
      screen.getByRole('link', { name: /how the argument works/i }).getAttribute('href'),
    ).toBe('/methodology')
    expect(
      screen.getByRole('link', { name: 'Methodology' }).getAttribute('href'),
    ).toBe('/methodology')
    // The comparison discovery link (comparison plan §5): a plain anchor to
    // the bare setup state.
    expect(
      screen.getByRole('link', { name: /compare players/i }).getAttribute('href'),
    ).toBe('/compare')

    // The featured name is a real heading (ROADMAP launch item 3): heading
    // navigation must reach the page's most important item, not skip from
    // the hidden site h1 straight to the rail.
    screen.getByRole('heading', { level: 2, name: ORDERED[0]!.playerName })
    expect(document.title).toBe('Arguments · Good Shots')

    for (const [i, hero] of ORDERED.entries()) {
      const link = links.find((a) => a.getAttribute('href') === `/${hero.slug}`)
      expect(link, hero.slug).toBeDefined()
      // Name-led (ADR-0065): the player's name is the tile copy; the thesis
      // stays the hero page's h1.
      expect(link!.textContent).toContain(hero.playerName)
      // The headshot is the directory's asset; decorative (alt=""), the
      // adjacent name carries the accessible text.
      const img = link!.querySelector('img')
      expect(img?.getAttribute('src'), hero.slug).toBe(`/${hero.hero.headshotPath}`)
      expect(img?.getAttribute('alt')).toBe('')
      // Only the marquee carries the meta eyebrow; rail cards are name-only.
      if (i === 0) {
        expect(link!.textContent).toContain(indexMetaOf(hero))
      }
    }
  })

  it('lists the home team’s arguments first, each group in registry order (ADR-0087)', () => {
    render(<HeroIndexPage />)
    const isHome = (slug: string) =>
      HEROES.find((h) => h.slug === slug)!.seasons.some((s) => s.teamPage === HOME_TEAM.slug)
    const hrefs = [...document.querySelectorAll('.index-marquee, .index-card')].map((a) =>
      a.getAttribute('href')!.slice(1),
    )
    expect(hrefs).toEqual(ORDERED.map((h) => h.slug))
    const firstOther = hrefs.findIndex((slug) => !isHome(slug))
    expect(hrefs.slice(0, firstOther).every(isHome)).toBe(true)
    expect(hrefs.slice(firstOther).some(isHome)).toBe(false)
    expect(hrefs.slice(0, firstOther)).toEqual(HEROES.filter((h) => isHome(h.slug)).map((h) => h.slug))
    // The page never links to itself.
    expect(screen.queryByRole('link', { name: 'Arguments' })).toBeNull()
  })

  it('carries no team marks anywhere (ADR-0065 amendment: considered, declined)', () => {
    render(<HeroIndexPage />)
    // Explored 2026-07-28 (behind the marquee name, then in the banner's
    // own watermark grammar, plus two rail treatments) and declined: the
    // derived eyebrow already names the team, and the directory's
    // restraint is the point. Re-adding a mark means revisiting that
    // amendment, not just filling a CSS slot.
    expect(document.querySelectorAll('img[src*="-logo"]')).toHaveLength(0)
    // Every card img is a headshot: exactly one per rail card.
    expect(document.querySelectorAll('.index-card img')).toHaveLength(HEROES.length - 1)
  })

  it('derives a name-free, season-bearing meta line from every kicker (ADR-0065)', () => {
    // The eyebrow is derived from the authored kicker; this holds the
    // derivation to the kicker shape so a differently-shaped kicker fails
    // here instead of shipping a broken eyebrow.
    for (const hero of HEROES) {
      const meta = indexMetaOf(hero)
      expect(meta.length, hero.slug).toBeGreaterThan(0)
      expect(meta.toLowerCase()).not.toContain(hero.playerName.toLowerCase())
      expect(meta).toContain(canonicalSeasonOf(hero).season)
    }
  })

  it('states a registry miss plainly and still shows the directory', () => {
    render(<HeroIndexPage unknownPath="keyonte-george" />)
    screen.getByText(/No player lives at/)
    expect(screen.getAllByRole('link')).toHaveLength(HEROES.length + CHROME_LINKS)
  })

  it('has no hero switcher: navigation is plain links only', () => {
    render(<HeroIndexPage />)
    expect(document.querySelector('select')).toBeNull()
    expect(document.querySelector('button')).toBeNull()
  })
})
