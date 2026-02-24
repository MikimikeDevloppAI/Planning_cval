"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { X, CalendarOff, Loader2 } from "lucide-react";
import { useAddLeave } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

interface QuickAbsenceDialogProps {
  open: boolean;
  onClose: () => void;
  staffId: number;
  staffName: string;
  date: string;
  defaultPeriod: "AM" | "PM" | "FULL";
}

export function QuickAbsenceDialog({
  open,
  onClose,
  staffId,
  staffName,
  date,
  defaultPeriod,
}: QuickAbsenceDialogProps) {
  const [period, setPeriod] = useState<"AM" | "PM" | "">(
    defaultPeriod === "FULL" ? "" : defaultPeriod
  );
  const [result, setResult] = useState<string | null>(null);
  const addLeave = useAddLeave();

  if (!open) return null;

  const handleConfirm = () => {
    setResult(null);
    addLeave.mutate(
      {
        staffId,
        data: {
          start_date: date,
          end_date: date,
          period: period || null,
        },
      },
      {
        onSuccess: () => {
          setResult("success");
          setTimeout(onClose, 1000);
        },
        onError: (err) => {
          setResult(`Erreur : ${err instanceof Error ? err.message : "Inconnue"}`);
        },
      }
    );
  };

  const formattedDate = format(parseISO(date), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-warning/10">
              <CalendarOff className="w-5 h-5 text-warning" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Déclarer une absence
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Person + date info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-semibold text-foreground">{staffName}</p>
            <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
          </div>

          {/* Period picker */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Période
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "AM", label: "Matin" },
                { value: "PM", label: "Après-midi" },
                { value: "", label: "Journée" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                    period === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border/50 hover:bg-muted/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {result === "success" && (
            <div className="text-sm p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              Absence enregistrée. Le planning a été mis à jour.
            </div>
          )}
          {result && result !== "success" && (
            <div className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
              {result}
            </div>
          )}

          {/* Actions */}
          {!result && (
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={addLeave.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-warning text-white hover:bg-warning/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {addLeave.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer l&apos;absence
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
