"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/use-app-store";
import { toISODate } from "@/lib/utils/dates";
import { createClient } from "@/lib/supabase/client";
import { fetchWeekPlanning } from "@/lib/supabase/queries";

export function usePlanningData() {
  const weekStart = useAppStore((s) => s.weekStart);
  const weekStartStr = toISODate(weekStart);
  const supabase = createClient();

  return useQuery({
    queryKey: ["planning", weekStartStr],
    queryFn: () => fetchWeekPlanning(supabase, weekStartStr),
  });
}
