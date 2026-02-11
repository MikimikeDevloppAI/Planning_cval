import { PeriodSection } from "./period-section";
import type { PlanningDay } from "@/lib/types/database";

interface DayCellProps {
  day: PlanningDay;
  departmentId: number;
}

export function DayCell({ day, departmentId }: DayCellProps) {
  // Detect full-day staff (same person in both AM and PM)
  const amStaffIds = new Set(
    day.am.blocks.flatMap((b) => b.assignments.map((a) => a.id_staff))
  );
  const pmStaffIds = new Set(
    day.pm.blocks.flatMap((b) => b.assignments.map((a) => a.id_staff))
  );
  const fullDayStaffIds = new Set(
    [...amStaffIds].filter((id) => pmStaffIds.has(id))
  );

  return (
    <div className="border-r border-gray-100 last:border-r-0 min-w-[140px] flex-1">
      {/* AM */}
      <div className="border-b border-gray-100">
        <PeriodSection
          period="AM"
          data={day.am}
          departmentId={departmentId}
          date={day.date}
          fullDayStaffIds={fullDayStaffIds}
        />
      </div>
      {/* PM */}
      <PeriodSection
        period="PM"
        data={day.pm}
        departmentId={departmentId}
        date={day.date}
        fullDayStaffIds={fullDayStaffIds}
      />
    </div>
  );
}
