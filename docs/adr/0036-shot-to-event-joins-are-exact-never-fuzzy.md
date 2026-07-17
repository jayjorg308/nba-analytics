# Shot-to-event joins are exact, never fuzzy

The Case 1 shot and Case 3 play-by-play event join uses exact shot identity:
`gameId + gameEventId` on the shot side and `gameId + actionNumber` on the
canonical PlayByPlayV3 side (ADR-0050). Player, period, game clock, result,
and point value cross-check an identifier match; they may disprove a match
but may never manufacture one.

Missing identifiers, duplicate events, and cross-source contradictions produce counted unknown shot contexts. A nearby event with a similar player, time, distance, or description is not a fallback match: proximity joins would turn source disagreement into plausible invented data. If the spike reveals a different authoritative identifier mapping, that mapping must be specified and guarded explicitly rather than introduced as fuzzy matching.
