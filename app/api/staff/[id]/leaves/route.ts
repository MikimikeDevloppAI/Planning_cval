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

  const { start_date, end_date, period } = body;

  // 1. Create staff leave
  const { data: leave, error: leaveError } = await supabase
    .from("staff_leaves")
    .insert({
      id_staff: staffId,
      start_date,
      end_date,
      period: period ?? null,
    })
    .select()
    .single();

  if (leaveError) {
    return NextResponse.json({ error: leaveError.message }, { status: 500 });
  }

  // 2. Find and invalidate conflicting assignments
  let conflictQuery = supabase
    .from("assignments")
    .select("id_assignment, id_block, id_role")
    .eq("id_staff", staffId)
    .not("status", "in", "(CANCELLED,INVALIDATED)");

  // Get blocks in the date range
  let blockQuery = supabase
    .from("work_blocks")
    .select("id_block")
    .gte("date", start_date)
    .lte("date", end_date);

  if (period && period !== "FULL_DAY") {
    blockQuery = blockQuery.eq("period", period);
  }

  const { data: affectedBlocks } = await blockQuery;
  const blockIds = (affectedBlocks ?? []).map((b: { id_block: number }) => b.id_block);

  if (blockIds.length > 0) {
    conflictQuery = conflictQuery.in("id_block", blockIds);

    const { data: conflicts } = await conflictQuery;

    if (conflicts && conflicts.length > 0) {
      const conflictIds = conflicts.map((c: { id_assignment: number }) => c.id_assignment);

      // Invalidate the conflicting assignments
      await supabase
        .from("assignments")
        .update({
          status: "INVALIDATED",
          updated_at: new Date().toISOString(),
        })
        .in("id_assignment", conflictIds);

      // Create scheduling issues
      const issues = conflicts.map((c: { id_assignment: number; id_block: number; id_role: number | null }) => ({
        id_block: c.id_block,
        issue_type: "ABSENCE_CONFLICT",
        id_assignment: c.id_assignment,
        id_staff: staffId,
        id_role: c.id_role,
        description: `Absence déclarée du ${start_date} au ${end_date}`,
      }));

      await supabase.from("scheduling_issues").insert(issues);

      return NextResponse.json({
        leave,
        invalidated: conflictIds.length,
        issues: issues.length,
      });
    }
  }

  return NextResponse.json({ leave, invalidated: 0, issues: 0 });
}
