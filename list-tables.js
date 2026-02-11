require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function listTables() {
  const { data, error } = await supabaseAdmin.rpc('pg_tables_list', {});

  if (error) {
    // If the RPC doesn't exist, fall back to a raw SQL query via the REST API
    console.log('RPC not available, trying direct query...\n');

    const { data: tables, error: err2 } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .in('table_schema', ['public', 'auth', 'storage'])
      .order('table_schema')
      .order('table_name');

    if (err2) {
      console.log('REST query failed too:', err2.message);
      console.log('\nTrying with raw SQL via pg_catalog...\n');

      // Last resort: query pg_catalog tables which PostgREST exposes
      const { data: pgTables, error: err3 } = await supabaseAdmin
        .rpc('get_tables');

      if (err3) {
        console.log('All methods failed. Creating a helper function...');

        // Create a database function to list tables
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/get_public_tables`, {
          method: 'POST',
          headers: {
            'apikey': process.env.SUPABASE_SECRET_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });

        if (!response.ok) {
          // Final fallback: use the OpenAPI schema endpoint
          console.log('Fetching schema from Supabase REST endpoint...\n');
          const schemaResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
            headers: {
              'apikey': process.env.SUPABASE_SECRET_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
            },
          });
          const schema = await schemaResponse.json();

          if (schema.definitions) {
            const tableNames = Object.keys(schema.definitions);
            console.log(`=== Tables in public schema (${tableNames.length}) ===\n`);
            tableNames.forEach(t => console.log(`  - ${t}`));
          } else if (schema.paths) {
            const paths = Object.keys(schema.paths)
              .filter(p => p !== '/' && p !== '/rpc')
              .map(p => p.replace('/', ''));
            console.log(`=== Tables/views in public schema (${paths.length}) ===\n`);
            paths.forEach(t => console.log(`  - ${t}`));
          } else {
            console.log('Schema response:', JSON.stringify(schema, null, 2));
          }
        } else {
          const result = await response.json();
          console.log('Tables:', result);
        }
      } else {
        console.log('Tables:', pgTables);
      }
    } else {
      console.log('=== Tables ===\n');
      tables.forEach(t => console.log(`  [${t.table_schema}] ${t.table_name}`));
    }
  } else {
    console.log('Tables:', data);
  }
}

listTables();
