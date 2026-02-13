-- ============================================================
-- Migration : Découplage schedules ↔ assignments
--
-- staff_schedules = uniquement le planning récurrent
-- assignments = la réalité du jour, modifiable directement
--
-- Trigger trg_leaves_sync supprimé (géré via RPC).
-- Trigger trg_schedules_sync simplifié : médecins FIXED only.
-- fn_sync_doctor_blocks modifié : ne touche pas source='MANUAL'.
-- Colonnes entry_type, specific_date, id_parent_schedule supprimées.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Drop leave trigger + replace schedule trigger
-- ============================================================

DROP TRIGGER IF EXISTS trg_leaves_sync ON staff_leaves;
DROP FUNCTION IF EXISTS fn_trg_leaves_sync();

DROP TRIGGER IF EXISTS trg_schedules_sync ON staff_schedules;

CREATE OR REPLACE FUNCTION fn_trg_schedules_sync() RETURNS trigger AS $$
DECLARE
  v_staff_id INT;
  v_from DATE;
  v_to DATE;
  v_position INT;
BEGIN
  v_staff_id := COALESCE(NEW.id_staff, OLD.id_staff);

  SELECT id_primary_position INTO v_position FROM staff WHERE id_staff = v_staff_id;
  IF v_position NOT IN (1, 3) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(NEW.schedule_type, OLD.schedule_type) != 'FIXED' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_from := COALESCE(LEAST(OLD.start_date, NEW.start_date), CURRENT_DATE);
  v_to := COALESCE(GREATEST(OLD.end_date, NEW.end_date), (CURRENT_DATE + INTERVAL '12 months')::date);

  PERFORM fn_sync_doctor_blocks(v_staff_id, v_from, v_to);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schedules_sync
  AFTER INSERT OR UPDATE OR DELETE ON staff_schedules
  FOR EACH ROW EXECUTE FUNCTION fn_trg_schedules_sync();

-- ============================================================
-- 2. Convertir les assignments issus d'OVERRIDE/ADDED en MANUAL
--    puis supprimer ces entrées staff_schedules
-- ============================================================

-- 2a. Marquer les assignments liés à OVERRIDE/ADDED comme MANUAL
UPDATE assignments a
SET source = 'MANUAL', id_schedule = NULL
FROM staff_schedules ss
WHERE a.id_schedule = ss.id_schedule
  AND ss.entry_type IN ('OVERRIDE', 'ADDED')
  AND ss.is_active = true
  AND a.status NOT IN ('CANCELLED', 'INVALIDATED');

-- 2b. Supprimer les entrées non-RECURRING
DELETE FROM staff_schedules WHERE entry_type != 'RECURRING';

-- ============================================================
-- 3. Supprimer colonnes devenues inutiles
-- ============================================================

DROP VIEW IF EXISTS v_secretary_eligibility;
DROP VIEW IF EXISTS v_secretary_availability;

ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_id_parent_schedule_fkey;
DROP INDEX IF EXISTS idx_ss_entry;
DROP INDEX IF EXISTS idx_ss_specific;
DROP INDEX IF EXISTS idx_ss_parent;

ALTER TABLE staff_schedules DROP COLUMN IF EXISTS specific_date;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS id_parent_schedule;
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS entry_type;

-- ============================================================
-- 4. Modifier fn_sync_doctor_blocks — respecter source='MANUAL'
-- ============================================================

CREATE OR REPLACE FUNCTION fn_sync_doctor_blocks(
  p_staff_id INT,
  p_date_from DATE,
  p_date_to DATE
) RETURNS void AS $$
BEGIN

  DROP TABLE IF EXISTS _expected_entries;
  CREATE TEMP TABLE _expected_entries AS

  WITH dow_map(dow_int, dow_enum) AS (
    VALUES
      (1, 'MON'::day_of_week_enum),
      (2, 'TUE'::day_of_week_enum),
      (3, 'WED'::day_of_week_enum),
      (4, 'THU'::day_of_week_enum),
      (5, 'FRI'::day_of_week_enum),
      (6, 'SAT'::day_of_week_enum),
      (7, 'SUN'::day_of_week_enum)
  ),

  recurring_expanded AS (
    SELECT
      ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      CASE WHEN ss.period = 'FULL_DAY' THEN 'AM' ELSE ss.period END AS period,
      c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    JOIN dow_map dm ON dm.dow_int = ss.day_of_week
    JOIN calendar c ON c.day_of_week = dm.dow_enum
                   AND c.is_weekend = false
                   AND c.is_holiday = false
    WHERE ss.id_staff = p_staff_id
      AND ss.is_active = true
      AND ss.schedule_type = 'FIXED'
      AND s.id_primary_position IN (1, 3)
      AND s.is_active = true
      AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to
      AND (
        rt.cycle_weeks = 1
        OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
      )
      AND (ss.start_date IS NULL OR c.date >= ss.start_date)
      AND (ss.end_date IS NULL OR c.date <= ss.end_date)

    UNION ALL

    SELECT
      ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      'PM', c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    JOIN dow_map dm ON dm.dow_int = ss.day_of_week
    JOIN calendar c ON c.day_of_week = dm.dow_enum
                   AND c.is_weekend = false
                   AND c.is_holiday = false
    WHERE ss.id_staff = p_staff_id
      AND ss.is_active = true
      AND ss.schedule_type = 'FIXED'
      AND ss.period = 'FULL_DAY'
      AND s.id_primary_position IN (1, 3)
      AND s.is_active = true
      AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to
      AND (
        rt.cycle_weeks = 1
        OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
      )
      AND (ss.start_date IS NULL OR c.date >= ss.start_date)
      AND (ss.end_date IS NULL OR c.date <= ss.end_date)
  ),

  without_absences AS (
    SELECT re.*
    FROM recurring_expanded re
    WHERE NOT EXISTS (
      SELECT 1 FROM staff_leaves sl
      WHERE sl.id_staff = re.id_staff
        AND re.date BETWEEN sl.start_date AND sl.end_date
        AND (sl.period IS NULL OR sl.period = re.period)
    )
  )

  SELECT DISTINCT
    id_staff, id_schedule, id_department, id_activity, period, id_calendar, date
  FROM without_absences;

  -- INSERT work_blocks manquants
  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
  SELECT DISTINCT id_department, date, period,
    CASE WHEN id_activity IS NULL THEN 'CONSULTATION' ELSE 'SURGERY' END,
    id_calendar
  FROM _expected_entries
  ON CONFLICT (id_department, date, period) DO NOTHING;

  -- DELETE assignments SCHEDULE obsolètes (ne touche PAS MANUAL)
  DELETE FROM assignments a
  USING work_blocks wb
  WHERE a.id_block = wb.id_block
    AND a.id_staff = p_staff_id
    AND a.assignment_type = 'DOCTOR'
    AND a.source = 'SCHEDULE'
    AND wb.date BETWEEN p_date_from AND p_date_to
    AND NOT EXISTS (
      SELECT 1 FROM _expected_entries ee
      WHERE ee.id_department = wb.id_department
        AND ee.date = wb.date
        AND ee.period = wb.period
        AND ee.id_staff = a.id_staff
    );

  -- INSERT assignments SCHEDULE manquants (skip si MANUAL actif)
  INSERT INTO assignments (id_block, id_staff, assignment_type, id_activity, source, id_schedule, status)
  SELECT wb.id_block, ee.id_staff, 'DOCTOR', ee.id_activity, 'SCHEDULE', ee.id_schedule, 'PUBLISHED'
  FROM _expected_entries ee
  JOIN work_blocks wb
    ON wb.id_department = ee.id_department
    AND wb.date = ee.date
    AND wb.period = ee.period
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments ma
    WHERE ma.id_block = wb.id_block
      AND ma.id_staff = ee.id_staff
      AND ma.source = 'MANUAL'
      AND ma.status NOT IN ('CANCELLED', 'INVALIDATED')
  )
  ON CONFLICT (id_block, id_staff) DO UPDATE SET
    id_activity = EXCLUDED.id_activity,
    id_schedule = EXCLUDED.id_schedule;

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Recréer les vues secrétaires (simplifiées, sans OVERRIDE/ADDED)
-- ============================================================

CREATE OR REPLACE VIEW v_secretary_availability AS

WITH dow_map(dow_int, dow_enum) AS (
  VALUES
    (1, 'MON'::day_of_week_enum),
    (2, 'TUE'::day_of_week_enum),
    (3, 'WED'::day_of_week_enum),
    (4, 'THU'::day_of_week_enum),
    (5, 'FRI'::day_of_week_enum),
    (6, 'SAT'::day_of_week_enum),
    (7, 'SUN'::day_of_week_enum)
),

recurring_expanded AS (
  SELECT
    ss.id_schedule, ss.id_staff, c.date,
    CASE WHEN ss.period = 'FULL_DAY' THEN 'AM' ELSE ss.period END AS period
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
  JOIN dow_map dm ON dm.dow_int = ss.day_of_week
  JOIN calendar c ON c.day_of_week = dm.dow_enum
                 AND c.is_weekend = false
                 AND c.is_holiday = false
  WHERE ss.is_active = true
    AND ss.schedule_type = 'AVAILABLE'
    AND s.id_primary_position = 2
    AND s.is_active = true
    AND (
      rt.cycle_weeks = 1
      OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
    )
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)

  UNION ALL

  SELECT
    ss.id_schedule, ss.id_staff, c.date, 'PM'
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
  JOIN dow_map dm ON dm.dow_int = ss.day_of_week
  JOIN calendar c ON c.day_of_week = dm.dow_enum
                 AND c.is_weekend = false
                 AND c.is_holiday = false
  WHERE ss.is_active = true
    AND ss.schedule_type = 'AVAILABLE'
    AND ss.period = 'FULL_DAY'
    AND s.id_primary_position = 2
    AND s.is_active = true
    AND (
      rt.cycle_weeks = 1
      OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
    )
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)
),

deduped AS (
  SELECT DISTINCT id_staff, date, period
  FROM recurring_expanded
),

without_leaves AS (
  SELECT d.*
  FROM deduped d
  WHERE NOT EXISTS (
    SELECT 1 FROM staff_leaves sl
    WHERE sl.id_staff = d.id_staff
      AND d.date BETWEEN sl.start_date AND sl.end_date
      AND (sl.period IS NULL OR sl.period = d.period)
  )
)

SELECT
  wl.id_staff,
  s.lastname,
  s.firstname,
  wl.date,
  wl.period,
  COALESCE(ss.is_flexible, false) AS is_flexible,
  CASE WHEN COALESCE(ss.flexibility_pct, 100) > 1
       THEN COALESCE(ss.flexibility_pct, 100) / 100.0
       ELSE COALESCE(ss.flexibility_pct, 1.0)
  END AS flexibility_pct,
  COALESCE(ss.full_day_only, false) AS full_day_only,
  COALESCE(ss.admin_target, 0) AS admin_target
FROM without_leaves wl
JOIN staff s ON wl.id_staff = s.id_staff
LEFT JOIN staff_secretary_settings ss ON wl.id_staff = ss.id_staff;

-- (v_secretary_eligibility recréée séparément via create-secretary-views.sql)

-- ============================================================
-- 6. RPCs pour gestion des congés
-- ============================================================

CREATE OR REPLACE FUNCTION fn_cancel_assignments_for_leave(
  p_staff_id INT,
  p_start_date DATE,
  p_end_date DATE,
  p_period VARCHAR DEFAULT NULL
) RETURNS INT AS $$
DECLARE v_cancelled INT;
BEGIN
  UPDATE assignments a
  SET status = 'CANCELLED', updated_at = now()
  FROM work_blocks wb
  WHERE a.id_block = wb.id_block
    AND a.id_staff = p_staff_id
    AND a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
    AND wb.date BETWEEN p_start_date AND p_end_date
    AND (p_period IS NULL OR wb.period = p_period);
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  RETURN v_cancelled;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_restore_assignments_for_leave(
  p_staff_id INT,
  p_start_date DATE,
  p_end_date DATE
) RETURNS void AS $$
BEGIN
  PERFORM fn_sync_doctor_blocks(p_staff_id, p_start_date, p_end_date);
END;
$$ LANGUAGE plpgsql;

COMMIT;
