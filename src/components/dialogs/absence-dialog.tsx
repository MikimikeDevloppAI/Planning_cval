"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useQueryClient } from "@tanstack/react-query";
import { toISODate } from "@/lib/utils/dates";
import { X } from "lucide-react";

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

  useEffect(() => {
    if (open) {
      fetch("/api/staff?active=true")
        .then((r) => r.json())
        .then((data) => setStaffList(Array.isArray(data) ? data : []));

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
      const res = await fetch(`/api/staff/${selectedStaffId}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          period: period || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Déclarer une absence
          </h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Staff selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personnel
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date début
              </label>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate) setEndDate(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date fin
              </label>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Période
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
              className={`text-sm p-3 rounded-md ${
                result.startsWith("Erreur")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {result}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={close}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {result ? "Fermer" : "Annuler"}
            </button>
            {!result && (
              <button
                onClick={handleSubmit}
                disabled={!selectedStaffId || !startDate || !endDate || loading}
                className="px-4 py-2 text-sm rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
