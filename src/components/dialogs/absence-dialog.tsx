"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useQueryClient } from "@tanstack/react-query";
import { toISODate } from "@/lib/utils/dates";
import { X, CalendarOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchStaffList, addStaffLeave } from "@/lib/supabase/queries";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";

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
      await addStaffLeave(supabase, selectedStaffId as number, {
        start_date: startDate,
        end_date: endDate,
        period: period || null,
      });

      setResult("Absence enregistrée. Le planning a été mis à jour automatiquement.");

      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    } catch (err) {
      setResult(`Erreur: ${err instanceof Error ? err.message : "Inconnue"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-warning/10">
              <CalendarOff className="w-5 h-5 text-warning" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Déclarer une absence
            </h3>
          </div>
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
            <CustomSelect
              value={selectedStaffId ? String(selectedStaffId) : ""}
              onChange={(v) => setSelectedStaffId(v ? parseInt(v) : "")}
              options={staffList.map((s) => ({ value: String(s.id_staff), label: `${s.lastname} ${s.firstname}` }))}
              placeholder="Sélectionner..."
              className="w-full"
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Date début
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all"
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
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all"
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
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "AM" as const, label: "Matin" },
                { value: "PM" as const, label: "Après-midi" },
                { value: "" as const, label: "Journée" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
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

          {result && (
            <div
              className={`text-sm p-3 rounded-lg ${
                result.startsWith("Erreur")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {result}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <button
              onClick={close}
              className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
            >
              {result ? "Fermer" : "Annuler"}
            </button>
            {!result && (
              <button
                onClick={handleSubmit}
                disabled={!selectedStaffId || !startDate || !endDate || loading}
                className="px-4 py-2 text-sm rounded-lg bg-warning text-white hover:bg-warning/90 disabled:opacity-50 transition-colors"
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
