"use client";

import { useMemo, useState, useRef } from "react";
import { eachDayOfInterval, parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, BarChart3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWeekStart, getWeekDays, toISODate, addWeeks, formatDayShort } from "@/lib/utils/dates";

// ── Types ────────────────────────────────────────────────

interface LeaveRow {
  id_absence: number;
  id_staff: number;
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
  staff: { firstname: string; lastname: string; id_primary_position: number } | null;
}

interface AbsenceHeatmapProps {
  leaves: LeaveRow[];
}

interface AbsentPerson {
  name: string;
  period: "AM" | "PM" | null;
}

// ── Helpers ──────────────────────────────────────────────

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const WEEKS_VISIBLE = 6;

const CATEGORIES = [
  { key: "doctor" as const, label: "Méd.", color: "#4A6FA5", positions: [1, 3] },
  { key: "secretary" as const, label: "Sec.", color: "#6B8A7A", positions: [2] },
];

type CatKey = "doctor" | "secretary";

interface DayData {
  count: number;
  names: AbsentPerson[];
}

function buildDetailedMap(leaves: LeaveRow[]): Map<string, DayData> {
  const map = new Map<string, DayData>();
  for (const leave of leaves) {
    if (!leave.staff) continue;
    try {
      const days = eachDayOfInterval({
        start: parseISO(leave.start_date),
        end: parseISO(leave.end_date),
      });
      const weight = leave.period ? 0.5 : 1;
      const name = `${leave.staff.lastname} ${leave.staff.firstname}`;
      for (const d of days) {
        const key = toISODate(d);
        if (!map.has(key)) map.set(key, { count: 0, names: [] });
        const entry = map.get(key)!;
        entry.count += weight;
        entry.names.push({ name, period: leave.period });
      }
    } catch {
      // Skip invalid date ranges
    }
  }
  return map;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ── Tooltip ─────────────────────────────────────────────

function CellTooltip({ names, color }: { names: AbsentPerson[]; color: string }) {
  if (names.length === 0) return null;
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none">
      <div className="bg-slate-800 text-white rounded-lg shadow-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap">
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span>{n.name}</span>
            {n.period && (
              <span className="text-slate-400 text-[10px]">
                ({n.period === "AM" ? "matin" : "après-midi"})
              </span>
            )}
          </div>
        ))}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

// ── HeatCell ────────────────────────────────────────────

function HeatCell({
  count,
  names,
  maxCount,
  color,
  rgb,
}: {
  count: number;
  names: AbsentPerson[];
  maxCount: number;
  color: string;
  rgb: { r: number; g: number; b: number };
}) {
  const [hovered, setHovered] = useState(false);
  const intensity = count / maxCount;
  const isHigh = intensity > 0.6;

  return (
    <td className="px-0.5 py-0.5">
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-md h-[28px] min-w-[36px] text-[11px] tabular-nums transition-colors cursor-default",
            count === 0
              ? "text-muted-foreground/30"
              : isHigh
                ? "text-white font-bold"
                : "text-slate-700 font-medium"
          )}
          style={
            count > 0
              ? { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.08 + intensity * 0.52})` }
              : { backgroundColor: "rgba(0,0,0,0.02)" }
          }
        >
          {count > 0 ? (Number.isInteger(count) ? count : count.toFixed(1)) : "–"}
        </div>
        {hovered && count > 0 && <CellTooltip names={names} color={color} />}
      </div>
    </td>
  );
}

// ── Main Component ──────────────────────────────────────

export function AbsenceHeatmap({ leaves }: AbsenceHeatmapProps) {
  const [expanded, setExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Split leaves by category
  const leavesByCat = useMemo(() => {
    const result: Record<CatKey, LeaveRow[]> = { doctor: [], secretary: [] };
    for (const leave of leaves) {
      const pos = leave.staff?.id_primary_position;
      if (pos === 1 || pos === 3) result.doctor.push(leave);
      else if (pos === 2) result.secretary.push(leave);
    }
    return result;
  }, [leaves]);

  // Build detailed maps
  const dataByCat = useMemo(() => ({
    doctor: buildDetailedMap(leavesByCat.doctor),
    secretary: buildDetailedMap(leavesByCat.secretary),
  }), [leavesByCat]);

  // Generate weeks
  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);
  const currentWeekKey = toISODate(currentWeekStart);

  const weeks = useMemo(() => {
    const result: { weekStart: Date; days: Date[]; key: string; dateLabel: string }[] = [];
    const base = addWeeks(currentWeekStart, weekOffset - 2);
    for (let i = 0; i < WEEKS_VISIBLE; i++) {
      const ws = addWeeks(base, i);
      const days = getWeekDays(ws);
      result.push({
        weekStart: ws,
        days,
        key: toISODate(ws),
        dateLabel: `${formatDayShort(days[0])} – ${formatDayShort(days[5])}`,
      });
    }
    return result;
  }, [currentWeekStart, weekOffset]);

  // Max counts per category (for intensity scale)
  const maxByCat = useMemo(() => {
    const result: Record<CatKey, number> = { doctor: 1, secretary: 1 };
    for (const cat of CATEGORIES) {
      let max = 0;
      const data = dataByCat[cat.key];
      for (const week of weeks) {
        for (const day of week.days) {
          const d = data.get(toISODate(day));
          if (d && d.count > max) max = d.count;
        }
      }
      result[cat.key] = max || 1;
    }
    return result;
  }, [dataByCat, weeks]);

  // Navigation label
  const navLabel = useMemo(() => {
    const first = weeks[0].weekStart;
    const last = weeks[weeks.length - 1].weekStart;
    const fmtFirst = format(first, "MMM", { locale: fr });
    const fmtLast = format(last, "MMM yyyy", { locale: fr });
    if (fmtFirst === fmtLast.split(" ")[0]) return fmtLast;
    return `${fmtFirst} – ${fmtLast}`;
  }, [weeks]);

  return (
    <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden transition-all duration-300">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Vue hebdomadaire</span>
          <div className="flex items-center gap-1.5 ml-2">
            {CATEGORIES.map((cat) => (
              <span
                key={cat.key}
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground"
              >
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: cat.color }} />
                {cat.label}
              </span>
            ))}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Collapsible content */}
      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden transition-all duration-300",
          expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {/* Navigation */}
        <div className="flex items-center justify-end gap-2 px-5 py-2 border-t border-border/20">
          <button
            onClick={() => setWeekOffset((o) => o - WEEKS_VISIBLE)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-muted-foreground min-w-[120px] text-center capitalize">
            {navLabel}
          </span>
          <button
            onClick={() => setWeekOffset((o) => o + WEEKS_VISIBLE)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[10px] font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-medium text-muted-foreground px-2 py-1.5 w-[90px]" />
                <th className="text-center text-[10px] font-medium text-muted-foreground px-1 py-1.5 w-[32px]" />
                {DAY_LABELS.map((d) => (
                  <th
                    key={d}
                    className="text-center text-[10px] font-medium text-muted-foreground px-1 py-1.5 min-w-[44px]"
                  >
                    {d}
                  </th>
                ))}
                <th className="text-center text-[10px] font-medium text-muted-foreground px-2 py-1.5 min-w-[44px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => {
                const isCurrent = week.key === currentWeekKey;

                return CATEGORIES.map((cat, catIdx) => {
                  const data = dataByCat[cat.key];
                  const rgb = hexToRgb(cat.color);
                  const maxCount = maxByCat[cat.key];
                  let weekTotal = 0;

                  // Pre-compute total
                  for (const day of week.days) {
                    weekTotal += data.get(toISODate(day))?.count ?? 0;
                  }

                  return (
                    <tr
                      key={`${week.key}-${cat.key}`}
                      className={cn(
                        "transition-colors",
                        isCurrent && "bg-primary/[0.03]",
                        catIdx === CATEGORIES.length - 1 && "border-b border-border/15"
                      )}
                    >
                      {/* Date range — only on first row of each week */}
                      {catIdx === 0 ? (
                        <td
                          className="px-2 py-0.5 align-middle"
                          rowSpan={CATEGORIES.length}
                        >
                          <div className="flex items-center gap-1.5">
                            {isCurrent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-[11px]",
                                isCurrent
                                  ? "font-semibold text-foreground"
                                  : "text-muted-foreground"
                              )}
                            >
                              {week.dateLabel}
                            </span>
                          </div>
                        </td>
                      ) : null}

                      {/* Category indicator */}
                      <td className="px-1 py-0.5">
                        <div className="flex items-center justify-center">
                          <span
                            className="w-2 h-2 rounded-sm"
                            style={{ backgroundColor: cat.color }}
                            title={cat.label}
                          />
                        </div>
                      </td>

                      {/* Day cells */}
                      {week.days.map((day) => {
                        const key = toISODate(day);
                        const dayData = data.get(key);
                        const count = dayData?.count ?? 0;
                        const names = dayData?.names ?? [];

                        return (
                          <HeatCell
                            key={key}
                            count={count}
                            names={names}
                            maxCount={maxCount}
                            color={cat.color}
                            rgb={rgb}
                          />
                        );
                      })}

                      {/* Week total */}
                      <td className="px-1 py-0.5">
                        <div
                          className={cn(
                            "flex items-center justify-center rounded-md h-[28px] min-w-[40px] text-[11px] tabular-nums font-semibold",
                            weekTotal > 0 ? "text-foreground" : "text-muted-foreground/30"
                          )}
                        >
                          {weekTotal > 0 ? (Number.isInteger(weekTotal) ? weekTotal : weekTotal.toFixed(1)) : "–"}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
