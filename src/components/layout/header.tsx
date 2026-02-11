"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/planning": "Planning Hebdomadaire",
  "/staff": "Personnel",
  "/config": "Configuration",
  "/config/sites": "Sites & Départements",
  "/config/roles": "Rôles",
  "/config/skills": "Compétences",
  "/config/tiers": "Paliers Staffing",
  "/config/calendar": "Calendrier",
};

export function Header() {
  const pathname = usePathname();

  // Find matching title (longest prefix match)
  let title = "CVAL";
  const keys = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname.startsWith(key)) {
      title = PAGE_TITLES[key];
      break;
    }
  }

  // Staff detail page
  if (pathname.match(/^\/staff\/\d+/)) {
    title = "Fiche Personnel";
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 shrink-0">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
    </header>
  );
}
