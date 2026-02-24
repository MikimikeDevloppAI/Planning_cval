"use client";

import { useState } from "react";
import { useAddSkill, useRemoveSkill } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSkills as fetchSkillsQuery } from "@/lib/supabase/queries";
import { Plus, Trash2, Stethoscope, Scissors } from "lucide-react";

interface SkillEntry {
  id_skill: number;
  preference: number;
  skills: { name: string } | null;
}

interface AvailableSkill {
  id_skill: number;
  name: string;
}

interface StaffSkillsManagerProps {
  staffId: number;
  skills: SkillEntry[];
}

const LEVEL_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Expert", color: "#16a34a", bg: "#f0fdf4" },
  2: { label: "Confirmé", color: "#d97706", bg: "#fffbeb" },
  3: { label: "Junior", color: "#6b7280", bg: "#f3f4f6" },
};

function isOperationSkill(name: string) {
  return /bloc/i.test(name);
}

export function StaffSkillsManager({ staffId, skills }: StaffSkillsManagerProps) {
  const addSkill = useAddSkill();
  const removeSkill = useRemoveSkill();
  const supabase = createClient();

  const { data: availableSkillsData } = useQuery({
    queryKey: ["config", "skills"],
    queryFn: () => fetchSkillsQuery(supabase),
  });
  const availableSkills = (availableSkillsData ?? []) as AvailableSkill[];

  const [selectedSkill, setSelectedSkill] = useState<number | "">("");
  const [preference, setPreference] = useState(2);

  const existingSkillIds = new Set(skills.map((s) => s.id_skill));
  const addableSkills = availableSkills.filter((s) => !existingSkillIds.has(s.id_skill));

  const handleAdd = () => {
    if (!selectedSkill) return;
    addSkill.mutate(
      { staffId, skillId: selectedSkill as number, preference },
      {
        onSuccess: () => {
          setSelectedSkill("");
          setPreference(2);
        },
      }
    );
  };

  // Group skills by consultation vs operation
  const consultationSkills = skills.filter((s) => !isOperationSkill(s.skills?.name ?? ""));
  const operationSkills = skills.filter((s) => isOperationSkill(s.skills?.name ?? ""));

  const renderSkillRow = (skill: SkillEntry) => {
    const level = LEVEL_LABELS[skill.preference] ?? LEVEL_LABELS[3];
    return (
      <div
        key={skill.id_skill}
        className="flex items-center justify-between rounded-xl px-3.5 py-2.5 hover:bg-muted/30 transition-colors group"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {skill.skills?.name ?? `Skill #${skill.id_skill}`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 border"
            style={{
              color: level.color,
              backgroundColor: level.bg,
              borderColor: `${level.color}30`,
            }}
          >
            {skill.preference} — {level.label}
          </span>
          <button
            onClick={() => removeSkill.mutate({ staffId, skillId: skill.id_skill })}
            className="text-muted-foreground/40 hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    items: SkillEntry[],
    accentColor: string
  ) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            {icon}
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <span
            className="text-[10px] font-bold rounded-full px-1.5 py-0.5 ml-auto"
            style={{ backgroundColor: `${accentColor}12`, color: accentColor }}
          >
            {items.length}
          </span>
        </div>
        <div className="bg-muted/20 rounded-xl border border-border/30 divide-y divide-border/20">
          {items.map(renderSkillRow)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aucune compétence assignée</p>
      ) : (
        <div className="space-y-3">
          {renderGroup(
            "Consultation",
            <Stethoscope className="w-3 h-3" style={{ color: "#4A6FA5" }} />,
            consultationSkills,
            "#4A6FA5"
          )}
          {renderGroup(
            "Opération",
            <Scissors className="w-3 h-3" style={{ color: "#9B7BA8" }} />,
            operationSkills,
            "#9B7BA8"
          )}
        </div>
      )}

      {addableSkills.length > 0 && (
        <div className="flex items-end gap-2 pt-2 border-t border-border/30">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Ajouter une compétence
            </label>
            <select
              value={selectedSkill}
              onChange={(e) =>
                setSelectedSkill(e.target.value ? parseInt(e.target.value) : "")
              }
              className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
            >
              <option value="">Choisir...</option>
              {addableSkills.map((s) => (
                <option key={s.id_skill} value={s.id_skill}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Niveau
            </label>
            <select
              value={preference}
              onChange={(e) => setPreference(parseInt(e.target.value))}
              className="rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
            >
              <option value={1}>1 — Expert</option>
              <option value={2}>2 — Confirmé</option>
              <option value={3}>3 — Junior</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={!selectedSkill || addSkill.isPending}
            className="px-3 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
