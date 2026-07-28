// The shared site footer (ROADMAP launch item 4): one sign-off surface on
// every page — the tagline and the outward social row. Rendered as a
// SIBLING of <main>, so it lands as a real contentinfo landmark and spans
// the shell edge-to-edge on both pages. Outward links live here and never
// in the navbar (ADR-0065); hero pages lead with the way back to the
// directory (ADR-0022: after the argument, never chrome above it), while
// the index IS the directory and renders no back link.
import { indexUrl } from '../heroes/urls'
import { SocialLinks } from './SocialLinks'

export function SiteFooter({ directoryLink = false }: { directoryLink?: boolean }) {
  return (
    <footer className="site-footer">
      {directoryLink && (
        <a className="footer-back" href={indexUrl()}>
          ← All players
        </a>
      )}
      <p>One question per player · verdict first, evidence after</p>
      <SocialLinks />
    </footer>
  )
}
