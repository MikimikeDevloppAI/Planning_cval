"use client";

import { JOUR_LABELS } from "@/lib/constants";
import { Clock, RotateCcw } from "lucide-react";

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
  // All schedules are now RECURRING (entry_type column removed)
  const recurring = schedules;

  const periodLabel = (p: string) => {
    if (p === "AM") return "Matin";
    if (p === "PM") return "Après-midi";
    return "Journée complète";
  };

  const typeLabel = (t: string) => {
    if (t === "FIXED") return "Fixe";
    return "Disponible";
  };

  return (
    <div className="space-y-6">
      <h4 className="text-sm font-semibold text-foreground">
        Planning récurrent ({recurring.length} entrée{recurring.length !== 1 ? "s" : ""})
      </h4>

      {recurring.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Aucun planning défini</p>
        </div>
      )}

      {recurring.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Récurrent
            </p>
          </div>
          <div className="space-y-1">
            {recurring.map((s) => (
              <div
                key={s.id_schedule}
                className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-foreground w-24">
                  {s.day_of_week !== null
                    ? JOUR_LABELS[s.day_of_week] ?? `Jour ${s.day_of_week}`
                    : "—"}
                </span>
                <span className="text-muted-foreground w-28">{periodLabel(s.period)}</span>
                <span className="text-primary font-medium">
                  {s.departments?.name ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {typeLabel(s.schedule_type)}
                  {s.recurrence_types && ` · ${s.recurrence_types.name}`}
                  {s.week_offset !== null && s.week_offset > 0 && ` (sem. ${s.week_offset + 1})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
