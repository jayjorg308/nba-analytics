// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { canonicalSeasonOf } from '../heroes/types'
import { HeroIndexPage } from './HeroIndexPage'

afterEach(cleanup)

describe('HeroIndexPage (the directory of arguments, ADR-0022)', () => {
  it('renders one tile per registered hero: link, photo, thesis, kicker', () => {
    render(<HeroIndexPage />)

    const tiles = screen.getAllByRole('link')
    expect(tiles).toHaveLength(HEROES.length)

    for (const hero of HEROES) {
      // The tile links to the hero's own URL — a directory of complete
      // pages, never a switcher (ADR-0018).
      const tile = tiles.find(
        (a) => a.getAttribute('href') === `/${hero.slug}`,
      )
      expect(tile, hero.slug).toBeDefined()
      // The tile is the hero banner at directory scale: same photo (alt
      // travels with it), thesis as the poster title, kicker beneath.
      screen.getByAltText(hero.hero.imageAlt)
      screen.getByText(hero.thesis)
      screen.getByText(canonicalSeasonOf(hero).kicker)
    }
  })

  it('states a registry miss plainly and still shows the directory', () => {
    render(<HeroIndexPage unknownPath="keyonte-george" />)
    screen.getByText(/No player lives at/)
    expect(screen.getAllByRole('link')).toHaveLength(HEROES.length)
  })

  it('has no hero switcher: navigation is plain links only', () => {
    render(<HeroIndexPage />)
    expect(document.querySelector('select')).toBeNull()
    expect(document.querySelector('button')).toBeNull()
  })
})
