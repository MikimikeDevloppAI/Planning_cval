"use client";

import { useState, useMemo } from "react";
import { X, Loader2, UserMinus, UserPlus, Building2, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCancelAssignment } from "@/hooks/use-assignments";
import { resolveRoleOptions, slotKey, type NeedSlot } from "@/lib/utils/role-selection";
import type { PlanningBlock, StaffingNeed } from "@/lib/types/database";

// ── Types imported from departments-table-view ──────────

export interface ChipDragData {
  personId: number;
  personType: "DOCTOR" | "SECRETARY";
  personName: string;
  idPrimaryPosition: 1 | 2 | 3;
  date: string;
  deptId: number;
  deptName: string;
  period: "AM" | "PM" | "FULL";
  assignmentId: number;
  pmAssignmentId?: number;
  activityId: number | null;
  roleId: number | null;
  skillId: number | null;
}

export interface CellDropData {
  deptId: number;
  deptName: string;
  date: string;
  amBlocks: PlanningBlock[];
  pmBlocks: PlanningBlock[];
  amNeeds: StaffingNeed[];
  pmNeeds: StaffingNeed[];
}

interface AssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  dragData: ChipDragData;
  dropData: CellDropData;
  onConfirm: (
    period: "AM" | "PM",
    assignmentId: number,
    roleId: number | null,
    skillId: number | null,
    linkedDoctorId: number | null,
  ) => void;
  onConfirmFull: (
    amRoleId: number | null, amSkillId: number | null, amLinkedDoc: number | null,
    pmRoleId: number | null, pmSkillId: number | null, pmLinkedDoc: number | null,
  ) => void;
  isPending?: boolean;
}

// ── Helpers ─────────────────────────────────────────────

interface ExistingAssignment {
  id_assignment: number;
  id_staff: number;
  firstname: string;
  lastname: string;
  roleName: string | null;
  skillName: string | null;
}

function getExistingAssignments(blocks: PlanningBlock[]): ExistingAssignment[] {
  const seen = new Set<number>();
  const result: ExistingAssignment[] = [];
  for (const block of blocks) {
    for (const a of block.assignments) {
      if (a.assignment_type === "DOCTOR" || seen.has(a.id_assignment)) continue;
      seen.add(a.id_assignment);
      result.push({
        id_assignment: a.id_assignment,
        id_staff: a.id_staff,
        firstname: a.firstname,
        lastname: a.lastname,
        roleName: a.role_name,
        skillName: a.skill_name,
      });
    }
  }
  return result;
}

// ── Component ───────────────────────────────────────────

export function AssignmentDialog({
  open,
  onClose,
  dragData,
  dropData,
  onConfirm,
  onConfirmFull,
  isPending,
}: AssignmentDialogProps) {
  const cancelAssignment = useCancelAssignment();
  const isDoctor = dragData.personType === "DOCTOR";
  const hasAm = dropData.amBlocks.length > 0;
  const hasPm = dropData.pmBlocks.length > 0;
  const canFull = dragData.period === "FULL" && !!dragData.pmAssignmentId && hasAm && hasPm;
  const defaultPeriod = dragData.period === "PM" || (!hasAm && hasPm) ? "PM" as const : dragData.period === "FULL" && canFull ? "FULL" as const : "AM" as const;

  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM" | "FULL">(defaultPeriod);
  const [pendingRemove, setPendingRemove] = useState<{ id_assignment: number; name: string } | null>(null);

  // Resolve role options
  const amSelData = useMemo(
    () => !isDoctor ? resolveRoleOptions(dropData.amBlocks, dropData.amNeeds) : null,
    [isDoctor, dropData.amBlocks, dropData.amNeeds],
  );
  const pmSelData = useMemo(
    () => !isDoctor ? resolveRoleOptions(dropData.pmBlocks, dropData.pmNeeds) : null,
    [isDoctor, dropData.pmBlocks, dropData.pmNeeds],
  );

  const activeSelData = selectedPeriod === "PM" ? pmSelData : amSelData;
  const isAdmin = activeSelData?.slots.length === 0 && activeSelData.autoSelect?.roleId === 1;

  // Existing assignments per period
  const amAssigned = useMemo(() => getExistingAssignments(dropData.amBlocks), [dropData.amBlocks]);
  const pmAssigned = useMemo(() => getExistingAssignments(dropData.pmBlocks), [dropData.pmBlocks]);

  // Slot selection state
  const [amSlotKey, setAmSlotKey] = useState<string | null>(() => {
    if (!amSelData || amSelData.slots.length === 0) return null;
    const auto = amSelData.autoSelect;
    if (auto) {
      const match = amSelData.slots.find((s) => s.id_role === auto.roleId && s.id_skill === auto.skillId);
      if (match) return slotKey(match);
    }
    const firstGap = amSelData.slots.find((s) => s.gap > 0);
    return slotKey(firstGap ?? amSelData.slots[0]);
  });

  const [pmSlotKey, setPmSlotKey] = useState<string | null>(() => {
    if (!pmSelData || pmSelData.slots.length === 0) return null;
    const auto = pmSelData.autoSelect;
    if (auto) {
      const match = pmSelData.slots.find((s) => s.id_role === auto.roleId && s.id_skill === auto.skillId);
      if (match) return slotKey(match);
    }
    const firstGap = pmSelData.slots.find((s) => s.gap > 0);
    return slotKey(firstGap ?? pmSelData.slots[0]);
  });

  if (!open) return null;

  const getSlotValues = (selData: typeof amSelData, key: string | null) => {
    if (!selData) return { roleId: null, skillId: null, linkedDoctorId: null };
    if (selData.slots.length === 0 && selData.autoSelect) return selData.autoSelect;
    const slot = selData.slots.find((s) => slotKey(s) === key);
    return {
      roleId: slot?.id_role ?? 1,
      skillId: slot?.id_skill ?? null,
      linkedDoctorId: null,
    };
  };

  // Determine if confirm is valid
  const canConfirm = (() => {
    if (isDoctor) return true;
    if (selectedPeriod === "FULL") {
      const amOk = !amSelData || amSelData.slots.length === 0 || amSlotKey !== null;
      const pmOk = !pmSelData || pmSelData.slots.length === 0 || pmSlotKey !== null;
      return amOk && pmOk;
    }
    const currentKey = selectedPeriod === "PM" ? pmSlotKey : amSlotKey;
    return activeSelData?.slots.length === 0 || currentKey !== null;
  })();

  const handleConfirm = () => {
    if (isDoctor) {
      if (selectedPeriod === "FULL") {
        onConfirmFull(null, null, null, null, null, null);
      } else {
        const assignmentId = selectedPeriod === "PM" && dragData.pmAssignmentId
          ? dragData.pmAssignmentId
          : dragData.assignmentId;
        onConfirm(selectedPeriod, assignmentId, null, null, null);
      }
      return;
    }

    if (selectedPeriod === "FULL") {
      const amVals = getSlotValues(amSelData, amSlotKey);
      const pmVals = getSlotValues(pmSelData, pmSlotKey);
      onConfirmFull(amVals.roleId, amVals.skillId, amVals.linkedDoctorId, pmVals.roleId, pmVals.skillId, pmVals.linkedDoctorId);
    } else {
      const assignmentId = selectedPeriod === "PM" && dragData.pmAssignmentId
        ? dragData.pmAssignmentId
        : dragData.assignmentId;
      const vals = getSlotValues(selectedPeriod === "PM" ? pmSelData : amSelData, selectedPeriod === "PM" ? pmSlotKey : amSlotKey);
      onConfirm(selectedPeriod, assignmentId, vals.roleId, vals.skillId, vals.linkedDoctorId);
    }
  };

  const handleRemove = (assignmentId: number) => {
    cancelAssignment.mutate(
      { assignmentId },
      { onSuccess: () => setPendingRemove(null) },
    );
  };

  // Slot label
  const getSlotLabel = (slot: NeedSlot) => {
    const distinctRoles = new Set(activeSelData?.slots.map((s) => s.id_role) ?? []);
    const distinctSkills = new Set(activeSelData?.slots.map((s) => s.id_skill) ?? []);
    const showRoleOnly = distinctSkills.size <= 1 && distinctRoles.size > 1;
    const showSkillOnly = distinctRoles.size <= 1 && distinctSkills.size > 1;

    if (slot.id_role === null) return slot.skill_name;
    if (showRoleOnly) return slot.role_name ?? `Rôle ${slot.id_role}`;
    if (showSkillOnly) return slot.skill_name;
    return `${slot.role_name ?? `Rôle ${slot.id_role}`} · ${slot.skill_name}`;
  };

  /** Render the assigned people table for a period */
  const renderAssigned = (assigned: ExistingAssignment[], label: string) => {
    if (assigned.length === 0) return null;

    return (
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5">
          {label}
        </p>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
          {assigned.map((a) => (
            <div
              key={a.id_assignment}
              className="flex items-center px-3 py-2 group/row hover:bg-slate-50/80 transition-colors"
            >
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[13px] font-medium text-foreground truncate">
                  {a.firstname} {a.lastname}
                </span>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-[12px] text-muted-foreground">
                  {[a.roleName, a.skillName].filter(Boolean).join(" · ") || "Standard"}
                </span>
                <button
                  onClick={() => setPendingRemove({ id_assignment: a.id_assignment, name: `${a.firstname} ${a.lastname}` })}
                  className="opacity-0 group-hover/row:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Retirer"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /** Render slot selector for a period */
  const renderSlots = (slots: NeedSlot[], selectedKey: string | null, onSelect: (key: string) => void) => {
    if (slots.length === 0) return null;

    return (
      <div className="space-y-1">
        {slots.map((slot) => {
          const key = slotKey(slot);
          const isSelected = selectedKey === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <span className={cn(
                "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                isSelected ? "border-primary" : "border-slate-300",
              )}>
                {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>
              <span className={cn(
                "text-[13px] font-medium flex-1",
                isSelected ? "text-primary" : "text-foreground",
              )}>
                {getSlotLabel(slot)}
              </span>
              <span className={cn(
                "text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded-full",
                slot.gap > 0
                  ? "bg-red-100 text-red-600"
                  : "bg-slate-100 text-slate-400",
              )}>
                {slot.gap > 0
                  ? `${slot.gap} manque${slot.gap > 1 ? "s" : ""}`
                  : "complet"}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  /** Render a period section (assigned + slots) */
  const renderPeriodSection = (
    period: "AM" | "PM",
    assigned: ExistingAssignment[],
    slots: NeedSlot[],
    selectedKey: string | null,
    onSelect: (key: string) => void,
    showLabel: boolean,
  ) => {
    const icon = period === "AM"
      ? <Sun className="w-3.5 h-3.5 text-amber-500" />
      : <Moon className="w-3.5 h-3.5 text-indigo-500" />;
    const label = period === "AM" ? "Matin" : "Après-midi";

    return (
      <div className="space-y-3">
        {showLabel && (
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            {icon}
            {label}
          </div>
        )}

        {renderAssigned(assigned, showLabel ? "Personnel assigné" : `Personnel assigné — ${label}`)}

        {!isDoctor && slots.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5">
              Poste pour {dragData.personName.split(" ")[0]}
            </p>
            {renderSlots(slots, selectedKey, onSelect)}
          </div>
        )}

        {!isDoctor && isAdmin && (
          <div className="px-3 py-2 text-[12px] text-muted-foreground bg-slate-50 rounded-lg border border-slate-200/60">
            Rôle : Standard (administration)
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-2xl border border-border/50 max-h-[85vh] flex flex-col mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
              <Building2 className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{dropData.deptName}</h3>
              <p className="text-xs text-muted-foreground">
                {dragData.deptName} → {dropData.deptName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Person banner */}
        <div className="px-6 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
            <UserPlus className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate">{dragData.personName}</p>
            {!isDoctor && (
              <span className="text-[11px] text-muted-foreground">— Sélectionnez un poste ci-dessous</span>
            )}
          </div>
        </div>

        {/* Period selection */}
        <div className="px-6 pb-3 shrink-0">
          <div className="flex gap-1.5">
            {(["AM", "PM", "FULL"] as const).map((p) => {
              const disabled = (p === "AM" && !hasAm) || (p === "PM" && !hasPm) || (p === "FULL" && !canFull);
              const label = p === "AM" ? "Matin" : p === "PM" ? "Après-midi" : "Journée";
              return (
                <button
                  key={p}
                  disabled={disabled}
                  onClick={() => setSelectedPeriod(p)}
                  className={cn(
                    "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all",
                    selectedPeriod === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border/50 hover:bg-muted/50",
                    disabled && "opacity-30 cursor-not-allowed",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto px-6 pb-2 space-y-4">
          {selectedPeriod === "FULL" ? (
            <>
              {renderPeriodSection("AM", amAssigned, amSelData?.slots ?? [], amSlotKey, setAmSlotKey, true)}
              <div className="border-t border-slate-200" />
              {renderPeriodSection("PM", pmAssigned, pmSelData?.slots ?? [], pmSlotKey, setPmSlotKey, true)}
            </>
          ) : (
            renderPeriodSection(
              selectedPeriod,
              selectedPeriod === "PM" ? pmAssigned : amAssigned,
              activeSelData?.slots ?? [],
              selectedPeriod === "PM" ? pmSlotKey : amSlotKey,
              selectedPeriod === "PM" ? setPmSlotKey : setAmSlotKey,
              false,
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-border/30 shrink-0 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isDoctor ? "Déplacer" : "Assigner"}
          </button>
        </div>

        {/* Remove confirmation overlay */}
        {pendingRemove && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-xl">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 max-w-sm mx-4">
              <p className="text-sm font-semibold text-foreground mb-1">
                Retirer {pendingRemove.name} ?
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Cette personne sera désassignée de ce poste.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPendingRemove(null)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-foreground hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleRemove(pendingRemove.id_assignment)}
                  disabled={cancelAssignment.isPending}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {cancelAssignment.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Retirer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
