# PROTOTYPE: the Jazz home (throwaway)

**Question.** What should the site's front door look like? The content and
its order are decided (docs/plans/jazz-home-transition.md, decisions 7, 8,
9, 14, 15): the season banner, the latest game and the three before it, the
featured three over a rail, the quadrant, ZONE BY ZONE, the game ledger,
ARGUMENTS. The prototype asks how that content is laid out.

**Where.** `/?variant=A|B` and `/jazz?variant=A|B` in dev builds (`npm run
dev`), with `0` showing today's page at that route. Arrow keys or the yellow
bar switch. Real published 2026-27 data (five games through Oct 28).

**Variants.**

- **A · Acts.** One column, every block a numbered act (01 · THE LATEST
  GAME to 06 · THE ARGUMENTS), the report card's recipe. The latest game is
  a wide tile, the score at poster scale on the left and the two answers in
  the report card's grammar on the right; the three before it are a row of
  tiles. The featured three are tall portrait headshot cards (a swipe rail on
  phones). The arguments close as the directory's headshot rail.
- **B · Front page.** The latest game and the players share the first
  screen in two columns on desktop. The latest game is a smaller tile with
  the answers beside the score and the three before it as a scoreboard strip
  attached underneath; the featured three are landscape rows (headshot,
  name, numbers, status). The evidence follows under plain captions with no
  act numbers, and the arguments close as a typographic list, Jazz first.

Both carry a draft status line on each featured card (an open detail in the
plan); B adds a zone count ("3 of 6 zones at 15 attempts").

**Verdict.** _Pending: the user picks in the browser._
