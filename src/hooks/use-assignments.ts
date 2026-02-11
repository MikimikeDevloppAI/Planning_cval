"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/use-app-store";
import { toISODate } from "@/lib/utils/dates";

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

async function moveAssignment(params: MoveAssignmentParams) {
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "move",
      oldAssignmentId: params.oldAssignmentId,
      targetBlockId: params.targetBlockId,
      staffId: params.staffId,
      assignmentType: params.assignmentType,
      roleId: params.roleId,
      skillId: params.skillId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to move assignment");
  }
  return res.json();
}

async function cancelAssignment(params: CancelAssignmentParams) {
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "cancel",
      oldAssignmentId: params.assignmentId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to cancel assignment");
  }
  return res.json();
}

async function updateAssignmentStatus(params: UpdateStatusParams) {
  const res = await fetch("/api/assignments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to update assignment");
  }
  return res.json();
}

export function useMoveAssignment() {
  const queryClient = useQueryClient();
  const weekStart = useAppStore((s) => s.weekStart);

  return useMutation({
    mutationFn: moveAssignment,
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

  return useMutation({
    mutationFn: cancelAssignment,
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

  return useMutation({
    mutationFn: updateAssignmentStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["planning", toISODate(weekStart)],
      });
    },
  });
}
