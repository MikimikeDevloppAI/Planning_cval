/**
 * Migration: Create rooms table and add id_room to work_blocks.
 * Run: node scripts/migrate-rooms.mjs
 */

import { supabase } from "./supabase-client.mjs";

async function run() {
  console.log("=== Migration: rooms ===\n");

  // 1. Execute SQL to create table + column
  console.log("1. Creating rooms table and adding id_room column...");

  const sql = `
    CREATE TABLE IF NOT EXISTS rooms (
      id_room    SERIAL PRIMARY KEY,
      id_department INTEGER NOT NULL REFERENCES departments(id_department) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      is_active  BOOLEAN NOT NULL DEFAULT true
    );

    ALTER TABLE work_blocks ADD COLUMN IF NOT EXISTS id_room INTEGER REFERENCES rooms(id_room);

    CREATE INDEX IF NOT EXISTS idx_work_blocks_room ON work_blocks(id_room) WHERE id_room IS NOT NULL;
  `;

  const { error: sqlErr } = await supabase.rpc("exec_sql", { sql_text: sql });

  if (sqlErr) {
    // If exec_sql RPC doesn't exist, try individual operations
    console.log("   RPC exec_sql not available, trying direct table operations...");

    // Check if rooms table exists by trying to query it
    const { error: checkErr } = await supabase.from("rooms").select("id_room").limit(1);

    if (checkErr && checkErr.message.includes("relation")) {
      console.log("   Table 'rooms' does not exist yet.");
      console.log("   Please run this SQL in your Supabase SQL Editor:\n");
      console.log(sql);
      console.log("\n   Then re-run this script to seed the rooms.");
      process.exit(1);
    }

    console.log("   Table 'rooms' exists. Checking id_room column on work_blocks...");

    // Check if id_room column exists on work_blocks
    const { data: testBlock } = await supabase
      .from("work_blocks")
      .select("id_room")
      .limit(1);

    if (testBlock === null) {
      console.log("   Column 'id_room' might not exist on work_blocks.");
      console.log("   Please run this SQL in your Supabase SQL Editor:\n");
      console.log("   ALTER TABLE work_blocks ADD COLUMN IF NOT EXISTS id_room INTEGER REFERENCES rooms(id_room);");
      process.exit(1);
    }

    console.log("   Schema looks ready.");
  } else {
    console.log("   SQL executed successfully.");
  }

  // 2. Check if rooms already exist
  const { data: existingRooms } = await supabase.from("rooms").select("id_room").limit(1);
  if (existingRooms && existingRooms.length > 0) {
    console.log("2. Rooms already seeded, skipping.");
    console.log("\n=== Done ===");
    process.exit(0);
  }

  // 3. Find "Bloc opératoire" department
  console.log("2. Finding 'Bloc opératoire' department...");
  const { data: blocDepts } = await supabase
    .from("departments")
    .select("id_department, name")
    .ilike("name", "%bloc op%");

  if (!blocDepts || blocDepts.length === 0) {
    console.log("   No 'Bloc opératoire' department found. Skipping room seeding.");
    console.log("\n=== Done ===");
    process.exit(0);
  }

  const blocDept = blocDepts[0];
  console.log(`   Found: ${blocDept.name} (id=${blocDept.id_department})`);

  // 4. Create 3 rooms
  console.log("3. Creating 3 operating rooms...");
  const { data: rooms, error: roomErr } = await supabase
    .from("rooms")
    .insert([
      { id_department: blocDept.id_department, name: "Salle 1" },
      { id_department: blocDept.id_department, name: "Salle 2" },
      { id_department: blocDept.id_department, name: "Salle 3" },
    ])
    .select();

  if (roomErr) {
    console.error("   Error creating rooms:", roomErr.message);
    process.exit(1);
  }

  console.log(`   Created: ${rooms.map((r) => `${r.name} (id=${r.id_room})`).join(", ")}`);

  // 5. Assign existing surgery blocks to first room
  console.log("4. Assigning existing surgery blocks to Salle 1...");
  const { data: updated, error: updateErr } = await supabase
    .from("work_blocks")
    .update({ id_room: rooms[0].id_room })
    .eq("id_department", blocDept.id_department)
    .is("id_room", null)
    .select("id_block");

  if (updateErr) {
    console.error("   Error:", updateErr.message);
  } else {
    console.log(`   Updated ${updated?.length ?? 0} blocks.`);
  }

  console.log("\n=== Migration complete ===");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
