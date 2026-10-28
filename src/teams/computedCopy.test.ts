// The computed-copy guard (docs/plans/jazz-first-site.md, "Computed copy";
// ADR-0090 to record it): every template obeys the house punctuation, no
// template carries grade or causal vocabulary, the bands partition the
// line, and over every deployed game the words a card shows are exactly the
// words its displayed gap's band licenses. Restructure a template; never
// weaken a list.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseGamePayload } from '../domain/gamePayload'
import { displayGapUnits } from '../format'
import {
  bandOf,
  CORNER_LABELS,
  MAKING_ANSWERS,
  MAKING_BAND_SCALE,
  makingAnswer,
  nightTitle,
  ordinal,
  QUESTIONS,
  rankLine,
  SELECTION_ANSWERS,
  selectionAnswer,
  TITLE_WORDS,
  titleOf,
} from './computedCopy'

// Grades and causes: no surface grades a game, and nothing on a card says
// why a shot fell (the defense, effort, luck).
const FORBIDDEN = [
  'grade',
  'verdict',
  'elite',
  'because',
  'due to',
  'thanks to',
  'defense',
  'forced',
  'lucky',
  'luck',
  'effort',
  'should',
]
// Signed letter grades ("B+", "C-"); a bare capital is the article "A", and
// "grade" itself is forbidden above.
const LETTER_GRADE = /\b[A-DF][+-](?=\s|$|[.,])/

function everyRendering(): string[] {
  const out: string[] = [...Object.values(QUESTIONS), ...Object.values(CORNER_LABELS)]
  for (const words of [SELECTION_ANSWERS, MAKING_ANSWERS]) {
    out.push(words.neutral)
    for (const band of ['hedged', 'bare', 'well', 'far'] as const) out.push(words[band].up, words[band].down)
  }
  for (const s of Object.values(TITLE_WORDS.selection)) {
    for (const m of Object.values(TITLE_WORDS.making)) out.push(titleOf(s, m))
  }
  for (const games of [10, 41, 82]) {
    for (let rank = 1; rank <= games; rank++) out.push(rankLine('selection', rank, games), rankLine('making', rank, games))
  }
  return out
}

describe('computed copy templates', () => {
  it('carry no em dash, colon, or semicolon', () => {
    for (const s of everyRendering()) expect(s, s).not.toMatch(/[—:;]/)
  })

  it('carry no grade or causal vocabulary', () => {
    for (const s of everyRendering()) {
      const lower = s.toLowerCase()
      for (const word of FORBIDDEN) expect(lower, `"${s}" contains "${word}"`).not.toContain(word)
      expect(s, s).not.toMatch(LETTER_GRADE)
    }
  })

  it('partition the line into ladder bands, making on the scaled bars', () => {
    expect(bandOf(0.019).band).toBe('neutral')
    expect(bandOf(0.02).band).toBe('hedged')
    expect(bandOf(-0.05)).toEqual({ band: 'bare', direction: 'down' })
    expect(bandOf(0.15).band).toBe('far')
    expect(bandOf(0.039, MAKING_BAND_SCALE).band).toBe('neutral')
    expect(bandOf(0.2, MAKING_BAND_SCALE).band).toBe('well')
    expect(bandOf(-0.3, MAKING_BAND_SCALE)).toEqual({ band: 'far', direction: 'down' })
  })

  it('say the same words for the same band, and a neutral title inside the neutral band', () => {
    expect(selectionAnswer(0.06)).toBe(selectionAnswer(0.09))
    expect(makingAnswer(-0.11)).toBe(makingAnswer(-0.19))
    expect(nightTitle(0.01, -0.03)).toBe(titleOf(TITLE_WORDS.selection.neutral, TITLE_WORDS.making.neutral))
  })

  it('keep the hedge in the title, and take the bare comparative past the material bar', () => {
    // A hedged answer never sits beside a bare title (the 2026-10-22 fix:
    // 27 of 2025-26's cards said "slightly" in the answer and not the title).
    expect(nightTitle(-0.03, 0.05)).toBe(titleOf(TITLE_WORDS.selection.hedgedDown, TITLE_WORDS.making.hedgedUp))
    expect(nightTitle(0.03, -0.05)).toBe(titleOf(TITLE_WORDS.selection.hedgedUp, TITLE_WORDS.making.hedgedDown))
    // The hedge rides after its noun, once per phrase (revised 2026-10-28).
    expect(nightTitle(-0.03, 0.05)).toBe('shots a bit below average, makes a bit above expectation')
    // Bare, well, and far all title as the bare comparative (understating).
    for (const sel of [0.06, 0.12, 0.2]) {
      expect(nightTitle(sel, 0.25)).toBe(titleOf(TITLE_WORDS.selection.up, TITLE_WORDS.making.up))
      expect(nightTitle(-sel, -0.25)).toBe(titleOf(TITLE_WORDS.selection.down, TITLE_WORDS.making.down))
    }
  })

  it('count a rank from whichever end is nearer', () => {
    expect(rankLine('selection', 1, 82)).toBe('most valuable diet of 82 games so far')
    expect(rankLine('selection', 54, 82)).toBe('29th-least valuable diet of 82 games so far')
    expect(rankLine('making', 82, 82)).toBe('furthest below expectation of 82 games so far')
    expect(rankLine('making', 3, 41)).toBe('3rd-furthest above expectation of 41 games so far')
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
    ])
  })
})

// Predicate and emission agree for every template over every deployed game:
// the band a card's displayed gap falls in is the band whose words it shows.
const gamesRoot = path.resolve(process.cwd(), 'public/data/_teams/uta/2025-26/games')

describe.skipIf(!existsSync(gamesRoot))('computed copy over the deployed games', () => {
  it('emits, for every game, exactly the words its displayed gaps license', () => {
    const seen = new Map<string, string>()
    for (const file of readdirSync(gamesRoot)) {
      const game = parseGamePayload(JSON.parse(readFileSync(path.join(gamesRoot, file), 'utf-8')))
      const m = aggregateShotMetrics(game.sides[0].shots, game.zoneBaseline)
      const sel = displayGapUnits(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2)! / 100
      const mak = displayGapUnits(m.making.actualPps, m.selection.playerDietExpectedPps, 2)! / 100
      for (const [key, words] of [
        [`s:${JSON.stringify(bandOf(sel))}`, selectionAnswer(sel)],
        [`m:${JSON.stringify(bandOf(mak, MAKING_BAND_SCALE))}`, makingAnswer(mak)],
      ] as const) {
        const prior = seen.get(key)
        if (prior !== undefined) expect(words, `${file} ${key}`).toBe(prior)
        seen.set(key, words)
      }
      const b = bandOf(sel)
      expect(selectionAnswer(sel)).toBe(b.band === 'neutral' ? SELECTION_ANSWERS.neutral : SELECTION_ANSWERS[b.band][b.direction])
    }
    expect(seen.size).toBeGreaterThan(4)
  })
})
