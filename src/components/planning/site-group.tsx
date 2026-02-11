"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { DepartmentRow } from "./department-row";
import { useAppStore } from "@/store/use-app-store";
import type { PlanningSite } from "@/lib/types/database";

interface SiteGroupProps {
  site: PlanningSite;
}

// Site header colors
const SITE_COLORS = [
  "bg-blue-700",
  "bg-emerald-700",
  "bg-purple-700",
  "bg-red-700",
  "bg-amber-700",
];

export function SiteGroup({ site }: SiteGroupProps) {
  const collapsed = useAppStore((s) => s.collapsedSites.has(site.id_site));
  const toggle = useAppStore((s) => s.toggleSiteCollapse);

  // Cycle through colors based on site id
  const colorClass = SITE_COLORS[(site.id_site - 1) % SITE_COLORS.length];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Site header */}
      <button
        onClick={() => toggle(site.id_site)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2 text-white font-semibold text-sm",
          colorClass
        )}
      >
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            collapsed && "-rotate-90"
          )}
        />
        <span className="uppercase tracking-wide">{site.name}</span>
        <span className="text-xs font-normal opacity-70 ml-auto">
          {site.departments.length} département{site.departments.length > 1 ? "s" : ""}
        </span>
      </button>

      {/* Departments */}
      {!collapsed && (
        <div>
          {site.departments.map((dept) => (
            <DepartmentRow key={dept.id_department} department={dept} />
          ))}
        </div>
      )}
    </div>
  );
}
