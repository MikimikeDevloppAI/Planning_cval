"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/use-app-store";
import { toISODate } from "@/lib/utils/dates";
import type { PlanningData } from "@/lib/types/database";

async function fetchPlanning(weekStart: string): Promise<PlanningData> {
  const res = await fetch(`/api/planning?weekStart=${weekStart}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to fetch planning data");
  }
  return res.json();
}

export function usePlanningData() {
  const weekStart = useAppStore((s) => s.weekStart);
  const weekStartStr = toISODate(weekStart);

  return useQuery({
    queryKey: ["planning", weekStartStr],
    queryFn: () => fetchPlanning(weekStartStr),
  });
}
