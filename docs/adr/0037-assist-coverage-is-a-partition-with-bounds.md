# Assist coverage is a complete partition with worst-case bounds

Assist analysis partitions every made field goal into assisted, unassisted, or unknown rather than imposing an arbitrary coverage threshold. The aggregation reports classified coverage, the assisted share among classified makes, and the minimum/maximum possible assisted share over all makes: `assisted / total makes` through `(assisted + unknown) / total makes`.

Unknown makes are always counted and surfaced. Authored verdict claims must remain true across the entire worst-case interval, so a small amount of missing data need not erase useful evidence while a large or biased gap cannot support a stronger story than the source proves. Misses remain `notApplicable` and never enter an assist-share denominator.
