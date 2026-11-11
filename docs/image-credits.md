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
- `public/img/<slug>-headshot.png` (all heroes, and every player with a
  team season page) — the NBA's standard player
  headshots, downloaded verbatim from
  `cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png` (the `playerId`
  is in the hero's shot payload `_meta`). The directory's asset class
  (ADR-0065); pulled 2026-07-24 for the first four registered heroes, and
  fetched by `hero:add` (ADR-0066) for every hero since — Donovan Mitchell
  2026-07-27. `npm run team:headshots` (ADR-0095) fetched 27 more on
  2026-10-29, every Jazz shooter of 2025-26 and 2026-27 without one; the
  `playerId` is in the team shot payload's rows.
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
- `public/img/darryn-peterson-hero.jpg` — photograph by Aaron Baker, Imagn
  Images via Reuters Connect (Jazz vs San Antonio, Delta Center,
  2026-10-12, the 2026-27 preseason), its caption and mandatory credit
  supplied by the author with the image. Chosen 2026-10-29 from four
  candidates for his 2026-27 argument's banner, ahead of his flip, so no
  hero config references it yet; `hero:scaffold` emits this conventional
  path. A dribble rather than a shot, so a shooting frame may replace it
  later (the alt-text form wants the action that argues the thesis).
  Committed as a 1600x2000 q85 progressive JPEG derivative with the
  metadata dropped (`scripts/game_photo.py`); source retained in
  `data/hero-sources/darryn-peterson-hero-1.jpg`.
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
- `public/img/jalen-brunson-hero.jpg` — team photograph via the New York
  Knicks (vs Toronto at Madison Square Garden, 2026-04-10, the final game of
  his argued regular season; Brunson rises into a jumper in the black City
  Edition #11, a defender's hand reaching in at the top right), from the
  team site's "Knicks on the Court" gallery for that game
  (`cdn.nba.com/teams/uploads/sites/1610612752/2026/04/06-4.png`, pulled
  2026-08-12). Committed **byte-identical to the source**: the Knicks
  publish their game galleries only as 1080x1350 social exports (the file
  is served as `.png` but is a JPEG, with the team's roundel watermark
  baked into the top-right corner), so there is nothing larger to derive
  from — the smallest banner source in the repo, and no re-encode or crop
  judgment enters the asset. No photographer is credited on the source and
  the file carries no embedded EXIF/XMP credit metadata (checked before
  committing), so the credit stays at team grain. The filename distinction
  the Reaves entry records applies here from the other side: when these
  galleries re-host wire photos the `GettyImages-*` name survives (the
  2026-06-13 Finals gallery carries one), while team content gets CMS
  numbering like this file's — that is the basis for the team-grain
  credit. Source retained in `data/hero-sources/` (`brunson-06-4.png`,
  plus the alternate drive frame `brunson-08-4.png`).
- `public/img/nyk-logo.png` — the Knicks' primary roundel; the NBA CDN
  serves it as SVG only
  (`cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg`, 2026-08-12),
  browser-rasterized at 1536px and committed on the shared normalized
  watermark canvas (60% footprint) by `scripts/normalize_team_logo.py`;
  SVG source retained in `data/hero-sources/`. Rasterized with the SVG
  markup **inlined into the page** rather than fetched by an `<img>` (the
  `was-logo.png` lesson above) and verified before normalizing: the raster
  carries all four of the SVG's declared colors in sensible proportion
  (orange `#F58426` 41.9%, blue `#1D428A` 31.5%, white 14.7%, gray
  `#9EA2A2` 9.2% of opaque samples), and its ink-edge ratio is 0.2104,
  10.5x the guard's bar and second only to the Thunder shield.
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
  external imagery. The game cards under `public/social-cards/<team>/`
  (`npm run cards:games`, ADR-0091) are composed from the game files, the
  wordmark, and the typefaces, except a game with a photograph, whose card
  is redrawn with it (ADR-0094, below).

## Season banners

_A team season's home banner (ADR-0087, decision 7 of
`docs/plans/jazz-home-transition.md`): one authored photograph per season,
credited on `/methodology`'s SOURCES like a hero banner. 2025-26 has none and
renders the typographic poster._

- `public/img/jazz-2026-27-banner.jpg`, Darryn Peterson (22, white) holding
  his follow-through on a jumper at Minnesota, the ball in the air: the
  same frame as the 11-08 report card (see its entry under Game
  photographs), the Jazz's recap header
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/11/DSC04513.jpg`
  (5335x3657), its record's credit empty, so "photograph via the Utah
  Jazz". **The frame proves its season**: Peterson is a 2026-27 rookie.
  Chosen by the author 2026-11-09. Committed as a 2048px q85 progressive
  JPEG with the metadata dropped (`scripts/game_photo.py`), byte-identical
  to `public/img/games/2026-11-08-min.jpg` since both are derived from the
  same source, retained in `data/game-sources/2026-11-08-min.jpg`; the
  banner keeps its own file so a later change to the game's photograph
  never moves the home banner. **Swap note (2026-11-09):** this replaced
  the first 2026-27 banner, Ace Bailey (19) slapping hands with Keyonte
  George (3) in purple, two teammates partly in frame: the header photo of
  the Jazz's 10-26 Grizzlies recap,
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/10/DSC06907.jpg`
  (4956x3295, pulled and chosen 2026-11-05, credited "photograph via the
  Utah Jazz" from an empty record). That frame's season rested on
  inference (its recap placement and its camera counter, since Bailey and
  George were both Jazz players in 2025-26), and its game is 10-25 or
  10-26. Source retained in `data/banner-sources/jazz-2026-27-DSC06907.jpg`.

## Game photographs

_Added 2026-10-29 (ADR-0094). A game's photograph is credited on its own
report card and share card, never on `/methodology` (which says so in one
sentence), so this section is the only list of them. Each entry records
the source URL, the pull date, the photographer or "via the team", and the
frame's game (a photograph must be from the game it illustrates).
`npm run game:photo` writes the derivative under `public/img/games/`._

The first three were found by `docs/research/jazz-2026-27-game-photos.md`
and chosen 2026-11-01 from the Jazz's own site. This season the Jazz post
no game galleries; each is the header photo of a game article on
nba.com/jazz, uncaptioned and uncredited, with no embedded credit or
capture metadata, so each is credited "photograph via the Utah Jazz".
Sources pulled 2026-11-01 and retained in `data/game-sources/<slug>.jpg`;
each derivative is 2048px on the long side with the metadata dropped.

- `public/img/games/2026-10-31-por.jpg`, Peterson (22, black) sizing up
  Lillard (0) with the ball: the Jazz's recap header,
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/10/103126_UTA-vs-POR_ED_Edits-22.jpg`
  (5000x3469). **The game is verified by the filename**, which names the
  date and the matchup. "ED" is likely Emma Decasa, Utah Jazz (a preseason
  file named the same way is captioned with her name), but the page names
  no one, so the credit stays the team form until the Jazz confirm it.
- `public/img/games/2026-10-25-lal.jpg`, Jackson (20, purple) driving
  against Walker Kessler (14, Lakers white): the Jazz's recap header,
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/10/DSC05370.jpg`
  (5000x2985). **The game is verified by the defender**: Kessler, a Jazz
  player in 2025-26, is in a Lakers jersey at the Delta Center, the
  Lakers' only visit this season, and the Jazz played no Lakers preseason
  game (Denver, San Antonio, Phoenix). The Deseret News gallery of the
  night (Lukas Katilius) shows the same uniforms and the same matchup.
- `public/img/games/2026-10-23-nop.jpg`, Markkanen (23, white) holding his
  follow-through as Dejounte Murray closes out: the Jazz's recap header,
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/10/DSC04301.jpg`
  (5000x3079). **The game is a strong inference, not verified**: both
  teams' uniforms match the night's Deseret News gallery (Kristin Murphy),
  the Jazz played no Pelicans preseason game, and the camera's frame
  number sits between the 10-21 and 10-25 frames from the same site. A
  2025-26 home game against the Pelicans would look the same; the author
  accepted the inference 2026-11-01.

The next four were listed by the photo finder (`ingestion/find_game_photos.py`,
ADR-0094 as amended) or, for 10-21, by the research doc, and chosen
2026-11-05. Each is a Jazz camera original from the team site, pulled
2026-11-05 by `game:photo` from its URL and retained in
`data/game-sources/<slug>.<ext>`; each derivative is 2048px on the long
side with the metadata dropped. 10-26 has no photograph: its recap header
(`DSC06907.jpg`) was then the 2026-27 home banner (until the 2026-11-09
swap, see Season banners), and its other team frame (`ZMR03509-1.jpg`)
could be 10-25 or 10-26.

- `public/img/games/2026-10-21-mem.jpg`, Peterson (22, white) pointing
  across the floor beside George (3) and a teammate in a headband, a
  Grizzlies player (23) at right:
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/10/DSC01389.jpeg`
  (3995x2542), a header the research doc found 2026-11-01; by 11-05 it
  was older than the news page reaches, so no record was read and the
  credit is the team form. **The game is verified by the venue**: the
  "Get Your Grizz Card" board and the Grizzlies jerseys in the crowd put
  it at FedExForum, Peterson puts it in 2026-27, and 10-21 is the Jazz's
  only game at Memphis (no Memphis preseason game).
- `public/img/games/2026-10-28-sas.jpg`, Isaiah Collier (8, white) on the
  dribble at Delta Center, no defender in the frame: the 10-30 Portland
  preview's header, `.../2026/10/DSC07954.jpg` (5458x3718), with an empty
  credit on its record. **The game is a strong inference, not verified**:
  white at home is 10-23 or 10-28, and the camera counter decides between
  them, since this body's frames run monotone through the month (`DSC04301`
  on 10-23, `DSC06907` on 10-26, then this one, then the wrap to
  `DSC00504` on 11-02). 10-31 was black.
- `public/img/games/2026-11-02-sas.jpg`, Markkanen (23, white) slapping
  hands with the Jazz bench: the recap header,
  `.../2026/11/DSC00608.jpg` (6471x4512). **Credited by name**: its record
  carries "Emma Decasa" in the credit field, so the credit is "photograph
  by Emma Decasa, Utah Jazz". **The game is a strong inference**: the same
  camera's `DSC00504`, 104 frames earlier, shows the San Antonio arena
  ("Made the Texas Way" behind the court, a Spurs player in black), the
  Jazz's only game there.
- `public/img/games/2026-11-04-nop.jpg`, George (3, white) on the dribble
  against a Pelicans defender in navy: the recap header,
  `.../2026/11/DSC01661.jpg` (5243x3647), with an empty credit on its
  record. **The game is a strong inference**: the Pelicans also wore navy
  at Delta Center on 10-23, but this frame's counter follows the 11-02
  San Antonio frames, and 11-04 is the only Pelicans game after 11-02.

The next two were listed by the photo finder after the 06:30 session of
2026-11-09 and chosen the same day, each its game's recap header, pulled
2026-11-09 by `game:photo` and retained in `data/game-sources/<slug>.jpg`.
Both records carry an empty credit, so both are credited "photograph via
the Utah Jazz". **Both games are verified by the opponent or venue**, the
first since 10-21 not to rest on the camera counter: each is the Jazz's
only game against that team so far, and the Jazz played neither in the
preseason (Denver, San Antonio, Phoenix). 10-26 remains without a
photograph and is now older than the news page reaches.

- `public/img/games/2026-11-06-dal.jpg`, Markkanen (23, white) holding his
  follow-through on a jumper as Dallas's number 14 contests with a raised
  hand: the header of the Jazz's NBA Cup recap,
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/11/DSC03457.jpg`
  (5301x3427). The same night's `DSC03951.jpg` (George and Markkanen
  slapping hands, Dallas players behind them) headed the 11-07 preview and
  was passed over for the jumper.
- `public/img/games/2026-11-08-min.jpg`, Peterson (22, white) holding his
  follow-through with the ball in the air, Timberwolves shirts in the
  crowd behind him: the recap header,
  `.../2026/11/DSC04513.jpg` (5335x3657). A blurred figure fills the
  frame's left edge, unidentifiable, so the alt text names no defender.

The last 2026-27 game without a photograph through 11-08 got one on
2026-11-11, when the home banner's swap (see Season banners) freed its
recap header. Chosen by the author the same day.

- `public/img/games/2026-10-26-mem.jpg`, Ace Bailey (19) slapping hands
  with Keyonte George (3), both in purple, two teammates partly in frame:
  the header of the Jazz's 10-26 Grizzlies recap,
  `cdn.nba.com/teams/uploads/sites/1610612762/2026/10/DSC06907.jpg`
  (4956x3295), the 2026-27 home banner from 11-05 to 11-09, credited
  "photograph via the Utah Jazz" from an empty record. Pulled again
  2026-11-11 by `game:photo` from its URL and retained in
  `data/game-sources/2026-10-26-mem.jpg` (the same bytes as
  `data/banner-sources/jazz-2026-27-DSC06907.jpg`). **The game is an
  inference from the recap placement alone, the weakest placement on
  file**: purple fits both 10-25 and 10-26, no opponent is in the frame,
  and the camera counter cannot separate the two nights (the 10-25
  frames run at least `DSC05370` to `DSC06111`, and this one is 796
  frames later). Every recap header this season whose game could be
  checked (10-21, 10-25, 10-28, 10-31, 11-06, 11-08) came from its own
  game, and the author accepted the inference 2026-11-11. Focal points
  carried over from its banner use, the same poster layout.
