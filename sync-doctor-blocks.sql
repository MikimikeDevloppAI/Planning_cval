-- ============================================================
-- Orchestration automatique médecins : triggers PostgreSQL
--
-- Maintient work_blocks + assignments DOCTOR toujours en sync
-- avec staff_schedules et staff_leaves, via triggers.
--
-- Règles :
--   - work_blocks : INSERT uniquement, jamais de DELETE
--   - assignments DOCTOR : INSERT ou DELETE (table = vérité courante)
--   - assignments SECRETARY : jamais touchés
-- ============================================================

BEGIN;

-- ============================================================
-- 1. INDEX UNIQUE universel sur work_blocks
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_wb_dept_date_period
  ON work_blocks (id_department, date, period);

-- ============================================================
-- 2. FONCTION CENTRALE : fn_sync_doctor_blocks
-- ============================================================

CREATE OR REPLACE FUNCTION fn_sync_doctor_blocks(
  p_staff_id INT,
  p_date_from DATE,
  p_date_to DATE
) RETURNS void AS $$
BEGIN

  -- ────────────────────────────────────────────────────────
  -- Étape A : Calculer les présences attendues pour ce médecin
  --           dans la plage [p_date_from, p_date_to]
  -- ────────────────────────────────────────────────────────

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

  -- Expand RECURRING schedules across the calendar
  recurring_expanded AS (
    SELECT
      ss.id_schedule,
      ss.id_staff,
      ss.id_department,
      ss.id_activity,
      CASE WHEN ss.period = 'FULL_DAY' THEN 'AM' ELSE ss.period END AS period,
      c.id_calendar,
      c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    JOIN dow_map dm ON dm.dow_int = ss.day_of_week
    JOIN calendar c ON c.day_of_week = dm.dow_enum
                   AND c.is_weekend = false
                   AND c.is_holiday = false
    WHERE ss.id_staff = p_staff_id
      AND ss.entry_type = 'RECURRING'
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

    -- FULL_DAY → also PM
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
      AND ss.entry_type = 'RECURRING'
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

  -- Overridden parents (for this staff only)
  overridden_parents AS (
    SELECT DISTINCT
      ov.id_parent_schedule,
      ov.specific_date
    FROM staff_schedules ov
    WHERE ov.entry_type = 'OVERRIDE'
      AND ov.is_active = true
      AND ov.id_staff = p_staff_id
  ),

  -- Remove overridden entries
  recurring_clean AS (
    SELECT re.*
    FROM recurring_expanded re
    WHERE NOT EXISTS (
      SELECT 1 FROM overridden_parents op
      WHERE op.id_parent_schedule = re.id_schedule
        AND op.specific_date = re.date
    )
  ),

  -- OVERRIDE entries (replacement schedules for specific dates)
  override_entries AS (
    SELECT
      ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      CASE WHEN ss.period = 'FULL_DAY' THEN 'AM' ELSE ss.period END AS period,
      c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN calendar c ON c.date = ss.specific_date
    WHERE ss.id_staff = p_staff_id
      AND ss.entry_type = 'OVERRIDE'
      AND ss.is_active = true
      AND ss.schedule_type = 'FIXED'
      AND s.id_primary_position IN (1, 3)
      AND s.is_active = true
      AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to

    UNION ALL

    -- FULL_DAY → also PM
    SELECT
      ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      'PM', c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN calendar c ON c.date = ss.specific_date
    WHERE ss.id_staff = p_staff_id
      AND ss.entry_type = 'OVERRIDE'
      AND ss.is_active = true
      AND ss.schedule_type = 'FIXED'
      AND ss.period = 'FULL_DAY'
      AND s.id_primary_position IN (1, 3)
      AND s.is_active = true
      AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to
  ),

  -- ADDED entries (extra one-off schedules)
  added_entries AS (
    SELECT
      ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      CASE WHEN ss.period = 'FULL_DAY' THEN 'AM' ELSE ss.period END AS period,
      c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN calendar c ON c.date = ss.specific_date
    WHERE ss.id_staff = p_staff_id
      AND ss.entry_type = 'ADDED'
      AND ss.is_active = true
      AND ss.schedule_type = 'FIXED'
      AND s.id_primary_position IN (1, 3)
      AND s.is_active = true
      AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to

    UNION ALL

    -- FULL_DAY → also PM
    SELECT
      ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      'PM', c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN calendar c ON c.date = ss.specific_date
    WHERE ss.id_staff = p_staff_id
      AND ss.entry_type = 'ADDED'
      AND ss.is_active = true
      AND ss.schedule_type = 'FIXED'
      AND ss.period = 'FULL_DAY'
      AND s.id_primary_position IN (1, 3)
      AND s.is_active = true
      AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to
  ),

  -- Combine all schedule entries
  all_entries AS (
    SELECT * FROM recurring_clean
    UNION ALL
    SELECT * FROM override_entries
    UNION ALL
    SELECT * FROM added_entries
  ),

  -- Remove absences
  without_absences AS (
    SELECT ae.*
    FROM all_entries ae
    WHERE NOT EXISTS (
      SELECT 1 FROM staff_leaves sl
      WHERE sl.id_staff = ae.id_staff
        AND ae.date BETWEEN sl.start_date AND sl.end_date
        AND (sl.period IS NULL OR sl.period = ae.period)
    )
  )

  SELECT DISTINCT
    id_staff, id_schedule, id_department, id_activity, period, id_calendar, date
  FROM without_absences;

  -- ────────────────────────────────────────────────────────
  -- Étape B : INSERT work_blocks manquants (ON CONFLICT skip)
  --           Un seul INSERT unifié — block_type cosmétique
  -- ────────────────────────────────────────────────────────

  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
  SELECT DISTINCT id_department, date, period,
    CASE WHEN id_activity IS NULL THEN 'CONSULTATION' ELSE 'SURGERY' END,
    id_calendar
  FROM _expected_entries
  ON CONFLICT (id_department, date, period) DO NOTHING;

  -- ────────────────────────────────────────────────────────
  -- Étape C : DELETE assignments médecins obsolètes
  --           Compare sur (dept, date, period, staff) uniquement
  -- ────────────────────────────────────────────────────────

  DELETE FROM assignments a
  USING work_blocks wb
  WHERE a.id_block = wb.id_block
    AND a.id_staff = p_staff_id
    AND a.assignment_type = 'DOCTOR'
    AND wb.date BETWEEN p_date_from AND p_date_to
    AND NOT EXISTS (
      SELECT 1 FROM _expected_entries ee
      WHERE ee.id_department = wb.id_department
        AND ee.date = wb.date
        AND ee.period = wb.period
        AND ee.id_staff = a.id_staff
    );

  -- ────────────────────────────────────────────────────────
  -- Étape D : INSERT assignments médecins manquants
  --           id_activity copié depuis staff_schedules via _expected_entries
  -- ────────────────────────────────────────────────────────

  INSERT INTO assignments (id_block, id_staff, assignment_type, id_activity, source, id_schedule, status)
  SELECT wb.id_block, ee.id_staff, 'DOCTOR', ee.id_activity, 'SCHEDULE', ee.id_schedule, 'PUBLISHED'
  FROM _expected_entries ee
  JOIN work_blocks wb
    ON wb.id_department = ee.id_department
    AND wb.date = ee.date
    AND wb.period = ee.period
  ON CONFLICT (id_block, id_staff) DO UPDATE SET
    id_activity = EXCLUDED.id_activity,
    id_schedule = EXCLUDED.id_schedule;

END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 3. TRIGGER sur staff_leaves
-- ============================================================

CREATE OR REPLACE FUNCTION fn_trg_leaves_sync() RETURNS trigger AS $$
DECLARE
  v_position INT;
  v_staff_id INT;
BEGIN
  -- Determine staff
  v_staff_id := COALESCE(NEW.id_staff, OLD.id_staff);

  -- Only sync for doctors (position 1=Médecin, 3=Obstétricienne)
  SELECT id_primary_position INTO v_position FROM staff WHERE id_staff = v_staff_id;
  IF v_position NOT IN (1, 3) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    PERFORM fn_sync_doctor_blocks(OLD.id_staff, OLD.start_date, OLD.end_date);
  END IF;
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM fn_sync_doctor_blocks(NEW.id_staff, NEW.start_date, NEW.end_date);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leaves_sync ON staff_leaves;
CREATE TRIGGER trg_leaves_sync
  AFTER INSERT OR UPDATE OR DELETE ON staff_leaves
  FOR EACH ROW EXECUTE FUNCTION fn_trg_leaves_sync();


-- ============================================================
-- 4. TRIGGER sur staff_schedules
-- ============================================================

CREATE OR REPLACE FUNCTION fn_trg_schedules_sync() RETURNS trigger AS $$
DECLARE
  v_staff_id INT;
  v_from DATE;
  v_to DATE;
  v_position INT;
BEGIN
  v_staff_id := COALESCE(NEW.id_staff, OLD.id_staff);

  -- Early return : ne traiter que les médecins (position 1,3) avec schedule_type FIXED
  SELECT id_primary_position INTO v_position FROM staff WHERE id_staff = v_staff_id;
  IF v_position NOT IN (1, 3) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(NEW.schedule_type, OLD.schedule_type) != 'FIXED' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF COALESCE(NEW.entry_type, OLD.entry_type) IN ('OVERRIDE', 'ADDED') THEN
    -- Portée limitée à specific_date(s)
    v_from := LEAST(OLD.specific_date, NEW.specific_date);
    v_to := GREATEST(OLD.specific_date, NEW.specific_date);
    v_from := COALESCE(v_from, v_to);
    v_to := COALESCE(v_to, v_from);
  ELSE
    -- RECURRING : horizon start_date → end_date ou ±6 mois
    v_from := COALESCE(LEAST(OLD.start_date, NEW.start_date), CURRENT_DATE);
    v_to := COALESCE(GREATEST(OLD.end_date, NEW.end_date), (CURRENT_DATE + INTERVAL '6 months')::date);
  END IF;

  PERFORM fn_sync_doctor_blocks(v_staff_id, v_from, v_to);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_schedules_sync ON staff_schedules;
CREATE TRIGGER trg_schedules_sync
  AFTER INSERT OR UPDATE OR DELETE ON staff_schedules
  FOR EACH ROW EXECUTE FUNCTION fn_trg_schedules_sync();


-- ============================================================
-- 5. Fix audit FK to allow cascading deletes, then resync
-- ============================================================

-- Change audit FK to CASCADE so assignment deletions don't get blocked
ALTER TABLE assignment_audit_log DROP CONSTRAINT IF EXISTS assignment_audit_log_id_assignment_fkey;
ALTER TABLE assignment_audit_log
  ADD CONSTRAINT assignment_audit_log_id_assignment_fkey
  FOREIGN KEY (id_assignment) REFERENCES assignments(id_assignment) ON DELETE CASCADE;

-- ============================================================
-- 6. SYNC INITIAL : rattrape toutes les incohérences existantes
-- ============================================================

-- Disable audit trigger during bulk resync
ALTER TABLE assignments DISABLE TRIGGER trg_audit_assignment;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id_staff FROM staff
    WHERE id_primary_position IN (1, 3) AND is_active = true
  LOOP
    PERFORM fn_sync_doctor_blocks(
      r.id_staff,
      (CURRENT_DATE - INTERVAL '1 month')::date,
      (CURRENT_DATE + INTERVAL '6 months')::date
    );
  END LOOP;
END;
$$;

ALTER TABLE assignments ENABLE TRIGGER trg_audit_assignment;

COMMIT;
