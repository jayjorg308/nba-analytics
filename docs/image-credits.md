# Image provenance

- `public/img/sga-hero.jpg` — the project's original generated Shai action
  artwork, intentionally adopted as the production banner. It is presented as
  a stylized illustration, not as a documentary photograph of a named game.
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
- `public/social-cards/*.png` — generated derivatives
  (`npm run cards:generate`, ADR-0067) composed entirely from the credited
  headshots above plus the site's own wordmark; no external imagery.
