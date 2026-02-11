require('dotenv').config();
const { Client } = require('pg');

async function debug() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // 1. How many working days in calendar (not weekend, not holiday)?
  const workDays = await client.query(`
    SELECT COUNT(*) as total FROM calendar WHERE is_weekend = false AND is_holiday = false
  `);
  console.log(`Working days in calendar: ${workDays.rows[0].total}`);

  // 2. How many departments have schedules?
  const depts = await client.query(`
    SELECT d.name, d.id_department, COUNT(DISTINCT ss.id_staff) as nb_staff,
           COUNT(DISTINCT ss.id_schedule) as nb_schedules
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN departments d ON ss.id_department = d.id_department
    WHERE s.id_primary_position IN (1, 3) AND ss.is_active = true AND ss.id_activity IS NULL
    GROUP BY d.name, d.id_department
    ORDER BY d.name
  `);
  console.log('\n=== Departments with CONSULTATION schedules ===');
  depts.rows.forEach(r => console.log(`  ${r.name}: ${r.nb_staff} staff, ${r.nb_schedules} schedules`));

  // 3. Breakdown of 1-doctor blocks by department
  const oneDoc = await client.query(`
    SELECT d.name as department, COUNT(*) as nb_blocks
    FROM work_blocks wb
    JOIN departments d ON wb.id_department = d.id_department
    JOIN (
      SELECT id_block, COUNT(*) as doc_count
      FROM assignments
      WHERE assignment_type = 'DOCTOR'
      GROUP BY id_block
      HAVING COUNT(*) = 1
    ) single ON single.id_block = wb.id_block
    WHERE wb.block_type = 'CONSULTATION'
    GROUP BY d.name
    ORDER BY nb_blocks DESC
  `);
  console.log('\n=== 1-doctor CONSULTATION blocks by department ===');
  oneDoc.rows.forEach(r => console.log(`  ${r.department}: ${r.nb_blocks} blocks`));

  // 4. Total consultation blocks by department
  const totalByDept = await client.query(`
    SELECT d.name, COUNT(*) as nb_blocks
    FROM work_blocks wb
    JOIN departments d ON wb.id_department = d.id_department
    WHERE wb.block_type = 'CONSULTATION'
    GROUP BY d.name
    ORDER BY nb_blocks DESC
  `);
  console.log('\n=== Total CONSULTATION blocks by department ===');
  totalByDept.rows.forEach(r => console.log(`  ${r.name}: ${r.nb_blocks}`));

  // 5. Check: departments with only 1 doctor scheduled — are these correct?
  const singleStaffDepts = await client.query(`
    SELECT d.name, ss.day_of_week, ss.period, rt.name as recurrence, ss.week_offset,
           s.lastname, s.firstname
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN departments d ON ss.id_department = d.id_department
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    WHERE s.id_primary_position IN (1, 3)
      AND ss.is_active = true
      AND ss.id_activity IS NULL
      AND d.id_department IN (
        SELECT ss2.id_department
        FROM staff_schedules ss2
        JOIN staff s2 ON ss2.id_staff = s2.id_staff
        WHERE s2.id_primary_position IN (1, 3) AND ss2.is_active = true AND ss2.id_activity IS NULL
        GROUP BY ss2.id_department
        HAVING COUNT(DISTINCT ss2.id_staff) = 1
      )
    ORDER BY d.name, ss.day_of_week, ss.period
  `);
  console.log('\n=== Departments with only 1 doctor (consultation schedules) ===');
  singleStaffDepts.rows.forEach(r =>
    console.log(`  ${r.name} | ${r.lastname} ${r.firstname} | dow=${r.day_of_week} ${r.period} | ${r.recurrence} offset=${r.week_offset}`)
  );

  // 6. Quick sanity: expected blocks for a dept with 1 doctor doing weekly mon-fri AM+PM
  const expected = await client.query(`
    SELECT d.name, ss.day_of_week, ss.period, rt.cycle_weeks, ss.week_offset,
           s.lastname
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN departments d ON ss.id_department = d.id_department
    JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
    WHERE s.id_primary_position IN (1, 3)
      AND ss.is_active = true
      AND ss.id_activity IS NULL
    ORDER BY d.name, ss.day_of_week, ss.period
  `);
  console.log('\n=== All CONSULTATION schedule entries ===');
  expected.rows.forEach(r =>
    console.log(`  ${r.name.padEnd(20)} | ${r.lastname.padEnd(15)} | dow=${r.day_of_week} ${r.period} | cycle=${r.cycle_weeks} offset=${r.week_offset}`)
  );

  await client.end();
}
debug();
