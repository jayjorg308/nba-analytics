// The hero player is configuration, not a hardcoded assumption (CONTEXT.md):
// the engine is player-agnostic, and swapping heroes means editing this file
// plus re-running `npm run hero:sync` (whose slug/season argument in
// package.json must match — the HeroPage test asserts the payload's _meta
// agrees with this config, so drift breaks a test).

export const heroConfig = {
  playerName: 'Cody Williams',
  season: '2025-26',
  // Vite serves public/ at the site root; BASE_URL keeps subpath deploys working.
  payloadUrl: `${import.meta.env.BASE_URL}data/cody-williams/2025-26.json`,
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Cody Williams taking good shots?',
} as const
