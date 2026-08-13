# Comparison Page Prototype Plan

## Outcome

Build a repository-integrated comparison page for Good Shots that lets a reader compare two shot profiles without reading two HeroPages or receiving an authored verdict.

The page has two modes over one model:

- **Players** compares two registered players in one shared NBA season.
- **Before & since** compares one registered player's complete season windows on either side of one split date.

The prototype answers how the windows differ in shot selection and shot making. It does not answer why the differences exist, who is better overall, who is more clutch, or whether an external event caused a change.

## Decisions already made

The durable decisions live in:

- [ADR-0073](../adr/0073-comparison-sections-share-exact-windows.md): every included section evaluates the player's observations over the exact comparison windows.
- [ADR-0074](../adr/0074-within-season-comparisons-use-one-season-baseline.md): before-and-since mode uses one fixed season league baseline for both windows.
- [ADR-0075](../adr/0075-comparison-windows-use-local-sample-flags.md): comparison windows do not inherit hero eligibility; thin samples are flagged locally.
- [ADR-0076](../adr/0076-comparison-state-is-owned-by-the-url.md): a valid comparison is reproducible from its URL without server state.
- [ADR-0077](../adr/0077-split-date-comparisons-use-complete-windows.md): split-date comparisons use every available game on both sides rather than matched-length samples.

Existing product decisions continue to apply, especially:

- ADR-0001/0002/0016: selection and making stay distinct and league-relative.
- ADR-0011: presentation formats aggregation outputs; it does not calculate basketball quantities.
- ADR-0013/0014: making color retains its fixed above/below-league meaning.
- ADR-0023: displayed gaps subtract displayed anchors exactly.
- ADR-0024: the app remains dark-only.
- ADR-0027: essential information cannot depend on hover.

## Domain language

Use these terms consistently in code, docs, and product copy:

- **Comparison window**: one side of a comparison, consisting of a player-season constrained to an inclusive date interval. A full season is the unconstrained case.
- **Comparison**: a side-by-side shot-profile evaluation of two comparison windows.
- **Player comparison**: two distinct registered players in one shared season.
- **Within-season comparison**: one player in two non-overlapping windows from one season.
- **Split date**: the first date in the right-side window. The left window ends the day before it.

UI mode labels are **Players** and **Before & since**. Avoid `Timeline`, because the page does not show a chronological series. Avoid causal labels such as `before/after Harden` in product claims.

Before implementation, add these terms to the root `CONTEXT.md`. That edit was not completed during design because the Windows patch helper could create files but could not read any existing file.

## Prototype scope

### Included

- Registered players and their deployed shot payloads.
- One shared season in player comparison.
- One player, season, and split date in within-season comparison.
- Compact comparison header with names, headshots, season, benchmark, games, and shot counts.
- Headline shot-selection and shot-making residuals.
- Both zone-level axes visible simultaneously:
  - attempt-share gap vs league;
  - making FG% gap vs league.
- Raw anchors as supporting context: expected PPS, actual PPS, FGA, FG%, and league values where needed.
- Explicit right-minus-left gaps with their direction named.
- Local low-volume and small-sample flags.
- Stable shareable URLs, setup state, example links, and discovery links.
- Responsive and accessible desktop/mobile layouts.

### Excluded

- Verdicts or generated prose conclusions.
- Clutch filters or claims.
- Causal event claims or arbitrary event labels.
- Paired courts or a shot scatter.
- Shot creation, assisted makes, free throws, and growth.
- Arbitrary NBA players not represented in the hero registry.
- Cross-season player comparisons.
- Equal-length or user-authored independent date ranges.
- NBA API calls from the browser.
- New payload schemas, ingestion changes, or golden regeneration.

## URL contract

Reserve the static route `/compare` before hero lookup, as the methodology route is reserved today.

Canonical valid examples:

```text
/compare?mode=players&season=2025-26&left=donovan-mitchell&right=jalen-brunson
/compare?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-07
```

Rules:

- `mode=players` requires `season`, `left`, and `right`.
- The two player slugs must be distinct, registered, and both must carry the selected season.
- `mode=split` requires `season`, `player`, and an ISO split date.
- The split must leave at least one shot on each side.
- Unknown, incomplete, or contradictory parameters render the setup state with a plain validation message. They do not fall through to the hero directory.
- `/compare` with no query renders the setup state in Players mode.
- Query parsing and serialization are pure and round-trip tested.
- Valid setup submission navigates to the canonical serialized URL. Results are derived from that URL rather than hidden component state.
- An individual HeroPage may link to an incomplete setup URL with its player and season preselected; the setup asks for the other player before producing results.

Add `COMPARE_ROUTE` to the reserved static-route vocabulary and protect it with the existing registry collision test.

## Data semantics

### Player comparison

1. Load the two deployed `DerivedPayload` shot contracts.
2. Assert that both payloads describe the requested season.
3. Assert that their evaluation-zone league baselines are identical before using a shared baseline. A mismatch is a plain contradiction, not permission to choose one silently.
4. Use every shot in each payload as that player's full-season comparison window.
5. Count games from distinct `gameId` values and expose each payload's reconciled frontier.

### Within-season comparison

1. Load one deployed `DerivedPayload`.
2. Partition its shots exactly once:
   - left: `gameDate < splitDate`;
   - right: `gameDate >= splitDate`.
3. Assert that both windows are non-empty, do not overlap, and together reproduce the payload's complete shot set.
4. Pass the same payload `zoneBaseline` to both aggregations.
5. Use the complete natural windows. Do not trim by games, FGA, or calendar length.

For the motivating Mitchell example, the committed payload currently produces:

- before February 7: 48 games, 994 shots;
- since February 7: 22 games, 409 shots;
- since-window left-corner attempts: 11, which is locally thin but does not veto the comparison.

These counts should be covered by an optional real-data test that skips when deployed data is absent, following the repository convention.

### Sample treatment

- A non-empty comparison window is renderable even when it would fail hero eligibility.
- A zone below 15 attempts is marked too thin for a stable selection reading.
- Making on fewer than 50 attempts retains the existing uncertainty flag.
- Attempts are always visible beside a flagged value.
- A flag never deletes a zone or suppresses the whole comparison.
- The header exposes total games and shots for both windows so unequal precision is visible before the detailed rows.

## Domain implementation

Add one comparison-level pure module, expected at `src/domain/aggregateComparison.ts`, rather than putting filtering or pairing logic in React.

Its responsibilities:

1. Accept validated comparison inputs and parsed `DerivedPayload` objects.
2. Enforce mode-specific player, season, baseline, split, and partition invariants.
3. Build the two exact shot arrays.
4. Call `aggregateShotMetrics` once per window with the agreed shared baseline.
5. Pair the outputs by evaluation-zone identity.
6. Return presentation-ready comparison data, including side metadata, games, shots, headline residual anchors, raw supporting anchors, zone rows, and local flags.

Suggested public shape:

```ts
type ComparisonMode = 'players' | 'split'

interface ComparisonSide {
  id: 'left' | 'right'
  label: string
  playerName: string
  playerSlug: string
  season: string
  startDate: string
  endDate: string
  games: number
  shots: number
  metrics: ShotMetrics
}

interface ComparisonMetrics {
  mode: ComparisonMode
  baselineSeason: string
  left: ComparisonSide
  right: ComparisonSide
  zones: readonly ComparisonZoneRow[]
}
```

The exact type may change while implementing, but hold these boundaries:

- React does not filter shots, tally games, pair zones, subtract raw metrics, or choose a baseline.
- `aggregateShotMetrics` remains the only implementation of selection and making math.
- Displayed textual gaps use the existing `formatSignedGap(right, left, precision)` pattern so rounded anchors subtract exactly.
- Pixel positions, marker shapes, and making-bin lookup remain presentation mappings.

No shot payload schema or ingestion change is required for the initial prototype.

## Page structure

### 1. Setup and controls

- Compact mode control labeled **Players** / **Before & since**.
- Player mode: shared season selector, left player, right player, and swap action.
- Before-and-since mode: player, season, and split date.
- Selectable seasons are derived from the relevant registered players' `seasons[]`; never offer a configuration without deployed registry support.
- Controls use real labels and native form behavior. A valid submit owns URL navigation.
- Bare setup includes example links for Mitchell vs Brunson and Mitchell before and since February 7.

### 2. Compact header

- Dynamic `h1`:
  - `Donovan Mitchell vs Jalen Brunson`;
  - `Donovan Mitchell, before & since Feb 7`.
- State `2025-26` and `vs 2025-26 league average` directly below.
- Player mode uses one small headshot per side; split mode uses one headshot.
- Each side shows its label, games, shots, and data-through boundary.
- No action banner, thesis question, verdict cue, team logo, or team-color identity.

### 3. Headline comparison

Render one integrated two-axis surface rather than two reused `HeadlineBanner` components.

- **Shot selection** leads with each side's `selectionDelta` vs the common league diet.
- **Shot making** leads with each side's `makingPpsDelta` vs its own diet expectation.
- Supporting anchors expose expected-from-diet PPS and actual PPS.
- Show the right-minus-left gap and name its direction using the side labels.
- Use neutral language. Do not grade, rank, or declare a winner.

### 4. Zone comparison

Keep both axes visible simultaneously, aligned to the same six evaluation-zone rows.

- Diet panel: each side's `attemptShare - leagueAttemptShare`, plotted around a visible league-zero reference.
- Making panel: each side's `makingDelta`, plotted around the same league-zero concept with the existing fixed making scale.
- Direct labels and two non-color identity encodings distinguish left and right, such as circle vs diamond or solid vs outlined marks.
- Making color continues to encode only above/below-league magnitude. Team colors never encode identity.
- Connect paired markers to make distance visible without implying directionality or a winner.
- An accessible table twin carries both sides' FGA, shares, league shares, FG%, making delta, flags, and explicit gaps.
- Do not introduce hover-only values or tooltips.
- Do not render paired courts in the prototype. A court can return later as a drill-down without changing the comparison model.

### 5. Discovery

- Add a clear **Compare players** link on the player directory.
- Add a quiet **Compare [player]** link on each HeroPage, preselecting that player and rendered season.
- Keep `SiteNav` wordmark-only.
- Keep the HeroPage itself a complete argument rather than adding an inline player switcher.

## Styling and responsive behavior

- Reuse the existing dark ground, typography, spacing tokens, section-caption recipe, panel borders, and dense-text line-height rules.
- The comparison should look native to Good Shots but more compact and tool-like than a HeroPage.
- Desktop may place the diet and making panels together.
- Mobile stacks those panels while preserving identical zone order and side identity.
- Do not depend on two permanently adjacent columns to preserve meaning.
- Ensure focus indicators, form labels, table semantics, and marker identity survive without color.
- Keep the fixed making palette contracts intact; do not weaken the committed contrast test.

## Proposed file seams

Names can move if implementation reveals a deeper boundary, but the plan expects roughly:

```text
src/
  app/
    ComparisonPage.tsx
    ComparisonPage.test.tsx
    comparisonRoute.ts
    comparisonRoute.test.ts
    ComparisonHeader.tsx
    ComparisonHeadline.tsx
    ComparisonZoneTable.tsx
  chart/
    ComparisonZoneChart.tsx
    ComparisonZoneChart.test.tsx
  domain/
    aggregateComparison.ts
    aggregateComparison.test.ts
```

Touch existing files only at their owned seams:

- `src/App.tsx`: resolve the reserved comparison route before hero lookup.
- `src/app/routes.ts`: add the reserved route name, not query interpretation.
- `src/heroes/urls.ts` or a new app-layer comparison URL helper: derive BASE_URL-safe comparison links.
- `src/app/HeroIndexPage.tsx`: directory discovery link and examples entry.
- `src/app/HeroPage.tsx` or its footer boundary: preselected comparison link.
- `src/App.css`: comparison-specific layout using shared variables.
- `CONTEXT.md`: add the resolved domain language.

Do not make `HeroConfig` carry comparison copy or event metadata. The prototype may use the registry for player identity and headshots, but the comparison domain consumes player-season payloads rather than verdict, thesis, or banner configuration.

## Test plan

### Domain unit tests

- Player comparison rejects different seasons.
- Player comparison rejects the same player on both sides.
- Player comparison rejects non-identical shared baselines.
- Split-date partition puts the split date on the right.
- Split-date windows have no overlap and reproduce every input shot.
- Split-date comparison rejects an empty side.
- Complete natural windows are retained without equal-length trimming.
- Both window aggregations receive the same baseline.
- Zone rows pair by zone identity, not array position alone.
- Below-15 selection flags and below-50 making flags remain local.
- Backcourt treatment remains inherited from `aggregateShotMetrics`.

### Route tests

- Bare `/compare` parses as setup state.
- Both valid modes parse and serialize canonically.
- Parse/serialize round trips preserve every authoritative input.
- Incomplete, unknown-player, unavailable-season, duplicate-player, malformed-date, and empty-window states produce specific validation results.
- `compare` is a reserved static route and cannot become a hero slug.
- BASE_URL subpath deployments generate correct links.

### Component tests

- Add `// @vitest-environment jsdom` and explicit `afterEach(cleanup)`.
- Setup mode renders correctly labeled controls and examples.
- A valid URL loads one or two shot payloads as appropriate.
- Load, parse, invariant, and fetch failures use a plain page-error contract.
- Header labels, sample counts, season baseline, and right-minus-left direction are explicit.
- Both selection and making headline residuals render with supporting anchors.
- Both zone axes remain present simultaneously.
- Every zone remains in the accessible table when thin.
- Marker identity is communicated without relying on color.
- Displayed gaps subtract displayed anchors exactly.
- No verdict, clutch, causal, creation, assist, or free-throw copy appears.
- Player and split page titles are distinct and descriptive.

### Real-data and visual checks

- A `describe.skipIf` real-data test covers the committed Mitchell/Brunson comparison when deployed files exist.
- A `describe.skipIf` real-data test pins the Mitchell split partition counts listed above.
- Manually verify Mitchell vs Brunson and the Mitchell February 7 split at desktop and narrow-phone widths.
- Confirm that making colors still satisfy the committed contrast and monotone-luminance guard.
- Confirm that swapping players reverses the named gap direction without changing either player's metrics.

### Repository gates

Run before calling implementation complete:

```text
npm test
npm run lint
npm run build
```

No Python suite or golden regeneration is required unless implementation unexpectedly changes a payload or ingestion contract; such a change is outside this prototype plan and should stop for a new decision.

## Implementation sequence

### Increment 1: domain and URL vertical slice

- Add the glossary terms to `CONTEXT.md`.
- Implement comparison route parsing/serialization and reserve `/compare`.
- Implement the pure comparison aggregation and all invariants.
- Cover the Mitchell split and Mitchell/Brunson data paths in unit/real-data tests.
- Render a temporary plain result from a valid URL to prove end-to-end loading.

This increment answers the highest-risk question first: can one URL reproducibly produce two honest, exact comparison windows from existing deployed shot payloads?

### Increment 2: setup and compact identity

- Build the setup state, validation messages, mode controls, and canonical navigation.
- Add the compact header, headshots, season baseline, window labels, games, shots, and frontier.
- Add the directory and HeroPage discovery links.
- Keep invalid or incomplete configurations in setup rather than partially rendering metrics.

### Increment 3: two-axis headline

- Add the integrated selection/making headline surface.
- Lead with league-relative residuals and retain raw anchors.
- Add named right-minus-left gaps through the display-identity formatter.
- Verify responsive register and screen-reader reading order.

### Increment 4: integrated zone evidence

- Add the paired diet and making plots over the same six rows.
- Add neutral marker identities, league-zero references, connectors, and fixed making bins.
- Add the accessible table twin with FGA, anchors, gaps, and local flags.
- Verify every thin row remains visible and understandable.

### Increment 5: polish and acceptance

- Complete responsive CSS and keyboard/focus behavior.
- Exercise setup, both motivating examples, swap, invalid URLs, fetch errors, and narrow layouts.
- Run the full TypeScript gate.
- Review the acceptance questions below with someone who did not build the page.

Each increment should leave tests green and a usable vertical slice. Avoid building all visual components before the URL/data invariants are proven.

## Acceptance criteria

Without explanatory verdict prose, a reader can answer:

1. In Mitchell vs Brunson, who gets more value from shot selection, who adds more through conversion, and which zones produce the largest differences?
2. In Mitchell before vs since February 7, which parts of his diet or making moved, and which apparent differences are too sample-sensitive to trust?
3. On desktop and mobile, which side is which, what league baseline both use, and which direction every explicit gap subtracts?

The prototype is complete when:

- both valid URL modes reproduce their comparisons on reload and sharing;
- all player observations use their exact windows and the agreed fixed season benchmark;
- both zone axes are simultaneously available;
- raw counts and sample warnings make unequal precision visible;
- no product copy claims clutch performance, causation, an overall winner, or unavailable evidence;
- the repository test, lint, and build gates pass.

## Deferred extensions

Every later section must consume the same exact comparison windows rather than silently substituting season totals.

- **Free throws** are the highest-priority extension. The current contract cannot filter technical free throws and all season-total denominators exactly by date. Add date-grained technical events and the required per-game totals before exposing the section.
- **Shot creation** is season-aggregate tracking data today. It needs a trustworthy date-grained or date-bounded contract before comparison.
- **Assisted makes** can potentially follow the existing per-shot keys, but it remains outside the prototype and must be designed as its own honest comparison section.
- **Clutch** requires score margin as well as period/clock and a separately agreed definition. Clock-only filtering is insufficient.
- **Courts** may return as optional drill-downs, not as the primary comparison grammar.
- **Comparison-only players** may later use a lighter catalog, but the prototype remains restricted to registered heroes with deployed data.
- **Cross-season player comparison** requires each season's own baseline and is a different comparison class from this plan.
