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
    <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-5.5 h-5.5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────

function StatusBadge({ status }: { status: "past" | "current" | "upcoming" }) {
  const config = {
    past: { label: "Terminée", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-slate-400" },
    current: { label: "En cours", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    upcoming: { label: "À venir", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.bg, config.text)}>
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
        <StatCard icon={UserMinus} label="Absents aujourd'hui" value={stats.todayCount} color="#E8590C" />
        <StatCard icon={Calendar} label="Ce mois" value={stats.monthCount} color="#4A6FA5" />
        <StatCard icon={CalendarClock} label="À venir" value={stats.upcomingCount} color="#2B8A3E" />
      </div>

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
                className="w-full rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date fin</label>
              <input
                type="date"
                value={addEnd}
                onChange={(e) => setAddEnd(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                  className="bg-card rounded-2xl border-2 border-primary/30 shadow-sm overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-4 pb-3">
                    <div
                      className="w-1 self-stretch rounded-full shrink-0 -ml-4 -my-4"
                      style={{ backgroundColor: colors.hex }}
                    />
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0", colors.avatar)}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{staff.firstname} {staff.lastname}</p>
                      <p className="text-xs text-muted-foreground">{POSITION_LABELS[pos] ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditState(null)}
                        className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUpdate(leave)}
                        disabled={!editState.start || !editState.end || updateLeave.isPending}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 pb-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Début</label>
                        <input
                          type="date"
                          value={editState.start}
                          onChange={(e) => setEditState((prev) => prev ? { ...prev, start: e.target.value } : prev)}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Fin</label>
                        <input
                          type="date"
                          value={editState.end}
                          onChange={(e) => setEditState((prev) => prev ? { ...prev, end: e.target.value } : prev)}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 transition-all"
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
                className="group bg-card rounded-2xl border border-border/40 shadow-sm hover:shadow-md hover:border-border/60 transition-all overflow-hidden"
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Left border color accent */}
                  <div
                    className="w-1 self-stretch rounded-full shrink-0 -ml-4 -my-4"
                    style={{ backgroundColor: colors.hex }}
                  />

                  {/* Avatar */}
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0", colors.avatar)}>
                    {initials}
                  </div>

                  {/* Name + position */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {staff.firstname} {staff.lastname}
                    </p>
                    <p className="text-xs text-muted-foreground">{POSITION_LABELS[pos] ?? "—"}</p>
                  </div>

                  {/* Dates + duration */}
                  <div className="hidden sm:block text-right min-w-[160px]">
                    <p className="text-sm font-medium text-foreground">
                      {formatDateRange(leave.start_date, leave.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {days} jour{days > 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Period + status badges */}
                  <div className="hidden md:flex items-center gap-2">
                    <PeriodBadge period={leave.period} />
                    <StatusBadge status={status} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(leave)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(leave)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mobile badges (visible on small screens) */}
                <div className="sm:hidden px-4 pb-3 flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-foreground font-medium">
                    {formatDateRange(leave.start_date, leave.end_date)}
                  </p>
                  <PeriodBadge period={leave.period} />
                  <StatusBadge status={status} />
                </div>
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
