"use client";

import { useState, useEffect } from "react";
import { useAddSkill, useRemoveSkill } from "@/hooks/use-staff";
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
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<number | "">("");
  const [preference, setPreference] = useState(3);

  useEffect(() => {
    fetch("/api/config/skills")
      .then((r) => r.json())
      .then((data) => setAvailableSkills(Array.isArray(data) ? data : []));
  }, []);

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
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        Compétences ({skills.length})
      </h4>

      {skills.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune compétence assignée</p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id_skill}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-800">
                  {skill.skills?.name ?? `Skill #${skill.id_skill}`}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <Star
                      key={level}
                      className={`w-3.5 h-3.5 ${
                        level <= skill.preference
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() =>
                  removeSkill.mutate({ staffId, skillId: skill.id_skill })
                }
                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {addableSkills.length > 0 && (
        <div className="flex items-end gap-2 pt-2 border-t border-gray-100">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Ajouter une compétence
            </label>
            <select
              value={selectedSkill}
              onChange={(e) =>
                setSelectedSkill(e.target.value ? parseInt(e.target.value) : "")
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Préférence
            </label>
            <select
              value={preference}
              onChange={(e) => setPreference(parseInt(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
