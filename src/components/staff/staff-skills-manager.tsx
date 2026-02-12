"use client";

import { useState } from "react";
import { useAddSkill, useRemoveSkill } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSkills as fetchSkillsQuery } from "@/lib/supabase/queries";
import { Plus, Trash2, Star } from "lucide-react";

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
  const [preference, setPreference] = useState(3);

  const existingSkillIds = new Set(skills.map((s) => s.id_skill));
  const addableSkills = availableSkills.filter((s) => !existingSkillIds.has(s.id_skill));

  const handleAdd = () => {
    if (!selectedSkill) return;
    addSkill.mutate(
      { staffId, skillId: selectedSkill as number, preference },
      {
        onSuccess: () => {
          setSelectedSkill("");
          setPreference(3);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground mb-2">
        Compétences ({skills.length})
      </h4>

      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aucune compétence assignée</p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id_skill}
              className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {skill.skills?.name ?? `Skill #${skill.id_skill}`}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <Star
                      key={level}
                      className={`w-3.5 h-3.5 ${
                        level <= skill.preference
                          ? "fill-warning text-warning"
                          : "text-border"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() =>
                  removeSkill.mutate({ staffId, skillId: skill.id_skill })
                }
                className="text-destructive/50 hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
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
              Préférence
            </label>
            <select
              value={preference}
              onChange={(e) => setPreference(parseInt(e.target.value))}
              className="rounded-xl border border-border/50 bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  {"★".repeat(p)}
                </option>
              ))}
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
