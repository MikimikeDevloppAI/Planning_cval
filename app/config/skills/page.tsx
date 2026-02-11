"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  const { data: skills, isLoading } = useQuery<Skill[]>({
    queryKey: ["config", "skills"],
    queryFn: async () => {
      const res = await fetch("/api/config/skills");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const updateSkill = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`/api/config/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "skills"] });
      setEditingId(null);
    },
  });

  const deleteSkill = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/config/skills/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "skills"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link
            href="/config"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Configuration
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">Compétences</h1>
        </div>
        {!showAdd && (
          <button
            onClick={() => {
              setShowAdd(true);
              setNewName("");
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {showAdd && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50">
              <Award className="w-4 h-4 text-blue-500" />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de la compétence..."
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                autoFocus
              />
              <button
                onClick={async () => {
                  if (!newName) return;
                  const res = await fetch("/api/config/skills", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newName }),
                  });
                  if (res.ok) {
                    queryClient.invalidateQueries({
                      queryKey: ["config", "skills"],
                    });
                    setShowAdd(false);
                  }
                }}
                disabled={!newName}
                className="text-green-600 p-1"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-400 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {(skills ?? []).map((skill) => (
            <div
              key={skill.id_skill}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <Award className="w-4 h-4 text-blue-500" />
              {editingId === skill.id_skill ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      updateSkill.mutate({ id: skill.id_skill, name: editName })
                    }
                    className="text-green-600 p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-gray-400 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-800 flex-1">
                    {skill.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(skill.id_skill);
                      setEditName(skill.name);
                    }}
                    className="text-gray-400 hover:text-blue-600 p-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteSkill.mutate(skill.id_skill)}
                    className="text-gray-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}

          {(skills ?? []).length === 0 && !showAdd && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Aucune compétence configurée
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
