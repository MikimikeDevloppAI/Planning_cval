-- Merge AM+PM pairs with identical attributes into a single DAY row
-- Also updates all DB objects that reference FULL_DAY
-- Run with: node scripts/db.mjs scripts/merge-schedule-pairs.sql

BEGIN;

-- 1. Disable the trigger so it doesn't fire during migration
ALTER TABLE staff_schedules DISABLE TRIGGER trg_schedules_sync;

-- 2. Drop dependent views
DROP VIEW IF EXISTS v_secretary_eligibility;
DROP VIEW IF EXISTS v_secretary_availability;

-- 3. Widen period column and update CHECK
ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS chk_period;
ALTER TABLE staff_schedules ALTER COLUMN period TYPE varchar(10);
ALTER TABLE staff_schedules ADD CONSTRAINT chk_period CHECK (period IN ('AM', 'PM', 'DAY'));

-- 4. Convert any existing FULL_DAY → DAY
UPDATE staff_schedules SET period = 'DAY' WHERE period = 'FULL_DAY';

-- 5. Find and merge AM+PM pairs
CREATE TEMP TABLE _pairs AS
SELECT
  MIN(CASE WHEN period = 'AM' THEN id_schedule END) AS am_id,
  MIN(CASE WHEN period = 'PM' THEN id_schedule END) AS pm_id
FROM staff_schedules
WHERE is_active = true
  AND period IN ('AM', 'PM')
GROUP BY
  id_staff, day_of_week, id_department, schedule_type,
  COALESCE(id_recurrence, -1), COALESCE(week_offset, -1),
  COALESCE(start_date, '1900-01-01'), COALESCE(end_date, '1900-01-01'),
  COALESCE(id_activity, -1)
HAVING COUNT(*) FILTER (WHERE period = 'AM') = 1
   AND COUNT(*) FILTER (WHERE period = 'PM') = 1;

UPDATE staff_schedules SET period = 'DAY'
FROM _pairs WHERE staff_schedules.id_schedule = _pairs.am_id;

-- Re-point assignments from PM schedule → DAY schedule (formerly AM)
UPDATE assignments SET id_schedule = _pairs.am_id
FROM _pairs WHERE assignments.id_schedule = _pairs.pm_id;

DELETE FROM staff_schedules
USING _pairs WHERE staff_schedules.id_schedule = _pairs.pm_id;

SELECT COUNT(*) AS pairs_merged FROM _pairs;
DROP TABLE _pairs;

-- 6. Update fn_sync_doctor_blocks: FULL_DAY → DAY
CREATE OR REPLACE FUNCTION fn_sync_doctor_blocks(p_staff_id INT, p_date_from DATE, p_date_to DATE) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  DROP TABLE IF EXISTS _expected_entries;
  CREATE TEMP TABLE _expected_entries AS
  WITH dow_map(dow_int, dow_enum) AS (
    VALUES (1,'MON'::day_of_week_enum),(2,'TUE'::day_of_week_enum),(3,'WED'::day_of_week_enum),
           (4,'THU'::day_of_week_enum),(5,'FRI'::day_of_week_enum),(6,'SAT'::day_of_week_enum),(7,'SUN'::day_of_week_enum)
  ),
  recurring_expanded AS (
    SELECT ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      CASE WHEN ss.period = 'DAY' THEN 'AM' ELSE ss.period END AS period,
      c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    JOIN dow_map dm ON dm.dow_int = ss.day_of_week
    JOIN calendar c ON c.day_of_week = dm.dow_enum AND c.is_weekend = false AND c.is_holiday = false
    WHERE ss.id_staff = p_staff_id AND ss.is_active = true AND ss.schedule_type = 'FIXED'
      AND s.id_primary_position IN (1, 3) AND s.is_active = true AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to
      AND (rt.cycle_weeks = 1 OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0)))
      AND (ss.start_date IS NULL OR c.date >= ss.start_date)
      AND (ss.end_date IS NULL OR c.date <= ss.end_date)
    UNION ALL
    SELECT ss.id_schedule, ss.id_staff, ss.id_department, ss.id_activity,
      'PM', c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    JOIN dow_map dm ON dm.dow_int = ss.day_of_week
    JOIN calendar c ON c.day_of_week = dm.dow_enum AND c.is_weekend = false AND c.is_holiday = false
    WHERE ss.id_staff = p_staff_id AND ss.is_active = true AND ss.schedule_type = 'FIXED'
      AND ss.period = 'DAY'
      AND s.id_primary_position IN (1, 3) AND s.is_active = true AND ss.id_department IS NOT NULL
      AND c.date BETWEEN p_date_from AND p_date_to
      AND (rt.cycle_weeks = 1 OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0)))
      AND (ss.start_date IS NULL OR c.date >= ss.start_date)
      AND (ss.end_date IS NULL OR c.date <= ss.end_date)
  ),
  without_absences AS (
    SELECT re.* FROM recurring_expanded re
    WHERE NOT EXISTS (
      SELECT 1 FROM staff_leaves sl
      WHERE sl.id_staff = re.id_staff AND re.date BETWEEN sl.start_date AND sl.end_date
        AND (sl.period IS NULL OR sl.period = re.period)
    )
  )
  SELECT DISTINCT id_staff, id_schedule, id_department, id_activity, period, id_calendar, date
  FROM without_absences;

  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
  SELECT DISTINCT id_department, date, period,
    CASE WHEN id_activity IS NULL THEN 'CONSULTATION' ELSE 'SURGERY' END, id_calendar
  FROM _expected_entries
  ON CONFLICT (id_department, date, period) DO NOTHING;

  DELETE FROM assignments a
  USING work_blocks wb
  WHERE a.id_block = wb.id_block AND a.id_staff = p_staff_id
    AND a.assignment_type = 'DOCTOR' AND a.source = 'SCHEDULE'
    AND wb.date BETWEEN p_date_from AND p_date_to
    AND NOT EXISTS (
      SELECT 1 FROM _expected_entries ee
      WHERE ee.id_department = wb.id_department AND ee.date = wb.date
        AND ee.period = wb.period AND ee.id_staff = a.id_staff
    );

  INSERT INTO assignments (id_block, id_staff, assignment_type, id_activity, source, id_schedule, status)
  SELECT wb.id_block, ee.id_staff, 'DOCTOR', ee.id_activity, 'SCHEDULE', ee.id_schedule, 'PUBLISHED'
  FROM _expected_entries ee
  JOIN work_blocks wb ON wb.id_department = ee.id_department AND wb.date = ee.date AND wb.period = ee.period
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments ma
    WHERE ma.id_block = wb.id_block AND ma.id_staff = ee.id_staff
      AND ma.source = 'MANUAL' AND ma.status NOT IN ('CANCELLED', 'INVALIDATED')
  )
  ON CONFLICT (id_block, id_staff) DO UPDATE SET
    id_activity = EXCLUDED.id_activity, id_schedule = EXCLUDED.id_schedule;
END;
$$;

-- 7. Update fn_sync_secretary_admin_blocks: FULL_DAY → DAY
CREATE OR REPLACE FUNCTION fn_sync_secretary_admin_blocks(p_staff_id INT, p_date_from DATE, p_date_to DATE) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_admin_dept INT;
BEGIN
  SELECT id_department INTO v_admin_dept FROM departments WHERE name = 'Administration' LIMIT 1;
  IF v_admin_dept IS NULL THEN
    RAISE WARNING 'fn_sync_secretary_admin_blocks: Administration department not found';
    RETURN;
  END IF;

  DROP TABLE IF EXISTS _expected_sec_entries;
  CREATE TEMP TABLE _expected_sec_entries AS
  WITH dow_map(dow_int, dow_enum) AS (
    VALUES (1,'MON'::day_of_week_enum),(2,'TUE'::day_of_week_enum),(3,'WED'::day_of_week_enum),
           (4,'THU'::day_of_week_enum),(5,'FRI'::day_of_week_enum),(6,'SAT'::day_of_week_enum),(7,'SUN'::day_of_week_enum)
  ),
  recurring_expanded AS (
    SELECT ss.id_schedule, ss.id_staff,
      CASE WHEN ss.period = 'DAY' THEN 'AM' ELSE ss.period END AS period,
      c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    JOIN dow_map dm ON dm.dow_int = ss.day_of_week
    JOIN calendar c ON c.day_of_week = dm.dow_enum AND c.is_weekend = false AND c.is_holiday = false
    WHERE ss.id_staff = p_staff_id AND ss.is_active = true AND ss.schedule_type = 'AVAILABLE'
      AND s.id_primary_position = 2 AND s.is_active = true
      AND c.date BETWEEN p_date_from AND p_date_to
      AND (rt.cycle_weeks = 1 OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0)))
      AND (ss.start_date IS NULL OR c.date >= ss.start_date)
      AND (ss.end_date IS NULL OR c.date <= ss.end_date)
    UNION ALL
    SELECT ss.id_schedule, ss.id_staff, 'PM', c.id_calendar, c.date
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    JOIN dow_map dm ON dm.dow_int = ss.day_of_week
    JOIN calendar c ON c.day_of_week = dm.dow_enum AND c.is_weekend = false AND c.is_holiday = false
    WHERE ss.id_staff = p_staff_id AND ss.is_active = true AND ss.schedule_type = 'AVAILABLE'
      AND ss.period = 'DAY'
      AND s.id_primary_position = 2 AND s.is_active = true
      AND c.date BETWEEN p_date_from AND p_date_to
      AND (rt.cycle_weeks = 1 OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0)))
      AND (ss.start_date IS NULL OR c.date >= ss.start_date)
      AND (ss.end_date IS NULL OR c.date <= ss.end_date)
  ),
  without_absences AS (
    SELECT re.* FROM recurring_expanded re
    WHERE NOT EXISTS (
      SELECT 1 FROM staff_leaves sl
      WHERE sl.id_staff = re.id_staff AND re.date BETWEEN sl.start_date AND sl.end_date
        AND (sl.period IS NULL OR sl.period = re.period)
    )
  )
  SELECT DISTINCT id_staff, id_schedule, period, id_calendar, date
  FROM without_absences;

  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
  SELECT DISTINCT v_admin_dept, ee.date, ee.period, 'ADMIN', ee.id_calendar
  FROM _expected_sec_entries ee
  ON CONFLICT (id_department, date, period) DO NOTHING;

  DELETE FROM assignments a
  USING work_blocks wb
  WHERE a.id_block = wb.id_block AND a.id_staff = p_staff_id
    AND a.assignment_type = 'SECRETARY' AND a.source = 'SCHEDULE'
    AND wb.block_type = 'ADMIN' AND wb.date BETWEEN p_date_from AND p_date_to
    AND NOT EXISTS (
      SELECT 1 FROM _expected_sec_entries ee
      WHERE ee.date = wb.date AND ee.period = wb.period AND ee.id_staff = a.id_staff
    );

  INSERT INTO assignments (id_block, id_staff, assignment_type, id_role, source, id_schedule, status)
  SELECT wb.id_block, ee.id_staff, 'SECRETARY', 1, 'SCHEDULE', ee.id_schedule, 'PUBLISHED'
  FROM _expected_sec_entries ee
  JOIN work_blocks wb ON wb.id_department = v_admin_dept AND wb.date = ee.date AND wb.period = ee.period
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments ma
    JOIN work_blocks mwb ON ma.id_block = mwb.id_block
    WHERE ma.id_staff = ee.id_staff AND ma.source = 'MANUAL'
      AND ma.status NOT IN ('CANCELLED', 'INVALIDATED') AND mwb.date = ee.date AND mwb.period = ee.period
  )
  AND NOT EXISTS (
    SELECT 1 FROM assignments aa
    JOIN work_blocks awb ON aa.id_block = awb.id_block
    WHERE aa.id_staff = ee.id_staff AND aa.source = 'ALGORITHM'
      AND aa.status NOT IN ('CANCELLED', 'INVALIDATED') AND awb.date = ee.date AND awb.period = ee.period
  )
  ON CONFLICT (id_block, id_staff) DO UPDATE SET id_schedule = EXCLUDED.id_schedule;
END;
$$;

-- 8. Recreate v_secretary_availability with DAY
CREATE OR REPLACE VIEW v_secretary_availability AS
WITH dow_map(dow_int, dow_enum) AS (
  VALUES (1,'MON'::day_of_week_enum),(2,'TUE'::day_of_week_enum),
         (3,'WED'::day_of_week_enum),(4,'THU'::day_of_week_enum),
         (5,'FRI'::day_of_week_enum),(6,'SAT'::day_of_week_enum),
         (7,'SUN'::day_of_week_enum)
),
recurring_expanded AS (
  SELECT ss.id_schedule, ss.id_staff, c.date,
    CASE WHEN ss.period = 'DAY' THEN 'AM'::varchar(10) ELSE ss.period END AS period
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
  JOIN dow_map dm ON dm.dow_int = ss.day_of_week
  JOIN calendar c ON c.day_of_week = dm.dow_enum AND c.is_weekend = false AND c.is_holiday = false
  WHERE ss.is_active = true AND ss.schedule_type = 'AVAILABLE'
    AND s.id_primary_position = 2 AND s.is_active = true
    AND (rt.cycle_weeks = 1 OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0)))
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)
  UNION ALL
  SELECT ss.id_schedule, ss.id_staff, c.date, 'PM'::varchar(10)
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
  JOIN dow_map dm ON dm.dow_int = ss.day_of_week
  JOIN calendar c ON c.day_of_week = dm.dow_enum AND c.is_weekend = false AND c.is_holiday = false
  WHERE ss.is_active = true AND ss.schedule_type = 'AVAILABLE'
    AND ss.period = 'DAY'
    AND s.id_primary_position = 2 AND s.is_active = true
    AND (rt.cycle_weeks = 1 OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0)))
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)
),
deduped AS (
  SELECT DISTINCT id_staff, date, period FROM recurring_expanded
),
without_leaves AS (
  SELECT d.id_staff, d.date, d.period FROM deduped d
  WHERE NOT EXISTS (
    SELECT 1 FROM staff_leaves sl
    WHERE sl.id_staff = d.id_staff AND d.date >= sl.start_date AND d.date <= sl.end_date
      AND (sl.period IS NULL OR sl.period = d.period)
  )
)
SELECT wl.id_staff, s.lastname, s.firstname, wl.date, wl.period,
  COALESCE(ss.is_flexible, false) AS is_flexible,
  CASE WHEN COALESCE(ss.flexibility_pct, 100) > 1
       THEN COALESCE(ss.flexibility_pct, 100) / 100.0
       ELSE COALESCE(ss.flexibility_pct, 1.0) END AS flexibility_pct,
  COALESCE(ss.full_day_only, false) AS full_day_only,
  COALESCE(ss.admin_target, 0) AS admin_target
FROM without_leaves wl
JOIN staff s ON wl.id_staff = s.id_staff
LEFT JOIN staff_secretary_settings ss ON wl.id_staff = ss.id_staff;

-- 9. Recreate v_secretary_eligibility
CREATE OR REPLACE VIEW v_secretary_eligibility AS
WITH medical_needs AS (
  SELECT sn.id_block, sn.date, sn.period, sn.block_type, sn.department, sn.site,
    sn.skill_name, sn.role_name, sn.id_skill, sn.id_role, sn.needed, sn.assigned, sn.gap,
    wb.id_department, d.id_site
  FROM v_staffing_needs sn
  JOIN work_blocks wb ON sn.id_block = wb.id_block
  JOIN departments d ON wb.id_department = d.id_department
  WHERE sn.gap > 0
),
avail AS (SELECT * FROM v_secretary_availability),
interdit_site AS (SELECT id_staff, id_site FROM staff_preferences WHERE preference = 'INTERDIT' AND target_type = 'SITE'),
interdit_dept AS (SELECT id_staff, id_department FROM staff_preferences WHERE preference = 'INTERDIT' AND target_type = 'DEPARTMENT'),
interdit_staff AS (SELECT id_staff, id_target_staff FROM staff_preferences WHERE preference = 'INTERDIT' AND target_type = 'STAFF'),
interdit_role AS (SELECT id_staff, id_role, day_of_week FROM staff_preferences WHERE preference = 'INTERDIT' AND target_type = 'ROLE'),
doctors_per_block AS (SELECT a.id_block, a.id_staff AS id_doctor FROM assignments a WHERE a.assignment_type = 'DOCTOR' AND a.status NOT IN ('CANCELLED','INVALIDATED')),
eviter_site AS (SELECT id_staff, id_site, -25 AS penalty FROM staff_preferences WHERE preference = 'EVITER' AND target_type = 'SITE'),
eviter_dept AS (SELECT id_staff, id_department, -15 AS penalty FROM staff_preferences WHERE preference = 'EVITER' AND target_type = 'DEPARTMENT'),
eviter_staff AS (SELECT id_staff, id_target_staff, -10 AS penalty FROM staff_preferences WHERE preference = 'EVITER' AND target_type = 'STAFF'),
prefere_site AS (SELECT id_staff, id_site, 20 AS bonus FROM staff_preferences WHERE preference = 'PREFERE' AND target_type = 'SITE'),
prefere_dept AS (SELECT id_staff, id_department, 15 AS bonus FROM staff_preferences WHERE preference = 'PREFERE' AND target_type = 'DEPARTMENT'),
prefere_staff AS (SELECT id_staff, id_target_staff, 10 AS bonus FROM staff_preferences WHERE preference = 'PREFERE' AND target_type = 'STAFF'),
eligible_raw AS (
  SELECT a.id_staff, a.lastname, a.firstname, a.is_flexible, a.flexibility_pct,
    a.full_day_only, a.admin_target,
    n.id_block, n.date, n.period, n.block_type, n.department, n.site,
    n.skill_name, n.role_name, n.id_skill, n.id_role, n.gap, n.id_department, n.id_site,
    ss.preference AS skill_preference, (5 - ss.preference) * 10 AS skill_score,
    'MEDICAL'::text AS need_type
  FROM avail a
  JOIN medical_needs n ON a.date = n.date AND a.period = n.period
  JOIN staff_skills ss ON a.id_staff = ss.id_staff AND n.id_skill = ss.id_skill
  WHERE NOT EXISTS (SELECT 1 FROM interdit_site isite WHERE isite.id_staff = a.id_staff AND isite.id_site = n.id_site)
    AND NOT EXISTS (SELECT 1 FROM interdit_dept idept WHERE idept.id_staff = a.id_staff AND idept.id_department = n.id_department)
    AND NOT EXISTS (SELECT 1 FROM interdit_staff istaff JOIN doctors_per_block dpb ON dpb.id_block = n.id_block WHERE istaff.id_staff = a.id_staff AND istaff.id_target_staff = dpb.id_doctor)
    AND NOT EXISTS (SELECT 1 FROM interdit_role irole WHERE irole.id_staff = a.id_staff AND irole.id_role = n.id_role AND (irole.day_of_week IS NULL OR irole.day_of_week = lower(to_char(n.date, 'FMDay'))))
)
SELECT e.*,
  COALESCE(es.penalty, 0) AS eviter_site_score,
  COALESCE(ed.penalty, 0) AS eviter_dept_score,
  COALESCE(est.staff_penalty, 0::bigint) AS eviter_staff_score,
  COALESCE(ps.bonus, 0) AS prefere_site_score,
  COALESCE(pd.bonus, 0) AS prefere_dept_score,
  COALESCE(pst.staff_bonus, 0::bigint) AS prefere_staff_score,
  (5 - e.skill_preference) * 10
    + COALESCE(es.penalty, 0) + COALESCE(ed.penalty, 0) + COALESCE(est.staff_penalty, 0::bigint)
    + COALESCE(ps.bonus, 0) + COALESCE(pd.bonus, 0) + COALESCE(pst.staff_bonus, 0::bigint) AS base_score
FROM eligible_raw e
LEFT JOIN eviter_site es ON es.id_staff = e.id_staff AND es.id_site = e.id_site
LEFT JOIN eviter_dept ed ON ed.id_staff = e.id_staff AND ed.id_department = e.id_department
LEFT JOIN LATERAL (SELECT sum(evs.penalty) AS staff_penalty FROM eviter_staff evs JOIN doctors_per_block dpb ON dpb.id_block = e.id_block WHERE evs.id_staff = e.id_staff AND evs.id_target_staff = dpb.id_doctor) est ON true
LEFT JOIN prefere_site ps ON ps.id_staff = e.id_staff AND ps.id_site = e.id_site
LEFT JOIN prefere_dept pd ON pd.id_staff = e.id_staff AND pd.id_department = e.id_department
LEFT JOIN LATERAL (SELECT sum(pfs.bonus) AS staff_bonus FROM prefere_staff pfs JOIN doctors_per_block dpb ON dpb.id_block = e.id_block WHERE pfs.id_staff = e.id_staff AND pfs.id_target_staff = dpb.id_doctor) pst ON true;

-- 10. Re-enable the trigger
ALTER TABLE staff_schedules ENABLE TRIGGER trg_schedules_sync;

COMMIT;

-- Verify
SELECT period, COUNT(*) AS cnt
FROM staff_schedules WHERE is_active = true
GROUP BY period ORDER BY period;
