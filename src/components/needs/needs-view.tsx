"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSites as fetchSitesQuery,
  fetchSkills as fetchSkillsQuery,
  fetchRoles as fetchRolesQuery,
  fetchTiers as fetchTiersQuery,
  createTier as createTierQuery,
  updateTier as updateTierQuery,
  deleteTier as deleteTierQuery,
  fetchActivityTemplates as fetchActivitiesQuery,
  fetchActivityRequirements as fetchReqsQuery,
  createActivityTemplate as createActivityQuery,
  deleteActivityTemplate as deleteActivityQuery,
  createActivityRequirement as createReqQuery,
  updateActivityRequirement as updateReqQuery,
  deleteActivityRequirement as deleteReqQuery,
} from "@/lib/supabase/queries";
import {
  Building2,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Scissors,
} from "lucide-react";

type Tab = "consultation" | "operations";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ── Types ────────────────────────────────────────────────

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

interface SiteOption {
  id_site: number;
  name: string;
  departments: { id_department: number; name: string }[];
}

interface SkillOption {
  id_skill: number;
  name: string;
}

interface RoleOption {
  id_role: number;
  name: string;
}

interface ActivityReq {
  id_requirement: number;
  id_activity: number;
  id_skill: number;
  quantity: number;
  activity_templates: { name: string } | null;
  skills: { name: string } | null;
}

/** Flat line for a department table, with rowSpan info */
interface TierLine {
  tier: Tier;
  isFirst: boolean;
  groupSize: number;
}

interface DeptData {
  id_department: number;
  deptName: string;
  siteName: string;
  lines: TierLine[];
  doctorCounts: number[];
}

// ── Component ────────────────────────────────────────────

export function NeedsView() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("consultation");

  // Site filter — "" means "Tous"
  const [siteFilter, setSiteFilter] = useState<string>("");

  // Tier edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(0);

  // Tier delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    label: string;
    type: "tier" | "req" | "activity";
  } | null>(null);

  // Tier add state
  const [addingDept, setAddingDept] = useState<number | null>(null);
  const [addDoc, setAddDoc] = useState(1);
  const [addSkill, setAddSkill] = useState<string>("");
  const [addRole, setAddRole] = useState<string>("");
  const [addQty, setAddQty] = useState(1);

  // Operation add state
  const [addingActivity, setAddingActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityReqs, setNewActivityReqs] = useState<
    { id_skill: string; quantity: number }[]
  >([]);

  // Requirement add state
  const [addingReqFor, setAddingReqFor] = useState<number | null>(null);
  const [addReqSkill, setAddReqSkill] = useState<string>("");
  const [addReqQty, setAddReqQty] = useState(1);

  // Requirement edit state
  const [editingReqId, setEditingReqId] = useState<number | null>(null);
  const [editReqQty, setEditReqQty] = useState(0);

  // ── Queries ──────────────────────────────────────────

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

  const { data: tiersRaw, isLoading: tiersLoading } = useQuery<Tier[]>({
    queryKey: ["config", "tiers"],
    queryFn: () => fetchTiersQuery(supabase) as Promise<Tier[]>,
  });

  const { data: activitiesRaw } = useQuery({
    queryKey: ["config", "activities"],
    queryFn: () => fetchActivitiesQuery(supabase),
  });
  const activities = (activitiesRaw ?? []) as {
    id_activity: number;
    name: string;
  }[];

  const { data: reqsRaw, isLoading: reqsLoading } = useQuery<ActivityReq[]>({
    queryKey: ["config", "activity-requirements"],
    queryFn: () => fetchReqsQuery(supabase) as Promise<ActivityReq[]>,
  });

  // ── Filter tiers by site ────────────────────────────

  const tiers = useMemo(() => {
    if (!tiersRaw) return [];
    if (!siteFilter) return tiersRaw; // "Tous"
    const siteId = parseInt(siteFilter);
    const site = sites.find((s) => s.id_site === siteId);
    if (!site) return [];
    const deptIds = new Set(site.departments.map((d) => d.id_department));
    return tiersRaw.filter((t) => deptIds.has(t.id_department));
  }, [tiersRaw, siteFilter, sites]);

  // ── Build department data ───────────────────────────

  const deptData = useMemo<DeptData[]>(() => {
    const deptMap = new Map<
      number,
      { name: string; siteName: string; tiers: Tier[] }
    >();

    for (const tier of tiers) {
      if (!deptMap.has(tier.id_department)) {
        const siteName =
          tier.departments?.sites &&
          typeof tier.departments.sites === "object" &&
          "name" in tier.departments.sites
            ? (tier.departments.sites as { name: string }).name
            : "";
        deptMap.set(tier.id_department, {
          name: tier.departments?.name ?? `Dept #${tier.id_department}`,
          siteName,
          tiers: [],
        });
      }
      deptMap.get(tier.id_department)!.tiers.push(tier);
    }

    const result: DeptData[] = [];

    for (const [id_department, { name, siteName, tiers: deptTiers }] of deptMap) {
      const byDocCount = new Map<number, Tier[]>();
      for (const t of deptTiers) {
        if (!byDocCount.has(t.min_doctors)) byDocCount.set(t.min_doctors, []);
        byDocCount.get(t.min_doctors)!.push(t);
      }

      const doctorCounts = Array.from(byDocCount.keys()).sort((a, b) => a - b);

      for (const group of byDocCount.values()) {
        group.sort(
          (a, b) =>
            (a.skills?.name ?? "").localeCompare(b.skills?.name ?? "") ||
            (a.secretary_roles?.name ?? "").localeCompare(
              b.secretary_roles?.name ?? ""
            )
        );
      }

      const lines: TierLine[] = [];
      for (const dc of doctorCounts) {
        const group = byDocCount.get(dc)!;
        for (let i = 0; i < group.length; i++) {
          lines.push({
            tier: group[i],
            isFirst: i === 0,
            groupSize: group.length,
          });
        }
      }

      result.push({
        id_department,
        deptName: name,
        siteName,
        lines,
        doctorCounts,
      });
    }

    return result.sort((a, b) => a.deptName.localeCompare(b.deptName));
  }, [tiers]);

  // ── Group requirements by activity ──────────────────

  const reqsByActivity = useMemo(() => {
    const map = new Map<number, ActivityReq[]>();
    for (const req of reqsRaw ?? []) {
      if (!map.has(req.id_activity)) map.set(req.id_activity, []);
      map.get(req.id_activity)!.push(req);
    }
    for (const group of map.values()) {
      group.sort((a, b) =>
        (a.skills?.name ?? "").localeCompare(b.skills?.name ?? "")
      );
    }
    return map;
  }, [reqsRaw]);

  // ── Mutations ────────────────────────────────────────

  const invalidateTiers = () =>
    queryClient.invalidateQueries({ queryKey: ["config", "tiers"] });
  const invalidateReqs = () => {
    queryClient.invalidateQueries({
      queryKey: ["config", "activity-requirements"],
    });
    queryClient.invalidateQueries({ queryKey: ["config", "activities"] });
  };

  const updateTierMut = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      updateTierQuery(supabase, id, { quantity }),
    onSuccess: () => {
      invalidateTiers();
      setEditingId(null);
    },
  });

  const deleteTierMut = useMutation({
    mutationFn: (id: number) => deleteTierQuery(supabase, id),
    onSuccess: () => {
      invalidateTiers();
      setDeleteTarget(null);
    },
  });

  const addTierMut = useMutation({
    mutationFn: (data: {
      id_department: number;
      id_skill: number | null;
      id_role: number | null;
      min_doctors: number;
      max_doctors: number;
      quantity: number;
    }) => createTierQuery(supabase, data),
    onSuccess: () => {
      invalidateTiers();
      setAddingDept(null);
      setAddSkill("");
      setAddRole("");
      setAddQty(1);
    },
  });

  const addActivityMut = useMutation({
    mutationFn: async (data: {
      name: string;
      reqs: { id_skill: number; quantity: number }[];
    }) => {
      const activity = await createActivityQuery(supabase, data.name);
      const id = (activity as { id_activity: number }).id_activity;
      for (const req of data.reqs) {
        await createReqQuery(supabase, {
          id_activity: id,
          id_skill: req.id_skill,
          quantity: req.quantity,
        });
      }
      return activity;
    },
    onSuccess: () => {
      invalidateReqs();
      setAddingActivity(false);
      setNewActivityName("");
      setNewActivityReqs([]);
    },
  });

  const deleteActivityMut = useMutation({
    mutationFn: (id: number) => deleteActivityQuery(supabase, id),
    onSuccess: () => {
      invalidateReqs();
      setDeleteTarget(null);
    },
  });

  const addReqMut = useMutation({
    mutationFn: (data: {
      id_activity: number;
      id_skill: number;
      quantity: number;
    }) => createReqQuery(supabase, data),
    onSuccess: () => {
      invalidateReqs();
      setAddingReqFor(null);
      setAddReqSkill("");
      setAddReqQty(1);
    },
  });

  const updateReqMut = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      updateReqQuery(supabase, id, { quantity }),
    onSuccess: () => {
      invalidateReqs();
      setEditingReqId(null);
    },
  });

  const deleteReqMut = useMutation({
    mutationFn: (id: number) => deleteReqQuery(supabase, id),
    onSuccess: () => {
      invalidateReqs();
      setDeleteTarget(null);
    },
  });

  // ── Handlers ─────────────────────────────────────────

  function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "tier") deleteTierMut.mutate(deleteTarget.id);
    else if (deleteTarget.type === "req") deleteReqMut.mutate(deleteTarget.id);
    else if (deleteTarget.type === "activity")
      deleteActivityMut.mutate(deleteTarget.id);
  }

  const isDeleting =
    deleteTierMut.isPending ||
    deleteReqMut.isPending ||
    deleteActivityMut.isPending;

  if (tiersLoading || reqsLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ━━━ Toolbar unifiée ━━━ */}
      <div className="flex items-center gap-3 bg-card rounded-xl border border-border/50 shadow-subtle px-4 py-2.5">
        {/* Tabs */}
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("consultation")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
              activeTab === "consultation"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="w-4 h-4 text-primary" />
            Consultation
          </button>
          <button
            onClick={() => setActiveTab("operations")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
              activeTab === "operations"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Scissors className="w-4 h-4 text-primary" />
            Opérations
          </button>
        </div>

        {/* Actions à droite */}
        {activeTab === "consultation" && (
          <>
            <div className="w-px h-5 bg-border/50" />
            <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
              <button
                onClick={() => setSiteFilter("")}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
                  siteFilter === ""
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tous
              </button>
              {sites.map((site) => (
                <button
                  key={site.id_site}
                  onClick={() => setSiteFilter(String(site.id_site))}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
                    siteFilter === String(site.id_site)
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </>
        )}
        {activeTab === "operations" && (
          <button
            onClick={() => setAddingActivity(true)}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Opération
          </button>
        )}
      </div>

      {/* ━━━ TAB 1: Consultation (Départements) ━━━ */}
      {activeTab === "consultation" && (
      <section>
        {deptData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun palier configuré
            {siteFilter ? " pour ce site" : ""}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deptData.map((dept) => (
            <div
              key={dept.id_department}
              className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden"
            >
              {/* Department header */}
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border/20">
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-foreground text-sm">
                    {dept.deptName}
                  </span>
                  {dept.siteName && (
                    <span className="text-xs text-muted-foreground">
                      {dept.siteName}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {dept.doctorCounts.length} palier
                    {dept.doctorCounts.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[60px]" />
                  <col />
                  <col className="w-[100px]" />
                  <col className="w-[70px]" />
                  <col className="w-[36px]" />
                </colgroup>
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-3 py-2 font-medium">Méd.</th>
                    <th className="text-left px-3 py-2 font-medium">Compétence</th>
                    <th className="text-left px-3 py-2 font-medium">Rôle</th>
                    <th className="text-center px-3 py-2 font-medium">Qté</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {dept.lines.map((line) => {
                    const { tier, isFirst, groupSize } = line;
                    const isEditing = editingId === tier.id_tier;

                    return (
                      <tr
                        key={tier.id_tier}
                        className={cn(
                          "group hover:bg-muted/10",
                          isFirst && "border-t border-border/20"
                        )}
                      >
                        {isFirst && (
                          <td
                            rowSpan={groupSize}
                            className="px-3 py-2.5 align-top border-r border-border/15"
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 font-bold text-primary text-xs">
                              {tier.min_doctors}
                            </span>
                          </td>
                        )}

                        <td className="px-3 py-2 text-foreground truncate">
                          {tier.skills?.name ?? "—"}
                        </td>

                        <td className="px-3 py-2 text-muted-foreground truncate text-xs">
                          {tier.secretary_roles?.name ?? "—"}
                        </td>

                        <td className="text-center px-3 py-2">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <input
                                type="number"
                                min={0}
                                value={editQty}
                                onChange={(e) =>
                                  setEditQty(parseInt(e.target.value) || 0)
                                }
                                className="w-12 rounded border border-slate-200 bg-white px-1 py-0.5 text-sm text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    updateTierMut.mutate({
                                      id: tier.id_tier,
                                      quantity: editQty,
                                    });
                                  if (e.key === "Escape")
                                    setEditingId(null);
                                }}
                              />
                              <button
                                onClick={() =>
                                  updateTierMut.mutate({
                                    id: tier.id_tier,
                                    quantity: editQty,
                                  })
                                }
                                disabled={updateTierMut.isPending}
                                className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-0.5 text-muted-foreground hover:bg-muted/50 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(tier.id_tier);
                                setEditQty(tier.quantity);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-primary hover:bg-primary/10 transition-colors text-sm"
                              title="Modifier"
                            >
                              {tier.quantity}
                            </button>
                          )}
                        </td>

                        <td className="px-1 py-2">
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                id: tier.id_tier,
                                label: `${tier.min_doctors} méd. → ${tier.quantity} × ${tier.skills?.name ?? "—"} (${tier.secretary_roles?.name ?? "—"})`,
                                type: "tier",
                              })
                            }
                            className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add row */}
                  {addingDept === dept.id_department ? (
                    <tr className="bg-primary/5 border-t border-border/20">
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={addDoc}
                          onChange={(e) =>
                            setAddDoc(parseInt(e.target.value) || 1)
                          }
                          className="w-12 rounded border border-slate-200 bg-white px-1 py-0.5 text-sm text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          autoFocus
                        />
                      </td>
                      <td className="px-3 py-2">
                        <CustomSelect
                          value={addSkill}
                          onChange={setAddSkill}
                          options={skills.map((s) => ({
                            value: String(s.id_skill),
                            label: s.name,
                          }))}
                          placeholder="Compétence..."
                          className="w-full"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <CustomSelect
                          value={addRole}
                          onChange={setAddRole}
                          options={roles.map((r) => ({
                            value: String(r.id_role),
                            label: r.name,
                          }))}
                          placeholder="Rôle..."
                          className="w-full"
                        />
                      </td>
                      <td className="text-center px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={addQty}
                          onChange={(e) =>
                            setAddQty(parseInt(e.target.value) || 1)
                          }
                          className="w-12 rounded border border-slate-200 bg-white px-1 py-0.5 text-sm text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => {
                              if (!addSkill || !addRole) return;
                              addTierMut.mutate({
                                id_department: dept.id_department,
                                id_skill: parseInt(addSkill),
                                id_role: parseInt(addRole),
                                min_doctors: addDoc,
                                max_doctors: addDoc,
                                quantity: addQty,
                              });
                            }}
                            disabled={
                              !addSkill || !addRole || addTierMut.isPending
                            }
                            className="p-0.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setAddingDept(null);
                              setAddSkill("");
                              setAddRole("");
                              setAddQty(1);
                            }}
                            className="p-0.5 text-muted-foreground hover:bg-muted/50 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              {/* Add button */}
              {addingDept !== dept.id_department && (
                <div className="px-3 py-2 border-t border-border/10">
                  <button
                    onClick={() => {
                      setAddingDept(dept.id_department);
                      setAddDoc(
                        dept.doctorCounts.length > 0
                          ? dept.doctorCounts[dept.doctorCounts.length - 1] + 1
                          : 1
                      );
                    }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un besoin
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ━━━ TAB 2: Opérations ━━━ */}
      {activeTab === "operations" && (
      <section>

        {activities.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucune opération configurée
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activities.map((activity) => {
            const reqs = reqsByActivity.get(activity.id_activity) ?? [];

            return (
              <div
                key={activity.id_activity}
                className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden"
              >
                {/* Activity header */}
                <div className="px-4 py-3 bg-muted/50 border-b border-border/30">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-foreground">
                      {activity.name}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {reqs.length} besoin{reqs.length > 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          id: activity.id_activity,
                          label: activity.name,
                          type: "activity",
                        })
                      }
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Requirements list */}
                <div className="divide-y divide-border/15">
                  {reqs.map((req) => {
                    const isEditingReq = editingReqId === req.id_requirement;

                    return (
                      <div
                        key={req.id_requirement}
                        className="group flex items-center px-4 py-2.5 hover:bg-muted/10"
                      >
                        <span className="flex-1 text-sm text-foreground">
                          {req.skills?.name ?? "—"}
                        </span>
                        {isEditingReq ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={editReqQty}
                              onChange={(e) =>
                                setEditReqQty(
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-14 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  updateReqMut.mutate({
                                    id: req.id_requirement,
                                    quantity: editReqQty,
                                  });
                                if (e.key === "Escape")
                                  setEditingReqId(null);
                              }}
                            />
                            <button
                              onClick={() =>
                                updateReqMut.mutate({
                                  id: req.id_requirement,
                                  quantity: editReqQty,
                                })
                              }
                              disabled={updateReqMut.isPending}
                              className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingReqId(null)}
                              className="p-0.5 text-muted-foreground hover:bg-muted/50 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingReqId(req.id_requirement);
                                setEditReqQty(req.quantity);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-sm text-primary hover:bg-primary/10 transition-colors"
                              title="Modifier la quantité"
                            >
                              {req.quantity}
                            </button>
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  id: req.id_requirement,
                                  label: `${req.skills?.name ?? "—"} pour ${activity.name}`,
                                  type: "req",
                                })
                              }
                              className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {reqs.length === 0 && (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      Aucun besoin configuré
                    </div>
                  )}
                </div>

                {/* Add requirement */}
                {addingReqFor === activity.id_activity ? (
                  <div className="px-4 py-2.5 border-t border-border/15 bg-primary/5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <CustomSelect
                          value={addReqSkill}
                          onChange={setAddReqSkill}
                          options={skills.map((s) => ({
                            value: String(s.id_skill),
                            label: s.name,
                          }))}
                          placeholder="Compétence..."
                          className="w-full"
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={addReqQty}
                        onChange={(e) =>
                          setAddReqQty(parseInt(e.target.value) || 1)
                        }
                        className="w-14 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <button
                        onClick={() => {
                          if (!addReqSkill) return;
                          addReqMut.mutate({
                            id_activity: activity.id_activity,
                            id_skill: parseInt(addReqSkill),
                            quantity: addReqQty,
                          });
                        }}
                        disabled={!addReqSkill || addReqMut.isPending}
                        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setAddingReqFor(null);
                          setAddReqSkill("");
                          setAddReqQty(1);
                        }}
                        className="p-1 text-muted-foreground hover:bg-muted/50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 border-t border-border/15">
                    <button
                      onClick={() => setAddingReqFor(activity.id_activity)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter un besoin
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title={
          deleteTarget?.type === "activity"
            ? "Supprimer cette opération"
            : "Supprimer ce besoin"
        }
        message={
          deleteTarget
            ? deleteTarget.type === "activity"
              ? `Supprimer l'opération « ${deleteTarget.label} » et tous ses besoins associés ?`
              : `Supprimer : ${deleteTarget.label} ?`
            : ""
        }
        confirmLabel="Supprimer"
        variant="danger"
        isPending={isDeleting}
      />

      {/* Add operation dialog */}
      {addingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in-up"
            style={{ animationDuration: "150ms" }}
            onClick={() => {
              setAddingActivity(false);
              setNewActivityName("");
              setNewActivityReqs([]);
            }}
          />
          <div
            className="relative bg-card rounded-2xl shadow-xl border border-border/40 w-full max-w-md mx-4 animate-fade-in-up overflow-hidden"
            style={{ animationDuration: "200ms" }}
          >
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Scissors className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">Nouvelle opération</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajoutez un type d&apos;opération et ses compétences requises
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAddingActivity(false);
                    setNewActivityName("");
                    setNewActivityReqs([]);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Nom de l&apos;opération
                </label>
                <input
                  type="text"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  placeholder="Ex: Sédation-cataracte, IVT..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  autoFocus
                />
              </div>

              {/* Skills requirements */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Compétences requises
                </label>
                <div className="space-y-2">
                  {newActivityReqs.map((req, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <CustomSelect
                          value={req.id_skill}
                          onChange={(v) => {
                            const updated = [...newActivityReqs];
                            updated[idx] = { ...updated[idx], id_skill: v };
                            setNewActivityReqs(updated);
                          }}
                          options={skills.map((s) => ({
                            value: String(s.id_skill),
                            label: s.name,
                          }))}
                          placeholder="Compétence..."
                          className="w-full"
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={req.quantity}
                        onChange={(e) => {
                          const updated = [...newActivityReqs];
                          updated[idx] = {
                            ...updated[idx],
                            quantity: parseInt(e.target.value) || 1,
                          };
                          setNewActivityReqs(updated);
                        }}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                      />
                      <button
                        onClick={() =>
                          setNewActivityReqs(
                            newActivityReqs.filter((_, i) => i !== idx)
                          )
                        }
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setNewActivityReqs([
                        ...newActivityReqs,
                        { id_skill: "", quantity: 1 },
                      ])
                    }
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter une compétence
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/30 bg-muted/20">
              <button
                onClick={() => {
                  setAddingActivity(false);
                  setNewActivityName("");
                  setNewActivityReqs([]);
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (!newActivityName.trim()) return;
                  const validReqs = newActivityReqs
                    .filter((r) => r.id_skill)
                    .map((r) => ({
                      id_skill: parseInt(r.id_skill),
                      quantity: r.quantity,
                    }));
                  addActivityMut.mutate({
                    name: newActivityName.trim(),
                    reqs: validReqs,
                  });
                }}
                disabled={!newActivityName.trim() || addActivityMut.isPending}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {addActivityMut.isPending ? "..." : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
