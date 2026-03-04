"use client";

import { useState } from "react";
import { useAddSkill, useRemoveSkill } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSkills as fetchSkillsQuery } from "@/lib/supabase/queries";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, X, Stethoscope, Scissors } from "lucide-react";

interface SkillEntry {
  id_skill: number;
  preference: number;
  skills: { name: string; category: string } | null;
}

interface AvailableSkill {
  id_skill: number;
  name: string;
  category: string;
}

interface StaffSkillsManagerProps {
  staffId: number;
  skills: SkillEntry[];
}

const SCORE_COLORS: Record<number, { color: string; bg: string }> = {
  1: { color: "#16a34a", bg: "#f0fdf4" },
  2: { color: "#d97706", bg: "#fffbeb" },
  3: { color: "#6b7280", bg: "#f3f4f6" },
};

const CATEGORIES = [
  {
    key: "consultation" as const,
    label: "Consultation",
    icon: <Stethoscope className="w-3.5 h-3.5" style={{ color: "#4A6FA5" }} />,
    accent: "#4A6FA5",
  },
  {
    key: "chirurgie" as const,
    label: "Opération",
    icon: <Scissors className="w-3.5 h-3.5" style={{ color: "#9B7BA8" }} />,
    accent: "#9B7BA8",
  },
];

export function StaffSkillsManager({ staffId, skills }: StaffSkillsManagerProps) {
  const addSkill = useAddSkill();
  const removeSkill = useRemoveSkill();
  const supabase = createClient();

  const { data: availableSkillsData } = useQuery({
    queryKey: ["config", "skills"],
    queryFn: () => fetchSkillsQuery(supabase),
  });
  const availableSkills = (availableSkillsData ?? []) as AvailableSkill[];

  const existingSkillIds = new Set(skills.map((s) => s.id_skill));

  // Inline edit state
  const [editingSkill, setEditingSkill] = useState<{ id_skill: number; preference: number } | null>(null);

  // Add state per category
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [addSkillId, setAddSkillId] = useState<number | "">("");
  const [addPreference, setAddPreference] = useState(2);

  const [confirmDelete, setConfirmDelete] = useState<SkillEntry | null>(null);

  // Group skills by category
  const groupedSkills: Record<string, SkillEntry[]> = {
    consultation: skills
      .filter((s) => (s.skills?.category ?? "consultation") === "consultation")
      .sort((a, b) => (a.skills?.name ?? "").localeCompare(b.skills?.name ?? "")),
    chirurgie: skills
      .filter((s) => (s.skills?.category ?? "consultation") === "chirurgie")
      .sort((a, b) => (a.skills?.name ?? "").localeCompare(b.skills?.name ?? "")),
  };

  const handleInlineUpdate = (skillId: number, newPref: number) => {
    addSkill.mutate(
      { staffId, skillId, preference: newPref },
      { onSuccess: () => setEditingSkill(null) },
    );
  };

  const handleAdd = () => {
    if (!addSkillId) return;
    addSkill.mutate(
      { staffId, skillId: addSkillId as number, preference: addPreference },
      {
        onSuccess: () => {
          setAddingCategory(null);
          setAddSkillId("");
          setAddPreference(2);
        },
      },
    );
  };

  const getAddableSkills = (category: string) =>
    availableSkills
      .filter((s) => s.category === category && !existingSkillIds.has(s.id_skill))
      .sort((a, b) => a.name.localeCompare(b.name));

  const renderSkillRow = (skill: SkillEntry) => {
    const score = SCORE_COLORS[skill.preference] ?? SCORE_COLORS[3];
    const isEditing = editingSkill?.id_skill === skill.id_skill;

    return (
      <div
        key={skill.id_skill}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors group"
      >
        <span className="text-[13px] font-medium text-foreground truncate flex-1 min-w-0">
          {skill.skills?.name ?? `Skill #${skill.id_skill}`}
        </span>

        {isEditing ? (
          <div className="flex items-center gap-0.5 shrink-0">
            {[1, 2, 3].map((val) => {
              const s = SCORE_COLORS[val];
              return (
                <button
                  key={val}
                  onClick={() => handleInlineUpdate(skill.id_skill, val)}
                  disabled={addSkill.isPending}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                    editingSkill.preference === val
                      ? "scale-110 shadow-sm"
                      : "opacity-60 hover:opacity-100"
                  )}
                  style={{
                    color: s.color,
                    backgroundColor: s.bg,
                    borderColor: editingSkill.preference === val ? s.color : `${s.color}40`,
                  }}
                >
                  {val}
                </button>
              );
            })}
            <button
              onClick={() => setEditingSkill(null)}
              className="p-1 text-muted-foreground hover:bg-muted rounded-lg transition-colors ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditingSkill({ id_skill: skill.id_skill, preference: skill.preference })}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border cursor-pointer hover:scale-110 transition-all"
              style={{
                color: score.color,
                backgroundColor: score.bg,
                borderColor: `${score.color}30`,
              }}
              title="Modifier le niveau"
            >
              {skill.preference}
            </button>
            <button
              onClick={() => setConfirmDelete(skill)}
              className="text-muted-foreground/30 hover:text-destructive p-0.5 rounded-lg hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const items = groupedSkills[cat.key] ?? [];
          const isAdding = addingCategory === cat.key;
          const addable = getAddableSkills(cat.key);

          return (
            <div key={cat.key}>
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${cat.accent}15` }}
                >
                  {cat.icon}
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {cat.label}
                </span>
                <span
                  className="text-[10px] font-bold rounded-full px-1.5 py-0.5 ml-auto"
                  style={{ backgroundColor: `${cat.accent}12`, color: cat.accent }}
                >
                  {items.length}
                </span>
              </div>

              {/* Skills list */}
              <div className="bg-muted/20 rounded-xl border border-border/30 divide-y divide-border/20 overflow-hidden">
                {items.length === 0 && !isAdding && (
                  <div className="px-3 py-3 text-xs text-muted-foreground/60 italic text-center">
                    Aucune
                  </div>
                )}

                {items.map(renderSkillRow)}

                {/* Inline add form */}
                {isAdding && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/10">
                    <CustomSelect
                      value={addSkillId ? String(addSkillId) : ""}
                      onChange={(v) => setAddSkillId(v ? parseInt(v) : "")}
                      options={addable.map((s) => ({ value: String(s.id_skill), label: s.name }))}
                      placeholder="Compétence..."
                      className="flex-1 min-w-0"
                    />
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3].map((val) => {
                        const s = SCORE_COLORS[val];
                        return (
                          <button
                            key={val}
                            onClick={() => setAddPreference(val)}
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                              addPreference === val
                                ? "scale-110 shadow-sm"
                                : "opacity-50 hover:opacity-100"
                            )}
                            style={{
                              color: s.color,
                              backgroundColor: s.bg,
                              borderColor: addPreference === val ? s.color : `${s.color}40`,
                            }}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={handleAdd}
                      disabled={!addSkillId || addSkill.isPending}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setAddingCategory(null);
                        setAddSkillId("");
                        setAddPreference(2);
                      }}
                      className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Add button per column */}
              {!isAdding && addable.length > 0 && (
                <button
                  onClick={() => {
                    setAddingCategory(cat.key);
                    setAddSkillId("");
                    setAddPreference(2);
                  }}
                  className="w-full flex items-center justify-center gap-1 mt-1.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Ajouter
                </button>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        variant="danger"
        title="Supprimer cette compétence ?"
        message={`La compétence « ${confirmDelete?.skills?.name ?? ""} » sera retirée de ce profil.`}
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (confirmDelete) {
            removeSkill.mutate(
              { staffId, skillId: confirmDelete.id_skill },
              { onSuccess: () => setConfirmDelete(null) }
            );
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        isPending={removeSkill.isPending}
      />
    </div>
  );
}
