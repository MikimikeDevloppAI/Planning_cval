"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isWeekend,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { abbreviateSite, abbreviateDept } from "@/lib/utils/planning-helpers";
import { ROLE_TAG, PERIOD_LABELS } from "@/lib/constants";
import { AssignmentActionMenu } from "@/components/planning/assignment-action-menu";
import { useQueryClient } from "@tanstack/react-query";

// ── Types ────────────────────────────────────────────────

interface LeaveEntry {
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
}

interface StaffCalendarProps {
  staffId: number;
  staffName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assignments: any[];
  leaves: LeaveEntry[];
  onAddClick?: () => void;
  onCellClick?: (date: string) => void;
}

// ── Badge (same design as collaborateurs-table-view) ─────

type BadgeVariant = "doctor" | "secretary" | "admin" | "absence";

const VARIANT_INLINE: Record<BadgeVariant, { bg: string; border: string; color: string }> = {
  doctor:    { bg: "#F8F9FA", border: "1px solid #D1D5DB",                  color: "#2C3E50" },
  secretary: { bg: "#F8F9FA", border: "1px solid #D1D5DB",                  color: "#2C3E50" },
  admin:     { bg: "#F8F9FA", border: "1px solid #D1D5DB",                  color: "#2C3E50" },
  absence:   { bg: "#f87171", border: "1px solid rgba(220,38,38,0.3)",      color: "#ffffff" },
};

function Badge({
  label,
  sub,
  tag,
  variant = "admin",
  period,
  tooltip,
  onClick,
}: {
  label: string;
  sub: string;
  tag?: string;
  variant?: BadgeVariant;
  period: "AM" | "PM" | "FULL_DAY";
  tooltip: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const isAM = period === "AM";
  const isPM = period === "PM";
  const isFullDay = period === "FULL_DAY";
  const vi = VARIANT_INLINE[variant];

  return (
    <div
      className={cn("relative group/badge", onClick && "cursor-pointer")}
      onClick={onClick}
    >
      <div
        className={cn(
          "relative flex items-center gap-1 h-6 rounded-lg overflow-hidden w-full",
          "text-[10px] font-semibold leading-none",
          isAM && "pl-2.5 pr-1.5",
          isPM && "pl-1.5 pr-2.5",
          isFullDay && "px-2",
        )}
        style={{ background: vi.bg, outline: vi.border, outlineOffset: "-1px", color: vi.color }}
      >
        {isAM && (
          <span className="absolute left-0 inset-y-0 w-[3px]" style={{ background: "#eab308" }} />
        )}
        {isPM && (
          <span className="absolute right-0 inset-y-0 w-[3px]" style={{ background: "#d97706" }} />
        )}
        <span className="font-bold shrink-0">{label}</span>
        <span className="opacity-60 truncate">{sub}</span>
        {tag && <span className="font-bold opacity-50 ml-auto shrink-0">{tag}</span>}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/badge:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function getDeptName(a: { work_blocks?: { departments?: { name?: string } } }): string {
  return a.work_blocks?.departments?.name ?? "";
}

function getSiteName(a: { work_blocks?: { departments?: { sites?: { name?: string } } } }): string {
  return a.work_blocks?.departments?.sites?.name ?? "";
}

function getRoleName(a: { secretary_roles?: { name?: string } }): string {
  return a.secretary_roles?.name ?? "";
}

function getVariant(a: { assignment_type?: string; work_blocks?: { block_type?: string } }): BadgeVariant {
  if (a.assignment_type === "DOCTOR") return "doctor";
  if (a.work_blocks?.block_type === "ADMIN") return "admin";
  return "secretary";
}

// ── Main Component ───────────────────────────────────────

export function StaffCalendar({ staffId, staffName, assignments, leaves, onAddClick, onCellClick }: StaffCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const queryClient = useQueryClient();
  const [actionMenu, setActionMenu] = useState<{
    assignmentId: number;
    staffType: "DOCTOR" | "SECRETARY";
    date: string;
    period: "AM" | "PM" | "FULL_DAY";
    anchor: DOMRect;
  } | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Index assignments by date + period
  const assignmentsByDate = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, { am: any[]; pm: any[] }>();
    for (const a of assignments) {
      if (!a.work_blocks) continue;
      const dateStr = a.work_blocks.date;
      if (!map.has(dateStr)) map.set(dateStr, { am: [], pm: [] });
      const entry = map.get(dateStr)!;
      if (a.work_blocks.period === "AM") entry.am.push(a);
      else entry.pm.push(a);
    }
    return map;
  }, [assignments]);

  // Index leaves by date
  const leavesByDate = useMemo(() => {
    const map = new Map<string, "AM" | "PM" | "FULL">();
    for (const leave of leaves) {
      try {
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        const leaveDays = eachDayOfInterval({ start, end });
        for (const d of leaveDays) {
          const key = format(d, "yyyy-MM-dd");
          const existing = map.get(key);
          if (!leave.period) {
            map.set(key, "FULL");
          } else if (existing === "FULL") {
            // already full day
          } else if (existing && existing !== leave.period) {
            map.set(key, "FULL");
          } else {
            map.set(key, leave.period);
          }
        }
      } catch {
        // Skip invalid date ranges
      }
    }
    return map;
  }, [leaves]);

  const today = new Date();

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h4 className="text-sm font-semibold text-foreground capitalize min-w-[130px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </h4>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors"
          >
            Aujourd&apos;hui
          </button>
        </div>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        )}
      </div>

      {/* Day headers (Mon–Sat, no Sunday) */}
      <div className="grid grid-cols-6 gap-px mb-1">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-medium text-muted-foreground py-1.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid (no Sunday) */}
      <div className="grid grid-cols-6 gap-px bg-border/30 rounded-xl overflow-hidden">
        {days.filter((d) => d.getDay() !== 0).map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isSameDay(day, today);
          const isWe = isWeekend(day);
          const dayData = assignmentsByDate.get(dateStr);
          const leaveType = leavesByDate.get(dateStr);

          const amItems = dayData?.am ?? [];
          const pmItems = dayData?.pm ?? [];

          // Check if AM+PM can merge (same single dept)
          const canMerge =
            amItems.length === 1 &&
            pmItems.length === 1 &&
            !leaveType &&
            getDeptName(amItems[0]) === getDeptName(pmItems[0]);

          // Build badge list
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const badges: { a: any; period: "AM" | "PM" | "FULL_DAY" }[] = [];

          if (canMerge) {
            badges.push({ a: amItems[0], period: "FULL_DAY" });
          } else {
            for (const a of amItems) badges.push({ a, period: "AM" });
            for (const a of pmItems) badges.push({ a, period: "PM" });
          }

          const clickable = onCellClick && isCurrentMonth && !isWe;

          return (
            <div
              key={dateStr}
              className={cn(
                "bg-card min-h-[84px] p-1.5",
                !isCurrentMonth && "bg-muted/30",
                isWe && isCurrentMonth && "bg-muted/15",
                isTodayDate && !leaveType && "bg-sky-50/30",
                isTodayDate && "ring-2 ring-primary/30 ring-inset",
                clickable && "cursor-pointer hover:bg-primary/5 transition-colors"
              )}
              onClick={() => { if (clickable) onCellClick(dateStr); }}
            >
              {/* Date number */}
              <div
                className={cn(
                  "text-[11px] font-medium mb-1 text-right",
                  isCurrentMonth
                    ? isWe
                      ? "text-muted-foreground"
                      : "text-foreground"
                    : "text-border",
                  isTodayDate &&
                    "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center ml-auto text-[10px]"
                )}
              >
                {format(day, "d")}
              </div>

              {/* Badges */}
              <div className="flex flex-col gap-0.5">
                {/* Absence badge */}
                {leaveType && (
                  <Badge
                    label="ABS"
                    sub={PERIOD_LABELS[leaveType] ?? "Journée"}
                    variant="absence"
                    period={leaveType === "FULL" ? "FULL_DAY" : leaveType}
                    tooltip={
                      <div>
                        <div className="flex items-center gap-1.5 text-red-300 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Absent(e) — {PERIOD_LABELS[leaveType] ?? "Journée"}
                        </div>
                      </div>
                    }
                  />
                )}

                {/* Assignment badges */}
                {badges.map(({ a, period }, i) => {
                  const siteName = getSiteName(a);
                  const deptName = getDeptName(a);
                  const roleName = getRoleName(a);
                  const roleTag = a.id_role ? ROLE_TAG[a.id_role as keyof typeof ROLE_TAG] : undefined;
                  const activityName = (a.activity_templates?.name ?? a.staff_schedules?.activity_templates?.name) as string | undefined;
                  const isBlocDept = deptName.toLowerCase().includes("bloc");
                  const badgeLabel = isBlocDept
                    ? "Bloc"
                    : abbreviateSite(siteName || "—");
                  const badgeSub = isBlocDept
                    ? (activityName ? abbreviateDept(activityName) : "")
                    : abbreviateDept(deptName || "—");

                  return (
                    <Badge
                      key={i}
                      label={badgeLabel}
                      sub={badgeSub}
                      tag={roleTag}
                      variant={getVariant(a)}
                      period={period}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenu({
                          assignmentId: a.id_assignment,
                          staffType: a.assignment_type === "SECRETARY" ? "SECRETARY" : "DOCTOR",
                          date: dateStr,
                          period,
                          anchor: e.currentTarget.getBoundingClientRect(),
                        });
                      }}
                      tooltip={
                        <div>
                          <div className="text-slate-300 mt-0.5">{siteName}</div>
                          <div className="text-slate-400 mt-0.5">{deptName}</div>
                          {activityName && (
                            <div className="text-emerald-300 mt-0.5 text-[10px]">
                              Intervention : {activityName}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            {(period === "AM" || period === "FULL_DAY") && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            )}
                            {(period === "PM" || period === "FULL_DAY") && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            )}
                            <span className="text-slate-300">{PERIOD_LABELS[period]}</span>
                          </div>
                          {roleName && (
                            <div className="text-slate-400 mt-0.5 text-[10px]">
                              Rôle : {roleName}
                            </div>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AssignmentActionMenu
        open={actionMenu !== null}
        anchor={actionMenu?.anchor ?? null}
        onClose={() => setActionMenu(null)}
        staffId={staffId}
        staffName={staffName}
        staffType={actionMenu?.staffType ?? "DOCTOR"}
        date={actionMenu?.date ?? ""}
        period={actionMenu?.period ?? "AM"}
        assignmentId={actionMenu?.assignmentId ?? 0}
        onAfterAction={() => {
          queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
        }}
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded border border-slate-300" style={{ background: "#F8F9FA" }} />
          Activité
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded" style={{ background: "#f87171" }} />
          Absence
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-[3px] h-3 rounded-full" style={{ background: "#eab308" }} />
          Matin
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-[3px] h-3 rounded-full" style={{ background: "#d97706" }} />
          Après-midi
        </div>
      </div>
    </div>
  );
}
