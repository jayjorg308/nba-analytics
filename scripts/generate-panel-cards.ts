// Capture each hero page's court and zone table from the REAL page, then
// frame them as 1080x1350 export cards (ADR-0009's rule applied to pixels:
// the chart has one implementation, and it is the React component — so the
// export drives real Chromium over the real deployment rather than redrawing
// the court in Python).
//
// Usage:
//   npm run cards:panels
//   npm run cards:panels -- --slug shai-gilgeous-alexander
//
// Playwright is a devDependency and never ships: this touches the build
// output the same way a human with DevTools would. Output lands in
// social-exports/panels/ (gitignored) beside the vertical cards.

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { SCAFFOLD_SENTINEL } from '../src/heroes/authoring'
import { HEROES } from '../src/heroes/registry'
import { canonicalSeasonOf } from '../src/heroes/types'

const PORT = 4179
const BASE = `http://localhost:${PORT}`
const CAPTURE_DIR = resolve('social-exports/_captures')

// Each panel names the selector it captures and the structural label the
// frame prints. Labels are direction-free section copy, never a per-hero
// claim, so they carry no verdict-guard obligations.
// Selectors are scoped to `.zone-section` deliberately: `.table-panel` and
// `.chart-panel` are the SHARED panel classes every act reuses (zone,
// creation, assisted makes, free throw), so an unscoped locator matches four
// elements and Playwright's strict mode rejects it. Scoping also means a
// future act cannot silently change which panel gets exported.
const PANELS = [
  {
    key: 'court',
    selector: '.zone-section .chart-panel',
    label: 'Shot making vs league average',
  },
  {
    key: 'table',
    selector: '.zone-section .table-panel',
    label: 'Zone by zone',
  },
]

const argv = process.argv.slice(2)
const only = argv.includes('--slug') ? argv[argv.indexOf('--slug') + 1] : undefined
const heroes = only === undefined ? HEROES : HEROES.filter((h) => h.slug === only)
if (heroes.length === 0) {
  console.error(`no registered hero with slug '${only}'`)
  process.exit(1)
}
const targets = heroes.filter((h) => !h.thesis.includes(SCAFFOLD_SENTINEL))
if (targets.length === 0) {
  console.log('no heroes ready for cards')
  process.exit(0)
}

// The preview server serves dist/, so build first — it is under a second and
// it guarantees the capture matches what actually deploys.
console.log('building...')
const built = spawnSync('npm', ['run', 'build'], { stdio: 'ignore', shell: true })
if (built.status !== 0) {
  console.error('build failed — run `npm run build` to see why')
  process.exit(1)
}

const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore', shell: true },
)
const shutdown = () => {
  if (server.killed || server.pid === undefined) return
  // On Windows `shell: true` means server.pid is the cmd.exe wrapper, and
  // killing it ORPHANS the vite process — which keeps the port bound and
  // holds stdout open, so the whole command hangs with no error visible.
  // Kill the tree.
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
    })
  } else {
    server.kill()
  }
}
process.on('exit', shutdown)
process.on('SIGINT', () => {
  shutdown()
  process.exit(130)
})

const waitForServer = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`preview server never came up on ${BASE}`)
}

const run = async () => {
  await waitForServer()
  rmSync(CAPTURE_DIR, { recursive: true, force: true })
  mkdirSync(CAPTURE_DIR, { recursive: true })

  const browser = await chromium.launch()
  // Wide enough that the zone table lays out at its desktop grain instead of
  // inside its horizontal scroller; 3x so the type survives the downscale.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    // 2x, not 3x: the panels are placed ~936px wide, so 2x already oversamples,
    // and a 3x surface over a page this tall makes the table capture hang.
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })

  const specs: Record<string, string>[] = []
  for (const hero of targets) {
    const page = await context.newPage()
    await page.goto(`${BASE}/${hero.slug}`, { waitUntil: 'networkidle' })
    // The panels only exist once all four payloads have parsed, so this
    // doubles as the load gate. A hero whose data fails to load throws here
    // rather than silently exporting an empty frame.
    await page.waitForSelector('.chart-panel svg', { timeout: 30_000 })
    await page.waitForSelector('.table-panel', { timeout: 30_000 })
    // String form deliberately: this expression runs in the PAGE, and the
    // repo's tsc has no DOM lib for scripts/, so a callback referencing
    // `document` fails the build (TS2584).
    await page.evaluate('document.fonts.ready')
    // Interaction affordances are lies in a still: "Click any zone" is an
    // instruction a PNG cannot honor. Injected here rather than fixed in the
    // app, because the affordance is correct on the real page.
    await page.addStyleTag({ content: '.chart-hint-slot { visibility: hidden; }' })

    for (const panel of PANELS) {
      const capturePath = resolve(CAPTURE_DIR, `${hero.slug}-${panel.key}.png`)
      await page.locator(panel.selector).screenshot({
        path: capturePath,
        omitBackground: true,
        // Without these the capture waits on element stability forever
        // rather than failing, which is a hang with no message at 3am.
        animations: 'disabled',
        timeout: 20_000,
      })
      specs.push({
        slug: hero.slug,
        capturePath,
        kicker: canonicalSeasonOf(hero).kicker,
        label: panel.label,
        outName: `${hero.slug}-${panel.key}.png`,
      })
      console.log(`captured ${hero.slug} ${panel.key}`)
    }
    await page.close()
  }
  await browser.close()
  shutdown()

  const framed = spawnSync('python', ['scripts/generate_panel_cards.py'], {
    input: JSON.stringify(specs),
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  if (framed.error) {
    console.error(`failed to run python: ${framed.error.message}`)
    process.exit(1)
  }
  process.exit(framed.status ?? 1)
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  shutdown()
  process.exit(1)
})
