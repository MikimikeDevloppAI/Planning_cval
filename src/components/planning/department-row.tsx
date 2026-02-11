import { DayCell } from "./day-cell";
import type { PlanningDepartment } from "@/lib/types/database";

interface DepartmentRowProps {
  department: PlanningDepartment;
}

export function DepartmentRow({ department }: DepartmentRowProps) {
  return (
    <div className="flex border-b border-gray-200 last:border-b-0">
      {/* Department name label */}
      <div className="w-40 min-w-[160px] shrink-0 border-r border-gray-200 px-3 py-2 flex items-start">
        <div>
          <span className="text-sm font-semibold text-gray-700 leading-tight">
            {department.name}
          </span>
          <div className="flex gap-1 mt-0.5">
            <span className="text-[9px] text-gray-400 uppercase">AM</span>
            <span className="text-[9px] text-gray-300">/</span>
            <span className="text-[9px] text-gray-400 uppercase">PM</span>
          </div>
        </div>
      </div>

      {/* Day cells */}
      {department.days.map((day) => (
        <DayCell key={day.date} day={day} departmentId={department.id_department} />
      ))}
    </div>
  );
}
