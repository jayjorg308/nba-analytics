// The tripwire's teeth (ADR-0029): the per-hero guards assert the happy
// path (their verdicts ARE backed); this locks the failure modes — creation
// vocabulary with zero claims must surface, and unshipped vocabulary must
// surface regardless of claims.

import { describe, expect, it } from 'vitest'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
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

  it('free-throw vocabulary graduated when THE LINE shipped, and demands its own claim (v2.6)', () => {
    // ADR-0053/0056: the copy PR moved the terms from the unshipped list to
    // the backed FREETHROW_LEXICON — nothing free-throw-shaped is unshipped
    // anymore, but every use requires a declared free-throw claim.
    expect(unshippedTermsIn('he lives at the line, drawing fouls constantly')).toEqual([])
    expect(unbackedFreethrowTerms('he lives at the line, drawing fouls constantly', 0)).toEqual([
      'the line',
      'foul',
    ])
    expect(unbackedFreethrowTerms('he lives at the line, drawing fouls constantly', 1)).toEqual([])
    expect(unbackedFreethrowTerms('his free throws and and-one trips to the line', 0)).toEqual([
      'free throw',
      'the line',
      'and-one',
      'trips to',
    ])
    // A Case 2 creation claim or a Case 3 assist claim cannot license line
    // language — different measurement, different claim kind (ADR-0042's
    // boundary): the count passed here is FREE-THROW claims only.
    expect(unbackedCreationTerms('trips to the line', 1)).toEqual([])
    expect(unbackedAssistTerms('trips to the line', 1)).toEqual([])
  })

  it('the unshipped list is empty — every measured family has shipped (ADR-0029)', () => {
    // The list stays as the mechanism, not dead code: future vocabulary with
    // no shipped signal goes here first, exactly as the free-throw terms did.
    expect(unshippedTermsIn('free throws, fouls, trips to the line, and-one, the line')).toEqual([])
  })

  it('phrase forms keep near-miss words legal', () => {
    // 'triple' is live in Shai's verdict and 'baseline' is ordinary analysis
    // language; the free-throw terms are phrases so neither ever matches.
    expect(unbackedFreethrowTerms('mid-range at nearly triple the league share', 0)).toEqual([])
    expect(unbackedFreethrowTerms('converts above the baseline everywhere', 0)).toEqual([])
    // 'the lineup' is the documented residual near-miss: it DOES contain
    // 'the line', so an unclaimed verdict must phrase around the word.
    expect(unbackedFreethrowTerms('the lineup around him spaces the floor', 0)).toEqual([
      'the line',
    ])
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
