-- 0008_split_trip_families.sql — the split-trip families (ADR-0053 as
-- amended): fouledDuringMake joins the trip classes, and the shooting-foul
-- classes admit violation-truncated visits (observed FTA below the class's
-- nominal award), so the fta bound stays 1..3 as already declared. Split
-- free throws are counters recomputed from pbp_event at rebuild/export —
-- they are not rows here, because a split fragment is not a trip.
ALTER TABLE ft_trip DROP CONSTRAINT ft_trip_trip_class_check;
ALTER TABLE ft_trip ADD CONSTRAINT ft_trip_trip_class_check CHECK (trip_class IN
  ('shootingFoul2', 'shootingFoul3', 'bonus', 'andOne', 'flagrant',
   'awayFromPlay', 'transitionTake', 'clearPath', 'fouledDuringMake'));
