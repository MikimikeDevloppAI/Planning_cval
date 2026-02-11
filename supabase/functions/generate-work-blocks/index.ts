import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const pool = new Pool(
  {
    tls: { enabled: false },
    database: "postgres",
    hostname: Deno.env.get("DB_HOSTNAME")!,
    user: Deno.env.get("DB_USER") || "postgres",
    port: 6543,
    password: Deno.env.get("DB_PASSWORD")!,
  },
  1
);

const GENERATE_SQL = `
-- ============================================================
-- Step 1: Clear existing data (full regeneration)
-- ============================================================
DELETE FROM assignments WHERE assignment_type = 'DOCTOR';
DELETE FROM work_blocks;

-- ============================================================
-- Step 2-4: Expand schedules, apply overrides, exclude absences
-- Then insert work_blocks and assignments in one shot
-- ============================================================

-- Day-of-week mapping: staff_schedules uses int 1-7, calendar uses enum
-- The enum sort order matches: 1=MON, 2=TUE, ..., 7=SUN

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
    ss.period,
    c.id_calendar,
    c.date
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
  JOIN dow_map dm ON dm.dow_int = ss.day_of_week
  JOIN calendar c ON c.day_of_week = dm.dow_enum
                 AND c.is_weekend = false
                 AND c.is_holiday = false
  WHERE ss.entry_type = 'RECURRING'
    AND ss.is_active = true
    AND ss.schedule_type = 'FIXED'
    AND s.id_primary_position IN (1, 3)  -- Médecins + Obstétriciennes
    AND s.is_active = true
    AND ss.id_department IS NOT NULL
    -- Recurrence check
    AND (
      rt.cycle_weeks = 1  -- every week
      OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = ss.week_offset)
    )
    -- Date range check
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)
),

-- Apply OVERRIDE entries: they cancel the parent schedule for a specific date
-- and replace it with their own values
overridden_parents AS (
  SELECT DISTINCT
    ov.id_parent_schedule,
    ov.specific_date
  FROM staff_schedules ov
  WHERE ov.entry_type = 'OVERRIDE'
    AND ov.is_active = true
),

-- Remove overridden entries from recurring_expanded
recurring_without_overrides AS (
  SELECT re.*
  FROM recurring_expanded re
  WHERE NOT EXISTS (
    SELECT 1 FROM overridden_parents op
    WHERE op.id_parent_schedule = re.id_schedule
      AND op.specific_date = re.date
  )
),

-- Add OVERRIDE entries (replacement schedules for specific dates)
override_entries AS (
  SELECT
    ss.id_schedule,
    ss.id_staff,
    ss.id_department,
    ss.id_activity,
    ss.period,
    c.id_calendar,
    c.date
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN calendar c ON c.date = ss.specific_date
  WHERE ss.entry_type = 'OVERRIDE'
    AND ss.is_active = true
    AND ss.schedule_type = 'FIXED'
    AND s.id_primary_position IN (1, 3)
    AND s.is_active = true
    AND ss.id_department IS NOT NULL
),

-- Add ADDED entries (extra one-off schedules)
added_entries AS (
  SELECT
    ss.id_schedule,
    ss.id_staff,
    ss.id_department,
    ss.id_activity,
    ss.period,
    c.id_calendar,
    c.date
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN calendar c ON c.date = ss.specific_date
  WHERE ss.entry_type = 'ADDED'
    AND ss.is_active = true
    AND ss.schedule_type = 'FIXED'
    AND s.id_primary_position IN (1, 3)
    AND s.is_active = true
    AND ss.id_department IS NOT NULL
),

-- Combine all schedule entries
all_entries AS (
  SELECT * FROM recurring_without_overrides
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
),

-- ============================================================
-- Step 5: Insert CONSULTATION work_blocks (1 per dept/date/period)
-- ============================================================
consultation_blocks AS (
  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
  SELECT DISTINCT
    wa.id_department,
    wa.date,
    wa.period,
    'CONSULTATION',
    wa.id_calendar
  FROM without_absences wa
  WHERE wa.id_activity IS NULL
  RETURNING id_block, id_department, date, period, block_type
),

-- ============================================================
-- Step 6: Insert SURGERY work_blocks (1 per dept/date/period/activity/staff)
-- ============================================================
surgery_blocks AS (
  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar, id_activity)
  SELECT DISTINCT
    wa.id_department,
    wa.date,
    wa.period,
    'SURGERY',
    wa.id_calendar,
    wa.id_activity
  FROM without_absences wa
  WHERE wa.id_activity IS NOT NULL
  RETURNING id_block, id_department, date, period, block_type, id_activity
),

-- ============================================================
-- Step 7a: Insert DOCTOR assignments for CONSULTATION blocks
-- ============================================================
consultation_assignments AS (
  INSERT INTO assignments (id_block, id_staff, assignment_type, source, id_schedule, status)
  SELECT
    cb.id_block,
    wa.id_staff,
    'DOCTOR',
    'SCHEDULE',
    wa.id_schedule,
    'PUBLISHED'
  FROM without_absences wa
  JOIN consultation_blocks cb
    ON cb.id_department = wa.id_department
    AND cb.date = wa.date
    AND cb.period = wa.period
    AND cb.block_type = 'CONSULTATION'
  WHERE wa.id_activity IS NULL
  RETURNING id_assignment
),

-- ============================================================
-- Step 7b: Insert DOCTOR assignments for SURGERY blocks
-- ============================================================
surgery_assignments AS (
  INSERT INTO assignments (id_block, id_staff, assignment_type, source, id_schedule, status)
  SELECT DISTINCT ON (sb.id_block, wa.id_staff)
    sb.id_block,
    wa.id_staff,
    'DOCTOR',
    'SCHEDULE',
    wa.id_schedule,
    'PUBLISHED'
  FROM without_absences wa
  JOIN surgery_blocks sb
    ON sb.id_department = wa.id_department
    AND sb.date = wa.date
    AND sb.period = wa.period
    AND sb.block_type = 'SURGERY'
    AND sb.id_activity = wa.id_activity
  WHERE wa.id_activity IS NOT NULL
  RETURNING id_assignment
)

-- Return counts
SELECT
  (SELECT COUNT(*) FROM consultation_blocks) + (SELECT COUNT(*) FROM surgery_blocks) AS work_blocks_created,
  (SELECT COUNT(*) FROM consultation_assignments) + (SELECT COUNT(*) FROM surgery_assignments) AS assignments_created,
  (SELECT COUNT(*) FROM consultation_blocks) AS consultation_blocks,
  (SELECT COUNT(*) FROM surgery_blocks) AS surgery_blocks;
`;

Deno.serve(async (_req) => {
  const connection = await pool.connect();
  try {
    const result = await connection.queryObject(GENERATE_SQL);
    const row = result.rows[0] as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        success: true,
        work_blocks_created: Number(row.work_blocks_created),
        assignments_created: Number(row.assignments_created),
        consultation_blocks: Number(row.consultation_blocks),
        surgery_blocks: Number(row.surgery_blocks),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: (err as Error).message,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  } finally {
    connection.release();
  }
});
