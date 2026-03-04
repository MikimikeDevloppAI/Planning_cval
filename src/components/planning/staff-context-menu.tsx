"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { useUpdateAssignmentStatus } from "@/hooks/use-assignments";
import { CancelAssignmentDialog } from "@/components/dialogs/cancel-assignment-dialog";
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
  period: "AM" | "PM";
  onClose: () => void;
}

export function StaffContextMenu({
  assignment,
  position,
  period,
  onClose,
}: StaffContextMenuProps) {
  const router = useRouter();
  const openAbsenceDialog = useAppStore((s) => s.openAbsenceDialog);
  const updateStatus = useUpdateAssignmentStatus();
  const ref = useRef<HTMLDivElement>(null);
  const [showCancel, setShowCancel] = useState(false);

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
            className: "text-destructive hover:bg-destructive/5",
            onClick: () => setShowCancel(true),
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
    <>
      {!showCancel && (
        <div ref={ref} style={style} className="min-w-[180px]">
          <div className="bg-card rounded-xl shadow-xl border border-border/50 py-1 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border/30">
              <p className="text-xs font-semibold text-muted-foreground truncate">
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
                    "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showCancel && (
        <CancelAssignmentDialog
          open
          onClose={() => {
            setShowCancel(false);
            onClose();
          }}
          staffName={`${assignment.firstname} ${assignment.lastname}`}
          staffType={assignment.assignment_type}
          assignmentId={assignment.id_assignment}
          staffId={assignment.id_staff}
          date=""
          period={period}
        />
      )}
    </>
  );
}
