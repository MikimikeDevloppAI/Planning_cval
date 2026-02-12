"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { format, isToday, isMonday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/initials";
import { POSITION_LABELS } from "@/lib/constants";
import type { PlanningSite, PlanningAssignment } from "@/lib/types/database";

type FilterType = "tous" | "medecins" | "secretaires";

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

interface CollaborateursTableViewProps {
  days: string[];
  sites: PlanningSite[];
  leaves?: LeaveEntry[];
}

interface PersonDay {
  date: string;
  deptName: string;
  siteName: string;
  period: "AM" | "PM" | "FULL_DAY";
  roleName: string | null;
  blockType: string | null;
  activityName: string | null;
}

interface CollaborateurData {
  id_staff: number;
  firstname: string;
  lastname: string;
  position: number;
  days: Map<string, PersonDay[]>;
}

export function CollaborateursTableView({
  days,
  sites,
  leaves = [],
}: CollaborateursTableViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterType>("tous");

  // Build a lookup: staffId → Set of "date|period" keys for quick leave checks
  const leaveIndex = useMemo(() => {
    const index = new Map<number, Map<string, "AM" | "PM" | "FULL">>();
    for (const leave of leaves) {
      if (!index.has(leave.id_staff)) index.set(leave.id_staff, new Map());
      const staffLeaves = index.get(leave.id_staff)!;
      // Iterate through all days that overlap this leave
      for (const d of days) {
        if (d >= leave.start_date && d <= leave.end_date) {
          const existing = staffLeaves.get(d);
          if (leave.period === null) {
            staffLeaves.set(d, "FULL");
          } else if (existing === "FULL") {
            // already full day, keep it
          } else if (existing && existing !== leave.period) {
            staffLeaves.set(d, "FULL");
          } else {
            staffLeaves.set(d, leave.period);
          }
        }
      }
    }
    return index;
  }, [leaves, days]);

  const collaborateurs = useMemo(() => {
    const staffMap = new Map<number, CollaborateurData>();

    for (const site of sites) {
      for (const dept of site.departments) {
        for (const day of dept.days) {
          const processBlock = (
            block: { assignments: PlanningAssignment[]; block_type?: string; activity_name?: string | null },
            period: "AM" | "PM"
          ) => {
            for (const a of block.assignments) {
              if (!staffMap.has(a.id_staff)) {
                staffMap.set(a.id_staff, {
                  id_staff: a.id_staff,
                  firstname: a.firstname,
                  lastname: a.lastname,
                  position: a.id_primary_position,
                  days: new Map(),
                });
              }
              const collab = staffMap.get(a.id_staff)!;
              if (!collab.days.has(day.date)) {
                collab.days.set(day.date, []);
              }

              const existing = collab.days.get(day.date)!;
              const sameDept = existing.find(
                (e) => e.deptName === dept.name && e.siteName === site.name
              );
              if (sameDept) {
                if (
                  (sameDept.period === "AM" && period === "PM") ||
                  (sameDept.period === "PM" && period === "AM")
                ) {
                  sameDept.period = "FULL_DAY";
                }
              } else {
                existing.push({
                  date: day.date,
                  deptName: dept.name,
                  siteName: site.name,
                  period,
                  roleName: a.role_name,
                  blockType: block.block_type ?? null,
                  activityName: block.activity_name ?? null,
                });
              }
            }
          };

          for (const block of day.am.blocks) {
            processBlock(block, "AM");
          }
          for (const block of day.pm.blocks) {
            processBlock(block, "PM");
          }
        }
      }
    }

    // Also add staff from leaves who might not have any assignments
    for (const leave of leaves) {
      if (leave.staff && !staffMap.has(leave.id_staff)) {
        staffMap.set(leave.id_staff, {
          id_staff: leave.id_staff,
          firstname: leave.staff.firstname,
          lastname: leave.staff.lastname,
          position: leave.staff.id_primary_position,
          days: new Map(),
        });
      }
    }

    return Array.from(staffMap.values()).sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.lastname.localeCompare(b.lastname);
    });
  }, [sites, leaves]);

  const filteredCollabs = useMemo(() => {
    if (filter === "tous") return collaborateurs;
    if (filter === "medecins")
      return collaborateurs.filter((c) => c.position === 1);
    return collaborateurs.filter((c) => c.position === 2);
  }, [collaborateurs, filter]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayIndex = days.indexOf(todayStr);
    if (todayIndex >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, (todayIndex - 2) * 160);
    }
  }, [days]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 shrink-0">
        {(["tous", "medecins", "secretaires"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              filter === f
                ? "bg-white text-slate-800 ring-1 ring-slate-300 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {f === "tous" ? "Tous" : f === "medecins" ? "Médecins" : "Secrétaires"}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-auto">
          {filteredCollabs.length} collaborateur{filteredCollabs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="overflow-auto flex-1 rounded-xl border border-slate-200 bg-white"
      >
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-30">
            <tr>
              <th className={cn(
                "sticky left-0 z-40 bg-slate-50 border-b border-r border-slate-200 px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide",
                COL1
              )}>
                Collaborateur
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
                      "px-1 py-2 text-center min-w-[150px] border-b border-r border-slate-200",
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
            {filteredCollabs.map((collab, idx) => {
              const isEven = idx % 2 === 0;
              const stickyBg = isEven ? "bg-white" : "bg-slate-50";
              const isDoc = collab.position === 1;

              return (
                <tr
                  key={collab.id_staff}
                  className={cn("border-b border-slate-100", stickyBg)}
                >
                  <td className={cn(
                    "sticky left-0 z-10 border-r border-slate-200 px-5 py-2",
                    COL1,
                    stickyBg
                  )}>
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold border",
                          isDoc
                            ? "bg-sky-50 border-sky-400 text-sky-900"
                            : "bg-emerald-50 border-emerald-400 text-emerald-900"
                        )}
                      >
                        {getInitials(collab.firstname, collab.lastname)}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
                          {collab.lastname} {collab.firstname}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {POSITION_LABELS[collab.position] ?? "Autre"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {days.map((dateStr, dayIdx) => {
                    const date = parseISO(dateStr);
                    const isMon = isMonday(date);
                    const today = isToday(date);
                    const isOddDay = dayIdx % 2 === 1;
                    const dayAssignments = collab.days.get(dateStr) ?? [];
                    const leaveType = leaveIndex.get(collab.id_staff)?.get(dateStr);

                    const cellBg = leaveType === "FULL"
                      ? "bg-red-50"
                      : today
                        ? "bg-sky-50"
                        : isOddDay
                          ? "bg-slate-50"
                          : undefined;

                    return (
                      <td
                        key={dateStr}
                        className={cn(
                          "px-1.5 py-2 border-b border-slate-100 border-r border-r-slate-200 align-top",
                          isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                          cellBg
                        )}
                      >
                        <div className="flex flex-wrap gap-1 min-h-[28px]">
                          {leaveType && (
                            <AbsenceBadge
                              period={leaveType}
                              isDoctor={collab.position === 1}
                              fullName={`${collab.firstname} ${collab.lastname}`}
                            />
                          )}
                          {dayAssignments.map((assignment, i) => (
                            <SiteBadge
                              key={i}
                              deptName={assignment.deptName}
                              period={assignment.period}
                              roleName={assignment.roleName}
                              blockType={assignment.blockType}
                              activityName={assignment.activityName}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SiteBadge({
  deptName,
  period,
  roleName,
  blockType,
  activityName,
}: {
  deptName: string;
  period: "AM" | "PM" | "FULL_DAY";
  roleName: string | null;
  blockType: string | null;
  activityName: string | null;
}) {
  const displayName = blockType === "SURGERY" && activityName
    ? activityName
    : deptName;

  const abbreviate = (name: string) => {
    if (name.length <= 10) return name;
    return name.slice(0, 9) + ".";
  };

  const isSurgery = blockType === "SURGERY";

  const periodLabel = period === "AM" ? "Matin" : period === "PM" ? "Après-midi" : "Journée";

  return (
    <div className="relative group/site">
      <div
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
          "border",
          "transition-all duration-150 cursor-default",
          isSurgery
            ? "bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
        )}
      >
        <span className={cn(
          "font-medium whitespace-nowrap",
          isSurgery ? "text-indigo-700" : "text-slate-700"
        )}>
          {abbreviate(displayName)}
        </span>
      </div>

      {/* Rich hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/site:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="font-semibold text-sm">{deptName}</div>
        {activityName && (
          <div className="text-indigo-300 mt-0.5">{activityName}</div>
        )}
        <div className="text-slate-300 mt-0.5">{periodLabel}</div>
        {roleName && (
          <div className="text-slate-400 mt-0.5">Rôle : {roleName}</div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

function AbsenceBadge({
  period,
  isDoctor,
  fullName,
}: {
  period: "AM" | "PM" | "FULL";
  isDoctor: boolean;
  fullName: string;
}) {
  const periodLabel = period === "FULL" ? "Journée" : period === "AM" ? "Matin" : "Après-midi";
  const positionLabel = isDoctor ? "Médecin" : "Secrétaire";
  return (
    <div className="relative group/abs">
      <div
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
          "border",
          "transition-all duration-150 cursor-default",
          isDoctor
            ? "bg-sky-50 border-sky-200 hover:bg-sky-100"
            : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
        )}
      >
        <span className={cn(
          "font-medium whitespace-nowrap",
          isDoctor ? "text-sky-700" : "text-emerald-700"
        )}>
          Absence
        </span>
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
