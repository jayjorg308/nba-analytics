/**
 * The dictionary popover's registry (ADR-0052): every term the page is willing
 * to define in place, with its reader-facing definition. Each entry
 * re-presents a CONTEXT.md Language definition in general-reader words — the
 * glossary defines the product's vocabulary; this file only translates it.
 *
 * Definitions are structural product copy, identical for every hero: never a
 * per-hero claim (no verdict-guard obligations) and never a per-hero number.
 * League-general arithmetic (the PPS example) is allowed — the "highest-value
 * shot" band-note precedent.
 */
export interface GlossaryEntry {
  /** The headword, as the popover titles it. */
  term: string
  /** The reader-facing definition — a couple of plain sentences, no jargon
   * left undefined inside a definition. */
  definition: string
}

export const GLOSSARY = {
  'shot-diet': {
    term: 'Shot diet',
    definition:
      "Where a player's shots come from: the share of his attempts taken from each part of the floor. The raw material of shot selection, judged by what its shots are worth, not by whether they went in.",
  },
  'shot-making': {
    term: 'Shot making',
    definition:
      'Whether a player converts better or worse than the league on the same shots. Deliberately separate from shot selection, which judges only where the shots came from. A player can pick good shots and miss them, or pick bad ones and make them.',
  },
  'making-delta': {
    term: 'Making Δ',
    definition:
      "The player's field-goal percentage minus the league's in the same zone, in percentage points (pp). Above zero he converts better than league average there; below zero, worse. † flags a small sample: treat as uncertain.",
  },
  pps: {
    term: 'PPS (points per shot)',
    definition:
      "Points scored per shot attempt: make rate × the shot's point value. It is the unit of shot value here because it prices the 3-vs-2 difference fairly, so a 38% three (1.14 PPS) outranks a 45% mid-range two (0.90 PPS). '(lg)' beside a figure is the league's number on the same shots.",
  },
  'expected-pps': {
    term: 'Expected points per shot',
    definition:
      'What a shot diet would score if every shot were converted at league-average rates. It prices the choices, not the shooting: where he shoots from moves this number; whether the shots go in does not.',
  },
  'catch-and-shoot': {
    term: 'Catch and shoot',
    definition:
      'A jumper taken straight out of a pass, held under two seconds with no dribbles. The look arrives ready-made. The NBA classifies creation this way for jumpers from 10 ft and out.',
  },
  'pull-up': {
    term: 'Pull-up',
    definition:
      'A jumper off the dribble: the shooter creates the look himself rather than receiving it. Typically a tougher, lower-value shot than a catch-and-shoot look. Classified for jumpers from 10 ft and out.',
  },
  fga: {
    term: 'FGA',
    definition:
      'Field-goal attempts, the shot count behind a row. It stays visible as the honesty anchor: it says how much evidence sits behind each rate, and whether the † small-sample flag applies.',
  },
  'attempt-share': {
    term: 'Share',
    definition:
      "The percentage of a player's shots taken from a row: his shot diet, one line at a time. 'Lg share' is the same figure for the league, the comparison class every number is judged against.",
  },
} as const satisfies Record<string, GlossaryEntry>

export type TermId = keyof typeof GLOSSARY
