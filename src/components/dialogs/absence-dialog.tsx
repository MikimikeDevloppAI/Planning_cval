"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useQueryClient } from "@tanstack/react-query";
import { toISODate } from "@/lib/utils/dates";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchStaffList, addStaffLeave } from "@/lib/supabase/queries";

interface StaffOption {
  id_staff: number;
  lastname: string;
  firstname: string;
}

export function AbsenceDialog() {
  const { open, staffId } = useAppStore((s) => s.absenceDialog);
  const close = useAppStore((s) => s.closeAbsenceDialog);
  const weekStart = useAppStore((s) => s.weekStart);
  const queryClient = useQueryClient();

  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState<"AM" | "PM" | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (open) {
      fetchStaffList(supabase, { active: "true" })
        .then((data) => setStaffList(Array.isArray(data) ? data as StaffOption[] : []));

      if (staffId) setSelectedStaffId(staffId);
      setResult(null);
    }
  }, [open, staffId]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!selectedStaffId || !startDate || !endDate) return;

    setLoading(true);
    setResult(null);

    try {
      const data = await addStaffLeave(supabase, selectedStaffId as number, {
        start_date: startDate,
        end_date: endDate,
        period: period || null,
      });

      setResult(
        `Absence enregistrée. ${data.invalidated} assignation(s) invalidée(s), ${data.issues} alerte(s) créée(s).`
      );

      queryClient.invalidateQueries({
        queryKey: ["planning", toISODate(weekStart)],
      });
    } catch (err) {
      setResult(`Erreur: ${err instanceof Error ? err.message : "Inconnue"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Déclarer une absence
          </h3>
          <button onClick={close} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Staff selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Personnel
            </label>
            <select
              className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value ? parseInt(e.target.value) : "")}
            >
              <option value="">Sélectionner...</option>
              {staffList.map((s) => (
                <option key={s.id_staff} value={s.id_staff}>
                  {s.lastname} {s.firstname}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Date début
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate) setEndDate(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Date fin
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Période
            </label>
            <select
              className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              value={period}
              onChange={(e) => setPeriod(e.target.value as "AM" | "PM" | "")}
            >
              <option value="">Journée complète</option>
              <option value="AM">Matin (AM)</option>
              <option value="PM">Après-midi (PM)</option>
            </select>
          </div>

          {result && (
            <div
              className={`text-sm p-3 rounded-xl ${
                result.startsWith("Erreur")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success/10 text-success"
              }`}
            >
              {result}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={close}
              className="px-4 py-2 text-sm rounded-xl border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
            >
              {result ? "Fermer" : "Annuler"}
            </button>
            {!result && (
              <button
                onClick={handleSubmit}
                disabled={!selectedStaffId || !startDate || !endDate || loading}
                className="px-4 py-2 text-sm rounded-xl bg-warning text-white hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "En cours..." : "Confirmer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
