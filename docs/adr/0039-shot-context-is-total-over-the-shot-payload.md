# Shot context is total over the shot payload

The shot-context payload contains exactly one explicit context row for every post-drop shot in its sibling shot payload, with an identical `gameId + gameEventId` key set. Makes carry assisted, unassisted, or a typed unknown; misses carry not-applicable; missing Case 3 evidence is represented as a row state rather than by omitting the row.

The derive and schema enforce one-to-one cardinality and key-set equality across the two contracts. This makes coverage arithmetic mechanical and prevents a sparse payload's absent row from ambiguously meaning a miss, an unmatched event, a missing game, or a join defect.
