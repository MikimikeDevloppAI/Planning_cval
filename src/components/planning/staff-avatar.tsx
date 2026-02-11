import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/initials";

interface StaffAvatarProps {
  firstname: string;
  lastname: string;
  colorClass: string;
  size?: "sm" | "md";
}

export function StaffAvatar({
  firstname,
  lastname,
  colorClass,
  size = "sm",
}: StaffAvatarProps) {
  const initials = getInitials(firstname, lastname);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-bold shrink-0",
        colorClass,
        size === "sm" && "w-5 h-5 text-[10px]",
        size === "md" && "w-7 h-7 text-xs"
      )}
    >
      {initials}
    </span>
  );
}
