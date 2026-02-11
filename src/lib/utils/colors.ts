// ============================================================
// Couleurs par rôle et statut — identiques au weekly_view.py
// ============================================================

export interface RoleColors {
  bg: string;
  border: string;
  text: string;
  avatar: string;
}

// Couleurs des rôles de secrétaires
export const ROLE_COLORS: Record<number, RoleColors> = {
  1: {
    // Standard
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-700",
    avatar: "bg-green-500",
  },
  2: {
    // Fermeture
    bg: "bg-pink-50",
    border: "border-pink-300",
    text: "text-pink-700",
    avatar: "bg-pink-500",
  },
  3: {
    // Aide fermeture
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
    avatar: "bg-orange-500",
  },
};

// Couleurs médecin
export const DOCTOR_COLORS: RoleColors = {
  bg: "bg-blue-50",
  border: "border-blue-300",
  text: "text-blue-700",
  avatar: "bg-blue-500",
};

// Couleurs admin
export const ADMIN_COLORS: RoleColors = {
  bg: "bg-purple-50",
  border: "border-purple-300",
  text: "text-purple-700",
  avatar: "bg-purple-500",
};

// Couleurs chirurgie (autre)
export const SURGERY_COLORS: RoleColors = {
  bg: "bg-gray-50",
  border: "border-gray-300",
  text: "text-gray-600",
  avatar: "bg-gray-500",
};

// Default fallback
const DEFAULT_COLORS: RoleColors = {
  bg: "bg-gray-50",
  border: "border-gray-300",
  text: "text-gray-600",
  avatar: "bg-gray-400",
};

export function getRoleColors(
  assignmentType: "DOCTOR" | "SECRETARY",
  roleId: number | null,
  blockType?: string
): RoleColors {
  if (assignmentType === "DOCTOR") return DOCTOR_COLORS;
  if (blockType === "ADMIN") return ADMIN_COLORS;
  if (blockType === "SURGERY") return SURGERY_COLORS;
  if (roleId && ROLE_COLORS[roleId]) return ROLE_COLORS[roleId];
  return DEFAULT_COLORS;
}

// Bordures selon le statut
export function getStatusBorder(status: string): string {
  switch (status) {
    case "PROPOSED":
      return "border-dashed";
    case "CONFIRMED":
      return "border-solid";
    case "PUBLISHED":
      return "border-solid border-2";
    default:
      return "border-solid";
  }
}
