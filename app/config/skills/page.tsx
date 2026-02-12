"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSkills as fetchSkillsQuery,
  updateSkill as updateSkillQuery,
  deleteSkill as deleteSkillQuery,
  createSkill as createSkillQuery,
} from "@/lib/supabase/queries";
import {
  Award,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Skill {
  id_skill: number;
  name: string;
}

export default function SkillsConfigPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const supabase = createClient();

  const { data: skills, isLoading } = useQuery<Skill[]>({
    queryKey: ["config", "skills"],
    queryFn: () => fetchSkillsQuery(supabase) as Promise<Skill[]>,
  });

  const updateSkill = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return updateSkillQuery(supabase, id, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "skills"] });
      setEditingId(null);
    },
  });

  const deleteSkill = useMutation({
    mutationFn: async (id: number) => {
      return deleteSkillQuery(supabase, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "skills"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/config"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Configuration
          </Link>
          <span className="text-border">/</span>
          <h1 className="text-xl font-bold text-foreground">Compétences</h1>
        </div>
        {!showAdd && (
          <button
            onClick={() => {
              setShowAdd(true);
              setNewName("");
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden">
        <div className="divide-y divide-border/20">
          {showAdd && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5">
              <Award className="w-4 h-4 text-primary" />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de la compétence..."
                className="flex-1 rounded-lg border border-border/50 bg-card px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
                autoFocus
              />
              <button
                onClick={async () => {
                  if (!newName) return;
                  await createSkillQuery(supabase, newName);
                  queryClient.invalidateQueries({ queryKey: ["config", "skills"] });
                  setShowAdd(false);
                }}
                disabled={!newName}
                className="text-success p-1"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="text-muted-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {(skills ?? []).map((skill) => (
            <div
              key={skill.id_skill}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
            >
              <Award className="w-4 h-4 text-primary" />
              {editingId === skill.id_skill ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg border border-border/50 bg-card px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      updateSkill.mutate({ id: skill.id_skill, name: editName })
                    }
                    className="text-success p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-muted-foreground p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground flex-1">
                    {skill.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(skill.id_skill);
                      setEditName(skill.name);
                    }}
                    className="text-muted-foreground hover:text-primary p-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteSkill.mutate(skill.id_skill)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}

          {(skills ?? []).length === 0 && !showAdd && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucune compétence configurée
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
