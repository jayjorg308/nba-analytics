// Generate every registered hero's VERTICAL card (the ADR-0025 portrait
// banner as a still, at feed/story aspect ratios). The registry is the
// single source of hero truth, and its modules are node-safe on purpose
// (ADR-0022) — this driver reads it and hands the image work to
// scripts/generate_vertical_cards.py (PIL) as JSON on stdin, the same
// TS-registry/Python-assets split the whole pipeline uses.
//
// Usage:
//   npm run cards:vertical
//   npm run cards:vertical -- --format story
//   npm run cards:vertical -- --slug shai-gilgeous-alexander
//
// Output: social-exports/<format>/<slug>.png — GITIGNORED. These are export
// artifacts a human posts by hand, not deployed assets: nothing on the site
// references them and no build step requires them (contrast the share cards,
// which the emitted HTML depends on). Regenerable from committed inputs.

import { spawnSync } from 'node:child_process'
import { SCAFFOLD_SENTINEL } from '../src/heroes/authoring'
import { HEROES } from '../src/heroes/registry'
import { canonicalSeasonOf } from '../src/heroes/types'

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}

const format = flag('format') ?? 'feed'
if (!['feed', 'story'].includes(format)) {
  console.error(`unknown --format ${format} (expected 'feed' or 'story')`)
  process.exit(1)
}

const only = flag('slug')
const heroes = only === undefined ? HEROES : HEROES.filter((h) => h.slug === only)
if (heroes.length === 0) {
  console.error(`no registered hero with slug '${only}'`)
  process.exit(1)
}

const all = heroes.map((hero) => ({
  slug: hero.slug,
  // The page's h1 and the banner eyebrow — the canonical season's copy, the
  // same pair /<slug> renders (ADR-0060).
  thesis: hero.thesis,
  kicker: canonicalSeasonOf(hero).kicker,
  // The action photo and the hero's OWN authored focal point, so the still
  // reproduces the crop the site shows rather than a center-crop guess.
  imagePath: hero.hero.imagePath,
  imagePosition: hero.hero.imagePosition,
}))

// A scaffolded hero's copy still carries the authoring sentinel — never bake
// sentinel text into a card (the share-card driver's rule, same reason).
const specs = all.filter((spec) => {
  const unauthored = [spec.thesis, spec.kicker, spec.imagePosition].some((field) =>
    field.includes(SCAFFOLD_SENTINEL),
  )
  if (unauthored) {
    console.log(`${spec.slug}: copy not yet authored — card skipped`)
  }
  return !unauthored
})
if (specs.length === 0) {
  console.log('no heroes ready for cards')
  process.exit(0)
}

const result = spawnSync(
  'python',
  ['scripts/generate_vertical_cards.py', '--format', format],
  { input: JSON.stringify(specs), stdio: ['pipe', 'inherit', 'inherit'] },
)
if (result.error) {
  console.error(`failed to run python: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
