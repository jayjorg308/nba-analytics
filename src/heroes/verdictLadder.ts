// The house verdict ladder (ADR-0068): what each grading word in an
// authored verdict PROMISES, priced once for the whole roster. A reader
// calibrates "well above" on one hero's page and carries it to the next,
// so the same word must never be backed by a smaller gap elsewhere. The
// 2026-07-28 audit that produced this file found "far" priced at 0.15 on
// one page and 0.25 on another, and a bare "above" clearing at the
// neutral edge while an equally bare "beat" required material.
//
// The bars are FLOORS, not exact prices: a guard assigns its claim-named
// constant from the ladder, or declares a documented STRICTER local bar
// (Cody's FAR_BELOW_PPS = 0.25) — never a looser one. This is the
// relationship the lexicon already has to vocabulary (ADR-0029), extended
// to magnitude words. hero:report's CLAIM HEADROOM prints these same
// bars, so the authoring aid and the guards speak one ladder.
//
// The PPS ladder, word by word (analog families below):
//   inside ±NEUTRAL_BAND_PPS   "essentially league average"
//   past neutral, < MATERIAL   hedged only: "a little", "a bit"
//   ≥ MATERIAL_PPS             bare comparative: "above", "below", "beat"
//   ≥ STRONG_PPS               "well above" / "well below"
//   ≥ FAR_PPS                  "far above" / "far below"
//
// Approximation words ("nearly N", "about N", "roughly N", "close to N")
// are TWO-SIDED bands wherever they appear — the phrase overstates below
// its band and understates above it (the Mitchell guard's discipline, now
// house-wide). "More/fewer than N" stays one-sided by construction.

/** PPS gaps: selection Δ, making Δ, creation PPS vs league. */
export const NEUTRAL_BAND_PPS = 0.02
export const MATERIAL_PPS = 0.05
export const STRONG_PPS = 0.1
export const FAR_PPS = 0.15

/** Diet attempt-share leans, in share points ("lives at", "rarely fires
 * from", "far more than is typical"). */
export const MATERIAL_DIET_LEAN_PP = 0.05
export const FAR_DIET_LEAN_PP = 0.1

/** Free-throw conversion vs league (FT%): the "well above/below" bar. */
export const WELL_FT_PCT = 0.05

/** FTA rate vs league: the floor ANY directional claim must clear, and
 * the bar where "far more/less often" begins — "a bit" lives between the
 * two, two-sided. */
export const FTA_RATE_FLOOR = 0.02
export const FAR_FTA_RATE = 0.1
