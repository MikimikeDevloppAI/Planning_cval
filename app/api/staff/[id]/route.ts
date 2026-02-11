import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [staffRes, skillsRes, prefsRes, settingsRes, leavesRes, schedulesRes] =
    await Promise.all([
      supabase
        .from("staff")
        .select("*, positions ( name )")
        .eq("id_staff", id)
        .single(),
      supabase
        .from("staff_skills")
        .select("*, skills ( name )")
        .eq("id_staff", id),
      supabase
        .from("staff_preferences")
        .select(
          "*, sites ( name ), departments ( name ), secretary_roles ( name )"
        )
        .eq("id_staff", id),
      supabase
        .from("staff_secretary_settings")
        .select("*")
        .eq("id_staff", id)
        .maybeSingle(),
      supabase
        .from("staff_leaves")
        .select("*")
        .eq("id_staff", id)
        .order("start_date", { ascending: false }),
      supabase
        .from("staff_schedules")
        .select("*, departments ( name ), recurrence_types ( name, cycle_weeks )")
        .eq("id_staff", id)
        .eq("is_active", true)
        .order("entry_type"),
    ]);

  if (staffRes.error) {
    return NextResponse.json({ error: staffRes.error.message }, { status: 404 });
  }

  // Also fetch recent assignments for calendar view
  const assignmentsRes = await supabase
    .from("assignments")
    .select(
      `
      id_assignment, id_block, assignment_type, id_role, id_skill,
      source, status,
      work_blocks ( date, period, block_type, departments ( name ) ),
      secretary_roles ( name ),
      skills ( name )
    `
    )
    .eq("id_staff", id)
    .not("status", "in", "(CANCELLED,INVALIDATED)")
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({
    staff: staffRes.data,
    skills: skillsRes.data ?? [],
    preferences: prefsRes.data ?? [],
    settings: settingsRes.data,
    leaves: leavesRes.data ?? [],
    schedules: schedulesRes.data ?? [],
    assignments: assignmentsRes.data ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("staff")
    .update(body)
    .eq("id_staff", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
