"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  moveAssignment as moveAssignmentQuery,
  moveDoctorSchedule as moveDoctorScheduleQuery,
  cancelAssignment as cancelAssignmentQuery,
  reassignToAdmin as reassignToAdminQuery,
  updateAssignmentStatus as updateAssignmentStatusQuery,
  updateAssignmentSkill as updateAssignmentSkillQuery,
  swapAssignments as swapAssignmentsQuery,
  addManualAssignment as addManualAssignmentQuery,
} from "@/lib/supabase/queries";
import type { PlanningData, PlanningAssignment } from "@/lib/types/database";

// ── Optimistic cache helpers ───────────────────────────────

type Snapshot = [QueryKey, PlanningData | undefined];

/** Remove an assignment from the planning cache (deep clone + filter) */
function removeAssignment(data: PlanningData, assignmentId: number): PlanningData {
  return {
    ...data,
    sites: data.sites.map((site) => ({
      ...site,
      departments: site.departments.map((dept) => ({
        ...dept,
        days: dept.days.map((day) => ({
          ...day,
          am: {
            ...day.am,
            blocks: day.am.blocks.map((block) => ({
              ...block,
              assignments: block.assignments.filter((a) => a.id_assignment !== assignmentId),
            })),
          },
          pm: {
            ...day.pm,
            blocks: day.pm.blocks.map((block) => ({
              ...block,
              assignments: block.assignments.filter((a) => a.id_assignment !== assignmentId),
            })),
          },
        })),
      })),
    })),
  };
}

/** Add an assignment to a specific block in the planning cache */
function addAssignment(data: PlanningData, blockId: number, assignment: PlanningAssignment): PlanningData {
  return {
    ...data,
    sites: data.sites.map((site) => ({
      ...site,
      departments: site.departments.map((dept) => ({
        ...dept,
        days: dept.days.map((day) => ({
          ...day,
          am: {
            ...day.am,
            blocks: day.am.blocks.map((block) =>
              block.id_block === blockId
                ? { ...block, assignments: [...block.assignments, assignment] }
                : block
            ),
          },
          pm: {
            ...day.pm,
            blocks: day.pm.blocks.map((block) =>
              block.id_block === blockId
                ? { ...block, assignments: [...block.assignments, assignment] }
                : block
            ),
          },
        })),
      })),
    })),
  };
}

/** Find a block in the cache by dept + date + period + optional room.
 *  First tries matching by dept.id_department, then falls back to
 *  matching by block.id_department (handles virtual depts like Administration
 *  where dept.id_department=-2000 but blocks have the real id like 8).
 *  For surgery rooms: when roomId is provided, dept.id_department is the roomId
 *  (since extractVirtualSites maps rooms as departments). */
function findBlockId(
  data: PlanningData,
  deptId: number,
  date: string,
  period: "AM" | "PM",
  roomId?: number | null,
): number | null {
  for (const site of data.sites) {
    for (const dept of site.departments) {
      if (dept.id_department !== deptId) continue;
      for (const day of dept.days) {
        if (day.date !== date) continue;
        const periodData = period === "AM" ? day.am : day.pm;
        if (roomId) {
          const roomBlock = periodData.blocks.find((b) => b.id_room === roomId);
          if (roomBlock) return roomBlock.id_block;
        }
        const medical = periodData.blocks.find((b) => b.block_type !== "ADMIN");
        return (medical ?? periodData.blocks[0])?.id_block ?? null;
      }
    }
  }
  // Fallback: search by real id_department stored in blocks (for virtual depts)
  for (const site of data.sites) {
    for (const dept of site.departments) {
      for (const day of dept.days) {
        if (day.date !== date) continue;
        const periodData = period === "AM" ? day.am : day.pm;
        if (roomId) {
          const roomBlock = periodData.blocks.find((b) => b.id_room === roomId);
          if (roomBlock) return roomBlock.id_block;
        }
        const match = periodData.blocks.find((b) => b.id_department === deptId);
        if (match) return match.id_block;
      }
    }
  }
  return null;
}

/** Find an existing assignment in cache to clone its display data */
function findAssignment(data: PlanningData, assignmentId: number): PlanningAssignment | null {
  for (const site of data.sites) {
    for (const dept of site.departments) {
      for (const day of dept.days) {
        for (const period of [day.am, day.pm]) {
          for (const block of period.blocks) {
            const found = block.assignments.find((a) => a.id_assignment === assignmentId);
            if (found) return found;
          }
        }
      }
    }
  }
  return null;
}

/** Take a snapshot of all planning queries for rollback */
function snapshotQueries(queryClient: ReturnType<typeof useQueryClient>): Snapshot[] {
  return queryClient
    .getQueriesData<PlanningData>({ queryKey: ["planning"] })
    .map(([key, data]) => [key, data ? structuredClone(data) : undefined]);
}

/** Rollback all planning queries from a snapshot */
function rollbackQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: Snapshot[]
) {
  for (const [key, data] of snapshots) {
    queryClient.setQueryData(key, data);
  }
}

// ── Interfaces ─────────────────────────────────────────────

interface MoveAssignmentParams {
  oldAssignmentId: number;
  targetDeptId: number;
  targetRoomId?: number | null;
  targetDate: string;
  period: "AM" | "PM";
  staffId: number;
  roleId: number | null;
  skillId: number | null;
  linkedDoctorId?: number | null;
  // For optimistic update
  personName: string;
  idPrimaryPosition: 1 | 2 | 3;
}

interface MoveDoctorScheduleParams {
  staffId: number;
  sourceAssignmentId: number;
  targetDeptId: number;
  targetRoomId?: number | null;
  targetDate: string;
  period: "AM" | "PM";
  activityId?: number | null;
  // For optimistic update
  personName: string;
  idPrimaryPosition: 1 | 2 | 3;
}

interface CancelAssignmentParams {
  assignmentId: number;
}

interface UpdateStatusParams {
  id_assignment: number;
  status: "PROPOSED" | "CONFIRMED" | "PUBLISHED" | "CANCELLED";
}

// ── Hooks ──────────────────────────────────────────────────

export function useMoveAssignment() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: MoveAssignmentParams) =>
      moveAssignmentQuery(supabase, {
        oldAssignmentId: params.oldAssignmentId,
        targetDeptId: params.targetDeptId,
        targetRoomId: params.targetRoomId ?? null,
        targetDate: params.targetDate,
        period: params.period,
        staffId: params.staffId,
        roleId: params.roleId,
        skillId: params.skillId,
        linkedDoctorId: params.linkedDoctorId ?? null,
      }),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ["planning"] });
      const snapshots = snapshotQueries(queryClient);

      const [firstname, ...lastParts] = params.personName.split(" ");
      const lastname = lastParts.join(" ");

      // Resolve target block from cache for optimistic update
      const targetBlockId = (() => {
        for (const [, data] of queryClient.getQueriesData<PlanningData>({ queryKey: ["planning"] })) {
          if (!data) continue;
          const id = findBlockId(data, params.targetDeptId, params.targetDate, params.period, params.targetRoomId);
          if (id) return id;
        }
        return null;
      })();

      if (targetBlockId) {
        for (const [key, data] of queryClient.getQueriesData<PlanningData>({ queryKey: ["planning"] })) {
          if (!data) continue;
          let updated = removeAssignment(data, params.oldAssignmentId);
          updated = addAssignment(updated, targetBlockId, {
            id_assignment: -Date.now(),
            id_staff: params.staffId,
            firstname: firstname ?? "",
            lastname,
            assignment_type: "SECRETARY",
            id_role: params.roleId,
            role_name: null,
            id_skill: params.skillId,
            skill_name: null,
            id_activity: null,
            activity_name: null,
            id_linked_doctor: params.linkedDoctorId ?? null,
            source: "MANUAL",
            status: "PROPOSED",
            id_primary_position: params.idPrimaryPosition,
            id_schedule: null,
          });
          queryClient.setQueryData(key, updated);
        }
      }

      return { snapshots };
    },
    onError: (_err, _params, context) => {
      if (context?.snapshots) rollbackQueries(queryClient, context.snapshots);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

export function useMoveDoctorSchedule() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: MoveDoctorScheduleParams) =>
      moveDoctorScheduleQuery(supabase, params),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ["planning"] });
      const snapshots = snapshotQueries(queryClient);

      for (const [key, data] of queryClient.getQueriesData<PlanningData>({ queryKey: ["planning"] })) {
        if (!data) continue;

        // Clone the existing assignment data before removing
        const existing = findAssignment(data, params.sourceAssignmentId);
        let updated = removeAssignment(data, params.sourceAssignmentId);

        // Find target block in the cache
        const targetBlockId = findBlockId(data, params.targetDeptId, params.targetDate, params.period, params.targetRoomId);
        if (targetBlockId) {
          const [firstname, ...lastParts] = params.personName.split(" ");
          const lastname = lastParts.join(" ");

          updated = addAssignment(updated, targetBlockId, {
            id_assignment: -Date.now(),
            id_staff: params.staffId,
            firstname: existing?.firstname ?? firstname ?? "",
            lastname: existing?.lastname ?? lastname,
            assignment_type: "DOCTOR",
            id_role: existing?.id_role ?? null,
            role_name: existing?.role_name ?? null,
            id_skill: existing?.id_skill ?? null,
            skill_name: existing?.skill_name ?? null,
            id_activity: params.activityId ?? null,
            activity_name: existing?.activity_name ?? null,
            id_linked_doctor: existing?.id_linked_doctor ?? null,
            source: "MANUAL",
            status: "PUBLISHED",
            id_primary_position: params.idPrimaryPosition,
            id_schedule: null,
          });
        }

        queryClient.setQueryData(key, updated);
      }

      return { snapshots };
    },
    onError: (_err, _params, context) => {
      if (context?.snapshots) rollbackQueries(queryClient, context.snapshots);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

export function useCancelAssignment() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: CancelAssignmentParams) =>
      cancelAssignmentQuery(supabase, params.assignmentId),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ["planning"] });
      const snapshots = snapshotQueries(queryClient);

      for (const [key, data] of queryClient.getQueriesData<PlanningData>({ queryKey: ["planning"] })) {
        if (!data) continue;
        queryClient.setQueryData(key, removeAssignment(data, params.assignmentId));
      }

      return { snapshots };
    },
    onError: (_err, _params, context) => {
      if (context?.snapshots) rollbackQueries(queryClient, context.snapshots);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

interface ReassignToAdminParams {
  assignmentId: number;
  staffId: number;
  date: string;
  period: "AM" | "PM";
}

export function useReassignToAdmin() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: ReassignToAdminParams) =>
      reassignToAdminQuery(supabase, params),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ["planning"] });
      const snapshots = snapshotQueries(queryClient);

      // Optimistic: remove from current position (will appear in admin after refetch)
      for (const [key, data] of queryClient.getQueriesData<PlanningData>({ queryKey: ["planning"] })) {
        if (!data) continue;
        queryClient.setQueryData(key, removeAssignment(data, params.assignmentId));
      }

      return { snapshots };
    },
    onError: (_err, _params, context) => {
      if (context?.snapshots) rollbackQueries(queryClient, context.snapshots);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

export function useUpdateAssignmentStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: UpdateStatusParams) =>
      updateAssignmentStatusQuery(supabase, params.id_assignment, params.status),
    onError: (error) => {
      console.error("Failed to update assignment status:", error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

interface SwapAssignmentSide {
  assignmentId: number;
  blockId: number;
  staffId: number;
  type: string;
  roleId: number | null;
  skillId: number | null;
  activityId?: number | null;
}

interface SwapAssignmentsParams {
  a: SwapAssignmentSide;
  b: SwapAssignmentSide;
}

export function useSwapAssignments() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: SwapAssignmentsParams) =>
      swapAssignmentsQuery(supabase, params.a, params.b),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["planning"] });
      const snapshots = snapshotQueries(queryClient);
      return { snapshots };
    },
    onError: (_err, _params, context) => {
      if (context?.snapshots) rollbackQueries(queryClient, context.snapshots);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

export function useUpdateAssignmentSkill() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: { assignmentId: number; skillId: number | null; linkedDoctorId?: number | null }) =>
      updateAssignmentSkillQuery(supabase, params.assignmentId, params.skillId, params.linkedDoctorId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

// ── Add manual assignment ─────────────────────────────────

interface AddManualAssignmentParams {
  staffId: number;
  idPrimaryPosition: 1 | 2 | 3;
  targetDeptId: number;
  targetRoomId?: number | null;
  targetDate: string;
  period: "AM" | "PM";
  roleId?: number | null;
  activityId?: number | null;
}

export function useAddManualAssignment() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: AddManualAssignmentParams) =>
      addManualAssignmentQuery(supabase, params),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}
