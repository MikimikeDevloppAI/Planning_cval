"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle2, CalendarOff, XCircle } from "lucide-react";
import { DropdownMenu, type DropdownMenuSection } from "@/components/ui/dropdown-menu";
import { QuickAbsenceDialog } from "@/components/dialogs/quick-absence-dialog";
import { CancelAssignmentDialog } from "@/components/dialogs/cancel-assignment-dialog";

interface AssignmentActionMenuProps {
  open: boolean;
  anchor: DOMRect | null;
  onClose: () => void;
  staffId: number;
  staffName: string;
  staffType: "DOCTOR" | "SECRETARY";
  date: string;
  period: "AM" | "PM" | "FULL_DAY";
  assignmentId: number;
  pmAssignmentId?: number;
  /** Show "Voir le profil" link */
  showProfile?: boolean;
  /** Callback after cancel/absence action (e.g. invalidate extra queries) */
  onAfterAction?: () => void;
}

export function AssignmentActionMenu({
  open,
  anchor,
  onClose,
  staffId,
  staffName,
  staffType,
  date,
  period,
  assignmentId,
  pmAssignmentId,
  showProfile = false,
  onAfterAction,
}: AssignmentActionMenuProps) {
  const router = useRouter();
  const [showAbsence, setShowAbsence] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Snapshot date/period when user clicks "Déclarer absence" so the values
  // survive the DropdownMenu's onClose clearing the parent actionMenu state
  const absenceRef = useRef({ date: "", period: "AM" as "AM" | "PM" | "FULL" });

  const absencePeriod = period === "FULL_DAY" ? "FULL" : period;

  const sections: DropdownMenuSection[] = [];

  // Main actions
  const mainItems = [];
  if (showProfile) {
    mainItems.push({
      label: "Voir le profil",
      icon: UserCircle2,
      onClick: () => router.push(`/staff/${staffId}`),
    });
  }
  mainItems.push({
    label: "Déclarer absence",
    icon: CalendarOff,
    onClick: () => {
      absenceRef.current = { date, period: absencePeriod };
      setShowAbsence(true);
    },
  });
  sections.push({ items: mainItems });

  // Danger section
  sections.push({
    items: [
      {
        label: "Annuler assignation",
        icon: XCircle,
        variant: "danger" as const,
        onClick: () => setShowCancel(true),
      },
    ],
  });

  return (
    <>
      <DropdownMenu
        sections={sections}
        header={
          <p className="text-[13px] font-semibold text-slate-800 truncate">
            {staffName}
          </p>
        }
        anchor={anchor}
        open={open && !showAbsence && !showCancel}
        onClose={onClose}
      />

      {showAbsence && (
        <QuickAbsenceDialog
          open
          onClose={() => {
            setShowAbsence(false);
            onClose();
            onAfterAction?.();
          }}
          staffId={staffId}
          staffName={staffName}
          date={absenceRef.current.date}
          defaultPeriod={absenceRef.current.period}
        />
      )}

      {showCancel && (
        <CancelAssignmentDialog
          open
          onClose={() => {
            setShowCancel(false);
            onClose();
          }}
          staffName={staffName}
          staffType={staffType}
          assignmentId={assignmentId}
          staffId={staffId}
          date={date}
          pmAssignmentId={pmAssignmentId}
          period={period === "FULL_DAY" ? "FULL_DAY" : period}
          onAfterAction={onAfterAction}
        />
      )}
    </>
  );
}
