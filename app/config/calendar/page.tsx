"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

interface HolidayEntry {
  id_calendar: number;
  date: string;
  day_of_week: string;
  is_holiday: boolean;
  holiday_name: string | null;
}

export default function CalendarConfigPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: holidays, isLoading } = useQuery<HolidayEntry[]>({
    queryKey: ["config", "calendar", year],
    queryFn: async () => {
      const res = await fetch(`/api/config/calendar?year=${year}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const updateHoliday = useMutation({
    mutationFn: async ({
      date,
      is_holiday,
      holiday_name,
    }: {
      date: string;
      is_holiday: boolean;
      holiday_name: string | null;
    }) => {
      const res = await fetch("/api/config/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, is_holiday, holiday_name }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "calendar", year] });
      setEditingDate(null);
    },
  });

  const formatDate = (d: string) => {
    try {
      return format(parseISO(d), "EEEE d MMMM", { locale: fr });
    } catch {
      return d;
    }
  };

  // Group by month
  const byMonth = new Map<number, HolidayEntry[]>();
  for (const h of holidays ?? []) {
    const month = parseISO(h.date).getMonth();
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(h);
  }

  const MONTHS = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/config"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Configuration
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">Calendrier</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(year - 1)}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 w-12 text-center">
            {year}
          </span>
          <button
            onClick={() => setYear(year + 1)}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Jours fériés pour l&apos;année {year}. Ces jours seront exclus de la
        planification.
      </p>

      {/* Add new holiday */}
      {showAdd ? (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nom
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Noël, 1er Mai..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => {
              if (newDate)
                updateHoliday.mutate({
                  date: newDate,
                  is_holiday: true,
                  holiday_name: newName || null,
                });
              setShowAdd(false);
              setNewDate("");
              setNewName("");
            }}
            disabled={!newDate}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg mb-4"
        >
          <Star className="w-4 h-4" />
          Marquer un jour férié
        </button>
      )}

      {/* Holidays list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {(holidays ?? []).length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucun jour férié configuré pour {year}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(holidays ?? []).map((h) => (
              <div
                key={h.date}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <CalendarDays className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-500 w-28">{h.date}</span>
                <span className="text-sm font-medium text-gray-800 flex-1 capitalize">
                  {formatDate(h.date)}
                </span>
                {editingDate === h.date ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-40"
                      autoFocus
                    />
                    <button
                      onClick={() =>
                        updateHoliday.mutate({
                          date: h.date,
                          is_holiday: true,
                          holiday_name: editName || null,
                        })
                      }
                      className="text-green-600 p-1"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingDate(null)}
                      className="text-gray-400 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-600">
                      {h.holiday_name ?? "—"}
                    </span>
                    <button
                      onClick={() => {
                        setEditingDate(h.date);
                        setEditName(h.holiday_name ?? "");
                      }}
                      className="text-gray-400 hover:text-blue-600 p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        updateHoliday.mutate({
                          date: h.date,
                          is_holiday: false,
                          holiday_name: null,
                        })
                      }
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Retirer le jour férié"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
