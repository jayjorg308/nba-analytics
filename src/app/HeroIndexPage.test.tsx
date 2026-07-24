// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { canonicalSeasonOf, indexMetaOf } from '../heroes/types'
import { HeroIndexPage } from './HeroIndexPage'

afterEach(cleanup)

describe('HeroIndexPage (the directory of arguments, ADR-0022/0065)', () => {
  it('marquees the first registered hero and rails the rest, all as plain links', () => {
    render(<HeroIndexPage />)

    // Every registered hero links to its own page, plus the navbar wordmark
    // home link — a directory of complete pages, never a switcher (ADR-0018).
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(HEROES.length + 1)
    screen.getByRole('link', { name: 'Good Shots' })

    for (const [i, hero] of HEROES.entries()) {
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
    expect(screen.getAllByRole('link')).toHaveLength(HEROES.length + 1)
  })

  it('has no hero switcher: navigation is plain links only', () => {
    render(<HeroIndexPage />)
    expect(document.querySelector('select')).toBeNull()
    expect(document.querySelector('button')).toBeNull()
  })
})
