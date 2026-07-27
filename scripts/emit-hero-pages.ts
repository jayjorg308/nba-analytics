// Emit per-hero share pages into dist/ (ADR-0067) — the build's final step
// (npm run build). For every registered hero: dist/<slug>/index.html (the
// canonical alias) plus dist/<slug>/<season>/index.html per season
// argument, each a copy of the built index.html with the share meta
// swapped. Vercel serves real files before applying the SPA rewrite, so
// scrapers get hero meta while the app boots identically from any route.
//
// Requires every hero's committed card (npm run cards:generate) — a
// registered hero without one fails the build, the hero:sync
// partial-fails stance applied to share assets.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HEROES } from '../src/heroes/registry'
import { heroPageHtml, heroPageMeta, socialCardPath } from '../src/heroes/socialCards'
import { canonicalSeasonOf } from '../src/heroes/types'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const distIndex = join('dist', 'index.html')
if (!existsSync(distIndex)) {
  fail('dist/index.html not found — this step runs after vite build (npm run build)')
}
const indexHtml = readFileSync(distIndex, 'utf-8')

let pages = 0
for (const hero of HEROES) {
  const card = join('public', socialCardPath(hero))
  if (!existsSync(card)) {
    fail(`${hero.slug}: missing ${card} — run npm run cards:generate and commit the card`)
  }
  const targets = [
    {
      dir: join('dist', hero.slug),
      meta: heroPageMeta(hero, canonicalSeasonOf(hero), { canonicalAlias: true }),
    },
    ...hero.seasons.map((season) => ({
      dir: join('dist', hero.slug, season.season),
      meta: heroPageMeta(hero, season, { canonicalAlias: false }),
    })),
  ]
  for (const target of targets) {
    mkdirSync(target.dir, { recursive: true })
    writeFileSync(join(target.dir, 'index.html'), heroPageHtml(indexHtml, target.meta))
    pages += 1
  }
}
console.log(`emitted ${pages} hero share pages for ${HEROES.length} heroes into dist/`)
