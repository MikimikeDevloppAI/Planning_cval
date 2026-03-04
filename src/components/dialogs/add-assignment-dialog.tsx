"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Loader2, PlusCircle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWeekend,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSites as fetchSitesQuery, fetchActivityTemplates } from "@/lib/supabase/queries";
import { useAddManualAssignment } from "@/hooks/use-assignments";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

const BLOC_OP_NAME = "Bloc opératoire";

interface SiteOption {
  id_site: number;
  name: string;
  departments: { id_department: number; name: string; is_active: boolean }[];
}

interface ActivityOption {
  id_activity: number;
  name: string;
}

interface StaffOption {
  id_staff: number;
  firstname: string;
  lastname: string;
  id_primary_position: number;
}

interface AddAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  staffId?: number;
  staffName?: string;
  idPrimaryPosition?: 1 | 2 | 3;
  defaultDate?: string;
  staffList?: StaffOption[];
}

// ── Mini calendar for multi-date selection ────────────

function MiniCalendar({
  selectedDates,
  onToggleDate,
}: {
  selectedDates: Set<string>;
  onToggleDate: (dateStr: string) => void;
}) {
  const [month, setMonth] = useState(new Date());
  const today = new Date();

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth(subMonths(month, 1))}
          className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <span className="text-xs font-semibold text-foreground capitalize">
          {format(month, "MMMM yyyy", { locale: fr })}
        </span>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Day headers (Lun–Sam) */}
      <div className="grid grid-cols-6 gap-px mb-0.5">
        {["Lu", "Ma", "Me", "Je", "Ve", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-6 gap-px">
        {days
          .filter((d) => d.getDay() !== 0)
          .map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, today);
            const isSat = day.getDay() === 6;
            const isSelected = selectedDates.has(dateStr);
            const clickable = inMonth && !isSat;

            return (
              <button
                key={dateStr}
                type="button"
                disabled={!clickable}
                onClick={() => { if (clickable) onToggleDate(dateStr); }}
                className={cn(
                  "relative h-7 rounded-md text-[11px] font-medium transition-all",
                  !inMonth && "text-border",
                  inMonth && !isSat && !isSelected && "text-foreground hover:bg-primary/10",
                  isSat && inMonth && "text-muted-foreground/50",
                  isSelected && "bg-primary text-primary-foreground shadow-sm",
                  isToday && !isSelected && "ring-1 ring-primary/40 ring-inset",
                  !clickable && "cursor-default",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
      </div>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────

export function AddAssignmentDialog({
  open,
  onClose,
  staffId: propStaffId,
  staffName: propStaffName,
  idPrimaryPosition: propPosition,
  defaultDate,
  staffList,
}: AddAssignmentDialogProps) {
  const supabase = createClient();
  const addAssignment = useAddManualAssignment();

  // Multi-date mode: when no defaultDate, show interactive calendar
  const multiMode = !defaultDate;

  // ── Form state ──────────────────────────────────────
  const [selectedStaffId, setSelectedStaffId] = useState<number | "">(propStaffId ?? "");
  const [dates, setDates] = useState<string[]>(defaultDate ? [defaultDate] : []);
  const [period, setPeriod] = useState<"AM" | "PM" | "JOURNEE">("AM");
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedDeptId, setSelectedDeptId] = useState<number | "">("");
  const [roleId, setRoleId] = useState<number>(1);
  const [activityId, setActivityId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // ── Date helpers (multi-mode: toggle) ─────────────
  const selectedDatesSet = useMemo(() => new Set(dates), [dates]);

  const toggleDate = useCallback((dateStr: string) => {
    setDates((prev) =>
      prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr].sort()
    );
  }, []);

  const formatDateLabel = (d: string) => {
    try {
      return format(parseISO(d), "EEE d MMM", { locale: fr });
    } catch {
      return d;
    }
  };

  // ── Derived state ───────────────────────────────────
  const staffId = propStaffId ?? (selectedStaffId || undefined);
  const selectedStaff = useMemo(() => {
    if (propStaffId) return null;
    if (!staffList || !selectedStaffId) return null;
    return staffList.find((s) => s.id_staff === selectedStaffId) ?? null;
  }, [propStaffId, staffList, selectedStaffId]);

  const idPrimaryPosition: 1 | 2 | 3 | undefined =
    propPosition ?? (selectedStaff?.id_primary_position as 1 | 2 | 3 | undefined);

  const isSecretary = idPrimaryPosition === 2;

  // ── Data queries ────────────────────────────────────
  const { data: sitesRaw } = useQuery({
    queryKey: ["config", "sites"],
    queryFn: () => fetchSitesQuery(supabase),
  });
  const sites = (sitesRaw ?? []) as unknown as SiteOption[];

  const deptOptions = useMemo(() => {
    if (!selectedSiteId) return [];
    const site = sites.find((s) => s.id_site === selectedSiteId);
    return (site?.departments ?? [])
      .filter((d) => d.is_active)
      .map((d) => ({ value: String(d.id_department), label: d.name }));
  }, [sites, selectedSiteId]);

  const selectedDeptName = deptOptions.find((d) => d.value === String(selectedDeptId))?.label ?? "";
  const isBlocOp = selectedDeptName === BLOC_OP_NAME;

  const { data: activityRaw } = useQuery({
    queryKey: ["config", "activity_templates"],
    queryFn: () => fetchActivityTemplates(supabase),
    enabled: isBlocOp,
  });
  const activities = (activityRaw ?? []) as unknown as ActivityOption[];

  // ── Staff options (dashboard mode) ──────────────────
  const staffOptions = useMemo(() => {
    if (!staffList) return [];
    return staffList.map((s) => ({
      value: String(s.id_staff),
      label: `${s.lastname} ${s.firstname}`,
    }));
  }, [staffList]);

  // ── Validation ──────────────────────────────────────
  const canSubmit = !!staffId && dates.length > 0 && !!selectedDeptId;

  // ── Submit (sequential across dates, with AM+PM for JOURNEE) ──
  const handleSubmit = async () => {
    if (!staffId || !selectedDeptId || dates.length === 0 || !idPrimaryPosition) return;
    setError(null);

    const baseParams = {
      staffId: staffId as number,
      idPrimaryPosition,
      targetDeptId: selectedDeptId as number,
      roleId: isSecretary && !isBlocOp ? roleId : null,
      activityId: isBlocOp && activityId ? (activityId as number) : null,
    };

    const periods: ("AM" | "PM")[] = period === "JOURNEE" ? ["AM", "PM"] : [period];
    const total = dates.length * periods.length;
    setProgress({ done: 0, total });

    let done = 0;
    let lastError: string | null = null;

    for (const d of dates) {
      for (const p of periods) {
        try {
          await addAssignment.mutateAsync({ ...baseParams, targetDate: d, period: p });
        } catch (err) {
          lastError = `${formatDateLabel(d)} (${p === "AM" ? "matin" : "après-midi"}) : ${(err as Error).message}`;
        }
        done++;
        setProgress({ done, total });
      }
    }

    setProgress(null);
    if (lastError) {
      setError(lastError);
    } else {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl mx-6 p-6 border border-border/50 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <PlusCircle className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Ajouter {dates.length > 1 ? `${dates.length} assignations` : "une assignation"}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-auto flex-1 min-h-0">
          {/* Staff info banner (staff page) or staff picker (dashboard) */}
          {propStaffId && propStaffName ? (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-semibold text-foreground">{propStaffName}</p>
            </div>
          ) : staffList ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Personnel</label>
              <CustomSelect
                value={selectedStaffId ? String(selectedStaffId) : ""}
                onChange={(v) => setSelectedStaffId(v ? parseInt(v) : "")}
                options={staffOptions}
                placeholder="Sélectionner un collaborateur..."
                className="w-full"
              />
            </div>
          ) : null}

          {/* Date(s) */}
          {multiMode ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Dates{" "}
                {dates.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    ({dates.length} sélectionnée{dates.length > 1 ? "s" : ""})
                  </span>
                )}
              </label>

              {/* Interactive mini-calendar */}
              <div className="border border-border/40 rounded-xl p-3 bg-muted/20">
                <MiniCalendar
                  selectedDates={selectedDatesSet}
                  onToggleDate={toggleDate}
                />
              </div>

              {/* Selected dates chips (summary) */}
              {dates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {dates.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20"
                    >
                      {formatDateLabel(d)}
                      <button
                        onClick={() => toggleDate(d)}
                        className="hover:text-destructive transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all"
                value={dates[0] ?? ""}
                onChange={(e) => setDates(e.target.value ? [e.target.value] : [])}
              />
            </div>
          )}

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Période</label>
            <div className="grid grid-cols-3 gap-2">
              {(["AM", "PM", "JOURNEE"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                    period === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border/50 hover:bg-muted/50"
                  )}
                >
                  {p === "AM" ? "Matin" : p === "PM" ? "Après-midi" : "Journée"}
                </button>
              ))}
            </div>
          </div>

          {/* Site */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Site</label>
            <CustomSelect
              value={selectedSiteId ? String(selectedSiteId) : ""}
              onChange={(v) => {
                setSelectedSiteId(v ? parseInt(v) : "");
                setSelectedDeptId("");
                setActivityId("");
              }}
              options={sites.map((s) => ({ value: String(s.id_site), label: s.name }))}
              placeholder="Sélectionner un site..."
              className="w-full"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Département</label>
            <CustomSelect
              value={selectedDeptId ? String(selectedDeptId) : ""}
              onChange={(v) => {
                setSelectedDeptId(v ? parseInt(v) : "");
                setActivityId("");
              }}
              options={deptOptions}
              placeholder={selectedSiteId ? "Sélectionner un département..." : "Sélectionnez d'abord un site"}
              className="w-full"
              disabled={!selectedSiteId}
            />
          </div>

          {/* Role (secretaries, non-bloc) */}
          {isSecretary && !isBlocOp && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Rôle</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 1, label: "Standard" },
                  { id: 2, label: "Fermeture" },
                  { id: 3, label: "Aide ferm." },
                ] as const).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRoleId(r.id)}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                      roleId === r.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border/50 hover:bg-muted/50"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Activity (bloc opératoire) */}
          {isBlocOp && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type d&apos;intervention</label>
              <CustomSelect
                value={activityId ? String(activityId) : ""}
                onChange={(v) => setActivityId(v ? parseInt(v) : "")}
                options={activities.map((a) => ({ value: String(a.id_activity), label: a.name }))}
                placeholder="Sélectionner une intervention..."
                className="w-full"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
              {error}
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="text-sm p-3 rounded-lg bg-primary/5 text-primary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Création en cours... {progress.done}/{progress.total}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || addAssignment.isPending || !!progress}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {(addAssignment.isPending || progress) && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer{dates.length > 1 ? ` (${dates.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
