import type { SupabaseClient } from "../helpers";
import { throwIfError } from "../helpers";

/**
 * Move a secretary via atomic RPC: CANCEL old + find block + UPSERT new in one transaction.
 */
export async function moveAssignment(
  supabase: SupabaseClient,
  params: {
    oldAssignmentId: number;
    targetDeptId: number;
    targetDate: string;
    period: "AM" | "PM";
    staffId: number;
    roleId: number | null;
    skillId: number | null;
    linkedDoctorId: number | null;
  }
) {
  const { data, error } = await supabase.rpc("fn_move_secretary", {
    p_old_assignment_id: params.oldAssignmentId,
    p_target_dept_id: params.targetDeptId,
    p_target_date: params.targetDate,
    p_target_period: params.period,
    p_staff_id: params.staffId,
    p_role_id: params.roleId ?? 1,
    p_skill_id: params.skillId,
    p_linked_doctor_id: params.linkedDoctorId,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function cancelAssignment(supabase: SupabaseClient, assignmentId: number) {
  return throwIfError(
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id_assignment", assignmentId)
  );
}

export async function updateAssignmentStatus(
  supabase: SupabaseClient,
  assignmentId: number,
  status: string
) {
  return throwIfError(
    await supabase
      .from("assignments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id_assignment", assignmentId)
      .select()
      .single()
  );
}

/**
 * Move a doctor by writing directly into assignments.
 * CANCEL the old assignment + INSERT a new one with source='MANUAL'.
 */
export async function moveDoctorSchedule(
  supabase: SupabaseClient,
  params: {
    staffId: number;
    sourceAssignmentId: number;
    targetDeptId: number;
    targetDate: string;
    period: "AM" | "PM";
    activityId?: number | null;
  }
) {
  // Cancel old assignment
  throwIfError(
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id_assignment", params.sourceAssignmentId)
  );

  // Find the target block
  const { data: targetBlock, error: blockErr } = await supabase
    .from("work_blocks")
    .select("id_block")
    .eq("id_department", params.targetDeptId)
    .eq("date", params.targetDate)
    .eq("period", params.period)
    .single();

  if (blockErr || !targetBlock) {
    throw new Error(`Target block not found for dept=${params.targetDeptId} date=${params.targetDate} period=${params.period}`);
  }

  // Upsert new MANUAL assignment
  return throwIfError(
    await supabase
      .from("assignments")
      .upsert(
        {
          id_block: targetBlock.id_block,
          id_staff: params.staffId,
          assignment_type: "DOCTOR",
          id_activity: params.activityId ?? null,
          source: "MANUAL",
          id_schedule: null,
          status: "PUBLISHED",
        },
        { onConflict: "id_block,id_staff" }
      )
      .select()
      .single()
  );
}

/**
 * Swap two assignments: cancel both originals, upsert each person into the other's block.
 */
export async function swapAssignments(
  supabase: SupabaseClient,
  a: { assignmentId: number; blockId: number; staffId: number; type: string; roleId: number | null; skillId: number | null },
  b: { assignmentId: number; blockId: number; staffId: number; type: string; roleId: number | null; skillId: number | null },
) {
  // Cancel both originals
  await cancelAssignment(supabase, a.assignmentId);
  await cancelAssignment(supabase, b.assignmentId);

  // A → block of B
  throwIfError(
    await supabase.from("assignments").upsert(
      {
        id_block: b.blockId,
        id_staff: a.staffId,
        assignment_type: a.type,
        id_role: a.roleId,
        id_skill: a.skillId,
        source: "MANUAL",
        status: "PROPOSED",
      },
      { onConflict: "id_block,id_staff" }
    ).select().single()
  );

  // B → block of A
  throwIfError(
    await supabase.from("assignments").upsert(
      {
        id_block: a.blockId,
        id_staff: b.staffId,
        assignment_type: b.type,
        id_role: b.roleId,
        id_skill: b.skillId,
        source: "MANUAL",
        status: "PROPOSED",
      },
      { onConflict: "id_block,id_staff" }
    ).select().single()
  );
}

/**
 * Update skill (and optionally linked doctor) on an existing assignment.
 */
export async function updateAssignmentSkill(
  supabase: SupabaseClient,
  assignmentId: number,
  skillId: number | null,
  linkedDoctorId?: number | null,
) {
  return throwIfError(
    await supabase
      .from("assignments")
      .update({
        id_skill: skillId,
        ...(linkedDoctorId !== undefined && { id_linked_doctor: linkedDoctorId }),
        updated_at: new Date().toISOString(),
      })
      .eq("id_assignment", assignmentId)
      .select()
      .single()
  );
}
