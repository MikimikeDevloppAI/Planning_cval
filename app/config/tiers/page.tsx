"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSites as fetchSitesQuery,
  fetchSkills as fetchSkillsQuery,
  fetchRoles as fetchRolesQuery,
  fetchTiers as fetchTiersQuery,
  createTier as createTierQuery,
  deleteTier as deleteTierQuery,
} from "@/lib/supabase/queries";
import {
  Layers,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Tier {
  id_tier: number;
  id_department: number;
  id_skill: number;
  id_role: number;
  min_doctors: number;
  max_doctors: number;
  quantity: number;
  departments: { name: string; sites?: { name: string } | null } | null;
  skills: { name: string } | null;
  secretary_roles: { name: string } | null;
}

interface DeptOption {
  id_department: number;
  name: string;
}

interface SiteOption {
  id_site: number;
  name: string;
  departments: DeptOption[];
}

interface SkillOption {
  id_skill: number;
  name: string;
}

interface RoleOption {
  id_role: number;
  name: string;
}

export default function TiersConfigPage() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [newDept, setNewDept] = useState<number | "">("");
  const [newSkill, setNewSkill] = useState<number | "">("");
  const [newRole, setNewRole] = useState<number | "">("");
  const [newMin, setNewMin] = useState(0);
  const [newMax, setNewMax] = useState(99);
  const [newQty, setNewQty] = useState(1);

  const { data: sitesData } = useQuery({
    queryKey: ["config", "sites"],
    queryFn: () => fetchSitesQuery(supabase),
  });
  const sites = (sitesData ?? []) as SiteOption[];

  const { data: skillsData } = useQuery({
    queryKey: ["config", "skills"],
    queryFn: () => fetchSkillsQuery(supabase),
  });
  const skills = (skillsData ?? []) as SkillOption[];

  const { data: rolesData } = useQuery({
    queryKey: ["config", "roles"],
    queryFn: () => fetchRolesQuery(supabase),
  });
  const roles = (rolesData ?? []) as RoleOption[];

  const { data: tiers, isLoading } = useQuery<Tier[]>({
    queryKey: ["config", "tiers"],
    queryFn: () => fetchTiersQuery(supabase) as Promise<Tier[]>,
  });

  const addTier = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return createTierQuery(supabase, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "tiers"] });
      setShowAdd(false);
    },
  });

  const deleteTier = useMutation({
    mutationFn: async (id: number) => {
      return deleteTierQuery(supabase, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "tiers"] });
    },
  });

  const allDepts = sites.flatMap((s) =>
    s.departments.map((d) => ({ ...d, siteName: s.name }))
  );

  // Group tiers by department
  const tiersByDept = new Map<string, Tier[]>();
  for (const tier of tiers ?? []) {
    const key = tier.departments?.name ?? `Dept #${tier.id_department}`;
    if (!tiersByDept.has(key)) tiersByDept.set(key, []);
    tiersByDept.get(key)!.push(tier);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/config"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Configuration
          </Link>
          <span className="text-border">/</span>
          <h1 className="text-xl font-bold text-foreground">
            Paliers Staffing
          </h1>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Définissez combien de secrétaires sont nécessaires en fonction du nombre
        de médecins présents dans chaque département.
      </p>

      {/* Add form */}
      {showAdd && (
        <div className="bg-card rounded-xl shadow-soft border border-primary/20 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Département
              </label>
              <select
                value={newDept}
                onChange={(e) =>
                  setNewDept(e.target.value ? parseInt(e.target.value) : "")
                }
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">Choisir...</option>
                {allDepts.map((d) => (
                  <option key={d.id_department} value={d.id_department}>
                    {d.siteName} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Compétence
              </label>
              <select
                value={newSkill}
                onChange={(e) =>
                  setNewSkill(e.target.value ? parseInt(e.target.value) : "")
                }
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">Choisir...</option>
                {skills.map((s) => (
                  <option key={s.id_skill} value={s.id_skill}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Rôle
              </label>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value ? parseInt(e.target.value) : "")
                }
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">Choisir...</option>
                {roles.map((r) => (
                  <option key={r.id_role} value={r.id_role}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Min médecins
              </label>
              <input
                type="number"
                min={0}
                value={newMin}
                onChange={(e) => setNewMin(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Max médecins
              </label>
              <input
                type="number"
                min={0}
                value={newMax}
                onChange={(e) => setNewMax(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Quantité secrétaires
              </label>
              <input
                type="number"
                min={0}
                value={newQty}
                onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={() =>
                addTier.mutate({
                  id_department: newDept,
                  id_skill: newSkill,
                  id_role: newRole,
                  min_doctors: newMin,
                  max_doctors: newMax,
                  quantity: newQty,
                })
              }
              disabled={!newDept || !newSkill || !newRole || addTier.isPending}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Tiers grouped by department */}
      <div className="space-y-4">
        {Array.from(tiersByDept.entries()).map(([deptName, deptTiers]) => (
          <div
            key={deptName}
            className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden"
          >
            <div className="px-4 py-3 bg-muted/50 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">{deptName}</span>
                {deptTiers[0]?.departments?.sites && (
                  <span className="text-xs text-muted-foreground">
                    — {(deptTiers[0].departments.sites as { name: string }).name}
                  </span>
                )}
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase">
                  <th className="text-left px-4 py-2">Médecins</th>
                  <th className="text-left px-4 py-2">Compétence</th>
                  <th className="text-left px-4 py-2">Rôle</th>
                  <th className="text-center px-4 py-2">Quantité</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {deptTiers.map((tier) => (
                  <tr key={tier.id_tier} className="hover:bg-muted/30">
                    <td className="px-4 py-2 text-sm text-foreground">
                      {tier.min_doctors} — {tier.max_doctors}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground">
                      {tier.skills?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground">
                      {tier.secretary_roles?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sm text-center font-semibold text-primary">
                      {tier.quantity}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => deleteTier.mutate(tier.id_tier)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tiersByDept.size === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Aucun palier configuré
          </div>
        )}
      </div>
    </div>
  );
}
