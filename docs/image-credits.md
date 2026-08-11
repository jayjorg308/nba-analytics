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
- `public/img/bub-carrington-hero.jpg` — team photograph via the Washington
  Wizards (vs San Antonio at Capital One Arena, 2025-26; Carrington holds
  the follow-through in the gold City Edition #7), from the team site's
  "Top Pics of the Season" gallery
  (`cdn.nba.com/teams/uploads/sites/1610612764/2026/04/Top-Shots-25-26-Season-Bugged-02.jpg`,
  pulled 2026-08-08; no photographer credited on the source, so the credit
  stays at team grain). Committed as a B&W q82 derivative with the
  gallery's bottom sponsor-bug band cropped away; source retained in
  `data/hero-sources/`.
- `public/img/alex-sarr-hero.jpg` — team photograph via the Washington
  Wizards (vs the LA Lakers, 2025-26; Sarr finishes a two-handed dunk over
  LeBron James in the gold City Edition #20), from the same "Top Pics of
  the Season" gallery
  (`cdn.nba.com/teams/uploads/sites/1610612764/2026/04/Top-Shots-25-26-Season-Bugged-08.jpg`,
  pulled 2026-08-08; no photographer credited on the source). Committed as
  a B&W q82 derivative with the same sponsor-bug crop; source retained in
  `data/hero-sources/`.
- `public/img/was-logo.png` — the Wizards' primary mark; the NBA CDN now
  serves the team logos as SVG only
  (`cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg`, 2026-08-08 — the
  PNG paths that served the Cavaliers mark return 403 as of this pull),
  browser-rasterized and committed on the shared normalized watermark
  canvas (60% footprint) by `scripts/normalize_team_logo.py`; SVG source
  retained in `data/hero-sources/`. **Re-rasterized 2026-08-09:** the first
  rasterization captured the browser's BROKEN-IMAGE placeholder rather than
  the mark (the SVG never loaded), and the 5.9KB white box it produced was
  committed and shipped — both Washington banners rendered a blank
  watermark. The retained SVG was fine; only the raster was wrong, so the
  fix re-rendered from that same source with the SVG inlined into the page
  instead of fetched. Note that `ingestion/test_team_logo_assets.py` PASSED
  on the placeholder: at the time the guard checked only canvas size,
  footprint ratio, and centering, and a centered white box satisfies all
  three — an interface guard, not a content one. **Closed 2026-08-10:** the
  guard now also enforces a minimum ink-edge ratio (contour plus internal
  tonal edges over opaque pixels) that this placeholder fails by ~3x, with
  a synthesized-blank negative case proving the teeth; the threshold's
  derivation, including why a distinct-color count would have failed the
  flat single-color Jazz mark, is the comment block above
  `MIN_INK_EDGE_RATIO` in that test.
- `public/img/austin-reaves-hero.jpg` — team photograph via the Los Angeles
  Lakers (vs Chicago at Crypto.com Arena, 2025-26; Reaves extends to finish
  at the rim over a Bulls defender in the gold Icon #15), from the team
  site's "Basketball Sickos: Best Gametime Moments" gallery
  (`cdn.nba.com/teams/uploads/sites/1610612747/2024/11/005A5622.jpg`, pulled
  2026-08-10; no photographer credited on the source, so the credit stays at
  team grain). Committed as a 2048px q84 derivative, a straight downscale —
  the native 2399x2999 is already the house portrait ratio, so no crop
  judgment enters the asset; source retained in `data/hero-sources/`.
  **Two provenance notes, both load-bearing.** First, `005A5622.jpg` is a
  camera-original filename, and that is the *entire* basis for the team
  credit: most images in the Lakers' galleries are named `GettyImages-*`
  and are Getty-licensed photos the team re-hosted on its own CDN, so
  "via the Lakers" would be false for those. Crediting by host rather than
  by filename would silently put a banner back in the NBAE-via-Getty tier
  the 2026-07-30 sweep cleared. Second, the `2024/11` in the path is a CMS
  upload bucket and **not the game date** — the same folder holds this
  gallery's 2025-26 images. The game was identified from the photograph
  itself: the scoreboard reads 73-67 with 10:19 left in the third, and the
  committed play-by-play for game `0022500960` (2026-03-12, the only
  Lakers-Chicago home game in his season) puts Reaves's 3-foot driving
  layup at Q3 `PT10M17`, taking the score to 75-67. The banner therefore
  depicts action 382, a made Restricted Area attempt that is one of the 762
  shots the page argues about.
- `public/img/lal-logo.png` — the Lakers' primary mark; like the Wizards and
  Kings marks the NBA CDN serves it as SVG only
  (`cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg`, 2026-08-10),
  browser-rasterized at 2048px and committed on the shared normalized
  watermark canvas (60% footprint) by `scripts/normalize_team_logo.py`; SVG
  source retained in `data/hero-sources/`. Rasterized by **inlining the SVG
  markup into the page** rather than pointing an `<img>` at the file, which
  is the specific step that produced the `was-logo.png` blank above: an
  `<img>` whose source fails to load rasterizes as the browser's
  broken-image placeholder, while inline markup either renders or throws.
  Verified before normalizing — the raster carries all four of the SVG's
  declared colors in sensible proportion (gold `#FAB624` 42.5%, white 31.3%,
  purple `#542C81` 20.6%, `#0B1A23` 3.7%) — and its ink-edge ratio is 0.2024,
  10.1x the guard's bar and second only to the Thunder shield.
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
