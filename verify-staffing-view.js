require('dotenv').config();
const { Client } = require('pg');

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // 1. Global summary
  const summary = await client.query(`
    SELECT block_type, COUNT(*) as nb_rows, SUM(needed) as total_needed, SUM(gap) as total_gap
    FROM v_staffing_needs
    GROUP BY block_type
    ORDER BY block_type
  `);
  console.log('=== Global Summary ===');
  console.table(summary.rows);

  // 2. Sample CONSULTATION normal (lun-ven)
  const consult = await client.query(`
    SELECT date, period, department, site, skill_name, role_name, needed, assigned, gap
    FROM v_staffing_needs
    WHERE block_type = 'CONSULTATION'
      AND date = (SELECT MIN(date) FROM v_staffing_needs WHERE block_type = 'CONSULTATION')
    ORDER BY department, role_name, skill_name
  `);
  console.log('\n=== Sample CONSULTATION (first date) ===');
  console.table(consult.rows);

  // 3. Saturday blocks
  const saturday = await client.query(`
    SELECT date, period, department, site, skill_name, role_name, needed, assigned, gap
    FROM v_staffing_needs
    WHERE date IN (SELECT c.date FROM calendar c WHERE c.day_of_week = 'SAT')
    ORDER BY date
  `);
  console.log(`\n=== Saturday needs (${saturday.rowCount} rows) ===`);
  console.table(saturday.rows);

  // 4. Obstétricienne-only blocks
  const obs = await client.query(`
    SELECT sn.date, sn.period, sn.department, sn.site, sn.skill_name, sn.role_name, sn.needed
    FROM v_staffing_needs sn
    JOIN work_blocks wb ON sn.id_block = wb.id_block
    WHERE wb.id_block IN (
      SELECT a.id_block
      FROM assignments a
      JOIN staff s ON a.id_staff = s.id_staff
      WHERE a.assignment_type = 'DOCTOR' AND s.id_primary_position = 3
      GROUP BY a.id_block
      HAVING COUNT(*) FILTER (WHERE s.id_primary_position = 1) = 0
    )
    ORDER BY sn.date
    LIMIT 10
  `);
  console.log(`\n=== Obstétricienne-only blocks (${obs.rowCount} rows) ===`);
  console.table(obs.rows);

  // 5. SURGERY blocks
  const surgery = await client.query(`
    SELECT date, period, department, site, skill_name, role_name, needed, assigned, gap
    FROM v_staffing_needs
    WHERE block_type = 'SURGERY'
    ORDER BY date
    LIMIT 15
  `);
  console.log(`\n=== SURGERY needs (first 15) ===`);
  console.table(surgery.rows);

  // 6. Needs by department+role
  const byDeptRole = await client.query(`
    SELECT department, site, role_name, skill_name, SUM(needed) as total_needed
    FROM v_staffing_needs
    WHERE block_type = 'CONSULTATION'
    GROUP BY department, site, role_name, skill_name
    ORDER BY department, site, role_name
  `);
  console.log('\n=== Total consultation needs by dept/site/role/skill ===');
  console.table(byDeptRole.rows);

  await client.end();
}
verify();
