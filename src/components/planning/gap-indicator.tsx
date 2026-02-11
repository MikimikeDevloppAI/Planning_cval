import { ROLE_SHORT } from "@/lib/constants";
import type { StaffingNeed } from "@/lib/types/database";

interface GapIndicatorProps {
  need: StaffingNeed;
}

export function GapIndicator({ need }: GapIndicatorProps) {
  const roleLabel = need.role_name
    ? ROLE_SHORT[need.role_name] ?? need.role_name
    : need.skill_name ?? "?";

  return (
    <div className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border border-dashed border-red-300 bg-red-50 text-red-700">
      <span>+{need.gap}</span>
      <span>{roleLabel}</span>
    </div>
  );
}
