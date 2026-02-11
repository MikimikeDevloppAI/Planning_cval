import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const staffId = parseInt(id);
  const supabase = createAdminClient();
  const body = await request.json();

  const { is_flexible, flexibility_pct, full_day_only, admin_target } = body;

  const { data, error } = await supabase
    .from("staff_secretary_settings")
    .upsert(
      {
        id_staff: staffId,
        is_flexible: is_flexible ?? true,
        flexibility_pct: flexibility_pct ?? 50,
        full_day_only: full_day_only ?? false,
        admin_target: admin_target ?? 0,
      },
      { onConflict: "id_staff" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
