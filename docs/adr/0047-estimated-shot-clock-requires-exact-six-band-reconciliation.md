# Estimated shot clock requires exact six-band reconciliation for every current hero

The optional v2.5 estimated-shot-clock feature ships only if reconstruction over pre-drop shots reproduces each current hero's authoritative Case 2 six-band Shot Clock rows exactly: FGA, FGM, 2PT makes, and 3PT makes in every band. Cody Williams, Keyonte George, and Shai Gilgeous-Alexander must all pass the same global launch gate; no percentage tolerance is chosen after seeing the data.

Exact band reconciliation validates the state machine at the product's authoritative clock grain but does not turn a reconstructed second value into measured tracking data, so any per-shot display remains explicitly approximate. If any registered hero fails, the v2.5 shot-context schema and UI omit estimated clock entirely while assisted-make analysis ships unchanged.
