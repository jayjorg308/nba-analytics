// The tripwire's teeth (ADR-0029): the per-hero guards assert the happy
// path (their verdicts ARE backed); this locks the failure modes — creation
// vocabulary with zero claims must surface, and unshipped vocabulary must
// surface regardless of claims.

import { describe, expect, it } from 'vitest'
import { unbackedCreationTerms, unshippedTermsIn } from './verdictLexicon'

describe('the ADR-0029 tripwire', () => {
  it('flags shipped creation vocabulary when no creation claim is declared', () => {
    expect(unbackedCreationTerms('he settles for pull-ups late in the clock', 0)).toEqual([
      'pull-up',
      'settles',
      'clock',
    ])
  })

  it('licenses the same vocabulary once a creation claim is declared', () => {
    expect(unbackedCreationTerms('he settles for pull-ups late in the clock', 1)).toEqual([])
  })

  it('keeps selection/making language free — no claims required', () => {
    expect(unbackedCreationTerms('he lives at the rim and converts below expectation', 0)).toEqual(
      [],
    )
  })

  it('flags unshipped vocabulary regardless of claims — a claim cannot outrun its data', () => {
    // assisted/unassisted is v2.5 (Case 3). 'assisted' matching inside
    // 'unassisted' is the point, not an accident.
    expect(unshippedTermsIn('his unassisted threes')).toEqual(['assisted'])
  })

  it('defender vocabulary graduated to backed-required in v2.1', () => {
    // 'contested'/'wide open' moved OUT of the unshipped list when the
    // defender family shipped — now they demand a creation claim like the
    // rest of the shipped lexicon.
    expect(unshippedTermsIn('he feasts on wide open, uncontested looks')).toEqual([])
    expect(unbackedCreationTerms('he feasts on wide open, uncontested looks', 0)).toEqual([
      'contested',
      'wide open',
    ])
    expect(unbackedCreationTerms('he feasts on wide open, uncontested looks', 1)).toEqual([])
  })
})
