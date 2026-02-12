"use client";

import { useState } from "react";
import { useAddPreference, useRemovePreference } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSites as fetchSitesQuery, fetchRoles as fetchRolesQuery } from "@/lib/supabase/queries";
import { PREFERENCE_LABELS, TARGET_TYPE_LABELS, JOUR_LABELS } from "@/lib/constants";
import { Plus, Trash2, Ban, AlertTriangle, Heart } from "lucide-react";
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
    const data: Record<string, unknown> = {
      target_type: targetType,
      preference: prefLevel,
      day_of_week: dayOfWeek || null,
      reason: reason || null,
    };

    if (targetType === "SITE" && selectedSite) data.id_site = selectedSite;
    if (targetType === "DEPARTMENT" && selectedDept)
      data.id_department = selectedDept;
    if (targetType === "ROLE" && selectedRole) data.id_role = selectedRole;

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

  const prefIcon = (level: PreferenceLevel) => {
    switch (level) {
      case "INTERDIT":
        return <Ban className="w-3.5 h-3.5 text-destructive" />;
      case "EVITER":
        return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
      case "PREFERE":
        return <Heart className="w-3.5 h-3.5 text-success" />;
    }
  };

  const prefColor = (level: PreferenceLevel) => {
    switch (level) {
      case "INTERDIT":
        return "bg-destructive/5 border-destructive/20";
      case "EVITER":
        return "bg-warning/5 border-warning/20";
      case "PREFERE":
        return "bg-success/5 border-success/20";
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Préférences ({preferences.length})
        </h4>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>

      {preferences.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">Aucune préférence définie</p>
      )}

      {/* Existing preferences */}
      <div className="space-y-2">
        {preferences.map((pref) => (
          <div
            key={pref.id_preference}
            className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${prefColor(
              pref.preference
            )}`}
          >
            <div className="flex items-center gap-3">
              {prefIcon(pref.preference)}
              <div>
                <div className="text-sm font-medium text-foreground">
                  <span className="text-muted-foreground text-xs mr-1">
                    {TARGET_TYPE_LABELS[pref.target_type]}:
                  </span>
                  {getTargetLabel(pref)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium">
                    {PREFERENCE_LABELS[pref.preference]}
                  </span>
                  {pref.day_of_week && (
                    <span>
                      {JOUR_LABELS[parseInt(pref.day_of_week)] ?? pref.day_of_week}
                    </span>
                  )}
                  {pref.reason && (
                    <span className="italic truncate max-w-[200px]">
                      — {pref.reason}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() =>
                removePref.mutate({ staffId, prefId: pref.id_preference })
              }
              className="text-destructive/50 hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Type de cible
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as TargetType)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="SITE">Site</option>
                <option value="DEPARTMENT">Département</option>
                <option value="ROLE">Rôle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Niveau
              </label>
              <select
                value={prefLevel}
                onChange={(e) => setPrefLevel(e.target.value as PreferenceLevel)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="INTERDIT">Interdit</option>
                <option value="EVITER">Éviter</option>
                <option value="PREFERE">Préféré</option>
              </select>
            </div>
          </div>

          {targetType === "SITE" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Site
              </label>
              <select
                value={selectedSite}
                onChange={(e) =>
                  setSelectedSite(e.target.value ? parseInt(e.target.value) : "")
                }
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">Choisir...</option>
                {sites.map((s) => (
                  <option key={s.id_site} value={s.id_site}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === "DEPARTMENT" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Site
                </label>
                <select
                  value={selectedSite}
                  onChange={(e) => {
                    setSelectedSite(
                      e.target.value ? parseInt(e.target.value) : ""
                    );
                    setSelectedDept("");
                  }}
                  className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
                >
                  <option value="">Choisir...</option>
                  {sites.map((s) => (
                    <option key={s.id_site} value={s.id_site}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Département
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) =>
                    setSelectedDept(
                      e.target.value ? parseInt(e.target.value) : ""
                    )
                  }
                  className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
                >
                  <option value="">Choisir...</option>
                  {selectedSiteDepts.map((d) => (
                    <option key={d.id_department} value={d.id_department}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {targetType === "ROLE" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Rôle
              </label>
              <select
                value={selectedRole}
                onChange={(e) =>
                  setSelectedRole(e.target.value ? parseInt(e.target.value) : "")
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Jour (optionnel)
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">Tous les jours</option>
                {Object.entries(JOUR_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Raison (optionnel)
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
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
