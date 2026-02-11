require('dotenv').config();
const { Client } = require('pg');

async function inspect(tableName) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Column details
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default,
             character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    console.log(`=== Structure of ${tableName} (${cols.rows.length} columns) ===\n`);
    cols.rows.forEach(c => {
      const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
      console.log(`  ${c.column_name.padEnd(25)} ${c.data_type}${len}  ${nullable}${def}`);
    });

    // Constraints
    const constraints = await client.query(`
      SELECT tc.constraint_name, tc.constraint_type,
             kcu.column_name,
             ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND ccu.table_name != $1
      WHERE tc.table_schema = 'public' AND tc.table_name = $1
      ORDER BY tc.constraint_type, tc.constraint_name
    `, [tableName]);

    if (constraints.rows.length > 0) {
      console.log(`\n=== Constraints ===\n`);
      constraints.rows.forEach(c => {
        const fk = c.foreign_table ? ` -> ${c.foreign_table}(${c.foreign_column})` : '';
        console.log(`  [${c.constraint_type}] ${c.constraint_name}: ${c.column_name}${fk}`);
      });
    }

    // Check constraints
    const checks = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'c'
    `, [`public.${tableName}`]);

    if (checks.rows.length > 0) {
      console.log(`\n=== Check Constraints ===\n`);
      checks.rows.forEach(c => console.log(`  ${c.conname}: ${c.definition}`));
    }

    // Sample data
    const sample = await client.query(`SELECT * FROM public."${tableName}" LIMIT 5`);
    console.log(`\n=== Sample data (${sample.rowCount} rows) ===\n`);
    if (sample.rows.length > 0) {
      console.table(sample.rows);
    } else {
      console.log('  (empty table)');
    }

    // Count
    const count = await client.query(`SELECT COUNT(*) as total FROM public."${tableName}"`);
    console.log(`\nTotal rows: ${count.rows[0].total}`);

    // Tables that reference this table
    const refs = await client.query(`
      SELECT
        tc.table_name as referencing_table,
        kcu.column_name as referencing_column,
        ccu.column_name as referenced_column
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
      WHERE ccu.table_name = $1 AND ccu.table_schema = 'public'
    `, [tableName]);

    if (refs.rows.length > 0) {
      console.log(`\n=== Tables referencing ${tableName} ===\n`);
      refs.rows.forEach(r => console.log(`  ${r.referencing_table}.${r.referencing_column} -> ${tableName}.${r.referenced_column}`));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

inspect(process.argv[2] || 'calendar_slots');
