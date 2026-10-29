// @vitest-environment jsdom
// The shared poster banner's two forms (ADR-0094): a photo keeps the hero
// treatment and carries a credit line only where the page credits its own
// photograph; the typographic form draws no photo and no credit, whatever
// is passed. The hero page's markup is held unchanged by HeroPage.test.tsx.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PosterBanner } from './PosterBanner'

afterEach(cleanup)

const photo = {
  kind: 'photo' as const,
  src: '/img/games/2026-10-23-nop.jpg',
  alt: 'A player rises for a layup over a New Orleans defender',
  position: '50% 30%',
  positionWide: '55% 25%',
}

describe('PosterBanner', () => {
  it('draws a photo with its focal points, the h1, the cue, and the credit', () => {
    const { container } = render(
      <PosterBanner
        art={photo}
        logoUrl="/img/utah-logo.png"
        kicker="Utah Jazz · Oct 23, 2026 · vs NOP"
        title="W 120–119"
        cue="↓ The card"
        credit="photograph via the Utah Jazz"
      />,
    )
    const img = screen.getByRole('img', { name: photo.alt })
    expect(img.getAttribute('style')).toContain('--hero-pos-wide: 55% 25%')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('W 120–119')
    expect(container.querySelector('header')!.className).toBe('hero-banner')
    expect(screen.getByText('photograph via the Utah Jazz').className).toBe('poster-credit')
  })

  it('draws the typographic poster with no photo and never a credit', () => {
    const { container } = render(
      <PosterBanner
        art={{ kind: 'type' }}
        logoUrl="/img/utah-logo.png"
        kicker="Utah Jazz · Oct 23, 2026 · vs NOP"
        title="W 120–119"
        cue="↓ The card"
        credit="photograph via the Utah Jazz"
        className="game-poster"
      />,
    )
    expect(container.querySelector('header')!.className).toBe('hero-banner poster-type game-poster')
    expect(container.querySelector('.hero-banner-photo')).toBeNull()
    expect(container.querySelector('.poster-credit')).toBeNull()
    // The mark is decorative, never content.
    expect(container.querySelector('.hero-banner-logo')!.getAttribute('aria-hidden')).toBe('true')
  })
})
