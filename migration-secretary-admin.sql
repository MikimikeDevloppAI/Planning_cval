-- ============================================================
-- Migration : Pré-matérialisation secrétaires en ADMIN
--
-- Chaque créneau disponible d'une secrétaire génère un
-- assignment ADMIN (source=SCHEDULE, status=PUBLISHED).
-- Le solveur écrase SCHEDULE+ALGORITHM et recréé from scratch.
-- Les MANUAL sont intouchés.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. fn_sync_secretary_admin_blocks
--    Miroir de fn_sync_doctor_blocks pour les secrétaires
-- ============================================================

CREATE OR REPLACE FUNCTION fn_sync_secretary_admin_blocks(
  p_staff_id INT,
  p_date_from DATE,
  p_date_to DATE
) RETURNS void AS $$
DECLARE
  v_admin_dept INT;
BEGIN

  -- Resolve Administration department
  SELECT id_department INTO v_admin_dept
  FROM departments WHERE name = 'Administration' LIMIT 1;

  IF v_admin_dept IS NULL THEN
    RAISE WARNING 'fn_sync_secretary_admin_blocks: Administration department not found';
    RETURN;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- Étape A : Calculer les disponibilités attendues
  -- ────────────────────────────────────────────────────────

  DROP TABLE IF EXISTS _expected_sec_entries;
  CREATE TEMP TABLE _expected_sec_entries AS

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
      ss.id_schedule, ss.id_staff,
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
      AND ss.schedule_type = 'AVAILABLE'
      AND s.id_primary_position = 2
      AND s.is_active = true
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
      ss.id_schedule, ss.id_staff, 'PM',
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
      AND ss.schedule_type = 'AVAILABLE'
      AND ss.period = 'FULL_DAY'
      AND s.id_primary_position = 2
      AND s.is_active = true
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

  SELECT DISTINCT id_staff, id_schedule, period, id_calendar, date
  FROM without_absences;

  -- ────────────────────────────────────────────────────────
  -- Étape B : Ensure ADMIN work_blocks exist
  -- ────────────────────────────────────────────────────────

  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
  SELECT DISTINCT v_admin_dept, ee.date, ee.period, 'ADMIN', ee.id_calendar
  FROM _expected_sec_entries ee
  ON CONFLICT (id_department, date, period) DO NOTHING;

  -- ────────────────────────────────────────────────────────
  -- Étape C : DELETE assignments SCHEDULE obsolètes
  --           Ne touche PAS MANUAL ni ALGORITHM
  -- ────────────────────────────────────────────────────────

  DELETE FROM assignments a
  USING work_blocks wb
  WHERE a.id_block = wb.id_block
    AND a.id_staff = p_staff_id
    AND a.assignment_type = 'SECRETARY'
    AND a.source = 'SCHEDULE'
    AND wb.block_type = 'ADMIN'
    AND wb.date BETWEEN p_date_from AND p_date_to
    AND NOT EXISTS (
      SELECT 1 FROM _expected_sec_entries ee
      WHERE ee.date = wb.date
        AND ee.period = wb.period
        AND ee.id_staff = a.id_staff
    );

  -- ────────────────────────────────────────────────────────
  -- Étape D : INSERT ADMIN assignments SCHEDULE manquants
  --           Skip si MANUAL actif sur le même (date, period)
  -- ────────────────────────────────────────────────────────

  INSERT INTO assignments (id_block, id_staff, assignment_type, id_role, source, id_schedule, status)
  SELECT wb.id_block, ee.id_staff, 'SECRETARY', 1, 'SCHEDULE', ee.id_schedule, 'PUBLISHED'
  FROM _expected_sec_entries ee
  JOIN work_blocks wb
    ON wb.id_department = v_admin_dept
    AND wb.date = ee.date
    AND wb.period = ee.period
  WHERE NOT EXISTS (
    -- Skip si MANUAL actif pour ce staff au même (date, period) sur n'importe quel block
    SELECT 1 FROM assignments ma
    JOIN work_blocks mwb ON ma.id_block = mwb.id_block
    WHERE ma.id_staff = ee.id_staff
      AND ma.source = 'MANUAL'
      AND ma.status NOT IN ('CANCELLED', 'INVALIDATED')
      AND mwb.date = ee.date
      AND mwb.period = ee.period
  )
  AND NOT EXISTS (
    -- Skip si ALGORITHM actif pour ce staff au même (date, period) sur n'importe quel block
    SELECT 1 FROM assignments aa
    JOIN work_blocks awb ON aa.id_block = awb.id_block
    WHERE aa.id_staff = ee.id_staff
      AND aa.source = 'ALGORITHM'
      AND aa.status NOT IN ('CANCELLED', 'INVALIDATED')
      AND awb.date = ee.date
      AND awb.period = ee.period
  )
  ON CONFLICT (id_block, id_staff) DO UPDATE SET
    id_schedule = EXCLUDED.id_schedule;

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Mettre à jour fn_trg_schedules_sync
--    Fire aussi pour secrétaires AVAILABLE
-- ============================================================

CREATE OR REPLACE FUNCTION fn_trg_schedules_sync() RETURNS trigger AS $$
DECLARE
  v_staff_id INT;
  v_from DATE;
  v_to DATE;
  v_position INT;
  v_schedule_type VARCHAR;
BEGIN
  v_staff_id := COALESCE(NEW.id_staff, OLD.id_staff);
  v_schedule_type := COALESCE(NEW.schedule_type, OLD.schedule_type);

  SELECT id_primary_position INTO v_position FROM staff WHERE id_staff = v_staff_id;

  -- Doctor (position 1, 3) with FIXED schedule → sync doctor blocks
  IF v_position IN (1, 3) AND v_schedule_type = 'FIXED' THEN
    v_from := COALESCE(LEAST(OLD.start_date, NEW.start_date), CURRENT_DATE);
    v_to := COALESCE(GREATEST(OLD.end_date, NEW.end_date), (CURRENT_DATE + INTERVAL '12 months')::date);
    PERFORM fn_sync_doctor_blocks(v_staff_id, v_from, v_to);

  -- Secretary (position 2) with AVAILABLE schedule → sync ADMIN assignments
  ELSIF v_position = 2 AND v_schedule_type = 'AVAILABLE' THEN
    v_from := COALESCE(LEAST(OLD.start_date, NEW.start_date), CURRENT_DATE);
    v_to := COALESCE(GREATEST(OLD.end_date, NEW.end_date), (CURRENT_DATE + INTERVAL '12 months')::date);
    PERFORM fn_sync_secretary_admin_blocks(v_staff_id, v_from, v_to);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Mettre à jour fn_cancel_assignments_for_leave
--    Annule DOCTOR + SECRETARY
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
    AND a.assignment_type IN ('DOCTOR', 'SECRETARY')
    AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
    AND wb.date BETWEEN p_start_date AND p_end_date
    AND (p_period IS NULL OR wb.period = p_period);
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  RETURN v_cancelled;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Mettre à jour fn_restore_assignments_for_leave
--    Dispatch selon la position du staff
-- ============================================================

CREATE OR REPLACE FUNCTION fn_restore_assignments_for_leave(
  p_staff_id INT,
  p_start_date DATE,
  p_end_date DATE
) RETURNS void AS $$
DECLARE
  v_position INT;
BEGIN
  SELECT id_primary_position INTO v_position FROM staff WHERE id_staff = p_staff_id;

  IF v_position IN (1, 3) THEN
    PERFORM fn_sync_doctor_blocks(p_staff_id, p_start_date, p_end_date);
  ELSIF v_position = 2 THEN
    PERFORM fn_sync_secretary_admin_blocks(p_staff_id, p_start_date, p_end_date);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Mettre à jour fn_ensure_weekly_blocks
--    Ajouter sync secrétaires après sync médecins
-- ============================================================

CREATE OR REPLACE FUNCTION fn_ensure_weekly_blocks(
  p_week_start DATE
) RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  -- Pré-créer tous les blocks pour la semaine (lun → ven)
  PERFORM fn_ensure_all_blocks(p_week_start, (p_week_start + 4)::date);

  -- Sync les assignments DOCTOR
  FOR r IN
    SELECT id_staff FROM staff
    WHERE id_primary_position IN (1, 3) AND is_active = true
  LOOP
    PERFORM fn_sync_doctor_blocks(
      r.id_staff,
      p_week_start,
      (p_week_start + 4)::date
    );
  END LOOP;

  -- Sync les assignments SECRETARY → ADMIN
  FOR r IN
    SELECT id_staff FROM staff
    WHERE id_primary_position = 2 AND is_active = true
  LOOP
    PERFORM fn_sync_secretary_admin_blocks(
      r.id_staff,
      p_week_start,
      (p_week_start + 4)::date
    );
  END LOOP;

END;
$$ LANGUAGE plpgsql;

COMMIT;
