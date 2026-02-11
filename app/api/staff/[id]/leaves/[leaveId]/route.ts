import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; leaveId: string }> }
) {
  const { leaveId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("staff_leaves")
    .delete()
    .eq("id_leave", parseInt(leaveId));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
