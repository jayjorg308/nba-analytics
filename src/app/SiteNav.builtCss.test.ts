// Committed build-output guard: the scrolled navbar's blurred ground must
// survive production CSS minification in BOTH forms — unprefixed
// backdrop-filter (Chrome/Edge/Firefox ignore -webkit-backdrop-filter) and
// the -webkit- prefix (Safari before 18 supports only the prefixed form).
//
// Why this exists: Lightning CSS (Vite's default CSS minifier) merges a
// hand-authored `backdrop-filter` + `-webkit-backdrop-filter` pair into one
// logical declaration and keeps only the last-authored variant, so the
// shipped bundle lost the unprefixed copy and desktop Chrome rendered the
// navbar see-through (bug_NavBarTransparency). The fix is to author only the
// standard property and let the minifier generate the prefix from Vite's
// browser targets — this test locks the emitted artifact either way.
import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'

describe('built CSS: scrolled site-nav ground', () => {
  it('ships backdrop-filter unprefixed and -webkit- prefixed', async () => {
    const result = (await build({
      logLevel: 'silent',
      build: { write: false },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[]

    const outputs = Array.isArray(result) ? result : [result]
    const css = outputs
      .flatMap((r) => r.output)
      .filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'))
      .map((o) => (o as { source: string | Uint8Array }).source.toString())
      .join('\n')

    const scrolledRule = css.match(/\.site-nav-scrolled\{[^}]*\}/)?.[0]
    expect(scrolledRule).toBeDefined()
    // Lookbehind: the -webkit- declaration must not satisfy the unprefixed check.
    expect(scrolledRule).toMatch(/(?<!-webkit-)backdrop-filter:blur\(14px\)/)
    expect(scrolledRule).toContain('-webkit-backdrop-filter:blur(14px)')
  }, 60_000)
})
