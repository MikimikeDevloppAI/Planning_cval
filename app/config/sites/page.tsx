"use client";

import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSites as fetchSitesQuery,
  updateSite as updateSiteQuery,
  updateDepartment,
  createDepartment,
} from "@/lib/supabase/queries";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Department {
  id_department: number;
  name: string;
  is_active: boolean;
}

interface Site {
  id_site: number;
  name: string;
  departments: Department[];
}

export default function SitesConfigPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editingSite, setEditingSite] = useState<number | null>(null);
  const [editingDept, setEditingDept] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newDeptSite, setNewDeptSite] = useState<number | null>(null);
  const [newDeptName, setNewDeptName] = useState("");

  const supabase = createClient();

  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ["config", "sites"],
    queryFn: () => fetchSitesQuery(supabase) as Promise<Site[]>,
  });

  const updateSite = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return updateSiteQuery(supabase, id, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "sites"] });
      setEditingSite(null);
    },
  });

  const updateDept = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return updateDepartment(supabase, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "sites"] });
      setEditingDept(null);
    },
  });

  const addDept = useMutation({
    mutationFn: async ({ name, id_site }: { name: string; id_site: number }) => {
      return createDepartment(supabase, { name, id_site });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "sites"] });
      setNewDeptSite(null);
      setNewDeptName("");
    },
  });

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        <h1 className="text-xl font-bold text-foreground">
          Sites & Départements
        </h1>
      </div>

      <div className="space-y-3">
        {(sites ?? []).map((site) => (
          <div
            key={site.id_site}
            className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden"
          >
            {/* Site header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b border-border/30">
              <button
                onClick={() => toggleExpand(site.id_site)}
                className="text-muted-foreground hover:text-foreground"
              >
                {expanded.has(site.id_site) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <Building2 className="w-4 h-4 text-primary" />

              {editingSite === site.id_site ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg border border-border/50 bg-card px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      updateSite.mutate({ id: site.id_site, name: editName })
                    }
                    className="text-success p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingSite(null)}
                    className="text-muted-foreground p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-foreground flex-1">
                    {site.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {site.departments.length} département
                    {site.departments.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => {
                      setEditingSite(site.id_site);
                      setEditName(site.name);
                    }}
                    className="text-muted-foreground hover:text-primary p-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Departments */}
            {expanded.has(site.id_site) && (
              <div className="divide-y divide-border/20">
                {site.departments.map((dept) => (
                  <div
                    key={dept.id_department}
                    className="flex items-center gap-3 px-4 py-2.5 pl-12"
                  >
                    {editingDept === dept.id_department ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 rounded-lg border border-border/50 bg-card px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() =>
                            updateDept.mutate({
                              id: dept.id_department,
                              data: { name: editName },
                            })
                          }
                          className="text-success p-1"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingDept(null)}
                          className="text-muted-foreground p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className={`text-sm flex-1 ${
                            dept.is_active
                              ? "text-foreground"
                              : "text-muted-foreground line-through"
                          }`}
                        >
                          {dept.name}
                        </span>
                        <button
                          onClick={() =>
                            updateDept.mutate({
                              id: dept.id_department,
                              data: { is_active: !dept.is_active },
                            })
                          }
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            dept.is_active
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {dept.is_active ? "Actif" : "Inactif"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingDept(dept.id_department);
                            setEditName(dept.name);
                          }}
                          className="text-muted-foreground hover:text-primary p-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {/* Add department */}
                {newDeptSite === site.id_site ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 pl-12">
                    <input
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="Nom du département..."
                      className="flex-1 rounded-lg border border-border/50 bg-card px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() =>
                        addDept.mutate({
                          name: newDeptName,
                          id_site: site.id_site,
                        })
                      }
                      disabled={!newDeptName || addDept.isPending}
                      className="text-success p-1"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setNewDeptSite(null)}
                      className="text-muted-foreground p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setNewDeptSite(site.id_site);
                      setNewDeptName("");
                    }}
                    className="flex items-center gap-2 px-4 py-2 pl-12 text-sm text-primary hover:bg-primary/5 w-full transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un département
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
