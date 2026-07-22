// CONTEXT.md's punctuation style, enforced where authored hero copy lives —
// the glossary guard's pattern (src/app/glossary.test.ts, ADR-0056) extended
// to the other class of rendered prose: no verdict, thesis, or banner copy
// may use an em dash as prose punctuation; restructure the sentence instead,
// never weaken the assertion. The em dash GLYPH stays legal in data cells
// (the EM_DASH no-data placeholder in src/format.ts), which is exactly why
// authored prose must never carry it: one symbol, one meaning per surface.
//
// Registry-level on purpose: a colocated guard is hand-written per hero and
// could forget the check; iterating HEROES covers every future registration
// automatically (the HeadlineBanner.identity pattern).

import { describe, expect, it } from 'vitest'
import { HEROES } from './registry'

describe('authored hero copy (CONTEXT.md punctuation style)', () => {
  for (const hero of HEROES) {
    it(`${hero.slug}: no em dash in verdict, thesis, or banner copy`, () => {
      expect(hero.verdict).not.toContain('—')
      expect(hero.thesis).not.toContain('—')
      expect(hero.hero.kicker).not.toContain('—')
      expect(hero.hero.imageAlt).not.toContain('—')
    })
  }
})
