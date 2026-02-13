"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useStaffDetail } from "@/hooks/use-staff";
import { getPositionColors } from "@/lib/utils/position-colors";
import { StaffCard } from "@/components/staff/staff-card";
import { StaffCalendar } from "@/components/staff/staff-calendar";
import { StaffSkillsManager } from "@/components/staff/staff-skills-manager";
import { StaffPrefsManager } from "@/components/staff/staff-prefs-manager";
import { StaffSettings } from "@/components/staff/staff-settings";
import { StaffLeaveManager } from "@/components/staff/staff-leave-manager";
import { StaffScheduleViewer } from "@/components/staff/staff-schedule-viewer";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Calendar,
  Award,
  Heart,
  Settings,
  CalendarOff,
  Clock,
} from "lucide-react";

const TABS = [
  { id: "calendar", label: "Calendrier", icon: Calendar },
  { id: "skills", label: "Compétences", icon: Award },
  { id: "prefs", label: "Préférences", icon: Heart },
  { id: "settings", label: "Paramètres", icon: Settings },
  { id: "leaves", label: "Congés", icon: CalendarOff },
  { id: "schedule", label: "Planning", icon: Clock },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Quick stat card ─────────────────────────────────────

function QuickStat({
  icon,
  label,
  value,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  gradient: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-4",
        "bg-card border border-border/50",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
        "transition-all duration-200"
      )}
    >
      <div
        className={cn(
          "absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-10",
          "bg-gradient-to-br",
          gradient
        )}
      />
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg bg-gradient-to-br text-white",
            gradient
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
              gradient
            )}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────

export default function StaffDetailPage() {
  const params = useParams();
  const staffId = params.id ? parseInt(params.id as string) : null;
  const { data, isLoading, error } = useStaffDetail(staffId);
  const [activeTab, setActiveTab] = useState<TabId>("calendar");

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

  const colors = getPositionColors(staff.id_primary_position);

  // Only show settings tab for secretaries (position 2)
  const visibleTabs =
    staff.id_primary_position === 2
      ? TABS
      : TABS.filter((t) => t.id !== "settings");

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <StaffCard staff={staff} />

        {/* Quick stats */}
        <StatsRow
          assignments={assignments}
          leaves={leaves}
          skills={skills}
          preferences={preferences}
        />

        {/* Tabs */}
        <div className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden">
          <div className="border-b border-border/30">
            <nav className="flex overflow-x-auto">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === tab.id
                        ? cn("text-foreground", colors.border)
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "calendar" && (
              <StaffCalendar assignments={assignments} leaves={leaves} />
            )}
            {activeTab === "skills" && (
              <StaffSkillsManager staffId={staff.id_staff} skills={skills} />
            )}
            {activeTab === "prefs" && (
              <StaffPrefsManager
                staffId={staff.id_staff}
                preferences={preferences}
              />
            )}
            {activeTab === "settings" && staff.id_primary_position === 2 && (
              <StaffSettings staffId={staff.id_staff} settings={settings} />
            )}
            {activeTab === "leaves" && (
              <StaffLeaveManager staffId={staff.id_staff} leaves={leaves} />
            )}
            {activeTab === "schedule" && (
              <StaffScheduleViewer schedules={schedules} />
            )}
          </div>
        </div>
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
}: {
  assignments: { work_blocks: { date: string } | null }[];
  leaves: { end_date: string }[];
  skills: unknown[];
  preferences: unknown[];
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <QuickStat
        icon={<Calendar className="w-4 h-4" />}
        label="Assignations ce mois"
        value={currentMonthAssignments}
        gradient="from-cyan-500 to-blue-600"
      />
      <QuickStat
        icon={<CalendarOff className="w-4 h-4" />}
        label="Congés à venir"
        value={upcomingLeaves}
        gradient="from-amber-500 to-orange-600"
      />
      <QuickStat
        icon={<Award className="w-4 h-4" />}
        label="Compétences"
        value={skills.length}
        gradient="from-emerald-500 to-green-600"
      />
      <QuickStat
        icon={<Heart className="w-4 h-4" />}
        label="Préférences"
        value={preferences.length}
        gradient="from-violet-500 to-purple-600"
      />
    </div>
  );
}
