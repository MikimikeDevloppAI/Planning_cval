import type { SupabaseClient } from "../helpers";
import { throwIfError } from "../helpers";

// ── Conflict detection helper ─────────────────────────────

/**
 * Cancel any active assignments for a staff on a given date+period (across ALL departments).
 * Ensures at most one active assignment per staff / date / period.
 */
async function cancelConflictingAssignments(
  supabase: SupabaseClient,
  staffId: number,
  targetDate: string,
  period: "AM" | "PM",
  excludeAssignmentId?: number
) {
  const { data: conflicts } = await supabase
    .from("assignments")
    .select("id_assignment, work_blocks!inner(date, period)")
    .eq("id_staff", staffId)
    .not("status", "in", "(CANCELLED,INVALIDATED)")
    .eq("work_blocks.date", targetDate)
    .eq("work_blocks.period", period);

  if (!conflicts || conflicts.length === 0) return;

  for (const c of conflicts) {
    if (excludeAssignmentId && c.id_assignment === excludeAssignmentId) continue;
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id_assignment", c.id_assignment);
  }
}

// ── Block activity sync ──────────────────────────────────

/**
 * Sync work_block.id_activity with the doctor assignment.
 * Rule: block activity = doctor's activity. No doctor → null.
 */
async function syncBlockActivity(
  supabase: SupabaseClient,
  blockId: number,
  activityId: number | null
) {
  await supabase
    .from("work_blocks")
    .update({ id_activity: activityId })
    .eq("id_block", blockId);
}

/**
 * Clear a block's activity if no active doctor remains on it.
 */
async function clearBlockActivityIfNoDoctor(
  supabase: SupabaseClient,
  blockId: number
) {
  const { data: remaining } = await supabase
    .from("assignments")
    .select("id_assignment")
    .eq("id_block", blockId)
    .eq("assignment_type", "DOCTOR")
    .not("status", "in", "(CANCELLED,INVALIDATED)")
    .limit(1);

  if (!remaining || remaining.length === 0) {
    await syncBlockActivity(supabase, blockId, null);
  }
}

// ── Assignment operations ─────────────────────────────────

/**
 * Move a secretary via atomic RPC: CANCEL old + find block + UPSERT new in one transaction.
 */
export async function moveAssignment(
  supabase: SupabaseClient,
  params: {
    oldAssignmentId: number;
    targetDeptId: number;
    targetRoomId?: number | null;
    targetDate: string;
    period: "AM" | "PM";
    staffId: number;
    roleId: number | null;
    skillId: number | null;
    linkedDoctorId: number | null;
  }
) {
  // Cancel any conflicting assignments on the target date+period
  await cancelConflictingAssignments(
    supabase, params.staffId, params.targetDate, params.period, params.oldAssignmentId
  );

  const { data, error } = await supabase.rpc("fn_move_secretary", {
    p_old_assignment_id: params.oldAssignmentId,
    p_target_dept_id: params.targetDeptId,
    p_target_date: params.targetDate,
    p_target_period: params.period,
    p_staff_id: params.staffId,
    p_role_id: params.roleId ?? 1,
    p_skill_id: params.skillId,
    p_linked_doctor_id: params.linkedDoctorId,
    ...(params.targetRoomId ? { p_room_id: params.targetRoomId } : {}),
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function cancelAssignment(supabase: SupabaseClient, assignmentId: number) {
  // Fetch assignment before cancel to check if it's a doctor
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id_block, assignment_type")
    .eq("id_assignment", assignmentId)
    .single();

  throwIfError(
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id_assignment", assignmentId)
  );

  // Clear block activity if no doctor remains
  if (assignment?.assignment_type === "DOCTOR") {
    await clearBlockActivityIfNoDoctor(supabase, assignment.id_block);
  }
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
    targetRoomId?: number | null;
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
  let blockQuery = supabase
    .from("work_blocks")
    .select("id_block")
    .eq("id_department", params.targetDeptId)
    .eq("date", params.targetDate)
    .eq("period", params.period);

  if (params.targetRoomId) {
    blockQuery = blockQuery.eq("id_room", params.targetRoomId);
  }

  const { data: targetBlock, error: blockErr } = await blockQuery.single();

  if (blockErr || !targetBlock) {
    throw new Error(`Target block not found for dept=${params.targetDeptId} date=${params.targetDate} period=${params.period}`);
  }

  // Cancel any conflicting assignments on the target date+period
  await cancelConflictingAssignments(
    supabase, params.staffId, params.targetDate, params.period, params.sourceAssignmentId
  );

  // Get old block ID before cancel (to clear its activity later)
  const { data: oldAssignment } = await supabase
    .from("assignments")
    .select("id_block")
    .eq("id_assignment", params.sourceAssignmentId)
    .single();

  // Upsert new MANUAL assignment
  const result = throwIfError(
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

  // Sync block activities
  await syncBlockActivity(supabase, targetBlock.id_block, params.activityId ?? null);
  if (oldAssignment?.id_block && oldAssignment.id_block !== targetBlock.id_block) {
    await clearBlockActivityIfNoDoctor(supabase, oldAssignment.id_block);
  }

  return result;
}

/**
 * Swap two assignments: cancel both originals, upsert each person into the other's block.
 */
export async function swapAssignments(
  supabase: SupabaseClient,
  a: { assignmentId: number; blockId: number; staffId: number; type: string; roleId: number | null; skillId: number | null; activityId?: number | null },
  b: { assignmentId: number; blockId: number; staffId: number; type: string; roleId: number | null; skillId: number | null; activityId?: number | null },
) {
  // Cancel both originals (cancelAssignment handles block activity clearing)
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
        id_activity: a.activityId ?? null,
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
        id_activity: b.activityId ?? null,
        source: "MANUAL",
        status: "PROPOSED",
      },
      { onConflict: "id_block,id_staff" }
    ).select().single()
  );

  // Sync block activities after swap (A's activity goes to B's block and vice versa)
  if (a.type === "DOCTOR") {
    await syncBlockActivity(supabase, b.blockId, a.activityId ?? null);
  }
  if (b.type === "DOCTOR") {
    await syncBlockActivity(supabase, a.blockId, b.activityId ?? null);
  }
}

/**
 * Create a one-time manual assignment for a staff member.
 * Finds the work_block by (dept, date, period), then upserts the assignment.
 */
export async function addManualAssignment(
  supabase: SupabaseClient,
  params: {
    staffId: number;
    idPrimaryPosition: 1 | 2 | 3;
    targetDeptId: number;
    targetRoomId?: number | null;
    targetDate: string;
    period: "AM" | "PM";
    roleId?: number | null;
    activityId?: number | null;
  }
) {
  const assignmentType = params.idPrimaryPosition === 2 ? "SECRETARY" : "DOCTOR";
  const status = assignmentType === "DOCTOR" ? "PUBLISHED" : "PROPOSED";

  // Find the target block
  let targetBlock: { id_block: number } | null = null;

  if (params.targetRoomId) {
    // Specific room requested
    const { data, error } = await supabase
      .from("work_blocks")
      .select("id_block")
      .eq("id_department", params.targetDeptId)
      .eq("date", params.targetDate)
      .eq("period", params.period)
      .eq("id_room", params.targetRoomId)
      .single();
    if (!error) targetBlock = data;
  } else {
    // No room specified — try block without room first (normal departments)
    const { data, error } = await supabase
      .from("work_blocks")
      .select("id_block")
      .eq("id_department", params.targetDeptId)
      .eq("date", params.targetDate)
      .eq("period", params.period)
      .is("id_room", null)
      .single();

    if (!error && data) {
      targetBlock = data;
    } else {
      // Department has rooms (e.g. Bloc opératoire) — find first room without an active doctor
      const { data: blocks } = await supabase
        .from("work_blocks")
        .select("id_block, id_room")
        .eq("id_department", params.targetDeptId)
        .eq("date", params.targetDate)
        .eq("period", params.period)
        .not("id_room", "is", null)
        .order("id_room");

      if (blocks && blocks.length > 0) {
        // Find first block without an active doctor assignment
        for (const block of blocks) {
          const { data: existing } = await supabase
            .from("assignments")
            .select("id_assignment")
            .eq("id_block", block.id_block)
            .eq("assignment_type", "DOCTOR")
            .not("status", "in", "(CANCELLED,INVALIDATED)")
            .limit(1);

          if (!existing || existing.length === 0) {
            targetBlock = block;
            break;
          }
        }
        // If all rooms have a doctor, use the first room anyway
        if (!targetBlock) targetBlock = blocks[0];
      }
    }
  }

  if (!targetBlock) {
    throw new Error("Aucun bloc de travail trouvé pour ce département à cette date et période.");
  }

  // Cancel any conflicting assignments on the target date+period
  await cancelConflictingAssignments(
    supabase, params.staffId, params.targetDate, params.period
  );

  const result = throwIfError(
    await supabase
      .from("assignments")
      .upsert(
        {
          id_block: targetBlock.id_block,
          id_staff: params.staffId,
          assignment_type: assignmentType,
          id_role: assignmentType === "SECRETARY" ? (params.roleId ?? 1) : null,
          id_activity: params.activityId ?? null,
          source: "MANUAL",
          id_schedule: null,
          status,
        },
        { onConflict: "id_block,id_staff" }
      )
      .select()
      .single()
  );

  // Sync block activity when assigning a doctor
  if (assignmentType === "DOCTOR") {
    await syncBlockActivity(supabase, targetBlock.id_block, params.activityId ?? null);
  }

  return result;
}

/**
 * Move a secretary to the Administration department for the same date/period.
 * Looks up the admin block automatically, then calls fn_move_secretary.
 */
export async function reassignToAdmin(
  supabase: SupabaseClient,
  params: {
    assignmentId: number;
    staffId: number;
    date: string;
    period: "AM" | "PM";
  },
) {
  // Find the Administration department's block for this date+period
  const { data: adminBlock, error: blockErr } = await supabase
    .from("work_blocks")
    .select("id_block, id_department, departments!inner(name)")
    .eq("departments.name", "Administration")
    .eq("date", params.date)
    .eq("period", params.period)
    .limit(1)
    .single();

  if (blockErr || !adminBlock) {
    throw new Error("Aucun bloc Administration trouvé pour cette date et période.");
  }

  const { data, error } = await supabase.rpc("fn_move_secretary", {
    p_old_assignment_id: params.assignmentId,
    p_target_dept_id: adminBlock.id_department,
    p_target_date: params.date,
    p_target_period: params.period,
    p_staff_id: params.staffId,
    p_role_id: 1, // Standard
    p_skill_id: null,
    p_linked_doctor_id: null,
  });

  if (error) throw new Error(error.message);
  return data;
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
