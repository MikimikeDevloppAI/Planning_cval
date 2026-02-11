// ============================================================
// Constantes et mappings pour l'application CVAL
// ============================================================

// Jours de la semaine en français
export const JOUR_LABELS: Record<number, string> = {
  0: "Dimanche",
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
};

export const JOUR_SHORT: Record<number, string> = {
  0: "Dim",
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
};

// Abréviations des rôles
export const ROLE_SHORT: Record<string, string> = {
  Standard: "Std",
  Fermeture: "Ferm",
  "Aide fermeture": "AidF",
};

// Positions
export const POSITION_LABELS: Record<number, string> = {
  1: "Médecin",
  2: "Secrétaire",
  3: "Obstétricienne",
};

// Statuts
export const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Proposé",
  CONFIRMED: "Confirmé",
  PUBLISHED: "Publié",
  CANCELLED: "Annulé",
  INVALIDATED: "Invalidé",
};

// Préférences
export const PREFERENCE_LABELS: Record<string, string> = {
  INTERDIT: "Interdit",
  EVITER: "Éviter",
  PREFERE: "Préféré",
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  SITE: "Site",
  DEPARTMENT: "Département",
  STAFF: "Personnel",
  ROLE: "Rôle",
};

// Navigation sidebar
export const NAV_ITEMS = [
  { href: "/planning", label: "Planning", icon: "Calendar" },
  { href: "/staff", label: "Personnel", icon: "Users" },
  { href: "/config", label: "Configuration", icon: "Settings" },
] as const;

export const CONFIG_ITEMS = [
  { href: "/config/sites", label: "Sites & Départements", icon: "Building2" },
  { href: "/config/roles", label: "Rôles", icon: "Shield" },
  { href: "/config/skills", label: "Compétences", icon: "Award" },
  { href: "/config/tiers", label: "Paliers staffing", icon: "Layers" },
  { href: "/config/calendar", label: "Calendrier", icon: "CalendarDays" },
] as const;
