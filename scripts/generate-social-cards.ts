// Generate every registered hero's social card (ADR-0067). The registry is
// the single source of hero truth, and its modules are node-safe on purpose
// (ADR-0022) — this driver reads it and hands the image work to
// scripts/generate_social_cards.py (PIL) as JSON on stdin, the same
// TS-registry/Python-assets split the whole pipeline uses.
//
// Usage: npm run cards:generate
// Output: public/social-cards/<slug>.png (committed; the build's HTML
// emission step requires one per registered hero).

import { spawnSync } from 'node:child_process'
import { HEROES } from '../src/heroes/registry'
import { indexMetaOf } from '../src/heroes/types'

const specs = HEROES.map((hero) => ({
  slug: hero.slug,
  playerName: hero.playerName,
  // The marquee's derived eyebrow (ADR-0065) — never authored twice.
  meta: indexMetaOf(hero),
  headshotPath: hero.hero.headshotPath,
}))

const result = spawnSync('python', ['scripts/generate_social_cards.py'], {
  input: JSON.stringify(specs),
  stdio: ['pipe', 'inherit', 'inherit'],
})
if (result.error) {
  console.error(`failed to run python: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
