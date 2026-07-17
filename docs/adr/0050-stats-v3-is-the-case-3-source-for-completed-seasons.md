# NBA Stats V3 is the Case 3 source for completed seasons

For v2.5, completed-season Case 3 acquisition uses the verbatim official NBA
Stats `PlayByPlayV3` response as its sole play-by-play authority, paired with
the verbatim `BoxScoreTraditionalV3` response for assist reconciliation. This
supersedes ADR-0035's live-data CDN choice after that CDN returned HTTP 403
both inside and outside the development sandbox while Stats V3 remained
available.

This is a deliberate source change, not an automatic fallback. A pull never
switches feeds per game. Gate 4 still requires one valid Stats V3 pair for
every game containing a hero shot, and the full three-hero corpus must pass
the exact join, identity cross-check, and per-team assist-total audit before
shipping.

`PlayByPlayV3` carries every v2.5 assist field established by the spike:
action number, player and team identity, period, game clock, result, point
value, and official description. It omits richer live-data possession,
ordering, edit, and qualifier fields. Those fields are not used by the
assist-only contract, but the loss reinforces ADR-0047's decision to omit
estimated shot clock unless a future source/state-machine project earns its
own gate. Living-season ingestion may revisit live-data access in a new ADR;
it may not silently broaden this completed-season decision.

The 2026-07-16 launch audit pulled 146 unique game pairs covering 184
hero-game references and 2,710 post-drop shots for Cody Williams, Keyonte
George, and Shai Gilgeous-Alexander. Every game pair passed the team-assist
reconciliation; all 2,710 shots joined exactly, with zero missing games,
missing events, duplicate events, contradictions, or unknown assist statuses.
