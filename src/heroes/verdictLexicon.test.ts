// The tripwire's teeth (ADR-0029): the per-hero guards assert the happy
// path (their verdicts ARE backed); this locks the failure modes — creation
// vocabulary with zero claims must surface, and unshipped vocabulary must
// surface regardless of claims.

import { describe, expect, it } from 'vitest'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unshippedTermsIn,
} from './verdictLexicon'

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

  it('graduates assist vocabulary but requires its own Case 3 claim', () => {
    expect(unshippedTermsIn('his unassisted threes')).toEqual([])
    expect(unbackedAssistTerms('his unassisted threes', 0)).toEqual(['assisted'])
    expect(unbackedAssistTerms('his unassisted threes', 1)).toEqual([])
    // A Case 2 creation claim cannot accidentally license Case 3 language.
    expect(unbackedCreationTerms('his unassisted threes', 1)).toEqual([])
  })

  it('rejects translating scorer credit into self-creation language', () => {
    expect(invalidAssistInterpretationsIn('Most makes were unassisted, so he created alone')).toEqual([
      'created alone',
    ])
    expect(invalidAssistInterpretationsIn('His pull-ups are self-created difficulty')).toEqual([])
  })

  it('free-throw vocabulary is unshipped until THE LINE ships (v2.6)', () => {
    // ADR-0053/0056: no claim can license these yet — the list empties only
    // when the copy PR graduates them to a backed free-throw lexicon.
    expect(unshippedTermsIn('he lives at the line, drawing fouls constantly')).toEqual([
      'the line',
      'foul',
    ])
    expect(unshippedTermsIn('his free throws and and-one trips to the line')).toEqual([
      'free throw',
      'the line',
      'and-one',
      'trips to',
    ])
  })

  it('phrase forms keep near-miss words legal', () => {
    // 'triple' is live in Shai's verdict and 'baseline' is ordinary analysis
    // language; the unshipped terms are phrases so neither ever matches.
    expect(unshippedTermsIn('mid-range at nearly triple the league share')).toEqual([])
    expect(unshippedTermsIn('converts above the baseline everywhere')).toEqual([])
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
