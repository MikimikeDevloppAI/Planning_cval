"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchMonthPlanning, fetchMonthLeaves } from "@/lib/supabase/queries";
import { useAppStore } from "@/store/use-app-store";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  LayoutGrid,
  Users,
  UserX,
  RefreshCw,
  ChevronDown,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TabButton } from "@/components/ui/primary-button";
import { CustomSelect } from "@/components/ui/custom-select";
import { DepartmentsTableView } from "@/components/planning/departments-table-view";
import { CollaborateursTableView } from "@/components/planning/collaborateurs-table-view";
import type { PlanningSite } from "@/lib/types/database";

interface MonthPlanningData {
  days: string[];
  sites: PlanningSite[];
  stats: {
    totalNeeds: number;
    filled: number;
    gaps: number;
    proposed: number;
    confirmed: number;
    published: number;
  };
}

export default function PlanningPage() {
  const currentMonth = useAppStore((s) => s.currentMonth);
  const nextMonth = useAppStore((s) => s.nextMonth);
  const prevMonth = useAppStore((s) => s.prevMonth);
  const setMonth = useAppStore((s) => s.setMonth);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const openAbsence = useAppStore((s) => s.openAbsenceDialog);
  const openSolver = useAppStore((s) => s.openSolverDialog);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const monthStr = format(currentMonth, "yyyy-MM");
  const supabase = createClient();

  const { data, isLoading, error } = useQuery<MonthPlanningData>({
    queryKey: ["planning", "month", monthStr],
    queryFn: () => fetchMonthPlanning(supabase, monthStr) as Promise<MonthPlanningData>,
  });

  // Extend range to complete work-weeks matching fetchMonthPlanning
  const ms = startOfMonth(currentMonth);
  const me = endOfMonth(currentMonth);
  const msDay = ms.getDay(); // 0=Sun .. 6=Sat
  const meDay = me.getDay();
  const rangeStart = format(
    (msDay >= 2 && msDay <= 5) ? startOfWeek(ms, { weekStartsOn: 1 }) : ms,
    "yyyy-MM-dd"
  );
  const rangeEnd = format(
    (meDay >= 1 && meDay <= 4) ? addDays(endOfWeek(me, { weekStartsOn: 1 }), -1) : me,
    "yyyy-MM-dd"
  );

  const { data: leaves } = useQuery({
    queryKey: ["leaves", "month", monthStr],
    queryFn: () => fetchMonthLeaves(supabase, rangeStart, rangeEnd),
  });

  // Extract unique sites & departments for filter dropdowns
  const { siteOptions, deptOptions } = useMemo(() => {
    if (!data) return { siteOptions: [], deptOptions: [] };
    const sites = data.sites.map((s) => ({ id: s.id_site, name: s.name }));
    const depts = new Map<string, string>();
    for (const site of data.sites) {
      if (selectedSiteId !== null && site.id_site !== selectedSiteId) continue;
      for (const dept of site.departments) {
        depts.set(dept.name, dept.name);
      }
    }
    return {
      siteOptions: sites,
      deptOptions: Array.from(depts.values()).sort((a, b) => a.localeCompare(b)),
    };
  }, [data, selectedSiteId]);

  // Apply filters to sites data
  const filteredSites = useMemo(() => {
    if (!data) return [];
    let sites = data.sites;

    if (selectedSiteId !== null) {
      sites = sites.filter((s) => s.id_site === selectedSiteId);
    }

    if (selectedDeptName) {
      sites = sites
        .map((s) => ({
          ...s,
          departments: s.departments.filter((d) => d.name === selectedDeptName),
        }))
        .filter((s) => s.departments.length > 0);
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      sites = sites
        .map((s) => ({
          ...s,
          departments: s.departments.map((d) => ({
            ...d,
            days: d.days.map((day) => ({
              ...day,
              am: {
                ...day.am,
                blocks: day.am.blocks.map((b) => ({
                  ...b,
                  assignments: b.assignments.filter(
                    (a) =>
                      a.firstname.toLowerCase().includes(q) ||
                      a.lastname.toLowerCase().includes(q)
                  ),
                })),
              },
              pm: {
                ...day.pm,
                blocks: day.pm.blocks.map((b) => ({
                  ...b,
                  assignments: b.assignments.filter(
                    (a) =>
                      a.firstname.toLowerCase().includes(q) ||
                      a.lastname.toLowerCase().includes(q)
                  ),
                })),
              },
            })),
          })),
        }))
        .filter((s) => s.departments.length > 0);
    }

    return sites;
  }, [data, selectedSiteId, selectedDeptName, searchText]);

  const hasFilters = selectedSiteId !== null || selectedDeptName !== null || searchText.trim() !== "";

  const clearFilters = () => {
    setSelectedSiteId(null);
    setSelectedDeptName(null);
    setSearchText("");
  };

  const goToToday = () => {
    setMonth(startOfMonth(new Date()));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/30 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Month navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground capitalize min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: fr })}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Aujourd&apos;hui
            </button>
          </div>

          {/* Center: View tabs */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border/30">
            <TabButton
              active={viewMode === "departments"}
              onClick={() => setViewMode("departments")}
              icon={<LayoutGrid className="w-4 h-4" />}
            >
              Départements
            </TabButton>
            <TabButton
              active={viewMode === "collaborateurs"}
              onClick={() => setViewMode("collaborateurs")}
              icon={<Users className="w-4 h-4" />}
            >
              Collaborateurs
            </TabButton>
          </div>

          {/* Right: Actions dropdown */}
          <div className="relative">
            <button
              onClick={() => setActionsOpen(!actionsOpen)}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Actions</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {actionsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setActionsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-border/50 bg-card shadow-xl py-1">
                  <button
                    onClick={() => {
                      setActionsOpen(false);
                      openSolver();
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Optimiser le planning
                  </button>
                  <button
                    onClick={() => {
                      setActionsOpen(false);
                      openAbsence();
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <UserX className="w-4 h-4 text-warning" />
                    Déclarer une absence
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Filter bar — separated from header */}
      {data && (
        <div className="shrink-0 mx-4 mt-3 bg-card rounded-xl border border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

            {/* Site filter */}
            <CustomSelect
              options={siteOptions.map((s) => ({ value: String(s.id), label: s.name }))}
              value={selectedSiteId !== null ? String(selectedSiteId) : ""}
              onChange={(v) => {
                setSelectedSiteId(v ? Number(v) : null);
                setSelectedDeptName(null);
              }}
              placeholder="Tous les sites"
            />

            {/* Department filter */}
            <CustomSelect
              options={deptOptions.map((d) => ({ value: d, label: d }))}
              value={selectedDeptName ?? ""}
              onChange={(v) => setSelectedDeptName(v || null)}
              placeholder="Tous les départements"
            />

            {/* Person search */}
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Rechercher une personne..."
              className="h-8 px-2.5 text-sm rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 w-48"
            />

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Réinitialiser
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded" style={{ background: "#4A6FA5" }} />
                <span>Médecin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded" style={{ background: "#F8F9FA", border: "1px solid #D1D5DB" }} />
                <span>Secrétaire</span>
              </div>
              <div className="w-px h-4 bg-border/50" />
              <div className="flex items-center gap-1.5">
                <span className="w-[3px] h-4 rounded-full" style={{ background: "#eab308" }} />
                <span>Matin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-[3px] h-4 rounded-full" style={{ background: "#d97706" }} />
                <span>Après-midi</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 p-4">
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Chargement du planning...
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">
            Erreur: {(error as Error).message}
          </div>
        ) : data ? (
          <div className="h-full">
            {viewMode === "departments" ? (
              <DepartmentsTableView days={data.days} sites={filteredSites} leaves={leaves ?? []} />
            ) : (
              <CollaborateursTableView days={data.days} sites={filteredSites} leaves={leaves ?? []} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
