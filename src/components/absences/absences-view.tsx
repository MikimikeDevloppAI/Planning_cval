"use client";

import { useState, useMemo } from "react";
import { format, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  UserMinus,
  Calendar,
  CalendarClock,
  CalendarOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { POSITION_LABELS } from "@/lib/constants";
import { getPositionColors } from "@/lib/utils/position-colors";
import { getInitials } from "@/lib/utils/initials";
import { useAllLeaves, useAddLeave, useRemoveLeave, useUpdateLeave, useStaffList } from "@/hooks/use-staff";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { AbsenceHeatmap } from "./absence-heatmap";

// ── Types ────────────────────────────────────────────────

interface LeaveRow {
  id_absence: number;
  id_staff: number;
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
  staff: { firstname: string; lastname: string; id_primary_position: number } | null;
}

type TimeFilter = "current" | "upcoming" | "past" | "all";

// ── Helpers ──────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0];

function leaveStatus(leave: LeaveRow): "past" | "current" | "upcoming" {
  const t = today();
  if (leave.end_date < t) return "past";
  if (leave.start_date > t) return "upcoming";
  return "current";
}

function periodLabel(p: "AM" | "PM" | null) {
  if (p === "AM") return "Matin";
  if (p === "PM") return "Après-midi";
  return "Journée";
}

function leaveDays(leave: LeaveRow) {
  const days = differenceInCalendarDays(parseISO(leave.end_date), parseISO(leave.start_date)) + 1;
  if (leave.period) return days * 0.5;
  return days;
}

function formatDateRange(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  const fmtStart = format(s, "d MMM yyyy", { locale: fr });
  if (start === end) return fmtStart;
  const fmtEnd = format(e, "d MMM yyyy", { locale: fr });
  return `${fmtStart} → ${fmtEnd}`;
}

// ── Stat Card ────────────────────────────────────────────

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
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────

function StatusBadge({ status }: { status: "past" | "current" | "upcoming" }) {
  const config = {
    past: { label: "Terminée", classes: "bg-slate-50 text-slate-500 border border-slate-200/60", dot: "bg-slate-400" },
    current: { label: "En cours", classes: "bg-amber-50 text-amber-700 border border-amber-200/60", dot: "bg-amber-500 animate-pulse-dot" },
    upcoming: { label: "À venir", classes: "bg-blue-50 text-blue-700 border border-blue-200/60", dot: "bg-blue-500" },
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium", config.classes)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

// ── Period Badge ─────────────────────────────────────────

function PeriodBadge({ period }: { period: "AM" | "PM" | null }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
      period === "AM" ? "bg-amber-50 text-amber-800 border border-amber-200/60"
        : period === "PM" ? "bg-indigo-50 text-indigo-800 border border-indigo-200/60"
        : "bg-slate-50 text-slate-700 border border-slate-200/60"
    )}>
      {periodLabel(period)}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "AM", label: "Matin (AM)" },
  { value: "PM", label: "Après-midi (PM)" },
];

export function AbsencesView() {
  const { data: leaves, isLoading } = useAllLeaves();
  const { data: staffList } = useStaffList({ active: "true" });
  const addLeave = useAddLeave();
  const removeLeave = useRemoveLeave();
  const updateLeave = useUpdateLeave();

  // Filters
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("current");

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addStaffId, setAddStaffId] = useState("");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addPeriod, setAddPeriod] = useState<"AM" | "PM" | "">("");

  // Edit
  const [editState, setEditState] = useState<{
    id: number;
    start: string;
    end: string;
    period: "AM" | "PM" | "";
  } | null>(null);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<LeaveRow | null>(null);

  // Normalize data — Supabase FK join may return `staff` as array instead of object
  const allLeaves = useMemo(() => {
    if (!leaves) return [];
    return (leaves as unknown as Array<Record<string, unknown>>).map((row) => {
      const staffRaw = row.staff;
      const staff = Array.isArray(staffRaw) ? staffRaw[0] ?? null : staffRaw ?? null;
      return {
        id_absence: row.id_absence as number,
        id_staff: row.id_staff as number,
        start_date: row.start_date as string,
        end_date: row.end_date as string,
        period: row.period as "AM" | "PM" | null,
        staff: staff as LeaveRow["staff"],
      };
    });
  }, [leaves]);

  // Stats
  const stats = useMemo(() => {
    const t = today();
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    let todayCount = 0;
    let monthCount = 0;
    let upcomingCount = 0;

    for (const l of allLeaves) {
      if (l.start_date <= t && l.end_date >= t) todayCount++;
      if (l.start_date <= monthEnd && l.end_date >= monthStart) monthCount++;
      if (l.start_date > t) upcomingCount++;
    }

    return { todayCount, monthCount, upcomingCount };
  }, [allLeaves]);

  // Filtered leaves
  const filtered = useMemo(() => {
    let list = [...allLeaves];

    // Time filter
    if (timeFilter === "current") {
      list = list.filter((l) => {
        const s = leaveStatus(l);
        return s === "current" || s === "upcoming";
      });
    } else if (timeFilter !== "all") {
      list = list.filter((l) => leaveStatus(l) === timeFilter);
    }

    // Position filter (1=Médecins includes obstétriciennes=3)
    if (posFilter) {
      const pos = Number(posFilter);
      if (pos === 1) {
        list = list.filter((l) => l.staff?.id_primary_position === 1 || l.staff?.id_primary_position === 3);
      } else {
        list = list.filter((l) => l.staff?.id_primary_position === pos);
      }
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => {
        if (!l.staff) return false;
        return l.staff.firstname.toLowerCase().includes(q) || l.staff.lastname.toLowerCase().includes(q);
      });
    }

    // Sort: current first, then upcoming, then past. Within each: by start_date
    list.sort((a, b) => {
      const sa = leaveStatus(a);
      const sb = leaveStatus(b);
      const order = { current: 0, upcoming: 1, past: 2 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return a.start_date.localeCompare(b.start_date);
    });

    return list;
  }, [allLeaves, timeFilter, posFilter, search]);

  // Staff select options
  const staffOptions = useMemo(() => {
    if (!staffList) return [];
    return (staffList as { id_staff: number; firstname: string; lastname: string; id_primary_position: number }[])
      .sort((a, b) => a.lastname.localeCompare(b.lastname))
      .map((s) => ({
        value: String(s.id_staff),
        label: `${s.lastname} ${s.firstname}`,
      }));
  }, [staffList]);

  const handleAdd = () => {
    if (!addStaffId || !addStart || !addEnd) return;
    addLeave.mutate(
      {
        staffId: Number(addStaffId),
        data: { start_date: addStart, end_date: addEnd, period: addPeriod || null },
      },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setAddStaffId("");
          setAddStart("");
          setAddEnd("");
          setAddPeriod("");
        },
      },
    );
  };

  const startEdit = (leave: LeaveRow) => {
    setEditState({
      id: leave.id_absence,
      start: leave.start_date,
      end: leave.end_date,
      period: leave.period ?? "",
    });
  };

  const handleUpdate = (leave: LeaveRow) => {
    if (!editState || !editState.start || !editState.end) return;
    updateLeave.mutate(
      {
        staffId: leave.id_staff,
        leaveId: leave.id_absence,
        data: { start_date: editState.start, end_date: editState.end, period: editState.period || null },
      },
      { onSuccess: () => setEditState(null) },
    );
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    removeLeave.mutate(
      { staffId: confirmDelete.id_staff, leaveId: confirmDelete.id_absence },
      { onSuccess: () => setConfirmDelete(null) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const timeButtons: { key: TimeFilter; label: string }[] = [
    { key: "current", label: "En cours & à venir" },
    { key: "upcoming", label: "À venir" },
    { key: "past", label: "Passées" },
    { key: "all", label: "Toutes" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Stats ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={UserMinus} label="Absents aujourd'hui" value={stats.todayCount} color="#4A6FA5" />
        <StatCard icon={Calendar} label="Ce mois" value={stats.monthCount} color="#6B8A7A" />
        <StatCard icon={CalendarClock} label="À venir" value={stats.upcomingCount} color="#9B7BA8" />
      </div>

      {/* ── Weekly Heatmap ─────────────────────────────── */}
      <AbsenceHeatmap leaves={allLeaves} />

      {/* ── Toolbar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border/50 shadow-subtle px-4 py-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 h-8 text-sm bg-muted/50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="w-px h-5 bg-border/50" />

        {/* Position filter */}
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {[
            { key: "", label: "Tous" },
            { key: "1", label: "Médecins" },
            { key: "2", label: "Secrétaires" },
          ].map((pb) => (
            <button
              key={pb.key}
              onClick={() => setPosFilter(pb.key)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
                posFilter === pb.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {pb.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border/50" />

        {/* Time filter */}
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {timeButtons.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTimeFilter(tb.key)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
                timeFilter === tb.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={cn(
            "ml-auto flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all",
            showAddForm
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
          )}
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAddForm ? "Fermer" : "Nouvelle absence"}
        </button>
      </div>

      {/* ── Add Form ─────────────────────────────────── */}
      {showAddForm && (
        <div className="bg-card rounded-2xl border-2 border-primary/20 shadow-sm p-5 space-y-4 animate-fade-in-up" style={{ animationDuration: "200ms" }}>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Nouvelle absence
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Collaborateur</label>
              <CustomSelect
                value={addStaffId}
                onChange={setAddStaffId}
                options={staffOptions}
                placeholder="Sélectionner..."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date début</label>
              <input
                type="date"
                value={addStart}
                onChange={(e) => {
                  setAddStart(e.target.value);
                  if (!addEnd) setAddEnd(e.target.value);
                }}
                className="w-full h-[38px] rounded-xl border border-border/50 bg-muted/30 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date fin</label>
              <input
                type="date"
                value={addEnd}
                onChange={(e) => setAddEnd(e.target.value)}
                className="w-full h-[38px] rounded-xl border border-border/50 bg-muted/30 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Période</label>
              <CustomSelect
                value={addPeriod}
                onChange={(v) => setAddPeriod(v as "AM" | "PM" | "")}
                options={PERIOD_OPTIONS}
                placeholder="Journée complète"
                allowEmpty
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!addStaffId || !addStart || !addEnd || addLeave.isPending}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              {addLeave.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {/* ── Leave List ────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <CalendarOff className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Aucune absence trouvée</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {search || posFilter ? "Essayez de modifier vos filtres" : "Aucune absence enregistrée"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((leave) => {
            const staff = leave.staff;
            if (!staff) return null;
            const pos = staff.id_primary_position;
            const colors = getPositionColors(pos);
            const initials = getInitials(staff.firstname, staff.lastname);
            const status = leaveStatus(leave);
            const days = leaveDays(leave);
            const isEditing = editState !== null && editState.id === leave.id_absence;

            if (isEditing && editState) {
              return (
                <div
                  key={leave.id_absence}
                  className="bg-card rounded-2xl border-2 border-primary/20 shadow-sm overflow-hidden bg-gradient-to-br from-primary/[0.02] to-transparent flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", colors.avatar)}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{staff.lastname}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{staff.firstname}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setEditState(null)}
                        className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleUpdate(leave)}
                        disabled={!editState.start || !editState.end || updateLeave.isPending}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Form */}
                  <div className="px-3 pb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Début</label>
                        <input
                          type="date"
                          value={editState.start}
                          onChange={(e) => setEditState((prev) => prev ? { ...prev, start: e.target.value } : prev)}
                          className="w-full h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Fin</label>
                        <input
                          type="date"
                          value={editState.end}
                          onChange={(e) => setEditState((prev) => prev ? { ...prev, end: e.target.value } : prev)}
                          className="w-full h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Période</label>
                      <CustomSelect
                        value={editState.period}
                        onChange={(v) => setEditState((prev) => prev ? { ...prev, period: v as "AM" | "PM" | "" } : prev)}
                        options={PERIOD_OPTIONS}
                        placeholder="Journée complète"
                        allowEmpty
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={leave.id_absence}
                className={cn(
                  "group relative bg-card rounded-2xl border border-border/30 overflow-hidden",
                  "shadow-card hover:shadow-card-hover",
                  "transition-all duration-300 ease-out",
                  "hover:-translate-y-2 hover:border-border/60",
                  "animate-fade-in-up",
                  "flex flex-col items-center"
                )}
              >
                {/* Gradient header band */}
                <div
                  className="h-10 w-full relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${colors.hex}18, ${colors.hex}08, transparent)`,
                  }}
                >
                  <div
                    className="absolute -top-4 -right-4 w-16 h-16 rounded-full"
                    style={{ backgroundColor: colors.hex, opacity: 0.07 }}
                  />
                </div>

                {/* Avatar — overlapping header */}
                <div className="-mt-5 relative z-10">
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold",
                      "ring-2 ring-card shadow-md",
                      "transition-all duration-300",
                      "group-hover:shadow-lg group-hover:scale-105",
                      colors.avatar
                    )}
                  >
                    {initials}
                  </div>
                </div>

                {/* Content */}
                <div className="px-3 pt-2 pb-3 flex flex-col items-center text-center w-full">
                  <h4 className="text-sm font-bold text-foreground truncate max-w-full leading-tight">
                    {staff.lastname}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-full">
                    {staff.firstname}
                  </p>

                  {/* Status + Period badges */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <StatusBadge status={status} />
                    <PeriodBadge period={leave.period} />
                  </div>

                  {/* Date range */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <p className="text-[11px] font-medium text-foreground">
                      {formatDateRange(leave.start_date, leave.end_date)}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {days} jour{days > 1 ? "s" : ""}
                  </p>

                  {/* Actions — hover reveal */}
                  <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(leave); }}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(leave); }}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Hover indicator — gradient line at bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    backgroundImage: `linear-gradient(to right, transparent, ${colors.hex}, transparent)`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDelete}
        variant="danger"
        title="Supprimer cette absence ?"
        message={
          confirmDelete?.staff
            ? `L'absence de ${confirmDelete.staff.firstname} ${confirmDelete.staff.lastname} du ${format(parseISO(confirmDelete.start_date), "d MMM yyyy", { locale: fr })}${
                confirmDelete.start_date !== confirmDelete.end_date
                  ? ` au ${format(parseISO(confirmDelete.end_date), "d MMM yyyy", { locale: fr })}`
                  : ""
              } sera supprimée.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        isPending={removeLeave.isPending}
      />
    </div>
  );
}
