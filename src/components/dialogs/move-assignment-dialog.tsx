"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Move, Loader2, ArrowLeft, UserCog, Stethoscope } from "lucide-react";
import { useMoveAssignment, useMoveDoctorSchedule } from "@/hooks/use-assignments";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { resolveRoleOptions, slotKey, type RoleSelectionData } from "@/lib/utils/role-selection";
import { SurgeryAssignmentDialog } from "@/components/dialogs/surgery-assignment-dialog";
import type { PlanningSite, PlanningBlock, StaffingNeed } from "@/lib/types/database";

interface DayPersonLike {
  id_staff: number;
  firstname: string;
  lastname: string;
  type: "DOCTOR" | "SECRETARY";
  id_primary_position: 1 | 2 | 3;
  period: "AM" | "PM" | "FULL";
  roleId: number | null;
  skillId: number | null;
  activityId: number | null;
  id_assignment: number;
  id_block: number;
}

interface MoveAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  person: DayPersonLike;
  sourceDate: string;
  sourceDeptName: string;
  sites: PlanningSite[];
}

/** Find blocks and needs for a target dept+date+period from sites cache */
function findTargetPeriodData(
  sites: PlanningSite[],
  deptId: number,
  date: string,
  period: "AM" | "PM"
): { blocks: PlanningBlock[]; needs: StaffingNeed[] } {
  for (const site of sites) {
    for (const dept of site.departments) {
      if (dept.id_department !== deptId) continue;
      for (const day of dept.days) {
        if (day.date !== date) continue;
        const pd = period === "AM" ? day.am : day.pm;
        return { blocks: pd.blocks, needs: pd.needs };
      }
    }
  }
  // Fallback: search by block-level id_department (virtual depts)
  for (const site of sites) {
    for (const dept of site.departments) {
      for (const day of dept.days) {
        if (day.date !== date) continue;
        const pd = period === "AM" ? day.am : day.pm;
        if (pd.blocks.some((b) => b.id_department === deptId)) {
          return { blocks: pd.blocks, needs: pd.needs };
        }
      }
    }
  }
  return { blocks: [], needs: [] };
}

export function MoveAssignmentDialog({
  open,
  onClose,
  person,
  sourceDate,
  sourceDeptName,
  sites,
}: MoveAssignmentDialogProps) {
  const [targetDeptId, setTargetDeptId] = useState<number | "">("");
  const [targetDate, setTargetDate] = useState(sourceDate);
  const [targetPeriod, setTargetPeriod] = useState<"AM" | "PM">(
    person.period === "PM" ? "PM" : "AM"
  );
  const [error, setError] = useState<string | null>(null);

  // Step 2: slot selection (coupled role+skill)
  const [step, setStep] = useState<"target" | "role">("target");
  const [roleData, setRoleData] = useState<RoleSelectionData | null>(null);
  const [targetBlocks, setTargetBlocks] = useState<PlanningBlock[]>([]);
  const [targetNeeds, setTargetNeeds] = useState<StaffingNeed[]>([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  // Surgery sub-dialog
  const [showSurgery, setShowSurgery] = useState(false);

  const moveAssignment = useMoveAssignment();
  const moveDoctorSchedule = useMoveDoctorSchedule();

  const isPending = moveAssignment.isPending || moveDoctorSchedule.isPending;

  if (!open) return null;

  // Build department options grouped by site
  const deptOptions: { siteId: number; siteName: string; deptId: number; deptName: string }[] = [];
  for (const site of sites) {
    for (const dept of site.departments) {
      if (dept.id_department < 0) continue; // skip virtual departments
      deptOptions.push({
        siteId: site.id_site,
        siteName: site.name,
        deptId: dept.id_department,
        deptName: dept.name,
      });
    }
  }

  const targetDeptName = deptOptions.find((o) => o.deptId === targetDeptId)?.deptName ?? "";

  /** Execute the actual move mutation */
  const executeMove = (roleId: number | null, skillId: number | null, linkedDoctorId: number | null) => {
    if (!targetDeptId || !targetDate) return;
    setError(null);

    const personName = `${person.firstname} ${person.lastname}`;
    const onError = (err: Error) => setError(err.message ?? "Erreur inconnue");

    // Resolve real dept ID and room ID from target blocks.
    // When targeting a room, the "dept" in the UI is actually a room entry
    // (id_department = roomId). The real dept ID is in the blocks themselves.
    const { blocks: resolvedBlocks } = findTargetPeriodData(sites, targetDeptId as number, targetDate, targetPeriod);
    const firstBlock = resolvedBlocks[0];
    const realDeptId = firstBlock?.id_department ?? (targetDeptId as number);
    const roomId = firstBlock?.id_room ?? null;

    if (person.type === "DOCTOR") {
      moveDoctorSchedule.mutate(
        {
          staffId: person.id_staff,
          sourceAssignmentId: person.id_assignment,
          targetDeptId: realDeptId,
          targetRoomId: roomId,
          targetDate,
          period: targetPeriod,
          activityId: person.activityId,
          personName,
          idPrimaryPosition: person.id_primary_position,
        },
        { onSuccess: () => onClose(), onError }
      );
    } else {
      moveAssignment.mutate(
        {
          oldAssignmentId: person.id_assignment,
          targetDeptId: realDeptId,
          targetRoomId: roomId,
          targetDate,
          period: targetPeriod,
          staffId: person.id_staff,
          roleId,
          skillId,
          linkedDoctorId,
          personName,
          idPrimaryPosition: person.id_primary_position,
        },
        { onSuccess: () => onClose(), onError }
      );
    }
  };

  /** Handle "Suivant" or "Déplacer" from target step */
  const handleNext = () => {
    if (!targetDeptId || !targetDate) return;
    setError(null);

    // Doctors bypass role selection
    if (person.type === "DOCTOR") {
      executeMove(null, null, null);
      return;
    }

    // Always go to step 2 for secretaries to show role/skill options
    const { blocks, needs } = findTargetPeriodData(sites, targetDeptId as number, targetDate, targetPeriod);
    const selData = resolveRoleOptions(blocks, needs);

    setRoleData(selData);
    setTargetBlocks(blocks);
    setTargetNeeds(needs);

    // Admin: auto-select = { roleId: 1, skillId: null } → show as read-only
    const isAdmin = selData.slots.length === 0 && selData.autoSelect?.roleId === 1;
    if (isAdmin) {
      // Execute directly for admin (nothing to choose)
      executeMove(1, null, null);
      return;
    }

    // Surgery: open the surgery dialog
    if (selData.isSurgery) {
      setShowSurgery(true);
      return;
    }

    // Consultation: always show slot selection
    // Pre-select slot matching current role, else first with gap
    if (selData.slots.length > 0) {
      const matchingCurrent = selData.slots.find((s) => s.id_role === person.roleId);
      if (matchingCurrent) {
        setSelectedSlotKey(slotKey(matchingCurrent));
      } else {
        const firstWithGap = selData.slots.find((s) => s.gap > 0);
        setSelectedSlotKey(slotKey(firstWithGap ?? selData.slots[0]));
      }
    }
    setSelectedDoctorId(null);
    setStep("role");
  };

  /** Handle confirm from role selection step */
  const handleRoleConfirm = () => {
    if (!roleData) return;

    if (roleData.slots.length === 0) {
      // No slots configured → Standard role
      executeMove(1, null, null);
      return;
    }

    if (!selectedSlotKey) return;
    const slot = roleData.slots.find((s) => slotKey(s) === selectedSlotKey);
    if (!slot) return;
    // DB constraint chk_secretary requires id_role NOT NULL → default to 1 (Standard)
    executeMove(slot.id_role ?? 1, slot.id_skill, selectedDoctorId);
  };

  const formattedSource = format(parseISO(sourceDate), "EEE d MMM", { locale: fr });

  // Determine label mode for step 2
  const distinctRoles = roleData ? new Set(roleData.slots.map((s) => s.id_role)) : new Set();
  const distinctSkills = roleData ? new Set(roleData.slots.map((s) => s.id_skill)) : new Set();
  const showRoleOnly = distinctSkills.size <= 1 && distinctRoles.size > 1;
  const showSkillOnly = distinctRoles.size <= 1 && distinctSkills.size > 1;

  const getSlotLabel = (s: NonNullable<typeof roleData>["slots"][0]) => {
    if (roleData?.isSurgery || s.id_role === null) return s.skill_name;
    if (showRoleOnly) return s.role_name ?? `Rôle ${s.id_role}`;
    if (showSkillOnly) return s.skill_name;
    return `${s.role_name ?? `Rôle ${s.id_role}`} — ${s.skill_name}`;
  };

  const step2Title = showRoleOnly
    ? "Choisir le rôle"
    : showSkillOnly
      ? "Choisir la compétence"
      : "Choisir le poste";

  const canConfirmRole = roleData?.slots.length === 0 || selectedSlotKey !== null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 border border-border/50">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              {step === "role" && (
                <button
                  onClick={() => setStep("target")}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors mr-0.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="p-2 rounded-lg bg-primary/10">
                {step === "target" ? (
                  <Move className="w-5 h-5 text-primary" />
                ) : (
                  <UserCog className="w-5 h-5 text-primary" />
                )}
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {step === "target" ? "Déplacer l\u2019assignation" : step2Title}
              </h3>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Source info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-semibold text-foreground">
                {person.firstname} {person.lastname}
              </p>
              <p className="text-xs text-muted-foreground">
                {step === "target"
                  ? `${sourceDeptName} · ${formattedSource} · ${person.period === "FULL" ? "Journée" : person.period}`
                  : `${sourceDeptName} → ${targetDeptName}`
                }
              </p>
            </div>

            {/* Step 1: Target selection */}
            {step === "target" && (
              <>
                {/* Target department */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Département cible
                  </label>
                  <CustomSelect
                    value={targetDeptId ? String(targetDeptId) : ""}
                    onChange={(v) => setTargetDeptId(v ? parseInt(v) : "")}
                    options={deptOptions.map((opt) => ({ value: String(opt.deptId), label: `${opt.siteName} — ${opt.deptName}` }))}
                    placeholder="Sélectionner..."
                    className="w-full"
                  />
                </div>

                {/* Target date */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Date cible
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>

                {/* Target period */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Période
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["AM", "PM"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setTargetPeriod(p)}
                        className={cn(
                          "px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                          targetPeriod === p
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-foreground border-border/50 hover:bg-muted/50"
                        )}
                      >
                        {p === "AM" ? "Matin" : "Après-midi"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Slot selection (consultation only — surgery uses sub-dialog) */}
            {step === "role" && roleData && (
              <>
                {roleData.slots.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {showRoleOnly ? "Rôle" : showSkillOnly ? "Compétence" : "Poste"}
                    </label>
                    <div className="space-y-1.5">
                      {roleData.slots.map((slot) => {
                        const key = slotKey(slot);
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedSlotKey(key)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg border transition-all",
                              selectedSlotKey === key
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
                                selectedSlotKey === key ? "text-foreground" : "text-foreground/80"
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

                {roleData.slots.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground bg-muted/50 rounded-lg">
                    Aucun besoin configuré — rôle Standard par défaut.
                  </div>
                )}
              </>
            )}

            {/* Error */}
            {error && (
              <div className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4">
              <button
                onClick={step === "role" ? () => setStep("target") : onClose}
                className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
              >
                {step === "role" ? "Retour" : "Annuler"}
              </button>
              {step === "target" ? (
                <button
                  onClick={handleNext}
                  disabled={!targetDeptId || !targetDate || isPending}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {person.type === "SECRETARY" ? "Suivant" : "Déplacer"}
                </button>
              ) : (
                <button
                  onClick={handleRoleConfirm}
                  disabled={!canConfirmRole || isPending}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Déplacer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Surgery sub-dialog */}
      {showSurgery && (
        <SurgeryAssignmentDialog
          open
          onClose={() => setShowSurgery(false)}
          onConfirm={(_period, selection) => {
            setShowSurgery(false);
            executeMove(selection.roleId, selection.skillId, selection.linkedDoctorId);
          }}
          personName={`${person.firstname} ${person.lastname}`}
          personPeriod={person.period}
          sourceDeptName={sourceDeptName}
          targetDeptName={targetDeptName}
          amBlocks={targetPeriod === "AM" ? targetBlocks : []}
          amNeeds={targetPeriod === "AM" ? targetNeeds : []}
          pmBlocks={targetPeriod === "PM" ? targetBlocks : []}
          pmNeeds={targetPeriod === "PM" ? targetNeeds : []}
          isPending={isPending}
        />
      )}
    </>
  );
}
