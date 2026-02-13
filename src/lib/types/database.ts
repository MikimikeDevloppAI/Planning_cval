// ============================================================
// TypeScript types mirroring the PostgreSQL schema
// ============================================================

// Enums
export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type ScheduleType = "FIXED" | "AVAILABLE";
export type Period = "AM" | "PM";
export type PeriodFull = "AM" | "PM" | "FULL_DAY";
export type BlockType = "CONSULTATION" | "SURGERY" | "ADMIN";
export type AssignmentType = "DOCTOR" | "SECRETARY";
export type AssignmentSource = "SCHEDULE" | "ALGORITHM" | "MANUAL";
export type AssignmentStatus =
  | "PROPOSED"
  | "CONFIRMED"
  | "PUBLISHED"
  | "CANCELLED"
  | "INVALIDATED";
export type PreferenceLevel = "INTERDIT" | "EVITER" | "PREFERE";
export type TargetType = "SITE" | "DEPARTMENT" | "STAFF" | "ROLE";
export type IssueType = "DEFICIT" | "SURPLUS" | "ABSENCE_CONFLICT";

// Primary position: 1=Doctor, 2=Secretary, 3=Obstetricienne
export type PrimaryPosition = 1 | 2 | 3;

// ---- Core tables ----

export interface Site {
  id_site: number;
  name: string;
}

export interface Department {
  id_department: number;
  name: string;
  id_site: number;
  is_active: boolean;
}

export interface Staff {
  id_staff: number;
  lastname: string;
  firstname: string;
  id_primary_position: PrimaryPosition;
  is_active: boolean;
}

export interface SecretaryRole {
  id_role: number;
  name: string;
  hardship_weight: number;
}

export interface Skill {
  id_skill: number;
  name: string;
}

export interface CalendarDay {
  id_calendar: number;
  date: string;
  day_of_week: DayOfWeek;
  iso_week: number;
  is_weekend: boolean;
  is_holiday: boolean;
  holiday_name: string | null;
}

// ---- Scheduling ----

export interface StaffSchedule {
  id_schedule: number;
  id_staff: number;
  schedule_type: ScheduleType;
  day_of_week: number | null;
  period: PeriodFull;
  id_department: number | null;
  id_recurrence: number | null;
  id_activity: number | null;
  week_offset: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface StaffLeave {
  id_leave?: number;
  id_staff: number;
  start_date: string;
  end_date: string;
  period: Period | null;
}

export interface StaffSkill {
  id_staff: number;
  id_skill: number;
  preference: number; // 1-5
}

export interface StaffPreference {
  id_preference: number;
  id_staff: number;
  target_type: TargetType;
  id_site: number | null;
  id_department: number | null;
  id_target_staff: number | null;
  id_role: number | null;
  preference: PreferenceLevel;
  day_of_week: string | null;
  reason: string | null;
}

export interface SecretarySettings {
  id_staff: number;
  is_flexible: boolean;
  flexibility_pct: number;
  full_day_only: boolean;
  admin_target: number;
}

// ---- Work blocks & Assignments ----

export interface WorkBlock {
  id_block: number;
  id_department: number;
  id_calendar: number;
  date: string;
  period: Period;
  block_type: BlockType;
}

export interface Assignment {
  id_assignment: number;
  id_block: number;
  id_staff: number;
  assignment_type: AssignmentType;
  id_role: number | null;
  id_skill: number | null;
  id_activity: number | null;
  id_linked_doctor: number | null;
  source: AssignmentSource;
  status: AssignmentStatus;
  changed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulingIssue {
  id_issue: number;
  id_block: number;
  issue_type: IssueType;
  id_assignment: number | null;
  id_staff: number | null;
  id_role: number | null;
  description: string | null;
  resolved: boolean;
}

// ---- View types ----

export interface StaffingNeed {
  id_block: number;
  date: string;
  period: Period;
  block_type: BlockType;
  department: string;
  site: string;
  skill_name: string;
  role_name: string | null;
  id_skill: number;
  id_role: number | null;
  needed: number;
  assigned: number;
  gap: number;
}

export interface ActivityStaffingTier {
  id_tier: number;
  id_department: number;
  id_skill: number;
  id_role: number;
  min_doctors: number;
  max_doctors: number;
  quantity: number;
}

export interface RecurrenceType {
  id_recurrence: number;
  name: string;
  cycle_weeks: number;
}

// ---- Planning grid domain types ----

export interface PlanningAssignment {
  id_assignment: number;
  id_staff: number;
  firstname: string;
  lastname: string;
  assignment_type: AssignmentType;
  id_role: number | null;
  role_name: string | null;
  id_skill: number | null;
  skill_name: string | null;
  id_activity: number | null;
  activity_name: string | null;
  id_linked_doctor: number | null;
  source: AssignmentSource;
  status: AssignmentStatus;
  id_primary_position: PrimaryPosition;
  id_schedule: number | null;
}

export interface PlanningBlock {
  id_block: number;
  block_type: BlockType;
  assignments: PlanningAssignment[];
}

export interface PlanningPeriod {
  blocks: PlanningBlock[];
  needs: StaffingNeed[];
}

export interface PlanningDay {
  date: string;
  am: PlanningPeriod;
  pm: PlanningPeriod;
}

export interface PlanningDepartment {
  id_department: number;
  name: string;
  days: PlanningDay[];
}

export interface PlanningSite {
  id_site: number;
  name: string;
  departments: PlanningDepartment[];
}

export interface PlanningData {
  sites: PlanningSite[];
  stats: {
    totalNeeds: number;
    filled: number;
    gaps: number;
    proposed: number;
    confirmed: number;
    published: number;
  };
}
