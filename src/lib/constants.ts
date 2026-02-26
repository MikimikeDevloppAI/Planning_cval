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

// IDs virtuels pour le planning (sites/départements synthétiques)
export const VIRTUAL_SITE_ADMIN = -2;
export const VIRTUAL_SITE_SURGERY = -1;
export const VIRTUAL_DEPT_ADMIN = -2000;
export const VIRTUAL_DEPT_SURGERY = -1000;

// Noms de départements spéciaux
export const DEPT_ADMINISTRATION = "Administration";
export const DEPT_BLOC_OPERATOIRE = "Bloc opératoire";

// Tags de rôle secrétaire (pour chips planning)
// Role 1 = Standard (pas de tag), Role 2 = Fermeture, Role 3 = Aide fermeture
export const ROLE_TAG: Record<number, string> = { 2: "1f", 3: "2f" };

// Abréviations de sites (affichage compact)
export const SITE_ABBREV: Record<string, string> = {
  "clinique la vallée": "CVAL",
  "porrentruy": "PTY",
};

// Labels période
export const PERIOD_LABELS: Record<string, string> = {
  AM: "Matin",
  PM: "Après-midi",
  DAY: "Journée",
  FULL_DAY: "Journée",
  FULL: "Journée",
};

// Ordre tri périodes
export const PERIOD_ORDER: Record<string, number> = { AM: 0, DAY: 1, FULL_DAY: 1, PM: 2 };

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
