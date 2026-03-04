"use client";

import { useState } from "react";
import { useAddPreference, useRemovePreference } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSites as fetchSitesQuery, fetchRoles as fetchRolesQuery } from "@/lib/supabase/queries";
import { PREFERENCE_LABELS, TARGET_TYPE_LABELS, JOUR_LABELS } from "@/lib/constants";
import { Plus, Trash2, Ban, AlertTriangle, Heart } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import type { PreferenceLevel, TargetType } from "@/lib/types/database";

interface PrefEntry {
  id_preference: number;
  target_type: TargetType;
  id_site: number | null;
  id_department: number | null;
  id_target_staff: number | null;
  id_role: number | null;
  preference: PreferenceLevel;
  day_of_week: string | null;
  reason: string | null;
  sites?: { name: string } | null;
  departments?: { name: string } | null;
  secretary_roles?: { name: string } | null;
}

interface StaffPrefsManagerProps {
  staffId: number;
  preferences: PrefEntry[];
}

interface SiteOption {
  id_site: number;
  name: string;
  departments: { id_department: number; name: string }[];
}

interface RoleOption {
  id_role: number;
  name: string;
}

const PREF_GROUPS = [
  {
    key: "INTERDIT" as PreferenceLevel,
    label: "Interdit",
    icon: <Ban className="w-3.5 h-3.5" />,
    accent: "#dc2626",
    bgClass: "bg-destructive/5 border-destructive/20",
  },
  {
    key: "EVITER" as PreferenceLevel,
    label: "À éviter",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    accent: "#d97706",
    bgClass: "bg-warning/5 border-warning/20",
  },
  {
    key: "PREFERE" as PreferenceLevel,
    label: "Préféré",
    icon: <Heart className="w-3.5 h-3.5" />,
    accent: "#16a34a",
    bgClass: "bg-success/5 border-success/20",
  },
] as const;

export function StaffPrefsManager({ staffId, preferences }: StaffPrefsManagerProps) {
  const addPref = useAddPreference();
  const removePref = useRemovePreference();
  const supabase = createClient();

  const { data: sitesData } = useQuery({
    queryKey: ["config", "sites"],
    queryFn: () => fetchSitesQuery(supabase),
  });
  const sites = (sitesData ?? []) as SiteOption[];

  const { data: rolesData } = useQuery({
    queryKey: ["config", "roles"],
    queryFn: () => fetchRolesQuery(supabase),
  });
  const roles = (rolesData ?? []) as RoleOption[];

  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PrefEntry | null>(null);

  // Form state
  const [targetType, setTargetType] = useState<TargetType>("SITE");
  const [prefLevel, setPrefLevel] = useState<PreferenceLevel>("INTERDIT");
  const [selectedSite, setSelectedSite] = useState<number | "">("");
  const [selectedDept, setSelectedDept] = useState<number | "">("");
  const [selectedRole, setSelectedRole] = useState<number | "">("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [reason, setReason] = useState("");

  const selectedSiteDepts =
    sites.find((s) => s.id_site === selectedSite)?.departments ?? [];

  const handleAdd = () => {
    const data: {
      target_type: TargetType;
      preference: PreferenceLevel;
      id_site?: number | null;
      id_department?: number | null;
      id_role?: number | null;
      day_of_week?: string | null;
      reason?: string | null;
    } = {
      target_type: targetType,
      preference: prefLevel,
      day_of_week: dayOfWeek || null,
      reason: reason || null,
    };

    if (targetType === "SITE" && selectedSite) data.id_site = selectedSite as number;
    if (targetType === "DEPARTMENT" && selectedDept)
      data.id_department = selectedDept as number;
    if (targetType === "ROLE" && selectedRole) data.id_role = selectedRole as number;

    addPref.mutate(
      { staffId, data },
      {
        onSuccess: () => {
          setShowForm(false);
          setReason("");
          setDayOfWeek("");
        },
      }
    );
  };

  const getTargetLabel = (pref: PrefEntry) => {
    switch (pref.target_type) {
      case "SITE":
        return pref.sites?.name ?? `Site #${pref.id_site}`;
      case "DEPARTMENT":
        return pref.departments?.name ?? `Dept #${pref.id_department}`;
      case "ROLE":
        return pref.secretary_roles?.name ?? `Rôle #${pref.id_role}`;
      case "STAFF":
        return `Staff #${pref.id_target_staff}`;
      default:
        return "—";
    }
  };

  // Group preferences by level
  const groupedPrefs = PREF_GROUPS.map((group) => ({
    ...group,
    items: preferences.filter((p) => p.preference === group.key),
  })).filter((g) => g.items.length > 0);

  const renderPrefRow = (pref: PrefEntry) => (
    <div
      key={pref.id_preference}
      className="flex items-center justify-between rounded-xl px-3.5 py-2 hover:bg-muted/30 transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">
          <span className="text-muted-foreground text-xs mr-1">
            {TARGET_TYPE_LABELS[pref.target_type]}:
          </span>
          {getTargetLabel(pref)}
        </div>
        {(pref.day_of_week || pref.reason) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {pref.day_of_week && (
              <span>{JOUR_LABELS[parseInt(pref.day_of_week)] ?? pref.day_of_week}</span>
            )}
            {pref.reason && (
              <span className="italic truncate max-w-[200px]">— {pref.reason}</span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={() => setConfirmDelete(pref)}
        className="text-muted-foreground/40 hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {!showForm && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      )}

      {preferences.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">Aucune préférence définie</p>
      )}

      {/* Grouped preferences */}
      {groupedPrefs.length > 0 && (
        <div className="space-y-3">
          {groupedPrefs.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${group.accent}15`, color: group.accent }}
                >
                  {group.icon}
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {group.label}
                </span>
                <span
                  className="text-[10px] font-bold rounded-full px-1.5 py-0.5 ml-auto"
                  style={{ backgroundColor: `${group.accent}12`, color: group.accent }}
                >
                  {group.items.length}
                </span>
              </div>
              <div className="bg-muted/20 rounded-xl border border-border/30 divide-y divide-border/20">
                {group.items.map(renderPrefRow)}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        variant="danger"
        title="Supprimer cette préférence ?"
        message={`La préférence « ${PREFERENCE_LABELS[confirmDelete?.preference ?? "INTERDIT"]} » sera supprimée.`}
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (confirmDelete) {
            removePref.mutate(
              { staffId, prefId: confirmDelete.id_preference },
              { onSuccess: () => setConfirmDelete(null) }
            );
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        isPending={removePref.isPending}
      />

      {/* Add form */}
      {showForm && (
        <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Type de cible
              </label>
              <CustomSelect
                value={targetType}
                onChange={(v) => setTargetType(v as TargetType)}
                options={[
                  { value: "SITE", label: "Site" },
                  { value: "DEPARTMENT", label: "Département" },
                  { value: "ROLE", label: "Rôle" },
                ]}
                placeholder="Type de cible"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Niveau
              </label>
              <CustomSelect
                value={prefLevel}
                onChange={(v) => setPrefLevel(v as PreferenceLevel)}
                options={[
                  { value: "INTERDIT", label: "Interdit" },
                  { value: "EVITER", label: "Éviter" },
                  { value: "PREFERE", label: "Préféré" },
                ]}
                placeholder="Niveau"
                className="w-full"
              />
            </div>
          </div>

          {targetType === "SITE" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Site
              </label>
              <CustomSelect
                value={selectedSite ? String(selectedSite) : ""}
                onChange={(v) => setSelectedSite(v ? parseInt(v) : "")}
                options={sites.map((s) => ({ value: String(s.id_site), label: s.name }))}
                placeholder="Choisir..."
                className="w-full"
              />
            </div>
          )}

          {targetType === "DEPARTMENT" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Site
                </label>
                <CustomSelect
                  value={selectedSite ? String(selectedSite) : ""}
                  onChange={(v) => {
                    setSelectedSite(v ? parseInt(v) : "");
                    setSelectedDept("");
                  }}
                  options={sites.map((s) => ({ value: String(s.id_site), label: s.name }))}
                  placeholder="Choisir..."
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Département
                </label>
                <CustomSelect
                  value={selectedDept ? String(selectedDept) : ""}
                  onChange={(v) => setSelectedDept(v ? parseInt(v) : "")}
                  options={selectedSiteDepts.map((d) => ({ value: String(d.id_department), label: d.name }))}
                  placeholder="Choisir..."
                  className="w-full"
                />
              </div>
            </div>
          )}

          {targetType === "ROLE" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Rôle
              </label>
              <CustomSelect
                value={selectedRole ? String(selectedRole) : ""}
                onChange={(v) => setSelectedRole(v ? parseInt(v) : "")}
                options={roles.map((r) => ({ value: String(r.id_role), label: r.name }))}
                placeholder="Choisir..."
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Jour (optionnel)
              </label>
              <CustomSelect
                value={dayOfWeek}
                onChange={setDayOfWeek}
                options={Object.entries(JOUR_LABELS).map(([id, label]) => ({ value: id, label: label as string }))}
                placeholder="Tous les jours"
                allowEmpty
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Raison (optionnel)
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all"
                placeholder="Raison..."
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={addPref.isPending}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
