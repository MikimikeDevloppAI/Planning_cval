require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

async function runSQL(sqlFile) {
  const sql = fs.readFileSync(sqlFile, 'utf-8');
  console.log(`Executing SQL from: ${sqlFile}\n`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL.\n');

    await client.query(sql);
    console.log('SQL executed successfully!');

    // Verify: list newly created tables
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`\nTables in public schema (${res.rows.length}):`);
    res.rows.forEach(r => console.log(`  - ${r.table_name}`));

    // Verify: list views
    const views = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    if (views.rows.length > 0) {
      console.log(`\nViews in public schema (${views.rows.length}):`);
      views.rows.forEach(r => console.log(`  - ${r.table_name}`));
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
  } finally {
    await client.end();
  }
}

runSQL(process.argv[2] || 'work_blocks_assignments.sql');
