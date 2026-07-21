// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GLOSSARY } from './glossary'
import { Term } from './Term'

afterEach(cleanup)

describe('Term dictionary popover (ADR-0052)', () => {
  it('renders the wrapped copy as a collapsed trigger button, no card until pressed', () => {
    render(<Term id="shot-diet">shot diet</Term>)
    const trigger = screen.getByRole('button', { name: 'shot diet' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens on click with the definition, focused so Escape works immediately', () => {
    render(<Term id="shot-diet">shot diet</Term>)
    const trigger = screen.getByRole('button', { name: 'shot diet' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Shot diet definition' })
    expect(dialog.textContent).toContain(GLOSSARY['shot-diet'].definition)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // keyboard-ish dismissal returns focus to the term (ZoneDetailCard's contract)
    expect(document.activeElement).toBe(trigger)
  })

  it('closes via the close button, returning focus to the term', () => {
    render(<Term id="making-delta">Making Δ</Term>)
    const trigger = screen.getByRole('button', { name: 'Making Δ' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Close definition' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on an outside press WITHOUT stealing focus back', () => {
    render(<Term id="pps">PPS (lg)</Term>)
    const trigger = screen.getByRole('button', { name: 'PPS (lg)' })
    fireEvent.click(trigger)
    screen.getByRole('dialog', { name: 'PPS (points per shot) definition' })
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    // the reader pressed elsewhere on purpose — focus stays where they put it
    expect(document.activeElement).not.toBe(trigger)
  })

  it('a press inside the card does not dismiss it', () => {
    render(<Term id="pps">PPS</Term>)
    fireEvent.click(screen.getByRole('button', { name: 'PPS' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.pointerDown(dialog)
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('one card at a time: pressing a second term closes the first', () => {
    render(
      <>
        <Term id="catch-and-shoot">Catch and shoot</Term>
        <Term id="pull-up">Pull-ups</Term>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Catch and shoot' }))
    screen.getByRole('dialog', { name: 'Catch and shoot definition' })
    // a real tap fires pointerdown (closing the open card: an outside press)
    // before its click opens the next one
    const second = screen.getByRole('button', { name: 'Pull-ups' })
    fireEvent.pointerDown(second)
    fireEvent.click(second)
    expect(screen.queryByRole('dialog', { name: 'Catch and shoot definition' })).toBeNull()
    screen.getByRole('dialog', { name: 'Pull-up definition' })
  })

  it('pressing the open term again toggles its card closed', () => {
    render(<Term id="fga">FGA</Term>)
    const trigger = screen.getByRole('button', { name: 'FGA' })
    fireEvent.click(trigger)
    screen.getByRole('dialog')
    // the trigger is excluded from the outside-press close, so the second
    // click reaches the toggle instead of racing it
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('every glossary entry carries a headword and a real definition', () => {
    for (const entry of Object.values(GLOSSARY)) {
      expect(entry.term.length).toBeGreaterThan(0)
      // a one-liner is a label, not a definition — insist on a sentence
      expect(entry.definition.length).toBeGreaterThan(40)
    }
  })
})
