import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; prefId: string }> }
) {
  const { prefId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("staff_preferences")
    .delete()
    .eq("id_preference", parseInt(prefId));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
