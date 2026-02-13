"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { format, isToday, isMonday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/initials";
import { POSITION_LABELS } from "@/lib/constants";
import type { PlanningSite, PlanningAssignment } from "@/lib/types/database";

type FilterType = "tous" | "medecins" | "secretaires";

/** Fixed width for the first column */
const COL1 = "w-[200px] min-w-[200px] max-w-[200px]";

/** Border-left for week separators */
function weekSepStyle(isWkStart: boolean, isFirstCol: boolean): React.CSSProperties | undefined {
  if (isWkStart && !isFirstCol) {
    return { borderLeft: "2px solid rgb(203 213 225)" };
  }
  return undefined;
}

/** Role id → short tag */
const ROLE_TAG: Record<number, string> = { 2: "1f", 3: "2f" };

/** Abbreviate known site names */
const SITE_ABBREV: Record<string, string> = {
  "clinique la vallée": "CVAL",
  "porrentruy": "PTY",
};

function abbreviateSite(name: string): string {
  return SITE_ABBREV[name.toLowerCase().trim()] ?? name.slice(0, 4).toUpperCase();
}

function abbreviateDept(name: string): string {
  return name.length <= 10 ? name : name.slice(0, 9) + ".";
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

const PERIOD_ORDER: Record<string, number> = { AM: 0, FULL_DAY: 1, PM: 2 };

export function CollaborateursTableView({
  days,
  sites,
  leaves = [],
}: CollaborateursTableViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterType>("tous");
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const toggleHighlight = useCallback((id: number) => {
    setHighlightedId((prev) => (prev === id ? null : id));
  }, []);

  // Build leave lookup: staffId → Map<date, period>
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
            // keep
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
      // Skip Bloc Opératoire virtual site (Oculoplastie, Sédation, etc.)
      if (site.id_site === -1) continue;

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
              if (!collab.days.has(day.date)) collab.days.set(day.date, []);

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

          for (const block of day.am.blocks) processBlock(block, "AM");
          for (const block of day.pm.blocks) processBlock(block, "PM");
        }
      }
    }

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
    if (filter === "medecins") return collaborateurs.filter((c) => c.position === 1);
    return collaborateurs.filter((c) => c.position === 2);
  }, [collaborateurs, filter]);

  const weekStartSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < days.length; i++) {
      const date = parseISO(days[i]);
      if (isMonday(date) || i === 0) set.add(days[i]);
    }
    return set;
  }, [days]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayIndex = days.indexOf(todayStr);
    if (todayIndex >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, (todayIndex - 2) * 130);
    }
  }, [days]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100/60 rounded-xl shrink-0">
        {(["tous", "medecins", "secretaires"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
              filter === f
                ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            {f === "tous" ? "Tous" : f === "medecins" ? "Médecins" : "Secrétaires"}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-auto tabular-nums font-medium px-2">
          {filteredCollabs.length} collaborateur{filteredCollabs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="overflow-auto flex-1 max-h-full rounded-xl border border-slate-200 bg-white shadow-md"
      >
        <table className="border-collapse w-max">
          <thead className="sticky top-0 z-30">
            <tr>
              <th className={cn(
                "sticky left-0 z-40 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left",
                COL1
              )}>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Collaborateur
                </span>
              </th>
              {days.map((dateStr, dayIdx) => {
                const date = parseISO(dateStr);
                const isWkStart = weekStartSet.has(dateStr);
                const today = isToday(date);

                return (
                  <th
                    key={dateStr}
                    className={cn(
                      "px-1 py-2 text-center min-w-[130px] border-b border-r border-slate-200 bg-white",
                      today && "bg-sky-50 border-b-2 border-b-sky-400"
                    )}
                    style={weekSepStyle(isWkStart, dayIdx === 0)}
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
            {filteredCollabs.map((collab, collabIdx) => {
              const isDoc = collab.position === 1;
              const isHighlighted = highlightedId === collab.id_staff;
              const isEvenRow = collabIdx % 2 === 0;
              const rowBg = isEvenRow ? "bg-white" : "bg-slate-50";

              return (
                <tr
                  key={collab.id_staff}
                  onClick={() => toggleHighlight(collab.id_staff)}
                  className={cn(
                    "border-b border-slate-200 cursor-pointer transition-colors duration-150",
                    isHighlighted
                      ? "bg-primary/[0.06]"
                      : rowBg
                  )}
                >
                  <td className={cn(
                    "sticky left-0 z-10 border-r border-slate-200 px-3 py-1.5",
                    COL1,
                    isHighlighted
                      ? "bg-primary/[0.06] border-l-2 border-l-primary"
                      : rowBg
                  )}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold shrink-0",
                          isDoc
                            ? "bg-sky-100 text-sky-700"
                            : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {getInitials(collab.firstname, collab.lastname)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-slate-700 truncate">
                          {collab.lastname} {collab.firstname}
                        </div>
                        <div className="text-[9px] text-slate-400 leading-none">
                          {POSITION_LABELS[collab.position] ?? "Autre"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {days.map((dateStr, dayIdx) => {
                    const date = parseISO(dateStr);
                    const isWkStart = weekStartSet.has(dateStr);
                    const today = isToday(date);
                    const dayAssignments = collab.days.get(dateStr) ?? [];
                    const leaveType = leaveIndex.get(collab.id_staff)?.get(dateStr);

                    const sorted = [...dayAssignments].sort(
                      (a, b) => (PERIOD_ORDER[a.period] ?? 1) - (PERIOD_ORDER[b.period] ?? 1)
                    );

                    return (
                      <td
                        key={dateStr}
                        className={cn(
                          "px-1 py-1 align-top border-b border-r border-slate-200 min-w-[130px]",
                          leaveType === "FULL" && "bg-red-50/40",
                          today && !leaveType && "bg-sky-50/30"
                        )}
                        style={weekSepStyle(isWkStart, dayIdx === 0)}
                      >
                        <div className="flex flex-col gap-0.5 min-h-[28px]">
                          {leaveType && (
                            <Badge
                              label="ABS"
                              sub={periodLabels[leaveType]}
                              variant="absence"
                              period={leaveType === "FULL" ? "FULL_DAY" : leaveType}
                              tooltip={
                                <div>
                                  <div className="font-semibold text-sm">{collab.firstname} {collab.lastname}</div>
                                  <div className="text-slate-300 mt-0.5">{isDoc ? "Médecin" : "Secrétaire"}</div>
                                  <div className="flex items-center gap-1.5 mt-1 text-red-300 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    Absent(e) — {periodLabels[leaveType]}
                                  </div>
                                </div>
                              }
                            />
                          )}
                          {sorted.map((a, i) => {
                            const roleTag = a.roleId ? ROLE_TAG[a.roleId] : undefined;
                            const variant: BadgeVariant =
                              a.assignmentType === "DOCTOR"
                                ? "doctor"
                                : a.blockType === "ADMIN"
                                  ? "admin"
                                  : "secretary";

                            return (
                              <Badge
                                key={i}
                                label={abbreviateSite(a.siteName)}
                                sub={abbreviateDept(a.deptName)}
                                tag={roleTag}
                                variant={variant}
                                period={a.period}
                                tooltip={
                                  <div>
                                    <div className="font-semibold text-sm">{collab.firstname} {collab.lastname}</div>
                                    <div className="text-slate-300 mt-0.5">{a.siteName}</div>
                                    <div className="text-slate-400 mt-0.5">{a.deptName}</div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {(a.period === "AM" || a.period === "FULL_DAY") && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                      )}
                                      {(a.period === "PM" || a.period === "FULL_DAY") && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      )}
                                      <span className="text-slate-300">{periodLabels[a.period]}</span>
                                    </div>
                                    {a.roleName && (
                                      <div className="text-slate-400 mt-0.5 text-[10px]">
                                        Rôle : {a.roleName}
                                      </div>
                                    )}
                                  </div>
                                }
                              />
                            );
                          })}
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

// ─── Badge component ──────────────────────────────────────

type BadgeVariant = "doctor" | "secretary" | "admin" | "absence";

const VARIANT_STYLES: Record<BadgeVariant, { base: string }> = {
  doctor: {
    base: "chip-doctor text-slate-700",
  },
  secretary: {
    base: "chip-secretary text-slate-700",
  },
  admin: {
    base: "chip-secretary text-slate-700",
  },
  absence: {
    base: "chip-absence text-rose-400",
  },
};

function Badge({
  label,
  sub,
  tag,
  variant = "admin",
  period,
  tooltip,
}: {
  label: string;
  sub: string;
  tag?: string;
  variant?: BadgeVariant;
  period: "AM" | "PM" | "FULL_DAY";
  tooltip: React.ReactNode;
}) {
  const isAM = period === "AM";
  const isPM = period === "PM";
  const isFullDay = period === "FULL_DAY";
  const styles = VARIANT_STYLES[variant];

  return (
    <div className="relative group/badge">
      <div
        className={cn(
          "relative flex items-center gap-1 h-6 rounded-lg overflow-hidden",
          "text-[10px] font-semibold leading-none",
          "transition-all duration-200",
          styles.base,
          isFullDay ? "w-full px-2" : "w-[110px]",
          isAM && "pl-2.5 pr-1.5",
          isPM && "pl-1.5 pr-2.5",
        )}
      >
        {isAM && (
          <span className="absolute left-0 top-1 bottom-1 w-[2.5px] rounded-r-full bg-blue-400/60" />
        )}
        {isPM && (
          <span className="absolute right-0 top-1 bottom-1 w-[2.5px] rounded-l-full bg-amber-400/60" />
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
