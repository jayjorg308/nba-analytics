# NBA live-data is the sole play-by-play source

> Superseded by ADR-0050 after the live-data CDN consistently returned HTTP
> 403 from the development environment. This record remains the rationale for
> rejecting silent, per-request feed fallback.

v2.5 pulls the verbatim NBA live-data play-by-play JSON as its sole Case 3 authority, one whole response per game, and stores it in the append-only raw layer. Its action objects preserve possession, ordering, edit metadata, qualifiers, and action-specific fields that the flattened stats `PlayByPlayV3` contract does not expose; the older structured `PlayByPlayV2` endpoint is deprecated and returns empty data for current games.

There is no automatic fallback between play-by-play feeds with different shapes and semantics. A missing live-data game is a counted coverage failure and may make affected shot contexts unknown; changing the canonical source is a new decision with a new audit, not a retry strategy.
