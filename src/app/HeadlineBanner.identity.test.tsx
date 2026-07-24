// @vitest-environment jsdom
// The committed display-identity guard (ADR-0023), in the house pattern
// (values free, invariants enforced — ADR-0014/0017): the headline pair's
// six displayed numbers must arithmetic among themselves, for the golden
// fixture and for EVERY registered hero's deployed payload. Three
// independently rounded numbers need not agree (George's making block once
// read 1.07 / 1.02 / +0.04 — a reader's subtraction says 0.05); this test is
// what keeps a future hero or hero:sync from resurfacing that quietly.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseDerivedPayload } from '../domain/payload'
import { HEROES } from '../heroes/registry'
import { HeadlineBanner } from './HeadlineBanner'

afterEach(cleanup)

// under jsdom, import.meta.url is not a file URL — resolve from the repo root
const sources = [
  { name: 'golden fixture', file: path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json') },
  // hero × seasons (ADR-0060): every season argument's deployed payload
  ...HEROES.flatMap((h) =>
    h.seasons.map((s) => ({
      name: `deployed payload: ${h.playerName} ${s.season}`,
      file: path.resolve(process.cwd(), 'public', 'data', h.slug, `${s.season}.json`),
    })),
  ),
].filter((s) => existsSync(s.file)) // deployed copies may be absent on clean clones

/** The six .stat-value strings, parsed back to integer cents — the exact
 * grain the reader sees, so the assertions below ARE the reader's checks. */
function renderedCents(): number[] {
  return [...document.querySelectorAll('.stat-value')].map((el) =>
    Math.round(parseFloat(el.textContent!.replace('−', '-')) * 100),
  )
}

describe('headline display identities (ADR-0023)', () => {
  for (const source of sources) {
    it(`hold for the ${source.name}`, () => {
      const payload = parseDerivedPayload(JSON.parse(readFileSync(source.file, 'utf-8')))
      const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
      render(<HeadlineBanner selection={m.selection} making={m.making} />)

      const cents = renderedCents()
      expect(cents).toHaveLength(6)
      const [hisDiet, leagueDiet, choices, scored, hisDietAgain, conversion] = cents

      // each block subtracts as displayed
      expect(hisDiet! - leagueDiet!).toBe(choices)
      expect(scored! - hisDietAgain!).toBe(conversion)
      // the hinge number is one number in both blocks (ADR-0016)
      expect(hisDietAgain).toBe(hisDiet)
      // and the full decomposition holds at display grain:
      // league diet + selection Δ + making Δ = actual
      expect(leagueDiet! + choices! + conversion!).toBe(scored)
    })
  }
})
