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
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignmentEntry {
  id_assignment: number;
  assignment_type: string;
  id_role: number | null;
  status: string;
  work_blocks: {
    date: string;
    period: string;
    block_type: string;
    departments: { name: string } | null;
  } | null;
  secretary_roles: { name: string } | null;
}

interface LeaveEntry {
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
}

interface StaffCalendarProps {
  assignments: AssignmentEntry[];
  leaves: LeaveEntry[];
}

export function StaffCalendar({ assignments, leaves }: StaffCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Index assignments by date
  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, { am: AssignmentEntry[]; pm: AssignmentEntry[] }>();
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
    const map = new Map<string, { am: boolean; pm: boolean }>();
    for (const leave of leaves) {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      const leaveDays = eachDayOfInterval({ start, end });
      for (const d of leaveDays) {
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, { am: false, pm: false });
        const entry = map.get(key)!;
        if (!leave.period || leave.period === "AM") entry.am = true;
        if (!leave.period || leave.period === "PM") entry.pm = true;
      }
    }
    return map;
  }, [leaves]);

  const getRoleColor = (roleId: number | null, type: string) => {
    if (type === "DOCTOR") return "bg-[#aecbfa]";
    if (roleId === 1) return "bg-[#a8dab5]";
    if (roleId === 2) return "bg-[#f5a3ab]";
    if (roleId === 3) return "bg-[#f9cb80]";
    return "bg-muted-foreground/30";
  };

  const today = new Date();

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h4 className="text-sm font-semibold text-foreground capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </h4>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border/30 rounded-xl overflow-hidden">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          const dayAssignments = assignmentsByDate.get(dateStr);
          const dayLeaves = leavesByDate.get(dateStr);

          return (
            <div
              key={dateStr}
              className={cn(
                "bg-card min-h-[60px] p-1",
                !isCurrentMonth && "bg-muted/30"
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium mb-0.5 text-right",
                  isCurrentMonth ? "text-foreground" : "text-border",
                  isToday &&
                    "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center ml-auto"
                )}
              >
                {format(day, "d")}
              </div>

              {/* AM/PM slots */}
              <div className="space-y-0.5">
                {/* AM */}
                {(dayAssignments?.am.length || dayLeaves?.am) && (
                  <div className="flex items-center gap-0.5">
                    <span className="text-[8px] text-muted-foreground w-3">AM</span>
                    {dayLeaves?.am ? (
                      <div className="flex-1 h-3 bg-destructive/10 rounded-sm border border-destructive/20" />
                    ) : (
                      <div className="flex gap-0.5 flex-1">
                        {dayAssignments?.am.map((a) => (
                          <div
                            key={a.id_assignment}
                            className={cn(
                              "h-3 rounded-sm flex-1 max-w-[12px]",
                              getRoleColor(a.id_role, a.assignment_type)
                            )}
                            title={`${a.work_blocks?.departments?.name ?? ""} - ${a.secretary_roles?.name ?? a.assignment_type}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* PM */}
                {(dayAssignments?.pm.length || dayLeaves?.pm) && (
                  <div className="flex items-center gap-0.5">
                    <span className="text-[8px] text-muted-foreground w-3">PM</span>
                    {dayLeaves?.pm ? (
                      <div className="flex-1 h-3 bg-destructive/10 rounded-sm border border-destructive/20" />
                    ) : (
                      <div className="flex gap-0.5 flex-1">
                        {dayAssignments?.pm.map((a) => (
                          <div
                            key={a.id_assignment}
                            className={cn(
                              "h-3 rounded-sm flex-1 max-w-[12px]",
                              getRoleColor(a.id_role, a.assignment_type)
                            )}
                            title={`${a.work_blocks?.departments?.name ?? ""} - ${a.secretary_roles?.name ?? a.assignment_type}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#aecbfa]" />
          Médecin
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#a8dab5]" />
          Standard
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#f5a3ab]" />
          Fermeture
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#f9cb80]" />
          Aide ferm.
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-destructive/10 border border-destructive/20" />
          Absence
        </div>
      </div>
    </div>
  );
}
