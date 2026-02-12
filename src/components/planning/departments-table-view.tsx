"use client";

import { Fragment, useEffect, useRef, useMemo } from "react";
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { format, isToday, isMonday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/initials";
import type { PlanningSite, PlanningAssignment } from "@/lib/types/database";

/** Role id → short label (role 1 = Standard, no tag) */
const ROLE_TAG: Record<number, string> = {
  2: "1f",
  3: "2f",
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
          const alreadyExists = existing.find((e) => e.id_staff === leave.id_staff);
          if (alreadyExists) {
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
                                <PeriodCard assignments={amAssignments} />
                              </td>,
                              <td
                                key={`${day.date}-pm`}
                                className={cn(
                                  "px-1 py-1.5 align-top border-b border-slate-100 border-r-2 border-r-slate-300",
                                  cellBg
                                )}
                              >
                                <PeriodCard assignments={pmAssignments} />
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
                        <AbsenceCard leaves={amLeaves} />
                      </td>,
                      <td
                        key={`${dateStr}-abs-pm`}
                        className={cn(
                          "px-1 py-1.5 align-top border-b border-slate-100 border-r-2 border-r-slate-300",
                          cellBg
                        )}
                      >
                        <AbsenceCard leaves={pmLeaves} />
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

/** Single compact card showing all staff for a period cell */
function PeriodCard({ assignments }: { assignments: PlanningAssignment[] }) {
  if (assignments.length === 0) {
    return <div className="min-h-[24px]" />;
  }

  const doctors = assignments.filter((a) => a.assignment_type === "DOCTOR");
  const secretaries = assignments.filter((a) => a.assignment_type === "SECRETARY");

  return (
    <div className="relative group/card">
      <div className="rounded-md border border-slate-200 bg-white px-1.5 py-1 min-h-[24px] hover:border-slate-300 transition-colors">
        {/* Doctors line */}
        {doctors.length > 0 && (
          <div className="flex flex-wrap gap-x-1 items-baseline">
            {doctors.map((a) => (
              <span
                key={a.id_staff}
                className="text-[11px] font-semibold text-sky-700 leading-tight"
              >
                {getInitials(a.firstname, a.lastname)}
              </span>
            ))}
          </div>
        )}
        {/* Secretaries line */}
        {secretaries.length > 0 && (
          <div className="flex flex-wrap gap-x-1 items-baseline">
            {secretaries.map((a) => {
              const tag = ROLE_TAG[a.id_role ?? 1];
              return (
                <span
                  key={a.id_staff}
                  className="text-[11px] font-medium text-emerald-700 leading-tight"
                >
                  {getInitials(a.firstname, a.lastname)}
                  {tag && (
                    <span className="text-[9px] text-emerald-500 ml-px">{tag}</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover tooltip with full names */}
      {assignments.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/card:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
          {doctors.length > 0 && (
            <div>
              <div className="text-sky-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Médecins</div>
              {doctors.map((a) => (
                <div key={a.id_staff} className="text-sm">{a.firstname} {a.lastname}</div>
              ))}
            </div>
          )}
          {doctors.length > 0 && secretaries.length > 0 && (
            <div className="border-t border-slate-600 my-1" />
          )}
          {secretaries.length > 0 && (
            <div>
              <div className="text-emerald-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Secrétaires</div>
              {secretaries.map((a) => {
                const tag = ROLE_TAG[a.id_role ?? 1];
                return (
                  <div key={a.id_staff} className="text-sm">
                    {a.firstname} {a.lastname}
                    {tag && <span className="text-slate-400 ml-1">({tag})</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

/** Compact card for absent staff in a period */
function AbsenceCard({ leaves }: { leaves: { id_staff: number; firstname: string; lastname: string; position: number; period: "AM" | "PM" | null }[] }) {
  if (leaves.length === 0) {
    return <div className="min-h-[24px]" />;
  }

  return (
    <div className="relative group/abs">
      <div className="rounded-md border border-red-200 bg-red-50 px-1.5 py-1 min-h-[24px] hover:border-red-300 transition-colors">
        <div className="flex flex-wrap gap-x-1 items-baseline">
          {leaves.map((l) => (
            <span
              key={l.id_staff}
              className="text-[11px] font-medium text-red-600 leading-tight"
            >
              {getInitials(l.firstname, l.lastname)}
            </span>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/abs:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="text-red-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Absents</div>
        {leaves.map((l) => (
          <div key={l.id_staff} className="text-sm">{l.firstname} {l.lastname}</div>
        ))}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}
