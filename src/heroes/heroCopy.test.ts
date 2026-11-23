// CONTEXT.md's punctuation style, enforced where authored hero copy lives —
// the glossary guard's pattern (src/app/glossary.test.ts, ADR-0056) extended
// to the other class of rendered prose: no verdict, thesis, or banner copy
// may use an em dash as prose punctuation; restructure the sentence instead,
// never weaken the assertion. The em dash GLYPH stays legal in data cells
// (the EM_DASH no-data placeholder in src/format.ts), which is exactly why
// authored prose must never carry it: one symbol, one meaning per surface.
//
// Verdicts additionally carry no colons or semicolons (the 2026-07-28
// consistency pass): the "setup claim: evidence" colon had become an
// accidental house move, and the author's voice is commas and periods. The
// remedy is the period split — the colon becomes a full stop ("The problem
// is shot making." is the in-house model) — never a loosened assertion.
// Verdict-scoped on purpose: kickers use "·" separators and structural copy
// legitimately uses colons; the rule protects the argued prose voice.
//
// Registry-level on purpose: a colocated guard is hand-written per hero and
// could forget the check; iterating hero × seasons (ADR-0060) covers every
// future registration — and every future season argument — automatically
// (the HeadlineBanner.identity pattern).

import { describe, expect, it } from 'vitest'
import { HEROES } from './registry'
import { GROWTH_TERMS } from './verdictLexicon'

describe('authored hero copy (CONTEXT.md punctuation style)', () => {
  for (const hero of HEROES) {
    it(`${hero.slug}: no em dash in thesis or banner copy`, () => {
      expect(hero.thesis).not.toContain('—')
      expect(hero.hero.imageAlt).not.toContain('—')
      // The SOURCES credit line (ADR-0071) is rendered authored copy too.
      if (hero.hero.imageCredit !== undefined) {
        expect(hero.hero.imageCredit).not.toContain('—')
      }
    })

    for (const seasonConfig of hero.seasons) {
      it(`${hero.slug} ${seasonConfig.season}: no em dash in verdict or kicker`, () => {
        expect(seasonConfig.verdict).not.toContain('—')
        expect(seasonConfig.kicker).not.toContain('—')
      })

      it(`${hero.slug} ${seasonConfig.season}: no colon or semicolon in the verdict`, () => {
        expect(seasonConfig.verdict).not.toContain(':')
        expect(seasonConfig.verdict).not.toContain(';')
      })
    }
  }
})

// Growth vocabulary needs a prior argued season (ADR-0061): a hero's first
// season argument has no other season to invoke. Registry-level because the
// growth terms graduated off the unshipped list at Ace Bailey's 2026-27 flip
// (2026-11-23), and every guard frozen before then checks only that list, so
// without this rule their verdicts would lose the protection. A guarded
// second-or-later argument additionally licenses the words with declared
// growth claims (unbackedGrowthTerms, in its own guard).
describe('growth vocabulary only where a prior argued season exists (ADR-0061)', () => {
  for (const hero of HEROES) {
    const first = hero.seasons[0]!
    it(`${hero.slug} ${first.season}: the first argument invokes no other season`, () => {
      const verdict = first.verdict.toLowerCase()
      expect(GROWTH_TERMS.filter((t) => verdict.includes(t))).toEqual([])
    })
  }
})
