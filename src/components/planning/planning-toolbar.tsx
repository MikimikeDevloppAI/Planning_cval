"use client";

import { useAppStore } from "@/store/use-app-store";
import { RefreshCw, UserX } from "lucide-react";
import { WeekSelector } from "./week-selector";

export function PlanningToolbar() {
  const openAbsence = useAppStore((s) => s.openAbsenceDialog);
  const openSolver = useAppStore((s) => s.openSolverDialog);

  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <WeekSelector />

      <div className="flex items-center gap-2">
        <button
          onClick={() => openAbsence()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
        >
          <UserX className="w-4 h-4" />
          Déclarer absence
        </button>
        <button
          onClick={openSolver}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Replanifier
        </button>
      </div>
    </div>
  );
}
