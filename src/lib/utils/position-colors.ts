/**
 * Position color configurations for staff members.
 * All values are complete, static Tailwind class strings (Tailwind 4 JIT compatible).
 */

export interface PositionColors {
  bg: string;
  text: string;
  border: string;
  avatar: string;
  badge: string;
  ring: string;
  gradient: string;
}

const POSITION_COLORS: Record<number, PositionColors> = {
  1: {
    // Médecin
    bg: "bg-sky-50/50",
    text: "text-sky-700",
    border: "border-sky-200",
    avatar: "bg-sky-100 text-sky-700",
    badge: "bg-sky-100 text-sky-700",
    ring: "ring-sky-300",
    gradient: "from-sky-400 to-blue-500",
  },
  2: {
    // Secrétaire
    bg: "bg-emerald-50/50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    avatar: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-300",
    gradient: "from-emerald-400 to-green-500",
  },
  3: {
    // Obstétricienne
    bg: "bg-purple-50/50",
    text: "text-purple-700",
    border: "border-purple-200",
    avatar: "bg-purple-100 text-purple-700",
    badge: "bg-purple-100 text-purple-700",
    ring: "ring-purple-300",
    gradient: "from-purple-400 to-violet-500",
  },
};

const DEFAULT_COLORS = POSITION_COLORS[2];

export function getPositionColors(positionId: number): PositionColors {
  return POSITION_COLORS[positionId] ?? DEFAULT_COLORS;
}
