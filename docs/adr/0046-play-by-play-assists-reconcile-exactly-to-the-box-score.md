# Parsed play-by-play assists reconcile exactly to the official box score

Each raw NBA Stats PlayByPlayV3 snapshot is paired with the verbatim
BoxScoreTraditionalV3 response for the same game and pull date. Before any
shot-context payload is persisted, assist credits parsed across the full
play-by-play must equal each team's official box-score assist total exactly.

The box score is a validation oracle, not a second event source: it cannot create, identify, or repair a per-shot assist. A mismatch hard-fails the derive rather than becoming ordinary row-level unknown coverage because it signals systemic parser or source-shape drift that could silently convert every marker-free assisted make into an unassisted one. Both raw artifacts and their identities remain in payload provenance.
