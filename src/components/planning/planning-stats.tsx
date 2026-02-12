"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Clock, Send, BarChart3 } from "lucide-react";

interface StatsData {
  totalNeeds: number;
  filled: number;
  gaps: number;
  proposed: number;
  confirmed: number;
  published: number;
}

interface PlanningStatsProps {
  stats: StatsData;
}

export function PlanningStats({ stats }: PlanningStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      <StatsCard
        icon={<BarChart3 className="w-5 h-5" />}
        value={stats.filled}
        label={`Remplis / ${stats.totalNeeds}`}
        gradient="from-cyan-500 to-blue-600"
      />
      <StatsCard
        icon={<AlertCircle className="w-5 h-5" />}
        value={stats.gaps}
        label="Non remplis"
        gradient="from-red-500 to-rose-600"
      />
      <StatsCard
        icon={<Clock className="w-5 h-5" />}
        value={stats.proposed}
        label="Proposés"
        gradient="from-amber-500 to-orange-600"
      />
      <StatsCard
        icon={<CheckCircle2 className="w-5 h-5" />}
        value={stats.confirmed}
        label="Confirmés"
        gradient="from-teal-500 to-emerald-600"
      />
      <StatsCard
        icon={<Send className="w-5 h-5" />}
        value={stats.published}
        label="Publiés"
        gradient="from-violet-500 to-purple-600"
      />
    </div>
  );
}

function StatsCard({
  icon,
  value,
  label,
  gradient,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  gradient: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    let start = 0;
    const duration = 1000;
    const increment = value / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-6",
        "bg-card/50 backdrop-blur-xl border border-border/50",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1"
      )}
    >
      {/* Gradient Glow */}
      <div
        className={cn(
          "absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20",
          `bg-gradient-to-br ${gradient}`
        )}
      />

      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {label}
          </p>
          <p
            className={cn(
              "text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
              gradient
            )}
          >
            {displayValue}
          </p>
        </div>

        {/* Icon */}
        <div
          className={cn(
            "p-3 rounded-lg bg-gradient-to-br shadow-lg",
            gradient
          )}
        >
          <div className="text-white">{icon}</div>
        </div>
      </div>
    </div>
  );
}
