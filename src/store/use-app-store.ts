import { create } from "zustand";
import { startOfISOWeek, addWeeks, subWeeks } from "date-fns";

interface AppState {
  // Navigation semaine
  weekStart: Date;
  setWeek: (d: Date) => void;
  nextWeek: () => void;
  prevWeek: () => void;

  // Filtres
  filters: {
    siteIds: number[];
    statusFilter: string | null;
    showGapsOnly: boolean;
  };
  setFilters: (f: Partial<AppState["filters"]>) => void;

  // UI
  collapsedSites: Set<number>;
  toggleSiteCollapse: (id: number) => void;

  // Dialogs
  absenceDialog: { open: boolean; staffId?: number; date?: string; period?: string };
  openAbsenceDialog: (opts?: { staffId?: number; date?: string; period?: string }) => void;
  closeAbsenceDialog: () => void;

  solverDialog: { open: boolean };
  openSolverDialog: () => void;
  closeSolverDialog: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  weekStart: startOfISOWeek(new Date()),
  setWeek: (d) => set({ weekStart: startOfISOWeek(d) }),
  nextWeek: () => set((s) => ({ weekStart: addWeeks(s.weekStart, 1) })),
  prevWeek: () => set((s) => ({ weekStart: subWeeks(s.weekStart, 1) })),

  // Filtres
  filters: { siteIds: [], statusFilter: null, showGapsOnly: false },
  setFilters: (f) =>
    set((s) => ({ filters: { ...s.filters, ...f } })),

  // UI
  collapsedSites: new Set(),
  toggleSiteCollapse: (id) =>
    set((s) => {
      const next = new Set(s.collapsedSites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedSites: next };
    }),

  // Absence dialog
  absenceDialog: { open: false },
  openAbsenceDialog: (opts) =>
    set({ absenceDialog: { open: true, ...opts } }),
  closeAbsenceDialog: () =>
    set({ absenceDialog: { open: false } }),

  // Solver dialog
  solverDialog: { open: false },
  openSolverDialog: () => set({ solverDialog: { open: true } }),
  closeSolverDialog: () => set({ solverDialog: { open: false } }),
}));
