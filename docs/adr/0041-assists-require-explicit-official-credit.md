# Assists require explicit official scoring credit

A made shot is classified assisted only from explicit official scoring credit:
a stable structured assist field when the canonical feed supplies one,
otherwise an NBA event description accepted by a narrow, versioned parser.
v2.5 never infers an assist from a preceding pass, event proximity, player
sequence, or basketball plausibility.

The 2026-07-16 three-hero PlayByPlayV3 audit found no structured assist field,
so schema v1 uses the narrowly anchored terminal scorer-credit grammar and
hard-fails unless parsed per-team totals exactly reproduce
BoxScoreTraditionalV3 (ADR-0046).

Structured credit takes precedence, and disagreement between structured data and description produces unknown rather than a guessed winner. The absence of an assist marker may mean unassisted only after the real-data spike reconciles parsed credits against official per-game assist totals; until then, absence is ambiguous. Parser or source drift therefore changes coverage visibly instead of silently converting makes to unassisted.
