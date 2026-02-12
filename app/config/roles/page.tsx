"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchRoles as fetchRolesQuery, updateRole as updateRoleQuery } from "@/lib/supabase/queries";
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

  const supabase = createClient();

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["config", "roles"],
    queryFn: () => fetchRolesQuery(supabase) as Promise<Role[]>,
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return updateRoleQuery(supabase, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "roles"] });
      setEditingId(null);
    },
  });

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
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/config"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Configuration
        </Link>
        <span className="text-border">/</span>
        <h1 className="text-xl font-bold text-foreground">Rôles Secrétaires</h1>
      </div>

      <div className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                ID
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Nom
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Poids pénibilité
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {(roles ?? []).map((role) => (
              <tr key={role.id_role} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {role.id_role}
                </td>
                <td className="px-4 py-3">
                  {editingId === role.id_role ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border border-border/50 bg-card px-2 py-1 text-sm w-48 focus:ring-2 focus:ring-ring outline-none"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
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
                      className="rounded-lg border border-border/50 bg-card px-2 py-1 text-sm w-20 focus:ring-2 focus:ring-ring outline-none"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: role.hardship_weight }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-destructive/60"
                          />
                        )
                      )}
                      {role.hardship_weight === 0 && (
                        <span className="text-xs text-muted-foreground">0</span>
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
                        className="text-success p-1"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground p-1"
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
                      className="text-muted-foreground hover:text-primary p-1"
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
