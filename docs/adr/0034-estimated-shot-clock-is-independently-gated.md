# Estimated shot clock is independently gated

v2.5 treats **estimated shot-clock remaining** as an optional, independently gated Case 3 feature rather than a release requirement. Play-by-play provides exact game-event timing but not the tracking dashboard's per-shot shot-clock value, so any shot-clock value must be reconstructed from possession changes and 14/24-second reset rules and must always be presented as approximate.

The spike must roll reconstructed shots into the NBA's six Case 2 shot-clock bands and audit them against the existing tracking payload for both heroes before any per-shot estimate reaches the product. If the clock gate fails, the shot-context contract records no product-facing estimate and v2.5 ships assisted-make analysis without it; the clock experiment may not delay the release or weaken its honesty threshold.
