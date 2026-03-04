"use client";

import { useState, useMemo } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSites as fetchSitesQuery,
  updateSite as updateSiteQuery,
  createSite as createSiteQuery,
  deleteSite as deleteSiteQuery,
  updateDepartment,
  createDepartment,
  deleteDepartment as deleteDepartmentQuery,
  createRoom as createRoomQuery,
  updateRoom as updateRoomQuery,
  deleteRoom as deleteRoomQuery,
} from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Building2,
  MapPin,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  LayoutGrid,
  DoorOpen,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

interface Room {
  id_room: number;
  name: string;
  is_active: boolean;
}

interface Department {
  id_department: number;
  name: string;
  is_active: boolean;
  rooms: Room[];
}

interface Site {
  id_site: number;
  name: string;
  address?: string | null;
  departments: Department[];
}

// ── Accent colors per site (cycled) ───────────────────

const SITE_ACCENTS = ["#4A6FA5", "#6B8A7A", "#9B7BA8", "#D97706", "#0EA5E9"];

function getSiteAccent(index: number) {
  return SITE_ACCENTS[index % SITE_ACCENTS.length];
}

// ── Stats card ────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4",
        "bg-card border border-border/40",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]",
        "transition-all duration-300 group"
      )}
    >
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl group-hover:opacity-[0.12] transition-opacity"
        style={{ backgroundColor: color, opacity: 0.08 }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────

export function SitesView() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Data
  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ["config", "sites"],
    queryFn: () => fetchSitesQuery(supabase) as Promise<Site[]>,
  });

  // Expand state — default all expanded
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Auto-expand all sites on first load + depts with rooms
  if (sites && !initialized) {
    setExpanded(new Set(sites.map((s) => s.id_site)));
    const deptsWithRooms = new Set<number>();
    for (const s of sites) {
      for (const d of s.departments) {
        if (d.rooms && d.rooms.length > 0) deptsWithRooms.add(d.id_department);
      }
    }
    setExpandedDepts(deptsWithRooms);
    setInitialized(true);
  }

  // Edit states
  const [editingSite, setEditingSite] = useState<number | null>(null);
  const [editingDept, setEditingDept] = useState<number | null>(null);
  const [editingRoom, setEditingRoom] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // Add site
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");

  // Add department
  const [newDeptSite, setNewDeptSite] = useState<number | null>(null);
  const [newDeptName, setNewDeptName] = useState("");

  // Add room
  const [newRoomDept, setNewRoomDept] = useState<number | null>(null);
  const [newRoomName, setNewRoomName] = useState("");

  // Delete confirms
  const [confirmDeleteSite, setConfirmDeleteSite] = useState<Site | null>(null);
  const [confirmDeleteDept, setConfirmDeleteDept] = useState<{
    dept: Department;
    siteName: string;
  } | null>(null);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<{
    room: Room;
    deptName: string;
  } | null>(null);

  // ── Mutations ───────────────────────────────────────

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["config", "sites"] });

  const createSite = useMutation({
    mutationFn: (name: string) => createSiteQuery(supabase, name),
    onSuccess: () => {
      invalidate();
      setShowAddSite(false);
      setNewSiteName("");
    },
  });

  const updateSite = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      updateSiteQuery(supabase, id, { name }),
    onSuccess: () => {
      invalidate();
      setEditingSite(null);
    },
  });

  const removeSite = useMutation({
    mutationFn: (id: number) => deleteSiteQuery(supabase, id),
    onSuccess: () => {
      invalidate();
      setConfirmDeleteSite(null);
    },
  });

  const updateDept = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<{ name: string; is_active: boolean }>;
    }) => updateDepartment(supabase, id, data),
    onSuccess: () => {
      invalidate();
      setEditingDept(null);
    },
  });

  const addDept = useMutation({
    mutationFn: ({ name, id_site }: { name: string; id_site: number }) =>
      createDepartment(supabase, { name, id_site }),
    onSuccess: () => {
      invalidate();
      setNewDeptSite(null);
      setNewDeptName("");
    },
  });

  const removeDept = useMutation({
    mutationFn: (id: number) => deleteDepartmentQuery(supabase, id),
    onSuccess: () => {
      invalidate();
      setConfirmDeleteDept(null);
    },
  });

  // Room mutations
  const addRoom = useMutation({
    mutationFn: ({ name, id_department }: { name: string; id_department: number }) =>
      createRoomQuery(supabase, { name, id_department }),
    onSuccess: () => {
      invalidate();
      setNewRoomDept(null);
      setNewRoomName("");
    },
  });

  const updateRoomMut = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<{ name: string; is_active: boolean }>;
    }) => updateRoomQuery(supabase, id, data),
    onSuccess: () => {
      invalidate();
      setEditingRoom(null);
    },
  });

  const removeRoom = useMutation({
    mutationFn: (id: number) => deleteRoomQuery(supabase, id),
    onSuccess: () => {
      invalidate();
      setConfirmDeleteRoom(null);
    },
  });

  // ── Stats ───────────────────────────────────────────

  const stats = useMemo(() => {
    if (!sites) return { totalSites: 0, totalDepts: 0, activeDepts: 0, totalRooms: 0 };
    const totalDepts = sites.reduce(
      (acc, s) => acc + s.departments.length,
      0
    );
    const activeDepts = sites.reduce(
      (acc, s) => acc + s.departments.filter((d) => d.is_active).length,
      0
    );
    const totalRooms = sites.reduce(
      (acc, s) => acc + s.departments.reduce((a2, d) => a2 + (d.rooms?.length ?? 0), 0),
      0
    );
    return { totalSites: sites.length, totalDepts, activeDepts, totalRooms };
  }, [sites]);

  // ── Helpers ─────────────────────────────────────────

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandDept = (id: number) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Loading ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Stats ────────────────────────────────── */}
      <div className={cn("grid gap-4", stats.totalRooms > 0 ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
        <StatCard
          icon={Building2}
          label="Sites"
          value={stats.totalSites}
          color="#4A6FA5"
        />
        <StatCard
          icon={LayoutGrid}
          label="Départements"
          value={stats.totalDepts}
          color="#6B8A7A"
        />
        <StatCard
          icon={MapPin}
          label="Actifs"
          value={stats.activeDepts}
          color="#9B7BA8"
        />
        {stats.totalRooms > 0 && (
          <StatCard
            icon={DoorOpen}
            label="Salles"
            value={stats.totalRooms}
            color="#D97706"
          />
        )}
      </div>

      {/* ── Site cards ───────────────────────────────── */}
      <div className="space-y-4">
        {(sites ?? []).map((site, siteIndex) => {
          const accent = getSiteAccent(siteIndex);
          const isExpanded = expanded.has(site.id_site);
          const activeDepts = site.departments.filter(
            (d) => d.is_active
          ).length;

          return (
            <div
              key={site.id_site}
              className={cn(
                "bg-card rounded-2xl border border-border/40 overflow-hidden",
                "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
                "hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
                "transition-all duration-300"
              )}
            >
              {/* Gradient top bar */}
              <div
                className="h-1"
                style={{
                  background: `linear-gradient(90deg, ${accent}, ${accent}60, transparent)`,
                }}
              />

              {/* Site header */}
              <div className="flex items-center gap-3 px-5 py-3.5">
                <button
                  onClick={() => toggleExpand(site.id_site)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accent}15` }}
                >
                  <Building2
                    className="w-4 h-4"
                    style={{ color: accent }}
                  />
                </div>

                {editingSite === site.id_site ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          updateSite.mutate({
                            id: site.id_site,
                            name: editName,
                          });
                        if (e.key === "Escape") setEditingSite(null);
                      }}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      autoFocus
                    />
                    <button
                      onClick={() =>
                        updateSite.mutate({
                          id: site.id_site,
                          name: editName,
                        })
                      }
                      disabled={
                        !editName.trim() || updateSite.isPending
                      }
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingSite(null)}
                      className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">
                        {site.name}
                      </h3>
                      {site.address && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {site.address}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0"
                      style={{
                        backgroundColor: `${accent}12`,
                        color: accent,
                      }}
                    >
                      {activeDepts} / {site.departments.length} dept.
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingSite(site.id_site);
                          setEditName(site.name);
                        }}
                        className="p-1.5 text-muted-foreground/50 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteSite(site)}
                        className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Departments */}
              {isExpanded && (
                <div className="border-t border-border/20">
                  <div className="divide-y divide-border/15">
                    {site.departments.map((dept) => {
                      const hasRooms = dept.rooms && dept.rooms.length > 0;
                      const isDeptExpanded = expandedDepts.has(dept.id_department);

                      return (
                        <div key={dept.id_department}>
                          <div className="flex items-center gap-3 px-5 py-2.5 pl-[4.5rem] hover:bg-muted/20 transition-colors group">
                            {editingDept === dept.id_department ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  value={editName}
                                  onChange={(e) =>
                                    setEditName(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      updateDept.mutate({
                                        id: dept.id_department,
                                        data: { name: editName },
                                      });
                                    if (e.key === "Escape")
                                      setEditingDept(null);
                                  }}
                                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                                  autoFocus
                                />
                                <button
                                  onClick={() =>
                                    updateDept.mutate({
                                      id: dept.id_department,
                                      data: { name: editName },
                                    })
                                  }
                                  disabled={
                                    !editName.trim() ||
                                    updateDept.isPending
                                  }
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingDept(null)}
                                  className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Expand chevron for depts with rooms */}
                                {hasRooms ? (
                                  <button
                                    onClick={() => toggleExpandDept(dept.id_department)}
                                    className="text-muted-foreground hover:text-foreground transition-colors -ml-5"
                                  >
                                    {isDeptExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                ) : (
                                  <div
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: dept.is_active
                                        ? accent
                                        : "#d1d5db",
                                    }}
                                  />
                                )}
                                <span
                                  className={cn(
                                    "text-sm flex-1 truncate",
                                    dept.is_active
                                      ? "text-foreground"
                                      : "text-muted-foreground line-through"
                                  )}
                                >
                                  {dept.name}
                                </span>

                                {/* Room count badge */}
                                {hasRooms && (
                                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                    {dept.rooms.length} salle{dept.rooms.length > 1 ? "s" : ""}
                                  </span>
                                )}

                                {/* Active toggle */}
                                <button
                                  onClick={() =>
                                    updateDept.mutate({
                                      id: dept.id_department,
                                      data: {
                                        is_active: !dept.is_active,
                                      },
                                    })
                                  }
                                  className={cn(
                                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                                    dept.is_active
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                  )}
                                >
                                  {dept.is_active ? "Actif" : "Inactif"}
                                </button>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setEditingDept(
                                        dept.id_department
                                      );
                                      setEditName(dept.name);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteDept({
                                        dept,
                                        siteName: site.name,
                                      })
                                    }
                                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Rooms sub-level */}
                          {hasRooms && isDeptExpanded && (
                            <div className="divide-y divide-border/10">
                              {dept.rooms.map((room) => (
                                <div
                                  key={room.id_room}
                                  className="flex items-center gap-3 px-5 py-2 pl-[6.5rem] hover:bg-muted/10 transition-colors group/room"
                                >
                                  {editingRoom === room.id_room ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            updateRoomMut.mutate({
                                              id: room.id_room,
                                              data: { name: editName },
                                            });
                                          if (e.key === "Escape")
                                            setEditingRoom(null);
                                        }}
                                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() =>
                                          updateRoomMut.mutate({
                                            id: room.id_room,
                                            data: { name: editName },
                                          })
                                        }
                                        disabled={!editName.trim() || updateRoomMut.isPending}
                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingRoom(null)}
                                        className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <DoorOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                      <span
                                        className={cn(
                                          "text-sm flex-1 truncate",
                                          room.is_active
                                            ? "text-foreground"
                                            : "text-muted-foreground line-through"
                                        )}
                                      >
                                        {room.name}
                                      </span>

                                      {/* Active toggle */}
                                      <button
                                        onClick={() =>
                                          updateRoomMut.mutate({
                                            id: room.id_room,
                                            data: { is_active: !room.is_active },
                                          })
                                        }
                                        className={cn(
                                          "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                                          room.is_active
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                        )}
                                      >
                                        {room.is_active ? "Actif" : "Inactif"}
                                      </button>

                                      {/* Actions */}
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover/room:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            setEditingRoom(room.id_room);
                                            setEditName(room.name);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            setConfirmDeleteRoom({
                                              room,
                                              deptName: dept.name,
                                            })
                                          }
                                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}

                              {/* Add room inline */}
                              {newRoomDept === dept.id_department ? (
                                <div className="flex items-center gap-2 px-5 py-2 pl-[6.5rem] bg-muted/10">
                                  <input
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && newRoomName.trim())
                                        addRoom.mutate({
                                          name: newRoomName,
                                          id_department: dept.id_department,
                                        });
                                      if (e.key === "Escape") setNewRoomDept(null);
                                    }}
                                    placeholder="Nom de la salle..."
                                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() =>
                                      addRoom.mutate({
                                        name: newRoomName,
                                        id_department: dept.id_department,
                                      })
                                    }
                                    disabled={!newRoomName.trim() || addRoom.isPending}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setNewRoomDept(null)}
                                    className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setNewRoomDept(dept.id_department);
                                    setNewRoomName("");
                                  }}
                                  className="w-full flex items-center gap-1.5 px-5 py-1.5 pl-[6.5rem] text-xs font-medium text-muted-foreground hover:text-amber-600 hover:bg-amber-50/50 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Ajouter une salle
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add department inline */}
                    {newDeptSite === site.id_site ? (
                      <div className="flex items-center gap-2 px-5 py-2.5 pl-[4.5rem] bg-muted/10">
                        <input
                          value={newDeptName}
                          onChange={(e) =>
                            setNewDeptName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              newDeptName.trim()
                            )
                              addDept.mutate({
                                name: newDeptName,
                                id_site: site.id_site,
                              });
                            if (e.key === "Escape")
                              setNewDeptSite(null);
                          }}
                          placeholder="Nom du département..."
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                          autoFocus
                        />
                        <button
                          onClick={() =>
                            addDept.mutate({
                              name: newDeptName,
                              id_site: site.id_site,
                            })
                          }
                          disabled={
                            !newDeptName.trim() || addDept.isPending
                          }
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setNewDeptSite(null)}
                          className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setNewDeptSite(site.id_site);
                          setNewDeptName("");
                        }}
                        className="w-full flex items-center gap-1.5 px-5 py-2 pl-[4.5rem] text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Ajouter un département
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Add site ─────────────────────────────── */}
        {showAddSite ? (
          <div
            className={cn(
              "bg-card rounded-2xl border-2 border-dashed border-primary/20",
              "px-5 py-4"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <input
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSiteName.trim())
                    createSite.mutate(newSiteName);
                  if (e.key === "Escape") setShowAddSite(false);
                }}
                placeholder="Nom du nouveau site..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                autoFocus
              />
              <button
                onClick={() => createSite.mutate(newSiteName)}
                disabled={
                  !newSiteName.trim() || createSite.isPending
                }
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowAddSite(false);
                  setNewSiteName("");
                }}
                className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddSite(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
              "border-2 border-dashed border-border/50 hover:border-primary/30",
              "text-sm font-medium text-muted-foreground hover:text-primary",
              "hover:bg-primary/[0.02] transition-all"
            )}
          >
            <Plus className="w-4 h-4" />
            Ajouter un site
          </button>
        )}
      </div>

      {/* ── Delete confirmations ─────────────────── */}
      <ConfirmDialog
        open={!!confirmDeleteSite}
        variant="danger"
        title="Supprimer ce site ?"
        message={
          confirmDeleteSite
            ? `Le site « ${confirmDeleteSite.name} » et ses ${confirmDeleteSite.departments.length} département(s) seront supprimés définitivement.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (confirmDeleteSite)
            removeSite.mutate(confirmDeleteSite.id_site);
        }}
        onCancel={() => setConfirmDeleteSite(null)}
        isPending={removeSite.isPending}
      />

      <ConfirmDialog
        open={!!confirmDeleteDept}
        variant="danger"
        title="Supprimer ce département ?"
        message={
          confirmDeleteDept
            ? `Le département « ${confirmDeleteDept.dept.name} » du site ${confirmDeleteDept.siteName} sera supprimé définitivement.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (confirmDeleteDept)
            removeDept.mutate(confirmDeleteDept.dept.id_department);
        }}
        onCancel={() => setConfirmDeleteDept(null)}
        isPending={removeDept.isPending}
      />

      <ConfirmDialog
        open={!!confirmDeleteRoom}
        variant="danger"
        title="Supprimer cette salle ?"
        message={
          confirmDeleteRoom
            ? `La salle « ${confirmDeleteRoom.room.name} » du département ${confirmDeleteRoom.deptName} sera supprimée définitivement.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (confirmDeleteRoom)
            removeRoom.mutate(confirmDeleteRoom.room.id_room);
        }}
        onCancel={() => setConfirmDeleteRoom(null)}
        isPending={removeRoom.isPending}
      />
    </div>
  );
}
