import type { PlanningData } from "@/lib/types/database";

interface PlanningStatsProps {
  stats: PlanningData["stats"];
}

export function PlanningStats({ stats }: PlanningStatsProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm mb-4 text-sm">
      <StatItem
        label="Besoins"
        value={`${stats.filled}/${stats.totalNeeds}`}
        variant={stats.gaps > 0 ? "warning" : "success"}
      />
      {stats.gaps > 0 && (
        <StatItem label="Non remplis" value={stats.gaps} variant="danger" />
      )}
      <StatItem label="Proposés" value={stats.proposed} variant="muted" />
      <StatItem label="Confirmés" value={stats.confirmed} variant="info" />
      <StatItem label="Publiés" value={stats.published} variant="success" />
    </div>
  );
}

function StatItem({
  label,
  value,
  variant,
}: {
  label: string;
  value: number | string;
  variant: "success" | "warning" | "danger" | "info" | "muted";
}) {
  const colors = {
    success: "text-green-700",
    warning: "text-orange-600",
    danger: "text-red-600",
    info: "text-blue-600",
    muted: "text-gray-500",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500">{label}:</span>
      <span className={`font-semibold ${colors[variant]}`}>{value}</span>
    </div>
  );
}
