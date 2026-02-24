"use client";

import { JOUR_LABELS } from "@/lib/constants";
import { Clock, Sun, Moon } from "lucide-react";

interface ScheduleEntry {
  id_schedule: number;
  schedule_type: string;
  day_of_week: number | null;
  period: string;
  week_offset: number | null;
  is_active: boolean;
  departments: { name: string } | null;
  recurrence_types: { name: string; cycle_weeks: number } | null;
}

interface StaffScheduleViewerProps {
  schedules: ScheduleEntry[];
}

export function StaffScheduleViewer({ schedules }: StaffScheduleViewerProps) {
  const recurring = schedules;

  if (recurring.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-2">
          <Clock className="w-6 h-6" />
        </div>
        <p className="text-sm">Aucun planning défini</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {recurring.map((s) => {
        const isAM = s.period === "AM";
        const isPM = s.period === "PM";
        const isFixed = s.schedule_type === "FIXED";

        return (
          <div
            key={s.id_schedule}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors group"
          >
            {/* Period icon */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: isAM ? "#eab30815" : isPM ? "#d9770615" : "#4A6FA510",
              }}
            >
              {isAM ? (
                <Sun className="w-3.5 h-3.5" style={{ color: "#eab308" }} />
              ) : isPM ? (
                <Moon className="w-3.5 h-3.5" style={{ color: "#d97706" }} />
              ) : (
                <Clock className="w-3.5 h-3.5 text-primary" />
              )}
            </div>

            {/* Day */}
            <span className="text-sm font-medium text-foreground w-16 shrink-0">
              {s.day_of_week !== null
                ? (JOUR_LABELS[s.day_of_week] ?? `J${s.day_of_week}`).slice(0, 3)
                : "—"}
            </span>

            {/* Period label */}
            <span className="text-xs text-muted-foreground w-8 shrink-0">
              {isAM ? "AM" : isPM ? "PM" : "JC"}
            </span>

            {/* Department */}
            <span className="text-sm font-medium text-primary truncate flex-1">
              {s.departments?.name ?? "—"}
            </span>

            {/* Type badge */}
            <span
              className="text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0"
              style={{
                backgroundColor: isFixed ? "#EEF3F9" : "#F0F5F3",
                color: isFixed ? "#4A6FA5" : "#6B8A7A",
              }}
            >
              {isFixed ? "Fixe" : "Dispo"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
