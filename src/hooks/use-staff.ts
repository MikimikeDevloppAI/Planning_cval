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
  updateStaffLeave,
  fetchAllLeaves,
  fetchAllStaffSkills,
  addStaffSchedule,
  updateStaffSchedule,
  removeStaffSchedule,
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
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<{
        firstname: string;
        lastname: string;
        is_active: boolean;
        id_primary_position: number;
        email: string | null;
        phone: string | null;
        target_pct: number;
      }>;
    }) => {
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
export function useAllStaffSkills() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["staff-skills", "all"],
    queryFn: () => fetchAllStaffSkills(supabase),
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["staff-skills"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff-skills"] });
    },
  });
}

// ---- Preferences CRUD ----
export function useAddPreference() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({
      staffId,
      data,
    }: {
      staffId: number;
      data: {
        target_type: "SITE" | "DEPARTMENT" | "ROLE" | "STAFF";
        preference: "INTERDIT" | "EVITER" | "PREFERE";
        id_site?: number | null;
        id_department?: number | null;
        id_target_staff?: number | null;
        id_role?: number | null;
        day_of_week?: string | null;
        reason?: string | null;
      };
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}

export function useRemoveLeave() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ staffId, leaveId }: { staffId: number; leaveId: number }) => {
      return deleteStaffLeave(supabase, leaveId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}

export function useUpdateLeave() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({
      staffId,
      leaveId,
      data,
    }: {
      staffId: number;
      leaveId: number;
      data: { start_date: string; end_date: string; period: string | null };
    }) => {
      return updateStaffLeave(supabase, leaveId, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}

// ---- Schedules CRUD ----
export function useAddSchedule() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({
      staffId,
      data,
    }: {
      staffId: number;
      data: {
        schedule_type: string;
        day_of_week: number;
        period: string;
        id_department: number;
        id_recurrence?: number | null;
        week_offset?: number | null;
        start_date?: string | null;
        end_date?: string | null;
        id_activity?: number | null;
      };
    }) => {
      return addStaffSchedule(supabase, staffId, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({
      staffId,
      scheduleId,
      data,
    }: {
      staffId: number;
      scheduleId: number;
      data: Partial<{
        schedule_type: string;
        day_of_week: number;
        period: string;
        id_department: number;
        id_recurrence: number | null;
        week_offset: number | null;
        start_date: string | null;
        end_date: string | null;
        id_activity: number | null;
      }>;
    }) => {
      return updateStaffSchedule(supabase, scheduleId, data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useRemoveSchedule() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ staffId, scheduleId }: { staffId: number; scheduleId: number }) => {
      return removeStaffSchedule(supabase, scheduleId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
      queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
  });
}

// ── Leaves (global) ──────────────────────────────────────

export function useAllLeaves() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["leaves", "all"],
    queryFn: () => fetchAllLeaves(supabase),
  });
}
