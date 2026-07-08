# Shot quality is defined as expected value versus a zone baseline, not make rate

We judge whether a shot is "good" by its **expected value** — points-per-shot (`zone FG% × point value`) for the shot's location/context, benchmarked against a league zone baseline — **not** by whether it went in.

**Why:** The product's driving question is "is this player taking *good shots*?" Make/miss is descriptive (and is what baseline apps like ESPN already show); it does not evaluate shot selection. A made contested long two is a bad shot that happened to fall; a missed open corner three is a good shot. Judging by outcome would reward luck and variance over process.

**Why PPS and not raw FG%:** Raw FG% ignores the point value of the shot, ranking a 45% mid-range above a 38% three — backwards on value. PPS (0.90 vs 1.14 in that example) orders shots correctly. The `shotchartdetail` zone taxonomy already separates three-point zones from two-point zones, so PPS is derivable from the returned zone FG%.

**Consequences:** This forces two distinct axes we keep separate — **shot selection** (expected value of chosen zones, outcome-independent) and **shot making** (conversion vs baseline). Both are surfaced in v1. It also means v1 *requires* the zone baseline; a bare made/missed shot chart is explicitly not the shipped product.
