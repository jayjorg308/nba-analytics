# Image provenance

- `public/img/sga-hero.jpg` — the project's original generated Shai action
  artwork, intentionally adopted as the production banner. It is presented as
  a stylized illustration, not as a documentary photograph of a named game.
- `public/img/<slug>-headshot.png` (all heroes) — the NBA's standard player
  headshots, downloaded verbatim from
  `cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png` (the `playerId`
  is in the hero's shot payload `_meta`). The directory's asset class
  (ADR-0065); pulled 2026-07-24 for the four registered heroes.
