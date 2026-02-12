"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchStaffList,
  fetchStaffDetail,
  updateStaff,
  upsertSecretarySettings,
  addStaffSkill,
  removeStaffSkill,
  addStaffPreference,
  removeStaffPreference,
  addStaffLeave,
  deleteStaffLeave,
} from "@/lib/supabase/queries";

// ---- Staff list ----
export function useStaffList(filters?: { position?: number; active?: string }) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["staff", filters],
    queryFn: () => fetchStaffList(supabase, filters),
  });
}

// ---- Staff detail ----
export function useStaffDetail(id: number | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["staff", id],
    queryFn: () => fetchStaffDetail(supabase, id!),
    enabled: !!id,
  });
}

// ---- Update staff info ----
export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return updateStaff(supabase, id, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

// ---- Secretary settings ----
export function useUpdateSecretarySettings() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: {
        is_flexible?: boolean;
        flexibility_pct?: number;
        full_day_only?: boolean;
        admin_target?: number;
      };
    }) => {
      return upsertSecretarySettings(supabase, id, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.id] });
    },
  });
}

// ---- Skills CRUD ----
export function useAddSkill() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({
      staffId,
      skillId,
      preference,
    }: {
      staffId: number;
      skillId: number;
      preference: number;
    }) => {
      return addStaffSkill(supabase, staffId, skillId, preference);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useRemoveSkill() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ staffId, skillId }: { staffId: number; skillId: number }) => {
      return removeStaffSkill(supabase, staffId, skillId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

// ---- Preferences CRUD ----
export function useAddPreference() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ staffId, data }: { staffId: number; data: Record<string, unknown> }) => {
      return addStaffPreference(supabase, staffId, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useRemovePreference() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ staffId, prefId }: { staffId: number; prefId: number }) => {
      return removeStaffPreference(supabase, prefId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

// ---- Leaves ----
export function useAddLeave() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({
      staffId,
      data,
    }: {
      staffId: number;
      data: { start_date: string; end_date: string; period?: string | null };
    }) => {
      return addStaffLeave(supabase, staffId, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useDeleteLeave() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ staffId, leaveId }: { staffId: number; leaveId: number }) => {
      return deleteStaffLeave(supabase, leaveId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}
