import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// POST: Create or move assignment (drag & drop)
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const {
      action, // 'move' | 'create' | 'cancel'
      oldAssignmentId,
      targetBlockId,
      staffId,
      assignmentType,
      roleId,
      skillId,
    } = body;

    if (action === "cancel" && oldAssignmentId) {
      // Cancel an existing assignment
      const { error } = await supabase
        .from("assignments")
        .update({
          status: "CANCELLED",
          updated_at: new Date().toISOString(),
        })
        .eq("id_assignment", oldAssignmentId);

      if (error) throw error;

      return NextResponse.json({ success: true, action: "cancelled" });
    }

    if (action === "move" && oldAssignmentId && targetBlockId && staffId) {
      // 1. Cancel old assignment
      const { error: cancelError } = await supabase
        .from("assignments")
        .update({
          status: "CANCELLED",
          updated_at: new Date().toISOString(),
        })
        .eq("id_assignment", oldAssignmentId);

      if (cancelError) throw cancelError;

      // 2. Create new assignment at target
      const { data: newAssignment, error: createError } = await supabase
        .from("assignments")
        .insert({
          id_block: targetBlockId,
          id_staff: staffId,
          assignment_type: assignmentType ?? "SECRETARY",
          id_role: roleId ?? null,
          id_skill: skillId ?? null,
          source: "MANUAL",
          status: "PROPOSED",
        })
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({
        success: true,
        action: "moved",
        assignment: newAssignment,
      });
    }

    if (action === "create" && targetBlockId && staffId) {
      // Create new assignment
      const { data: newAssignment, error: createError } = await supabase
        .from("assignments")
        .insert({
          id_block: targetBlockId,
          id_staff: staffId,
          assignment_type: assignmentType ?? "SECRETARY",
          id_role: roleId ?? null,
          id_skill: skillId ?? null,
          source: "MANUAL",
          status: "PROPOSED",
        })
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({
        success: true,
        action: "created",
        assignment: newAssignment,
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Assignment mutation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH: Update assignment status (confirm, publish)
export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { id_assignment, status } = body;

    if (!id_assignment || !status) {
      return NextResponse.json(
        { error: "id_assignment and status are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("assignments")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id_assignment", id_assignment)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error("Assignment update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
