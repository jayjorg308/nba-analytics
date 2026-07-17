# Shot context deploys normalized facts, not raw event prose

The deployed Case 3 contract contains only normalized domain facts: shot identity, event-match status, assist status, evidence kind, typed failure reason, and—only if its gate passes—estimated shot-clock remaining. Raw action objects, event descriptions, parser captures, and box-score rows stay in append-only source artifacts and audit reports.

This keeps the frontend independent of NBA narrative wording, prevents upstream prose edits from becoming accidental product-copy changes, and makes parser drift visible at derive rather than load time. The raw layer retains everything needed to reproduce or revise classification; a future product need for source text requires a deliberate contract decision rather than leaking it through opportunistically.
