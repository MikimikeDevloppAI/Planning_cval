require('dotenv').config();
const { Client } = require('pg');

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // 1. Work blocks summary
  const wbSummary = await client.query(`
    SELECT block_type, COUNT(*) as count
    FROM work_blocks
    GROUP BY block_type
    ORDER BY block_type
  `);
  console.log('=== Work Blocks Summary ===');
  wbSummary.rows.forEach(r => console.log(`  ${r.block_type}: ${r.count}`));

  // 2. Assignments summary
  const asgSummary = await client.query(`
    SELECT assignment_type, status, COUNT(*) as count
    FROM assignments
    GROUP BY assignment_type, status
    ORDER BY assignment_type, status
  `);
  console.log('\n=== Assignments Summary ===');
  asgSummary.rows.forEach(r => console.log(`  ${r.assignment_type} [${r.status}]: ${r.count}`));

  // 3. Check for duplicate CONSULTATION blocks (should be 0)
  const dupes = await client.query(`
    SELECT id_department, date, period, COUNT(*) as cnt
    FROM work_blocks
    WHERE block_type = 'CONSULTATION'
    GROUP BY id_department, date, period
    HAVING COUNT(*) > 1
  `);
  console.log(`\n=== Duplicate CONSULTATION blocks: ${dupes.rowCount} (should be 0) ===`);

  // 4. Check that no assignment exists for absent staff
  const absConflicts = await client.query(`
    SELECT a.id_staff, s.lastname, s.firstname, wb.date, wb.period, sl.absence_type
    FROM assignments a
    JOIN work_blocks wb ON a.id_block = wb.id_block
    JOIN staff s ON a.id_staff = s.id_staff
    JOIN staff_leaves sl ON sl.id_staff = a.id_staff
      AND wb.date BETWEEN sl.start_date AND sl.end_date
      AND (sl.period IS NULL OR sl.period = wb.period)
    WHERE a.assignment_type = 'DOCTOR'
    LIMIT 5
  `);
  console.log(`\n=== Absence conflicts: ${absConflicts.rowCount} (should be 0) ===`);
  if (absConflicts.rowCount > 0) {
    absConflicts.rows.forEach(r => console.log(`  ${r.lastname} ${r.firstname} on ${r.date} ${r.period} (${r.absence_type})`));
  }

  // 5. Sample work blocks with assignments
  const sample = await client.query(`
    SELECT wb.date, wb.period, wb.block_type, d.name as department,
           at.name as activity, s.lastname, s.firstname
    FROM work_blocks wb
    JOIN departments d ON wb.id_department = d.id_department
    LEFT JOIN activity_templates at ON wb.id_activity = at.id_activity
    JOIN assignments a ON a.id_block = wb.id_block
    JOIN staff s ON a.id_staff = s.id_staff
    ORDER BY wb.date, wb.period, wb.block_type
    LIMIT 15
  `);
  console.log('\n=== Sample data (first 15 assignments) ===');
  console.table(sample.rows);

  // 6. Doctors per consultation block (distribution)
  const distrib = await client.query(`
    SELECT doc_count, COUNT(*) as nb_blocks
    FROM (
      SELECT wb.id_block, COUNT(a.id_assignment) as doc_count
      FROM work_blocks wb
      JOIN assignments a ON a.id_block = wb.id_block
      WHERE wb.block_type = 'CONSULTATION'
      GROUP BY wb.id_block
    ) sub
    GROUP BY doc_count
    ORDER BY doc_count
  `);
  console.log('\n=== Doctors per CONSULTATION block (distribution) ===');
  distrib.rows.forEach(r => console.log(`  ${r.doc_count} doctor(s): ${r.nb_blocks} blocks`));

  await client.end();
}
verify();
