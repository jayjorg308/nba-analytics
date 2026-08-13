# Verdict voice guide

How authored verdicts should sound — and, in the closing section, the banner
alt text beside them. Distilled from the red-penned before/after
pairs in `docs/voice/samples/`, which come in two kinds: the founding five
(Before = the pre-voice shipped verdict, After = the author's rewrite) and
every hero added since (Before = the voice-guided draft, After = the author's
red-pen — the residual delta this guide has not learned yet). Read this file
*and* the samples before drafting any hero copy; where a rule here and a
sample disagree, the sample wins (and this file should be corrected).

Voice operates inside the house rails. Nothing below licenses vocabulary
drift, a re-graded magnitude word, or a claim without a guard mapping.

Scope: this guide covers **authored hero copy** (verdicts, their sentence
families, and banner alt text). It does not govern **structural copy** — the
methodology page, glossary definitions, section descriptions, the directory
blurb — which is product voice rather than the author's, and whose discipline
is claim verification rather than cadence (CLAUDE.md's Structural copy entry,
ADR-0071).

## The rails (voice never touches these)

- **Magnitude words price on the verdict ladder** (`src/heroes/verdictLadder.ts`,
  ADR-0068). A voice edit never re-grades: understating is legal, upgrading
  requires the data to clear the higher bar (Keyonte's catch-and-shoot "far
  above" at +0.172, Ace's "far below" at −0.176 — both checked before the word
  moved).
- **Copy and claims rewrite together** (ADR-0017). A voice edit that adds a
  fact adds a claim: "the looks he gets least often" added a share claim,
  "more than six in ten unassisted" flipped an assisted ceiling into an
  unassisted floor.
- **Vocabulary families need their claim kinds** (ADR-0029); reserved words
  ("scoring attempt", "usage") stay out of verdicts regardless of claims.
- **No em dashes; no colons or semicolons in verdicts** (the period split),
  enforced by `heroCopy.test.ts`.
- **Unassisted never becomes self-created**, solo, or "by himself" (ADR-0049).
  Stating the bare fact and letting adjacency argue is fine; translating it
  is not.
- **Approximation words are two-sided bands** ("nearly", "about", "roughly",
  "close to"); "more/fewer than N" is one-sided.
- **Scope words can be data, not decoration.** "On the floor" is the
  line-vs-floor boundary (a two-shot trip outprices every zone), so widening
  it to "in basketball" makes the sentence false. Before trimming or widening
  a qualifier, check what it scopes.

## The voice

**Openers.** The answer word joins the first clause with a comma, and the
player's full name lands in the opening beat.
> "Yes, Cody Williams lives at the rim and rarely fires from three..."
> "No, Keyonte George's shot selection costs him."

The name may slide to the second sentence when the opener carries only the
answer and the judgment — the pronoun leads, and the full name then opens
the first evidence sentence (the Brunson red-pen, 2026-08-12):
> "Not quite, but he makes it close. Jalen Brunson takes shots at the
> rim..."

**Names.** One surname re-mention mid-verdict, riding an evidence sentence
("since George converts", "Bailey gets there", "Nearly half of Mitchell's
attempts"). Use the handle real fans use where one exists ("SGA").

**Contractions** where speech would have them: "isn't", "doesn't", "that's".

**Concrete nouns over pronouns.** "Trading those attempts", "compounds the
problem" — never "trading them", "compounds it".

**The player is the active subject.** "The rim looks he gives up", not "the
rim looks they trade away".

**Complete the comparative with its verb or class.** "Half as often as the
league does", "far fewer threes than average".

**Rotate the comparison class.** "The league does" / "average" /
"expectation" / "the league rate" — never the same phrase twice in a row.
Bare "expectation" is safe: the product pins "expected" as at-league-average
(CONTEXT.md).

**Rotate repeated content nouns too.** A noun repeated across adjacent
sentences reads as a flaw even when every use is claim-backed: the Brunson
draft's "pull-up jumpers ... Those pull-ups ... the league pull-up value"
red-penned down to two mentions, the third absorbed by "the average for
that shot" (2026-08-12). Two mentions of a term in adjacent sentences is
the ceiling; past it, replace one with the class it belongs to.

**Announcement pivots die; judgment pivots live.** Cut sentences that only
introduce the next evidence ("The diet is how he creates.", "How he creates
explains the bet."). Keep pivots that carry a judgment or mark the
shots-to-line boundary ("The problem is his shot making.", "The creation
numbers flip the usual script.", "The free throw line softens the verdict.").

**Rhythm.** Two clauses is a body sentence's ceiling, and the payoff gets its
own short sentence ("Those pull-ups still produce far above average."). The
closing line sentence is the one place a triple lives ("He draws fouls far
more often than average, converts well above the league rate once he gets
there, and roughly a quarter of his scoring arrives as free throws the shot
chart never sees.").

**Turn with "But"; merge with participles.** "But MVP-level shot making
overwhelms the cost, adding back far more than the selection gives away."

**Framing clauses give a number a reason to matter.** "For a player who lives
inside, he draws fouls at a below-average clip." "The catch-and-shoot looks
he gets least often are the ones he hits far above average." A frame may lean
on shared basketball sense; it may never be an unguarded comparison dressed
as data.

**Plainer words.** Hits, gets, gives up, factor into; tradeoff, clip. Value
is priced from the buyer's side, and the ledger metaphor is a family: "the
cheapest points available", "breaks even", "the shortfall" — never the
seller's "priciest trips".

**Natural basketball phrasing beats zone-precise phrasing** — when the data
still backs the looser reading. "Paint shots outside the restricted area"
became "short shots in the paint rather than threes"; the guard then maps to
what the words naturally say (combined paint share, three share below
league), never to the precise phrasing that was edited away. Check the
looser reading against the payload before accepting it (rim-inclusive "the
paint" holds at 81.8%; "grades out well" at a neutral rim did not).

**The watch sentence.** A verdict may carry one forward-looking fragment
naming a flagged signal and its thinness in the same breath: "Worth watching
whether the right corner holds up on real volume." It is the † discipline in
prose, and its guard shape matches: assert the warm bin AND the
small-sample flag's presence ("real volume" claims the current volume is not
yet real, so the flag being set is part of the claim). Sparingly — one per
verdict at most, only for a signal the table already shows the reader.

**Trim decorative tails.** "In every zone", "land well below" (no trailing
"it"). Subject to the scope-word rail above.

**No cute self-callbacks.** "Softens the verdict", not "softens the no".

## Banner alt text

The banner photo's alt text is authored copy too (ADR-0021), and it is the
one place the house voice describes rather than argues. Same rails, one
extra: it may claim only what the frame shows.

- **The player is the subject, in the present tense.** "Rises", "hangs",
  "extends", "falls away" — never a participle ("rising for a dunk") and
  never the photo as the subject ("image of", "photo of"). Describe the
  play, not the file.
- **Then the opponent, then the jersey and number.** "...for a jumper over
  a Minnesota defender in the white Jazz number 3 jersey."
- **A player rises over a defender, never over a team.** "Over the Phoenix
  Suns" is the alt-text cousin of an unguarded claim: the frame shows a
  man, not a franchise.
- **Count what is actually there.** "Two defenders" when one is contesting
  and the other is passing through the frame is a small lie no test can
  catch — nothing asserts alt text against the photo, so the honesty is
  entirely the author's.
- The credit line beside it takes two forms and never guesses: see
  CONTEXT.md's Hero banner entry.

## Vocabulary calls settled during the corpus build

- The cost noun is **value**, never "efficiency" — readers map efficiency to
  eFG%/TS%, the framings ADR-0001 rejects. ("Efficiency" reached for twice,
  declined twice.)
- **"shot making"**, unhyphenated — the house term.
- **"free throw line"**, spelled out on first mention, unhyphenated in prose.
- **"long"** modifies a shot only when a payload fact backs it. "Long pull-up
  jumpers" as a diet claim has no cross-family metric; "most of them from
  three" does (the creation contexts carry 3PT splits).
- Absolute frequency words ("rarely") yield to true comparatives ("least
  often", "than is typical") when the raw share would surprise a reader who
  then meets the table.

## Workflow

1. Draft from `hero:report` — CLAIM HEADROOM is the ruler — with this guide
   and the samples open.
2. Verify any new or re-graded word against the payload before it lands
   (both technical cuts for line claims, worst-case bounds for assist claims).
3. Rewrite the guard's claim mapping with the copy, always (ADR-0017).
4. Red-pen deltas are this guide's food: when the author's edit contradicts a
   rule here, the rule changes — record the correction in this file.
