import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE OR REPLACE FUNCTION fn_materialize_schedule(
  p_schedule_id int
)
RETURNS int
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_schedule    record;
  v_staff       record;
  v_cycle_weeks int;
  v_dept_id     int;
  v_is_bloc     boolean;
  v_count       int := 0;
  v_today       date := current_date;
BEGIN
  -- 1. Load the schedule
  SELECT * INTO v_schedule
  FROM staff_schedules
  WHERE id_schedule = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- 2. Load staff info
  SELECT * INTO v_staff
  FROM staff
  WHERE id_staff = v_schedule.id_staff;

  -- 3. Get recurrence cycle_weeks (default weekly=1)
  SELECT COALESCE(rt.cycle_weeks, 1) INTO v_cycle_weeks
  FROM recurrence_types rt
  WHERE rt.id_recurrence = COALESCE(v_schedule.id_recurrence, 2);

  IF NOT FOUND THEN
    v_cycle_weeks := 1;
  END IF;

  -- 4. Determine effective department
  --    Secretaries without a department go to Administration (id=8)
  v_dept_id := COALESCE(v_schedule.id_department, 8);
  v_is_bloc := (v_dept_id = 7);

  -- 5. Delete existing future assignments linked to this schedule
  DELETE FROM assignments
  WHERE id_schedule = p_schedule_id
    AND id_block IN (
      SELECT id_block FROM work_blocks WHERE date >= v_today
    );

  -- 6a. Materialize for non-room departments (NOT Bloc opératoire)
  IF NOT v_is_bloc THEN
    INSERT INTO assignments (
      id_block, id_staff, assignment_type, id_role, id_skill, id_activity,
      source, id_schedule, status
    )
    SELECT
      wb.id_block,
      v_schedule.id_staff,
      CASE WHEN v_staff.id_primary_position = 2 THEN 'SECRETARY' ELSE 'DOCTOR' END,
      CASE WHEN v_staff.id_primary_position = 2 THEN 1 ELSE NULL END,
      NULL,
      CASE WHEN v_staff.id_primary_position != 2 THEN v_schedule.id_activity ELSE NULL END,
      'SCHEDULE',
      p_schedule_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM staff_leaves sl
        WHERE sl.id_staff = v_schedule.id_staff
          AND c.date >= sl.start_date AND c.date <= sl.end_date
          AND (sl.period IS NULL OR sl.period = p.period OR sl.period = 'FULL_DAY')
      ) THEN 'CANCELLED' ELSE 'PUBLISHED' END
    FROM calendar c
    CROSS JOIN (VALUES ('AM'), ('PM')) AS p(period)
    JOIN work_blocks wb ON
      wb.id_department = v_dept_id
      AND wb.date = c.date
      AND wb.period = p.period::varchar
      AND wb.id_room IS NULL
    WHERE
      c.date >= v_today
      AND NOT c.is_holiday
      AND NOT c.is_weekend
      -- Match day of week
      AND c.day_of_week = (CASE v_schedule.day_of_week
        WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED'
        WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT'
        WHEN 0 THEN 'SUN'
      END)::day_of_week_enum
      -- Period filter: DAY/FULL_DAY → both AM and PM
      AND (
        v_schedule.period IN ('DAY', 'FULL_DAY')
        OR (v_schedule.period = 'AM' AND p.period = 'AM')
        OR (v_schedule.period = 'PM' AND p.period = 'PM')
      )
      -- Date range
      AND (v_schedule.start_date IS NULL OR c.date >= v_schedule.start_date)
      AND (v_schedule.end_date IS NULL OR c.date <= v_schedule.end_date)
      -- Recurrence
      AND (
        v_cycle_weeks <= 1
        OR (MOD(c.iso_week, v_cycle_weeks) = COALESCE(v_schedule.week_offset, 0))
      )
    ON CONFLICT (id_block, id_staff) DO UPDATE SET
      assignment_type = EXCLUDED.assignment_type,
      id_role = EXCLUDED.id_role,
      id_activity = EXCLUDED.id_activity,
      source = EXCLUDED.source,
      id_schedule = EXCLUDED.id_schedule,
      status = EXCLUDED.status,
      updated_at = now();

    GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 6b. Materialize for Bloc opératoire (with rooms, round-robin)
  ELSE
    WITH matching_dates AS (
      SELECT c.date, p.period
      FROM calendar c
      CROSS JOIN (VALUES ('AM'), ('PM')) AS p(period)
      WHERE
        c.date >= v_today
        AND NOT c.is_holiday
        AND NOT c.is_weekend
        AND c.day_of_week = (CASE v_schedule.day_of_week
          WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED'
          WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT'
          WHEN 0 THEN 'SUN'
        END)::day_of_week_enum
        AND (
          v_schedule.period IN ('DAY', 'FULL_DAY')
          OR (v_schedule.period = 'AM' AND p.period = 'AM')
          OR (v_schedule.period = 'PM' AND p.period = 'PM')
        )
        AND (v_schedule.start_date IS NULL OR c.date >= v_schedule.start_date)
        AND (v_schedule.end_date IS NULL OR c.date <= v_schedule.end_date)
        AND (
          v_cycle_weeks <= 1
          OR (MOD(c.iso_week, v_cycle_weeks) = COALESCE(v_schedule.week_offset, 0))
        )
    ),
    -- For each (date, period), find the first room without an active doctor
    available_blocks AS (
      SELECT DISTINCT ON (md.date, md.period)
        wb.id_block, md.date, md.period
      FROM matching_dates md
      JOIN work_blocks wb ON
        wb.id_department = 7
        AND wb.date = md.date
        AND wb.period = md.period
        AND wb.id_room IS NOT NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.id_block = wb.id_block
          AND a.assignment_type = 'DOCTOR'
          AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
      )
      ORDER BY md.date, md.period, wb.id_room  -- first available room
    )
    INSERT INTO assignments (
      id_block, id_staff, assignment_type, id_role, id_skill, id_activity,
      source, id_schedule, status
    )
    SELECT
      ab.id_block,
      v_schedule.id_staff,
      'DOCTOR',
      NULL,
      NULL,
      v_schedule.id_activity,
      'SCHEDULE',
      p_schedule_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM staff_leaves sl
        WHERE sl.id_staff = v_schedule.id_staff
          AND ab.date >= sl.start_date AND ab.date <= sl.end_date
          AND (sl.period IS NULL OR sl.period = ab.period OR sl.period = 'FULL_DAY')
      ) THEN 'CANCELLED' ELSE 'PUBLISHED' END
    FROM available_blocks ab
    ON CONFLICT (id_block, id_staff) DO UPDATE SET
      id_activity = EXCLUDED.id_activity,
      source = EXCLUDED.source,
      id_schedule = EXCLUDED.id_schedule,
      status = EXCLUDED.status,
      updated_at = now();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Sync work_block.id_activity for new doctor assignments
    UPDATE work_blocks wb
    SET id_activity = a.id_activity
    FROM assignments a
    WHERE a.id_block = wb.id_block
      AND a.id_schedule = p_schedule_id
      AND a.assignment_type = 'DOCTOR'
      AND a.id_activity IS NOT NULL
      AND a.status NOT IN ('CANCELLED', 'INVALIDATED');
  END IF;

  RETURN v_count;
END;
$fn$;
`;

async function main() {
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: fn_materialize_schedule created/replaced.");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
