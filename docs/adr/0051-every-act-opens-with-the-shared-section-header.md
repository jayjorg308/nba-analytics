# Every act opens with the shared section header

ZONE BY ZONE's header was the zone table's caption: it sat inside the right-hand column, in a grid track shared with the court's toggle and legend, while SHOT CREATION and ASSISTED MAKES opened with full-width section headers. The page now has one act opener — every section renders a full-width header in the section title recipe above a shared split layout (visual left, data twin right, stacking below 1024px). One CSS recipe (`.section-caption` / `.section-layout` / `.table-panel`) serves all three acts, so a new section cannot drift; the drift between the first act and the later two is what forced this decision.

Consequences: the h2 no longer names the zone table (the section takes `aria-labelledby`; the table names itself via `aria-label`, as its siblings already did), and the court/table subgrid — whose only job was registering the caption and chart controls into one shared header track — is retired. The assisted plot's narrower column survives as a `--section-columns` custom-property knob on the shared layout, never a `grid-template-columns` override that would outrank the stacked breakpoint.

Alternating chart/table sides per act was considered and rejected: the page is one argument (ADR-0018/0031), and "visual left, numbers right" is a grammar the reader learns once.

Companion rule: desktop tables never scroll. In the split layout's tight band (~1025–1140px viewports) the zone table's nowrap row labels wrap instead of engaging the shared scroll wrapper — a scrollbar on exactly one table read as an inconsistency; `.zone-scroll` is for phones.
