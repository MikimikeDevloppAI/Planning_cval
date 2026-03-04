"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useStaffDetail } from "@/hooks/use-staff";
import { StaffCard } from "@/components/staff/staff-card";
import { StaffCalendar } from "@/components/staff/staff-calendar";
import { StaffSkillsManager } from "@/components/staff/staff-skills-manager";
import { StaffPrefsManager } from "@/components/staff/staff-prefs-manager";
import { StaffSettings } from "@/components/staff/staff-settings";
import { StaffLeaveManager } from "@/components/staff/staff-leave-manager";
import { StaffScheduleViewer } from "@/components/staff/staff-schedule-viewer";
import { AddAssignmentDialog } from "@/components/dialogs/add-assignment-dialog";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Calendar,
  Award,
  Heart,
  CalendarOff,
  Clock,
  Settings,
  Sliders,
  Plus,
} from "lucide-react";

// ─── Shared types ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StaffAssignment = Record<string, any>;

interface StaffLeave {
  id_absence: number;
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
}

interface StaffSchedule {
  id_schedule: number;
  schedule_type: string;
  day_of_week: number | null;
  period: string;
  week_offset: number | null;
  is_active: boolean;
  id_department: number | null;
  id_recurrence: number | null;
  id_activity: number | null;
  start_date: string | null;
  end_date: string | null;
  departments: { name: string; sites: { name: string } | null } | null;
  recurrence_types: { name: string; cycle_weeks: number } | null;
  activity_templates: { name: string } | null;
}

interface StaffSkill {
  id_skill: number;
  preference: number;
  skills: { name: string; category: string } | null;
}

interface StaffPreference {
  id_preference: number;
  target_type: "SITE" | "DEPARTMENT" | "ROLE" | "STAFF";
  id_site: number | null;
  id_department: number | null;
  id_target_staff: number | null;
  id_role: number | null;
  preference: "INTERDIT" | "EVITER" | "PREFERE";
  day_of_week: string | null;
  reason: string | null;
  sites?: { name: string } | null;
  departments?: { name: string } | null;
  secretary_roles?: { name: string } | null;
}

interface SecretarySettingsData {
  is_flexible: boolean;
  flexibility_pct: number;
  full_day_only: boolean;
  admin_target: number;
}

// ─── Tab definitions ─────────────────────────────────────

type SecretaryTab = "planning" | "config";

const SECRETARY_TABS: { id: SecretaryTab; label: string; icon: React.ElementType }[] = [
  { id: "planning", label: "Planning", icon: Calendar },
  { id: "config", label: "Configuration", icon: Sliders },
];

// ─── Reusable UI components ──────────────────────────────

function QuickStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4",
        "bg-card border border-border/40",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]",
        "transition-all duration-300 group"
      )}
    >
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl group-hover:opacity-[0.12] transition-opacity"
        style={{ backgroundColor: color, opacity: 0.08 }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  className,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl border border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden",
        className
      )}
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      Ajouter
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────

export default function StaffDetailPage() {
  const params = useParams();
  const parsed = params.id ? parseInt(params.id as string) : NaN;
  const staffId = Number.isNaN(parsed) ? null : parsed;
  const { data, isLoading, error } = useStaffDetail(staffId);
  const [activeTab, setActiveTab] = useState<SecretaryTab>("planning");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement du profil...
      </div>
    );
  }

  if (error || !data?.staff) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive text-sm m-6">
        {error?.message ?? "Profil introuvable"}
      </div>
    );
  }

  const { staff, skills, preferences, settings, leaves, schedules, assignments } =
    data;

  const isSecretary = staff.id_primary_position === 2;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <StaffCard staff={staff} />

        <StatsRow
          assignments={assignments as StaffAssignment[]}
          leaves={leaves as StaffLeave[]}
          skills={skills}
          preferences={preferences}
          isSecretary={isSecretary}
        />

        {isSecretary ? (
          <>
            <div className="mb-5">
              <div className="inline-flex items-center bg-muted/40 p-1 rounded-xl border border-border/20">
                {SECRETARY_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                      )}
                    >
                      <TabIcon
                        className={cn(
                          "w-4 h-4",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === "planning" ? (
              <StaffPlanningContent
                staffId={staff.id_staff}
                staffName={`${staff.firstname} ${staff.lastname}`}
                idPrimaryPosition={staff.id_primary_position as 1 | 2 | 3}
                assignments={assignments as StaffAssignment[]}
                leaves={leaves as StaffLeave[]}
                schedules={schedules as StaffSchedule[]}
                animate
              />
            ) : (
              <ConfigTab
                staffId={staff.id_staff}
                skills={skills as StaffSkill[]}
                preferences={preferences as StaffPreference[]}
                settings={settings as SecretarySettingsData | null}
              />
            )}
          </>
        ) : (
          <StaffPlanningContent
            staffId={staff.id_staff}
            staffName={`${staff.firstname} ${staff.lastname}`}
            idPrimaryPosition={staff.id_primary_position as 1 | 2 | 3}
            assignments={assignments as StaffAssignment[]}
            leaves={leaves as StaffLeave[]}
            schedules={schedules as StaffSchedule[]}
          />
        )}
      </div>
    </div>
  );
}

// ─── Planning content (shared between Secretary tab & Doctor view) ───

function StaffPlanningContent({
  staffId,
  staffName,
  idPrimaryPosition,
  assignments,
  leaves,
  schedules,
  animate = false,
}: {
  staffId: number;
  staffName: string;
  idPrimaryPosition: 1 | 2 | 3;
  assignments: StaffAssignment[];
  leaves: StaffLeave[];
  schedules: StaffSchedule[];
  animate?: boolean;
}) {
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [addAssignmentDate, setAddAssignmentDate] = useState("");

  return (
    <div className={cn("space-y-4", animate && "animate-fade-in-up")}>
      <SectionCard title="Calendrier" icon={Calendar}>
        <StaffCalendar
          staffId={staffId}
          staffName={staffName}
          assignments={assignments}
          leaves={leaves}
          onAddClick={() => {
            setAddAssignmentDate("");
            setShowAddAssignment(true);
          }}
          onCellClick={(date) => {
            setAddAssignmentDate(date);
            setShowAddAssignment(true);
          }}
        />
      </SectionCard>

      {showAddAssignment && (
        <AddAssignmentDialog
          open
          onClose={() => setShowAddAssignment(false)}
          staffId={staffId}
          staffName={staffName}
          idPrimaryPosition={idPrimaryPosition}
          defaultDate={addAssignmentDate || undefined}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Planning récurrent"
          icon={Clock}
          className="lg:col-span-2"
          action={!showScheduleForm ? <AddButton onClick={() => setShowScheduleForm(true)} /> : undefined}
        >
          <StaffScheduleViewer
            staffId={staffId}
            schedules={schedules}
            showForm={showScheduleForm}
            onToggleForm={setShowScheduleForm}
          />
        </SectionCard>

        <SectionCard
          title="Congés & Absences"
          icon={CalendarOff}
          action={!showLeaveForm ? <AddButton onClick={() => setShowLeaveForm(true)} /> : undefined}
        >
          <StaffLeaveManager
            staffId={staffId}
            leaves={leaves}
            showForm={showLeaveForm}
            onToggleForm={setShowLeaveForm}
          />
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Config tab ──────────────────────────────────────────

function ConfigTab({
  staffId,
  skills,
  preferences,
  settings,
}: {
  staffId: number;
  skills: StaffSkill[];
  preferences: StaffPreference[];
  settings: SecretarySettingsData | null;
}) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <SectionCard title="Compétences" icon={Award}>
        <StaffSkillsManager staffId={staffId} skills={skills} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Préférences" icon={Heart}>
          <StaffPrefsManager staffId={staffId} preferences={preferences} />
        </SectionCard>

        <SectionCard title="Paramètres" icon={Settings}>
          <StaffSettings staffId={staffId} settings={settings} />
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Stats row ───────────────────────────────────────────

function StatsRow({
  assignments,
  leaves,
  skills,
  preferences,
  isSecretary,
}: {
  assignments: StaffAssignment[];
  leaves: StaffLeave[];
  skills: unknown[];
  preferences: unknown[];
  isSecretary: boolean;
}) {
  const currentMonthAssignments = useMemo(() => {
    const monthStr = format(new Date(), "yyyy-MM");
    return assignments.filter((a) =>
      a.work_blocks?.date?.startsWith(monthStr)
    ).length;
  }, [assignments]);

  const upcomingLeaves = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return leaves.filter((l) => l.end_date >= today).length;
  }, [leaves]);

  return (
    <div className={cn("grid gap-3 mb-6", isSecretary ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2")}>
      <QuickStat
        icon={<Calendar className="w-4 h-4" />}
        label="Assignations ce mois"
        value={currentMonthAssignments}
        color="#4A6FA5"
      />
      <QuickStat
        icon={<CalendarOff className="w-4 h-4" />}
        label="Congés à venir"
        value={upcomingLeaves}
        color="#D97706"
      />
      {isSecretary && (
        <>
          <QuickStat
            icon={<Award className="w-4 h-4" />}
            label="Compétences"
            value={skills.length}
            color="#6B8A7A"
          />
          <QuickStat
            icon={<Heart className="w-4 h-4" />}
            label="Préférences"
            value={preferences.length}
            color="#9B7BA8"
          />
        </>
      )}
    </div>
  );
}
