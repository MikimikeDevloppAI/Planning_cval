require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

console.log('=== Supabase Connection Test ===\n');
console.log('URL:', supabaseUrl);
console.log('Publishable Key:', publishableKey ? `${publishableKey.slice(0, 20)}...` : 'MISSING');
console.log('Secret Key:', secretKey ? `${secretKey.slice(0, 15)}...` : 'MISSING');
console.log('');

// --- Test 1: Client with Publishable Key (public/frontend usage) ---
async function testPublishableKey() {
  console.log('--- Test 1: Publishable Key (public client) ---');
  try {
    const supabase = createClient(supabaseUrl, publishableKey);

    // Try to list tables by querying a simple endpoint
    const { data, error } = await supabase.from('_test_ping').select('*').limit(1);

    if (error) {
      // A "relation does not exist" error means the connection WORKS,
      // the table just doesn't exist yet — that's expected on a fresh DB.
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.log('OK - Connected successfully! (table does not exist yet, which is normal)');
      } else {
        console.log('Response error:', error.message);
        console.log('Error code:', error.code);
      }
    } else {
      console.log('OK - Connected and query succeeded. Data:', data);
    }
  } catch (err) {
    console.error('FAILED -', err.message);
  }
  console.log('');
}

// --- Test 2: Client with Secret Key (server/admin usage) ---
async function testSecretKey() {
  console.log('--- Test 2: Secret Key (admin client) ---');
  try {
    const supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabaseAdmin.from('_test_ping').select('*').limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.log('OK - Connected successfully! (table does not exist yet, which is normal)');
      } else {
        console.log('Response error:', error.message);
        console.log('Error code:', error.code);
      }
    } else {
      console.log('OK - Connected and query succeeded. Data:', data);
    }
  } catch (err) {
    console.error('FAILED -', err.message);
  }
  console.log('');
}

// --- Test 3: Auth health check ---
async function testAuthHealth() {
  console.log('--- Test 3: Auth service health ---');
  try {
    const supabase = createClient(supabaseUrl, publishableKey);
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.log('Auth error:', error.message);
    } else {
      console.log('OK - Auth service is responding.');
      console.log('Session:', data.session ? 'Active session found' : 'No active session (normal)');
    }
  } catch (err) {
    console.error('FAILED -', err.message);
  }
  console.log('');
}

async function main() {
  await testPublishableKey();
  await testSecretKey();
  await testAuthHealth();
  console.log('=== Tests Complete ===');
}

main();
