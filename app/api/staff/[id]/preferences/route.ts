import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const staffId = parseInt(id);
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("staff_preferences")
    .insert({
      id_staff: staffId,
      target_type: body.target_type,
      id_site: body.id_site || null,
      id_department: body.id_department || null,
      id_target_staff: body.id_target_staff || null,
      id_role: body.id_role || null,
      preference: body.preference,
      day_of_week: body.day_of_week || null,
      reason: body.reason || null,
    })
    .select("*, sites ( name ), departments ( name ), secretary_roles ( name )")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
