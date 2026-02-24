"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { X, ArrowLeftRight, Loader2, Search } from "lucide-react";
import { useSwapAssignments } from "@/hooks/use-assignments";
import { cn } from "@/lib/utils";
import type { PlanningSite, PlanningAssignment } from "@/lib/types/database";

interface DayPersonLike {
  id_staff: number;
  firstname: string;
  lastname: string;
  type: "DOCTOR" | "SECRETARY";
  id_primary_position: 1 | 2 | 3;
  period: "AM" | "PM" | "FULL";
  roleId: number | null;
  skillId: number | null;
  id_assignment: number;
  id_block: number;
}

interface Candidate {
  id_staff: number;
  firstname: string;
  lastname: string;
  type: "DOCTOR" | "SECRETARY";
  period: "AM" | "PM";
  deptName: string;
  id_assignment: number;
  id_block: number;
  roleId: number | null;
  skillId: number | null;
}

interface SwapAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  personA: DayPersonLike;
  dateA: string;
  deptNameA: string;
  sites: PlanningSite[];
}

export function SwapAssignmentDialog({
  open,
  onClose,
  personA,
  dateA,
  deptNameA,
  sites,
}: SwapAssignmentDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const swap = useSwapAssignments();

  // Build candidates: other people assigned the same date, same type
  const candidates = useMemo(() => {
    const result: Candidate[] = [];
    for (const site of sites) {
      for (const dept of site.departments) {
        for (const day of dept.days) {
          if (day.date !== dateA) continue;
          for (const periodData of [
            { period: "AM" as const, data: day.am },
            { period: "PM" as const, data: day.pm },
          ]) {
            for (const block of periodData.data.blocks) {
              for (const a of block.assignments) {
                if (a.id_staff === personA.id_staff) continue;
                if (a.assignment_type !== personA.type) continue;
                // Avoid duplicates (same person may appear in both AM and PM)
                if (result.some((c) => c.id_assignment === a.id_assignment)) continue;
                result.push({
                  id_staff: a.id_staff,
                  firstname: a.firstname,
                  lastname: a.lastname,
                  type: a.assignment_type as "DOCTOR" | "SECRETARY",
                  period: periodData.period,
                  deptName: dept.name,
                  id_assignment: a.id_assignment,
                  id_block: block.id_block,
                  roleId: a.id_role,
                  skillId: a.id_skill,
                });
              }
            }
          }
        }
      }
    }
    return result.sort((a, b) => a.lastname.localeCompare(b.lastname));
  }, [sites, dateA, personA.id_staff, personA.type]);

  const filteredCandidates = useMemo(() => {
    if (!searchText.trim()) return candidates;
    const q = searchText.trim().toLowerCase();
    return candidates.filter(
      (c) => c.firstname.toLowerCase().includes(q) || c.lastname.toLowerCase().includes(q)
    );
  }, [candidates, searchText]);

  if (!open) return null;

  const selectedCandidate = candidates.find((c) => c.id_assignment === selectedId);

  const handleConfirm = () => {
    if (!selectedCandidate) return;
    setError(null);

    swap.mutate(
      {
        a: {
          assignmentId: personA.id_assignment,
          blockId: personA.id_block,
          staffId: personA.id_staff,
          type: personA.type,
          roleId: personA.roleId,
          skillId: personA.skillId,
        },
        b: {
          assignmentId: selectedCandidate.id_assignment,
          blockId: selectedCandidate.id_block,
          staffId: selectedCandidate.id_staff,
          type: selectedCandidate.type,
          roleId: selectedCandidate.roleId,
          skillId: selectedCandidate.skillId,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError(err instanceof Error ? err.message : "Erreur inconnue"),
      }
    );
  };

  const formattedDate = format(parseISO(dateA), "EEE d MMM", { locale: fr });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 border border-border/50 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <ArrowLeftRight className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Échanger
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Source info */}
          <div className="bg-muted/50 rounded-lg p-3 shrink-0">
            <p className="text-sm font-semibold text-foreground">
              {personA.firstname} {personA.lastname}
            </p>
            <p className="text-xs text-muted-foreground">
              {deptNameA} · {formattedDate} · {personA.period === "FULL" ? "Journée" : personA.period}
            </p>
          </div>

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border/50 bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring outline-none"
            />
          </div>

          {/* Candidate list */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {filteredCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun candidat disponible pour l&apos;échange
              </p>
            ) : (
              filteredCandidates.map((c) => (
                <button
                  key={c.id_assignment}
                  onClick={() => setSelectedId(c.id_assignment)}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-colors",
                    selectedId === c.id_assignment
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {c.firstname} {c.lastname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.deptName} · {c.period}
                    </p>
                  </div>
                  {selectedId === c.id_assignment && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm p-3 rounded-lg bg-destructive/10 text-destructive shrink-0">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border/50 text-foreground hover:bg-muted/50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedCandidate || swap.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {swap.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Échanger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
