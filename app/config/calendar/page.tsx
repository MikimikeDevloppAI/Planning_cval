"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchHolidays, updateCalendarDay } from "@/lib/supabase/queries";
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

  const supabase = createClient();

  const { data: holidays, isLoading } = useQuery<HolidayEntry[]>({
    queryKey: ["config", "calendar", year],
    queryFn: () => fetchHolidays(supabase, year) as Promise<HolidayEntry[]>,
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
      return updateCalendarDay(supabase, date, { is_holiday, holiday_name });
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
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/config"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Configuration
          </Link>
          <span className="text-border">/</span>
          <h1 className="text-xl font-bold text-foreground">Calendrier</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(year - 1)}
            className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <span className="font-semibold text-foreground w-12 text-center">
            {year}
          </span>
          <button
            onClick={() => setYear(year + 1)}
            className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Jours fériés pour l&apos;année {year}. Ces jours seront exclus de la
        planification.
      </p>

      {/* Add new holiday */}
      {showAdd ? (
        <div className="bg-card rounded-xl shadow-soft border border-primary/20 p-4 mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Nom
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Noël, 1er Mai..."
              className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
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
            className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:bg-primary/5 rounded-xl mb-4 transition-colors"
        >
          <Star className="w-4 h-4" />
          Marquer un jour férié
        </button>
      )}

      {/* Holidays list */}
      <div className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden">
        {(holidays ?? []).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun jour férié configuré pour {year}
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {(holidays ?? []).map((h) => (
              <div
                key={h.date}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
              >
                <CalendarDays className="w-4 h-4 text-destructive" />
                <span className="text-sm text-muted-foreground w-28">{h.date}</span>
                <span className="text-sm font-medium text-foreground flex-1 capitalize">
                  {formatDate(h.date)}
                </span>
                {editingDate === h.date ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border border-border/50 bg-card px-2 py-1 text-sm w-40 focus:ring-2 focus:ring-ring outline-none"
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
                      className="text-success p-1"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingDate(null)}
                      className="text-muted-foreground p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {h.holiday_name ?? "—"}
                    </span>
                    <button
                      onClick={() => {
                        setEditingDate(h.date);
                        setEditName(h.holiday_name ?? "");
                      }}
                      className="text-muted-foreground hover:text-primary p-1"
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
                      className="text-muted-foreground hover:text-destructive p-1"
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
