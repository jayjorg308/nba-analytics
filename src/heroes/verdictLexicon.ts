// The shared verdict-guard lexicon (ADR-0029): the tripwire's vocabulary and
// its backed-claim rule, one implementation for every hero's colocated guard.
//
// ADR-0005 forbade ALL creation vocabulary because v1 had no creation signal.
// ADR-0029 relaxes it conditionally: creation claims are allowed iff they
// cite shipped Case 2 contexts — so the tripwire flips from "forbidden" to
// "requires >=1 creation-kind claim asserted against aggregateCreationMetrics
// output". Case 3 assist vocabulary ships under its own claim type because
// a Case 2 bucket assertion cannot license a per-shot assist claim. Any
// future vocabulary with no shipped signal stays hard-forbidden — a claim
// must never outrun its data.
//
// Deliberately pure (no vitest import): guards assert on the returned lists,
// and nothing stops tooling from importing the lexicon.

import type { CreationMetrics } from '../domain/aggregateCreation'
import type { FreethrowMetrics } from '../domain/aggregateFreethrow'
import type { ShotContextMetrics } from '../domain/aggregateShotContext'

/** Vocabulary with no shipped data behind it — forbidden in any verdict
 * regardless of claims, until its family ships (then it MOVES to a backed
 * lexicon, never just gets deleted). The defender-distance terms moved out
 * in v2.1, 'assisted' in v2.5, and the v2.6 free-throw terms graduated to
 * FREETHROW_LEXICON when THE LINE's copy shipped (ADR-0053/0056) — every
 * MEASURED family has now shipped. What remains is reserved future
 * vocabulary: CONTEXT.md's 'scoring attempt' may appear on no product
 * surface until the widened decomposition that prices trips into the
 * attempt denominator actually ships (the ADR-0053 destination), so the
 * tripwire holds it regardless of claims. */
export const UNSHIPPED_TERMS = ['scoring attempt'] as const

/** Free-throw vocabulary (v2.6, THE LINE — ADR-0053/0056): legal only when
 * the hero's guard declares at least one free-throw claim asserted against
 * aggregateFreethrowMetrics output. ADR-0055's discipline rides on the claim
 * side: a generation/conversion assertion must hold on the hero's
 * with-technicals AND without-technicals cuts (BothCutsMetric carries both).
 * Phrase forms are deliberate: bare 'trip' would match 'triple' (live in
 * Shai's verdict) and bare 'line' would match 'baseline', so the trip terms
 * carry their preposition and the line term its article ('the lineup' is the
 * known residual near-miss). */
export const FREETHROW_LEXICON = [
  'free throw',
  'free-throw',
  'the line',
  'foul',
  'and-one',
  'and-1',
  'trip to',
  'trips to',
] as const

/** Case 3 vocabulary is licensed independently from Case 2 creation buckets:
 * a catch-and-shoot claim cannot back an assisted-make sentence. Substring
 * matching deliberately lets `assisted` cover `unassisted` too. */
export const ASSIST_LEXICON = ['assisted'] as const

const FORBIDDEN_ASSIST_INTERPRETATIONS = [
  'self-created',
  'self created',
  'solo',
  'without teammate help',
  'created alone',
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

/** A Case 3 claim must consume aggregation-owned worst-case bounds, not the
 * classified point estimate alone (ROADMAP v2.5 Phase 4). */
export interface AssistClaim {
  name: string
  assert: (context: ShotContextMetrics) => void
}

/** A free-throw claim (ADR-0055/0056): named after the verdict words it
 * backs, asserted against the free-throw aggregation's output. A claim on a
 * league-baselined metric must hold on both hero cuts (value AND
 * withoutTechnicals) — a claim that flips on a handful of technical free
 * throws was never sturdy enough to author. */
export interface FreethrowClaim {
  name: string
  assert: (freethrow: FreethrowMetrics) => void
}

function termsIn(verdict: string, terms: readonly string[]): string[] {
  const v = verdict.toLowerCase()
  return terms.filter((t) => v.includes(t))
}

/** Unshipped vocabulary found in the verdict — must always be empty. */
export function unshippedTermsIn(verdict: string): string[] {
  return termsIn(verdict, UNSHIPPED_TERMS)
}

/** Shipped creation vocabulary that lacks backing — empty when the verdict
 * uses no creation vocabulary, or when >=1 creation claim is declared. */
export function unbackedCreationTerms(verdict: string, creationClaimCount: number): string[] {
  const found = termsIn(verdict, CREATION_LEXICON)
  return creationClaimCount > 0 ? [] : found
}

export function unbackedAssistTerms(verdict: string, assistClaimCount: number): string[] {
  const found = termsIn(verdict, ASSIST_LEXICON)
  return assistClaimCount > 0 ? [] : found
}

/** Free-throw vocabulary that lacks backing — empty when the verdict uses no
 * free-throw vocabulary, or when >=1 free-throw claim is declared. A creation
 * or assist claim cannot license line language: different measurement,
 * different claim kind (the ADR-0042 boundary, applied to the lexicon). */
export function unbackedFreethrowTerms(verdict: string, freethrowClaimCount: number): string[] {
  const found = termsIn(verdict, FREETHROW_LEXICON)
  return freethrowClaimCount > 0 ? [] : found
}

/** The scorer-credit boundary (ADR-0049): when assist vocabulary is used,
 * reject prose that equates official attribution with total self-creation. */
export function invalidAssistInterpretationsIn(verdict: string): string[] {
  return termsIn(verdict, ASSIST_LEXICON).length > 0
    ? termsIn(verdict, FORBIDDEN_ASSIST_INTERPRETATIONS)
    : []
}
