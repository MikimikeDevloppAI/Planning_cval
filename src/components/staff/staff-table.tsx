"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStaffList } from "@/hooks/use-staff";
import { POSITION_LABELS } from "@/lib/constants";
import { getInitials } from "@/lib/utils/initials";
import { getPositionColors } from "@/lib/utils/position-colors";
import { cn } from "@/lib/utils";
import {
  Search,
  Loader2,
  UserCircle2,
  ChevronRight,
} from "lucide-react";

export function StaffTable() {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<number | "">("");
  const [activeFilter, setActiveFilter] = useState<string>("true");

  const { data: staffList, isLoading, error } = useStaffList({
    position: posFilter ? posFilter : undefined,
    active: activeFilter,
  });
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!staffList) return [];
    let list = [...staffList];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s: Record<string, unknown>) =>
          (s.lastname as string).toLowerCase().includes(q) ||
          (s.firstname as string).toLowerCase().includes(q)
      );
    }

    list.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      (a.lastname as string).localeCompare(b.lastname as string)
    );

    return list;
  }, [staffList, search]);

  // Group by position
  const grouped = useMemo(() => {
    const groups = new Map<number, typeof filtered>();
    for (const s of filtered) {
      const pos = s.id_primary_position as number;
      if (!groups.has(pos)) groups.set(pos, []);
      groups.get(pos)!.push(s);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  return (
    <div>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border/50 bg-card focus:ring-2 focus:ring-ring focus:border-ring outline-none"
          />
        </div>

        {/* Position pill tabs with colored dots */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border/30">
          <button
            onClick={() => setPosFilter("")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              posFilter === ""
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tous
          </button>
          {([1, 2, 3] as const).map((id) => {
            const posColors = getPositionColors(id);
            return (
              <button
                key={id}
                onClick={() => setPosFilter(posFilter === id ? "" : id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                  posFilter === id
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: posColors.hex }}
                />
                {POSITION_LABELS[id]}s
              </button>
            );
          })}
        </div>

        {/* Active pill tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border/30">
          {([
            { value: "true", label: "Actifs" },
            { value: "false", label: "Inactifs" },
            { value: "all", label: "Tous" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                activeFilter === opt.value
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <span className="text-sm text-muted-foreground">
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">
          {error.message}
        </div>
      )}

      {/* Cards */}
      {!isLoading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <UserCircle2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium">Aucun résultat</p>
              <p className="text-xs mt-1">Essayez de modifier vos filtres</p>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(([posId, members]) => {
                const colors = getPositionColors(posId);
                return (
                  <section key={posId}>
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-1.5 h-8 rounded-full"
                        style={{ background: `linear-gradient(to bottom, ${colors.hex}, ${colors.hex}cc)` }}
                      />
                      <h3 className="text-sm font-semibold text-foreground">
                        {POSITION_LABELS[posId]}s
                      </h3>
                      <span
                        className={cn(
                          "text-xs font-medium rounded-full px-2.5 py-0.5",
                          colors.badge
                        )}
                      >
                        {members.length}
                      </span>
                    </div>

                    {/* Card grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {members.map((staff) => (
                        <StaffListCard
                          key={staff.id_staff as number}
                          staff={staff}
                          onClick={() =>
                            router.push(`/staff/${staff.id_staff}`)
                          }
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Staff list card ─────────────────────────────────────

function StaffListCard({
  staff,
  onClick,
}: {
  staff: Record<string, unknown>;
  onClick: () => void;
}) {
  const posId = staff.id_primary_position as number;
  const colors = getPositionColors(posId);
  const positionName =
    (staff.positions as { name: string } | null)?.name ?? "—";
  const settings = staff.staff_secretary_settings as {
    is_flexible?: boolean;
    full_day_only?: boolean;
    admin_target?: number;
  } | null;
  const initials = getInitials(
    staff.firstname as string,
    staff.lastname as string
  );
  const isActive = staff.is_active as boolean;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-2xl border border-border/40 overflow-hidden",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]",
        "cursor-pointer transition-all duration-300 ease-out",
        "hover:-translate-y-1.5 hover:border-border/80",
        "animate-fade-in-up"
      )}
    >
      {/* Top gradient bar — always visible */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(to right, ${colors.hex}, ${colors.hex}cc)` }}
      />

      <div className="p-5">
        {/* Avatar + Name */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
              "shadow-sm transition-all duration-300",
              "group-hover:shadow-md group-hover:scale-105",
              colors.avatar
            )}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {staff.lastname as string} {staff.firstname as string}
            </h4>

            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold",
                  colors.badge
                )}
              >
                {positionName}
              </span>

              {isActive ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-success bg-success/8">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
                  Actif
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground">
                  Inactif
                </span>
              )}
            </div>
          </div>

          {/* Hover chevron */}
          <ChevronRight className="w-4 h-4 text-border group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>

        {/* Secretary settings badges */}
        {posId === 2 && settings && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3.5 pt-3 border-t border-border/20">
            {settings.is_flexible && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FFF8E7] text-[#B8860B] border border-[#F0DBA0]/50">
                Flexible
              </span>
            )}
            {settings.full_day_only && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#EEF3F9] text-[#4A6FA5] border border-[#B8CCE4]/50">
                JC uniquement
              </span>
            )}
            {(settings.admin_target ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#F5F0F7] text-[#6B4C7A] border border-[#D4C2DD]/50">
                Admin: {settings.admin_target}/sem
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
