require('dotenv').config();
const { Client } = require('pg');

async function debug() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // 1. Les 2 départements Ophtalmologie
  const depts = await client.query(`
    SELECT d.id_department, d.name, s.name as site
    FROM departments d JOIN sites s ON d.id_site = s.id_site
    WHERE d.name LIKE 'Ophtalmo%'
  `);
  console.log('=== Départements Ophtalmologie ===');
  depts.rows.forEach(r => console.log(`  id=${r.id_department} | ${r.name} @ ${r.site}`));

  const deptIds = depts.rows.map(r => r.id_department);

  // 2. Schedules consultation par dept ophtalmo
  for (const dept of depts.rows) {
    const sched = await client.query(`
      SELECT ss.id_staff, s.lastname, ss.day_of_week, ss.period,
             rt.name as recurrence, rt.cycle_weeks, ss.week_offset
      FROM staff_schedules ss
      JOIN staff s ON ss.id_staff = s.id_staff
      JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
      WHERE ss.id_department = $1
        AND ss.is_active = true
        AND ss.id_activity IS NULL
        AND s.id_primary_position IN (1, 3)
      ORDER BY ss.day_of_week, ss.period, s.lastname
    `, [dept.id_department]);
    console.log(`\n=== Schedules CONSULTATION — ${dept.name} @ ${dept.site} (dept ${dept.id_department}) ===`);
    sched.rows.forEach(r =>
      console.log(`  dow=${r.day_of_week} ${r.period} | ${r.lastname.padEnd(15)} | ${r.recurrence} offset=${r.week_offset}`)
    );
  }

  // 3. Work blocks ophtalmo par département — distribution médecins
  for (const dept of depts.rows) {
    const distrib = await client.query(`
      SELECT doc_count, COUNT(*) as nb_blocks
      FROM (
        SELECT wb.id_block, COUNT(a.id_assignment) as doc_count
        FROM work_blocks wb
        JOIN assignments a ON a.id_block = wb.id_block
        WHERE wb.block_type = 'CONSULTATION' AND wb.id_department = $1
        GROUP BY wb.id_block
      ) sub
      GROUP BY doc_count ORDER BY doc_count
    `, [dept.id_department]);
    console.log(`\n=== Distribution médecins/block — ${dept.name} @ ${dept.site} ===`);
    distrib.rows.forEach(r => console.log(`  ${r.doc_count} médecin(s): ${r.nb_blocks} blocks`));
  }

  // 4. Blocks par jour de la semaine pour chaque dept ophtalmo
  for (const dept of depts.rows) {
    const byDow = await client.query(`
      SELECT c.day_of_week, wb.period, COUNT(DISTINCT wb.id_block) as nb_blocks,
             ROUND(AVG(sub.doc_count), 1) as avg_docs
      FROM work_blocks wb
      JOIN calendar c ON wb.id_calendar = c.id_calendar
      JOIN (
        SELECT a.id_block, COUNT(*) as doc_count
        FROM assignments a GROUP BY a.id_block
      ) sub ON sub.id_block = wb.id_block
      WHERE wb.block_type = 'CONSULTATION' AND wb.id_department = $1
      GROUP BY c.day_of_week, wb.period
      ORDER BY
        CASE c.day_of_week
          WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3
          WHEN 'THU' THEN 4 WHEN 'FRI' THEN 5
        END, wb.period
    `, [dept.id_department]);
    console.log(`\n=== Blocks par jour — ${dept.name} @ ${dept.site} ===`);
    byDow.rows.forEach(r =>
      console.log(`  ${r.day_of_week} ${r.period}: ${r.nb_blocks} blocks, avg ${r.avg_docs} docs/block`)
    );
  }

  // 5. Exemple concret: une semaine donnée (semaine 5 par ex)
  const weekSample = await client.query(`
    SELECT wb.date, wb.period, d.name as dept, d.id_department,
           STRING_AGG(s.lastname, ', ' ORDER BY s.lastname) as doctors,
           COUNT(a.id_assignment) as nb_docs
    FROM work_blocks wb
    JOIN departments d ON wb.id_department = d.id_department
    JOIN assignments a ON a.id_block = wb.id_block
    JOIN staff s ON a.id_staff = s.id_staff
    JOIN calendar c ON wb.id_calendar = c.id_calendar
    WHERE wb.block_type = 'CONSULTATION'
      AND d.name LIKE 'Ophtalmo%'
      AND c.iso_week = 5
    GROUP BY wb.date, wb.period, d.name, d.id_department
    ORDER BY wb.date, wb.period, d.id_department
  `);
  console.log('\n=== Semaine 5 — Ophtalmo (exemple concret) ===');
  weekSample.rows.forEach(r =>
    console.log(`  ${new Date(r.date).toISOString().slice(0,10)} ${r.period} | dept ${r.id_department} ${r.dept} | ${r.nb_docs} doc(s): ${r.doctors}`)
  );

  await client.end();
}
debug();
