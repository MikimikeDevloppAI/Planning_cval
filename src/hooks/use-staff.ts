"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---- Staff list ----
export function useStaffList(filters?: { position?: number; active?: string }) {
  return useQuery({
    queryKey: ["staff", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.position) params.set("position", String(filters.position));
      if (filters?.active) params.set("active", filters.active);
      const res = await fetch(`/api/staff?${params}`);
      if (!res.ok) throw new Error("Erreur chargement du personnel");
      return res.json();
    },
  });
}

// ---- Staff detail ----
export function useStaffDetail(id: number | null) {
  return useQuery({
    queryKey: ["staff", id],
    queryFn: async () => {
      const res = await fetch(`/api/staff/${id}`);
      if (!res.ok) throw new Error("Erreur chargement profil");
      return res.json();
    },
    enabled: !!id,
  });
}

// ---- Update staff info ----
export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur mise à jour");
      }
      return res.json();
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
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/staff/${id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur mise à jour paramètres");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.id] });
    },
  });
}

// ---- Skills CRUD ----
export function useAddSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, skillId, preference }: { staffId: number; skillId: number; preference: number }) => {
      const res = await fetch(`/api/staff/${staffId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_skill: skillId, preference }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur ajout compétence");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useRemoveSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, skillId }: { staffId: number; skillId: number }) => {
      const res = await fetch(`/api/staff/${staffId}/skills/${skillId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur suppression compétence");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

// ---- Preferences CRUD ----
export function useAddPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, data }: { staffId: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/staff/${staffId}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur ajout préférence");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useRemovePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, prefId }: { staffId: number; prefId: number }) => {
      const res = await fetch(`/api/staff/${staffId}/preferences/${prefId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur suppression préférence");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

// ---- Leaves ----
export function useAddLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, data }: { staffId: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/staff/${staffId}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur ajout absence");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}

export function useDeleteLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, leaveId }: { staffId: number; leaveId: number }) => {
      const res = await fetch(`/api/staff/${staffId}/leaves/${leaveId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur suppression absence");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff", vars.staffId] });
    },
  });
}
