"use client";

import { DragOverlay as DndDragOverlay } from "@dnd-kit/core";
import { StaffChip } from "./staff-chip";
import type { PlanningAssignment } from "@/lib/types/database";

interface DragOverlayProps {
  activeData: {
    assignment: PlanningAssignment;
    blockType: string;
  } | null;
}

export function DragOverlay({ activeData }: DragOverlayProps) {
  return (
    <DndDragOverlay dropAnimation={null}>
      {activeData && (
        <div className="opacity-90 shadow-lg rounded-md">
          <StaffChip
            assignment={activeData.assignment}
            blockId={0}
            blockType={activeData.blockType}
            draggable={false}
          />
        </div>
      )}
    </DndDragOverlay>
  );
}
