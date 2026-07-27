// The site navbar (ADR-0065): the wordmark as the one persistent way home,
// fixed over the page top. Over the poster banner it is transparent with
// halo-guaranteed ink (the ADR-0025 recipe — the photo's top edge carries no
// grade); once scrolled it gains a blurred solid ground. A plain anchor,
// deliberately nothing more: cross-hero navigation stays links between
// complete pages, never a switcher (ADR-0018/0022).
//
// The wordmark is the brand lockup as an image asset — the route ADR-0065
// left open (the display face stays at poster scale, so a set-in-type brand
// mark was never an option). The committed asset is a web-sized transparent
// derivation of the branding source (`public/img/goodshots-wordmark.png`,
// from `Good Shots-01.png` whose black plate is opaque); the image's alt is
// the link's accessible name, so the link still reads "Good Shots".

import { useEffect, useState } from 'react'
import { indexUrl } from '../heroes/urls'

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`site-nav${scrolled ? ' site-nav-scrolled' : ''}`} aria-label="Site">
      <a className="site-nav-brand" href={indexUrl()}>
        <img src="/img/goodshots-wordmark.png" alt="Good Shots" />
      </a>
    </nav>
  )
}
