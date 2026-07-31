# Image provenance

_This file is the engineering record (URLs, pull dates, derivation notes).
The reader-facing credits render at `/methodology`'s SOURCES section from
each hero config's `imageCredit` field (ADR-0071); the two update together.
**All seven banners are credited as of 2026-07-30**: two recovered by the
credit hunt (Clifford from embedded metadata, Mitchell by reverse-image
match) and the remaining five resolved by the author supplying the
team-site source URLs — which also corrected this file's long-standing
sga-hero.jpg record (see its entry)._

- `public/img/sga-hero.jpg` — photograph by **Jimmy Do, Oklahoma City
  Thunder** (OKC vs Phoenix, Paycom Center, 2026-04-22), from the Thunder's
  team site:
  `cdn.nba.com/teams/uploads/sites/1610612760/2026/04/1-260422_JIMMYDO_OKCPHX_0033.jpg`
  (the filename encodes date, photographer, and matchup; frame verified
  identical to the committed file). **Record correction (2026-07-30):**
  this entry long described the file as "the project's original generated
  Shai action artwork ... a stylized illustration" — that was wrong. The
  likely origin of the confusion is the registration-era THROWAWAY
  generated placeholder the real photo replaced (v2.5 Phase 4); the
  banner is and always was a real game photograph. The author identified
  the true source.
- `public/img/<slug>-headshot.png` (all heroes) — the NBA's standard player
  headshots, downloaded verbatim from
  `cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png` (the `playerId`
  is in the hero's shot payload `_meta`). The directory's asset class
  (ADR-0065); pulled 2026-07-24 for the first four registered heroes, and
  fetched by `hero:add` (ADR-0066) for every hero since — Donovan Mitchell
  2026-07-27.
- `public/img/cle-logo.png` — the Cavaliers' glyph-only primary mark,
  downloaded from `cdn.nba.com/logos/nba/1610612739/primary/L/logo.png`
  (2026-07-27) and normalized to the shared watermark canvas by
  `scripts/normalize_team_logo.py`.
- `public/img/utah-logo.png` — the Jazz's glyph-only primary mark, the same
  official mark the NBA CDN serves at
  `cdn.nba.com/logos/nba/1610612762/primary/L/logo.png` (verified identical
  2026-07-27); committed as a high-resolution rendering on the shared
  normalized canvas.
- `public/img/okc-logo.png` — the Thunder's primary shield, the franchise's
  only official mark; the NBA CDN serves it as SVG only
  (`cdn.nba.com/logos/nba/1610612760/global/L/logo.svg`), committed as a
  high-resolution PNG rendering on the shared normalized canvas.
- `public/img/cody-williams-hero.jpg` — team photograph via the Utah Jazz
  (Jazz vs San Antonio at Delta Center, 2025-26), from the Jazz's team
  site: `cdn.nba.com/teams/uploads/sites/1610612762/2026/04/U5A4008.jpg`
  (a raw camera filename, no photographer credited, no embedded credit
  metadata — the same team-content class as the Ace banner). Committed as
  a 2048px q82 JPEG derivative; source retained in `data/hero-sources/`.
  **Swap note (2026-07-30):** this replaced the original banner (the
  Knicks rim-hang from
  `.../031126_UTAvNYK_GAME_MMH_1240.jpg`, photograph by Melissa Majchrzak,
  NBAE via Getty Images) — swapped deliberately to exit the
  NBAE-via-Getty licensing tier; the Keyonte banner followed the same day
  (see its entry), leaving no committed banner in that tier.
- `public/img/keyonte-george-hero.webp` — team photograph via the Utah
  Jazz (Jazz at Minnesota, 2025-26), from the Jazz's team site:
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/04/U5A3605.jpg`
  (a raw camera filename, no photographer credited, no embedded credit
  metadata — the same team-content class as the Ace and Cody banners).
  Committed as a 2048px q82 webp derivative; source retained in
  `data/hero-sources/`. **Swap note (2026-07-30):** this replaced the
  original banner (the one-handed finish at OKC from
  `.../525_01072026_Jazz_Thunder_Beeker_0240.jpg`, photograph by Zach
  Beeker, NBAE via Getty Images, whose source caption carried the full
  Getty Images License Agreement notice) — the second and final swap out
  of the NBAE-via-Getty licensing tier; no committed banner remains in
  it.
- `public/img/ace-bailey-hero.jpg` — team photograph via the Utah Jazz
  (Jazz at Orlando Magic, Kia Center, 2026-02-07), from the Jazz's team
  site: `cdn.nba.com/teams/uploads/sites/1610612762/2026/04/U5A6952.jpg`
  (a raw camera filename; no photographer credited on the source, so the
  credit stays at team grain). Committed as a 2048px q82 JPEG derivative.
- `public/img/maxime-raynaud-hero.jpg` — photograph by Ray Chavez, Bay Area
  News Group (Kings at Golden State, 2025-26); committed as a web-sized
  2048px JPEG derivative of the author-supplied source (ADR-0021).
- `public/img/nique-clifford-hero.webp` — wire photograph by Troy Wayrynen,
  Imagn Images via Reuters Connect (Kings at Trail Blazers, Moda Center,
  2026-04-12; transmission ref IMAGN-1295913). Recovered 2026-07-30 from
  the committed file's own embedded XMP credit metadata, which the webp
  derivation preserved.
- `public/img/donovan-mitchell-hero.webp` — photograph by Ken Blaze, Imagn
  Images (Cavaliers vs Pacers, game one of the second round, 2025 NBA
  playoffs, Rocket Arena, 2025-05-04; wire ID USATSI 26094611). Identified
  2026-07-30 by exact-match reverse-image search (TinEye → the same frame
  captioned with its mandatory credit on si.com); committed as a 2048px
  webp derivative of `data/hero-sources/donovan.webp`.
- `public/img/sac-logo.png` — the Kings' primary crown lockup; the NBA CDN
  serves it as SVG only
  (`cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg`, 2026-07-29),
  browser-rasterized and committed on the shared normalized watermark
  canvas (60% footprint).
- `public/img/goodshots-wordmark.png` — the site's own brand lockup, made by
  the author; the committed file is a web-sized transparent derivation of the
  branding source `Good Shots-01.png` (whose black plate is opaque, so the
  undoctored source would ride over the poster as a black box — ADR-0065's
  2026-07-27 amendment).
- **Typefaces** — Public Sans, IBM Plex Mono, and Big Shoulders Display, all
  under the SIL Open Font License, self-hosted from the pinned `@fontsource`
  packages (ADR-0020 chose open-licensed faces over the commercial ones they
  stand in for precisely so self-hosting carries no license exposure). The
  social-card generator reads those same committed `.woff` files rather than
  re-downloading a cousin that could drift, so they are card inputs as much
  as the imagery above and are credited on `/methodology` alongside it.
- `public/social-cards/*.png` — generated derivatives
  (`npm run cards:generate`, ADR-0067) composed entirely from the credited
  headshots above plus the site's own wordmark and the pinned typefaces; no
  external imagery.
