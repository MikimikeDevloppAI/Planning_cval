require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check Saturday work blocks
  const sat = await client.query(`
    SELECT wb.date, wb.period, wb.block_type, d.name as dept,
           STRING_AGG(s.lastname || ' ' || s.firstname, ', ') as doctors
    FROM work_blocks wb
    JOIN calendar c ON wb.id_calendar = c.id_calendar
    JOIN departments d ON wb.id_department = d.id_department
    JOIN assignments a ON a.id_block = wb.id_block
    JOIN staff s ON a.id_staff = s.id_staff
    WHERE c.day_of_week = 'SAT'
    GROUP BY wb.date, wb.period, wb.block_type, d.name
    ORDER BY wb.date
  `);
  console.log('=== Saturday work blocks ===');
  sat.rows.forEach(r =>
    console.log(`  ${new Date(r.date).toISOString().slice(0,10)} ${r.period} | ${r.dept} | ${r.block_type} | ${r.doctors}`)
  );

  // Check obstétricienne
  const obs = await client.query(`
    SELECT s.lastname, s.firstname, p.name as position, COUNT(a.id_assignment) as nb_assignments
    FROM staff s
    JOIN positions p ON s.id_primary_position = p.id_position
    LEFT JOIN assignments a ON a.id_staff = s.id_staff AND a.assignment_type = 'DOCTOR'
    WHERE s.id_primary_position = 3
    GROUP BY s.id_staff, s.lastname, s.firstname, p.name
  `);
  console.log('\n=== Obstétricienne assignments ===');
  obs.rows.forEach(r =>
    console.log(`  ${r.lastname} ${r.firstname} (${r.position}): ${r.nb_assignments} assignments`)
  );

  await client.end();
})();
