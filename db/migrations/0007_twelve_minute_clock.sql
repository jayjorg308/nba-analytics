-- 0007_twelve_minute_clock.sql — minutes_remaining can be 12 (ADR-0080
-- corrective, league-wide evidence).
--
-- A shot at exactly 12:00 remaining is real: a make straight off the
-- opening tip is stamped before the clock ticks (first seen league-wide on
-- game 0022500848, Brandon Miller, Q1 12:00). The 0–11 bound was an
-- assumption the hero corpus never violated. The payload schema's bound
-- (src/domain/payload.ts) relaxes in the same change — a pure widening, so
-- no schema version moves and no existing payload changes.
ALTER TABLE shot DROP CONSTRAINT shot_minutes_remaining_check;
ALTER TABLE shot ADD CONSTRAINT shot_minutes_remaining_check
  CHECK (minutes_remaining BETWEEN 0 AND 12);
