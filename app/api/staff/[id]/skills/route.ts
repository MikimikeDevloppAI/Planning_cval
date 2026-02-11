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

  const { id_skill, preference } = body;

  const { data, error } = await supabase
    .from("staff_skills")
    .upsert(
      { id_staff: staffId, id_skill, preference: preference ?? 3 },
      { onConflict: "id_staff,id_skill" }
    )
    .select("*, skills ( name )")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
