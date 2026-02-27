import type { PlanningBlock, StaffingNeed } from "@/lib/types/database";

/** A single need slot = one (role, skill) pair from v_staffing_needs */
export interface NeedSlot {
  id_role: number | null;
  role_name: string | null;
  id_skill: number;
  skill_name: string;
  gap: number;
  needed: number;
  assigned: number;
}

/** A surgery operation option (doctor + activity) */
export interface SurgeryOperation {
  id_linked_doctor: number; // doctor's id_assignment (NOT id_staff)
  doctorName: string;
  id_activity: number | null;
  activityName: string | null;
}

export interface RoleSelectionData {
  isSurgery: boolean;
  /** Available (role, skill) slots sorted by gap descending */
  slots: NeedSlot[];
  /** For surgery blocks: available operations (doctor+activity combos) */
  operations: SurgeryOperation[];
  /** Non-null when auto-selection is possible (single option or single unfilled) */
  autoSelect: {
    roleId: number | null;
    skillId: number | null;
    linkedDoctorId: number | null;
  } | null;
}

/**
 * Resolve available (role, skill) slot options for a target cell.
 *
 * Needs are coupled pairs matching v_staffing_needs:
 * - Consultation: (id_role, id_skill) — both must match for an assignment to fill the need
 * - Surgery: (null, id_skill) — only skill matters
 *
 * @param blocks - The PlanningBlock[] for the target period (AM or PM)
 * @param needs  - The StaffingNeed[] for the target period (all needs, not just gap>0)
 */
export function resolveRoleOptions(
  blocks: PlanningBlock[],
  needs: StaffingNeed[]
): RoleSelectionData {
  const isSurgery = blocks.some((b) => b.block_type === "SURGERY");
  const isAdmin = blocks.length > 0 && blocks.every((b) => b.block_type === "ADMIN");

  // Admin blocks: no needs, always role=1 (Standard) and no skill
  if (isAdmin) {
    return {
      isSurgery: false,
      slots: [],
      operations: [],
      autoSelect: { roleId: 1, skillId: null, linkedDoctorId: null },
    };
  }

  // ---- Build slots: group needs by (id_role, id_skill) ----
  const slotMap = new Map<string, NeedSlot>();
  for (const need of needs) {
    const key = `${need.id_role ?? "null"}-${need.id_skill}`;
    const existing = slotMap.get(key);
    if (existing) {
      existing.gap += need.gap;
      existing.needed += need.needed;
      existing.assigned += need.assigned;
    } else {
      slotMap.set(key, {
        id_role: need.id_role,
        role_name: need.role_name,
        id_skill: need.id_skill,
        skill_name: need.skill_name ?? `Compétence ${need.id_skill}`,
        gap: need.gap,
        needed: need.needed,
        assigned: need.assigned,
      });
    }
  }

  const slots = Array.from(slotMap.values()).sort((a, b) => {
    if (a.gap > 0 && b.gap <= 0) return -1;
    if (a.gap <= 0 && b.gap > 0) return 1;
    return (a.id_role ?? 0) - (b.id_role ?? 0);
  });

  // ---- Build surgery operations ----
  // id_linked_doctor in DB references the doctor's assignment ID, not staff ID
  const operations: SurgeryOperation[] = [];
  if (isSurgery) {
    const seen = new Set<number>();
    for (const block of blocks) {
      for (const a of block.assignments) {
        if (a.assignment_type === "DOCTOR" && !seen.has(a.id_assignment)) {
          seen.add(a.id_assignment);
          operations.push({
            id_linked_doctor: a.id_assignment,
            doctorName: `${a.firstname} ${a.lastname}`,
            id_activity: a.id_activity,
            activityName: a.activity_name,
          });
        }
      }
    }
  }

  // ---- Determine auto-select ----
  let autoSelect: RoleSelectionData["autoSelect"] = null;
  const slotsWithGap = slots.filter((s) => s.gap > 0);

  if (!isSurgery) {
    if (slots.length === 0) {
      // No needs configured → default to Standard, no skill
      autoSelect = { roleId: 1, skillId: null, linkedDoctorId: null };
    } else if (slots.length === 1) {
      autoSelect = { roleId: slots[0].id_role, skillId: slots[0].id_skill, linkedDoctorId: null };
    } else if (slotsWithGap.length === 1) {
      autoSelect = { roleId: slotsWithGap[0].id_role, skillId: slotsWithGap[0].id_skill, linkedDoctorId: null };
    }
    // else: multiple unfilled slots → show dialog
  } else {
    // Surgery: auto-select if ≤1 operation AND ≤1 unfilled slot
    const effectiveSlot = slotsWithGap[0] ?? slots[0];
    if (operations.length <= 1 && (slots.length <= 1 || slotsWithGap.length <= 1)) {
      autoSelect = {
        // DB constraint chk_secretary requires id_role NOT NULL for secretaries.
        // Surgery needs have id_role=null in v_staffing_needs, but the assignment
        // must still have a role — default to 1 (Standard).
        roleId: effectiveSlot?.id_role ?? 1,
        skillId: effectiveSlot?.id_skill ?? null,
        linkedDoctorId: operations[0]?.id_linked_doctor ?? null,
      };
    }
  }

  return { isSurgery, slots, operations, autoSelect };
}

/** Does this move require the user to choose a role/skill? */
export function needsRoleSelection(data: RoleSelectionData): boolean {
  return data.autoSelect === null;
}

/** Build a slot key string for state management */
export function slotKey(slot: NeedSlot): string {
  return `${slot.id_role ?? "null"}-${slot.id_skill}`;
}
