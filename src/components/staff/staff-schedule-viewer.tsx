"use client";

import { JOUR_LABELS } from "@/lib/constants";
import { Clock, RotateCcw, Calendar } from "lucide-react";

interface ScheduleEntry {
  id_schedule: number;
  entry_type: string;
  schedule_type: string;
  day_of_week: number | null;
  period: string;
  specific_date: string | null;
  week_offset: number | null;
  is_active: boolean;
  departments: { name: string } | null;
  recurrence_types: { name: string; cycle_weeks: number } | null;
}

interface StaffScheduleViewerProps {
  schedules: ScheduleEntry[];
}

export function StaffScheduleViewer({ schedules }: StaffScheduleViewerProps) {
  const recurring = schedules.filter((s) => s.entry_type === "RECURRING");
  const overrides = schedules.filter((s) => s.entry_type === "OVERRIDE");
  const added = schedules.filter((s) => s.entry_type === "ADDED");

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
      <h4 className="text-sm font-semibold text-gray-700">
        Planning récurrent ({schedules.length} entrée{schedules.length !== 1 ? "s" : ""})
      </h4>

      {schedules.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Aucun planning défini</p>
        </div>
      )}

      {/* Recurring schedules */}
      {recurring.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Récurrent
            </p>
          </div>
          <div className="space-y-1">
            {recurring.map((s) => (
              <div
                key={s.id_schedule}
                className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-gray-800 w-24">
                  {s.day_of_week !== null
                    ? JOUR_LABELS[s.day_of_week] ?? `Jour ${s.day_of_week}`
                    : "—"}
                </span>
                <span className="text-gray-600 w-28">{periodLabel(s.period)}</span>
                <span className="text-blue-700 font-medium">
                  {s.departments?.name ?? "—"}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {typeLabel(s.schedule_type)}
                  {s.recurrence_types && ` · ${s.recurrence_types.name}`}
                  {s.week_offset !== null && s.week_offset > 0 && ` (sem. ${s.week_offset + 1})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overrides */}
      {overrides.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Exceptions
            </p>
          </div>
          <div className="space-y-1">
            {overrides.map((s) => (
              <div
                key={s.id_schedule}
                className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-gray-800 w-24">
                  {s.specific_date ?? "—"}
                </span>
                <span className="text-gray-600 w-28">{periodLabel(s.period)}</span>
                <span className="text-amber-700 font-medium">
                  {s.departments?.name ?? "Absent"}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {typeLabel(s.schedule_type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Added */}
      {added.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-green-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ajouts ponctuels
            </p>
          </div>
          <div className="space-y-1">
            {added.map((s) => (
              <div
                key={s.id_schedule}
                className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-gray-800 w-24">
                  {s.specific_date ?? "—"}
                </span>
                <span className="text-gray-600 w-28">{periodLabel(s.period)}</span>
                <span className="text-green-700 font-medium">
                  {s.departments?.name ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
