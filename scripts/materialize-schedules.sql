-- ============================================================
-- Materialize all staff_schedules into assignments
-- ============================================================
-- This script:
--   1. TRUNCATES the assignments table (cascade)
--   2. Resets the id_assignment sequence
--   3. Clears id_activity on all work_blocks
--   4. For each active staff_schedule, creates assignments on matching work_blocks
--      - Respects day_of_week, period (DAY → AM + PM), recurrence, week_offset
--      - Respects start_date / end_date constraints
--      - For Bloc opératoire (dept 7 with rooms), assigns to first available room
--      - Syncs work_block.id_activity for doctor assignments
--   5. Doctors (position 1 & 3) → assignment_type = 'DOCTOR', status = 'PUBLISHED'
--   6. Secretaries (position 2) → assignment_type = 'SECRETARY', status = 'PUBLISHED'
-- ============================================================

BEGIN;

-- ── Step 1: Clean slate ──────────────────────────────────────
TRUNCATE TABLE assignments RESTART IDENTITY CASCADE;

-- ── Step 2: Clear all work_block activities ───────────────────
UPDATE work_blocks SET id_activity = NULL;

-- ── Step 3: Map day_of_week numbers to calendar day_of_week strings ──
-- staff_schedules.day_of_week: 1=MON, 2=TUE, 3=WED, 4=THU, 5=FRI, 6=SAT, 0=SUN
-- calendar.day_of_week: 'MON','TUE','WED','THU','FRI','SAT','SUN'

-- ── Step 4: Materialize non-room schedules ──
-- For departments other than Bloc opératoire (id=7)
-- Secretaries with NULL department → assigned to Administration (id=8)
-- For FULL_DAY (period='DAY'), expand into AM + PM
INSERT INTO assignments (
  id_block, id_staff, assignment_type, id_role, id_skill, id_activity,
  source, id_schedule, status
)
SELECT
  wb.id_block,
  ss.id_staff,
  CASE WHEN s.id_primary_position = 2 THEN 'SECRETARY' ELSE 'DOCTOR' END,
  CASE WHEN s.id_primary_position = 2 THEN 1 ELSE NULL END,  -- secretary default role=1 (Standard)
  NULL,  -- id_skill
  CASE WHEN s.id_primary_position != 2 THEN ss.id_activity ELSE NULL END,  -- doctors get activity, secretaries cannot (chk_secretary_no_activity)
  'SCHEDULE',
  ss.id_schedule,
  -- If a leave overlaps this date+period → CANCELLED, otherwise PUBLISHED
  CASE WHEN EXISTS (
    SELECT 1 FROM staff_leaves sl
    WHERE sl.id_staff = ss.id_staff
      AND c.date >= sl.start_date AND c.date <= sl.end_date
      AND (sl.period IS NULL OR sl.period = p.period OR sl.period = 'FULL_DAY')
  ) THEN 'CANCELLED' ELSE 'PUBLISHED' END
FROM staff_schedules ss
JOIN staff s ON s.id_staff = ss.id_staff
JOIN calendar c ON
  c.day_of_week = (CASE ss.day_of_week
    WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED'
    WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT'
    WHEN 0 THEN 'SUN'
  END)::day_of_week_enum
  AND NOT c.is_holiday
  AND NOT c.is_weekend
JOIN recurrence_types rt ON rt.id_recurrence = COALESCE(ss.id_recurrence, 2) -- default=weekly
CROSS JOIN (VALUES ('AM'), ('PM')) AS p(period)
JOIN work_blocks wb ON
  -- If department is NULL (secretaries with availability-only schedules), assign to Administration (8)
  wb.id_department = COALESCE(ss.id_department, 8)
  AND wb.date = c.date
  AND wb.period = p.period::varchar
  AND wb.id_room IS NULL  -- non-room blocks only
WHERE
  ss.is_active = true
  AND COALESCE(ss.id_department, 8) != 7  -- exclude Bloc opératoire (handled separately)
  -- Period filter: DAY matches both AM and PM, AM matches AM, PM matches PM
  AND (
    ss.period = 'DAY'
    OR (ss.period = 'AM' AND p.period = 'AM')
    OR (ss.period = 'PM' AND p.period = 'PM')
    OR (ss.period = 'FULL_DAY' AND TRUE)  -- FULL_DAY also matches both
  )
  -- Date range constraints
  AND (ss.start_date IS NULL OR c.date >= ss.start_date)
  AND (ss.end_date IS NULL OR c.date <= ss.end_date)
  -- Recurrence: weekly (cycle_weeks=1) always matches;
  -- bi/tri-weekly: (iso_week % cycle_weeks) must equal week_offset
  AND (
    rt.cycle_weeks <= 1
    OR (MOD(c.iso_week, rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
  )
ON CONFLICT (id_block, id_staff) DO NOTHING;

-- ── Step 5: Materialize Bloc opératoire (dept 7) schedules with room assignment ──
-- Doctors are assigned to the first available room (round-robin by room id)
-- We use a window function to number doctors per (date, period) and assign rooms
WITH bloc_schedules AS (
  SELECT
    ss.id_schedule,
    ss.id_staff,
    s.id_primary_position,
    ss.id_activity,
    c.date,
    p.period
  FROM staff_schedules ss
  JOIN staff s ON s.id_staff = ss.id_staff
  JOIN calendar c ON
    c.day_of_week = (CASE ss.day_of_week
      WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED'
      WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT'
      WHEN 0 THEN 'SUN'
    END)::day_of_week_enum
    AND NOT c.is_holiday
    AND NOT c.is_weekend
  JOIN recurrence_types rt ON rt.id_recurrence = COALESCE(ss.id_recurrence, 2)
  CROSS JOIN (VALUES ('AM'), ('PM')) AS p(period)
  WHERE
    ss.is_active = true
    AND ss.id_department = 7  -- Bloc opératoire only
    AND (
      ss.period = 'DAY'
      OR (ss.period = 'AM' AND p.period = 'AM')
      OR (ss.period = 'PM' AND p.period = 'PM')
      OR (ss.period = 'FULL_DAY' AND TRUE)
    )
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)
    AND (
      rt.cycle_weeks <= 1
      OR (MOD(c.iso_week, rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
    )
),
-- Number each doctor per date+period to assign them sequentially to rooms
numbered AS (
  SELECT
    bs.*,
    ROW_NUMBER() OVER (PARTITION BY bs.date, bs.period ORDER BY bs.id_staff) AS rn
  FROM bloc_schedules bs
),
-- Get ordered rooms for round-robin assignment
rooms_ordered AS (
  SELECT id_room, ROW_NUMBER() OVER (ORDER BY id_room) AS room_idx
  FROM rooms
  WHERE id_location = 7 AND is_active = true
),
room_count AS (
  SELECT COUNT(*) AS cnt FROM rooms WHERE id_location = 7 AND is_active = true
)
INSERT INTO assignments (
  id_block, id_staff, assignment_type, id_role, id_skill, id_activity,
  source, id_schedule, status
)
SELECT
  wb.id_block,
  n.id_staff,
  CASE WHEN n.id_primary_position = 2 THEN 'SECRETARY' ELSE 'DOCTOR' END,
  CASE WHEN n.id_primary_position = 2 THEN 1 ELSE NULL END,
  NULL,
  CASE WHEN n.id_primary_position != 2 THEN n.id_activity ELSE NULL END,
  'SCHEDULE',
  n.id_schedule,
  CASE WHEN EXISTS (
    SELECT 1 FROM staff_leaves sl
    WHERE sl.id_staff = n.id_staff
      AND n.date >= sl.start_date AND n.date <= sl.end_date
      AND (sl.period IS NULL OR sl.period = n.period OR sl.period = 'FULL_DAY')
  ) THEN 'CANCELLED' ELSE 'PUBLISHED' END
FROM numbered n
JOIN rooms_ordered ro ON ro.room_idx = ((n.rn - 1) % (SELECT cnt FROM room_count)) + 1
JOIN work_blocks wb ON
  wb.id_department = 7
  AND wb.date = n.date
  AND wb.period = n.period
  AND wb.id_room = ro.id_room
ON CONFLICT (id_block, id_staff) DO NOTHING;

-- ── Step 6: Sync work_block.id_activity from doctor assignments ──
-- For each block that has a DOCTOR assignment with an activity, update the block
UPDATE work_blocks wb
SET id_activity = a.id_activity
FROM assignments a
WHERE a.id_block = wb.id_block
  AND a.assignment_type = 'DOCTOR'
  AND a.id_activity IS NOT NULL
  AND a.status NOT IN ('CANCELLED', 'INVALIDATED');

COMMIT;

-- ── Report ──────────────────────────────────────────────────
SELECT
  assignment_type,
  source,
  status,
  COUNT(*) AS cnt
FROM assignments
GROUP BY assignment_type, source, status
ORDER BY assignment_type, source, status;
