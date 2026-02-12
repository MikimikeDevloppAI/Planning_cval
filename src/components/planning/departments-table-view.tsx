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
const COL1 = "w-[180px] min-w-[180px] max-w-[180px]";

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

/** Merged person for a day: AM, PM, or FULL */
interface DayPerson {
  id_staff: number;
  firstname: string;
  lastname: string;
  type: "DOCTOR" | "SECRETARY";
  period: "AM" | "PM" | "FULL";
  roleId: number | null;
}

function mergeAssignments(am: PlanningAssignment[], pm: PlanningAssignment[]): DayPerson[] {
  const map = new Map<number, DayPerson>();

  for (const a of am) {
    map.set(a.id_staff, {
      id_staff: a.id_staff,
      firstname: a.firstname,
      lastname: a.lastname,
      type: a.assignment_type as "DOCTOR" | "SECRETARY",
      period: "AM",
      roleId: a.id_role,
    });
  }

  for (const a of pm) {
    const existing = map.get(a.id_staff);
    if (existing) {
      existing.period = "FULL";
    } else {
      map.set(a.id_staff, {
        id_staff: a.id_staff,
        firstname: a.firstname,
        lastname: a.lastname,
        type: a.assignment_type as "DOCTOR" | "SECRETARY",
        period: "PM",
        roleId: a.id_role,
      });
    }
  }

  return Array.from(map.values());
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
      scrollRef.current.scrollLeft = Math.max(0, (todayIndex - 2) * 140);
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
          <thead className="sticky top-0 z-30">
            <tr>
              <th
                className={cn(
                  "sticky left-0 z-40 bg-slate-50 border-b border-r border-slate-200 px-4 py-2.5 text-left",
                  COL1
                )}
              >
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Département
                </span>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm border-l-[2px] border-l-amber-400 bg-amber-50 border border-amber-200" />
                    Matin
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm border-l-[2px] border-l-violet-400 bg-violet-50 border border-violet-200" />
                    Après-midi
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-50 border border-slate-200" />
                    Journée
                  </span>
                </div>
              </th>
              {days.map((dateStr, dayIdx) => {
                const date = parseISO(dateStr);
                const isMon = isMonday(date);
                const today = isToday(date);
                const isOdd = dayIdx % 2 === 1;

                return (
                  <th
                    key={dateStr}
                    className={cn(
                      "px-1 py-2 text-center min-w-[130px] border-b border-r-2 border-r-slate-300",
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
          </thead>

          <tbody>
            {sites.map((site) => (
              <Fragment key={`site-${site.id_site}`}>
                {/* Site header */}
                <tr>
                  <td className={cn(
                    "sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-1.5",
                    COL1,
                    "bg-slate-100"
                  )}>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {site.name}
                    </span>
                  </td>
                  <td
                    colSpan={days.length}
                    className="border-b border-slate-200 bg-slate-100"
                  />
                </tr>

                {/* Department rows */}
                {site.departments.map((dept, deptIndex) => {
                  const isEvenRow = deptIndex % 2 === 0;
                  const stickyBg = isEvenRow ? "bg-white" : "bg-slate-50";

                  return (
                    <tr
                      key={`dept-${dept.id_department}`}
                      className={cn("border-b border-slate-100", stickyBg)}
                    >
                      <td className={cn(
                        "sticky left-0 z-10 border-r border-slate-200 px-4 py-2",
                        COL1,
                        stickyBg
                      )}>
                        <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
                          {dept.name}
                        </span>
                      </td>

                      {dept.days.map((day, dayIdx) => {
                        const date = parseISO(day.date);
                        const isMon = isMonday(date);
                        const today = isToday(date);
                        const isOddDay = dayIdx % 2 === 1;

                        const am = day.am.blocks.flatMap((b) => b.assignments);
                        const pm = day.pm.blocks.flatMap((b) => b.assignments);
                        const merged = mergeAssignments(am, pm);

                        const cellBg = today
                          ? "bg-sky-50"
                          : isOddDay
                            ? "bg-slate-50"
                            : undefined;

                        return (
                          <td
                            key={day.date}
                            className={cn(
                              "px-1.5 py-1.5 align-top border-b border-slate-100 border-r-2 border-r-slate-300",
                              isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                              cellBg
                            )}
                          >
                            <DayCard people={merged} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}

            {/* Absences section */}
            {hasLeaves && (
              <>
                <tr>
                  <td className={cn(
                    "sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-1.5",
                    COL1,
                    "bg-red-50"
                  )}>
                    <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">
                      Absences
                    </span>
                  </td>
                  <td
                    colSpan={days.length}
                    className="border-b border-slate-200 bg-red-50"
                  />
                </tr>
                <tr className="border-b border-slate-100">
                  <td className={cn(
                    "sticky left-0 z-10 border-r border-slate-200 px-4 py-2 bg-white",
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

                    const cellBg = today
                      ? "bg-sky-50"
                      : isOddDay
                        ? "bg-slate-50"
                        : undefined;

                    return (
                      <td
                        key={dateStr}
                        className={cn(
                          "px-1.5 py-1.5 align-top border-b border-slate-100 border-r-2 border-r-slate-300",
                          isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                          cellBg
                        )}
                      >
                        <AbsenceCard leaves={dayLeaves} />
                      </td>
                    );
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

/** Individual chip for a person in the planning grid */
function PersonChip({ person }: { person: DayPerson }) {
  const isDoc = person.type === "DOCTOR";
  const tag = ROLE_TAG[person.roleId ?? 1];
  const initials = getInitials(person.firstname, person.lastname);

  const periodAccent =
    person.period === "AM"
      ? "border-l-[3px] border-l-amber-400"
      : person.period === "PM"
        ? "border-l-[3px] border-l-violet-400"
        : "";

  const baseColors = isDoc
    ? "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100"
    : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 h-6 rounded-md px-1.5",
        "border text-[11px] font-semibold leading-none",
        "transition-colors duration-100 cursor-default",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        baseColors,
        periodAccent,
      )}
      title={`${person.firstname} ${person.lastname} — ${
        person.period === "FULL" ? "Journée" : person.period === "AM" ? "Matin" : "Après-midi"
      }`}
    >
      <span>{initials}</span>
      {tag && (
        <span className="text-[9px] font-bold opacity-60">{tag}</span>
      )}
    </span>
  );
}

/** Absence chip for a person */
function AbsenceChip({ leave }: { leave: { id_staff: number; firstname: string; lastname: string; position: number; period: "AM" | "PM" | null } }) {
  const initials = getInitials(leave.firstname, leave.lastname);

  const periodAccent =
    leave.period === "AM"
      ? "border-l-[3px] border-l-amber-400"
      : leave.period === "PM"
        ? "border-l-[3px] border-l-violet-400"
        : "";

  return (
    <span
      className={cn(
        "inline-flex items-center h-6 rounded-md px-1.5",
        "border text-[11px] font-semibold leading-none",
        "transition-colors duration-100 cursor-default",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        "bg-red-50 border-red-200 text-red-600 hover:bg-red-100",
        periodAccent,
      )}
      title={`${leave.firstname} ${leave.lastname} — Absent${
        leave.period === null ? " (Journée)" : leave.period === "AM" ? " (Matin)" : " (Après-midi)"
      }`}
    >
      {initials}
    </span>
  );
}

/** Day cell content: chips grouped by type with subtle divider */
function DayCard({ people }: { people: DayPerson[] }) {
  if (people.length === 0) {
    return <div className="min-h-[28px]" />;
  }

  const doctors = people.filter((p) => p.type === "DOCTOR");
  const secretaries = people.filter((p) => p.type === "SECRETARY");

  return (
    <div className="relative group/card">
      <div className="flex flex-col gap-0.5 min-h-[28px]">
        {doctors.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {doctors.map((p) => (
              <PersonChip key={p.id_staff} person={p} />
            ))}
          </div>
        )}
        {doctors.length > 0 && secretaries.length > 0 && (
          <div className="h-px bg-slate-200/60 mx-1" />
        )}
        {secretaries.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {secretaries.map((p) => (
              <PersonChip key={p.id_staff} person={p} />
            ))}
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/card:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        {doctors.length > 0 && (
          <div>
            <div className="text-sky-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Médecins</div>
            {doctors.map((p) => (
              <div key={p.id_staff} className="text-sm">
                {p.firstname} {p.lastname}
                <span className="text-slate-400 ml-1.5">
                  {p.period === "FULL" ? "Journée" : p.period === "AM" ? "Matin" : "Après-midi"}
                </span>
              </div>
            ))}
          </div>
        )}
        {doctors.length > 0 && secretaries.length > 0 && (
          <div className="border-t border-slate-600 my-1" />
        )}
        {secretaries.length > 0 && (
          <div>
            <div className="text-emerald-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Secrétaires</div>
            {secretaries.map((p) => {
              const tag = ROLE_TAG[p.roleId ?? 1];
              return (
                <div key={p.id_staff} className="text-sm">
                  {p.firstname} {p.lastname}
                  {tag && <span className="text-slate-500 ml-1">({tag})</span>}
                  <span className="text-slate-400 ml-1.5">
                    {p.period === "FULL" ? "Journée" : p.period === "AM" ? "Matin" : "Après-midi"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

/** Compact card for absent staff in a day */
function AbsenceCard({ leaves }: { leaves: { id_staff: number; firstname: string; lastname: string; position: number; period: "AM" | "PM" | null }[] }) {
  if (leaves.length === 0) {
    return <div className="min-h-[28px]" />;
  }

  return (
    <div className="relative group/abs">
      <div className="flex flex-wrap gap-1 items-center min-h-[28px]">
        {leaves.map((l) => (
          <AbsenceChip key={l.id_staff} leave={l} />
        ))}
      </div>

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/abs:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="text-red-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Absents</div>
        {leaves.map((l) => (
          <div key={l.id_staff} className="text-sm">
            {l.firstname} {l.lastname}
            <span className="text-slate-400 ml-1.5">
              {l.period === null ? "Journée" : l.period === "AM" ? "Matin" : "Après-midi"}
            </span>
          </div>
        ))}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}
