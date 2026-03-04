/**
 * Execute raw SQL against Supabase via the postgrest-compatible /rest/v1/rpc endpoint
 * or via the /pg endpoint if available.
 *
 * Usage: node scripts/exec-sql.mjs
 */

import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

const SQL = `
ALTER TABLE work_blocks ADD COLUMN IF NOT EXISTS id_room INTEGER REFERENCES rooms(id_room);
CREATE INDEX IF NOT EXISTS idx_work_blocks_room ON work_blocks(id_room) WHERE id_room IS NOT NULL;
`;

console.log("Executing SQL via Supabase SQL API...");
console.log(SQL);

// Try the Supabase Management API /v1/projects/{ref}/database/query
// Extract project ref from URL
const ref = SUPABASE_URL.replace("https://", "").split(".")[0];
console.log(`Project ref: ${ref}`);

// Method 1: Try pg-meta REST endpoint (available on some Supabase plans)
try {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ sql_text: SQL }),
  });

  if (res.ok) {
    console.log("SQL executed successfully via exec_sql RPC!");
    process.exit(0);
  }

  const errText = await res.text();
  console.log(`exec_sql RPC not available (${res.status}): ${errText}`);
} catch (e) {
  console.log("exec_sql RPC failed:", e.message);
}

// Method 2: Use the Supabase pg endpoint (direct postgres query via REST)
try {
  const res = await fetch(`${SUPABASE_URL}/pg`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (res.ok) {
    console.log("SQL executed successfully via /pg endpoint!");
    process.exit(0);
  }

  const errText = await res.text();
  console.log(`/pg endpoint not available (${res.status}): ${errText}`);
} catch (e) {
  console.log("/pg endpoint failed:", e.message);
}

// Method 3: Create a temporary function, call it, then drop it
console.log("\nTrying temporary function approach...");
try {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // First, let's just check if the column already exists
  const { data, error } = await supabase
    .from("work_blocks")
    .select("id_room")
    .limit(1);

  if (!error) {
    console.log("Column id_room already exists on work_blocks!");
    console.log("No migration needed.");
    process.exit(0);
  }

  if (error && !error.message.includes("id_room")) {
    console.log("Unexpected error checking work_blocks:", error.message);
  }

  console.log("\n========================================");
  console.log("MANUAL STEP REQUIRED");
  console.log("========================================");
  console.log("\nPlease run this SQL in your Supabase Dashboard SQL Editor:");
  console.log("(Dashboard > SQL Editor > New Query)\n");
  console.log(SQL);
  console.log("========================================\n");
  process.exit(1);
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
