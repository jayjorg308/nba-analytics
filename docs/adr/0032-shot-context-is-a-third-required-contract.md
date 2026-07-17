# Shot context is a third required contract

v2.5's per-shot Case 3 reconstruction ships as a third typed payload, keyed to shots by `gameId + gameEventId`, rather than adding play-by-play fields to either existing contract. The Case 1 shot payload, Case 2 creation payload, and Case 3 shot context payload remain separate because their sources, coverage, uncertainty, and evolution differ; every registered hero requires all three once v2.5 ships so the product keeps one class of hero page.

**Consequences:** play-by-play coverage failures are counted and reported without invalidating otherwise-correct shot or creation data, and the new contract gets its own schema version, golden fixture, derive-time reconciliation, deployed sibling file, and pure aggregation/join seam. The cost is one more required payload and load boundary; the UI must never perform the join or derive context metrics itself.
