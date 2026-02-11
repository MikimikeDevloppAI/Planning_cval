import { cn } from "@/lib/utils";
import { ROLE_SHORT } from "@/lib/constants";

interface RoleBadgeProps {
  roleName: string | null;
}

export function RoleBadge({ roleName }: RoleBadgeProps) {
  if (!roleName) return null;

  const short = ROLE_SHORT[roleName] ?? roleName;

  return (
    <span className="text-[9px] font-semibold uppercase opacity-70">
      {short}
    </span>
  );
}
