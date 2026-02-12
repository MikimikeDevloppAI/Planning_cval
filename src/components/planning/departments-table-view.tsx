"use client";

import { Fragment, useEffect, useRef, useMemo } from "react";
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { format, isToday, isMonday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/initials";
import { PersonAvatar } from "./person-avatar";
import type { PlanningSite, PlanningAssignment } from "@/lib/types/database";

/** Role id → short label (role 1 = Standard, no tag) */
const ROLE_TAG: Record<number, string> = {
  2: "1f",   // Fermeture
  3: "2f",   // Aide fermeture
};

/** Fixed width for the first column */
const COL1 = "w-[220px] min-w-[220px] max-w-[220px]";

interface LeaveEntry {
  id_leave: number;
  id_staff: number;
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
  staff: { firstname: string; lastname: string; id_primary_position: number } | null;
}

interface DepartmentsTableViewProps {
  days: string[];
  sites: PlanningSite[];
  leaves?: LeaveEntry[];
  onDragEnd?: (data: { oldAssignmentId: number; targetBlockId: number; staffId: number; assignmentType: string; roleId: number | null; skillId: number | null }) => void;
}

export function DepartmentsTableView({ days, sites, leaves = [], onDragEnd }: DepartmentsTableViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Auto-scroll to today on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayIndex = days.indexOf(todayStr);
    if (todayIndex >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, (todayIndex - 2) * 170);
    }
  }, [days]);

  const handleDragEnd = (_event: DragEndEvent) => {
    // TODO: implement drag & drop
  };

  // Build leave index: date → list of { staff info, period }
  const leavesByDay = useMemo(() => {
    const index = new Map<string, { id_staff: number; firstname: string; lastname: string; position: number; period: "AM" | "PM" | null }[]>();
    for (const leave of leaves) {
      if (!leave.staff) continue;
      for (const d of days) {
        if (d >= leave.start_date && d <= leave.end_date) {
          if (!index.has(d)) index.set(d, []);
          const existing = index.get(d)!;
          // Avoid duplicate staff for same day
          const alreadyExists = existing.find((e) => e.id_staff === leave.id_staff);
          if (alreadyExists) {
            // If already full or different period → make full
            if (leave.period === null || (alreadyExists.period !== null && alreadyExists.period !== leave.period)) {
              alreadyExists.period = null;
            }
          } else {
            existing.push({
              id_staff: leave.id_staff,
              firstname: leave.staff.firstname,
              lastname: leave.staff.lastname,
              position: leave.staff.id_primary_position,
              period: leave.period,
            });
          }
        }
      }
    }
    return index;
  }, [leaves, days]);

  const hasLeaves = leaves.length > 0;

  if (sites.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune donnée pour ce mois
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        ref={scrollRef}
        className="overflow-auto h-full rounded-xl border border-slate-200 bg-white"
      >
        <table className="border-collapse w-max min-w-full">
          {/* ───── Header: 2 rows ───── */}
          <thead className="sticky top-0 z-30">
            {/* Row 1: Day labels */}
            <tr>
              <th
                rowSpan={2}
                className={cn(
                  "sticky left-0 z-40 bg-slate-50 border-b border-r border-slate-200 px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide align-bottom",
                  COL1
                )}
              >
                Département
              </th>
              {days.map((dateStr, dayIdx) => {
                const date = parseISO(dateStr);
                const isMon = isMonday(date);
                const today = isToday(date);
                const isOdd = dayIdx % 2 === 1;

                return (
                  <th
                    key={dateStr}
                    colSpan={2}
                    className={cn(
                      "px-1 pt-2 pb-0 text-center border-b border-slate-200 border-r-2 border-r-slate-300",
                      isOdd ? "bg-slate-50" : "bg-white",
                      isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                      today && "bg-sky-50 border-b-2 border-b-sky-400"
                    )}
                  >
                    <div className="text-[10px] uppercase text-slate-400 font-medium tracking-wide">
                      {format(date, "EEE", { locale: fr })}
                    </div>
                    <div className={cn(
                      "text-lg font-bold tabular-nums",
                      today ? "text-sky-600" : "text-slate-700"
                    )}>
                      {format(date, "d")}
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {format(date, "MMM", { locale: fr })}
                    </div>
                  </th>
                );
              })}
            </tr>
            {/* Row 2: AM / PM sub-headers */}
            <tr>
              {days.map((dateStr, dayIdx) => {
                const date = parseISO(dateStr);
                const isMon = isMonday(date);
                const today = isToday(date);
                const isOdd = dayIdx % 2 === 1;
                const baseBg = today ? "bg-sky-50" : isOdd ? "bg-slate-50" : "bg-white";

                return [
                    <th
                      key={`${dateStr}-am`}
                      className={cn(
                        "px-1 py-1 text-center text-[9px] font-semibold uppercase tracking-wider border-b border-slate-200 border-r border-r-slate-200 min-w-[80px]",
                        baseBg,
                        isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                        "text-slate-500"
                      )}
                    >
                      AM
                    </th>,
                    <th
                      key={`${dateStr}-pm`}
                      className={cn(
                        "px-1 py-1 text-center text-[9px] font-semibold uppercase tracking-wider border-b border-slate-200 border-r-2 border-r-slate-300 min-w-[80px]",
                        baseBg,
                        "text-slate-500"
                      )}
                    >
                      PM
                    </th>,
                ];
              })}
            </tr>
          </thead>

          <tbody>
            {sites.map((site) => {
              return (
                <Fragment key={`site-${site.id_site}`}>
                  {/* ───── Site header ───── */}
                  <tr>
                    <td className={cn(
                      "sticky left-0 z-10 border-b border-r border-slate-200 px-5 py-1.5",
                      COL1,
                      "bg-slate-100"
                    )}>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        {site.name}
                      </span>
                    </td>
                    <td
                      colSpan={days.length * 2}
                      className="border-b border-slate-200 bg-slate-100"
                    />
                  </tr>

                  {/* ───── Department rows ───── */}
                  {site.departments.map((dept, deptIndex) => {
                    const isEvenRow = deptIndex % 2 === 0;
                    const stickyBg = isEvenRow ? "bg-white" : "bg-slate-50";

                    return (
                      <tr
                        key={`dept-${dept.id_department}`}
                        className={cn("border-b border-slate-100", stickyBg)}
                      >
                        {/* Department name */}
                        <td className={cn(
                          "sticky left-0 z-10 border-r border-slate-200 px-5 py-2.5",
                          COL1,
                          stickyBg
                        )}>
                          <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
                            {dept.name}
                          </span>
                        </td>

                        {/* Day cells — 2 sub-cells per day (AM + PM) */}
                        {dept.days.map((day, dayIdx) => {
                          const date = parseISO(day.date);
                          const isMon = isMonday(date);
                          const today = isToday(date);
                          const isOddDay = dayIdx % 2 === 1;

                          const amAssignments = day.am.blocks.flatMap((b) => b.assignments);
                          const pmAssignments = day.pm.blocks.flatMap((b) => b.assignments);

                          const amDocs = amAssignments.filter((a) => a.assignment_type === "DOCTOR");
                          const amSecs = amAssignments.filter((a) => a.assignment_type === "SECRETARY");
                          const pmDocs = pmAssignments.filter((a) => a.assignment_type === "DOCTOR");
                          const pmSecs = pmAssignments.filter((a) => a.assignment_type === "SECRETARY");

                          const cellBg = today
                            ? "bg-sky-50"
                            : isOddDay
                              ? "bg-slate-50"
                              : undefined;

                          return [
                              <td
                                key={`${day.date}-am`}
                                className={cn(
                                  "px-1 py-1.5 align-top border-b border-slate-100 border-r border-r-slate-200",
                                  isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                                  cellBg
                                )}
                              >
                                <PeriodCell
                                  doctors={amDocs}
                                  secretaries={amSecs}
                                  period="AM"
                                  day={day.date}
                                  deptId={dept.id_department}
                                  deptName={dept.name}
                                />
                              </td>,
                              <td
                                key={`${day.date}-pm`}
                                className={cn(
                                  "px-1 py-1.5 align-top border-b border-slate-100 border-r-2 border-r-slate-300",
                                  cellBg
                                )}
                              >
                                <PeriodCell
                                  doctors={pmDocs}
                                  secretaries={pmSecs}
                                  period="PM"
                                  day={day.date}
                                  deptId={dept.id_department}
                                  deptName={dept.name}
                                />
                              </td>,
                          ];
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}

            {/* ───── Absences section ───── */}
            {hasLeaves && (
              <>
                <tr>
                  <td className={cn(
                    "sticky left-0 z-10 border-b border-r border-slate-200 px-5 py-1.5",
                    COL1,
                    "bg-red-50"
                  )}>
                    <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">
                      Absences
                    </span>
                  </td>
                  <td
                    colSpan={days.length * 2}
                    className="border-b border-slate-200 bg-red-50"
                  />
                </tr>
                <tr className="border-b border-slate-100">
                  <td className={cn(
                    "sticky left-0 z-10 border-r border-slate-200 px-5 py-2.5 bg-white",
                    COL1
                  )}>
                    <span className="text-[13px] font-medium text-slate-500 italic whitespace-nowrap">
                      Personnel absent
                    </span>
                  </td>
                  {days.map((dateStr, dayIdx) => {
                    const date = parseISO(dateStr);
                    const isMon = isMonday(date);
                    const today = isToday(date);
                    const isOddDay = dayIdx % 2 === 1;
                    const dayLeaves = leavesByDay.get(dateStr) ?? [];
                    const amLeaves = dayLeaves.filter((l) => l.period === null || l.period === "AM");
                    const pmLeaves = dayLeaves.filter((l) => l.period === null || l.period === "PM");

                    const cellBg = today
                      ? "bg-sky-50"
                      : isOddDay
                        ? "bg-slate-50"
                        : undefined;

                    return [
                      <td
                        key={`${dateStr}-abs-am`}
                        className={cn(
                          "px-1 py-1.5 align-top border-b border-slate-100 border-r border-r-slate-200",
                          isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                          cellBg
                        )}
                      >
                        <div className="grid grid-cols-2 gap-0.5">
                          {amLeaves.map((l) => (
                            <AbsentAvatar
                              key={l.id_staff}
                              initials={getInitials(l.firstname, l.lastname)}
                              fullName={`${l.firstname} ${l.lastname}`}
                              isDoctor={l.position === 1}
                              period={l.period === null ? "FULL" : l.period === "AM" ? "AM" : "FULL"}
                            />
                          ))}
                        </div>
                      </td>,
                      <td
                        key={`${dateStr}-abs-pm`}
                        className={cn(
                          "px-1 py-1.5 align-top border-b border-slate-100 border-r-2 border-r-slate-300",
                          cellBg
                        )}
                      >
                        <div className="grid grid-cols-2 gap-0.5">
                          {pmLeaves.map((l) => (
                            <AbsentAvatar
                              key={l.id_staff}
                              initials={getInitials(l.firstname, l.lastname)}
                              fullName={`${l.firstname} ${l.lastname}`}
                              isDoctor={l.position === 1}
                              period={l.period === null ? "FULL" : l.period === "PM" ? "PM" : "FULL"}
                            />
                          ))}
                        </div>
                      </td>,
                    ];
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}

// ─── Sub-components ──────────────────────────────────────

function PeriodCell({
  doctors,
  secretaries,
  period,
  day,
  deptId,
  deptName,
}: {
  doctors: PlanningAssignment[];
  secretaries: PlanningAssignment[];
  period: "AM" | "PM";
  day: string;
  deptId: number;
  deptName: string;
}) {
  const isEmpty = doctors.length === 0 && secretaries.length === 0;

  if (isEmpty) {
    return <div className="min-h-[28px]" />;
  }

  return (
    <div className="space-y-1">
      {/* Doctors */}
      {doctors.length > 0 && (
        <div className="grid grid-cols-2 gap-0.5">
          {doctors.map((a) => (
            <PersonAvatar
              key={`d-${a.id_staff}-${day}-${period}`}
              personId={a.id_staff}
              personType="doctor"
              initials={getInitials(a.firstname, a.lastname)}
              fullName={`${a.firstname} ${a.lastname}`}
              period={period}
              date={day}
              sourceDeptId={deptId}
              sourceDeptName={deptName}
              assignmentId={a.id_assignment}
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* Separator */}
      {doctors.length > 0 && secretaries.length > 0 && (
        <div className="border-t border-dashed border-slate-200 mx-0.5" />
      )}

      {/* Secretaries */}
      {secretaries.length > 0 && (
        <div className="grid grid-cols-2 gap-0.5">
          {secretaries.map((a) => (
            <PersonAvatar
              key={`s-${a.id_staff}-${day}-${period}`}
              personId={a.id_staff}
              personType="secretary"
              initials={getInitials(a.firstname, a.lastname)}
              fullName={`${a.firstname} ${a.lastname}`}
              period={period}
              roleTag={ROLE_TAG[a.id_role ?? 1]}
              date={day}
              sourceDeptId={deptId}
              sourceDeptName={deptName}
              assignmentId={a.id_assignment}
              roleId={a.id_role ?? undefined}
              skillId={a.id_skill ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AbsentAvatar({
  initials,
  fullName,
  isDoctor,
  period,
}: {
  initials: string;
  fullName: string;
  isDoctor: boolean;
  period: "AM" | "PM" | "FULL";
}) {
  const periodLabel = period === "FULL" ? "Journée" : period === "AM" ? "Matin" : "Après-midi";
  const positionLabel = isDoctor ? "Médecin" : "Secrétaire";

  return (
    <div className="relative group/abs">
      <div
        className={cn(
          "inline-flex items-center justify-center gap-1 h-7 min-w-[52px] rounded-md px-1.5",
          "text-xs font-semibold leading-none",
          "transition-all duration-150 cursor-default",
          isDoctor
            ? "bg-sky-50 border border-sky-400 text-sky-900 hover:bg-sky-100"
            : "bg-emerald-50 border border-emerald-400 text-emerald-900 hover:bg-emerald-100",
        )}
      >
        <span>{initials}</span>
      </div>

      {/* Rich hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/abs:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="font-semibold text-sm">{fullName}</div>
        <div className="text-slate-300 mt-0.5">{positionLabel}</div>
        <div className="flex items-center gap-1.5 mt-1 text-red-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Absent(e) — {periodLabel}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}
