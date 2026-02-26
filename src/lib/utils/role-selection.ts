import type { PlanningBlock, StaffingNeed } from "@/lib/types/database";

/** A role option for the selection UI */
export interface RoleOption {
  id_role: number;
  role_name: string;
  gap: number;
  needed: number;
  assigned: number;
}

/** A surgery operation option (doctor + activity) */
export interface SurgeryOperation {
  id_linked_doctor: number;
  doctorName: string;
  id_activity: number | null;
  activityName: string | null;
}

export interface RoleSelectionData {
  isSurgery: boolean;
  /** Available roles sorted by gap descending (unfilled first) */
  roles: RoleOption[];
  /** For surgery blocks: available operations (doctor+activity combos) */
  operations: SurgeryOperation[];
  /** Non-null when auto-selection is possible (single option or single unfilled) */
  autoSelect: {
    roleId: number | null;
    linkedDoctorId: number | null;
    activityId: number | null;
  } | null;
}

/**
 * Resolve available role options for a target cell.
 *
 * @param blocks - The PlanningBlock[] for the target period (AM or PM)
 * @param needs  - The StaffingNeed[] for the target period (all needs, not just gap>0)
 */
export function resolveRoleOptions(
  blocks: PlanningBlock[],
  needs: StaffingNeed[]
): RoleSelectionData {
  const isSurgery = blocks.some((b) => b.block_type === "SURGERY");

  // ---- Build role options from needs ----
  const roleMap = new Map<number, RoleOption>();
  for (const need of needs) {
    if (need.id_role === null) continue; // doctor needs, skip
    const existing = roleMap.get(need.id_role);
    if (existing) {
      existing.gap += need.gap;
      existing.needed += need.needed;
      existing.assigned += need.assigned;
    } else {
      roleMap.set(need.id_role, {
        id_role: need.id_role,
        role_name: need.role_name ?? `Rôle ${need.id_role}`,
        gap: need.gap,
        needed: need.needed,
        assigned: need.assigned,
      });
    }
  }

  // Sort: unfilled roles first (gap > 0), then by id
  const roles = Array.from(roleMap.values()).sort((a, b) => {
    if (a.gap > 0 && b.gap <= 0) return -1;
    if (a.gap <= 0 && b.gap > 0) return 1;
    return a.id_role - b.id_role;
  });

  // ---- Build surgery operations ----
  const operations: SurgeryOperation[] = [];
  if (isSurgery) {
    const seen = new Set<number>();
    for (const block of blocks) {
      for (const a of block.assignments) {
        if (a.assignment_type === "DOCTOR" && !seen.has(a.id_staff)) {
          seen.add(a.id_staff);
          operations.push({
            id_linked_doctor: a.id_staff,
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

  if (!isSurgery) {
    if (roles.length === 0) {
      // No needs data → keep source role
      autoSelect = { roleId: null, linkedDoctorId: null, activityId: null };
    } else if (roles.length === 1) {
      autoSelect = { roleId: roles[0].id_role, linkedDoctorId: null, activityId: null };
    } else {
      const rolesWithGap = roles.filter((r) => r.gap > 0);
      if (rolesWithGap.length === 1) {
        autoSelect = { roleId: rolesWithGap[0].id_role, linkedDoctorId: null, activityId: null };
      }
      // else: multiple roles with gaps or no gaps → user must choose
    }
  } else {
    // Surgery: auto-select only if 1 operation AND ≤1 role
    if (operations.length === 1 && roles.length <= 1) {
      autoSelect = {
        roleId: roles[0]?.id_role ?? null,
        linkedDoctorId: operations[0].id_linked_doctor,
        activityId: operations[0].id_activity,
      };
    }
  }

  return { isSurgery, roles, operations, autoSelect };
}

/** Does this move require the user to choose a role? */
export function needsRoleSelection(data: RoleSelectionData): boolean {
  return data.autoSelect === null;
}
