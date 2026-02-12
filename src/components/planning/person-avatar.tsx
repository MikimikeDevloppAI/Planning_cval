"use client";

import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";

export interface PersonAvatarDragData {
  personId: number;
  personType: "doctor" | "secretary";
  personName: string;
  date: string;
  sourceDeptId: number;
  sourceDeptName: string;
  period: "AM" | "PM" | "FULL_DAY";
  assignmentId?: number;
  roleId?: number;
  skillId?: number;
}

interface PersonAvatarProps {
  personId: number;
  personType: "doctor" | "secretary";
  initials: string;
  fullName: string;
  period: "AM" | "PM" | "FULL_DAY";
  roleTag?: string;
  // Drag data
  date: string;
  sourceDeptId: number;
  sourceDeptName: string;
  assignmentId?: number;
  roleId?: number;
  skillId?: number;
  // Callbacks
  onClick?: (e: React.MouseEvent) => void;
  draggable?: boolean;
}

const periodBorder: Record<string, string> = {
  AM: "",
  PM: "",
  FULL_DAY: "",
};

const periodLabels: Record<string, string> = {
  AM: "Matin",
  PM: "Après-midi",
  FULL_DAY: "Journée",
};

export function PersonAvatar({
  personId,
  personType,
  initials,
  fullName,
  period,
  roleTag,
  date,
  sourceDeptId,
  sourceDeptName,
  assignmentId,
  roleId,
  skillId,
  onClick,
  draggable = true,
}: PersonAvatarProps) {
  const dragData: PersonAvatarDragData = {
    personId,
    personType,
    personName: fullName,
    date,
    sourceDeptId,
    sourceDeptName,
    period,
    assignmentId,
    roleId,
    skillId,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `person-${personId}-${date}-${period}`,
    data: dragData,
    disabled: !draggable,
  });

  const isDoc = personType === "doctor";

  return (
    <div className="relative group/avatar">
      <button
        ref={setNodeRef}
        {...(draggable ? listeners : {})}
        {...(draggable ? attributes : {})}
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center gap-1 h-7 min-w-[52px] rounded-md px-1.5",
          "text-xs font-semibold leading-none",
          "transition-all duration-150",
          "focus:outline-none",
          periodBorder[period],
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          isDoc
            ? "bg-sky-50 border border-sky-400 text-sky-900 hover:bg-sky-100"
            : "bg-emerald-50 border border-emerald-400 text-emerald-900 hover:bg-emerald-100",
          isDragging && "opacity-40 scale-95"
        )}
      >
        <span>{initials}</span>
        {roleTag && (
          <span className="text-[10px] font-bold text-current/70">
            {roleTag}
          </span>
        )}
      </button>

      {/* Rich hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/avatar:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="font-semibold text-sm">{fullName}</div>
        <div className="text-slate-300 mt-0.5">{isDoc ? "Médecin" : "Secrétaire"}</div>
        <div className="text-slate-300 mt-0.5">{sourceDeptName} — {periodLabels[period]}</div>
        {roleTag && (
          <div className="text-slate-400 mt-0.5">Rôle : {roleTag}</div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

/**
 * Non-draggable avatar for use outside DndContext (e.g., collaborateurs view)
 */
export function StaticPersonAvatar({
  personType,
  initials,
  fullName,
  period,
  roleTag,
  onClick,
}: {
  personType: "doctor" | "secretary";
  initials: string;
  fullName: string;
  period: "AM" | "PM" | "FULL_DAY";
  roleTag?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const isDoc = personType === "doctor";

  return (
    <div className="relative group/avatar">
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center gap-1 h-7 min-w-[52px] rounded-md px-1.5",
          "text-xs font-semibold leading-none",
          "transition-all duration-150",
          "focus:outline-none cursor-default",
          periodBorder[period],
          isDoc
            ? "bg-sky-50 border border-sky-400 text-sky-900 hover:bg-sky-100"
            : "bg-emerald-50 border border-emerald-400 text-emerald-900 hover:bg-emerald-100",
        )}
      >
        <span>{initials}</span>
        {roleTag && (
          <span className="text-[10px] font-bold text-current/70">
            {roleTag}
          </span>
        )}
      </button>

      {/* Rich hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/avatar:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="font-semibold text-sm">{fullName}</div>
        <div className="text-slate-300 mt-0.5">{isDoc ? "Médecin" : "Secrétaire"}</div>
        <div className="text-slate-300 mt-0.5">{periodLabels[period]}</div>
        {roleTag && (
          <div className="text-slate-400 mt-0.5">Rôle : {roleTag}</div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}
