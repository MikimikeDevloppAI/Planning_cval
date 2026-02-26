"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Move, Loader2, ArrowLeft, UserCog, Stethoscope } from "lucide-react";
import { useMoveAssignment, useMoveDoctorSchedule } from "@/hooks/use-assignments";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { resolveRoleOptions, needsRoleSelection, type RoleSelectionData } from "@/lib/utils/role-selection";
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

  // Step 2: role selection
  const [step, setStep] = useState<"target" | "role">("target");
  const [roleData, setRoleData] = useState<RoleSelectionData | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(person.roleId);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

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
  const executeMove = (roleId: number | null, linkedDoctorId: number | null, activityId: number | null) => {
    if (!targetDeptId || !targetDate) return;
    setError(null);

    const personName = `${person.firstname} ${person.lastname}`;
    const onError = (err: Error) => setError(err.message ?? "Erreur inconnue");

    if (person.type === "DOCTOR") {
      moveDoctorSchedule.mutate(
        {
          staffId: person.id_staff,
          sourceAssignmentId: person.id_assignment,
          targetDeptId: targetDeptId as number,
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
          targetDeptId: targetDeptId as number,
          targetDate,
          period: targetPeriod,
          staffId: person.id_staff,
          assignmentType: "SECRETARY",
          roleId: roleId ?? person.roleId,
          skillId: person.skillId,
          linkedDoctorId,
          activityId,
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

    // Check if role selection is needed
    const { blocks, needs } = findTargetPeriodData(sites, targetDeptId as number, targetDate, targetPeriod);
    const selData = resolveRoleOptions(blocks, needs);

    if (needsRoleSelection(selData)) {
      setRoleData(selData);
      // Pre-select current role if available
      if (selData.roles.some((r) => r.id_role === person.roleId)) {
        setSelectedRoleId(person.roleId);
      } else {
        const firstWithGap = selData.roles.find((r) => r.gap > 0);
        setSelectedRoleId(firstWithGap?.id_role ?? selData.roles[0]?.id_role ?? null);
      }
      setSelectedDoctorId(selData.operations.length === 1 ? selData.operations[0].id_linked_doctor : null);
      setStep("role");
      return;
    }

    // Auto-select: execute directly
    executeMove(
      selData.autoSelect?.roleId ?? person.roleId,
      selData.autoSelect?.linkedDoctorId ?? null,
      selData.autoSelect?.activityId ?? null,
    );
  };

  /** Handle confirm from role selection step */
  const handleRoleConfirm = () => {
    const selectedOp = roleData?.operations.find((o) => o.id_linked_doctor === selectedDoctorId);
    executeMove(
      selectedRoleId,
      selectedDoctorId,
      selectedOp?.id_activity ?? null,
    );
  };

  const formattedSource = format(parseISO(sourceDate), "EEE d MMM", { locale: fr });

  const canConfirmRole = roleData?.isSurgery
    ? selectedRoleId !== null && selectedDoctorId !== null
    : selectedRoleId !== null;

  return (
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
              {step === "target" ? "Déplacer l\u2019assignation" : "Choisir le rôle"}
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

          {/* ─── Step 1: Target selection ─── */}
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

          {/* ─── Step 2: Role selection ─── */}
          {step === "role" && roleData && (
            <>
              {/* Surgery: Operation selection */}
              {roleData.isSurgery && roleData.operations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Opération
                  </label>
                  <div className="space-y-1.5">
                    {roleData.operations.map((op) => (
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

              {roleData.isSurgery && roleData.operations.length === 0 && (
                <div className="text-sm p-3 rounded-lg bg-muted/50 text-muted-foreground">
                  Aucune opération en cours sur ce créneau.
                </div>
              )}

              {/* Role selection */}
              {roleData.roles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Rôle
                  </label>
                  <div className="space-y-1.5">
                    {roleData.roles.map((role) => (
                      <button
                        key={role.id_role}
                        onClick={() => setSelectedRoleId(role.id_role)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg border transition-all",
                          selectedRoleId === role.id_role
                            ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                            : "bg-card border-border/50 hover:bg-muted/30 hover:border-border"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            role.gap > 0 ? "bg-red-500" : "bg-emerald-500"
                          )} />
                          <span className={cn(
                            "text-sm font-medium",
                            selectedRoleId === role.id_role ? "text-foreground" : "text-foreground/80"
                          )}>
                            {role.role_name}
                          </span>
                        </div>
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          role.gap > 0
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-500"
                        )}>
                          {role.gap > 0
                            ? `${role.gap} manque${role.gap > 1 ? "s" : ""}`
                            : "complet"}
                        </span>
                      </button>
                    ))}
                  </div>
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
          <div className="flex gap-2 justify-end pt-1">
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
  );
}
