// Computed copy for the team report card (docs/plans/jazz-first-site.md,
// "Computed copy"; ADR-0090): sentences authored once as templates and
// filled mechanically, each emitted only when the predicate that licenses it
// holds. The same band always produces the same words on every card. Kept
// apart from the structural copy in ./copy.ts on purpose: these words read a
// direction into the numbers, which structural copy never may, so they live
// only here, behind their predicates, under their own guard
// (computedCopy.test.ts: no grade or causal vocabulary, the house
// punctuation, and predicate-emission agreement over every deployed game).
//
// AUTHORED 2026-10-22 in the author's register (docs/voice/VOICE.md,
// "Computed copy"), red-penned like any verdict. The magnitude words are the
// verdict ladder's own ("a bit", the bare comparative, "well", "far"), so a
// reader calibrates them once across verdicts and cards. The bands are
// decided (2026-09-28): selection uses the season verdict ladder unchanged;
// making uses twice its bands (docs/research/pre-game-ruler-2025-26.md),
// which only ever makes a card's word stricter than the ladder's floor.

import { FAR_PPS, MATERIAL_PPS, NEUTRAL_BAND_PPS, STRONG_PPS } from '../heroes/verdictLadder'

/** True since the authored words landed (2026-10-22); false tags every
 * computed sentence on the page as draft copy. */
export const AUTHORED = true

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

/** "Good shots?" The diet priced at league rates against the league's own
 * diet, answered the way a verdict opens: the hedge is the answer inside the
 * material bar, "Yes" or "No" past it. */
export const SELECTION_ANSWERS: BandWords = {
  neutral: 'Essentially league average',
  hedged: { up: 'A bit above average', down: 'A bit below average' },
  bare: { up: 'Yes, above average', down: 'No, below average' },
  well: { up: 'Yes, well above average', down: 'No, well below average' },
  far: { up: 'Yes, far above average', down: 'No, far below average' },
}

/** "Did they fall?" Points per shot against what that diet should yield,
 * on the scaled bands. The comparison rotates to "expectation" so the two
 * answers never repeat a class (VOICE.md). */
export const MAKING_ANSWERS: BandWords = {
  neutral: 'About as expected',
  hedged: { up: 'A bit above expectation', down: 'A bit below expectation' },
  bare: { up: 'Yes, above expectation', down: 'No, below expectation' },
  well: { up: 'Yes, well above expectation', down: 'No, well below expectation' },
  far: { up: 'Yes, far above expectation', down: 'No, far below expectation' },
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

/** A title side's state: the hedge survives into the title (a card whose
 * answer says "a bit" never gets a bare title), and everything past the
 * material bar takes the bare comparative, which understates "well" and
 * "far" and so stays inside the ladder. */
export type TitleState = 'up' | 'hedgedUp' | 'neutral' | 'hedgedDown' | 'down'

export function titleState(b: { band: Band; direction: Direction }): TitleState {
  if (b.band === 'neutral') return 'neutral'
  if (b.band === 'hedged') return b.direction === 'up' ? 'hedgedUp' : 'hedgedDown'
  return b.direction
}

/** The night's title beside the score: two parallel phrases, selection then
 * making, the hedge after its noun (revised 2026-10-28). The
 * first set's single clause put "a bit" before a hyphenated adjective ("a
 * bit below-average shots", which reads as "a few below-average shots") and
 * left "by a bit" dangling at the end, on 37 and 25 of 2025-26's 82 titles. */
export const TITLE_WORDS: Record<'selection' | 'making', Record<TitleState, string>> = {
  selection: {
    up: 'shots above average',
    hedgedUp: 'shots a bit above average',
    neutral: 'league-average shots',
    hedgedDown: 'shots a bit below average',
    down: 'shots below average',
  },
  making: {
    up: 'makes above expectation',
    hedgedUp: 'makes a bit above expectation',
    neutral: 'makes about as expected',
    hedgedDown: 'makes a bit below expectation',
    down: 'makes below expectation',
  },
}

export function titleOf(selection: string, making: string): string {
  return `${selection}, ${making}`
}

export function nightTitle(selectionDelta: number, makingDelta: number): string {
  return titleOf(
    TITLE_WORDS.selection[titleState(bandOf(selectionDelta))],
    TITLE_WORDS.making[titleState(bandOf(makingDelta, MAKING_BAND_SCALE))],
  )
}

/** The quadrant's four regions, named by sign only: a corner names a region
 * of the chart, never a game, so it carries no band. Conversational on
 * purpose (the author's red pen, 2026-10-22): region names, not claims.
 * "Costly" is the value ledger's word (VOICE.md), not "tough": the axis
 * prices a diet, it never measures how hard a shot was. */
export const CORNER_LABELS: Record<`${Direction}-${Direction}`, string> = {
  'up-up': 'good shots that fell',
  'down-up': 'costly shots that fell',
  'up-down': 'good shots that didn’t fall',
  'down-down': 'costly shots that didn’t fall',
}

/** A season rank as words, counted from whichever end is nearer, so the
 * bottom half never reads "54th-best of 82". Value and expectation, never
 * best and worst: a rank places a game, it never grades one. */
export const RANK_WORDS = {
  selection: { top: 'most valuable diet', bottom: 'least valuable diet' },
  making: { top: 'furthest above expectation', bottom: 'furthest below expectation' },
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
