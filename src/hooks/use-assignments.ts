"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/use-app-store";
import { toISODate } from "@/lib/utils/dates";
import { createClient } from "@/lib/supabase/client";
import {
  moveAssignment as moveAssignmentQuery,
  cancelAssignment as cancelAssignmentQuery,
  updateAssignmentStatus as updateAssignmentStatusQuery,
} from "@/lib/supabase/queries";

interface MoveAssignmentParams {
  oldAssignmentId: number;
  targetBlockId: number;
  staffId: number;
  assignmentType: "DOCTOR" | "SECRETARY";
  roleId: number | null;
  skillId: number | null;
}

interface CancelAssignmentParams {
  assignmentId: number;
}

interface UpdateStatusParams {
  id_assignment: number;
  status: "PROPOSED" | "CONFIRMED" | "PUBLISHED" | "CANCELLED";
}

export function useMoveAssignment() {
  const queryClient = useQueryClient();
  const weekStart = useAppStore((s) => s.weekStart);
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: MoveAssignmentParams) =>
      moveAssignmentQuery(supabase, {
        oldAssignmentId: params.oldAssignmentId,
        targetBlockId: params.targetBlockId,
        staffId: params.staffId,
        assignmentType: params.assignmentType,
        roleId: params.roleId,
        skillId: params.skillId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["planning", toISODate(weekStart)],
      });
    },
  });
}

export function useCancelAssignment() {
  const queryClient = useQueryClient();
  const weekStart = useAppStore((s) => s.weekStart);
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: CancelAssignmentParams) =>
      cancelAssignmentQuery(supabase, params.assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["planning", toISODate(weekStart)],
      });
    },
  });
}

export function useUpdateAssignmentStatus() {
  const queryClient = useQueryClient();
  const weekStart = useAppStore((s) => s.weekStart);
  const supabase = createClient();

  return useMutation({
    mutationFn: (params: UpdateStatusParams) =>
      updateAssignmentStatusQuery(supabase, params.id_assignment, params.status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["planning", toISODate(weekStart)],
      });
    },
  });
}
