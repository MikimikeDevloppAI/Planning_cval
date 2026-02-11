import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  const { id, skillId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("staff_skills")
    .delete()
    .eq("id_staff", parseInt(id))
    .eq("id_skill", parseInt(skillId));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
