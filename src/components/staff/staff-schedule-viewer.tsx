"use client";

import { useState, useMemo } from "react";
import { useAddSchedule, useRemoveSchedule, useUpdateSchedule } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSites as fetchSitesQuery, fetchRecurrenceTypes, fetchActivityTemplates } from "@/lib/supabase/queries";
import { JOUR_LABELS } from "@/lib/constants";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Sun, Moon, Trash2, Pencil, Check, X, Repeat, CalendarRange, Stethoscope } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";

const DATE_INPUT_CLS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all";
const DATE_INPUT_COMPACT_CLS =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 transition-all";

const BLOC_OP_NAME = "Bloc opératoire";

interface ScheduleEntry {
  id_schedule: number;
  schedule_type: string;
  day_of_week: number | null;
  period: string;
  week_offset: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  id_department: number | null;
  id_recurrence: number | null;
  id_activity: number | null;
  departments: { name: string; sites: { name: string } | null } | null;
  recurrence_types: { name: string; cycle_weeks: number } | null;
  activity_templates: { name: string } | null;
}

interface SiteOption {
  id_site: number;
  name: string;
  departments: { id_department: number; name: string; is_active: boolean }[];
}

interface RecurrenceOption {
  id_recurrence: number;
  name: string;
  cycle_weeks: number;
}

interface ActivityOption {
  id_activity: number;
  name: string;
}

interface DisplayRow {
  key: string;
  displayPeriod: "AM" | "PM" | "JC";
  entries: ScheduleEntry[];
  representative: ScheduleEntry;
}

interface StaffScheduleViewerProps {
  staffId: number;
  schedules: ScheduleEntry[];
  showForm: boolean;
  onToggleForm: (show: boolean) => void;
}

function formatDateShort(d: string | null) {
  if (!d) return null;
  try {
    return format(parseISO(d), "dd MMM yy", { locale: fr });
  } catch {
    return d;
  }
}

// Reusable option builders
const DAY_OPTIONS = Object.entries(JOUR_LABELS).map(([id, label]) => ({
  value: id,
  label: label as string,
}));

const PERIOD_OPTIONS = [
  { value: "AM", label: "Matin" },
  { value: "PM", label: "Après-midi" },
  { value: "DAY", label: "Journée" },
];

const PERIOD_OPTIONS_SHORT = [
  { value: "AM", label: "Matin" },
  { value: "PM", label: "Après-midi" },
  { value: "DAY", label: "Journée" },
];

export function StaffScheduleViewer({ staffId, schedules, showForm, onToggleForm }: StaffScheduleViewerProps) {
  const addSchedule = useAddSchedule();
  const removeSchedule = useRemoveSchedule();
  const updateSchedule = useUpdateSchedule();
  const supabase = createClient();

  const { data: sitesData } = useQuery({
    queryKey: ["config", "sites"],
    queryFn: () => fetchSitesQuery(supabase),
  });
  const sites = (sitesData ?? []) as SiteOption[];
  const allDepts = sites.flatMap((s) =>
    s.departments.filter((d) => d.is_active).map((d) => ({ ...d, siteName: s.name }))
  );

  const deptOptions = useMemo(
    () => allDepts.map((d) => ({ value: String(d.id_department), label: `${d.name} (${d.siteName})` })),
    [allDepts]
  );
  const deptOptionsShort = useMemo(
    () => allDepts.map((d) => ({ value: String(d.id_department), label: d.name })),
    [allDepts]
  );

  const { data: recurrenceData } = useQuery({
    queryKey: ["config", "recurrence_types"],
    queryFn: () => fetchRecurrenceTypes(supabase),
  });
  const recurrenceTypes = (recurrenceData ?? []) as RecurrenceOption[];
  const recurrenceOptions = useMemo(
    () => recurrenceTypes.map((r) => ({ value: String(r.id_recurrence), label: `${r.name} (${r.cycle_weeks} sem.)` })),
    [recurrenceTypes]
  );

  const { data: activityData } = useQuery({
    queryKey: ["config", "activity_templates"],
    queryFn: () => fetchActivityTemplates(supabase),
  });
  const activityTemplates = (activityData ?? []) as ActivityOption[];
  const activityOptions = useMemo(
    () => activityTemplates.map((a) => ({ value: String(a.id_activity), label: a.name })),
    [activityTemplates]
  );

  const [deleteRow, setDeleteRow] = useState<DisplayRow | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Add form state
  const [formDay, setFormDay] = useState<number>(1);
  const [formPeriod, setFormPeriod] = useState<string>("AM");
  const [formType, setFormType] = useState<string>("FIXED");
  const [formDept, setFormDept] = useState<number | "">("");
  const [formRecurrence, setFormRecurrence] = useState<number | "">("");
  const [formWeekOffset, setFormWeekOffset] = useState<number>(0);
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formActivity, setFormActivity] = useState<number | "">("");

  // Edit form state
  const [editDay, setEditDay] = useState<number>(1);
  const [editPeriod, setEditPeriod] = useState<string>("AM");
  const [editType, setEditType] = useState<string>("FIXED");
  const [editDept, setEditDept] = useState<number | "">("");
  const [editRecurrence, setEditRecurrence] = useState<number | "">("");
  const [editWeekOffset, setEditWeekOffset] = useState<number>(0);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editActivity, setEditActivity] = useState<number | "">("");

  const selectedRecurrence = recurrenceTypes.find(
    (r) => r.id_recurrence === formRecurrence
  );

  const editSelectedRecurrence = recurrenceTypes.find(
    (r) => r.id_recurrence === editRecurrence
  );

  const weekOffsetOptions = (cycleWeeks: number) =>
    Array.from({ length: cycleWeeks }, (_, i) => ({
      value: String(i),
      label: `Semaine ${i + 1} / ${cycleWeeks}`,
    }));

  // Check if selected department is Bloc opératoire
  const formDeptIsBlocOp = useMemo(() => {
    if (!formDept) return false;
    const dept = allDepts.find((d) => d.id_department === formDept);
    return dept?.name === BLOC_OP_NAME;
  }, [formDept, allDepts]);

  const editDeptIsBlocOp = useMemo(() => {
    if (!editDept) return false;
    const dept = allDepts.find((d) => d.id_department === editDept);
    return dept?.name === BLOC_OP_NAME;
  }, [editDept, allDepts]);

  const handleAdd = () => {
    if (!formDept) return;
    if (formDeptIsBlocOp && !formActivity) return;
    addSchedule.mutate(
      {
        staffId,
        data: {
          schedule_type: formType,
          day_of_week: formDay,
          period: formPeriod,
          id_department: formDept as number,
          id_recurrence: formRecurrence ? (formRecurrence as number) : null,
          week_offset: formRecurrence ? formWeekOffset : null,
          start_date: formStartDate || null,
          end_date: formEndDate || null,
          id_activity: formActivity ? (formActivity as number) : null,
        },
      },
      {
        onSuccess: () => {
          onToggleForm(false);
          setFormDept("");
          setFormRecurrence("");
          setFormWeekOffset(0);
          setFormStartDate("");
          setFormEndDate("");
          setFormActivity("");
        },
      }
    );
  };

  const startEdit = (row: DisplayRow) => {
    const s = row.representative;
    setEditingId(s.id_schedule);
    setEditDay(s.day_of_week ?? 1);
    // Map displayPeriod back to DB value
    setEditPeriod(row.displayPeriod === "JC" ? "DAY" : row.displayPeriod);
    setEditType(s.schedule_type);
    setEditDept(s.id_department ?? "");
    setEditRecurrence(s.id_recurrence ?? "");
    setEditWeekOffset(s.week_offset ?? 0);
    setEditStartDate(s.start_date ?? "");
    setEditEndDate(s.end_date ?? "");
    setEditActivity(s.id_activity ?? "");
  };

  const handleUpdate = () => {
    if (!editingId || !editDept) return;
    updateSchedule.mutate(
      {
        staffId,
        scheduleId: editingId,
        data: {
          day_of_week: editDay,
          period: editPeriod,
          schedule_type: editType,
          id_department: editDept as number,
          id_recurrence: editRecurrence ? (editRecurrence as number) : null,
          week_offset: editRecurrence ? editWeekOffset : null,
          start_date: editStartDate || null,
          end_date: editEndDate || null,
          id_activity: editActivity ? (editActivity as number) : null,
        },
      },
      {
        onSuccess: () => setEditingId(null),
      }
    );
  };

  const cancelEdit = () => setEditingId(null);

  // Build display rows — DAY entries are native, AM+PM merge is legacy fallback
  const buildDisplayRows = (): DisplayRow[] => {
    const sig = (s: ScheduleEntry) =>
      `${s.day_of_week}|${s.id_department}|${s.schedule_type}|${s.id_recurrence ?? ""}|${s.week_offset ?? ""}|${s.start_date ?? ""}|${s.end_date ?? ""}|${s.id_activity ?? ""}`;

    const groups = new Map<string, ScheduleEntry[]>();
    for (const s of schedules) {
      const k = sig(s);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    }

    const rows: DisplayRow[] = [];
    const consumed = new Set<number>();

    // Legacy fallback: merge AM+PM pairs that aren't yet migrated to DAY
    for (const [, items] of groups) {
      const am = items.find((i) => i.period === "AM");
      const pm = items.find((i) => i.period === "PM");
      if (am && pm) {
        consumed.add(am.id_schedule);
        consumed.add(pm.id_schedule);
        rows.push({
          key: `merged-${am.id_schedule}-${pm.id_schedule}`,
          displayPeriod: "JC",
          entries: [am, pm],
          representative: am,
        });
      }
    }

    for (const s of schedules) {
      if (consumed.has(s.id_schedule)) continue;
      const dp = s.period === "DAY" ? "JC" : s.period === "AM" ? "AM" : "PM";
      rows.push({
        key: `single-${s.id_schedule}`,
        displayPeriod: dp as "AM" | "PM" | "JC",
        entries: [s],
        representative: s,
      });
    }

    rows.sort((a, b) => {
      const dayA = a.representative.day_of_week ?? 99;
      const dayB = b.representative.day_of_week ?? 99;
      if (dayA !== dayB) return dayA - dayB;
      const order = { AM: 0, JC: 1, PM: 2 };
      return (order[a.displayPeriod] ?? 1) - (order[b.displayPeriod] ?? 1);
    });

    return rows;
  };

  const displayRows = buildDisplayRows();

  const getRecurrenceLabel = (s: ScheduleEntry) => {
    if (!s.recurrence_types) return null;
    const { cycle_weeks, name } = s.recurrence_types;
    if (cycle_weeks <= 1) return null;
    const offset = s.week_offset ?? 0;
    return `${name} (S${offset + 1}/${cycle_weeks})`;
  };

  const getDateRangeLabel = (s: ScheduleEntry) => {
    if (!s.start_date && !s.end_date) return null;
    const start = formatDateShort(s.start_date);
    const end = formatDateShort(s.end_date);
    if (start && end) return `${start} → ${end}`;
    if (start) return `Dès ${start}`;
    if (end) return `Jusqu'au ${end}`;
    return null;
  };

  const periodIcon = (dp: "AM" | "PM" | "JC") => {
    if (dp === "AM") return <Sun className="w-3.5 h-3.5 text-amber-500" />;
    if (dp === "PM") return <Moon className="w-3.5 h-3.5 text-orange-600" />;
    return <Clock className="w-3.5 h-3.5 text-primary" />;
  };

  const periodLabelFn = (dp: "AM" | "PM" | "JC") => {
    if (dp === "AM") return "Matin";
    if (dp === "PM") return "Après-midi";
    return "Journée";
  };

  return (
    <div className="space-y-3">
      {/* Add form */}
      {showForm && (
        <div className="bg-muted/30 rounded-xl border border-border/50 p-5 space-y-4">
          {/* Row 1: Jour / Période / Département */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Jour
              </label>
              <CustomSelect
                value={String(formDay)}
                onChange={(v) => setFormDay(Number(v))}
                options={DAY_OPTIONS}
                placeholder="Jour"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Période
              </label>
              <CustomSelect
                value={formPeriod}
                onChange={setFormPeriod}
                options={PERIOD_OPTIONS}
                placeholder="Période"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Département
              </label>
              <CustomSelect
                value={formDept ? String(formDept) : ""}
                onChange={(v) => {
                  setFormDept(v ? Number(v) : "");
                  setFormActivity("");
                }}
                options={deptOptions}
                placeholder="Choisir..."
                className="w-full"
              />
            </div>
          </div>

          {/* Intervention type — only for Bloc opératoire */}
          {formDeptIsBlocOp && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Type d&apos;intervention *
              </label>
              <CustomSelect
                value={formActivity ? String(formActivity) : ""}
                onChange={(v) => setFormActivity(v ? Number(v) : "")}
                options={activityOptions}
                placeholder="Choisir..."
                className="w-full"
              />
            </div>
          )}

          {/* Row 2: Récurrence + Semaine du cycle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Récurrence
              </label>
              <CustomSelect
                value={formRecurrence ? String(formRecurrence) : ""}
                onChange={(v) => {
                  setFormRecurrence(v ? Number(v) : "");
                  setFormWeekOffset(0);
                }}
                options={recurrenceOptions}
                placeholder="Toutes les semaines"
                allowEmpty
                className="w-full"
              />
            </div>
            {selectedRecurrence && selectedRecurrence.cycle_weeks > 1 && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Semaine du cycle
                </label>
                <CustomSelect
                  value={String(formWeekOffset)}
                  onChange={(v) => setFormWeekOffset(Number(v))}
                  options={weekOffsetOptions(selectedRecurrence.cycle_weeks)}
                  placeholder="Semaine"
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Row 3: Date début / fin */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Début
              </label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className={DATE_INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Fin
              </label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className={DATE_INPUT_CLS}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => onToggleForm(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!formDept || (formDeptIsBlocOp && !formActivity) || addSchedule.isPending}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {displayRows.length === 0 && !showForm && (
        <div className="text-center py-6 text-muted-foreground">
          <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm">Aucun planning défini</p>
        </div>
      )}

      {/* Schedule table */}
      {displayRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/40">
          {/* Header */}
          <div className="grid grid-cols-[80px_80px_1fr_auto] gap-x-3 px-4 py-2 bg-muted/40 border-b border-border/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Jour</span>
            <span>Période</span>
            <span>Département</span>
            <span className="w-14" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/20">
            {displayRows.map((row) => {
              const s = row.representative;
              const dp = row.displayPeriod;
              const recLabel = getRecurrenceLabel(s);
              const dateLabel = getDateRangeLabel(s);
              const isMerged = row.entries.length > 1;
              const isEditing = row.entries.some((e) => e.id_schedule === editingId);
              const activityName = s.activity_templates?.name ?? null;

              if (isEditing) {
                return (
                  <div
                    key={row.key}
                    className="bg-primary/[0.03] px-4 py-4 space-y-3"
                  >
                    {/* Row 1: Jour / Période / Département */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Jour</label>
                        <CustomSelect
                          value={String(editDay)}
                          onChange={(v) => setEditDay(Number(v))}
                          options={DAY_OPTIONS}
                          placeholder="Jour"
                          size="compact"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Période</label>
                        <CustomSelect
                          value={editPeriod}
                          onChange={setEditPeriod}
                          options={PERIOD_OPTIONS_SHORT}
                          placeholder="Période"
                          size="compact"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Département</label>
                        <CustomSelect
                          value={editDept ? String(editDept) : ""}
                          onChange={(v) => {
                            setEditDept(v ? Number(v) : "");
                            setEditActivity("");
                          }}
                          options={deptOptionsShort}
                          placeholder="Département"
                          size="compact"
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Activity (Bloc opératoire only) */}
                    {editDeptIsBlocOp && (
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Intervention</label>
                        <CustomSelect
                          value={editActivity ? String(editActivity) : ""}
                          onChange={(v) => setEditActivity(v ? Number(v) : "")}
                          options={activityOptions}
                          placeholder="Type d'intervention..."
                          size="compact"
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Row 2: Récurrence + Semaine */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Récurrence</label>
                        <CustomSelect
                          value={editRecurrence ? String(editRecurrence) : ""}
                          onChange={(v) => {
                            setEditRecurrence(v ? Number(v) : "");
                            setEditWeekOffset(0);
                          }}
                          options={recurrenceOptions}
                          placeholder="Toutes les semaines"
                          allowEmpty
                          size="compact"
                          className="w-full"
                        />
                      </div>
                      {editSelectedRecurrence && editSelectedRecurrence.cycle_weeks > 1 && (
                        <div>
                          <label className="block text-[10px] font-medium text-muted-foreground mb-1">Semaine</label>
                          <CustomSelect
                            value={String(editWeekOffset)}
                            onChange={(v) => setEditWeekOffset(Number(v))}
                            options={weekOffsetOptions(editSelectedRecurrence.cycle_weeks)}
                            placeholder="Semaine"
                            size="compact"
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>

                    {/* Row 3: Dates */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Début</label>
                        <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className={DATE_INPUT_COMPACT_CLS} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Fin</label>
                        <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className={DATE_INPUT_COMPACT_CLS} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (isMerged) {
                            for (const entry of row.entries) {
                              await updateSchedule.mutateAsync({
                                staffId,
                                scheduleId: entry.id_schedule,
                                data: {
                                  day_of_week: editDay,
                                  period: entry.period,
                                  schedule_type: editType,
                                  id_department: editDept as number,
                                  id_recurrence: editRecurrence ? (editRecurrence as number) : null,
                                  week_offset: editRecurrence ? editWeekOffset : null,
                                  start_date: editStartDate || null,
                                  end_date: editEndDate || null,
                                  id_activity: editActivity ? (editActivity as number) : null,
                                },
                              });
                            }
                            setEditingId(null);
                          } else {
                            handleUpdate();
                          }
                        }}
                        disabled={!editDept || updateSchedule.isPending}
                        className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[80px_80px_1fr_auto] gap-x-3 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors group"
                >
                  {/* Day */}
                  <span className="text-sm font-semibold text-foreground">
                    {s.day_of_week !== null
                      ? JOUR_LABELS[s.day_of_week] ?? `J${s.day_of_week}`
                      : "—"}
                  </span>

                  {/* Period */}
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {periodIcon(dp)}
                    <span className="text-xs">{periodLabelFn(dp)}</span>
                  </span>

                  {/* Department + metadata */}
                  <div className="min-w-0">
                    {s.departments?.sites?.name && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {s.departments.sites.name}
                      </span>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {s.departments?.name ?? "—"}
                      </span>
                      {activityName && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                          <Stethoscope className="w-2.5 h-2.5" />
                          {activityName}
                        </span>
                      )}
                    </div>
                    {(recLabel || dateLabel) && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {dateLabel && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <CalendarRange className="w-2.5 h-2.5" />
                            {dateLabel}
                          </span>
                        )}
                        {recLabel && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Repeat className="w-2.5 h-2.5" />
                            {recLabel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 w-14 justify-end">
                    <button
                      onClick={() => startEdit(row)}
                      className="text-muted-foreground/40 hover:text-primary p-1 rounded-lg hover:bg-primary/5 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteRow(row)}
                      className="text-muted-foreground/40 hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteRow}
        variant="danger"
        title="Supprimer cet horaire ?"
        message={
          deleteRow
            ? `L'horaire ${
                deleteRow.representative.day_of_week !== null
                  ? JOUR_LABELS[deleteRow.representative.day_of_week] ?? ""
                  : ""
              } ${periodLabelFn(deleteRow.displayPeriod)} — ${
                deleteRow.representative.departments?.name ?? ""
              }${deleteRow.entries.length > 1 ? " (AM + PM)" : ""} sera supprimé.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (deleteRow) {
            for (const entry of deleteRow.entries) {
              await removeSchedule.mutateAsync({ staffId, scheduleId: entry.id_schedule });
            }
            setDeleteRow(null);
          }
        }}
        onCancel={() => setDeleteRow(null)}
        isPending={removeSchedule.isPending}
      />
    </div>
  );
}
