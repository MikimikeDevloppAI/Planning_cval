"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatNameShort } from "@/lib/utils/initials";
import { getRoleColors, getStatusBorder } from "@/lib/utils/colors";
import { StaffAvatar } from "./staff-avatar";
import { RoleBadge } from "./role-badge";
import { StaffContextMenu } from "./staff-context-menu";
import { useDraggable } from "@dnd-kit/core";
import type { PlanningAssignment } from "@/lib/types/database";

export interface DragItemData {
  assignment: PlanningAssignment;
  blockId: number;
  blockType: string;
}

interface StaffChipProps {
  assignment: PlanningAssignment;
  blockId: number;
  blockType?: string;
  isFullDay?: boolean;
  draggable?: boolean;
}

export function StaffChip({
  assignment,
  blockId,
  blockType,
  isFullDay,
  draggable = true,
}: StaffChipProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const colors = getRoleColors(
    assignment.assignment_type,
    assignment.id_role,
    blockType
  );
  const statusBorder = getStatusBorder(assignment.status);

  const dragData: DragItemData = {
    assignment,
    blockId,
    blockType: blockType ?? "CONSULTATION",
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment-${assignment.id_assignment}`,
    data: dragData,
    disabled: !draggable,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onContextMenu={handleContextMenu}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs border select-none transition-opacity",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          colors.bg,
          colors.border,
          colors.text,
          statusBorder,
          isFullDay && "ring-1 ring-offset-1 ring-current/30",
          isDragging && "opacity-30"
        )}
      >
        <StaffAvatar
          firstname={assignment.firstname}
          lastname={assignment.lastname}
          colorClass={colors.avatar}
        />
        <span className="font-medium truncate max-w-[80px]">
          {formatNameShort(assignment.firstname, assignment.lastname)}
        </span>
        {assignment.assignment_type === "SECRETARY" && (
          <RoleBadge roleName={assignment.role_name} />
        )}
      </div>
      {contextMenu && (
        <StaffContextMenu
          assignment={assignment}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
