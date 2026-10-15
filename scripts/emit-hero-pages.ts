// Emit per-hero share pages into dist/ (ADR-0067) — the build's final step
// (npm run build). For every registered hero: dist/<slug>/index.html (the
// canonical alias) plus dist/<slug>/<season>/index.html per season
// argument, each a copy of the built index.html with the share meta
// swapped. Vercel serves real files before applying the SPA rewrite, so
// scrapers get hero meta while the app boots identically from any route.
//
// Requires every hero's committed card (npm run cards:generate) — a
// registered hero without one fails the build, the hero:sync
// partial-fails stance applied to share assets. Team report cards follow
// the same rule at game grain (docs/plans/jazz-first-site.md, "Share
// cards"): every published game — every row of a committed season index —
// gets dist/<team>/<game-slug>/index.html with its own card as og:image,
// and a published game without its card (npm run cards:games) fails the
// build.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTeamSeasonIndex } from '../src/domain/teamSeasonIndex'
import { HEROES } from '../src/heroes/registry'
import {
  heroPageHtml,
  heroPageMeta,
  methodologyPageMeta,
  socialCardPath,
  withFontPreloads,
} from '../src/heroes/socialCards'
import { canonicalSeasonOf } from '../src/heroes/types'
import { TEAMS } from '../src/teams/registry'
import { gameCardPath, gamePageMeta, teamPageMeta } from '../src/teams/shareCards'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const distIndex = join('dist', 'index.html')
if (!existsSync(distIndex)) {
  fail('dist/index.html not found — this step runs after vite build (npm run build)')
}
// Critical-font preloads go into the ROOT page too (the directory is where
// the first-paint font jump was noticed), then every hero page inherits
// them by being emitted from the same string. Idempotence guard: the emit
// step must not double-inject on a re-run over an already-processed dist.
let indexHtml = readFileSync(distIndex, 'utf-8')
if (!indexHtml.includes('as="font"')) {
  indexHtml = withFontPreloads(indexHtml, readdirSync(join('dist', 'assets')))
  writeFileSync(distIndex, indexHtml)
}

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
// The methodology page (ADR-0071): the one non-hero share page — the same
// transform over the same font-preloaded source, hand-built meta, the
// product-wide card. No card check: public/social-card.png is committed
// and already load-bearing for the root.
mkdirSync(join('dist', 'methodology'), { recursive: true })
writeFileSync(
  join('dist', 'methodology', 'index.html'),
  heroPageHtml(indexHtml, methodologyPageMeta()),
)
let gamePages = 0
for (const team of TEAMS) {
  // The bare team route gets its own page first, so dist/<team>/ always
  // has an index.html now that the report cards live beneath it.
  mkdirSync(join('dist', team.slug), { recursive: true })
  writeFileSync(join('dist', team.slug, 'index.html'), heroPageHtml(indexHtml, teamPageMeta(team)))
  for (const season of team.seasons) {
    const indexPath = join('public', 'data', '_teams', team.tricode.toLowerCase(), season, 'index.json')
    if (!existsSync(indexPath)) continue
    const index = parseTeamSeasonIndex(JSON.parse(readFileSync(indexPath, 'utf-8')))
    for (const row of index.games) {
      const card = join('public', gameCardPath(team, row.slug))
      if (!existsSync(card)) {
        fail(`${team.slug}/${row.slug}: missing ${card} — run npm run cards:games and commit the card`)
      }
      const dir = join('dist', team.slug, row.slug)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'index.html'), heroPageHtml(indexHtml, gamePageMeta(team, season, row)))
      gamePages += 1
    }
  }
}
console.log(
  `emitted ${pages} hero share pages for ${HEROES.length} heroes, ${TEAMS.length} team page(s) with ${gamePages} report card pages, plus the methodology page, into dist/`,
)
