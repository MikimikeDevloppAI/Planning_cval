"use client";

import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { StaffChip } from "./staff-chip";
import { GapIndicator } from "./gap-indicator";
import type { PlanningPeriod, PlanningAssignment } from "@/lib/types/database";

export interface DropTargetData {
  blockId: number;
  departmentId: number;
  date: string;
  period: "AM" | "PM";
}

interface PeriodSectionProps {
  period: "AM" | "PM";
  data: PlanningPeriod;
  departmentId: number;
  date: string;
  fullDayStaffIds?: Set<number>;
}

export function PeriodSection({
  period,
  data,
  departmentId,
  date,
  fullDayStaffIds,
}: PeriodSectionProps) {
  const primaryBlockId = data.blocks[0]?.id_block ?? 0;

  const dropData: DropTargetData = {
    blockId: primaryBlockId,
    departmentId,
    date,
    period,
  };

  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${departmentId}-${date}-${period}`,
    data: dropData,
    disabled: primaryBlockId === 0,
  });

  // Collect all assignments from all blocks
  const allAssignments: Array<{
    assignment: PlanningAssignment;
    blockId: number;
    blockType: string;
  }> = [];
  for (const block of data.blocks) {
    for (const a of block.assignments) {
      allAssignments.push({
        assignment: a,
        blockId: block.id_block,
        blockType: block.block_type,
      });
    }
  }

  // Sort: doctors first, then secretaries
  allAssignments.sort((a, b) => {
    if (a.assignment.assignment_type !== b.assignment.assignment_type) {
      return a.assignment.assignment_type === "DOCTOR" ? -1 : 1;
    }
    return a.assignment.lastname.localeCompare(b.assignment.lastname);
  });

  const hasGaps = data.needs.length > 0;
  const isEmpty = allAssignments.length === 0 && !hasGaps;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[28px] flex flex-wrap items-start gap-0.5 px-1 py-0.5 transition-colors",
        hasGaps && "bg-red-50/40",
        isOver && "bg-blue-100/60 ring-1 ring-inset ring-blue-400",
        isEmpty && "flex items-center"
      )}
    >
      {isEmpty ? (
        <span className="text-[10px] text-gray-300">&mdash;</span>
      ) : (
        <>
          {allAssignments.map(({ assignment, blockId, blockType }) => (
            <StaffChip
              key={assignment.id_assignment}
              assignment={assignment}
              blockId={blockId}
              blockType={blockType}
              isFullDay={fullDayStaffIds?.has(assignment.id_staff)}
            />
          ))}
          {data.needs.map((need, i) => (
            <GapIndicator key={`gap-${i}`} need={need} />
          ))}
        </>
      )}
    </div>
  );
}
