/**
 * Migration: Add rooms table as sub-level of departments.
 *
 * - Creates `rooms` table
 * - Adds `id_room` nullable FK column to `work_blocks`
 * - Seeds 3 operating rooms for the existing "Bloc opératoire" department
 * - Updates existing SURGERY work_blocks to reference the first room
 *
 * Usage:
 *   node scripts/add-rooms-table.mjs
 */

import { supabase } from "./supabase-client.mjs";

async function run() {
  console.log("=== Migration: rooms table ===\n");

  // 1. Create rooms table
  console.log("1. Creating rooms table...");
  const { error: createErr } = await supabase.rpc("", {}).catch(() => ({}));

  // Use raw SQL via supabase
  const { error: tableErr } = await supabase.from("rooms").select("id_room").limit(1);

  if (tableErr && tableErr.code === "42P01") {
    // Table doesn't exist — create via SQL
    console.log("   Table 'rooms' does not exist. Please create it via Supabase SQL editor:");
    console.log(`
    CREATE TABLE IF NOT EXISTS rooms (
      id_room    SERIAL PRIMARY KEY,
      id_department INTEGER NOT NULL REFERENCES departments(id_department) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      is_active  BOOLEAN NOT NULL DEFAULT true
    );

    -- Add id_room column to work_blocks if not exists
    ALTER TABLE work_blocks ADD COLUMN IF NOT EXISTS id_room INTEGER REFERENCES rooms(id_room);

    -- Create index for efficient room-based queries
    CREATE INDEX IF NOT EXISTS idx_work_blocks_room ON work_blocks(id_room) WHERE id_room IS NOT NULL;
    `);
    console.log("\n   Run the SQL above first, then re-run this script to seed the rooms.\n");
    process.exit(0);
  }

  // Check if rooms already exist
  const { data: existingRooms } = await supabase.from("rooms").select("id_room").limit(1);
  if (existingRooms && existingRooms.length > 0) {
    console.log("   Rooms already exist, skipping seed.");
    console.log("   Done!\n");
    process.exit(0);
  }

  // 2. Find the "Bloc opératoire" department
  console.log("2. Finding 'Bloc opératoire' department...");
  const { data: blocDepts, error: deptErr } = await supabase
    .from("departments")
    .select("id_department, name")
    .ilike("name", "%bloc op%");

  if (deptErr) {
    console.error("   Error finding department:", deptErr.message);
    process.exit(1);
  }

  if (!blocDepts || blocDepts.length === 0) {
    console.log("   No 'Bloc opératoire' department found. Creating rooms skipped.");
    process.exit(0);
  }

  const blocDept = blocDepts[0];
  console.log(`   Found: ${blocDept.name} (id=${blocDept.id_department})`);

  // 3. Create 3 rooms
  console.log("3. Creating 3 operating rooms...");
  const roomNames = ["Salle 1", "Salle 2", "Salle 3"];
  const { data: rooms, error: roomErr } = await supabase
    .from("rooms")
    .insert(roomNames.map((name) => ({ id_department: blocDept.id_department, name })))
    .select();

  if (roomErr) {
    console.error("   Error creating rooms:", roomErr.message);
    process.exit(1);
  }

  console.log(`   Created ${rooms.length} rooms:`, rooms.map((r) => `${r.name} (id=${r.id_room})`).join(", "));

  // 4. Assign existing SURGERY blocks to first room (as baseline)
  console.log("4. Assigning existing surgery blocks to Salle 1...");
  const firstRoomId = rooms[0].id_room;

  const { data: updated, error: updateErr } = await supabase
    .from("work_blocks")
    .update({ id_room: firstRoomId })
    .eq("id_department", blocDept.id_department)
    .is("id_room", null)
    .select("id_block");

  if (updateErr) {
    console.error("   Error updating blocks:", updateErr.message);
    process.exit(1);
  }

  console.log(`   Updated ${updated?.length ?? 0} blocks to room '${rooms[0].name}'`);

  console.log("\n=== Migration complete ===");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
