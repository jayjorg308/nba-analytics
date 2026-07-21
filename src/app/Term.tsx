import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GLOSSARY, type TermId } from './glossary'

/** Gap between the trigger and the card's near edge. */
const GAP = 8
/** The card never sits closer than this to a viewport edge. */
const MARGIN = 12

/**
 * A dictionary term (ADR-0052): the wrapped copy renders as a real button —
 * dotted underline, its sentence's own type — and click/tap opens a small
 * definition card. One interaction model on every device (ADR-0027): hover is
 * a visual affordance only, never the opener.
 *
 * The card portals to document.body and positions fixed, so an overflow
 * container around the trigger (.zone-scroll) can never clip it. It prefers
 * sitting below the trigger, flips above when the viewport has no room, and
 * clamps horizontally; any scroll or resize while open repositions it.
 *
 * Dialog contract per ZoneDetailCard: role="dialog", focused on open so
 * Escape works immediately, dismissed by its close button, Escape, or an
 * outside press. Not a focus trap and not aria-modal — a local disclosure.
 * Focus returns to the term on Escape/close-button dismissals; an outside
 * press leaves focus where the reader put it (one card at a time falls out
 * of this: pressing a second term closes the first).
 */
export function Term({ id, children }: { id: TermId; children: ReactNode }) {
  const entry = GLOSSARY[id]
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const dismiss = (returnFocus: boolean) => {
    setOpen(false)
    setPos(null)
    if (returnFocus) triggerRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open) return
    const reposition = () => {
      const trigger = triggerRef.current
      const card = cardRef.current
      if (!trigger || !card) return
      const t = trigger.getBoundingClientRect()
      const width = card.offsetWidth
      const height = card.offsetHeight
      const left = Math.max(
        MARGIN,
        Math.min(t.left + t.width / 2 - width / 2, window.innerWidth - MARGIN - width),
      )
      let top = t.bottom + GAP
      if (top + height > window.innerHeight - MARGIN) top = t.top - GAP - height
      if (top < MARGIN) top = MARGIN // degenerate short viewports: pin, never off-screen
      setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }))
    }
    reposition()
    window.addEventListener('resize', reposition)
    // capture: inner scrollers too (the tables' .zone-scroll), not just the page
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  // Focus once the card is POSITIONED, not merely open: the measuring first
  // pass renders visibility:hidden, and a real browser refuses to focus a
  // hidden element (jsdom doesn't — the visibility gate only shows live).
  // `positioned` stays true across scroll repositions, so no refocus loop.
  const positioned = pos !== null
  useEffect(() => {
    if (open && positioned) cardRef.current?.focus()
  }, [open, positioned])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (cardRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      dismiss(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="term"
        aria-expanded={open}
        aria-haspopup="dialog"
        ref={triggerRef}
        onClick={() => (open ? dismiss(false) : setOpen(true))}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            className="term-popover"
            role="dialog"
            aria-label={`${entry.term} definition`}
            tabIndex={-1}
            ref={cardRef}
            // first pass renders hidden at the origin so the layout effect can
            // measure the card, then position it before paint — no flash
            style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') dismiss(true)
            }}
          >
            <button
              type="button"
              className="term-popover-close"
              aria-label="Close definition"
              onClick={() => dismiss(true)}
            >
              ×
            </button>
            <p className="term-popover-word">{entry.term}</p>
            <p className="term-popover-def">{entry.definition}</p>
          </div>,
          document.body,
        )}
    </>
  )
}
