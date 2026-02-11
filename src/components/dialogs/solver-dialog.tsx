"use client";

import { useState } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useQueryClient } from "@tanstack/react-query";
import { toISODate } from "@/lib/utils/dates";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function SolverDialog() {
  const { open } = useAppStore((s) => s.solverDialog);
  const close = useAppStore((s) => s.closeSolverDialog);
  const weekStart = useAppStore((s) => s.weekStart);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!open) return null;

  const handleRun = async () => {
    setStatus("running");
    setMessage("Exécution du solveur en cours...");

    try {
      const res = await fetch("/api/solver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: toISODate(weekStart),
          clearProposed: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStatus("success");
      setMessage(data.message || "Solver terminé avec succès");

      queryClient.invalidateQueries({
        queryKey: ["planning", toISODate(weekStart)],
      });
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Replanifier la semaine
          </h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Le solveur va recalculer les assignations des secrétaires pour la
          semaine du{" "}
          <span className="font-medium">{toISODate(weekStart)}</span>.
          Les assignations proposées existantes seront supprimées.
        </p>

        {status === "running" && (
          <div className="flex items-center gap-2 text-blue-600 py-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{message}</span>
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-green-600 py-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm">{message}</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{message}</span>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={close}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {status === "idle" ? "Annuler" : "Fermer"}
          </button>
          {status === "idle" && (
            <button
              onClick={handleRun}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Lancer le solveur
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
