// The shared site footer (ROADMAP launch item 4; re-formed under ADR-0071's
// amendment): three registered zones — utility links left, the tagline
// dead-center, the outward social rings right — so the tagline sits in the
// same place on every page regardless of which utility links render. One
// ring grammar carries both ends, with one adaptive rule: a utility that
// stands ALONE in its zone spells itself out as a labeled pill (the ring
// recipe stretched), while utilities in company compress to icon rings —
// so a single unlabeled glyph never floats by itself. The way back to the
// directory (ADR-0022: after the argument, never chrome above it) and the
// methodology page (ADR-0071) are the two utilities. Rendered as a SIBLING
// of <main>, so it lands as a real contentinfo landmark and spans the
// shell edge-to-edge on every page. Outward links live here and never in
// the navbar (ADR-0065); the index IS the directory and renders no back
// link, and the methodology page renders no self-link.
import { indexUrl, methodologyUrl } from '../heroes/urls'
import { SocialLinks } from './SocialLinks'

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
} as const

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/* The way back: a plain left arrow. */
const BACK_ICON = (
  <svg {...ICON_PROPS} {...STROKE_PROPS}>
    <path d="M19.5 12h-15" />
    <path d="m10.6 5.9-6.1 6.1 6.1 6.1" />
  </svg>
)

/* The open book: the methodology page is the site's one reading surface,
   and the glyph says so — chosen over the info "i" (generic) and the
   question mark (reads as help; its question-motif charm only worked
   unlabeled) in a three-way comparison on the live footer. */
const METHODOLOGY_ICON = (
  <svg {...ICON_PROPS} {...STROKE_PROPS}>
    <path d="M2.8 5.8c1.3-.7 2.8-1.1 4.4-1.1 1.8 0 3.5.5 4.8 1.4v13.2c-1.3-.9-3-1.4-4.8-1.4-1.6 0-3.1.4-4.4 1.1V5.8Z" />
    <path d="M21.2 5.8c-1.3-.7-2.8-1.1-4.4-1.1-1.8 0-3.5.5-4.8 1.4v13.2c1.3-.9 3-1.4 4.8-1.4 1.6 0 3.1.4 4.4 1.1V5.8Z" />
  </svg>
)

/* Alone in the zone, a utility carries its label in a pill; in company it
   compresses to an icon ring whose aria-label carries the name. */
function UtilityLink({
  href,
  label,
  icon,
  solo,
}: {
  href: string
  label: string
  icon: React.ReactNode
  solo: boolean
}) {
  if (solo) {
    return (
      <a className="footer-ring footer-pill" href={href}>
        {icon}
        <span>{label}</span>
      </a>
    )
  }
  return (
    <a className="footer-ring" href={href} aria-label={label} title={label}>
      {icon}
    </a>
  )
}

export function SiteFooter({
  directoryLink = false,
  methodologyLink = true,
}: {
  directoryLink?: boolean
  /** Default-on so every page carries the way to the methodology page; the
   * methodology page itself opts out (never-links-to-itself, the index's
   * own rule — its side guarded by the page test, the index's by the
   * chrome-link count). */
  methodologyLink?: boolean
}) {
  const solo = Number(directoryLink) + Number(methodologyLink) === 1
  return (
    <footer className="site-footer">
      <div className="footer-utility">
        {directoryLink && (
          <UtilityLink href={indexUrl()} label="All players" icon={BACK_ICON} solo={solo} />
        )}
        {methodologyLink && (
          <UtilityLink
            href={methodologyUrl()}
            label="Methodology"
            icon={METHODOLOGY_ICON}
            solo={solo}
          />
        )}
      </div>
      <p>One question per player · verdict first, evidence after</p>
      <SocialLinks />
    </footer>
  )
}
