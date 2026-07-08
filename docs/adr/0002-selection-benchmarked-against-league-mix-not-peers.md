# Selection is benchmarked against league-average shot mix, not positional peers

Shot selection is evaluated by comparing a player's zone attempt shares against the **league-average** shot mix (diet-weighted expected PPS vs the same weighting on league shares). Position/archetype-adjusted comparison is **deferred to v2**.

**Why:** The league-average mix is derivable for free from the `LeagueAverages` frame already in every pull; positional peer baselines require peer data we've deliberately deferred. Shipping the league-relative number now is honest as long as the tool *states its comparison class plainly*.

**Consequences:** The comparison is position-blind — a diet-weighted PPS that reads "elite" for a spot-up shooter reads differently for a rim-runner. This is a known limitation, not a defect, and must be labeled as "vs league average" in the UI so it is never mistaken for peer-adjusted evaluation. Recording it here so the position-blindness is understood as deliberate and not "fixed" prematurely.
