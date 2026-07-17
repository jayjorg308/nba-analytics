# Play-by-play adds assists and approximate clock, not per-shot tracking labels

v2.5 reconstructs assist status for made shots and approximate per-shot clock from Case 3 play-by-play, enabling a zone × assisted-makes cross and richer shot context. It does not assign the Case 2 catch-and-shoot, pull-up, or Other tracking contexts to individual shots: play-by-play exposes no authoritative bridge to those categories, and manufacturing one would repeat the proxy failure ADR-0005 forbids.

The contract and product claims are spike-gated on an audit of both heroes' real games. The audit must validate event identity, assist parsing, clock semantics, coverage, and failure cases before the shot-context schema is fixed; a newly discovered authoritative field may expand the scope, but textual or geometric inference alone may not.

Assist status has four states: `assisted` and `unassisted` apply only to classified made field goals, `notApplicable` applies to misses because assists are recorded only on makes, and `unknown` applies to a make with a missing, duplicate, contradictory, or unparseable play-by-play match. A made shot may become `unassisted` only after the source audit proves that the absence of assist evidence means no assist was credited; otherwise it remains `unknown`. Unknowns are counted and reported, never folded into unassisted makes.
