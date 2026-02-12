"use client";

import { useState } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfISOWeek, addWeeks, endOfMonth, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Get all Monday dates that cover the given month.
 * A week is included if its Monday falls in the month OR its Saturday (Mon+5) falls in the month.
 */
function getMondaysForMonth(monthStart: Date): Date[] {
  const mondays: Date[] = [];
  const monthEnd = endOfMonth(monthStart);

  // Start from the Monday of the week containing the 1st
  let monday = startOfISOWeek(monthStart);

  while (isBefore(monday, monthEnd) || monday.getTime() === monthEnd.getTime()) {
    mondays.push(monday);
    monday = addWeeks(monday, 1);
  }

  return mondays;
}

export function SolverDialog() {
  const { open } = useAppStore((s) => s.solverDialog);
  const close = useAppStore((s) => s.closeSolverDialog);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!open) return null;

  const mondays = getMondaysForMonth(currentMonth);
  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: fr });

  const handleRun = async () => {
    setStatus("running");
    setProgress({ current: 0, total: mondays.length });

    try {
      for (let i = 0; i < mondays.length; i++) {
        const weekStart = format(mondays[i], "yyyy-MM-dd");
        setMessage(`Semaine ${i + 1}/${mondays.length} — ${weekStart}`);
        setProgress({ current: i + 1, total: mondays.length });

        const res = await fetch("/api/solver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart,
            clearProposed: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(`Semaine ${weekStart}: ${data.error}`);
      }

      setStatus("success");
      setMessage(`${mondays.length} semaines traitées avec succès`);

      // Invalidate monthly planning data
      queryClient.invalidateQueries({
        queryKey: ["planning", "month"],
      });
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setMessage("");
    setProgress({ current: 0, total: 0 });
    close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Optimiser le planning
          </h3>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Le solveur va calculer les assignations des secrétaires pour
          {" "}<span className="font-medium text-foreground capitalize">{monthLabel}</span>{" "}
          ({mondays.length} semaines). Les assignations proposées existantes seront remplacées.
        </p>

        {status === "running" && (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{message}</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-emerald-600 py-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm">{message}</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 text-destructive py-4">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{message}</span>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-xl border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
          >
            {status === "idle" ? "Annuler" : "Fermer"}
          </button>
          {status === "idle" && (
            <button
              onClick={handleRun}
              className="px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              Lancer le solveur
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
