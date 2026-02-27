"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Award,
  Stethoscope,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { POSITION_LABELS } from "@/lib/constants";
import { getPositionColors } from "@/lib/utils/position-colors";
import { getInitials } from "@/lib/utils/initials";
import { useAllStaffSkills, useAddSkill, useRemoveSkill, useStaffList } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSkills as fetchSkillsQuery } from "@/lib/supabase/queries";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";

// ── Types ────────────────────────────────────────────────

interface StaffSkillRow {
  id_staff: number;
  id_skill: number;
  preference: number;
  staff: { firstname: string; lastname: string; id_primary_position: number } | null;
  skills: { name: string; category: string } | null;
}

interface SkillGroup {
  id_skill: number;
  name: string;
  category: string;
  members: StaffSkillRow[];
}

type CategoryFilter = "all" | "consultation" | "chirurgie";

// ── Helpers ──────────────────────────────────────────────

const LEVEL_COLORS: Record<number, { color: string; bg: string }> = {
  1: { color: "#16a34a", bg: "#f0fdf4" },
  2: { color: "#d97706", bg: "#fffbeb" },
  3: { color: "#6b7280", bg: "#f3f4f6" },
};

const LEVEL_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];

function categoryAccent(cat: string) {
  return cat === "chirurgie" ? "#9B7BA8" : "#4A6FA5";
}

function categoryIcon(cat: string) {
  return cat === "chirurgie"
    ? <Scissors className="w-4 h-4" style={{ color: "#9B7BA8" }} />
    : <Stethoscope className="w-4 h-4" style={{ color: "#4A6FA5" }} />;
}

// ── Main Component ───────────────────────────────────────

export function SkillsView() {
  const { data: rawSkillEntries, isLoading } = useAllStaffSkills();
  const { data: allSkills } = useQuery({
    queryKey: ["config", "skills"],
    queryFn: () => fetchSkillsQuery(createClient()),
  });
  const { data: staffList } = useStaffList({ active: "true" });
  const addSkill = useAddSkill();
  const removeSkill = useRemoveSkill();

  // Filters
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");

  // Edit state
  const [editState, setEditState] = useState<{
    staffId: number;
    skillId: number;
    preference: string;
  } | null>(null);

  // Add state per skill
  const [addingSkillId, setAddingSkillId] = useState<number | null>(null);
  const [addStaffId, setAddStaffId] = useState("");
  const [addPreference, setAddPreference] = useState("2");

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<{ staffId: number; skillId: number; staffName: string; skillName: string } | null>(null);

  // Normalize raw data
  const normalized = useMemo(() => {
    if (!rawSkillEntries) return [];
    return (rawSkillEntries as unknown as Array<Record<string, unknown>>).map((row) => {
      const staffRaw = row.staff;
      const skillsRaw = row.skills;
      const staff = Array.isArray(staffRaw) ? staffRaw[0] ?? null : staffRaw ?? null;
      const skills = Array.isArray(skillsRaw) ? skillsRaw[0] ?? null : skillsRaw ?? null;
      return {
        id_staff: row.id_staff as number,
        id_skill: row.id_skill as number,
        preference: row.preference as number,
        staff: staff as StaffSkillRow["staff"],
        skills: skills as StaffSkillRow["skills"],
      };
    });
  }, [rawSkillEntries]);

  // Group by skill
  const skillGroups = useMemo(() => {
    const map = new Map<number, SkillGroup>();

    // Include all skills (even with 0 members)
    if (allSkills) {
      for (const s of allSkills as { id_skill: number; name: string; category: string }[]) {
        map.set(s.id_skill, { id_skill: s.id_skill, name: s.name, category: s.category, members: [] });
      }
    }

    for (const entry of normalized) {
      const skillName = entry.skills?.name ?? `Skill #${entry.id_skill}`;
      const skillCat = entry.skills?.category ?? "consultation";
      if (!map.has(entry.id_skill)) {
        map.set(entry.id_skill, { id_skill: entry.id_skill, name: skillName, category: skillCat, members: [] });
      }
      map.get(entry.id_skill)!.members.push(entry);
    }

    for (const group of map.values()) {
      group.members.sort((a, b) => {
        if (a.preference !== b.preference) return a.preference - b.preference;
        return (a.staff?.lastname ?? "").localeCompare(b.staff?.lastname ?? "");
      });
    }

    let groups = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Category filter
    if (catFilter !== "all") {
      groups = groups.filter((g) => g.category === catFilter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      groups = groups
        .map((g) => {
          if (g.name.toLowerCase().includes(q)) return g;
          const filteredMembers = g.members.filter((m) =>
            m.staff
              ? m.staff.firstname.toLowerCase().includes(q) || m.staff.lastname.toLowerCase().includes(q)
              : false
          );
          if (filteredMembers.length === 0) return null;
          return { ...g, members: filteredMembers };
        })
        .filter(Boolean) as SkillGroup[];
    }

    return groups;
  }, [normalized, allSkills, catFilter, search]);

  // Staff options for add — exclude already in skill
  const getAvailableStaff = (skillId: number) => {
    const existingIds = new Set(
      normalized.filter((e) => e.id_skill === skillId).map((e) => e.id_staff)
    );
    if (!staffList) return [];
    return (staffList as { id_staff: number; firstname: string; lastname: string }[])
      .filter((s) => !existingIds.has(s.id_staff))
      .sort((a, b) => a.lastname.localeCompare(b.lastname))
      .map((s) => ({ value: String(s.id_staff), label: `${s.lastname} ${s.firstname}` }));
  };

  const handleAdd = (skillId: number) => {
    if (!addStaffId) return;
    addSkill.mutate(
      { staffId: Number(addStaffId), skillId, preference: Number(addPreference) },
      {
        onSuccess: () => {
          setAddingSkillId(null);
          setAddStaffId("");
          setAddPreference("2");
        },
      },
    );
  };

  const handleUpdate = () => {
    if (!editState) return;
    addSkill.mutate(
      { staffId: editState.staffId, skillId: editState.skillId, preference: Number(editState.preference) },
      { onSuccess: () => setEditState(null) },
    );
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    removeSkill.mutate(
      { staffId: confirmDelete.staffId, skillId: confirmDelete.skillId },
      { onSuccess: () => setConfirmDelete(null) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Toolbar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border/50 shadow-subtle px-4 py-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 h-8 text-sm bg-muted/50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="w-px h-5 bg-border/50" />

        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {([
            { key: "all" as const, label: "Toutes" },
            { key: "consultation" as const, label: "Consultation" },
            { key: "chirurgie" as const, label: "Chirurgie" },
          ]).map((btn) => (
            <button
              key={btn.key}
              onClick={() => setCatFilter(btn.key)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all",
                catFilter === btn.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Skill Groups ──────────────────────────────── */}
      {skillGroups.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Aucune compétence trouvée</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {search || catFilter !== "all" ? "Essayez de modifier vos filtres" : "Aucune compétence enregistrée"}
          </p>
        </div>
      ) : (
        <>
          {[
            { cat: "consultation", label: "Consultation", icon: <Stethoscope className="w-4.5 h-4.5" style={{ color: "#4A6FA5" }} />, accent: "#4A6FA5" },
            { cat: "chirurgie", label: "Chirurgie", icon: <Scissors className="w-4.5 h-4.5" style={{ color: "#9B7BA8" }} />, accent: "#9B7BA8" },
          ]
            .filter((section) => {
              if (catFilter !== "all" && catFilter !== section.cat) return false;
              return skillGroups.some((g) => g.category === section.cat);
            })
            .map((section) => {
              const sectionGroups = skillGroups.filter((g) => g.category === section.cat);
              return (
                <div key={section.cat} className="space-y-3 mb-8 last:mb-0">
                  {/* Section header */}
                  <div className="flex items-center gap-2.5 px-1">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${section.accent}15` }}
                    >
                      {section.icon}
                    </div>
                    <h2 className="text-base font-bold text-foreground">{section.label}</h2>
                    <span
                      className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                      style={{ backgroundColor: `${section.accent}12`, color: section.accent }}
                    >
                      {sectionGroups.length}
                    </span>
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {sectionGroups.map((group) => {
                      const accent = categoryAccent(group.category);
                      const isAdding = addingSkillId === group.id_skill;

                      return (
                        <div
                          key={group.id_skill}
                          className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden"
                        >
                          {/* Skill header */}
                          <div className="flex items-center gap-3 px-5 py-3 border-b border-border/30">
                            <h3 className="text-sm font-semibold text-foreground flex-1 truncate">{group.name}</h3>
                            <span
                              className="text-xs font-semibold rounded-full px-2.5 py-0.5 shrink-0"
                              style={{ backgroundColor: `${accent}12`, color: accent }}
                            >
                              {group.members.length}
                            </span>
                          </div>

                          {/* Members */}
                          <div className="divide-y divide-border/20">
                            {group.members.length === 0 && !isAdding && (
                              <div className="px-5 py-4 text-sm text-muted-foreground/70 italic">
                                Aucun collaborateur
                              </div>
                            )}

                            {group.members.map((member) => {
                              if (!member.staff) return null;
                              const pos = member.staff.id_primary_position;
                              const colors = getPositionColors(pos);
                              const initials = getInitials(member.staff.firstname, member.staff.lastname);
                              const levelStyle = LEVEL_COLORS[member.preference] ?? LEVEL_COLORS[3];
                              const isEditing =
                                editState !== null &&
                                editState.staffId === member.id_staff &&
                                editState.skillId === member.id_skill;

                              return (
                                <div
                                  key={member.id_staff}
                                  className="flex items-center gap-3 px-5 py-2.5 group hover:bg-muted/20 transition-colors"
                                >
                                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0", colors.avatar)}>
                                    {initials}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {member.staff.firstname} {member.staff.lastname}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{POSITION_LABELS[pos] ?? "—"}</p>
                                  </div>

                                  {isEditing && editState ? (
                                    <div className="flex items-center gap-1.5">
                                      <CustomSelect
                                        value={editState.preference}
                                        onChange={(v) => setEditState((prev) => prev ? { ...prev, preference: v } : prev)}
                                        options={LEVEL_OPTIONS}
                                        placeholder="Niveau"
                                      />
                                      <button
                                        onClick={() => setEditState(null)}
                                        className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={handleUpdate}
                                        disabled={addSkill.isPending}
                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <span
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
                                        style={{
                                          color: levelStyle.color,
                                          backgroundColor: levelStyle.bg,
                                          borderColor: `${levelStyle.color}30`,
                                        }}
                                      >
                                        {member.preference}
                                      </span>

                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() =>
                                            setEditState({
                                              staffId: member.id_staff,
                                              skillId: member.id_skill,
                                              preference: String(member.preference),
                                            })
                                          }
                                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                          title="Modifier le niveau"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            setConfirmDelete({
                                              staffId: member.id_staff,
                                              skillId: member.id_skill,
                                              staffName: `${member.staff!.firstname} ${member.staff!.lastname}`,
                                              skillName: group.name,
                                            })
                                          }
                                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                                          title="Retirer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add form inline */}
                            {isAdding && (
                              <div className="flex items-center gap-2 px-5 py-3 bg-muted/10">
                                <CustomSelect
                                  value={addStaffId}
                                  onChange={setAddStaffId}
                                  options={getAvailableStaff(group.id_skill)}
                                  placeholder="Collaborateur..."
                                  className="min-w-[180px]"
                                />
                                <CustomSelect
                                  value={addPreference}
                                  onChange={setAddPreference}
                                  options={LEVEL_OPTIONS}
                                  placeholder="Niveau"
                                />
                                <button
                                  onClick={() => handleAdd(group.id_skill)}
                                  disabled={!addStaffId || addSkill.isPending}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setAddingSkillId(null);
                                    setAddStaffId("");
                                    setAddPreference("2");
                                  }}
                                  className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Add button footer */}
                          {!isAdding && (
                            <button
                              onClick={() => {
                                setAddingSkillId(group.id_skill);
                                setAddStaffId("");
                                setAddPreference("2");
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 border-t border-border/20 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Ajouter
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </>
      )}

      {/* ── Delete Confirm ─────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDelete}
        variant="danger"
        title="Retirer cette compétence ?"
        message={
          confirmDelete
            ? `La compétence « ${confirmDelete.skillName} » sera retirée du profil de ${confirmDelete.staffName}.`
            : ""
        }
        confirmLabel="Retirer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        isPending={removeSkill.isPending}
      />
    </div>
  );
}
