"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Move, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMoveAssignment, useMoveDoctorSchedule } from "@/hooks/use-assignments";
import { cn } from "@/lib/utils";
import type { PlanningSite } from "@/lib/types/database";

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

  const handleConfirm = async () => {
    if (!targetDeptId || !targetDate) return;
    setError(null);

    const personName = `${person.firstname} ${person.lastname}`;

    try {
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
          {
            onSuccess: () => onClose(),
            onError: (err) => setError(err instanceof Error ? err.message : "Erreur inconnue"),
          }
        );
      } else {
        // Secretary: need to find target block first
        const supabase = createClient();
        const { data: block, error: blockErr } = await supabase
          .from("work_blocks")
          .select("id_block")
          .eq("id_department", targetDeptId)
          .eq("date", targetDate)
          .eq("period", targetPeriod)
          .single();

        if (blockErr || !block) {
          setError("Aucun bloc trouvé pour cette destination. Le planning n'a peut-être pas encore été initialisé pour cette date.");
          return;
        }

        moveAssignment.mutate(
          {
            oldAssignmentId: person.id_assignment,
            targetBlockId: block.id_block,
            staffId: person.id_staff,
            assignmentType: "SECRETARY",
            roleId: person.roleId,
            skillId: person.skillId,
            personName,
            idPrimaryPosition: person.id_primary_position,
          },
          {
            onSuccess: () => onClose(),
            onError: (err) => setError(err instanceof Error ? err.message : "Erreur inconnue"),
          }
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const formattedSource = format(parseISO(sourceDate), "EEE d MMM", { locale: fr });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Move className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Déplacer l&apos;assignation
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
              {sourceDeptName} · {formattedSource} · {person.period === "FULL" ? "Journée" : person.period}
            </p>
          </div>

          {/* Target department */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Département cible
            </label>
            <select
              className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              value={targetDeptId}
              onChange={(e) => setTargetDeptId(e.target.value ? parseInt(e.target.value) : "")}
            >
              <option value="">Sélectionner...</option>
              {deptOptions.map((opt) => (
                <option key={opt.deptId} value={opt.deptId}>
                  {opt.siteName} — {opt.deptName}
                </option>
              ))}
            </select>
          </div>

          {/* Target date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Date cible
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
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

          {/* Error */}
          {error && (
            <div className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
              {error}
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
              disabled={!targetDeptId || !targetDate || isPending}
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
