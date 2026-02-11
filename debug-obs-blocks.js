require('dotenv').config();
const { Client } = require('pg');

async function debug() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Find blocks where Ablitzer (obst, id=14) is the ONLY doctor assigned
  const obsOnly = await client.query(`
    SELECT wb.id_block, wb.date, wb.period, d.name as dept, si.name as site,
           STRING_AGG(s.lastname || ' (' || p.name || ')', ', ') as staff_list,
           COUNT(*) FILTER (WHERE s.id_primary_position = 1) as nb_medecins,
           COUNT(*) FILTER (WHERE s.id_primary_position = 3) as nb_obstetricienne
    FROM work_blocks wb
    JOIN departments d ON wb.id_department = d.id_department
    JOIN sites si ON d.id_site = si.id_site
    JOIN assignments a ON a.id_block = wb.id_block AND a.assignment_type = 'DOCTOR'
      AND a.status NOT IN ('CANCELLED','INVALIDATED')
    JOIN staff s ON a.id_staff = s.id_staff
    JOIN positions p ON s.id_primary_position = p.id_position
    WHERE wb.block_type = 'CONSULTATION'
    GROUP BY wb.id_block, wb.date, wb.period, d.name, si.name
    HAVING COUNT(*) FILTER (WHERE s.id_primary_position = 1) = 0
       AND COUNT(*) FILTER (WHERE s.id_primary_position = 3) > 0
    ORDER BY wb.date
    LIMIT 10
  `);
  console.log(`=== Blocks with ONLY obstétricienne (${obsOnly.rowCount} total shown) ===`);
  console.table(obsOnly.rows);

  // Check what the view returns for those specific blocks
  if (obsOnly.rows.length > 0) {
    const blockIds = obsOnly.rows.map(r => r.id_block);
    const viewRows = await client.query(`
      SELECT id_block, date, period, department, site, skill_name, role_name, needed, gap
      FROM v_staffing_needs
      WHERE id_block = ANY($1)
      ORDER BY date, period, role_name
    `, [blockIds]);
    console.log(`\n=== View output for those blocks ===`);
    console.table(viewRows.rows);
  }

  // Also check: blocks where obstétricienne + médecin are together
  const obsMixed = await client.query(`
    SELECT wb.id_block, wb.date, wb.period, d.name as dept,
           STRING_AGG(s.lastname || ' (' || p.name || ')', ', ') as staff_list,
           COUNT(*) FILTER (WHERE s.id_primary_position = 1) as nb_medecins,
           COUNT(*) FILTER (WHERE s.id_primary_position = 3) as nb_obs
    FROM work_blocks wb
    JOIN departments d ON wb.id_department = d.id_department
    JOIN assignments a ON a.id_block = wb.id_block AND a.assignment_type = 'DOCTOR'
      AND a.status NOT IN ('CANCELLED','INVALIDATED')
    JOIN staff s ON a.id_staff = s.id_staff
    JOIN positions p ON s.id_primary_position = p.id_position
    WHERE wb.block_type = 'CONSULTATION'
    GROUP BY wb.id_block, wb.date, wb.period, d.name
    HAVING COUNT(*) FILTER (WHERE s.id_primary_position = 3) > 0
       AND COUNT(*) FILTER (WHERE s.id_primary_position = 1) > 0
    ORDER BY wb.date
    LIMIT 5
  `);
  console.log(`\n=== Blocks with obstétricienne + médecin(s) (first 5) ===`);
  console.table(obsMixed.rows);

  await client.end();
}
debug();
