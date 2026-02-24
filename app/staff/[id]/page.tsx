"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { format } from "date-fns";
import { useStaffDetail } from "@/hooks/use-staff";
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
  CalendarOff,
  Clock,
  Settings,
} from "lucide-react";

// ─── Quick stat card ─────────────────────────────────────

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

// ─── Section wrapper ─────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
  className,
  scrollable,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl border border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden",
        scrollable && "flex flex-col",
        className
      )}
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30 shrink-0">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className={cn("p-5", scrollable && "overflow-y-auto flex-1")}>{children}</div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────

export default function StaffDetailPage() {
  const params = useParams();
  const staffId = params.id ? parseInt(params.id as string) : null;
  const { data, isLoading, error } = useStaffDetail(staffId);

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
        {/* Profile header */}
        <StaffCard staff={staff} />

        {/* Quick stats */}
        <StatsRow
          assignments={assignments}
          leaves={leaves}
          skills={skills}
          preferences={preferences}
          isSecretary={isSecretary}
        />

        {/* Secretary-specific sections — above calendar */}
        {isSecretary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Compétences */}
            <SectionCard title="Compétences" icon={Award}>
              <StaffSkillsManager staffId={staff.id_staff} skills={skills} />
            </SectionCard>

            {/* Préférences */}
            <SectionCard title="Préférences" icon={Heart}>
              <StaffPrefsManager
                staffId={staff.id_staff}
                preferences={preferences}
              />
            </SectionCard>

            {/* Paramètres */}
            <SectionCard title="Paramètres" icon={Settings}>
              <StaffSettings staffId={staff.id_staff} settings={settings} />
            </SectionCard>
          </div>
        )}

        {/* Dashboard grid: Calendar (2/3) + Sidebar (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar — takes 2 columns */}
          <SectionCard
            title="Calendrier"
            icon={Calendar}
            className="lg:col-span-2"
          >
            <StaffCalendar assignments={assignments} leaves={leaves} />
          </SectionCard>

          {/* Sidebar — stacked cards (fixed height, scrollable) */}
          <div className="space-y-4 flex flex-col">
            {/* Congés */}
            <SectionCard title="Congés & Absences" icon={CalendarOff} scrollable className="max-h-[340px]">
              <StaffLeaveManager staffId={staff.id_staff} leaves={leaves} />
            </SectionCard>

            {/* Planning récurrent */}
            <SectionCard title="Planning récurrent" icon={Clock} scrollable className="max-h-[340px]">
              <StaffScheduleViewer schedules={schedules} />
            </SectionCard>
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
  isSecretary,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assignments: any[];
  leaves: { end_date: string }[];
  skills: unknown[];
  preferences: unknown[];
  isSecretary: boolean;
}) {
  const currentMonthAssignments = useMemo(() => {
    const monthStr = format(new Date(), "yyyy-MM");
    return assignments.filter((a: { work_blocks?: { date?: string } }) =>
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
