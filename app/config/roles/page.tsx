"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, Shield, Loader2 } from "lucide-react";
import Link from "next/link";

interface Role {
  id_role: number;
  name: string;
  hardship_weight: number;
}

export default function RolesConfigPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editWeight, setEditWeight] = useState(0);

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["config", "roles"],
    queryFn: async () => {
      const res = await fetch("/api/config/roles");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/config/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "roles"] });
      setEditingId(null);
    },
  });

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
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/config"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Configuration
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Rôles Secrétaires</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                ID
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Nom
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Poids pénibilité
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(roles ?? []).map((role) => (
              <tr key={role.id_role} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-500">
                  {role.id_role}
                </td>
                <td className="px-4 py-3">
                  {editingId === role.id_role ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-48"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-800">
                        {role.name}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === role.id_role ? (
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={editWeight}
                      onChange={(e) =>
                        setEditWeight(parseInt(e.target.value) || 0)
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-20"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: role.hardship_weight }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-red-400"
                          />
                        )
                      )}
                      {role.hardship_weight === 0 && (
                        <span className="text-xs text-gray-400">0</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === role.id_role ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateRole.mutate({
                            id: role.id_role,
                            data: {
                              name: editName,
                              hardship_weight: editWeight,
                            },
                          })
                        }
                        className="text-green-600 p-1"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(role.id_role);
                        setEditName(role.name);
                        setEditWeight(role.hardship_weight);
                      }}
                      className="text-gray-400 hover:text-blue-600 p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
