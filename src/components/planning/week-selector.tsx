"use client";

import { useAppStore } from "@/store/use-app-store";
import { formatWeekRange, startOfISOWeek } from "@/lib/utils/dates";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

export function WeekSelector() {
  const weekStart = useAppStore((s) => s.weekStart);
  const setWeek = useAppStore((s) => s.setWeek);
  const nextWeek = useAppStore((s) => s.nextWeek);
  const prevWeek = useAppStore((s) => s.prevWeek);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prevWeek}
        className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
        title="Semaine précédente"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>

      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 bg-white min-w-[260px] justify-center">
        <CalendarDays className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 capitalize">
          {formatWeekRange(weekStart)}
        </span>
      </div>

      <button
        onClick={nextWeek}
        className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
        title="Semaine suivante"
      >
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>

      <button
        onClick={() => setWeek(startOfISOWeek(new Date()))}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-gray-600 transition-colors"
      >
        Aujourd&apos;hui
      </button>
    </div>
  );
}
