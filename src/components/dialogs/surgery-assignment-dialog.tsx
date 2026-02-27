"use client";

import { useState, useMemo } from "react";
import { X, Stethoscope, Loader2, UserMinus, UserPlus, Sun, Moon, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCancelAssignment } from "@/hooks/use-assignments";
import type { PlanningBlock, StaffingNeed } from "@/lib/types/database";

export interface SurgerySelectionResult {
  roleId: number;
  skillId: number | null;
  linkedDoctorId: number | null;
}

interface SurgeryAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  /** If provided, dialog is in assignment mode. Omit for view/manage mode. */
  onConfirm?: ((period: "AM" | "PM", selection: SurgerySelectionResult) => void) | null;
  /** Person being assigned. Null = view/manage mode. */
  personName?: string | null;
  /** Person's current period (assignment mode only) */
  personPeriod?: "AM" | "PM" | "FULL";
  sourceDeptName?: string;
  targetDeptName: string;
  amBlocks: PlanningBlock[];
  amNeeds: StaffingNeed[];
  pmBlocks: PlanningBlock[];
  pmNeeds: StaffingNeed[];
  isPending?: boolean;
}

// ── Data model ──────────────────────────────────────────

interface AssignedSecretary {
  id_assignment: number;
  id_staff: number;
  firstname: string;
  lastname: string;
  skillName: string | null;
  id_skill: number | null;
}

interface DoctorCard {
  doctorAssignmentId: number;
  doctorName: string;
  activityName: string | null;
  assigned: AssignedSecretary[];
}

interface SkillGap {
  id_skill: number;
  skill_name: string;
  needed: number;
  assigned: number;
  gap: number;
}

interface VacancySelection {
  period: "AM" | "PM";
  skillId: number;
  linkedDoctorId: number;
}

/** Build doctor cards from blocks — just list each doctor with their assigned secretaries */
function buildDoctorCards(blocks: PlanningBlock[]): DoctorCard[] {
  const cards: DoctorCard[] = [];
  const seenDoctors = new Set<number>();

  for (const block of blocks) {
    if (block.block_type !== "SURGERY") continue;

    for (const a of block.assignments) {
      if (a.assignment_type !== "DOCTOR" || seenDoctors.has(a.id_assignment)) continue;
      seenDoctors.add(a.id_assignment);

      // Find secretaries linked to this doctor
      const assigned: AssignedSecretary[] = block.assignments
        .filter((sec) => sec.assignment_type !== "DOCTOR" && sec.id_linked_doctor === a.id_assignment)
        .map((sec) => ({
          id_assignment: sec.id_assignment,
          id_staff: sec.id_staff,
          firstname: sec.firstname,
          lastname: sec.lastname,
          skillName: sec.skill_name,
          id_skill: sec.id_skill,
        }));

      cards.push({
        doctorAssignmentId: a.id_assignment,
        doctorName: `${a.firstname} ${a.lastname}`,
        activityName: a.activity_name,
        assigned,
      });
    }
  }

  return cards;
}

/** Build block-level skill gaps from staffing needs */
function buildSkillGaps(blocks: PlanningBlock[], needs: StaffingNeed[]): SkillGap[] {
  const blockIds = new Set(blocks.filter((b) => b.block_type === "SURGERY").map((b) => b.id_block));
  const map = new Map<number, SkillGap>();

  for (const need of needs) {
    if (!blockIds.has(need.id_block)) continue;
    const existing = map.get(need.id_skill);
    if (existing) {
      existing.needed += need.needed;
      existing.assigned += need.assigned;
      existing.gap += need.gap;
    } else {
      map.set(need.id_skill, {
        id_skill: need.id_skill,
        skill_name: need.skill_name ?? `Compétence ${need.id_skill}`,
        needed: need.needed,
        assigned: need.assigned,
        gap: need.gap,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.gap - a.gap);
}

// ── Component ───────────────────────────────────────────

export function SurgeryAssignmentDialog({
  open,
  onClose,
  onConfirm,
  personName,
  personPeriod,
  sourceDeptName,
  targetDeptName,
  amBlocks,
  amNeeds,
  pmBlocks,
  pmNeeds,
  isPending,
}: SurgeryAssignmentDialogProps) {
  const cancelAssignment = useCancelAssignment();
  const isAssignMode = personName != null && onConfirm != null;

  // Periods to show
  const showAM = isAssignMode ? (personPeriod === "AM" || personPeriod === "FULL") : true;
  const showPM = isAssignMode ? (personPeriod === "PM" || personPeriod === "FULL") : true;

  // Build data
  const amDoctors = useMemo(() => showAM ? buildDoctorCards(amBlocks) : [], [showAM, amBlocks]);
  const pmDoctors = useMemo(() => showPM ? buildDoctorCards(pmBlocks) : [], [showPM, pmBlocks]);
  const amGaps = useMemo(() => showAM ? buildSkillGaps(amBlocks, amNeeds) : [], [showAM, amBlocks, amNeeds]);
  const pmGaps = useMemo(() => showPM ? buildSkillGaps(pmBlocks, pmNeeds) : [], [showPM, pmBlocks, pmNeeds]);

  // Selection (assignment mode only)
  const [selection, setSelection] = useState<VacancySelection | null>(null);

  // Auto-select first gap with a single doctor
  const autoSelection = useMemo((): VacancySelection | null => {
    if (!isAssignMode) return null;
    for (const gap of amGaps) {
      if (gap.gap > 0 && amDoctors.length === 1) {
        return { period: "AM", skillId: gap.id_skill, linkedDoctorId: amDoctors[0].doctorAssignmentId };
      }
    }
    for (const gap of pmGaps) {
      if (gap.gap > 0 && pmDoctors.length === 1) {
        return { period: "PM", skillId: gap.id_skill, linkedDoctorId: pmDoctors[0].doctorAssignmentId };
      }
    }
    return null;
  }, [isAssignMode, amGaps, pmGaps, amDoctors, pmDoctors]);

  const effectiveSelection = selection ?? autoSelection;

  // Pending removal
  const [pendingRemove, setPendingRemove] = useState<{ id_assignment: number; name: string } | null>(null);

  if (!open) return null;

  const handleConfirm = () => {
    if (!effectiveSelection || !onConfirm) return;
    onConfirm(effectiveSelection.period, {
      roleId: 1,
      skillId: effectiveSelection.skillId,
      linkedDoctorId: effectiveSelection.linkedDoctorId,
    });
  };

  const handleRemove = (assignmentId: number) => {
    cancelAssignment.mutate(
      { assignmentId },
      { onSuccess: () => setPendingRemove(null) }
    );
  };

  const handleSelectVacancy = (period: "AM" | "PM", skillId: number, doctors: DoctorCard[]) => {
    if (doctors.length === 1) {
      setSelection({ period, skillId, linkedDoctorId: doctors[0].doctorAssignmentId });
    } else if (doctors.length > 1) {
      // Pre-select first doctor, user can change via dropdown
      setSelection({ period, skillId, linkedDoctorId: doctors[0].doctorAssignmentId });
    }
  };

  /** Render a doctor card */
  const renderDoctorCard = (doc: DoctorCard) => (
    <div key={doc.doctorAssignmentId} className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Doctor header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-50 to-white border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <Stethoscope className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-foreground truncate">Dr. {doc.doctorName}</p>
          {doc.activityName && (
            <p className="text-[10px] text-muted-foreground truncate">{doc.activityName}</p>
          )}
        </div>
      </div>

      {/* Assigned secretaries */}
      <div className="px-3 py-2">
        {doc.assigned.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic py-1">Aucune assignation</p>
        ) : (
          <div className="space-y-1">
            {doc.assigned.map((sec) => (
              <div
                key={sec.id_assignment}
                className="flex items-center justify-between py-1 px-2 rounded-md bg-slate-50 group/sec"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[12px] text-foreground truncate">
                    {sec.firstname} {sec.lastname}
                  </span>
                  {sec.skillName && (
                    <span className="text-[10px] text-muted-foreground shrink-0">· {sec.skillName}</span>
                  )}
                </div>
                <button
                  onClick={() => setPendingRemove({ id_assignment: sec.id_assignment, name: `${sec.firstname} ${sec.lastname}` })}
                  className="opacity-0 group-hover/sec:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Retirer"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {doc.assigned.length} assignée{doc.assigned.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );

  /** Render vacancy rows for a period */
  const renderVacancies = (period: "AM" | "PM", gaps: SkillGap[], doctors: DoctorCard[]) => {
    const activeGaps = gaps.filter((g) => g.gap > 0);
    if (activeGaps.length === 0) return null;

    return (
      <div className="mt-2 space-y-1.5">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
          Postes à pourvoir
        </p>
        {activeGaps.map((gap) => {
          const isSelected = effectiveSelection?.period === period && effectiveSelection?.skillId === gap.id_skill;

          return (
            <div key={gap.id_skill} className="space-y-1">
              {isAssignMode ? (
                <button
                  onClick={() => handleSelectVacancy(period, gap.id_skill, doctors)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                    isSelected ? "border-primary" : "border-slate-300"
                  )}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  <span className={cn(
                    "text-[13px] font-medium flex-1",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {gap.skill_name}
                  </span>
                  <span className="text-[11px] font-semibold text-red-500 shrink-0">
                    {gap.gap} manque{gap.gap > 1 ? "s" : ""}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-[13px] font-medium text-foreground flex-1">
                    {gap.skill_name}
                  </span>
                  <span className="text-[11px] font-semibold text-red-500 shrink-0">
                    {gap.gap} manque{gap.gap > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {/* Doctor selector (only when selected and multiple doctors) */}
              {isAssignMode && isSelected && doctors.length > 1 && (
                <div className="ml-6 flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground shrink-0">Lier à :</span>
                  <div className="relative flex-1">
                    <select
                      value={effectiveSelection?.linkedDoctorId ?? ""}
                      onChange={(e) => setSelection({
                        period,
                        skillId: gap.id_skill,
                        linkedDoctorId: parseInt(e.target.value),
                      })}
                      className="w-full text-[12px] font-medium rounded-md border border-slate-200 bg-white pl-2 pr-7 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40"
                    >
                      {doctors.map((doc) => (
                        <option key={doc.doctorAssignmentId} value={doc.doctorAssignmentId}>
                          Dr. {doc.doctorName}{doc.activityName ? ` — ${doc.activityName}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /** Render a period section */
  const renderPeriod = (
    period: "AM" | "PM",
    doctors: DoctorCard[],
    gaps: SkillGap[],
    icon: React.ReactNode,
    label: string,
    borderColor: string,
    bgColor: string,
  ) => {
    const totalNeeded = gaps.reduce((s, g) => s + g.needed, 0);
    const totalAssigned = gaps.reduce((s, g) => s + g.assigned, 0);
    const totalGap = gaps.reduce((s, g) => s + Math.max(0, g.gap), 0);

    return (
      <div>
        {/* Period header */}
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2", bgColor, borderColor)}>
          {icon}
          <span className="text-sm font-bold">{label}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{doctors.length}</span> opération{doctors.length !== 1 ? "s" : ""}
            </span>
            {totalNeeded > 0 && (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{totalAssigned}</span>/{totalNeeded} postes
              </span>
            )}
            {totalGap > 0 && (
              <span className="text-red-600 font-semibold">
                {totalGap} vacant{totalGap !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 bg-slate-50/30 rounded-b-lg">
          {doctors.length === 0 ? (
            <div className="text-[12px] p-4 rounded-lg bg-muted/50 text-muted-foreground text-center">
              Aucune opération
            </div>
          ) : (
            <>
              {/* Doctor cards */}
              <div className="flex flex-wrap gap-2">
                {doctors.map((doc) => renderDoctorCard(doc))}
              </div>

              {/* Vacancies */}
              {renderVacancies(period, gaps, doctors)}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-5xl border border-border/50 max-h-[85vh] flex flex-col mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
              <Stethoscope className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Bloc opératoire</h3>
              <p className="text-xs text-muted-foreground">
                {sourceDeptName ? `${sourceDeptName} → ` : ""}{targetDeptName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Person banner (assignment mode only) */}
        {isAssignMode && (
          <div className="px-6 pb-3 shrink-0">
            <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <UserPlus className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground truncate">{personName}</p>
              <span className="text-[11px] text-muted-foreground">— Sélectionnez un poste vacant ci-dessous</span>
            </div>
          </div>
        )}

        {/* Period sections */}
        <div className="flex-1 min-h-0 overflow-auto px-6 pb-2 space-y-3">
          {showAM && renderPeriod(
            "AM", amDoctors, amGaps,
            <Sun className="w-4 h-4 text-amber-500" />,
            "Matin", "border-amber-300", "bg-amber-50/80",
          )}
          {showPM && renderPeriod(
            "PM", pmDoctors, pmGaps,
            <Moon className="w-4 h-4 text-indigo-500" />,
            "Après-midi", "border-indigo-300", "bg-indigo-50/80",
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-border/30 shrink-0 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
          >
            Fermer
          </button>
          {isAssignMode && (
            <button
              onClick={handleConfirm}
              disabled={!effectiveSelection || isPending}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Assigner
            </button>
          )}
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
