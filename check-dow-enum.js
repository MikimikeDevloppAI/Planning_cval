require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Check enum values
  const res = await client.query(`
    SELECT enumlabel, enumsortorder
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'day_of_week_enum'
    ORDER BY enumsortorder
  `);
  console.log('day_of_week_enum values:');
  res.rows.forEach(r => console.log(`  ${r.enumsortorder}: ${r.enumlabel}`));

  // Check a sample of staff_schedules to see day_of_week values used
  const sample = await client.query(`
    SELECT DISTINCT day_of_week, period, entry_type, id_activity
    FROM staff_schedules
    WHERE is_active = true
    ORDER BY day_of_week, period
  `);
  console.log('\nDistinct schedule patterns (active):');
  sample.rows.forEach(r => console.log(`  dow=${r.day_of_week} period=${r.period} type=${r.entry_type} activity=${r.id_activity}`));

  // Check how many doctors vs secretaries vs obstetricienne
  const staffCounts = await client.query(`
    SELECT p.name, COUNT(*) as count
    FROM staff s
    JOIN positions p ON s.id_primary_position = p.id_position
    WHERE s.is_active = true
    GROUP BY p.name
  `);
  console.log('\nActive staff by position:');
  staffCounts.rows.forEach(r => console.log(`  ${r.name}: ${r.count}`));

  // Check schedules for doctors and obstetricienne
  const schedCount = await client.query(`
    SELECT p.name, ss.entry_type, COUNT(*) as count
    FROM staff_schedules ss
    JOIN staff s ON ss.id_staff = s.id_staff
    JOIN positions p ON s.id_primary_position = p.id_position
    WHERE s.id_primary_position IN (1, 3) AND ss.is_active = true
    GROUP BY p.name, ss.entry_type
    ORDER BY p.name, ss.entry_type
  `);
  console.log('\nSchedules for doctors/obstetricienne:');
  schedCount.rows.forEach(r => console.log(`  ${r.name} - ${r.entry_type}: ${r.count}`));

  await client.end();
}
main();
