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

/** Role id → short tag (role 1 = Standard, no tag) */
const ROLE_TAG: Record<number, string> = {
  2: "1f",
  3: "2f",
};

/** Abbreviate known site names */
const SITE_ABBREV: Record<string, string> = {
  "clinique la vallée": "CVAL",
  "porrentruy": "PTY",
};

function abbreviateSite(name: string): string {
  const key = name.toLowerCase().trim();
  if (SITE_ABBREV[key]) return SITE_ABBREV[key];
  // Fallback: first 4 chars uppercase
  return name.slice(0, 4).toUpperCase();
}

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
  roleId: number | null;
  blockType: string | null;
  activityName: string | null;
  assignmentType: string;
}

interface CollaborateurData {
  id_staff: number;
  firstname: string;
  lastname: string;
  position: number;
  days: Map<string, PersonDay[]>;
}

const periodLabels: Record<string, string> = {
  AM: "Matin",
  PM: "Après-midi",
  FULL_DAY: "Journée",
  FULL: "Journée",
};

export function CollaborateursTableView({
  days,
  sites,
  leaves = [],
}: CollaborateursTableViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterType>("tous");

  // Build a lookup: staffId → Map of date → leave period
  const leaveIndex = useMemo(() => {
    const index = new Map<number, Map<string, "AM" | "PM" | "FULL">>();
    for (const leave of leaves) {
      if (!index.has(leave.id_staff)) index.set(leave.id_staff, new Map());
      const staffLeaves = index.get(leave.id_staff)!;
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
                  roleId: a.id_role,
                  blockType: block.block_type ?? null,
                  activityName: block.activity_name ?? null,
                  assignmentType: a.assignment_type,
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
                      "px-1 py-2 text-center min-w-[150px] border-b border-r-2 border-r-slate-300",
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
                          "px-1 py-1.5 border-b border-slate-100 border-r-2 border-r-slate-300 align-top",
                          isMon && dayIdx > 0 && "border-l-[6px] border-l-indigo-400",
                          cellBg
                        )}
                      >
                        <div className="grid grid-cols-2 gap-0.5 min-h-[28px]">
                          {leaveType && (
                            <AbsenceBadge
                              period={leaveType}
                              isDoctor={isDoc}
                              fullName={`${collab.firstname} ${collab.lastname}`}
                            />
                          )}
                          {dayAssignments.map((assignment, i) => (
                            <DeptBadge
                              key={i}
                              siteName={assignment.siteName}
                              deptName={assignment.deptName}
                              period={assignment.period}
                              roleName={assignment.roleName}
                              roleId={assignment.roleId}
                              blockType={assignment.blockType}
                              activityName={assignment.activityName}
                              assignmentType={assignment.assignmentType}
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

// ─── Sub-components ──────────────────────────────────────

/** Abbreviate dept name to keep badges compact */
function abbreviateDept(name: string): string {
  if (name.length <= 8) return name;
  return name.slice(0, 7) + ".";
}

const PERIOD_COLORS = {
  AM: "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100",
  PM: "bg-violet-50 border-violet-300 text-violet-900 hover:bg-violet-100",
  FULL_DAY: "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100",
};

function DeptBadge({
  siteName,
  deptName,
  period,
  roleName,
  roleId,
  blockType,
  activityName,
}: {
  siteName: string;
  deptName: string;
  period: "AM" | "PM" | "FULL_DAY";
  roleName: string | null;
  roleId: number | null;
  blockType: string | null;
  activityName: string | null;
  assignmentType: string;
}) {
  const isSurgery = blockType === "SURGERY";
  const roleTag = roleId ? ROLE_TAG[roleId] : undefined;
  const siteAbbrev = abbreviateSite(siteName);
  const deptAbbrev = abbreviateDept(deptName);

  const colors = isSurgery
    ? "bg-indigo-50 border-indigo-300 text-indigo-900 hover:bg-indigo-100"
    : PERIOD_COLORS[period];

  return (
    <div className="relative group/dept">
      <div
        className={cn(
          "inline-flex flex-col items-center justify-center min-w-[52px] rounded-md px-1.5 py-0.5",
          "border transition-all duration-150 cursor-default",
          colors
        )}
      >
        <span className="text-[10px] font-bold leading-tight">{siteAbbrev}</span>
        <span className="text-[9px] font-medium leading-tight opacity-70">
          {deptAbbrev}
          {roleTag && <span className="ml-0.5 font-bold">{roleTag}</span>}
        </span>
      </div>

      {/* Rich hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/dept:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="font-semibold text-sm">{siteName}</div>
        <div className="text-slate-300 mt-0.5">{deptName}</div>
        {isSurgery && activityName && (
          <div className="text-indigo-300 mt-0.5">{activityName}</div>
        )}
        <div className="text-slate-300 mt-0.5">{periodLabels[period]}</div>
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
  const positionLabel = isDoctor ? "Médecin" : "Secrétaire";

  return (
    <div className="relative group/abs">
      <div
        className={cn(
          "inline-flex flex-col items-center justify-center min-w-[52px] rounded-md px-1.5 py-0.5",
          "border transition-all duration-150 cursor-default",
          "bg-red-50 border-red-300 text-red-700 hover:bg-red-100",
        )}
      >
        <span className="text-[10px] font-bold leading-tight">ABS</span>
        <span className="text-[9px] font-medium leading-tight opacity-70">
          {periodLabels[period]}
        </span>
      </div>

      {/* Rich hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/abs:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="font-semibold text-sm">{fullName}</div>
        <div className="text-slate-300 mt-0.5">{positionLabel}</div>
        <div className="flex items-center gap-1.5 mt-1 text-red-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Absent(e) — {periodLabels[period]}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}
