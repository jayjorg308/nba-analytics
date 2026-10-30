// Emit per-hero share pages into dist/ (ADR-0067) — the build's final step
// (npm run build). For every registered hero: dist/<slug>/index.html (the
// canonical alias) plus dist/<slug>/<season>/index.html per season
// argument, each a copy of the built index.html with the share meta
// swapped. Vercel serves real files before applying the SPA rewrite, so
// scrapers get hero meta while the app boots identically from any route.
//
// Requires every hero's committed card (npm run cards:generate) — a
// registered hero without one fails the build, the hero:sync
// partial-fails stance applied to share assets. The site root is the home
// team's canonical season (ADR-0087): dist/index.html itself is re-pointed
// at the season's card and meta (rootPageHtml, no og:url, since the host
// serves that file as every unemitted route's fallback), /arguments gets
// the directory's page, and every registered team season gets its page
// (/jazz for the canonical one, /jazz/<season> for the rest), each needing
// its committed season card. Every shooter of a registered season gets his
// season page beneath it (/jazz/<player-slug> for the canonical season,
// /jazz/<season>/<player-slug> for the rest, ADR-0095) over that same
// card, so a debut never needs new art. Team report cards follow
// the same rule at game grain (docs/plans/jazz-first-site.md, "Share
// cards"): every published game — every row of a committed season index —
// gets dist/<team>/<game-slug>/index.html with its own card as og:image,
// and a published game without its card (npm run cards:games) fails the
// build.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { seasonShooters } from '../src/domain/playerSeason'
import { parseTeamSeasonIndex } from '../src/domain/teamSeasonIndex'
import { parseTeamShotPayload } from '../src/domain/teamShotPayload'
import { HEROES } from '../src/heroes/registry'
import {
  argumentsPageMeta,
  heroPageHtml,
  heroPageMeta,
  methodologyPageMeta,
  rootPageHtml,
  socialCardPath,
  withFontPreloads,
} from '../src/heroes/socialCards'
import { canonicalSeasonOf } from '../src/heroes/types'
import { HOME_TEAM, TEAMS } from '../src/teams/registry'
import { gameCardPath, gamePageMeta, playerPageMeta, seasonCardPath, seasonPageMeta } from '../src/teams/shareCards'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const distIndex = join('dist', 'index.html')
if (!existsSync(distIndex)) {
  fail('dist/index.html not found — this step runs after vite build (npm run build)')
}
// Critical-font preloads go into every page (the old root directory is
// where the first-paint font jump was noticed): every emitted page and the
// root are made from this one string. Idempotence guard: the emit step must
// not double-inject on a re-run over an already-processed dist.
let indexHtml = readFileSync(distIndex, 'utf-8')
if (!indexHtml.includes('as="font"')) {
  indexHtml = withFontPreloads(indexHtml, readdirSync(join('dist', 'assets')))
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
// The directory of arguments (ADR-0087): the root's former meta and card.
mkdirSync(join('dist', 'arguments'), { recursive: true })
writeFileSync(join('dist', 'arguments', 'index.html'), heroPageHtml(indexHtml, argumentsPageMeta()))
let gamePages = 0
let seasonPages = 0
let playerPages = 0
for (const team of TEAMS) {
  for (const season of team.seasons) {
    const card = join('public', seasonCardPath(team, season))
    if (!existsSync(card)) {
      fail(`${team.slug} ${season}: missing ${card} — run npm run cards:generate and commit the card`)
    }
    // The bare team route renders the canonical season; every other
    // registered season has its permalink page. The bare route's page also
    // keeps dist/<team>/ from being a directory without its own page.
    const dir = season === team.canonicalSeason ? join('dist', team.slug) : join('dist', team.slug, season)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), heroPageHtml(indexHtml, seasonPageMeta(team, season)))
    seasonPages += 1
    // Every shooter's season page (ADR-0095 as amended 2026-10-29), under the
    // season's own directory, so his alias for the canonical season and his
    // permalink for the rest, over the season card checked above. A
    // registered season has a deployed payload by the registry's contract.
    const payloadPath = join('public', 'data', '_teams', team.tricode.toLowerCase(), `${season}.json`)
    if (!existsSync(payloadPath)) fail(`${team.slug} ${season}: registered season with no ${payloadPath}`)
    for (const player of seasonShooters(parseTeamShotPayload(JSON.parse(readFileSync(payloadPath, 'utf-8'))))) {
      const playerDir = join(dir, player.slug)
      mkdirSync(playerDir, { recursive: true })
      writeFileSync(join(playerDir, 'index.html'), heroPageHtml(indexHtml, playerPageMeta(team, season, player)))
      playerPages += 1
    }
  }
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
// The root last: the home team's canonical season, re-pointed from the
// font-preloaded source string like every other page (rootPageHtml takes no
// og:url, so the season meta's url is left behind).
writeFileSync(distIndex, rootPageHtml(indexHtml, seasonPageMeta(HOME_TEAM, HOME_TEAM.canonicalSeason)))
console.log(
  `emitted ${pages} hero share pages for ${HEROES.length} heroes, ${seasonPages} team season page(s) with ${playerPages} player season pages and ${gamePages} report card pages, the arguments and methodology pages, and the root, into dist/`,
)
