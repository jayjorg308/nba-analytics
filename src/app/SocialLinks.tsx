// The footer's outward links: the site's social presence plus a contact
// address. Footer only, by design — ADR-0065's navbar stays a single plain
// anchor, so anything beyond "the way home" lives down here with the
// tagline. Icons are inline SVG on currentColor: no icon font, no external
// request (the self-hosting stance of ADR-0020), and they inherit the
// footer's gray-to-white hover like every quiet link on the site.

const INSTAGRAM_URL = 'https://www.instagram.com/nbagoodshots'
const X_URL = 'https://x.com/nbagoodshots'
const CONTACT_EMAIL = 'jay.jorg308@gmail.com'

type SocialLink = {
  label: string
  href: string
  external: boolean
  icon: React.ReactNode
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
} as const

const LINKS: SocialLink[] = [
  {
    label: 'Instagram',
    href: INSTAGRAM_URL,
    external: true,
    icon: (
      <svg {...ICON_PROPS} fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.2" />
        <circle cx="12" cy="12" r="4.3" />
        <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'X (formerly Twitter)',
    href: X_URL,
    external: true,
    icon: (
      // The X glyph is a solid mark; drawn slightly inset so its visual
      // weight sits level with the stroked icons beside it.
      <svg {...ICON_PROPS} fill="currentColor">
        <path d="M17.55 3.75h2.6l-5.68 6.5 6.68 8.84h-5.23l-4.1-5.36-4.69 5.36h-2.6l6.07-6.95-6.4-8.39h5.36l3.7 4.9 4.29-4.9Zm-0.91 13.78h1.44L8.68 5.23H7.13l9.51 12.3Z" />
      </svg>
    ),
  },
  {
    label: 'Email',
    href: `mailto:${CONTACT_EMAIL}`,
    external: false,
    icon: (
      <svg {...ICON_PROPS} fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="2.6" y="4.6" width="18.8" height="14.8" rx="2.6" />
        <path d="m3.4 6.8 8.6 6.4 8.6-6.4" />
      </svg>
    ),
  },
]

export function SocialLinks() {
  return (
    <ul className="footer-social">
      {LINKS.map(({ label, href, external, icon }) => (
        <li key={label}>
          <a
            href={href}
            aria-label={label}
            title={label}
            {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          >
            {icon}
          </a>
        </li>
      ))}
    </ul>
  )
}
