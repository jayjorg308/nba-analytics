# Hero-seasons require complete game-level play-by-play

v2.5 adds a fourth hero-eligibility gate: every game containing a shot in the
hero-season must have a valid canonical NBA Stats PlayByPlayV3 artifact
(ADR-0050). A missing whole game is an acquisition failure that can bias
assist analysis systematically, so a season with incomplete game-level Case
3 coverage cannot ship as a registered hero once the third payload is
required.

The gate is binary at the game level and does not replace the row-level unknown model. Missing, duplicate, contradictory, or assist-ambiguous events inside present games remain explicit context states whose effect is carried through coverage and worst-case bounds. Partial in-progress-season behavior belongs to v3's freshness machinery rather than weakening the completed-season gate.
