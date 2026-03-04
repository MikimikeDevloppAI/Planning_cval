import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Try to insert a dummy row to see which columns are required
const { data, error } = await supabase.from("rooms").insert({ name: "__test__" }).select();
console.log("Insert test result:", JSON.stringify(data, null, 2));
console.log("Insert test error:", error?.message);

// If it succeeded, delete it
if (data && data.length > 0) {
  const id = Object.values(data[0])[0]; // get first column value (likely PK)
  console.log("Inserted row:", JSON.stringify(data[0]));
  // Try to delete by known column patterns
  const { error: delErr } = await supabase.from("rooms").delete().eq("name", "__test__");
  console.log("Delete error:", delErr?.message);
}

// Try select with common column names to see what exists
for (const col of ["id_room", "id", "id_department", "department_id", "site_id", "is_active", "name", "capacity"]) {
  const { error: e } = await supabase.from("rooms").select(col).limit(1);
  console.log(`Column "${col}":`, e ? `NO (${e.message.substring(0, 60)})` : "YES");
}
