// Add a game's photograph (ADR-0094; docs/plans/jazz-home-transition.md,
// decisions 3 to 5). Writes the committed web-sized derivative under
// public/img/games/ and stubs the game's entry in src/teams/gamePhotos.ts
// with TODO(scaffold) sentinels, so the suite stays red (gamePhotos.test.ts)
// until the alt text, credit, and focal points are authored and the share
// card is redrawn. It drafts structure, never judgment: the alt text and
// credit are a person's (VOICE.md's banner rules; the credit's two forms in
// CONTEXT.md's Hero banner entry), and the photo must be from this game.
//
// Usage: npm run game:photo -- <game-slug> <source-image>

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseTeamSeasonIndex } from '../src/domain/teamSeasonIndex'
import { SCAFFOLD_SENTINEL } from '../src/heroes/authoring'
import { GAME_PHOTOS } from '../src/teams/gamePhotos'
import { publishedSeasons } from '../src/teams/published'
import { TEAMS } from '../src/teams/registry'

const CONFIG = path.join('src', 'teams', 'gamePhotos.ts')

const [slug, source] = process.argv.slice(2)
if (slug === undefined || source === undefined) {
  console.error('usage: npm run game:photo -- <game-slug> <source-image>')
  process.exit(1)
}
if (!existsSync(source)) {
  console.error(`no such image: ${source}`)
  process.exit(1)
}
const published = TEAMS.some((team) =>
  publishedSeasons(team).some((season) => {
    const file = path.join('public', 'data', '_teams', team.tricode.toLowerCase(), season, 'index.json')
    return parseTeamSeasonIndex(JSON.parse(readFileSync(file, 'utf-8'))).games.some((g) => g.slug === slug)
  }),
)
if (!published) {
  console.error(`${slug} is not a published game (a photo follows its game's data commit)`)
  process.exit(1)
}
if (GAME_PHOTOS[slug] !== undefined) {
  console.error(`${slug} already has a photograph in ${CONFIG}; edit that entry, or remove it first`)
  process.exit(1)
}

const imagePath = `img/games/${slug}.jpg`
const result = spawnSync('python', ['scripts/game_photo.py', source, path.join('public', imagePath)], {
  stdio: 'inherit',
})
if (result.error || result.status !== 0) {
  console.error(result.error ? `failed to run python: ${result.error.message}` : 'the derivative failed')
  process.exit(1)
}

// Append the stub as the object's last entry, before its closing brace.
const config = readFileSync(CONFIG, 'utf-8')
const open = config.indexOf('export const GAME_PHOTOS')
const close = config.indexOf('\n}', open)
if (open === -1 || close === -1) {
  console.error(`could not find the GAME_PHOTOS object in ${CONFIG}`)
  process.exit(1)
}
const T = SCAFFOLD_SENTINEL
const stub = [
  `  '${slug}': {`,
  `    imagePath: '${imagePath}',`,
  `    imageAlt: '${T}',`,
  `    imageCredit: '${T}',`,
  `    imagePosition: '${T}',`,
  `    imagePositionWide: '${T}',`,
  `  },`,
].join('\n')
writeFileSync(CONFIG, `${config.slice(0, close)}\n${stub}${config.slice(close)}`)

console.log(`stubbed ${slug} in ${CONFIG}. Next:
  1. Author the entry: the alt text (the frame only, VOICE.md's banner rules), the
     credit ("photograph by <Name>, <Org>" or "photograph via the <Team>"), and both
     focal points ("x% y%"; check the wide panel and the 375px poster in the browser).
  2. Record the provenance in docs/image-credits.md.
  3. npm run cards:games -- ${slug}   (redraws the share card with the photograph)
  4. npm test                         (gamePhotos.test.ts is red until 1 and 3 are done)`)
