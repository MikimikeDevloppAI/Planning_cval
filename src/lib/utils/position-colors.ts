/**
 * Position color configurations for staff members.
 * Harmonized palette based on primary #4A6FA5.
 */

export interface PositionColors {
  bg: string;
  text: string;
  border: string;
  avatar: string;
  badge: string;
  ring: string;
  gradient: string;
  hex: string;
  hexLight: string;
}

const POSITION_COLORS: Record<number, PositionColors> = {
  1: {
    // Médecin — Navy (= primary)
    bg: "bg-[#EEF3F9]",
    text: "text-[#2C5282]",
    border: "border-[#B8CCE4]",
    avatar: "bg-[#4A6FA5] text-white",
    badge: "bg-[#EEF3F9] text-[#2C5282] border border-[#B8CCE4]",
    ring: "ring-[#7FA3CF]",
    gradient: "from-[#4A6FA5] to-[#3B5998]",
    hex: "#4A6FA5",
    hexLight: "#EEF3F9",
  },
  2: {
    // Secrétaire — Sage/Teal
    bg: "bg-[#F0F5F3]",
    text: "text-[#3D5A4C]",
    border: "border-[#C2D4CB]",
    avatar: "bg-[#6B8A7A] text-white",
    badge: "bg-[#F0F5F3] text-[#3D5A4C] border border-[#C2D4CB]",
    ring: "ring-[#9BB5A8]",
    gradient: "from-[#6B8A7A] to-[#5A7A6A]",
    hex: "#6B8A7A",
    hexLight: "#F0F5F3",
  },
  3: {
    // Obstétricienne — Mauve
    bg: "bg-[#F5F0F7]",
    text: "text-[#6B4C7A]",
    border: "border-[#D4C2DD]",
    avatar: "bg-[#9B7BA8] text-white",
    badge: "bg-[#F5F0F7] text-[#6B4C7A] border border-[#D4C2DD]",
    ring: "ring-[#BFA5CB]",
    gradient: "from-[#9B7BA8] to-[#8B6B98]",
    hex: "#9B7BA8",
    hexLight: "#F5F0F7",
  },
};

const DEFAULT_COLORS = POSITION_COLORS[2];

export function getPositionColors(positionId: number): PositionColors {
  return POSITION_COLORS[positionId] ?? DEFAULT_COLORS;
}
