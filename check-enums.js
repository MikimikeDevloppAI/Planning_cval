require('dotenv').config();
const { Client } = require('pg');

async function checkEnums() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Get actual column types for calendar_slots
  const res = await client.query(`
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_name = 'calendar_slots' AND table_schema = 'public'
    AND column_name IN ('day_of_week', 'week_parity', 'period')
  `);
  console.log('Column types:');
  res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.udt_name}`));

  await client.end();
}
checkEnums();
