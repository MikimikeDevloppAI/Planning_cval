"use client";

import { useState } from "react";
import { useAddLeave, useDeleteLeave } from "@/hooks/use-staff";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Trash2, CalendarOff } from "lucide-react";

interface LeaveEntry {
  id_leave: number;
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
}

interface StaffLeaveManagerProps {
  staffId: number;
  leaves: LeaveEntry[];
}

export function StaffLeaveManager({ staffId, leaves }: StaffLeaveManagerProps) {
  const addLeave = useAddLeave();
  const deleteLeave = useDeleteLeave();
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState<"AM" | "PM" | "">("");

  const handleAdd = () => {
    if (!startDate || !endDate) return;
    addLeave.mutate(
      {
        staffId,
        data: {
          start_date: startDate,
          end_date: endDate,
          period: period || null,
        },
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setStartDate("");
          setEndDate("");
          setPeriod("");
        },
      }
    );
  };

  const formatDate = (d: string) => {
    try {
      return format(parseISO(d), "dd MMM yyyy", { locale: fr });
    } catch {
      return d;
    }
  };

  const periodLabel = (p: "AM" | "PM" | null) => {
    if (p === "AM") return "Matin";
    if (p === "PM") return "Après-midi";
    return "Journée complète";
  };

  // Split into future and past
  const today = new Date().toISOString().split("T")[0];
  const futureLeaves = leaves.filter((l) => l.end_date >= today);
  const pastLeaves = leaves.filter((l) => l.end_date < today);

  return (
    <div className="space-y-4">
      {!showForm && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
          >
            <Plus className="w-4 h-4" />
            Déclarer
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Date début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate) setEndDate(e.target.value);
                }}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Date fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Période
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "AM" | "PM" | "")}
              className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
            >
              <option value="">Journée complète</option>
              <option value="AM">Matin (AM)</option>
              <option value="PM">Après-midi (PM)</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!startDate || !endDate || addLeave.isPending}
              className="px-3 py-1.5 text-sm bg-warning text-white rounded-xl hover:bg-warning/90 disabled:opacity-50"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {leaves.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
            <CalendarOff className="w-7 h-7" />
          </div>
          <p className="text-sm">Aucune absence déclarée</p>
        </div>
      )}

      {/* Future leaves */}
      {futureLeaves.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            À venir / En cours
          </p>
          <div className="space-y-2">
            {futureLeaves.map((leave) => (
              <div
                key={leave.id_leave}
                className="flex items-center justify-between bg-warning/5 border border-warning/20 rounded-xl px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(leave.start_date)}
                    {leave.start_date !== leave.end_date &&
                      ` → ${formatDate(leave.end_date)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {periodLabel(leave.period)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    deleteLeave.mutate({ staffId, leaveId: leave.id_leave })
                  }
                  className="text-destructive/50 hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past leaves */}
      {pastLeaves.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Historique
          </p>
          <div className="space-y-1">
            {pastLeaves.slice(0, 10).map((leave) => (
              <div
                key={leave.id_leave}
                className="flex items-center justify-between text-sm text-muted-foreground px-4 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <span>
                  {formatDate(leave.start_date)}
                  {leave.start_date !== leave.end_date &&
                    ` → ${formatDate(leave.end_date)}`}
                  <span className="text-xs text-border ml-2">
                    {periodLabel(leave.period)}
                  </span>
                </span>
              </div>
            ))}
            {pastLeaves.length > 10 && (
              <p className="text-xs text-border px-4">
                ... et {pastLeaves.length - 10} autre(s)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
