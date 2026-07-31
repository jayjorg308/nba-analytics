// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { GLOSSARY } from './glossary'
import { MethodologyPage } from './MethodologyPage'

afterEach(cleanup)

describe('MethodologyPage (the self-explanation surface, ADR-0071)', () => {
  it('renders the whole glossary registry: one source, drift impossible', () => {
    render(<MethodologyPage />)
    const text = document.body.textContent!
    // Iterating the registry itself auto-covers every future entry: a new
    // dictionary term that misses this page is a failed test, not a gap.
    for (const [id, entry] of Object.entries(GLOSSARY)) {
      expect(text, `term of '${id}'`).toContain(entry.term)
      expect(text, `definition of '${id}'`).toContain(entry.definition)
    }
  })

  it('uses no em dash anywhere on the page (punctuation style, whole-body sweep)', () => {
    render(<MethodologyPage />)
    // Safe as a whole-body sweep: this page renders prose and credits only,
    // never the EM_DASH no-data data-cell glyph.
    expect(document.body.textContent).not.toContain('—')
  })

  it('credits every registered banner, stating pending plainly when unknown', () => {
    render(<MethodologyPage />)
    const rows = [...document.querySelectorAll('.methodology-credits li')]
    expect(rows).toHaveLength(HEROES.length)
    for (const hero of HEROES) {
      const row = rows.find((li) => li.textContent!.includes(hero.playerName))
      expect(row, hero.slug).toBeDefined()
      // The dropped-and-counted ethos applied to provenance: an authored
      // credit renders verbatim; an unknown one is stated, never blank.
      expect(row!.textContent).toContain(
        hero.hero.imageCredit ?? 'photograph credit pending',
      )
    }
    const pending = rows.filter((li) => li.textContent!.includes('credit pending'))
    expect(pending).toHaveLength(
      HEROES.filter((h) => h.hero.imageCredit === undefined).length,
    )
  })

  it('never links to itself, and the way back leads the footer', () => {
    render(<MethodologyPage />)
    // The index's never-links-to-itself rule, applied here: the footer
    // renders without its methodology link on this page.
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/methodology')
    }
    expect(
      screen.getByRole('link', { name: 'All players' }).getAttribute('href'),
    ).toBe('/')
  })

  it('prints definitions in place: no Term popovers, no buttons at all', () => {
    render(<MethodologyPage />)
    // A deliberate lock (the index's own discipline): this page IS the
    // definitions surface, so popping definitions over it would be
    // circular. Relax only on purpose, never by drift.
    expect(document.querySelector('button')).toBeNull()
  })

  it('holds the page frame: one h1, a labeled tab, the footer outside main', () => {
    render(<MethodologyPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    // The second exception to the bare-wordmark tab rule (ADR-0071).
    expect(document.title).toBe('Methodology · Good Shots')
    const footer = document.querySelector('footer.site-footer')
    expect(footer).not.toBeNull()
    expect(footer!.closest('main')).toBeNull()
  })
})
