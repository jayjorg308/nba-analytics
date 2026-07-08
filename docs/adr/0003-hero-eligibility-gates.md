# A hero player must pass a baseline gate and a volume gate; rookies are ineligible

A player can be the tool's hero only if they have **≥1 completed season** that passes both:
- **Gate 1 (baseline):** the `LeagueAverages` frame is populated for that season.
- **Gate 2 (volume):** the player has enough per-zone attempts that the making axis and mix view aren't mostly suppression warnings.

Rookies and incoming/undrafted-to-date players are ineligible until they accumulate such a season.

**Why:** Both the shot-quality evaluation (needs a populated league baseline) and the honesty discipline (suppress noisy per-zone samples) fail badly on thin data. A rookie is the *worst-case* subject for a selection tool: the more honestly we suppress noise, the emptier their charts get — which would ship a hollow product and violate the "don't just reproduce ESPN" requirement.

**Consequences:** This rules out the splashiest marketing subject (e.g. an incoming #2 pick) in favor of analytical honesty. The player-agnostic engine turns this from a loss into a feature: the marquee rookie is added *later* as the visible demonstration that spinning up a new hero is cheap. Gate 2's numeric threshold is intentionally left unset here — it is coupled to the zone-taxonomy granularity and is a tuning step against real counts.
