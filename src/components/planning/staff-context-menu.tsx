"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { useCancelAssignment, useUpdateAssignmentStatus } from "@/hooks/use-assignments";
import type { PlanningAssignment } from "@/lib/types/database";
import {
  UserCircle2,
  CalendarOff,
  Check,
  XCircle,
  Send,
} from "lucide-react";

interface StaffContextMenuProps {
  assignment: PlanningAssignment;
  position: { x: number; y: number };
  onClose: () => void;
}

export function StaffContextMenu({
  assignment,
  position,
  onClose,
}: StaffContextMenuProps) {
  const router = useRouter();
  const openAbsenceDialog = useAppStore((s) => s.openAbsenceDialog);
  const cancelAssignment = useCancelAssignment();
  const updateStatus = useUpdateAssignmentStatus();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const items = [
    {
      label: "Voir le profil",
      icon: UserCircle2,
      onClick: () => {
        router.push(`/staff/${assignment.id_staff}`);
        onClose();
      },
    },
    {
      label: "Déclarer absence",
      icon: CalendarOff,
      onClick: () => {
        openAbsenceDialog({ staffId: assignment.id_staff });
        onClose();
      },
    },
    ...(assignment.status === "PROPOSED"
      ? [
          {
            label: "Confirmer",
            icon: Check,
            onClick: () => {
              updateStatus.mutate({
                id_assignment: assignment.id_assignment,
                status: "CONFIRMED",
              });
              onClose();
            },
          },
        ]
      : []),
    ...(assignment.status === "CONFIRMED"
      ? [
          {
            label: "Publier",
            icon: Send,
            onClick: () => {
              updateStatus.mutate({
                id_assignment: assignment.id_assignment,
                status: "PUBLISHED",
              });
              onClose();
            },
          },
        ]
      : []),
    ...(assignment.status !== "CANCELLED" && assignment.status !== "INVALIDATED"
      ? [
          {
            label: "Annuler assignation",
            icon: XCircle,
            className: "text-red-600 hover:bg-red-50",
            onClick: () => {
              cancelAssignment.mutate({
                assignmentId: assignment.id_assignment,
              });
              onClose();
            },
          },
        ]
      : []),
  ];

  // Adjust position to keep menu on screen
  const style: React.CSSProperties = {
    position: "fixed",
    top: position.y,
    left: position.x,
    zIndex: 100,
  };

  return (
    <div ref={ref} style={style} className="min-w-[180px]">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 py-1 overflow-hidden">
        <div className="px-3 py-1.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 truncate">
            {assignment.firstname} {assignment.lastname}
          </p>
        </div>
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={item.onClick}
              className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm transition-colors ${
                (item as Record<string, unknown>).className ??
                "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
