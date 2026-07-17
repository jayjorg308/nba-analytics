# Event match and assist status are independent

Each shot-context row models Case 3 event linkage separately from assist classification. Event match status is one of matched, missing game, missing event, duplicate event, or contradictory event; assist status remains assisted, unassisted, not applicable, or unknown.

The dimensions cannot be collapsed without losing meaning. A missed shot has no applicable assist question even when its play-by-play game or event is missing, while a made shot can match an event exactly but retain unknown assist status because the event's assist evidence is ambiguous. Estimated clock depends on event linkage, not assist classification, so each feature reports the coverage it actually consumes.
