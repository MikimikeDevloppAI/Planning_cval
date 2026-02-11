"use client";

import { useState, useCallback } from "react";
import { DndContext, type DragEndEvent, type DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useAppStore } from "@/store/use-app-store";
import { getWeekDays, formatDayShort } from "@/lib/utils/dates";
import { SiteGroup } from "./site-group";
import { PlanningToolbar } from "./planning-toolbar";
import { PlanningLegend } from "./planning-legend";
import { PlanningStats } from "./planning-stats";
import { DragOverlay } from "./drag-overlay";
import { usePlanningData } from "@/hooks/use-planning-data";
import { useMoveAssignment } from "@/hooks/use-assignments";
import type { DragItemData } from "./staff-chip";
import type { DropTargetData } from "./period-section";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";

export function PlanningGrid() {
  const weekStart = useAppStore((s) => s.weekStart);
  const { data, isLoading, error } = usePlanningData();
  const weekDays = getWeekDays(weekStart);
  const moveAssignment = useMoveAssignment();

  const [activeDrag, setActiveDrag] = useState<{
    assignment: DragItemData["assignment"];
    blockType: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragData = event.active.data.current as DragItemData | undefined;
    if (dragData) {
      setActiveDrag({
        assignment: dragData.assignment,
        blockType: dragData.blockType,
      });
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);

      const dragData = event.active.data.current as DragItemData | undefined;
      const dropData = event.over?.data.current as DropTargetData | undefined;

      if (!dragData || !dropData) return;

      // Don't move to same block
      if (dragData.blockId === dropData.blockId) return;

      // Execute the move mutation
      moveAssignment.mutate({
        oldAssignmentId: dragData.assignment.id_assignment,
        targetBlockId: dropData.blockId,
        staffId: dragData.assignment.id_staff,
        assignmentType: dragData.assignment.assignment_type,
        roleId: dragData.assignment.id_role,
        skillId: dragData.assignment.id_skill,
      });
    },
    [moveAssignment]
  );

  return (
    <div>
      <PlanningToolbar />
      <PlanningLegend />

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement du planning...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Erreur: {error.message}
        </div>
      )}

      {data && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <PlanningStats stats={data.stats} />

          {/* Column headers (days) */}
          <div className="flex mb-2">
            <div className="w-40 min-w-[160px] shrink-0" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className="flex-1 min-w-[140px] text-center"
              >
                <div className="text-xs font-semibold text-gray-700 capitalize">
                  {format(day, "EEEE", { locale: fr })}
                </div>
                <div className="text-[10px] text-gray-400">
                  {formatDayShort(day)}
                </div>
              </div>
            ))}
          </div>

          {/* Sites */}
          <div className="space-y-3">
            {data.sites.map((site) => (
              <SiteGroup key={site.id_site} site={site} />
            ))}
          </div>

          {data.sites.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Aucune donnée pour cette semaine
            </div>
          )}

          <DragOverlay activeData={activeDrag} />
        </DndContext>
      )}
    </div>
  );
}
