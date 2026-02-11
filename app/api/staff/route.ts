import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const position = request.nextUrl.searchParams.get("position");
  const active = request.nextUrl.searchParams.get("active");

  let query = supabase
    .from("staff")
    .select(`
      *,
      positions ( name ),
      staff_secretary_settings ( is_flexible, flexibility_pct, full_day_only, admin_target )
    `)
    .order("lastname");

  if (position) {
    query = query.eq("id_primary_position", parseInt(position));
  }
  if (active !== null && active !== "all") {
    query = query.eq("is_active", active === "true");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
