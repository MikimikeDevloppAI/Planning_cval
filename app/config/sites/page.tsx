"use client";

import { useState, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
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

  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ["config", "sites"],
    queryFn: async () => {
      const res = await fetch("/api/config/sites");
      if (!res.ok) throw new Error("Erreur chargement");
      return res.json();
    },
  });

  const updateSite = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`/api/config/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "sites"] });
      setEditingSite(null);
    },
  });

  const updateDept = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/config/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "sites"] });
      setEditingDept(null);
    },
  });

  const addDept = useMutation({
    mutationFn: async ({
      name,
      id_site,
    }: {
      name: string;
      id_site: number;
    }) => {
      const res = await fetch("/api/config/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, id_site }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
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
        <h1 className="text-xl font-bold text-gray-900">
          Sites & Départements
        </h1>
      </div>

      <div className="space-y-3">
        {(sites ?? []).map((site) => (
          <div
            key={site.id_site}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Site header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => toggleExpand(site.id_site)}
                className="text-gray-400 hover:text-gray-600"
              >
                {expanded.has(site.id_site) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <Building2 className="w-4 h-4 text-blue-500" />

              {editingSite === site.id_site ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      updateSite.mutate({ id: site.id_site, name: editName })
                    }
                    className="text-green-600 p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingSite(null)}
                    className="text-gray-400 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-gray-800 flex-1">
                    {site.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {site.departments.length} département
                    {site.departments.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => {
                      setEditingSite(site.id_site);
                      setEditName(site.name);
                    }}
                    className="text-gray-400 hover:text-blue-600 p-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Departments */}
            {expanded.has(site.id_site) && (
              <div className="divide-y divide-gray-100">
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
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() =>
                            updateDept.mutate({
                              id: dept.id_department,
                              data: { name: editName },
                            })
                          }
                          className="text-green-600 p-1"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingDept(null)}
                          className="text-gray-400 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className={`text-sm flex-1 ${
                            dept.is_active
                              ? "text-gray-700"
                              : "text-gray-400 line-through"
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
                              ? "bg-green-50 text-green-600"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {dept.is_active ? "Actif" : "Inactif"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingDept(dept.id_department);
                            setEditName(dept.name);
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1"
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
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
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
                      className="text-green-600 p-1"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setNewDeptSite(null)}
                      className="text-gray-400 p-1"
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
                    className="flex items-center gap-2 px-4 py-2 pl-12 text-sm text-blue-600 hover:bg-blue-50 w-full transition-colors"
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
