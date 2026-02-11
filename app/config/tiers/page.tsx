"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const [showAdd, setShowAdd] = useState(false);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  // Form state
  const [newDept, setNewDept] = useState<number | "">("");
  const [newSkill, setNewSkill] = useState<number | "">("");
  const [newRole, setNewRole] = useState<number | "">("");
  const [newMin, setNewMin] = useState(0);
  const [newMax, setNewMax] = useState(99);
  const [newQty, setNewQty] = useState(1);

  useEffect(() => {
    Promise.all([
      fetch("/api/config/sites").then((r) => r.json()),
      fetch("/api/config/skills").then((r) => r.json()),
      fetch("/api/config/roles").then((r) => r.json()),
    ]).then(([s, sk, ro]) => {
      setSites(Array.isArray(s) ? s : []);
      setSkills(Array.isArray(sk) ? sk : []);
      setRoles(Array.isArray(ro) ? ro : []);
    });
  }, []);

  const { data: tiers, isLoading } = useQuery<Tier[]>({
    queryKey: ["config", "tiers"],
    queryFn: async () => {
      const res = await fetch("/api/config/tiers");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const addTier = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/config/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "tiers"] });
      setShowAdd(false);
    },
  });

  const deleteTier = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/config/tiers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur");
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
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/config"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Configuration
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">
            Paliers Staffing
          </h1>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Définissez combien de secrétaires sont nécessaires en fonction du nombre
        de médecins présents dans chaque département.
      </p>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Département
              </label>
              <select
                value={newDept}
                onChange={(e) =>
                  setNewDept(e.target.value ? parseInt(e.target.value) : "")
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Compétence
              </label>
              <select
                value={newSkill}
                onChange={(e) =>
                  setNewSkill(e.target.value ? parseInt(e.target.value) : "")
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Rôle
              </label>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value ? parseInt(e.target.value) : "")
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Min médecins
              </label>
              <input
                type="number"
                min={0}
                value={newMin}
                onChange={(e) => setNewMin(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Max médecins
              </label>
              <input
                type="number"
                min={0}
                value={newMax}
                onChange={(e) => setNewMax(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Quantité secrétaires
              </label>
              <input
                type="number"
                min={0}
                value={newQty}
                onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
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
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-gray-800">{deptName}</span>
                {deptTiers[0]?.departments?.sites && (
                  <span className="text-xs text-gray-400">
                    — {(deptTiers[0].departments.sites as { name: string }).name}
                  </span>
                )}
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-2">Médecins</th>
                  <th className="text-left px-4 py-2">Compétence</th>
                  <th className="text-left px-4 py-2">Rôle</th>
                  <th className="text-center px-4 py-2">Quantité</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deptTiers.map((tier) => (
                  <tr key={tier.id_tier} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {tier.min_doctors} — {tier.max_doctors}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {tier.skills?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {tier.secretary_roles?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sm text-center font-semibold text-blue-600">
                      {tier.quantity}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => deleteTier.mutate(tier.id_tier)}
                        className="text-gray-400 hover:text-red-600 p-1"
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
          <div className="text-center py-12 text-gray-400 text-sm">
            Aucun palier configuré
          </div>
        )}
      </div>
    </div>
  );
}
