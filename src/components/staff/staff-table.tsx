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
  Users,
  Stethoscope,
  ClipboardList,
} from "lucide-react";

export function StaffTable() {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<number | "">("");
  const [activeFilter, setActiveFilter] = useState<string>("true");

  const { data: staffList, isLoading, error } = useStaffList({
    active: activeFilter,
  });
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!staffList) return [];
    let list = [...staffList];

    // Position filter — 1 includes obstétriciennes (3)
    if (posFilter) {
      if (posFilter === 1) {
        list = list.filter((s: Record<string, unknown>) => {
          const pos = s.id_primary_position as number;
          return pos === 1 || pos === 3;
        });
      } else {
        list = list.filter(
          (s: Record<string, unknown>) => s.id_primary_position === posFilter
        );
      }
    }

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
  }, [staffList, search, posFilter]);

  // Group by position — merge obstétriciennes (3) with médecins (1)
  const grouped = useMemo(() => {
    const groups = new Map<number, typeof filtered>();
    for (const s of filtered) {
      const pos = s.id_primary_position as number;
      const groupKey = pos === 3 ? 1 : pos; // obstétriciennes → médecins group
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(s);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  // Stats from full list (unfiltered by search/position, but respects active filter)
  const stats = useMemo(() => {
    if (!staffList) return { total: 0, doctors: 0, secretaries: 0 };
    const list = staffList as Record<string, unknown>[];
    return {
      total: list.length,
      doctors: list.filter((s) => {
        const p = s.id_primary_position as number;
        return p === 1 || p === 3;
      }).length,
      secretaries: list.filter((s) => s.id_primary_position === 2).length,
    };
  }, [staffList]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total personnel" value={stats.total} color="#9B7BA8" />
        <StatCard icon={Stethoscope} label="Médecins" value={stats.doctors} color="#4A6FA5" />
        <StatCard icon={ClipboardList} label="Secrétaires" value={stats.secretaries} color="#6B8A7A" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border/50 shadow-subtle px-4 py-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-sm bg-muted/50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="w-px h-5 bg-border/50" />

        {/* Position pill tabs — Médecins+Obstétriciennes merged */}
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setPosFilter("")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
              posFilter === ""
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tous
          </button>
          {([
            { id: 1, label: "Médecins" },
            { id: 2, label: "Secrétaires" },
          ] as const).map(({ id, label }) => {
            const posColors = getPositionColors(id);
            return (
              <button
                key={id}
                onClick={() => setPosFilter(posFilter === id ? "" : id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
                  posFilter === id
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: posColors.hex }}
                />
                {label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-border/50" />

        {/* Active pill tabs */}
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {([
            { value: "true", label: "Actifs" },
            { value: "false", label: "Inactifs" },
            { value: "all", label: "Tous" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
                activeFilter === opt.value
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <span className="text-xs text-muted-foreground">
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
                        {posId === 1 ? "Médecins & Obstétriciennes" : `${POSITION_LABELS[posId]}s`}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                      {members.map((staff, idx) => (
                        <StaffListCard
                          key={staff.id_staff as number}
                          staff={staff}
                          index={idx}
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

// ─── Stat card ───────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4",
        "bg-card border border-border/40",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]",
        "transition-all duration-300 group"
      )}
    >
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl group-hover:opacity-[0.12] transition-opacity"
        style={{ backgroundColor: color, opacity: 0.08 }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Staff list card (vertical premium) ─────────────────

function StaffListCard({
  staff,
  index,
  onClick,
}: {
  staff: Record<string, unknown>;
  index: number;
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
  const hasSecBadges =
    posId === 2 &&
    settings &&
    (settings.is_flexible || settings.full_day_only || (settings.admin_target ?? 0) > 0);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-2xl border border-border/30 overflow-hidden",
        "shadow-card hover:shadow-card-hover",
        "cursor-pointer transition-all duration-300 ease-out",
        "hover:-translate-y-2 hover:border-border/60",
        "animate-fade-in-up",
        "flex flex-col items-center"
      )}
      style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
    >
      {/* Gradient header band */}
      <div
        className="h-10 w-full relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${colors.hex}18, ${colors.hex}08, transparent)`,
        }}
      >
        <div
          className="absolute -top-4 -right-4 w-16 h-16 rounded-full"
          style={{ backgroundColor: colors.hex, opacity: 0.07 }}
        />
      </div>

      {/* Avatar — overlapping header */}
      <div className="-mt-5 relative z-10">
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold",
            "ring-2 ring-card shadow-md",
            "transition-all duration-300",
            "group-hover:shadow-lg group-hover:scale-105",
            colors.avatar
          )}
        >
          {initials}
        </div>
      </div>

      {/* Name + badges */}
      <div className="px-3 pt-2 pb-3 flex flex-col items-center text-center w-full">
        <h4 className="text-sm font-bold text-foreground truncate max-w-full group-hover:text-primary transition-colors leading-tight">
          {staff.lastname as string}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-full">
          {staff.firstname as string}
        </p>

        <div className="flex items-center gap-1.5 mt-2">
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

        {/* Secretary attribute pills */}
        {hasSecBadges && (
          <div className="flex flex-wrap items-center justify-center gap-1 mt-3">
            {settings!.is_flexible && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700/80 border border-amber-200/40">
                Flexible
              </span>
            )}
            {settings!.full_day_only && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-light text-primary/80 border border-primary/15">
                JC uniquement
              </span>
            )}
            {(settings!.admin_target ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F0F7] text-[#6B4C7A]/80 border border-[#D4C2DD]/40">
                Admin {settings!.admin_target}/sem
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover indicator — gradient line at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          backgroundImage: `linear-gradient(to right, transparent, ${colors.hex}, transparent)`,
        }}
      />
    </div>
  );
}
