// Computed copy for the team report card (docs/plans/jazz-first-site.md,
// "Computed copy"; ADR-0090 to record it): sentences authored once as
// templates and filled mechanically, each emitted only when the predicate
// that licenses it holds. The same band always produces the same words on
// every card. Kept apart from the structural copy in ./copy.ts on purpose:
// these words read a direction into the numbers, which structural copy
// never may, so they live only here, behind their predicates, under their
// own guard (computedCopy.test.ts: no grade or causal vocabulary, the house
// punctuation, and predicate-emission agreement over every deployed game).
//
// DRAFT. Every rendering below is a placeholder carried over from the
// prototype for the author to replace in the author's voice (CLAUDE.md,
// "Verdict voice"; red-penned like any verdict). While AUTHORED is false the
// page tags each computed sentence as draft copy. The bands themselves are
// decided (2026-09-28): selection uses the season verdict ladder unchanged;
// making uses twice its bands (docs/research/pre-game-ruler-2025-26.md).

import { FAR_PPS, MATERIAL_PPS, NEUTRAL_BAND_PPS, STRONG_PPS } from '../heroes/verdictLadder'

/** Flip to true in the PR that lands the authored words. */
export const AUTHORED = false

/** Game-grain making swings far wider than season-grain making, so its
 * bands are the ladder's times this (decided 2026-09-28). */
export const MAKING_BAND_SCALE = 2

export type Band = 'neutral' | 'hedged' | 'bare' | 'well' | 'far'
export type Direction = 'up' | 'down'

/** The ladder band of a delta, with the bars scaled; neutral has no side. */
export function bandOf(delta: number, scale = 1): { band: Band; direction: Direction } {
  const a = Math.abs(delta)
  const direction: Direction = delta >= 0 ? 'up' : 'down'
  if (a < NEUTRAL_BAND_PPS * scale) return { band: 'neutral', direction }
  if (a < MATERIAL_PPS * scale) return { band: 'hedged', direction }
  if (a < STRONG_PPS * scale) return { band: 'bare', direction }
  if (a < FAR_PPS * scale) return { band: 'well', direction }
  return { band: 'far', direction }
}

/** The card's two questions, the product's own (the answers follow). */
export const QUESTIONS = {
  selection: 'Good shots?',
  making: 'Did they fall?',
} as const

type BandWords = { neutral: string } & Record<Exclude<Band, 'neutral'>, Record<Direction, string>>

/** "Good shots?" — the selection answer, one rendering per band and side. */
export const SELECTION_ANSWERS: BandWords = {
  neutral: 'League-average shots',
  hedged: { up: 'Slightly better shots than the league', down: 'Slightly tougher shots than the league' },
  bare: { up: 'Good shots', down: 'Tough shots' },
  well: { up: 'Very good shots', down: 'Very tough shots' },
  far: { up: 'Great shots', down: 'Bad shots' },
}

/** "Did they fall?" — the making answer, on the scaled bands. */
export const MAKING_ANSWERS: BandWords = {
  neutral: 'They fell about as expected',
  hedged: { up: 'A few extra fell', down: 'A few fewer fell' },
  bare: { up: 'They fell', down: 'They didn’t fall' },
  well: { up: 'They really fell', down: 'They really didn’t fall' },
  far: { up: 'Everything fell', down: 'Nothing fell' },
}

function wordsFor(words: BandWords, b: { band: Band; direction: Direction }): string {
  return b.band === 'neutral' ? words.neutral : words[b.band][b.direction]
}

export function selectionAnswer(delta: number): string {
  return wordsFor(SELECTION_ANSWERS, bandOf(delta))
}

export function makingAnswer(delta: number): string {
  return wordsFor(MAKING_ANSWERS, bandOf(delta, MAKING_BAND_SCALE))
}

/** The night's title beside the score: three words a side, neutral inside
 * the neutral band so it never contradicts the answers beside it. */
export const TITLE_WORDS = {
  selection: { neutral: 'league-average shots', up: 'good shots', down: 'tough shots' },
  making: { neutral: 'that fell about as expected', up: 'that fell', down: 'that didn’t fall' },
} as const

export function nightTitle(selectionDelta: number, makingDelta: number): string {
  const s = bandOf(selectionDelta)
  const k = bandOf(makingDelta, MAKING_BAND_SCALE)
  const sel = s.band === 'neutral' ? TITLE_WORDS.selection.neutral : TITLE_WORDS.selection[s.direction]
  const mak = k.band === 'neutral' ? TITLE_WORDS.making.neutral : TITLE_WORDS.making[k.direction]
  return `${sel} ${mak}`
}

/** The quadrant's four regions, named by sign only: a corner names a region
 * of the chart, never a game, so it carries no band. */
export const CORNER_LABELS: Record<`${Direction}-${Direction}`, string> = {
  'up-up': 'good shots that fell',
  'down-up': 'tough shots that fell',
  'up-down': 'good shots that didn’t fall',
  'down-down': 'tough shots that didn’t fall',
}

/** A season rank as words, counted from whichever end is nearer, so the
 * bottom half never reads "54th-best of 82". */
export const RANK_WORDS = {
  selection: { top: 'best diet', bottom: 'toughest diet' },
  making: { top: 'best conversion', bottom: 'worst conversion' },
} as const

export function rankLine(kind: 'selection' | 'making', rank: number, games: number): string {
  const fromTop = rank <= games - rank + 1
  const n = fromTop ? rank : games - rank + 1
  const words = RANK_WORDS[kind][fromTop ? 'top' : 'bottom']
  return `${n === 1 ? words : `${ordinal(n)}-${words}`} of ${games} games so far`
}

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}
