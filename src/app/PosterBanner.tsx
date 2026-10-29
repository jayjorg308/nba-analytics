// The poster banner (ADR-0021/0025): the site's signature opening, shared by
// every page that leads with one (docs/plans/jazz-home-transition.md,
// Stage 1). The page's h1 rides the banner — a hero's thesis question, a
// game's score — over a kicker, with a scroll cue pinned to the bottom edge.
//
// Three forms of art. A PHOTO keeps the hero treatment exactly: a grayscale
// right-anchored panel in the wide layout, the full first viewport on a
// portrait handheld (the landing screen). TYPE is the poster without a
// photograph (a game before its photo lands, a season without one): content
// height in every layout, so a phone never opens on a screen of black, with
// the team mark ghosted where the photo would sit. A photo from another
// game or season never stands in: its alt text would describe a different
// night. A HEADSHOT is the type poster with the player's standard NBA
// headshot standing at its right edge (a player's tool page, ADR-0095; the
// directory's asset, ADR-0065): decorative beside the name the h1 already
// carries, and hidden, never a placeholder, when the file is missing.

import type { CSSProperties, ReactNode } from 'react'

export type PosterArt =
  | {
      kind: 'photo'
      src: string
      /** Authored alt text (ADR-0021's house form, VOICE.md's banner rules). */
      alt: string
      /** Focal point for the narrow full-bleed poster. */
      position: string
      /** Focal point for the wide right-anchored panel. */
      positionWide: string
    }
  | { kind: 'type' }
  | { kind: 'headshot'; src: string }

export function PosterBanner({
  art,
  logoUrl,
  kicker,
  title,
  cue,
  credit,
  className,
}: {
  art: PosterArt
  /** The normalized team mark: a faint watermark, never content. */
  logoUrl: string | null
  kicker: string
  title: ReactNode
  /** The scroll affordance's words; decorative, so hidden from AT. */
  cue: string
  /** A photo's reader-facing credit line, rendered under the banner where
   * the page credits its own photograph (a game's, decision 5); hero
   * banners are credited on the methodology page instead (ADR-0071). */
  credit?: string
  /** A page-specific modifier on the banner (its title's shape). */
  className?: string
}) {
  const classes = [
    'hero-banner',
    art.kind !== 'photo' && 'poster-type',
    art.kind === 'headshot' && 'poster-headshot',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <>
      <header className={classes}>
        {art.kind === 'headshot' && (
          <img
            className="poster-headshot-img"
            src={art.src}
            alt=""
            aria-hidden="true"
            onError={(e) => {
              e.currentTarget.hidden = true
            }}
          />
        )}
        {art.kind === 'photo' && (
          <img
            className="hero-banner-photo"
            src={art.src}
            alt={art.alt}
            // Focal points as custom properties so the stylesheet can pick per
            // layout (inline object-position would defeat the media query).
            style={
              {
                '--hero-pos': art.position,
                '--hero-pos-wide': art.positionWide,
              } as CSSProperties
            }
            fetchPriority="high"
          />
        )}
        {logoUrl && (
          // Decorative team mark: the stylesheet ghosts it into the wide
          // layout's dark left column (photo) or where the photo would sit
          // (type), and hides it on the narrow photo poster.
          <img className="hero-banner-logo" src={logoUrl} alt="" aria-hidden="true" />
        )}
        <div className="hero-banner-overlay">
          {/* Kicker + title flex as one block so the cue can sit outside it,
              pinned to the banner's bottom edge in both layouts — it is a
              scroll affordance, not part of the title. */}
          <div className="hero-banner-text">
            <p className="hero-kicker">{kicker}</p>
            <h1 className="hero-title">{title}</h1>
          </div>
          <p className="hero-cue" aria-hidden="true">
            {cue}
          </p>
        </div>
      </header>
      {art.kind === 'photo' && credit !== undefined && <p className="poster-credit">{credit}</p>}
    </>
  )
}
