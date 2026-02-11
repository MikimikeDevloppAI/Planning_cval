"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Users,
  Settings,
  Building2,
  Shield,
  Award,
  Layers,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

const iconMap = {
  Calendar,
  Users,
  Settings,
  Building2,
  Shield,
  Award,
  Layers,
  CalendarDays,
} as const;

const NAV_ITEMS = [
  { href: "/planning", label: "Planning", icon: "Calendar" as const },
  { href: "/staff", label: "Personnel", icon: "Users" as const },
];

const CONFIG_ITEMS = [
  { href: "/config/sites", label: "Sites & Départements", icon: "Building2" as const },
  { href: "/config/roles", label: "Rôles", icon: "Shield" as const },
  { href: "/config/skills", label: "Compétences", icon: "Award" as const },
  { href: "/config/tiers", label: "Paliers staffing", icon: "Layers" as const },
  { href: "/config/calendar", label: "Calendrier", icon: "CalendarDays" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const [configOpen, setConfigOpen] = useState(pathname.startsWith("/config"));

  return (
    <aside className="w-56 bg-primary-800 text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight">CVAL Planning</h1>
        <p className="text-xs text-white/50 mt-0.5">Gestion des secrétaires</p>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Config section */}
        <div className="pt-2">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full transition-colors",
              pathname.startsWith("/config")
                ? "bg-white/15 text-white font-medium"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Configuration</span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform",
                configOpen && "rotate-180"
              )}
            />
          </button>

          {configOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5">
              {CONFIG_ITEMS.map((item) => {
                const Icon = iconMap[item.icon];
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-colors",
                      active
                        ? "bg-white/15 text-white font-medium"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 text-xs text-white/40">
        CVAL v2.0
      </div>
    </aside>
  );
}
