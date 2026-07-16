// The shared verdict-guard lexicon (ADR-0029): the tripwire's vocabulary and
// its backed-claim rule, one implementation for every hero's colocated guard.
//
// ADR-0005 forbade ALL creation vocabulary because v1 had no creation signal.
// ADR-0029 relaxes it conditionally: creation claims are allowed iff they
// cite shipped Case 2 contexts — so the tripwire flips from "forbidden" to
// "requires >=1 creation-kind claim asserted against aggregateCreationMetrics
// output". Vocabulary whose data has NOT shipped (assisted/unassisted is
// v2.5 play-by-play; contested/defender distance is the ADR-0030
// fast-follow) stays hard-forbidden — a claim must never outrun its data.
//
// Deliberately pure (no vitest import): guards assert on the returned lists,
// and nothing stops tooling from importing the lexicon.

import type { CreationMetrics } from '../domain/aggregateCreation'

/** Vocabulary with no shipped data behind it — forbidden in any verdict
 * until its family ships (then it MOVES to CREATION_LEXICON, never just
 * gets deleted). The defender-distance terms moved out in v2.1. */
export const UNSHIPPED_CREATION_TERMS = [
  'assisted', // matches 'unassisted' too — v2.5 play-by-play (Case 3)
] as const

/** Shipped-context vocabulary (General + Shot Clock families ADR-0030;
 * Closest Defender since v2.1): legal in a verdict only when the hero's
 * guard declares at least one creation-kind claim. Substring matching on
 * lowercase copy — 'pull-up' covers 'pull-ups', 'clock' covers 'shot clock'
 * and 'late-clock', 'contested' covers 'uncontested'. */
export const CREATION_LEXICON = [
  'catch-and-shoot',
  'catch and shoot',
  'pull-up',
  'pull up',
  'off the dribble',
  'off the catch',
  'jumper',
  'creates',
  'creation',
  'settles',
  'clock',
  'contested', // defender-distance family (v2.1)
  'wide open',
  'wide-open',
  'defender',
] as const

/** A creation-kind claim (ADR-0029): named after the verdict words it backs,
 * asserted against the creation aggregation's output. Declaring these is
 * what licenses creation vocabulary in the verdict. */
export interface CreationClaim {
  name: string
  assert: (creation: CreationMetrics) => void
}

function termsIn(verdict: string, terms: readonly string[]): string[] {
  const v = verdict.toLowerCase()
  return terms.filter((t) => v.includes(t))
}

/** Unshipped vocabulary found in the verdict — must always be empty. */
export function unshippedTermsIn(verdict: string): string[] {
  return termsIn(verdict, UNSHIPPED_CREATION_TERMS)
}

/** Shipped creation vocabulary that lacks backing — empty when the verdict
 * uses no creation vocabulary, or when >=1 creation claim is declared. */
export function unbackedCreationTerms(verdict: string, creationClaimCount: number): string[] {
  const found = termsIn(verdict, CREATION_LEXICON)
  return creationClaimCount > 0 ? [] : found
}
