// The site navbar (ADR-0065): the wordmark as the one persistent way home,
// fixed over the page top. Over the poster banner it is transparent with
// halo-guaranteed ink (the ADR-0025 recipe — the photo's top edge carries no
// grade); once scrolled it gains a blurred solid ground. A plain anchor,
// deliberately nothing more: cross-hero navigation stays links between
// complete pages, never a switcher (ADR-0018/0022).

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
        Good Shots
      </a>
    </nav>
  )
}
