"use client";

import { useState } from "react";
import { X, XCircle, Loader2 } from "lucide-react";
import { useCancelAssignment, useReassignToAdmin } from "@/hooks/use-assignments";
import { cn } from "@/lib/utils";

interface CancelAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  staffName: string;
  staffType: "DOCTOR" | "SECRETARY";
  /** AM assignment */
  assignmentId: number;
  staffId: number;
  date: string;
  /** PM assignment (only when FULL day) */
  pmAssignmentId?: number;
  /** Period of the clicked badge */
  period: "AM" | "PM" | "FULL" | "FULL_DAY";
  onAfterAction?: () => void;
}

type PeriodChoice = "AM" | "PM" | "FULL";

export function CancelAssignmentDialog({
  open,
  onClose,
  staffName,
  staffType,
  assignmentId,
  staffId,
  date,
  pmAssignmentId,
  period,
  onAfterAction,
}: CancelAssignmentDialogProps) {
  const isFullDay = period === "FULL" || period === "FULL_DAY";
  const [choice, setChoice] = useState<PeriodChoice>(isFullDay ? "FULL" : period === "PM" ? "PM" : "AM");
  const [error, setError] = useState<string | null>(null);

  const cancelMutation = useCancelAssignment();
  const reassignToAdmin = useReassignToAdmin();

  if (!open) return null;

  const isPending = cancelMutation.isPending || reassignToAdmin.isPending;

  const handleConfirm = async () => {
    setError(null);

    const periodsToCancel: ("AM" | "PM")[] =
      choice === "FULL" ? ["AM", "PM"] :
      choice === "AM" ? ["AM"] : ["PM"];

    try {
      for (const p of periodsToCancel) {
        const aid = p === "PM" && pmAssignmentId ? pmAssignmentId : assignmentId;

        if (staffType === "SECRETARY") {
          // Secretary → reassign to Administration
          await reassignToAdmin.mutateAsync({
            assignmentId: aid,
            staffId,
            date,
            period: p,
          });
        } else {
          // Doctor → cancel
          await cancelMutation.mutateAsync({ assignmentId: aid });
        }
      }
      onAfterAction?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  // If not full day, execute immediately without showing dialog
  if (!isFullDay) {
    // Render nothing, trigger action in parent instead
    // But we still need to handle it — use effect-like pattern
    return (
      <ConfirmView
        staffName={staffName}
        staffType={staffType}
        periodLabel={period === "AM" ? "Matin" : "Après-midi"}
        isPending={isPending}
        error={error}
        onClose={onClose}
        onConfirm={handleConfirm}
      />
    );
  }

  const options: { value: PeriodChoice; label: string }[] = [
    { value: "AM", label: "Matin" },
    { value: "PM", label: "Après-midi" },
    { value: "FULL", label: "Journée entière" },
  ];

  const choiceLabel = options.find((o) => o.value === choice)?.label ?? "";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {staffType === "SECRETARY" ? "Retirer du poste" : "Annuler assignation"}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-semibold text-foreground">{staffName}</p>
            <p className="text-xs text-muted-foreground">
              {staffType === "SECRETARY"
                ? "Sera replacé(e) en Administration"
                : "L'assignation sera annulée"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Quelle période ?</p>
            <div className="grid grid-cols-3 gap-2">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setChoice(opt.value)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                    choice === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border/50 hover:bg-muted/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simple confirm dialog for single-period cancel */
function ConfirmView({
  staffName,
  staffType,
  periodLabel,
  isPending,
  error,
  onClose,
  onConfirm,
}: {
  staffName: string;
  staffType: "DOCTOR" | "SECRETARY";
  periodLabel: string;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {staffType === "SECRETARY" ? "Retirer du poste" : "Annuler assignation"}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {staffType === "SECRETARY"
              ? `Replacer ${staffName} en Administration pour le ${periodLabel.toLowerCase()} ?`
              : `Annuler l'assignation de ${staffName} pour le ${periodLabel.toLowerCase()} ?`}
          </p>

          {error && (
            <div className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
