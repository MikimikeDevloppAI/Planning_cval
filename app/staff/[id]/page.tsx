"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
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

export default function StaffDetailPage() {
  const params = useParams();
  const staffId = params.id ? parseInt(params.id as string) : null;
  const { data, isLoading, error } = useStaffDetail(staffId);
  const [activeTab, setActiveTab] = useState<TabId>("calendar");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement du profil...
      </div>
    );
  }

  if (error || !data?.staff) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error?.message ?? "Profil introuvable"}
      </div>
    );
  }

  const { staff, skills, preferences, settings, leaves, schedules, assignments } =
    data;

  // Only show settings tab for secretaries (position 2)
  const visibleTabs =
    staff.id_primary_position === 2
      ? TABS
      : TABS.filter((t) => t.id !== "settings");

  return (
    <div>
      <StaffCard staff={staff} />

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
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
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
            <StaffPrefsManager staffId={staff.id_staff} preferences={preferences} />
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
  );
}
