"use client";

import { useState } from "react";
import { X, UserCog, Loader2, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleSelectionData } from "@/lib/utils/role-selection";
import { slotKey } from "@/lib/utils/role-selection";

export interface RoleSelectionResult {
  roleId: number | null;
  skillId: number | null;
  linkedDoctorId: number | null;
}

interface RoleSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: RoleSelectionResult) => void;
  personName: string;
  sourceDeptName: string;
  targetDeptName: string;
  selectionData: RoleSelectionData;
  currentRoleId: number | null;
  isPending?: boolean;
}

export function RoleSelectionDialog({
  open,
  onClose,
  onConfirm,
  personName,
  sourceDeptName,
  targetDeptName,
  selectionData,
  currentRoleId,
  isPending,
}: RoleSelectionDialogProps) {
  const { isSurgery, slots, operations } = selectionData;

  // Determine label mode: only show the dimension that varies
  const distinctRoles = new Set(slots.map((s) => s.id_role));
  const distinctSkills = new Set(slots.map((s) => s.id_skill));
  const showRoleOnly = distinctSkills.size <= 1 && distinctRoles.size > 1;
  const showSkillOnly = distinctRoles.size <= 1 && distinctSkills.size > 1;
  // else: show both (or surgery which always shows skill only)

  const getSlotLabel = (s: typeof slots[0]) => {
    if (isSurgery || s.id_role === null) return s.skill_name;
    if (showRoleOnly) return s.role_name ?? `Rôle ${s.id_role}`;
    if (showSkillOnly) return s.skill_name;
    return `${s.role_name ?? `Rôle ${s.id_role}`} — ${s.skill_name}`;
  };

  // Pre-select: match current role if available, else first with gap
  const [selectedSlot, setSelectedSlot] = useState<string | null>(() => {
    if (slots.length === 0) return null;
    const matchingCurrent = slots.find((s) => s.id_role === currentRoleId);
    if (matchingCurrent) return slotKey(matchingCurrent);
    const firstWithGap = slots.find((s) => s.gap > 0);
    return slotKey(firstWithGap ?? slots[0]);
  });

  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(
    operations.length === 1 ? operations[0].id_linked_doctor : null
  );

  if (!open) return null;

  const needOp = isSurgery && operations.length > 0;
  const canConfirm =
    (slots.length === 0 || selectedSlot !== null) &&
    (!needOp || selectedDoctorId !== null);

  const handleConfirm = () => {
    if (!canConfirm) return;
    const slot = slots.find((s) => slotKey(s) === selectedSlot);
    onConfirm({
      // DB constraint chk_secretary requires id_role NOT NULL for secretaries.
      // Surgery slots have id_role=null → default to 1 (Standard).
      roleId: slot?.id_role ?? 1,
      skillId: slot?.id_skill ?? null,
      linkedDoctorId: selectedDoctorId,
    });
  };

  const title = isSurgery
    ? "Assignation bloc opératoire"
    : showRoleOnly
      ? "Choisir le rôle"
      : showSkillOnly
        ? "Choisir la compétence"
        : "Choisir le poste";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCog className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Context info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-semibold text-foreground">{personName}</p>
            <p className="text-xs text-muted-foreground">
              {sourceDeptName} → {targetDeptName}
            </p>
          </div>

          {/* Surgery: Operation selection */}
          {isSurgery && operations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Opération
              </label>
              <div className="space-y-1.5">
                {operations.map((op) => (
                  <button
                    key={op.id_linked_doctor}
                    onClick={() => setSelectedDoctorId(op.id_linked_doctor)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg border transition-all",
                      selectedDoctorId === op.id_linked_doctor
                        ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                        : "bg-card border-border/50 hover:bg-muted/30 hover:border-border"
                    )}
                  >
                    <Stethoscope className={cn(
                      "w-4 h-4 shrink-0",
                      selectedDoctorId === op.id_linked_doctor ? "text-primary" : "text-muted-foreground"
                    )} />
                    <div className="min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        selectedDoctorId === op.id_linked_doctor ? "text-foreground" : "text-foreground/80"
                      )}>
                        Dr. {op.doctorName}
                      </p>
                      {op.activityName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {op.activityName}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSurgery && operations.length === 0 && (
            <div className="text-sm p-3 rounded-lg bg-muted/50 text-muted-foreground">
              Aucune opération en cours sur ce créneau.
            </div>
          )}

          {/* Slot selection (coupled role+skill) */}
          {slots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {isSurgery ? "Compétence" : showRoleOnly ? "Rôle" : showSkillOnly ? "Compétence" : "Poste"}
              </label>
              <div className="space-y-1.5">
                {slots.map((slot) => {
                  const key = slotKey(slot);
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedSlot(key)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg border transition-all",
                        selectedSlot === key
                          ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                          : "bg-card border-border/50 hover:bg-muted/30 hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          slot.gap > 0 ? "bg-red-500" : "bg-emerald-500"
                        )} />
                        <span className={cn(
                          "text-sm font-medium",
                          selectedSlot === key ? "text-foreground" : "text-foreground/80"
                        )}>
                          {getSlotLabel(slot)}
                        </span>
                      </div>
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        slot.gap > 0
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                      )}>
                        {slot.gap > 0
                          ? `${slot.gap} manque${slot.gap > 1 ? "s" : ""}`
                          : "complet"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || isPending}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Déplacer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
