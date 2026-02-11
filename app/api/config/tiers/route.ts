import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("activity_staffing_tiers")
    .select("*, departments ( name, sites ( name ) ), skills ( name ), secretary_roles ( name )")
    .order("id_department")
    .order("min_doctors");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("activity_staffing_tiers")
    .insert({
      id_department: body.id_department,
      id_skill: body.id_skill,
      id_role: body.id_role,
      min_doctors: body.min_doctors,
      max_doctors: body.max_doctors,
      quantity: body.quantity,
    })
    .select("*, departments ( name ), skills ( name ), secretary_roles ( name )")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
